#!/usr/bin/env python3
"""Cross-read every published location/value cell using pdfplumber, not PyMuPDF.

pip install -r requirements-location-verification.txt
Original PDF is an external source, never a public test fixture.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber


def text(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', value or '')).strip()


def verify(pdf, dataset):
    data = json.loads(dataset.read_text(encoding='utf-8'))
    assert hashlib.sha256(pdf.read_bytes()).hexdigest() == data['source']['sha256']
    actual, expected = {}, {}
    def put(source, province, cells):
        identity = (source['table'], source['pdf_page'], source['table_row'], source['side'])
        value = (province, tuple(cells))
        if identity in actual:
            assert actual[identity] == value, ('Conflicting shared source row', identity)
        actual[identity] = value
    for r in data['wind']:
        put(r['source'], r['province_id'], [r['location'], r['zone'], str(r['w0_daN_m2']),
                                          str(r['v3s_50_m_s']), str(r['v10min_50_m_s'])])
    for r in data['seismic']:
        put(r['agr']['source'], r['province_id'], [r['location'], r['agr']['raw']])
        put(r['ss']['source'], r['province_id'], [r['spectral_location'], r['ss']['raw'], r['s1']['raw']])
    with pdfplumber.open(pdf) as document:
        for table_id, pages in [('5.1', range(43, 65)), ('6.1', range(71, 88)), ('6.2', range(88, 105))]:
            province = None
            for number in pages:
                tables = document.pages[number - 1].find_tables()
                assert len(tables) == 1
                for row_index, row in enumerate(tables[0].extract()):
                    cells = [text(cell) for cell in row]
                    if table_id == '5.1' and len(cells) == 15:
                        cells = [text(' '.join(cells[i:i + 3])) for i in range(0, 15, 3)]
                    heading = re.match(r'^(\d+)\.\s*(.+)', cells[0])
                    if heading:
                        province = f'p{int(heading[1]):02d}'
                        p = next(p for p in data['provinces'] if p['id'] == province)
                        assert p['source_names'][table_id] == heading[2]
                        continue
                    if row_index < 3 and (cells[0].casefold() == 'địa danh' or cells[0] in ['', '(1)']):
                        continue
                    groups = [cells] if table_id == '5.1' else [cells[:len(cells) // 2], cells[len(cells) // 2:]]
                    for side, group in enumerate(groups):
                        if not any(group):
                            continue
                        identity = (table_id, number, row_index + 1, 'left' if side == 0 else 'right')
                        assert identity not in expected
                        expected[identity] = (province, tuple(group))
    assert actual == expected, {'missing': set(expected) - set(actual), 'extra': set(actual) - set(expected),
                                'different': [i for i in actual.keys() & expected.keys() if actual[i] != expected[i]][:10]}
    print(f'PASS: {len(expected)} source rows, all location labels/values/province headings agree across PDF readers')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('dataset', type=Path)
    args = parser.parse_args()
    verify(args.pdf, args.dataset)
