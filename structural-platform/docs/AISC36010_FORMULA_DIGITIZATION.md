# AISC 360-10 formula digitization and Symmetric I/H audit

## Delivery and source boundary

This branch integrates the inspected source-review work from draft PR #18 with
main through `5da4c05`, including its ASCE PDF/outline reader and local Docker
configuration. It extends that registry rather than introducing another equation
library or numerical engine. SQLite remains the default. The optional PostgreSQL
configuration inherited from #18 is not enabled by this work.

**Source blocker resolved on 2026-10-17:** the user supplied the actual 612-page
AISC 360-10 PDF, SHA-256
`f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99`.
It was read and critical equations were visually compared. Source CLI indexing
produced 508 equation occurrences; conservative E/F extraction produced 133
candidates. Neither operation approves equations. No application DB migration,
source import or formula approval was performed in this slice. The earlier
schema/source-unavailable report is historical evidence, superseded for
source availability by the attachment.

The primary Symmetric I/H calculator now includes D2/D3 net rupture, F13/H4 flange
holes, F4 noncompact webs, G2/G7 shear, G2.2/G3 stiffeners/TFA, Direct Analysis
inputs and scoped Member Compliance. Four Luna max tasks provided independent
source/formula/UI assistance. See the current
[member review, exact source pages, hand fixtures, warning resolution and limits](../standards/AISC36010_IH_MEMBER_REVIEW_2026.md).
The inherited 26 needs_review equation drafts still require explicit content-bound
admin approval; source-compared typed rules do not create DB review events.

Keep originals, native/OCR evidence, page images, application databases and account
fixtures outside Git/Pages. The pre-existing public ASCE artifact is preserved;
ASCE's UI remains PDF/outline-only.

## Database/API audit and workflow

Main's shared `StandardsOutlineImporter` remains the unapproved indexing layer for
any registered edition and legacy bookmarks/clauses JSON. `standards:import-pdf`
and `standards:import-outline` dispatch AISC360-10 schema-v2 manifests through the
actual-artifact inspector/versioned registry; other shared manifests retain main's
index-only behavior. Generic indexing never supplies approval metadata, never
promotes equations, protects manual/approved records and invalidates the reader
cache. It does not make a generic manifest eligible for engineering execution.


- `standard_documents`: private artifact, SHA, page count, import metadata,
  inspected edition identity and source revisions. Private paths are not user input
  to equation review.
- `standard_clauses`: edition/document-scoped clauses, Specification versus
  Commentary, physical page, printed label and source anchor.
- `standard_equations`: LaTeX, JSON variables/units, conditions, dependencies,
  design method, source document/hash/anchor, record version and implementation key.
  Additive migration `2026_10_16_000004` adds nullable extraction confidence and
  JSON ASD/LRFD factors. A null confidence means no extraction measurement.
- `standard_source_pages/items`: main's existing ASCE source corpus is retained;
  its raw occurrences remain unapproved extraction data.
- `standard_review_history`: actor, source, previous/new status, notes and content
  snapshots. New equation approval snapshots also pin the reviewed content hash
  and explicit source-comparison attestation.

Equation editing and transitions use authenticated, CSRF-protected admin routes.
They require `expected_version`. Editing or any transition increments that version;
stale requests fail with 409. State flow is `candidate → needs_review → verified →
published`; imported transcriptions may begin at needs_review, never verified.
Verified/published records remain immutable and re-import cannot overwrite them.
Existing `deprecated` and navigation-only `index_only` states are retained.

Before verification/publication the admin must save, typeset and explicitly compare
the saved equation with its exact artifact/page, including variables, units and
conditions. Requests carry `source_comparison` with `compared`, `document_id`,
`source_sha256`, `pdf_page` and SHA-256 of trimmed LaTeX. The backend checks these,
source bytes/edition identity, page range, definitions/units, applicability and
basic LaTeX preflight. KaTeX performs full rendering in the editor. These checks
support an engineering review; they do not independently prove mathematical truth.

The `/api/v1/standards/{code}/rules` equation lookup requires a matching approval
event/content hash and rechecks private source integrity on every lookup. A status
string alone, modified content, a missing source or a changed PDF cannot authorize
an equation. Approved lookups bypass response caching and send `private, no-store`.
No member engine is wired to evaluate draft LaTeX. Existing typed parameter review
and execution contracts from #18 remain separate.

## Test the feature branch locally

The pushed branch is `feature/aisc36010-formula-digitization`; review is
[Draft PR #21](https://github.com/DucVu89260/GeekCalculus/pull/21). Main/Pages are
not deployed by a feature-branch push. After checking out this branch, refresh the
frontend dependencies and restart its process so KaTeX/PDF.js and browser adapters
are installed/generated:

```sh
# From structural-platform; include the same local-domain overrides used by your stack.
docker compose run --rm --no-deps frontend npm ci
docker compose up -d --no-deps --force-recreate frontend
```

If the local-domain test frontend is also running, restart `frontend-test` using
that existing override as well. Apply the additive Laravel migrations below before
opening the native standards review UI. Symmetric I/H reference calculations run
in the browser; opening them does not verify/import the private standard.

## Private extraction on local Docker

### Register a PDF through Standards Explorer

Native administrators can open the PDF source section and expand **Upload private
source PDF** / **Tải PDF nguồn riêng tư**. Choose the file, document type (including
**Specification and Commentary** for a combined artifact) and optional publisher
revision, then save. This uses the existing session/CSRF-protected upload endpoint;
ordinary users and Pages demo users have no upload control. No Windows path or SSH
connection is required to upload through the browser.

The source stays on the Laravel server receiving that request. Uploading to local
Docker does **not** transfer it to Codex cloud. A chat attachment or accessible
private download is still required for a cloud agent to read those source bytes.

The viewer selects the exact returned document ID and displays the registered
SHA-256. Duplicate bytes select the existing registration without changing its
kind, revision or review status. New uploads remain `candidate` / `pending`, with
no assumed page count, edition validation, indexing or formula approval. Use the
inspection/import commands below next. Paging an unindexed upload cannot adopt
clause anchors from a different document. The source-document selector also lets
reviewers explicitly choose an older registered artifact.

The API reports its PHP upload/post limits, capped at the existing 100 MiB API
limit; the form checks file size and signature before sending. A proxy may impose
a smaller limit, in which case HTTP 413 is reported explicitly. Large PDFs require
appropriate PHP/proxy configuration; this change does not restart or reconfigure
the user's containers. Original files and application databases remain private.

### Source-backed implementation batches — updated 2026-10-17

The original source-baseline, D2/D3, F4, G2/G7, G2.2/G3 and integration batches
have now been implemented and checked within the declared welded symmetric I/H
scope. The [current member review](../standards/AISC36010_IH_MEMBER_REVIEW_2026.md)
records changed equations, independent fixtures and remaining exclusions. Cb=1
remains fixed; SAP/moment-diagram integration is deferred.

Actual source comparison and candidate extraction were executed in the Codex
workspace. Import/approval in the user's Laravel registry remains a separate
operation: register the same private hash, inspect/index it, then review saved
expressions against exact pages before promoting a small E/F set. No typed
member result is populated by an unapproved LaTeX record.

Use the feature branch and back up the existing database/private storage before
a normal incremental migration. Do not use `migrate:fresh`, delete volumes or
reseed over user data. No public source URL is created here.

The stock Composer backend has no PyMuPDF in the inspected cloud container. For
PDF extraction while preserving the existing SQLite deployment, an optional image
override is supplied:

```sh
# From structural-platform. Add the existing local-domains override if already used.
docker compose -f compose.yaml -f compose.standards-sqlite.yaml up -d --build backend
docker compose exec -T backend php artisan migrate --force
docker compose exec -T backend php artisan standards:formula-report AISC360-10
```

The optional image build/configuration is provided; a full new image build and a
real private-source import were not executed in this session. The report is read-only
and prints document IDs, SHA hashes, file-presence/integrity flags and review counts,
without exposing private paths or extracted source text.

If the source was imported using the older main-only outline importer, re-inspect
the actual PDF and register its version-2 manifest so that edition/source metadata
is present. Paths below are container paths, not Windows paths:

```sh
docker compose exec -T backend python3 /app/scripts/extract_standard_outline.py \
  /app/backend/laravel/storage/app/private/AISC-360-10.pdf \
  /tmp/aisc36010-outline-private.json --edition AISC360-10
docker compose exec -T backend php artisan standards:import-pdf \
  /app/backend/laravel/storage/app/private/AISC-360-10.pdf \
  /tmp/aisc36010-outline-private.json --edition=AISC360-10
docker compose exec -T backend php artisan standards:formula-report AISC360-10
```

Then select the **exact document ID** shown by the report:

```sh
docker compose exec -T backend php artisan standards:extract-formulas AISC360-10 \
  --document=DOCUMENT_ID --chapters=E,F
```

The extractor uses the existing actual-artifact inspector and normative equation
identifier positions. It records exact label/clause, physical/printed page, clipped
native evidence and its hash, page-text hash, anchor, method and confidence. Only
unambiguous same-line simple equalities are proposed as LaTeX; stacked fractions,
superscripts or reference-only occurrences are left untranscribed. It does not
invent variables, units, conditions or factors. The temporary manifest is removed;
evidence is stored privately in the database. Hash mismatch, invalid edition,
out-of-range/inconsistent evidence or an unavailable source stops import.

The pipeline enriches existing source-index rows only. Counts distinguish updated,
unchanged, protected and unmatched rows. It protects nonempty/manual drafts as well
as reviewed records; it does not move an indexed source page to a reference page.

For the inherited human-transcribed drafts, use the existing
`standards:import-review-drafts` command **only when the actual registered PDF hash
matches that JSON**. The command re-inspects the source and imports needs_review
records. Review E3-2 and a small F2 set beside the linked PDF before expanding.
Do not approve records just to populate engine lookup results.

## Symmetric I/H: current warning resolution and verification

The source-backed warning matrix, rule inventory, independent hand derivations,
Direct Analysis length contract and remaining blocked cases are maintained in
[the current member review](../standards/AISC36010_IH_MEMBER_REVIEW_2026.md), with
separate [F4](../standards/AISC36010_IH_FLEXURE_REVIEW.md) and
[Chapter G](../standards/AISC36010_IH_SHEAR_REVIEW.md) reports.

Primary results/export use the canonical Section Properties package and typed
AISC 360-10 modules. The workbook engine runs only in explicit legacy comparison
mode. Dirty or invalid input clears results; imported confirmations are reset.
A scoped Member Compliance PASS requires all applicable checks and explicit
external-analysis/envelope/separate-limit-state declarations. It is not a
certificate of the structural model or project.

Current checks: **145 Node tests passed**, Vue typecheck, native/demo builds,
primary I/H hand fixtures in both ASD/LRFD, member-compliance UI, bilingual legacy
and ordinary/admin Standards Explorer source-page browser smokes all passed.
Source navigation rejects unknown hashes and invalid pages rather than opening a
substitute PDF. The PDF remains private. The large reader bundle warning remains.

Prior branch checks retained: full Laravel SQLite-memory suite 90 tests / 847
assertions; private-upload slice 11 tests / 88 assertions; 12 synthetic Python
source/index tests. Those unrelated backend/extractor suites were not repeated for
the current numerical/UI-only slice. PostgreSQL runtime, a new optional Docker
image build, live app DB import/approval and deployment were not executed here.

Keep Draft PR #21 for review. Numerical tests, PDF source comparison, admin
registry approval, merge and deployment remain distinct operations.
