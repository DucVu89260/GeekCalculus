# Vietnam location lookup — intake and implementation contract

Intake: 2026-10-19 (`84b6265`); implementation: 2026-10-20 (`3ee5d7f`).

Source URL supplied by user: https://datafiles.chinhphu.vn/cpp/files/vbpq/2022/10/02-bxd.pdf

## Source status

**Source received and read.** User uploaded the original PDF on 2026-10-20: QCVN02:2022/BXD, 619 pages, SHA-256 `12cce9e43ce7c4f5e143e62239d038f5499cd6c713ab832b2e15b4a962962bce`. See [source/data verification](../structural-platform/standards/QCVN02-2022-LOCATIONS.md). Tables5.1/6.1/6.2 are digitized: 63 provinces, 334 wind scopes and 705 earthquake selections, with all 1,743 source rows cross-read independently. The Vinh SS cell's missing unit remains explicit rather than guessed.

Historical network blocker: the official host returned cloud proxy403; an additive network draft was saved on 2026-10-19 but not asserted applied. The upload resolved source access without TLS bypass, another document or guessed values. Original PDF/renders stay outside public Git/Pages; the lookup links the official source by physical page.

## Requested feature and placement

Under **Loading → Library** (moved from Steel Library at user request on 2026-10-20), look up source-defined wind parameters, reference ground acceleration, short-period and long-period acceleration by Vietnamese administrative location. Exact symbols, periods, units, soil/reference conditions and parameter definitions must come from the PDF. Wind zone/pressure/velocity and reference/design accelerations are distinct; do not substitute or silently calculate importance/site/exposure factors or design spectra.

Current [ModuleHub](../structural-platform/frontend/vue/src/components/ModuleHub.vue) exposes the lookup under Loading → Library at `#/modules/loads/library/vietnam-location`, with a VI/EN entry from `#/modules/loads/library` via [modules](../structural-platform/frontend/vue/src/modules.js). The old `#/modules/steel/library/vietnam-location` bookmark resolves to the Loading workspace; Steel Library no longer has a lookup entry. Loading Library also lists ASCE 7-10/7-16/7-22 and TCVN 2737:2023 as in-development placeholders, without calculation or data claims. Existing catalog CRUD, Standards, RC/CFS/SAP/Loading routes and global styles are preserved. The real source dataset is included, with no empty placeholder.

Use a source-versioned read-only reference dataset for native and Pages modes, distinct from editable material/section libraries. No new DB/migration/reseed is needed merely to add verified reference tables. Future loading modules can consume the same data without another formula implementation.

## Data/UI contract

- Stable source-scoped place IDs and full administrative paths; preserve names and the source's administrative reference/edition. Same-named districts must not collide. Do not silently remap post-merger names or assume a merged area has a single value; aliases need explicit provenance and one-to-many handling.
- Per-parameter source value/text/unit, normalized value only after validation, table/row, physical/printed page, notes, scope/applicability and source edition/hash. Join different tables by verified scope, not bare place names. Province-wide and split/subregion rows need their stated coverage.
- Missing/ambiguous values return explicit missing/needs-detail status, never 0, nearest-location values or inferred province defaults. Source ranges and exceptions remain visible.
- Accent-insensitive search including Vietnamese Đ; hierarchical dropdowns only for levels the source contains; proper place names remain Vietnamese in EN mode. Results show definitions, units, administrative edition and source links. Optional JSON/CSV export carries provenance.
- Link the official PDF using a verified physical `#page=` locator; do not copy original PDF/full text/renders into public Git/Pages by default.

## Acceptance and next actions

1. Obtain actual PDF, record artifact identity/edition, inspect table headers/units/footnotes visually and map physical/printed pages.
2. Reproducible extraction with counts/coverage/continuation-row checks; separately transcribe representative rows for independent verification, including duplicate names, split scopes and missing values. No approval based on extraction success alone.
3. Implement dataset/lookup/UI; verify parameter/units distinctions and independent row fixtures. Native/demo build, Vue typecheck and targeted browser checks cover entry/deep links, selectors/search, VI/EN, source links, missing/ambiguous states, mobile and existing library navigation.
4. Commit/push, CI and Pages/live asset verification are distinct from local tests. Do not claim lookup data or UI is deployed until actually implemented/published.

Implementation now includes the source-scoped dataset, reproducible extractor and independent cross-reader verification, lookup/helper tests and VI/EN/native/demo browser checks. No database/catalog/formula changes or PDF redistribution. See Handoff for exact executed checks and publication status.
