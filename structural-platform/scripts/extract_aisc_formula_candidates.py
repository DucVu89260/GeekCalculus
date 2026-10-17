#!/usr/bin/env python3
"""Private, conservative evidence extraction. Never approves an engineering rule.

Uses the existing edition/artifact inspector and definition-position index. Complex
layout remains untranscribed; no equation-number -> remembered formula mapping.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import fitz
from extract_standard_outline import extract


def simple_expression(lines):
    # Intentionally narrow: no stacked fractions, inferred exponents or OCR repair.
    for line in lines:
        value = line.strip()
        if re.fullmatch(r'[A-Za-z]+(?:_[A-Za-z0-9]+)?\s*=\s*[A-Za-z0-9_ .+*()-]+', value):
            if value.count('(') != value.count(')') or not re.search(r'[A-Za-z0-9]', value.split('=', 1)[1]):
                continue
            return re.sub(r'_([A-Za-z0-9]+)', r'_{\1}', value).replace('*', r'\cdot ')
    return None


def candidates(pdf, chapters=('E', 'F')):
    if not chapters or set(chapters) - set('BCDEFGH'):
        raise ValueError('Select chapters B through H only.')
    outline = extract(pdf, 'AISC360-10')
    result = {'schema_version': 1, 'edition_code': 'AISC360-10',
              'source_sha256': outline['source_sha256'], 'pdf_page_count': outline['pdf_page_count'],
              'chapters': list(chapters), 'equations': [],
              'policy': 'Private extraction evidence only; missing definitions/units/conditions require source review.'}
    with fitz.open(pdf) as doc:
        for item in outline['equation_candidates']:
            if item['kind'] != 'normative' or item['label'][0] not in chapters:
                continue
            page = doc[item['pdf_page'] - 1]
            anchor = item.get('source_anchor', {})
            bbox = anchor.get('bbox')
            # A right-margin identifier is only a proposed definition, never certainty.
            is_definition = item.get('extraction_method') == 'pdf_equation_label_position' and bbox
            clip = fitz.Rect(0, max(0, bbox[1] - 70), page.rect.width, min(page.rect.height, bbox[3] + 90)) if is_definition else page.rect
            evidence = page.get_text(clip=clip, sort=True)
            # Transcribe only a single same-line equality near the label, never nearby prose.
            latex = None
            if is_definition:
                label_line = page.get_text(clip=fitz.Rect(0, bbox[1] - 2, page.rect.width, bbox[3] + 2), sort=True)
                lines = [line.replace('(' + item['label'] + ')', '').strip() for line in label_line.splitlines()]
                latex = simple_expression(lines)
            result['equations'].append({
                'label': item['label'], 'clause_code': item['clause_code'], 'kind': 'normative',
                'pdf_page': item['pdf_page'], 'printed_page_label': item.get('printed_page_label'),
                'source_anchor': {'pdf_page': item['pdf_page'], 'equation_id': item['label'], 'bbox': bbox},
                'latex': latex, 'variables': [], 'conditions': [], 'design_method': None,
                'asd_lrfd_factors': [], 'extraction_confidence': 0.65 if latex else 0.0,
                'extraction_method': 'native_same_line_conservative' if latex else 'native_layout_requires_transcription',
                'verification_status': 'needs_review' if latex else 'candidate',
                'evidence': {'text': evidence, 'text_sha256': hashlib.sha256(evidence.encode()).hexdigest(),
                             'page_text_sha256': hashlib.sha256(page.get_text().encode()).hexdigest(),
                             'occurrences': item.get('occurrences', []),
                             'definition_candidate': bool(is_definition)},
                'limitations': ['Variables, units, applicability and ASD/LRFD factors are not inferred.',
                                'Compare the equation layout and referenced clauses with the original PDF.'],
            })
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf')
    parser.add_argument('output', help='PRIVATE output JSON path, outside public/Git assets')
    parser.add_argument('--chapters', default='E,F')
    args = parser.parse_args()
    result = candidates(args.pdf, tuple(x.strip().upper() for x in args.chapters.split(',')))
    target = Path(args.output)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    target.chmod(0o600)
    print(json.dumps({'candidate_count': len(result['equations']), 'source_sha256': result['source_sha256']}))


if __name__ == '__main__':
    main()
