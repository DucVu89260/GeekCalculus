#!/usr/bin/env python3
"""Inspect and index an administrator-provisioned private standards PDF.

Extraction is source indexing, never engineering verification. No expressions are
reconstructed. Run PDF OUTPUT.json [--edition CODE], or PDF --inspect --edition CODE.
Edition identity and patterns are configured in standards-editions.json. Page
boundaries are measured from the actual source; physical pages are one-based.
"""
import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz

CONFIG_PATH = Path(__file__).with_name('standards-editions.json')


def edition_config(edition):
    configs = json.loads(CONFIG_PATH.read_text())
    config = configs.get(edition)
    if not config or not config.get('active'):
        raise ValueError(f'Edition {edition} is not enabled for ingestion')
    return config


def normalized(value):
    return ' '.join(value.split())


def content_lines(page):
    rows = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            spans = line['spans']
            text = normalized(''.join(span['text'] for span in spans))
            if text:
                rows.append({'text': text, 'bbox': list(line['bbox']),
                             'bold': all('bold' in span['font'].lower() for span in spans if span['text'].strip()),
                             'size': max(span['size'] for span in spans)})
    return sorted(rows, key=lambda row: (round(row['bbox'][1], 1), row['bbox'][0]))


def inspect_open(doc, pdf_path, edition, config):
    if doc.is_encrypted:
        raise ValueError('Encrypted sources require an unlocked authorized private copy')
    cover = ' '.join(doc[i].get_text() for i in range(min(4, len(doc))))
    if not all(re.search(pattern, cover, re.I) for pattern in config['identity_patterns']):
        raise ValueError('PDF source identity does not match the configured family and edition')
    specification = commentary = None
    for number, page in enumerate(doc, 1):
        text = normalized(page.get_text())
        if specification is None and re.search(config['specification_start'], text, re.I):
            specification = number
        if commentary is None and re.search(config['commentary_start'], text, re.I):
            commentary = number
    if specification is None or commentary is None or specification >= commentary:
        raise ValueError('Specification/Commentary boundaries could not be established from source headings')
    pages = []
    print_pattern = re.compile(config['printed_page_pattern'], re.I)
    for number, page in enumerate(doc, 1):
        # Page numbers are read from page furniture, never guessed from a fixed offset.
        furniture = page.get_text(clip=fitz.Rect(0, 0, page.rect.width, 48))
        furniture += page.get_text(clip=fitz.Rect(0, page.rect.height - 60, page.rect.width, page.rect.height))
        labels = print_pattern.findall(furniture)
        label = '16.1-' + labels[0] if labels else None
        kind = 'normative' if specification <= number < commentary else 'commentary' if number >= commentary and label else 'front_matter'
        if number < specification:
            heading = normalized(page.get_text()[:160]).upper()
            if 'GLOSSARY' in heading:
                kind = 'glossary'
            elif 'SYMBOLS' in heading:
                kind = 'symbols'
        pages.append({'pdf_page': number, 'printed_page_label': label, 'kind': kind})
    with pdf_path.open('rb') as source:
        sha = hashlib.file_digest(source, 'sha256').hexdigest()
    return {'schema_version': 2, 'edition_code': edition, 'source_sha256': sha,
            'pdf_page_count': len(doc), 'metadata': doc.metadata,
            'document_type': 'combined',
            'source_identity': {'family': config['family'], 'edition_year': config['edition_year'], 'validated': True},
            'boundaries': {'specification_start': specification, 'specification_end': commentary - 1,
                           'commentary_start': commentary,
                           'commentary_end': max(p['pdf_page'] for p in pages if p['kind'] == 'commentary')},
            'bookmark_count': len(doc.get_toc()), 'pages': pages,
            'extraction_method': 'pymupdf-font-headings-and-page-furniture-v2'}


def inspect_pdf(pdf_path, edition='AISC360-10'):
    path = Path(pdf_path)
    if not path.is_file() or path.read_bytes()[:5] != b'%PDF-':
        raise ValueError('Source file is not a readable PDF')
    config = edition_config(edition)
    with fitz.open(path) as doc:
        return inspect_open(doc, path, edition, config)


def heading_token(text):
    chapter = re.fullmatch(r'CHAPTER\s+([A-N])', text, re.I)
    if chapter:
        return chapter.group(1).upper(), 'chapter'
    appendix = re.fullmatch(r'APPENDIX\s+([1-8])', text, re.I)
    if appendix:
        return 'APPENDIX' + appendix.group(1), 'appendix'
    section = re.fullmatch(r'([A-N]\d{1,2}(?:\.\d+[a-z]?)*)\.', text, re.I)
    if section:
        return section.group(1).upper(), 'section'
    appendix_section = re.fullmatch(r'([1-8]\.\d+(?:\.\d+)*)\.', text)
    if appendix_section:
        return appendix_section.group(1), 'appendix_section'
    subsection = re.fullmatch(r'(\d{1,2}[a-z]?)\.', text)
    return (subsection.group(1), 'subsection') if subsection else None


def read_headings(doc, inspection):
    rows = []
    known = set()
    chapter = section = None
    previous_kind = None
    for page, mapping in zip(doc, inspection['pages']):
        kind = mapping['kind']
        if kind != previous_kind:
            chapter = section = None
            previous_kind = kind
        if kind not in ('normative', 'commentary'):
            continue
        lines = content_lines(page)
        for index, line in enumerate(lines):
            if not (line['bold'] and line['size'] >= 11.9 and 40 < line['bbox'][1] < page.rect.height - 60):
                continue
            token = heading_token(line['text'])
            if token is None:
                continue
            code, level_type = token
            title_parts = []
            for following in lines[index + 1:index + 7]:
                if following['bbox'][1] - line['bbox'][1] > 48:
                    break
                chapter_title = level_type in ('chapter', 'appendix') and following['size'] >= 15 and following['text'].isupper()
                if (not following['bold'] and not chapter_title) or following['size'] < 11.9 or heading_token(following['text']):
                    break
                title_parts.append(following['text'])
            if not title_parts:
                continue
            parent = None
            level = 1
            if level_type in ('chapter', 'appendix'):
                chapter = code
                section = None
            elif level_type == 'section':
                parent, level = code[0], 2
                section = code
                chapter = code[0]
            elif level_type == 'appendix_section':
                parent, level = 'APPENDIX' + code[0], 2
                section = code
            else:
                if not section:
                    continue
                code, parent, level = section + '.' + code, section, 3
                if re.search(r'\d[a-z]$', code):
                    candidate_parent = code[:-1]
                    if (kind, candidate_parent) in known:
                        parent, level = candidate_parent, 4
            if (kind, code) in known:
                continue
            known.add((kind, code))
            rows.append({'code': code, 'title': normalized(' '.join(title_parts))[:255],
                         'kind': kind, 'pdf_page': mapping['pdf_page'],
                         'printed_page_label': mapping['printed_page_label'],
                         'parent_code': parent, 'level': level,
                         'division': 'appendix' if (chapter or '').startswith('APPENDIX') else 'chapter',
                         'source_anchor': {'page': mapping['pdf_page'], 'bbox': line['bbox']},
                         'verification_status': 'candidate',
                         'extraction_method': 'pdf_bold_heading'})
    return rows


def extract(pdf_path, edition='AISC360-10'):
    path = Path(pdf_path)
    config = edition_config(edition)
    with fitz.open(path) as doc:
        result = inspect_open(doc, path, edition, config)
        headings = read_headings(doc, result)
        known = {(r['kind'], r['code']): r for r in headings}
        raw_bookmarks = []
        for index, (level, title, page) in enumerate(doc.get_toc(), 1):
            if not 1 <= page <= len(doc):
                continue
            mapping = result['pages'][page - 1]
            raw_bookmarks.append({'level': level, 'title': normalized(title), 'pdf_page': page, 'kind': mapping['kind']})
            # Retain navigation-only bookmark evidence not represented by measured headings.
            if mapping['kind'] not in ('normative', 'commentary'):
                token = re.sub('[^A-Z0-9]+', '-', normalized(title).upper()).strip('-')[:70]
                code = token or f'BOOKMARK-{index:04d}'
                if (mapping['kind'], code) not in known:
                    row = {'code': code, 'title': normalized(title)[:255], 'kind': mapping['kind'],
                           'pdf_page': page, 'printed_page_label': mapping['printed_page_label'],
                           'parent_code': None, 'level': 1, 'verification_status': 'candidate',
                           'source_anchor': {'page': page, 'bookmark_index': index},
                           'extraction_method': 'pdf_bookmark'}
                    headings.append(row)
                    known[(mapping['kind'], code)] = row
        candidates = {}
        table_candidates = {}
        label_pattern = re.compile(config['equation_pattern'])
        for page, mapping in zip(doc, result['pages']):
            if mapping['kind'] not in ('normative', 'commentary'):
                continue
            text = page.get_text()
            for label in label_pattern.findall(text):
                key = (mapping['kind'], label)
                rectangles = page.search_for('(' + label + ')')
                probable_definition = next((r for r in rectangles if r.x0 >= page.rect.width * .70), None)
                unprefixed = label.removeprefix('C-')
                clause_code = 'APPENDIX' + unprefixed.split('-')[1] if unprefixed.startswith('A-') else unprefixed.split('-')[0]
                current = candidates.get(key)
                occurrence = {'pdf_page': mapping['pdf_page'], 'printed_page_label': mapping['printed_page_label']}
                if current is None:
                    current = {'label': label, 'clause_code': clause_code, 'kind': mapping['kind'],
                               'verification_status': 'candidate', 'occurrences': [], '_definition': False}
                    candidates[key] = current
                current['occurrences'].append(occurrence)
                if 'pdf_page' not in current or (probable_definition is not None and not current['_definition']):
                    current.update(occurrence)
                    current['source_anchor'] = {'page': mapping['pdf_page'], 'bbox': list(probable_definition) if probable_definition else None}
                    current['extraction_method'] = 'pdf_equation_label_position' if probable_definition else 'pdf_equation_reference_only'
                    current['_definition'] = probable_definition is not None
            for label in re.findall(r'TABLE\s+((?:[A-N]\d+\.\d+[a-z]?|A-\d+\.\d+))', text):
                key = (mapping['kind'], label)
                table_candidates.setdefault(key, {'label': label, 'kind': mapping['kind'], 'pdf_page': mapping['pdf_page'],
                    'printed_page_label': mapping['printed_page_label'], 'verification_status': 'candidate',
                    'source_anchor': {'page': mapping['pdf_page']}, 'extraction_method': 'pdf_table_identifier',
                    'rows': [], 'columns': [], 'footnotes': [], 'merged_cells': [],
                    'limitations': ['Table cells have not been transcribed or verified.']})
        for item in candidates.values():
            item.pop('_definition')
            if (item['kind'], item['clause_code']) not in known:
                # Source-linked placeholder, explicitly not an inferred engineering rule.
                code = item['clause_code']
                parent = 'APPENDIX' + code[0] if code[0].isdigit() else code[0] if re.match(r'^[A-N]\d', code) else None
                row = {'code': code, 'title': f'{code} · equation source anchor', 'kind': item['kind'],
                       'pdf_page': item['pdf_page'], 'printed_page_label': item['printed_page_label'],
                       'parent_code': parent if (item['kind'], parent) in known else None, 'level': 2,
                       'verification_status': 'needs_review', 'source_anchor': item['source_anchor'],
                       'extraction_method': 'equation_anchor_placeholder'}
                headings.append(row)
                known[(item['kind'], code)] = row
        headings.sort(key=lambda r: (r['pdf_page'], r.get('source_anchor', {}).get('bbox', [0, 0])[1] if r.get('source_anchor', {}).get('bbox') else 0, r['level']))
        result.update({'raw_bookmarks': raw_bookmarks, 'bookmarks': headings, 'clauses': headings,
                       'equation_candidates': list(candidates.values()), 'table_candidates': list(table_candidates.values())})
        result['report'] = {'physical_pages_indexed': len(result['pages']), 'native_bookmarks': len(raw_bookmarks),
            'indexed_headings': len(headings), 'headings_by_kind': dict(Counter(r['kind'] for r in headings)),
            'equation_candidates': len(candidates), 'equations_by_kind': dict(Counter(r['kind'] for r in candidates.values())),
            'table_candidates': len(table_candidates), 'verified_equations': 0, 'published_equations': 0,
            'warnings': ['Extracted headings and identifier anchors require review; no equation expressions or table cells are inferred.',
                         'Native bookmarks are retained as diagnostics; actual content headings take precedence.',
                         'Candidate equation identifiers can include references; inspect extraction_method and occurrences.']}
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('output', type=Path, nargs='?')
    parser.add_argument('--edition', default='AISC360-10')
    parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args()
    try:
        result = inspect_pdf(args.pdf, args.edition) if args.inspect else extract(args.pdf, args.edition)
        encoded = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
        if args.inspect:
            print(encoded)
        elif args.output:
            args.output.write_text(encoded, encoding='utf-8')
            print(json.dumps(result['report']))
        else:
            parser.error('OUTPUT.json is required unless --inspect is used')
    except (ValueError, OSError, RuntimeError) as error:
        print(json.dumps({'error': str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
