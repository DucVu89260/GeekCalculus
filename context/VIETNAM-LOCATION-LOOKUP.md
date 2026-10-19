# Vietnam location lookup — intake and implementation contract

Date: 2026-10-19. Audited baseline: `main` at `84b6265`.

Source URL supplied by user: https://datafiles.chinhphu.vn/cpp/files/vbpq/2022/10/02-bxd.pdf

## Source status

**Blocked: PDF not retrieved/read; no engineering values extracted or approved.** The restricted cloud proxy returned 403 on CONNECT to the official host. Turn-scoped network permission and an escalated HTTPS attempt did not retrieve the file. No TLS verification was disabled and no substitute document/filename-derived values were used.

Read the environment policy and saved a network draft preserving the existing explicit hosts (`api.github.com`, `ducvu89260.github.io`, `tinhketcau.com`) and adding only `datafiles.chinhphu.vn`. The tool returned saved/requires-publish; this does not apply runtime access. Installation/startup fields were not modified. Source access needs the environment draft applied or the PDF uploaded directly in chat, then a successful retrieval/inspection. A document title/edition, hash, page count, tables and units have not yet been established from the actual file.

## Requested feature and placement

Under **Steel Design → Library**, look up source-defined wind parameters, reference ground acceleration, short-period and long-period acceleration by Vietnamese administrative location. Exact symbols, periods, units, soil/reference conditions and parameter definitions must come from the PDF. Wind zone/pressure/velocity and reference/design accelerations are distinct; do not substitute or silently calculate importance/site/exposure factors or design spectra.

Current [ModuleHub](../structural-platform/frontend/vue/src/components/ModuleHub.vue) renders [LibraryBrowser](../structural-platform/frontend/vue/src/components/LibraryBrowser.vue) at `#/modules/steel/library`. Proposed additive child route `#/modules/steel/library/vietnam-location` and VI/EN link from Steel Library, to be implemented via [modules](../structural-platform/frontend/vue/src/modules.js) once source/data are available. Preserve existing catalog CRUD, Standards, RC/CFS/SAP/Loading routes and global styles. No empty product placeholder is shipped in this preparation.

Use a source-versioned read-only reference dataset for native and Pages modes, distinct from editable material/section libraries. No new DB/migration/reseed is needed merely to add verified reference tables. Future loading modules can consume the same data without another formula implementation.

## Data/UI contract to finalize against actual tables

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

This slice audited current integration points and saved network requirements only; no runtime/engineering/data/schema/dependency changes or application suites. Next: source retrieval/inspection, then extraction and implementation. Source access is the current external prerequisite.
