#!/usr/bin/env python3
"""Extract only QCVN 02:2022/BXD Tables 5.1, 6.1, 6.2 from the reviewed artifact.

Requires PyMuPDF (existing requirements-standard-source.txt). Original PDF stays
outside Git. Fail closed on unknown layouts, rows or source identity. No solver.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import fitz

SHA256 = '12cce9e43ce7c4f5e143e62239d038f5499cd6c713ab832b2e15b4a962962bce'
SOURCE_URL = 'https://datafiles.chinhphu.vn/cpp/files/vbpq/2022/10/02-bxd.pdf'


def clean(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', value or '')).strip()


def key(value):
    value = unicodedata.normalize('NFKD', value.lower().replace('đ', 'd'))
    value = ''.join(char for char in value if not unicodedata.combining(char))
    return re.sub(r'[^a-z0-9]+', ' ', value).strip()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def extract_table(doc, kind, pages):
    records, provinces = [], {}
    province_id = None
    for page_number in pages:
        page = doc[page_number - 1]
        tables = page.find_tables().tables
        require(len(tables) == 1, f'{kind}: expected one table on page {page_number}')
        table = tables[0]
        for row_index, row in enumerate(table.extract()):
            cells = [clean(cell) for cell in row]
            if kind == 'wind' and len(cells) == 15:
                cells = [clean(' '.join(cells[i:i + 3])) for i in range(0, 15, 3)]
            width = {'wind': 5, 'agr': 4, 'spectral': 6}[kind]
            require(len(cells) == width, f'Unexpected column count: {kind}/{page_number}')
            match = re.match(r'^(\d+)\.\s*(.+)', cells[0])
            if match:
                province_id = f'p{int(match[1]):02d}'
                require(province_id not in provinces, 'Repeated province heading')
                provinces[province_id] = match[2]
                continue
            if row_index < 3 and (cells[0].casefold() == 'địa danh' or cells[0] in ['(1)', '']):
                continue  # Continuation pages can start data at row index 2.
            groups = [cells] if kind == 'wind' else [cells[:width // 2], cells[width // 2:]]
            for side, group in enumerate(groups):
                if not any(group):
                    continue
                require(province_id is not None and group[0], 'Missing geographic context')
                source = {'table': {'wind': '5.1', 'agr': '6.1', 'spectral': '6.2'}[kind],
                          'pdf_page': page_number, 'printed_page': page_number - 1,
                          'table_row': row_index + 1, 'side': 'left' if side == 0 else 'right'}
                record = {'id': f'{kind}-{province_id}-{page_number}-{row_index + 1}-{side}',
                          'province_id': province_id, 'location': group[0], 'source': source}
                if kind == 'wind':
                    require(group[1] in ['I', 'II', 'III', 'IV', 'V'] and
                            all(re.fullmatch(r'\d+', cell) for cell in group[2:]), f'Unknown wind row {source}: {group}')
                    record.update(zone=group[1], w0_daN_m2=int(group[2]),
                                  v3s_50_m_s=int(group[3]), v10min_50_m_s=int(group[4]))
                else:
                    values = []
                    for value_index, value in enumerate(group[1:]):
                        if re.fullmatch(r'\d+,\d+×g', value):
                            values.append({'value_g': float(value.split('×')[0].replace(',', '.')),
                                           'raw': value, 'status': 'provided'})
                        else:
                            # Reviewed source exception: Vinh SS cell lacks ×g.
                            require(kind == 'spectral' and page_number == 98 and
                                    group[0] == 'Thành phố Vinh' and value_index == 0 and value == '0,38',
                                    f'Unknown acceleration cell {source}: {group}')
                            values.append({'value_g': None, 'raw': value, 'status': 'source_unit_missing'})
                    record['values'] = values
                records.append(record)
    require(list(provinces) == [f'p{i:02d}' for i in range(1, 64)], f'{kind}: incomplete province headings')
    return records, provinces


def build(pdf):
    require(hashlib.sha256(pdf.read_bytes()).hexdigest() == SHA256, 'Unreviewed source SHA-256')
    with fitz.open(pdf) as doc:
        require(len(doc) == 619 and 'QCVN 02:2022/BXD' in doc[1].get_text(), 'Wrong document')
        wind, provinces = extract_table(doc, 'wind', range(43, 65))
        agr, agr_provinces = extract_table(doc, 'agr', range(71, 88))
        spectral, spectral_provinces = extract_table(doc, 'spectral', range(88, 105))
    require({p: key(n) for p, n in provinces.items()} ==
            {p: key(n) for p, n in agr_provinces.items()} ==
            {p: key(n) for p, n in spectral_provinces.items()}, 'Province identities disagree across tables')
    require((len(wind), len(agr), len(spectral)) == (334, 705, 704), 'Unexpected table coverage')
    index = {(r['province_id'], key(r['location'])): r for r in spectral}
    require(len(index) == len(spectral), 'Duplicate spectral location')
    seismic, used = [], set()
    for row in agr:
        notes = []
        match_key = key(row['location'])
        # Explicitly reviewed, edition-local cross-table label differences.
        if row['province_id'] == 'p11' and row['location'] == 'Thành phố Từ Sơn':
            match_key = key('Thị xã Từ Sơn')
            notes.append('tu_son_labels_differ')
        if row['province_id'] == 'p59' and row['location'] in ['Thị xã Duyên Hải', 'Huyện Duyên Hải']:
            match_key = key('Thị xã, huyện Duyên Hải')
            notes.append('duyen_hai_shared_spectral_scope')
        match = index.get((row['province_id'], match_key))
        require(match is not None, f'Unmatched seismic location: {row}')
        used.add(match['id'])
        if row['location'] != match['location'] and not notes:
            require(key(row['location']) == key(match['location']), 'Unreviewed label difference')
            notes.append('phan_rang_spacing_differs' if row['province_id'] == 'p43' and
                         'Phan Rang' in row['location'] else 'source_label_spelling_differs')
        seismic.append({'id': row['id'].replace('agr-', 'seismic-'),
                        'province_id': row['province_id'], 'location': row['location'],
                        'spectral_location': match['location'], 'notes': notes,
                        'agr': {**row['values'][0], 'source': row['source']},
                        'ss': {**match['values'][0], 'source': match['source']},
                        's1': {**match['values'][1], 'source': match['source']}})
    require(len(used) == len(spectral), 'Unused spectral records')
    return {'schema_version': '1.0', 'dataset_version': 'qcvn02-2022.1',
            'source': {'title': 'QCVN 02:2022/BXD', 'url': SOURCE_URL, 'sha256': SHA256,
                       'pdf_pages': 619, 'bytes': pdf.stat().st_size,
                       'administrative_reference': 'source_edition_2022',
                       'definitions_pdf_pages': {'wind': [39, 40, 41], 'agr': [66], 'ss_s1': [66, 67]},
                       'notes': ['printed_page_70_header_says_2020', 'vinh_ss_unit_missing']},
            'coverage': {'provinces': 63, 'wind_scope_rows': 334, 'agr_source_rows': 705,
                         'spectral_source_rows': 704, 'seismic_locations': 705},
            'provinces': [{'id': id_, 'name': name, 'source_names': {
                '5.1': name, '6.1': agr_provinces[id_], '6.2': spectral_provinces[id_]}}
                for id_, name in provinces.items()],
            'wind': wind, 'seismic': seismic}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    data = build(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(data['coverage']))
