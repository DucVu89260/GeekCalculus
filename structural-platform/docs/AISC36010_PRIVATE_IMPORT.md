# AISC 360-10: private source provisioning and review

This extends the existing registry, commands, routes and reader from PRs #4,
#13, #14 and #15. Ordinary readers never upload the PDF or a JSON file.
Only AISC360-10 ingestion is enabled. AISC360-16/22 and ASCE7 editions retain
Coming Soon status in this library; independent Wind modules are unchanged.

## Database and storage

The repository's default installation uses SQLite. It did **not** contain a
shared PostgreSQL service. The optional `compose.standards.yaml` adds PostgreSQL
17 and a PHP runtime with PDO PostgreSQL/SQLite and Python/PyMuPDF. It neither
converts nor deletes an existing SQLite database. New registry JSON fields use
JSONB on PostgreSQL; the same additive migration is tested on SQLite.

The original PDF stays on the configured private storage disk (default Laravel
`storage/app/private`), outside public storage. The base Compose bind mount
persists this directory between container recreations. Back up this directory
**and** PostgreSQL together; database backups do not contain the source PDF.
For production, mount a persistent private directory at
`/app/backend/laravel/storage/app/private`, with write access for the backend UID.
No original PDF, extracted page text, credentials, or real source fixture belongs
in Git. Storage paths are excluded from the reader API.

## Provision once

Install Laravel dependencies using the existing setup workflow. For PostgreSQL,
set `STANDARDS_DB_PASSWORD` in a private environment file and use:

```sh
docker compose -f compose.yaml -f compose.standards.yaml build backend
docker compose -f compose.yaml -f compose.standards.yaml up -d postgres backend frontend
```

Use a separate Compose project name, ports and volumes for side-by-side testing.
The optional startup uses `artisan serve --no-reload`, preserving the container's
DB environment; the normal development reloader can discard those variables.

Securely mount the authorized source at `/run/private/AISC-360-10.pdf` on the
backend. Extraction and inspection run there, never in the ordinary browser:

```sh
python3 scripts/extract_standard_outline.py /secure/AISC-360-10.pdf /secure/outline.json --edition AISC360-10

# Inside the backend container, using equivalent mounted private paths:
php artisan migrate --force
php artisan db:seed --class=StandardsSeeder
php artisan standards:import-pdf /run/private/AISC-360-10.pdf /run/private/outline.json --edition=AISC360-10 --revision=2010-source-copy
php artisan standards:import-review-drafts /app/standards/aisc360-10-review-drafts.json
```

The provided review drafts are pinned to the SHA-256 below. Another PDF copy
requires its own inspection and source anchors; do not relabel its manifest.
The CLI checks actual PDF identity, SHA-256, page count and family/edition, then
re-extracts the actual PDF rather than trusting edited manifest anchors. It
writes a content-addressed private object, checks storage integrity, commits
registration/index rows transactionally, and removes newly created files after
failure. A same-source re-run is idempotent and preserves reviewed records.
`standards:import-outline` requires a matching registered private document and
also re-extracts it; it cannot create provenance from a detached JSON file.

## Actual source measured in this change

- File supplied by the user: `AISC-360-10.pdf`, 4,908,523 bytes.
- SHA-256: `f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99`.
- 612 physical pages; 231 native bookmarks.
- Specification: physical 57–296; Commentary: physical 297–608.
- Printed page labels are read from page furniture. They are not inferred from
  a fixed page offset. The source-specific main-text offset happens to be 56.
- Native J–N bookmarks include Commentary destinations; measured content
  headings recover normative chapters J–N at 161/196/219/221/226.
- 787 indexed heading/anchor records: 448 normative, 334 commentary, 5 other.
- 508 candidate equation identifiers: 385 normative and 123 commentary,
  including appendix-style identifiers. These may include textual references;
  extraction method/occurrences remain diagnostics, not proof of transcription.
- 26 candidate table identifiers; no cells are inferred automatically.
- Review drafts: 26 transcribed expressions, 9 typed parameters and two partial
  B4 tables covering 7 selected I/H cases. All remain `needs_review`.
- Newly approved/published database equations: **0**. Index coverage is not
  engineering verification or complete AISC compliance.

## Review and API contracts

Authenticated reads preserve the original registry/detail/equation routes.
Clauses, equations, parameters, tables and search support pagination (`per_page`
1–100), source/kind/status filtering and edition-aware response caching. Detail
includes the full clause hierarchy and document import report/page map.

```
GET /api/v1/standards
GET /api/v1/standards/AISC360-10
GET /api/v1/standards/AISC360-10/clauses
GET /api/v1/standards/AISC360-10/equations
GET /api/v1/standards/AISC360-10/parameters
GET /api/v1/standards/AISC360-10/tables
GET /api/v1/standards/AISC360-10/search?q=E3
GET /api/v1/standards/AISC360-10/rules?implementation_key=E3-1&method=LRFD
GET /api/v1/standards/AISC360-10/documents/{id}/file
```

`rules` requires an implementation key, parameter key or equation ID and returns
only verified/published records. A draft returns an empty `data` collection.
Execution callers must preserve edition, document ID/SHA, record version,
source clause/page, method and parameter values with calculation results. Do
not couple an engine to candidate extraction data. Existing numerical code is
not switched to unapproved database transcriptions by this change.

Admin-only content and review endpoints:

```
PATCH /api/v1/admin/standards/AISC360-10/{resource}/{id}
POST  /api/v1/admin/standards/AISC360-10/{resource}/{id}/review
GET   /api/v1/admin/standards/AISC360-10/{resource}/{id}/history
```

Editable resources: clauses/equations/parameters/tables. PATCH body:
`{"notes":"Review explanation","data":{"latex":"..."}}`.
Review resources additionally include documents. Review body contains `status`
and evidence `notes`. Transitions are candidate/index_only → needs_review →
verified → published; verified/published may be deprecated with a reason.
Approval validates source/hash, bounded coherent page anchors, typed values,
variables/conditions/methods and table coverage, and requires evidence notes.
This is an authorization and completeness gate, not automatic engineering proof.
Verified/published data is immutable to import/edit; use a new source revision
and supersession references for corrections. Review history retains snapshots.

Readers can GET/POST only their own personal clause notes. Notes cannot edit
standard rules or approve formulas. Admin mutations require the admin role.
The PDF endpoint requires authentication, checks blob integrity and serves
private/no-store content. Coming Soon editions cannot be ingested.

## Reader and exact source navigation

Steel Structure → Steel Library → Design Standard → AISC 360-10 opens a new tab.
The reader fetches database content automatically; the static GitHub Pages demo
has no private database or PDF and remains a navigation demo.

The reader has a searchable expandable hierarchy, Specification/Commentary
filter, KaTeX expressions/variables/conditions/statuses, parameters, partial
engineering tables, and a hideable source/review/notes panel. PDF.js renders
physical pages directly with authenticated requests. TOC/equation/table links
select a source document and page; viewer controls synchronize TOC selection.
Printed labels come from the exact document page map, not the selected clause's
start-page label. A missing label is omitted rather than guessed.

## Tests and rollback

See `AISC36010_IMPLEMENTATION_COVERAGE.md` for measured results and remaining work.
Synthetic extractor tests use no licensed source. The private browser smoke
requires a separately provisioned test backend and private account fixture.

Before deploying, back up the database and private storage and record the app
commit. Apply the additive migration and import to staging first. Restarting
containers does not delete the database volume or bind-mounted source files.
For rollback, restore the matching database/private-storage snapshot and prior
app image/commit. Do not run `migrate:fresh`, delete volumes, or blindly reverse
source-version uniqueness after multiple document revisions have been created.
Old calculation references and historical source objects must be retained.
