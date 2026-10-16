#!/usr/bin/env python3
"""Archive every ASCE 7-10 page, raw text, layout, numbers and source candidates.

Requires PyMuPDF==1.26.7 and tesseract (eng). No expression is approved or executed.
Usage: python extract_asce710_corpus.py INPUT.pdf OUTPUT_DIRECTORY --workers 4
The output contains licensed material: keep it in private storage, outside Git.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import fitz

VERSION = 'asce710-corpus-2'
IDENTIFIER = r'(?:C?\d{1,2}[A-Z]?(?:\.\d+)*|[A-D](?:\.\d+)+)-\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?'
NUMBERS = re.compile(r'(?<![\w.])[+−–-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][+−-]?\d+)?(?:\s*(?:kN/m[²³23]?|N/m[²³23]?|lb/ft[²³23]?|m/s|mi/h|mph|psf|psi|kPa|MPa|kN|mm|ft|Hz|m²|m³|%|°))?')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inventory(text, channel):
    rows, seen = [], set()
    patterns = [('equation', re.compile(r'\((' + IDENTIFIER + r')\)')),
                ('table', re.compile(r'\bTable\s+(' + IDENTIFIER + r')', re.I)),
                ('figure', re.compile(r'\b(?:Fig(?:ure)?\.?)\s+(' + IDENTIFIER + r')', re.I))]
    for kind, pattern in patterns:
        for match in pattern.finditer(text):
            key = (kind, match.group(1), match.start())
            if key in seen:
                continue
            seen.add(key)
            rows.append(dict(kind=kind, label=match.group(1), offset=match.start(), channel=channel,
                             context=text[max(0, match.start()-450):match.end()+450],
                             verification_status='candidate', occurrence_type='reference_or_definition'))
    return rows


def process_page(args):
    pdf, output, page_index = args
    checkpoint = Path(output) / 'extracted' / f'{page_index+1:04d}.json'
    if checkpoint.exists():
        return json.loads(checkpoint.read_text())
    with fitz.open(pdf) as doc:
        page = doc[page_index]
        native = page.get_text(sort=True)
        blocks = [{'bbox': list(b[:4]), 'text': b[4]} for b in page.get_text('blocks') if b[6] == 0]
        image_area = sum((i['bbox'][2]-i['bbox'][0])*(i['bbox'][3]-i['bbox'][1]) for i in page.get_image_info())
        # Preserve an image of every page, including tables whose glyphs have no text mapping.
        image_relative = f'pages/{page_index+1:04d}.png'
        image_path = Path(output) / image_relative
        page.get_pixmap(dpi=120, alpha=False).save(str(image_path))
        needs_ocr = len(native.strip()) < 160 or image_area > page.rect.width*page.rect.height*.15
        ocr, ocr_words, ocr_error, ocr_config = '', '', None, None
        if needs_ocr:
            with tempfile.TemporaryDirectory(prefix='asce-ocr-') as tmp:
                high = Path(tmp) / 'page.png'
                page.get_pixmap(dpi=200, alpha=False).save(str(high))
                base = str(Path(tmp) / 'ocr')
                for psm, dpi in [('3', 200), ('11', 120)]:
                    if dpi != 200:
                        page.get_pixmap(dpi=dpi, alpha=False).save(str(high))
                    try:
                        subprocess.run(['tesseract', str(high), base, '-l', 'eng', '--psm', psm, 'txt', 'tsv'],
                            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60,
                            env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
                        ocr = Path(base+'.txt').read_text()
                        ocr_words = Path(base+'.tsv').read_text()
                        ocr_config = dict(dpi=dpi, psm=int(psm), language='eng')
                        break
                    except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as error:
                        ocr_error = type(error).__name__
                if ocr or ocr_words:
                    ocr_error = None
        channels = [('native', native)] + ([('ocr', ocr)] if needs_ocr else [])
        items = [item for channel, text in channels for item in inventory(text, channel)]
        numeric_tokens = [dict(raw=m.group(), offset=m.start(), channel=channel)
                          for channel, text in channels for m in NUMBERS.finditer(text)]
        tail = native.strip().splitlines()[-1:] or ocr.strip().splitlines()[-1:]
        printed = tail[0].strip() if tail and re.fullmatch(r'(?:\d+[a-z]?|[ivxlcdm]+)', tail[0].strip(), re.I) else None
        heading = re.search(r'^\s*(?:CHAPTER|Chapter)\s+(C?\d{1,2})\b', native[:300])
        result = dict(pdf_page=page_index+1, printed_label=printed, native_text=native, ocr_text=ocr,
                    ocr_words_tsv=ocr_words, blocks=blocks, numeric_tokens=numeric_tokens,
                    extraction_method='native+ocr' if needs_ocr else 'native',
                    image_path=image_relative, image_sha256=digest(image_path.read_bytes()),
                    text_sha256=digest(native.encode()), items=items,
                    chapter_heading=heading.group(1) if heading else None,
                    ocr_error=ocr_error, ocr_config=ocr_config,
                    coverage_status='OCR_FAILED' if ocr_error else 'REVIEW_REQUIRED' if needs_ocr or len(native.strip()) < 160 else 'EXTRACTED_UNVERIFIED')
        checkpoint.parent.mkdir(parents=True, exist_ok=True)
        checkpoint.write_text(json.dumps(result, ensure_ascii=False))
        return result


def extract(pdf, output, workers=4):
    pdf, output = Path(pdf).resolve(), Path(output).resolve()
    sha = digest(pdf.read_bytes())
    marker = output/'provenance.json'
    if output.exists() and any(output.iterdir()):
        if not marker.exists() or json.loads(marker.read_text()) != dict(source_sha256=sha, extractor_version=VERSION):
            raise ValueError('Existing corpus provenance does not match this source/extractor')
    (output/'pages').mkdir(parents=True, exist_ok=True)
    marker.write_text(json.dumps(dict(source_sha256=sha, extractor_version=VERSION)))
    with fitz.open(pdf) as doc:
        page_count, bookmarks = len(doc), doc.get_toc()
        # Identity evidence is retained rather than assuming any arbitrary PDF is this edition.
        identity = '\n'.join(doc[i].get_text() for i in range(min(6, len(doc)))).lower()
        if not ('7-10' in identity and ('design loads' in identity or 'asce' in identity)):
            raise ValueError('ASCE 7-10 title-page evidence not found')
    pages = []
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for page in pool.map(process_page, [(str(pdf), str(output), n) for n in range(page_count)]):
            pages.append(page)
            if len(pages) % 25 == 0:
                print(f'Extracted {len(pages)}/{page_count} pages', flush=True)
    chapter, kind = None, 'front_matter'
    clauses, seen = [], set()
    for page in pages:
        heading = page.pop('chapter_heading')
        if heading:
            chapter = heading
            kind = 'commentary' if chapter.startswith('C') else 'normative'
            key = (kind, chapter)
            if key not in seen:
                seen.add(key)
                clauses.append(dict(code=chapter, title=f'Chapter {chapter}', kind=kind,
                                    pdf_page=page['pdf_page'], printed_label=page['printed_label']))
        text = page['native_text'] or page['ocr_text']
        appendix = re.search(r'^\s*Appendix\s+(11[AB]|[CD])\b', text[:300])
        if appendix:
            chapter, kind = appendix.group(1), 'normative'
            key = (kind, chapter)
            if key not in seen:
                seen.add(key)
                clauses.append(dict(code=chapter, title=f'Appendix {chapter}', kind=kind,
                                    pdf_page=page['pdf_page'], printed_label=page['printed_label']))
        if 'COMMENTARY TO AMERICAN SOCIETY' in text[:400]:
            kind, chapter = 'commentary', None
        page.update(chapter=chapter, kind=kind)
        # Native headings are additional navigation candidates, never normative interpretations.
        for match in re.finditer(r'^\s*((?:C?\d{1,2}[AB]?|D\d+)(?:\.\d+){1,6})\s+([A-Z][^\n]{2,160})', text, re.M):
            code, title = match.group(1), match.group(2).strip()
            root = code.split('.')[0]
            if root != chapter and not (chapter == 'D' and root.startswith('D')):
                continue
            key = (kind, code)
            if key not in seen:
                seen.add(key)
                clauses.append(dict(code=code, title=title, kind=kind, pdf_page=page['pdf_page'],
                    printed_label=page['printed_label'], parent_code=code.rsplit('.',1)[0],
                    verification_status='index_only'))
        for item in page['items']:
            item['chapter'] = chapter
    shutil.copyfile(pdf, output/'source.pdf')
    summary = dict(pages=page_count, ocr_pages=sum(p['extraction_method']=='native+ocr' for p in pages),
                   clause_candidates=len(clauses),
                   failed_ocr_pages=[p['pdf_page'] for p in pages if p.get('ocr_error')],
                   numeric_tokens=sum(len(p['numeric_tokens']) for p in pages),
                   source_occurrences=sum(len(p['items']) for p in pages),
                   empty_pages=[p['pdf_page'] for p in pages if not (p['native_text']+p['ocr_text']).strip()])
    manifest = dict(schema_version=1, extractor_version=VERSION, edition_code='ASCE7-10',
                    offset_unit='Unicode code points', native_bbox_unit='PDF points',
                    pymupdf_version=fitz.VersionBind,
                    ocr_engine=subprocess.run(['tesseract','--version'],capture_output=True,text=True,check=True).stdout.splitlines()[0],
                    source_sha256=sha, pdf_page_count=page_count, original_bookmarks=bookmarks,
                    original_bookmarks_status='UNVERIFIED_SOME_TARGETS_INCORRECT',
                    clauses=clauses, summary=summary, pages=pages)
    (output/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False), encoding='utf8')
    (output/'coverage.json').write_text(json.dumps(dict(source_sha256=sha, summary=summary,
        pages=[{k:p[k] for k in ['pdf_page','printed_label','chapter','kind','extraction_method','coverage_status','image_sha256']} for p in pages]), indent=2))
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf'); parser.add_argument('output'); parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    extract(args.pdf, args.output, max(1, min(args.workers, 8)))
