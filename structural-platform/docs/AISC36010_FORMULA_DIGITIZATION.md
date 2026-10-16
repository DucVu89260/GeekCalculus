# AISC 360-10 formula digitization and Symmetric I/H audit

## Delivery and source boundary

This branch integrates the inspected source-review work from draft PR #18 with
main through `efb56ee`, including its ASCE PDF/outline reader and local Docker
configuration. It extends that registry rather than introducing another equation
library or numerical engine. SQLite remains the default. The optional PostgreSQL
configuration inherited from #18 is not enabled by this work.

**No new actual-source engineering approval is claimed in this session.** The
current cloud backend has no `standard_documents` table and no private AISC PDF.
The supplied Windows `storage/app/private/AISC-360-10.pdf` path is on another
machine. No Windows disk/SSH connection or downloadable copy was available.
`standards:formula-report` returned:

```json
{"schema_ready":false,"source_available":false,"approved_equations":0}
```

PR #18's inherited artifact-specific transcription file contains 26 **needs_review**
equations (E: 5, F: 14, G: 5, H: 2), 9 parameter drafts and partial tables. Its
historical source audit identifies a 612-page artifact, SHA-256
`f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99`.
Those transcriptions and historical visual-check notes are not new approvals or
proof that another PDF has identical pagination. The current E3-2 test validates
rendering of that draft, not equivalence to an available authoritative PDF.

Keep originals, native/OCR evidence, page images, application databases and account
fixtures outside Git/Pages. The pre-existing public ASCE artifact is preserved;
ASCE's UI remains PDF/outline-only.

## Database/API audit and workflow

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

Use the feature branch and back up the existing database/private storage before a
normal incremental migration. Do not use `migrate:fresh`, delete volumes or reseed
over user data. A path on Windows cannot be opened by Codex cloud without transferring
the file or providing an actual connection. No public source URL is created here.

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

## Symmetric I/H: warning resolution and formula inventory

The screenshot's warning list came from the standalone workbook parity engine,
even though a separate 360-10 kernel already existed below it. The primary results
now consume `standards/aisc360-10-verified-hi.mjs` and canonical Section Properties.
Legacy mode remains selectable for workbook comparisons; its output, notebook and
export are explicitly named 360-05 comparison data. No primary result is replaced
by legacy values when a branch is missing or canonical calculation fails.

| Screenshot / code issue | Current primary behavior | Remaining source/engineering gate |
| --- | --- | --- |
| LEGACY_EDITION | Uses the existing edition-specific 360-10 reference kernel | Full fresh PDF comparison is pending source transfer |
| LEGACY_CB | Conservative Cb=1; no signed workbook Cb. Quarter-point API now requires explicit confirmation of the maximum absolute moment over the entire segment, in addition to braced ends/same case | A sampled diagram alone cannot prove its extreme |
| LEGACY_WEAK_AXIS_FE | Independent Kx/Lx/rx and Ky/Ly/ry, plus E4 torsion using shared J/Cw and supplied Kz/Lz/G | Missing restraint inputs block compression and H1 |
| INCOMPLETE_TENSION | No tensile demand → not applicable. Tensile demand → INPUT_REQUIRED; gross yielding does not masquerade as full tensile resistance | Fu, An, U, connection geometry and source-reviewed D2/D3 branches |
| STIFFENER_PARITY_ONLY | No workbook LRFD area/sign result in primary ASD/LRFD capacity | G2.2/G3 strength/rigidity, spacing and tension-field eligibility remain unimplemented |
| NO_GLOBAL_PASS | Overall REVIEW_REQUIRED is retained. The primary table shows CALCULATED / missing-check status, never a whole-member PASS | All applicable checks and source approval must be completed |
| LOAD_COMBINATION_METHOD | Existing ASD/LRFD selector applies only the versioned resistance factors; UI/export state the chosen method | Input demand combinations must correspond to that method; no implicit conversion |
| STIFFENER_REVIEW | Separate explicit Chapter G/stiffener blockers, with no tension-field capacity credit | Source comparison and independent Chapter G benchmarks |

Other audited path differences: missing/null/nonfinite Cw or J cannot be coerced into an E4/F2 torsional input; primary F6 uses the existing Sy-based noncompact
flange interpolation and 1.6 Fy Sy cap; primary H1 takes absolute required moments
and retains full precision rather than rounding the minor-axis ratio; F4 noncompact
webs are explicitly blocked. The inherited PR #18 F4-11 `h²` correction and its
independent F5 regression fixtures are retained, not newly certified here.

| Formula family | Active reference implementation | Evidence available this session |
| --- | --- | --- |
| Gross A, Ix/Iy, Sx/Sy, Zx/Zy, rx/ry, J/Cw | Shared Section Properties adapter; no PHP/browser duplication | Existing core and integration regressions |
| B4.1a cases 1, 2, 5; B4.1b cases 10, 11, 13, 15 | Rolled/built-up axial versus major/minor flexure distinctions | Existing boundary/branch tests; historical PR #18 audit; fresh source comparison pending |
| E3-1–4 / E4-4 | Independent x/y/torsional Euler states and nominal compression | Existing regressions and UI trace; actual PDF approval pending |
| E7-1–9, 16–17 | Qs/Qa and effective web width with declared sharp-corner model | Existing branch tests; source/geometry approval pending |
| F1-1 | Absolute segment magnitudes or conservative Cb=1 | Added rejection of unconfirmed segment maxima |
| F2-1–7 / F3-1–2 | Yielding, LTB and local flange buckling for compact webs | Existing ASD/LRFD, boundary and branch regressions |
| F4 | Noncompact-web resistance remains blocked | No capacity invented from the legacy workbook |
| F4-7, 11, 12 / F5-1–9 | Existing built-up slender-web reference branch, including inherited h² correction | PR #18 independent nominal/ASD/LRFD fixtures; current regression pass |
| F6-1–4 | Minor-axis yielding/local buckling | Existing branch and method regressions |
| H1-1a/b | Full-precision ratios, complete axial and both bending resistances required | Existing signed-demand and missing-input tests |
| D2/D3, G2/G7, stiffeners/G3 | Explicit missing/partial states | No actual-source approval or capacity claim |

Dirty geometry/restraint data immediately invalidates primary results; an invalid
input cannot restore a previous result. Primary export waits for canonical/kernel
completion and names its active result `AISC36010_REFERENCE`; any workbook data is
separately named `legacy_comparison`.

## Executed acceptance evidence

| Check | Result / limit |
| --- | --- |
| Laravel full suite, explicit SQLite `:memory:` | 81 passed / 753 assertions at integration; final standards-focused follow-up 28 passed / 303 assertions after source-edition hardening; no application DB reset |
| Vue typecheck and complete Node suite | Passed; 108 Node tests passed |
| Python source/index/candidate suite | 12 passed; synthetic PDFs only |
| Native and demo Vue production builds | Passed; existing large reader chunk warning remains |
| Standards reader/admin smoke | Synthetic API/PDF: hierarchy, typed math, exact pages, draft save/version, explicit comparison, review transition, reset confirmation; passed |
| AISC edition/source isolation smoke | Passed with synthetic fixtures; explicit document/page, stored expression precedence, unknown source and 2010/2016 separation |
| ASCE preservation smoke | PDF/outline only, 875 clauses, exact source-page link, no equation/corpus fetches and mobile; passed with API fixtures |
| Symmetric I/H primary smoke | Actual browser/shared numerical core: active kernel, independent Fe, conservative Cb, missing Chapter G/stiffeners, ASD conversion, stale/invalid input, export and mobile; passed |
| Bilingual legacy comparison and demo Pages smoke | Passed EN/VI round-trip, numeric fixture, import/export, mobile and published-copy parity; demo ASCE reader checked exact existing PDF bytes |
| Optional SQLite Compose override | Default and local-domain configurations validated; no image build or DB engine conversion |
| Actual private AISC PDF comparison/import and a newly verified E/F set | **Not executed; source unavailable in this cloud workspace** |
| PostgreSQL runtime and optional new Docker image build | Not rerun; inherited #18 evidence is historical |

Merge remains gated on source availability, a small explicitly reviewed E/F set
and review of the declared engineering gaps. A green rendering or workflow test
does not satisfy the actual-source engineering verification gate.
