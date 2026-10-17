# ASCE 7-10 — private development source corpus

Steel Design → Library → Design Standard → **ASCE 7-10** opens the authenticated
Standards Explorer. The default ASCE reader shows **Document Outline** and
**PDF Source**, matching the AISC reader layout. Select a clause to open its
original PDF page; equations, tables and figures are read directly in the PDF.
No equation transcription or OCR is required. Existing corpus data and wind
calculations remain available to their backend/engineering consumers.

## PDF + outline import (recommended)

The common importer now supports both AISC and ASCE manifests. See
[generic import commands and JSON contract](STANDARDS-IMPORT.md).
`standards:import-asce710-pdf` remains a compatible shortcut to the same importer.

The bundled index is bound to the exact SHA-256 below. From `structural-platform`,
copy your supplied file to the running backend temporarily and import it:

```sh
docker compose cp "/path/to/ASCE 7-10.pdf" backend:/tmp/asce7-10.pdf
docker compose exec -T backend php artisan standards:import-asce710-pdf /tmp/asce7-10.pdf
docker compose exec -T backend rm /tmp/asce7-10.pdf
```

This stores the PDF privately and indexes 875 chapter/section entries with
page links. Repeating it is idempotent. It preserves reviewed clauses, existing
source links and full-corpus metadata; no formulas or OCR/page images are
created. A different PDF hash is rejected to avoid applying the wrong page map.
The existing static Pages PDF/index remains supported separately.

## Source and coverage

User-supplied `ASCE 7-10.pdf`, 658 pages. SHA-256:
`ae2997f7a31975965b33065ba54acbf4da441f4f821b2a97372d67c2bd1ca248`.

The import in this workspace preserves:

- The byte-identical original PDF, including every equation, table, graph and symbol.
- 658 page images (120 dpi); original PDF remains the full-resolution authority.
- Every page's native text, text blocks with PDF bounding boxes and text SHA-256.
- Supplemental English OCR on 102 low-text/image-heavy pages, with word TSV,
  OCR resolution/segmentation metadata and unverified coverage status.
- 875 chapter/section navigation candidates, including normative text,
  appendices and commentary; these are not an engineering approval.
- 53,086 raw numeric tokens with channel and Unicode character offsets.
- 1,440 equation/table/figure occurrences and their context: 320 equation
  occurrences (310 distinct labels), 526 table references (107 labels), and
  594 figure references (145 labels). References and definitions are not
  automatically distinguished. Unnumbered expressions remain in page content.
- Original PDF bookmarks, explicitly flagged as unverified: several supplied
  bookmarks point to wrong pages. The generated navigation uses page headings.
- A per-page coverage report, with 36 pages yielding no native/OCR text; their
  page images are still retained. No selected OCR job failed in this extraction.

Counts include headings, references and possible native/OCR duplication. They
must not be described as counts of distinct engineering parameters or verified
formulas. Native/OCR may lose fraction layout, subscripts, Greek glyphs or table
column relationships. No automatically extracted expression is executable or
approved LaTeX. All original information remains recoverable from the exact PDF.

The narrower, explicitly implemented wind kernel is documented separately in
[ASCE7-10-WIND-AUDIT.md](ASCE7-10-WIND-AUDIT.md). Corpus candidates never replace
its reviewed expressions automatically. Future spreadsheet formulas should cite
the source hash, normative/commentary kind, PDF page, clause/equation label,
units, applicability, verification evidence and independent benchmark results.

## Reproduce and import

Dependencies: Python 3.11+, `scripts/requirements-standard-source.txt`, Tesseract
with English data, and the existing Laravel environment. From `structural-platform`:

```sh
engineering/.venv/bin/python -m pip install -r scripts/requirements-standard-source.txt
engineering/.venv/bin/python scripts/extract_asce710_corpus.py \
  /private/path/ASCE-7-10.pdf /private/path/asce710-corpus --workers 4
cd backend/laravel
php artisan migrate --force
php -d memory_limit=1G artisan standards:import-corpus /private/path/asce710-corpus
```

For this cloud machine, extraction output is `/workspace/asce710-corpus-v1`.
PHP runs in the repository's pinned Composer image. Mount the extraction directory
read-only as `/corpus` and the platform as `/app`, then run the importer in
`/app/backend/laravel`. Re-importing the same corpus is idempotent; it was tested
against both synthetic fixtures and the full 658-page source.

Extraction uses process workers and one Tesseract thread per worker. Difficult
OCR pages are retried with a lower-resolution sparse layout. Checkpoints allow
resuming only when source hash and extractor version match. Inspect
`failed_ocr_pages` before claiming OCR completion. OCR failures retain the page
image and are visibly marked; they do not silently turn into approved content.

The importer verifies PDF signature/hash, contiguous complete page coverage,
every text/image hash and safe image paths before copying. Database changes are
transactional. An import failure removes only newly created archive files;
existing documents and reviewed source occurrences are preserved.

## Storage, export and access

Laravel stores the PDF, images and content-addressed JSON manifests below its
private local storage root, `storage/app/private/private/standards/ASCE7-10/`.
The full OCR corpus and page images are ignored by Git. This authenticated
archive requires Laravel. Separately, the user-requested GitHub Pages Standards
integration includes the original PDF at `public/standards/asce7-10.pdf` and a
shared metadata index at `standards/asce7-10-library.json` (875 headings and 310
equation labels). The static build copies that PDF into `docs/standards/` and
offers direct PDF page links; it does not emulate a private backend document.

Database tables: `standard_documents` (source identity and extraction summary),
`standard_source_pages` (raw page content, numeric tokens and image hashes),
`standard_source_items` (unverified occurrence index), plus existing
`standard_clauses` for navigation. Every source API is inside the existing auth
middleware and scopes document access to the requested edition.

Authenticated API routes under `/api/v1/standards/{edition}`:

- `source-pages?q=&chapter=&document_id=&page=` — paginated full-text search.
- `source-items?kind=equation|table|figure&q=&chapter=&document_id=&page=`.
- `documents/{id}/pages/{pdf_page}` — page text/layout/numbers.
- `documents/{id}/pages/{pdf_page}/image` — private page PNG.
- `documents/{id}/file#page={pdf_page}` — original PDF.
- `documents/{id}/corpus` — complete machine-readable JSON extraction.

For backup, retain the SQLite database **and** private storage files together.
JSON alone does not contain the original PDF or page image bytes. A portable
archive was also produced at `/workspace/artifacts/ASCE7-10-source-corpus.tar.gz`,
containing source PDF, manifest, coverage report, provenance and all images.
Restore it outside the public web root and run `standards:import-corpus` to
rebuild the source database. This archive supports future spreadsheet work
without depending on the original chat attachment.

## Validation

- Extractor tests: `engineering/.venv/bin/python -m unittest discover -s scripts/tests -v`.
- Backend tests: `php artisan test --filter=StandardSourceCorpusTest` (5 tests,
  idempotence, review preservation, invalid archives, private
  search/image/JSON access, edition boundaries and anonymous access).
- Browser: `tests/standards-source-smoke.cjs` with the existing `AUTH_FIXTURES`,
  `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` conventions. Exercises real authenticated
  ASCE corpus, OCR page 308, equation search, numeric tokens and 390 px layout.
- Full frontend suite, type check and build. Guest API requests, including
  PDF/image requests without JSON Accept headers, now receive 401 without
  trying to resolve a nonexistent `login` route. This also fixes the existing
  StandardsRegistryTest anonymous document-upload regression.
