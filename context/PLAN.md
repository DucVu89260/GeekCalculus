# Repository implementation plan

## Active strength slice — gross built-up I/H member

`IH-GROSS-01` (implemented / locally verified / PR #24, base `1ccb851`): explicit gross-member scope for Component; preserve detailed connection-aware engine mode for existing consumers. Return major/minor capacities and H1 without hole/connection, envelope or duplicate C2 checkboxes. Assume external Direct Analysis, record C2/C3 basis without asserting SAP model verification; retain positive independent lengths, K=1/E/G constraints and unsupported geometry/torsion/stiffener barriers. Remove Analysis basis/Tension Connection tabs, use selected ASD/LRFD for manual demand, disabled future SAP geometry/force/Cb adapter, bottom notes for homogeneous built-up/no cover plates/web openings deferred. Evidence: actual C3 physical81/printed16.1-25 visually reviewed; 151 Node tests passed including six independent gross ASD/LRFD/H1 tests and existing strict-mode regressions. Typecheck/native/demo builds passed after refreshing locked Pyodide dependency added by main. Primary/member/bilingual browser tests passed current native production output, manual method/export/import, four input tabs, persistent fabrication selector, C3 notes/API placeholder, independent strength fixtures, VI/EN and all tabs at320/390px. Source-backed contract in `standards/AISC36010_IH_GROSS_MEMBER_REVIEW.md`.

## Active CFS presentation slice — VI/EN (2026-10-17)

`CFS-UI-02` (published on main, feature `d8ba9b8`, base `0178b77`): add a studio VI/EN switch synchronized with the host, translate static/dynamic presentation without rerendering geometry or changing model/input values, provide separate JSON import/export help at the bottom, and replace the requested diagram caption with `Đơn vị: m- kN` / `Units: m- kN`. This is a requested display label, not verification/conversion of native load data; retain source metadata and existing format/export gates. Acceptance: typecheck/build, original Python/UI algorithm hashes, language round-trip and JSON/numerical parity in the existing browser smoke, native/demo and mobile. No formula/backend/schema changes. Evidence: typecheck and production build passed; 9 core/hash tests passed; native/demo browser smoke passed with VI/EN two-way synchronization, no iframe reload or draft/JSON/input change, English text coverage, unchanged exact CFSA byte fixtures and mobile checks.

## Active package integration — CFS browser runtime (2026-10-17)

`CFS-WEB-01` (implemented / published on main, feature `1bbcbd3`, base `f2bae2d`): supplied ZIP SHA-256 `9f7e542ef1703d7320b90de6bd7cf795d83c5336cff70bd4355dca2fdff56456` contains Python CFSA read/normalize/experimental-copy export and a local Windows bridge. Preserve the four Python processing modules byte-for-byte; run them in a browser worker using pinned, same-origin Pyodide, replacing filesystem-path HTTP endpoints with explicit browser file selection, local draft persistence and downloads. Keep upstream UI editing algorithms and unverified native-unit/type/format limits. No public local-filesystem bridge. Acceptance: synthetic binary fixtures, immutable original/section/combination bytes, lap edits, XT insert/delete, blocked main-support/section/hash changes, native/demo/mobile import-draft-export, static deployment and CI. Evidence: 9 Python adapter tests, all 145 existing Node tests, typecheck and native/demo builds passed. Real Python browser smokes passed in native and demo modes with byte-parity fixtures, lap and XT edits, draft reload/source gates, zero uploads, immutable originals/combination bytes and mobile/iframe sizing. Main web/engine CI and Pages deployment passed; published Python/WASM byte hashes were checked. Real CFS 11.0.2 read-back remains unrun until actual files/application are provided. Shared-chat contents remain unavailable (403).

## Previous UI slice — CFS Design entry (2026-10-17)

`CFS-UI-01` (UI implemented; package integration blocked, base `d26c656`): add CFS Design immediately after Steel Design in the Steel workspace and a matching illustrated CFS Lapping and Node Add-in entry with a stable deep link. Preserve existing Steel/RC/Loading routes and VI/EN behavior. The named `geekcalculus_cfs_z_lapping_and_node` package is absent from the checkout; source location has been requested. Until supplied, the add-in page must explicitly state pending integration and expose no fabricated calculation or executable. Evidence: typecheck and production demo build passed; targeted native and demo browser checks passed for adjacent tab order, card/hover, keyboard entry, direct link/reload/back, VI/EN, preserved Steel/RC navigation and 320/390 px overflow. No formula, backend or data changes. User will supply the portable folder; shared ChatGPT conversation URL could not be retrieved (proxy 403), so its contents have not been read. Next: inspect the actual portable source and supplied conversation/specification before implementing a runnable add-in.

Baseline `main`: `991342d`, audited 2026-10-16. This is a dependency/acceptance plan, not a claim that all modules are finished. Current milestone: **Context Foundation**, implemented in [PR #20](https://github.com/DucVu89260/GeekCalculus/pull/20) for review. Update status/evidence as work is actually accepted; keep one bounded implementation slice active per owner.

## 0 — Context Foundation and immediate integration

| ID | Status | Work / files | Acceptance evidence / dependency |
| --- | --- | --- | --- |
| CTX-01 | Implemented / PR #20 review | Root/scoped AGENTS, four repository Skills, GOALS/ARCHITECTURE/AUDIT/PLAN/HANDOFF | Every current-state statement anchored to code or dated PR evidence; links/frontmatter/scopes checked; no application changes; current task |
| LOCAL-01 | Implemented / locally verified | `geekcalculus.com` built native main and `geekcalculus.test` native dev share main SQLite and documents; separate sessions/cache/logs | Runtime checks confirm identical DB/document-directory inodes and different cookies. Startup/build/typecheck and app/standalone/mobile/HMR smoke passed; Test remains visible with gateway injection removed. Old test data retained. User hosts/restart/refresh steps remain local prerequisites. |
| BUILD-01 | Implemented in open PR #19 | Isolated engine/browser/library builder; Docker + CI | 270 Python and 96 Node tests, exact Docker CI and installed-wheel smoke already passed on that PR; merge/update context remains separate |
| STD-01 | Implemented / Draft review; actual source now available | Registry/digitization, private upload and exact-source navigation; source-compared typed I/H rules remain separate from admin approval | Supplied 612-page PDF SHA f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99 read on 2026-10-17. CLI index: 508 equation occurrences; E/F extraction: 133 candidates, no promotion. No live DB migration/import/approval this slice. Exact hash/page UI links and missing-source refusal tested in admin/user browser modes. Prior private-upload 11 Laravel tests/88 assertions retained. Numerical completion/limits in STEEL-04 and member review. SQLite/private storage preserved; no source publication or automatic merge. |
| SOURCE-01 | Decision pending | Define per-artifact public/private source policy | Main includes full public ASCE PDF plus private Laravel corpus; inventory both paths/copies and intended distribution before publication changes; do not delete history in a docs task |
| DB-01 | Decision pending | Decide whether/when to move native SQLite data to PostgreSQL | Inventory actual user library/private artifacts; migration/backup/restore/dialect/concurrency plan and disposable PG tests before conversion; not required for this context PR |

Review BUILD-01 as the smallest runtime fix first. STD-01 needs a dedicated integration task; PostgreSQL deployment and source review approval are not implicit side effects of resolving Git conflicts.

## Active UI slice — Symmetric I/H reading layout

`IH-UI-02` (implemented / locally verified / PR #23, base `f2bae2d`): one-column content, larger typography, five ordered Contents/section anchors (Input Parameters → Calculation Results → Design Calculation → AISC 360-10 Verified Branches → Shared Section Properties), Engineering warnings last. Keep compliance with results, move existing AISC formula registry into the third section, retain explicit legacy-only notebook. No numerical/input/export changes. Evidence: typecheck and native/demo production builds passed. Existing primary/member/bilingual browser checks passed against the fresh native build, including one-column bounds, all five anchors/order, readable input/table fonts, last warning section, unchanged independent ASD/LRFD fixtures, safe import/export, VI/EN, legacy mode and mobile overflow. Calculation sources are unchanged; the full numerical/backend suites were not repeated.

## Active UI slice — Crane Beam workspace

`CRANE-UI-01` (implemented, base `408ea8e`): reuse existing `CraneBeamView` calculations in a dedicated routed workspace with the H/I-style left navigation, linked H/I/Crane entries, contents anchors and responsive input/results layout. Preserve legacy Crane query URLs and current preliminary/NOT VERIFIED statuses. Acceptance: deep links/new-tab entry, both-direction navigation, language switch, mobile layout, existing numerical output parity and unchanged calculation sources; native/demo build and targeted browser checks. Evidence: native/demo builds and typecheck passed; 92 Node tests passed; Crane browser smoke passed in native and demo modes, H/I bilingual/numeric/export smoke passed against the fresh build, and structure-group routing/shared-calculator smoke passed. Desktop navigation is on the left on both pages (user correction after the initial release); mobile navigation sits above content. This slice does not add crane design limit states.

## 1 — Independent engineering MVP slices

A slice ends with a reviewable input/output contract, independent expected fixture, source/edition/version evidence, negative/boundary tests, UI/status behavior and a reproducible command. Existing implemented formulas are extended/validated in place, not re-created.

### Steel Design / Symmetric I/H

| ID | Narrow outcome | Existing surface | Acceptance / dependencies |
| --- | --- | --- | --- |
| STEEL-01 | Independently validate B4 supported I/H case selection | AISC kernel, factor registry, `aisc36010-verified-ih.test.js` | Rolled/built-up and compression/flexure distinctions; each compact/noncompact/slender threshold; source h/fillet model declared; unknown geometry stays blocked |
| STEEL-02 | Independently validate existing E3/E4 compression | Same kernel + canonical J/Cw/rx/ry | Separate Kx/Lx, Ky/Ly, Kz/Lz/G; independent reference and governing-state check; missing inputs rejected; no reuse of workbook assumptions; depends on STEEL-01 geometry |
| STEEL-03 | Validate one major-axis F2 compact-web branch and method conversion | `aisc360-10-verified-hi.mjs`, shared H/I bridge | Same-branch nominal result for ASD/LRFD; independent Lp/Lr transition fixtures; source-confirmed bracing/Cb; preserve blocked F4 and overall review status |
| STEEL-04 | Implemented within declared scope / Draft engineering review | Source-backed welded Symmetric I/H, Direct Analysis inputs and scoped Member Compliance; four Luna max independent tasks | Actual source and hand fixtures recorded in `structural-platform/standards/AISC36010_IH_MEMBER_REVIEW_2026.md`. D2/D3, F13/H4, F4, G2/G7, G2.2/G3 implemented; independent Fe axes; E7 full-width boundary fixed. K=1 Direct Analysis requires external C2 confirmations; Lx/Ly/Lz/Lb independent; manual method match, Cb=1 and disabled SAP API. 145 Node tests, typecheck, native/demo builds and primary/member/bilingual/source browser smokes passed. Scoped PASS requires complete applicable checks/declarations; rolled exact geometry, bolted E6, stagger/slots, biaxial flange-hole and torsion branches remain blocked. External connection/J10/fatigue/serviceability checked separately. No DB reset/source publication/automatic merge. |

Steel MVP is a source-traceable **limited reference calculation**, not whole-member PASS. Crane/connection/singly symmetric design needs its own accepted scope.

### Wind Load / ASCE 7-10

| ID | Narrow outcome | Existing surface | Acceptance / dependencies |
| --- | --- | --- | --- |
| WIND-01 | Add independent worked-case verification of the existing Ch27 Phase A result | `asce7-10-wind.mjs`, `asce710-wind.test.js`, WindLoadView | Source-backed case with units/signs, both GCpi signs, exposure/Kz/q/Cp; independently computed intermediate/result values, not just formula duplication |
| WIND-02 | Stabilize case/report eligibility and source tracing | Wind kernel/UI + ASCE library/corpus | Whole internal-pressure sign applied consistently; roof alternatives not mixed as simultaneous patches; minimum projected loads reported for review rather than clipping every local pressure; retain unsupported/review gates |
| WIND-03 | Extend one explicit currently rejected geometry/direction branch | Same kernel, audit and UI | Select one source-backed roof/direction case; formula/table/limits independently checked; unsupported remainder still rejected; depends on WIND-01/02 |

Wind MVP remains a validated pressure-case report. A complete simultaneous load set, torsion, C&C and SAP2000 object loads are later milestones.

### SAP2000 / Excel / file interchange

| ID | Narrow outcome | Existing surface | Acceptance / dependencies |
| --- | --- | --- | --- |
| CSI-01 | Specify/test the current offline combo export contract | Combo HTML, wrapper, workspace controller, `COMBO-GENERATOR.md` | Small readable S2K fixture with consistent patterns/cases/combo references, factors and export mode; no live connection claim |
| CSI-02 | Define a read-only adapter envelope and one artifact-backed parser slice | Existing `csi-agent/adapters/sap2000` boundary | Provenance/product version/units/axes/overrides and unsupported-schema errors; use actual authorized example when available; synthetic tests establish only schema behavior |
| CSI-03 | Verify a real product import/read-back | Windows SAP2000 test environment, isolated model | Record product/API version, imported counts/values/units and conflicts; no writes to a real design model by default; unavailable Windows/product access stays an explicit unrun check |

Do not make CSI-01 depend on full Steel/Wind solvers. Do make wind-to-object export depend on a complete applicable load-case contract and CSI coordinate/unit mapping.

## 2 — Stabilize specialist workflows

The four Skills are delivered now as executable workflow instructions tied to actual paths/checks. Exercise them on one Laravel catalog task, one standard-rule task and one offline interchange task, then revise only observed gaps. Do not install new frameworks/MCP tools or create duplicate engines to satisfy a workflow template.

For each task retain: touched paths/contracts, selected checks, new failures found, omitted checks and the next acceptance gate. The [verification skill](../.agents/skills/geekcalculus-verification/SKILL.md) provides the existing command map.

## 3 — Adaptive model and effort, after measurements

No automatic model router is introduced here. Record model/effort only when actually known, task class, elapsed time, tool/test failures, review corrections and tokens/cost only if supplied by the platform. Compare like tasks; do not fabricate savings.

Start with ordinary documentation/UI/CRUD work at the default model setting. Formula/source interpretation, auth/data migration and cross-module contracts warrant more reasoning/independent checking. Respect explicit user model preferences (Luna max was requested for the current audit assistance). Review measured quality/time before changing defaults.

## 4 — Selective cross review

Independent review targets source interpretation, units/signs, branch applicability, snapshot compatibility, authorization and migrations. Routine style changes need no agent team. If subagents are requested/authorized, assign read-only review or disjoint files; nominate one integrator and record which evidence was checked. Two copies of the same implementation are not independent numerical verification.

## 5 — MCP / hooks / agent teams, only for a demonstrated need

Defer until the above workflows work repeatedly. Propose a concrete unmet operation, required permissions/data boundary, maintenance cost and measurable benefit before adding a connector or hook. Do not add hooks that reset databases, publish artifacts or run privileged tasks implicitly. This plan does not install tools or enable background actions.

## Task record for future slices

Use the smallest relevant row above. A new nontrivial slice records: objective; base SHA/branch and file ownership; input/output/edition/units; changed paths; prerequisites; acceptance fixtures/commands; excluded behavior; data/rollback implications; status/evidence; next action. Completed implementation, PR review, merge and deployment have separate statuses. Transfer the current result to [Handoff](HANDOFF.md), keeping this plan as the stable dependency view.

## Active standards reader slice

`EQ-UI-01` (implemented / locally verified, base `8052158`): make AISC360-10 equation labels usable: reuse exact canonical implementation expressions as explicitly marked references, preserve database expressions/status, expose clause document IDs and open the selected source page visibly. No transcription/approval of missing formulas, math changes, schema changes or private PDF publication. Evidence: 6 isolated API tests (35 assertions), 3 helper tests, native typecheck/build and synthetic browser selection/source/mobile/edition checks passed. Full source transcription remains incomplete.

`ASCE-READER-01` (implemented / locally verified, base `f745daf`): user requests ASCE7-10 PDF + outline only. Reuse exact SHA-bound 658-page/875-heading index, add idempotent private PDF-only import, show common outline/PDF reader without equation/kernel/corpus UI. Preserve existing corpus/review data and wind engine. Evidence: supplied SHA-matching PDF imported in cloud (658 pages/875 clauses); 10 disposable backend tests/63 assertions, typecheck, native/demo builds, native fixture reader/demo exact-PDF smoke and AISC reader regression passed.

`STD-IMPORT-02` (implemented / locally verified, base `43063a2`): unify manifest parsing and private PDF/outline ingestion across registered editions, accept legacy AISC bookmarks and ASCE clauses JSON, preserve old command names and reviewed/source data. Validate page bounds, hierarchy, artifact identity and candidates before writes; no schema/formula changes or automatic edition creation. Evidence: 23 disposable backend tests passed (198 assertions), covering multi-edition/idempotence/rollback/invalid-input/review/source isolation, legacy commands, real ASCE PDF/index and corpus regression. No app DB changed.

## SAP-WEB-26.2 — implemented / locally verified 2026-10-17

Add SAP2000-API immediately after CFS Design, opening the versioned standalone panel in a new tab. Input: uploaded SAP2000_26.2.0-API.zip; source panel/connector/processing exactly match existing force API, bundled .venv excluded. Pin compatibility to SAP2000 26.2.0. Reuse panel with VI/EN heading/label controls; web serves static UI + clean Windows kit, live reads go only to token-protected loopback connector with explicit trusted web origins. No Laravel/model persistence, force/axis/math changes. Acceptance: Vue typecheck/build; navigation/new-tab/subpath/language browser checks; connector auth/CORS tests, source ZIP hygiene, existing SAP browser regressions. Windows SAP connection and actual hosted deployment remain separate acceptance.

## SAP desktop launch — 2026-10-18

Fixed root C:\geek_calculus\SAP2000-API. Replace direct web link with strict custom protocol, per-user registration and explicit UAC elevation; fixed GitHub Pages target and VI/EN allowlist. Reuse authenticated local connector using per-user DPAPI token; never stop unknown listeners. Validate protocol routing/build and token auth rejection; Windows registration/UAC requires user device verification.

## SAP extreme detail modal and display — 2026-10-18

Replace inline governing/tie paragraphs with a centered, scrollable table dialog retaining full row vectors and source metadata. Add live VI/EN controls without reload/data loss; SAP2000-API top heading. Normalize tiny negative zero only in two-decimal force display, never modify extraction/interpolation/extreme or export data. Verify existing browser flows, formatter examples, dialog close/Escape/mobile and language round-trip with identical dataset.

## SAP selected-member extremes — 2026-10-18

Add Selected members beside Per member and existing entire-group scope. Searchable multi-checkbox choices display Frame and assigned Section from exported metadata. Map selection to existing per_frame + frames API filter (no new connector contract), reject empty selection, clear stale extrema on changes and reset on extraction/model changes. Keep section4 filters independent; verify subset/multiple/language request payload and results in browser.

## Section extreme summary and staged filtering — 2026-10-18

Scope/member selection precedes position/component filters; Selected members gates them until a member is chosen. Add section summary from existing per_frame extreme results, grouped by assigned section, min/max for all six components. Default visible conditions M3/V2/P and columns P/V2/M3; expansion adds M2/V3/T and secondary columns. Preserve governing full vectors, all tie IDs and bounded provenance previews; never compose unrelated component maxima. Retain raw precision, signed values, nonconcurrent flags and selected/position scope. No new backend contract or SAP reread. Validate independent multi-frame section fixtures, ties/truncation/missing metadata, then browser cache/expansion/state/mobility and export.

## SAP2000 API V2 local steel data — 2026-10-18

User completed V1 and requests a separate local-first V2 using SAP-Tooltips as reference, preserving V1 and its layout. Reference pinned to Ephraim-Bryski/SAP-Tooltips@608415951abf7c601c3939ed0296cd1daa45eda5; documentation includes older/mixed ETABS signatures, so actual SAP2000v1.dll metadata must control named outputs/capabilities. Implement separate sap2000_v2 package, API prefixV2, local-only token-auth panel/launcher under C:\geek_calculus\SAP2000-API\V2, port8010 mutually exclusive with V1. Reuse stable V1 force DTO/processing without edits; add source-traceable member snapshots across identity, sections/nonprismatic/components/properties, materials/overwrites, geometry/local axes, assignments, modifiers, loads/combo definitions, joint response, design setup/AISC360-10 preferences and overwrites, SAP steel-design results, plus database-table inventory/read. Read-only getters allowlist, runtime signatures, explicit unavailable/unsupported/input_required states, unit/output-selection restoration and model/PID pinning. Do not calculate strengths/Cb, run analysis/design, assign objects or publish V2 UI to website. Verify fake-SAP snapshots/auth/units/restore/failure/limits, real CLR reflection fixtures, local browser data explorer and inherited force flows, clean Windows kit; actual SAP Windows acceptance remains separate.

## V2 tapered I-section and steel strength presentation — 2026-10-18

Expose explicit ordered Nonprismatic segment endpoints and I-section geometry labels (h,bf-top,tf-top,tw,bf-bottom,tf-bottom in mm), resolving component sections rather than parsing their names. Show a member/section engineering summary alongside raw data with endpoint section/material/Fy/Fu in MPa. Preserve member material overwrite precedence; display read design Fy override separately, never infer program-determined effective strengths. Add independent SC1 H300/H700 dimensional and material fixtures, browser checks and rebuild local-only preview kit. Windows SAP verification remains pending.

## V2 live component-read compatibility — 2026-10-18

Handle CSI literal None material overwrite as unassigned; accept reflected section-type output MyType and PropType; use successful typed I getter as verification if enum mapping unresolved. Keep failed geometry diagnostic available in summary. Verify source names/None sentinel in synthetic snapshot and browser, then package local.4; real user DLL snapshot needed if failure persists.

## V2 uploaded live snapshot: geometry casing — 2026-10-18

Live local.3 JSON confirms successful GetISection with T3/T2/Tf/Tw/T2b/Tfb and successful steel Fy/Fu; section enum PropType is correct. Root dimension bug is case-sensitive normalized alias lookup, not failed SAP getter. Normalize convenience dimension keys case-insensitively, preserve raw DLL field spelling and prior None overwrite fix. Synthetic fixture must use installed field casing. Validate uploaded raw records privately without committing model paths/GUIDs/notes, rerun targeted tests/browser and rebuild local.5.

## V2 component shape keywords for module routing — 2026-10-18

Add SAP display type plus stable shape key to section catalog/component references and summary table. Classify installed enum names (not hardcoded enum codes or section names) for user's12 families; Nonprismatic remains component-dependent, auto-select a selection list, joist specialized, unrecognized/special types manual_review. Shape identification is not a supported/validated strength check. Verify mapping, unknown/typed-probe boundaries, child references and browser/export; package local.6 without V1/website changes.
