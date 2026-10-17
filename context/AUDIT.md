# Repository context audit

Date: 2026-10-16. Audited main SHA: `991342d` (`build(demo): publish ASCE 7-10 Standards library`). Documentation branch: `docs/repository-context-foundation`. Findings are architecture/workflow evidence, not a full security certification or independent verification of all engineering formulas.

## Method and observed baseline

Read existing setup/architecture notes, API/bootstrap/auth controllers, migrations/models/seeders, section validation service, Vue/native/demo/module routing, shared numerical entrypoints, AISC/ASCE audits, CSI scaffold, build scripts/Docker and GitHub workflows. Luna max independently reviewed Laravel-specific assumptions and ownership boundaries. No existing `AGENTS.md`, repository skills or context handoff were present before this change.

Executed on the main-baseline source, using preinstalled dependencies:

| Check | Result / limitation |
| --- | --- |
| Laravel full suite, explicit SQLite `:memory:` in container | **66 passed, 525 assertions**; no app DB reset |
| Laravel API route listing | **41 routes**, including auth, global library, projects, combo and standards |
| Vue typecheck | Passed |
| Complete npm test suite | **92 passed**, zero failed/skipped |
| Docker sparse-context failure | Previously reproduced before PR #19; main still calls the browser-dependent monolithic builder |
| Main full fresh Docker deployment / private artifact provisioning | Not re-executed as part of this documentation audit |
| Live SAP2000/ETABS / Excel workbook recalculation | Not run; no adapter implementation or tracked workbook artifact |

Commands were `php artisan test` with explicit `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `APP_ENV=testing`; `php artisan route:list --path=api --json`; `npm run typecheck`; `npm test`. Runtime app containers/data were preserved. These checks establish current regression behavior, not future PostgreSQL semantics or complete design compliance.

## Findings that shape the instructions

| ID / priority | Evidence and consequence | Required context/workflow response |
| --- | --- | --- |
| A01 / high | [DB config](../structural-platform/backend/laravel/config/database.php), default Compose and `phpunit.xml` are SQLite-based. Historic comments/proposals mention PostgreSQL. | State actual DB separately from target architecture; require disposable PG tests and data migration before claiming parity. |
| A02 / high | [API routes](../structural-platform/backend/laravel/routes/api.php) use session/CSRF/admin; global library differs from user projects/combo. | Skills must use existing auth/ownership. No invented tokens, tenancy, project-section ownership or CRUD endpoints. |
| A03 / high | [Calculator validator](../structural-platform/backend/laravel/app/Services/SectionPropertyCalculator.php) strictly checks snapshot contracts; read and write semantics differ. | Shared-core/report changes must coordinate Laravel validation and fixtures. Preserve saved reports and no-write failures. |
| A04 / high | [Builder](../structural-platform/scripts/build-section-properties-core.cjs) on main accesses browser inputs absent from [engine Docker stage](../structural-platform/engineering/Dockerfile). | Apply/review PR #19 independently; retain one numerical source. Do not fix by copying the entire frontend into the engine. |
| A05 / high | [AISC audit](../structural-platform/standards/AISC360-10-IH-PHASE-A-B-AUDIT.md) and [wind audit](../structural-platform/standards/ASCE7-10-WIND-AUDIT.md) declare incomplete branches/REVIEW_REQUIRED. | Candidate extraction, numerical branch tests and engineering approval are distinct gates; independent examples remain needed. |
| A06 / high | PR #18 touches the same registry/controller/routes/import/migration/reader areas as main ASCE corpus. GitHub reports merge conflicts. | Integrate intentionally with source-context/edition tests; do not overwrite ASCE or mark PR contents already deployed. |
| A07 / medium | [Pages workflow](../.github/workflows/web-demo.yml) replaces root `docs/`; native/demo APIs have different persistence. | Store durable context in `context/`, validate native permissions separately, edit Vue/public rather than published artifacts. |
| A08 / medium | [CSI main](../structural-platform/csi-agent/main.py) is a scaffold, but [Combo docs](../structural-platform/frontend/vue/COMBO-GENERATOR.md) describe working S2K export. | Scope offline export versus live COM/API. Define explicit units/axes/override handling before adding adapters. |
| A09 / medium | Main CI selects backend Combo tests and selected frontend tests; it does not run the full local backend suite. | Record selected/full/real-service evidence separately; expand gates selectively, beginning with PR #19's packaging regression. |
| A10 / high | Main tracks the full 658-page ASCE source in Vue `public/standards/asce7-10.pdf` and root `docs/standards/asce7-10.pdf`, alongside authenticated Laravel storage. [Corpus docs](../structural-platform/standards/ASCE7-10-SOURCE-CORPUS.md) describe that intentional static publication. | Inventory actual source distribution; do not claim all originals are private. Decide per-artifact public/private requirements before changing publication. This doc task does not remove files or rewrite Git history. |
| A11 / medium | `frontend/vue/src/demo-api.js` calls seeded editions “PostgreSQL”, although config/Compose use SQLite. Older architecture notes describe proposals not yet implemented. | Prefer actual config/schema/behavior over stale comments and distinguish current, pending PR and proposed architecture. |

## Context deliverables and limits

Root/scoped AGENTS define entrypoints and invariants; four task-specific skills map existing code and checks; GOALS/ARCHITECTURE contain product/runtime facts; PLAN has bounded acceptance packages; HANDOFF contains actual state and next actions. No application formula, route, migration, build configuration or dependency is changed by this context PR.

The two public PDF paths point to the same Git blob and 23,740,317-byte file, SHA-256 `ae2997f7a31975965b33065ba54acbf4da441f4f821b2a97372d67c2bd1ca248`; page count/hash were measured locally. No new source PDF was added by this PR.

Follow-up findings are planned, not silently fixed: PostgreSQL migration/revision architecture, full admin rule review editor, CI coverage expansion, source distribution policy/stale comments, full design validation and live CSI support. The audit did not run a penetration test, production restore drill or all browser workflows.
