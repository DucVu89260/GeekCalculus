# Repository implementation plan

Baseline `main`: `991342d`, audited 2026-10-16. This is a dependency/acceptance plan, not a claim that all modules are finished. Current milestone: **Context Foundation**, implemented in [PR #20](https://github.com/DucVu89260/GeekCalculus/pull/20) for review. Update status/evidence as work is actually accepted; keep one bounded implementation slice active per owner.

## 0 — Context Foundation and immediate integration

| ID | Status | Work / files | Acceptance evidence / dependency |
| --- | --- | --- | --- |
| CTX-01 | Implemented / PR #20 review | Root/scoped AGENTS, four repository Skills, GOALS/ARCHITECTURE/AUDIT/PLAN/HANDOFF | Every current-state statement anchored to code or dated PR evidence; links/frontmatter/scopes checked; no application changes; current task |
| BUILD-01 | Implemented in open PR #19 | Isolated engine/browser/library builder; Docker + CI | 270 Python and 96 Node tests, exact Docker CI and installed-wheel smoke already passed on that PR; merge/update context remains separate |
| STD-01 | Blocked integration / Draft PR #18 | Reconcile AISC private/review registry with main ASCE source corpus | Compare migrations/importers/routes/source-page contexts, preserve both editions/readers, then fresh/disposable migration + import/idempotence/auth/edition tests; no overwrite-only conflict resolution |
| SOURCE-01 | Decision pending | Define per-artifact public/private source policy | Main includes full public ASCE PDF plus private Laravel corpus; inventory both paths/copies and intended distribution before publication changes; do not delete history in a docs task |
| DB-01 | Decision pending | Decide whether/when to move native SQLite data to PostgreSQL | Inventory actual user library/private artifacts; migration/backup/restore/dialect/concurrency plan and disposable PG tests before conversion; not required for this context PR |

Review BUILD-01 as the smallest runtime fix first. STD-01 needs a dedicated integration task; PostgreSQL deployment and source review approval are not implicit side effects of resolving Git conflicts.

## 1 — Independent engineering MVP slices

A slice ends with a reviewable input/output contract, independent expected fixture, source/edition/version evidence, negative/boundary tests, UI/status behavior and a reproducible command. Existing implemented formulas are extended/validated in place, not re-created.

### Steel Design / Symmetric I/H

| ID | Narrow outcome | Existing surface | Acceptance / dependencies |
| --- | --- | --- | --- |
| STEEL-01 | Independently validate B4 supported I/H case selection | AISC kernel, factor registry, `aisc36010-verified-ih.test.js` | Rolled/built-up and compression/flexure distinctions; each compact/noncompact/slender threshold; source h/fillet model declared; unknown geometry stays blocked |
| STEEL-02 | Independently validate existing E3/E4 compression | Same kernel + canonical J/Cw/rx/ry | Separate Kx/Lx, Ky/Ly, Kz/Lz/G; independent reference and governing-state check; missing inputs rejected; no reuse of workbook assumptions; depends on STEEL-01 geometry |
| STEEL-03 | Validate one major-axis F2 compact-web branch and method conversion | `aisc360-10-verified-hi.mjs`, shared H/I bridge | Same-branch nominal result for ASD/LRFD; independent Lp/Lr transition fixtures; source-confirmed bracing/Cb; preserve blocked F4 and overall review status |
| STEEL-04 | Plan next F4/F5/G/H package from demonstrated gaps | Audit + PR #18 F4-11 evidence | Scope exactly one missing limit-state family after prerequisites; full shear/stability/tension/H interaction cannot be marked satisfied by earlier slices |

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
