# AISC 360-10: One-time private backend import

This is an **offline administrative deployment step**. No user-facing PDF upload is required.

## Source identity

The submitted combined 2010 Specification/Commentary PDF has **612 pages**, **231 bookmarks**,
and its SHA-256 must match the generated manifest. The local review index finds
**328 candidate equation labels**, which are not verified formulas.

## First-time deployment

Run inside the environment where Laravel has a working database and persistent private storage.

```bash
php artisan migrate --force
php artisan db:seed --class=StandardsSeeder

# Generate this JSON on an authorized engineering workstation (requires PyMuPDF).
python scripts/extract_standard_outline.py /path/AISC-360-10.pdf /secure/aisc36010.json

# Move BOTH files to the backend securely before running these commands.
php artisan standards:import-pdf /secure/AISC-360-10.pdf /secure/aisc36010.json
```

From project root, adjust paths to `backend/laravel/artisan` and `scripts/...`.
Running in Docker requires mounting the private PDF and manifest into the Laravel container.

The command verifies source hashes, places the PDF under Laravel's **local private storage**,
registers the file in `standard_documents`, imports bookmark headings and equation label
candidates, and associates the source PDF with clause records.
Re-running with the same PDF and JSON is idempotent.

**Do not commit the PDF or any private full-text extraction to public GitHub.**
Persist/backup the Laravel storage volume. The database alone cannot re-create the PDF.

## Reader

`Steel Structure → Steel Library → Design Standard → AISC 360-10`
opens the Standards Explorer in a new browser tab.
The private source is viewed from the authenticated Laravel endpoint.
Selecting a TOC item with a mapped `pdf_page` navigates to its actual PDF page.

## Verification boundaries

- Bookmark headings: `index_only`, not a full normative clause digitization.
- Extracted equation labels: `candidate`, not LaTeX or executable formulas.
- Formula expressions, limit-state applicability, variables, tables, `phi`/`Omega`,
  and code edition references **must be reviewed** before becoming a design engine rule.
- The full combined source PDF is available only to authenticated users authorized for
  internal use and within applicable license terms.
- Use separate reviewed publications for corrections/errata, never silently overwrite.
