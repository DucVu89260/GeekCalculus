# Repository handoff

## ASCE library delivery verification — 2026-10-16

- Checked latest remote `main` at `0e3c7fc`; the original ASCE delivery commits
  `eab5eaa` and `991342d` remain in its history. Fast-forwarded the existing
  `work` checkout, preserving newer Crane/H/I updates and generated local files.
- No application or formula changes were needed. The committed Pages build
  retains the Steel Library ASCE link, 875 heading candidates, 310 equation
  labels, kernel expression references and the complete 658-page PDF.
- Executed `tests/standards-pages-smoke.cjs` from `structural-platform` against
  the latest committed `docs` build served locally. Passed: demo sign-in,
  Library link/new tab, counts, Eq.27.3-1 expression and PDF page 307, original
  PDF hash, reload and 390px layout; no browser errors. Separately verified
  matching SHA-256 for both public-source and generated-docs PDF copies and
  ASCE references in the current hashed JS bundle. No numerical changes or
  unrelated suites were introduced/repeated in this verification-only task.
- Direct HTTPS live-site verification remains blocked by the cloud egress
  proxy (403), including an approved elevated read attempt. This is not
  evidence of an application failure or a failed Pages deployment. Git reads
  work; do not treat them as proof of Pages/API connectivity.
- Saved additive custom network requirements for `ducvu89260.github.io` and
  `api.github.com` in the environment draft, preserving package-manager
  presets. Draft persistence is confirmed; runtime activation/publication is
  not. Next step, if automated live verification is required: save/publish the
  environment network settings, then retry the live Pages browser check and
  inspect its deployment status. Do not bypass proxy policy or TLS checks.
- Full source extraction and engineering formula approval remain distinct:
  the library integration is delivered; the wind kernel is Chapter 27 Phase A
  with global `REVIEW_REQUIRED`, as recorded in its audit.

## Latest correction — left member navigation, 2026-10-16

- Branch `main`, base `17c1f0d`. The user corrected their preference to **left** navigation, matching the original H/I page. Crane now places the sidebar in the left grid column with a right divider; H/I's temporary right-side override was removed. Mobile navigation, routes, calculations and persistence are unchanged.
- Changed: `CraneBeamWorkspace.vue` styles, H/I standalone styles, existing Crane browser assertions, Plan and this Handoff. No new tests or formula changes. The smoke now explicitly verifies that both sidebars are left of the main content.
- Executed: production demo build passed; existing `crane-workspace-smoke.cjs` passed against native Vite and the demo production build, including left-side positioning on both pages, both-direction links, legacy URLs, numerical fixtures and mobile overflow. No JavaScript errors. Prior full numerical/CI evidence remains below; those suites were not rerun for this CSS-only correction.
- Delivery: push this correction to main and allow the existing Pages workflow to regenerate `docs`; do not edit generated Pages files manually. Local users pull main and refresh; no migration or engine rebuild.

## Initial Crane workspace release — 2026-10-16 (navigation position superseded below)

- Branch: `main`; UI commit: `64def77` (base `408ea8e`). Crane Beam now opens the dedicated `#/modules/steel/crane-beam` workspace, with H/I-style layout and desktop navigation on the **right**, as explicitly confirmed by the user. Both member pages link to each other. Old Crane query URLs remain supported. Mobile navigation moves above the content.
- Changed source: `App.vue`, `modules.js`, `SteelComponentMenu.vue`, new `CraneBeamWorkspace.vue`, Crane panel IDs/layout/input names, and H/I standalone navigation/CSS/one translation. Geometry and member calculation sources are unchanged; the entire existing Crane calculation script was compared byte-for-byte with the base. Existing preliminary/NOT VERIFIED gates remain. No database/backend/auth contract or migration changed.
- Executed from repository root: `npm --prefix structural-platform/frontend/vue run typecheck`; `npm --prefix structural-platform/frontend/vue test` (**92 passed**, zero failures/skips); native and `VITE_DEMO_MODE=true` production builds into separate temporary output directories. All passed; Vite's existing large-chunk warning remains.
- Browser verification: `tests/crane-workspace-smoke.cjs` passed against current-source native Vite (isolated backend/private test account fixtures) and the production demo build. Checked new-tab entry, opener isolation, canonical/legacy routes, right navigation both ways, route-preserving contents, independent area/J10 fixtures, review gates, EN/VI shell and 320/390 px overflow. Existing `structure-groups-smoke.cjs` passed on the demo; `hi-bilingual-smoke.cjs` passed with numeric/dirty-input/validation/import/export/report parity and the fresh build copy. No browser JavaScript errors.
- H/I smoke now accepts `HI_PUBLISHED_DIR` (default still root `docs`) to compare a fresh build before Pages publication. The initial run correctly failed its final published-copy assertion against stale `docs`; all preceding UI/numerical assertions had passed. The fresh-build rerun passed; do not confuse that with deployed-site verification.
- Reproduce Crane browser smoke with `CRANE_BASE_URL`, `TEST_DEMO=1` for demo, or private `AUTH_FIXTURES` for native, and the installed `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH`. Do not commit real account fixtures. Native tests reused an isolated app, not the user's library database.
- Release: pushed to `main`; [frontend/backend CI](https://github.com/DucVu89260/GeekCalculus/actions/runs/38871660930) and [Pages deployment](https://github.com/DucVu89260/GeekCalculus/actions/runs/38871697335) passed. Generated publication commit: `e67d18e`. Default H/I smoke passed again against the committed `docs` copy. HTTPS retrieval verified the live index points to the new bundle and the H/I page contains the right-navigation change and Crane link. A live Chromium smoke could not start because this environment rejected the public TLS certificate (`ERR_CERT_AUTHORITY_INVALID`); full browser evidence is from the native/demo local runs, with TLS verification left enabled. After pulling main, refresh the local Vite page (Ctrl+F5 if cached). Production frontends need their normal frontend rebuild; no migration, data reset or section-engine rebuild is needed.
- Prior runtime update: `main` includes `b841602`, the minimal `SECTION_CORE_ONLY=1` Docker fix. The earlier engine-build blocker is resolved; PR #19's broader build-target refactor remains separate. Shared outer navy `#123754` from `e309e8d` is preserved.

## Context foundation audit (dated baseline)

Updated: 2026-10-16. Baseline audited: `main` at `991342d`. Current branch: `docs/repository-context-foundation`. Review: [PR #20](https://github.com/DucVu89260/GeekCalculus/pull/20). Foundation commit: `b983e02`; current metadata/head is visible in the PR commit list. This file is a dated state transfer; inspect Git/PR status before continuing.

## User objective and scope

Audit GeekCalculus itself and create AGENTS/Skills/Plan/Handoff around its real Laravel architecture. Preserve product behavior and ongoing engineering work. Current assistance included Luna max read-only Laravel/ownership review. No application formula, route, schema, dependency, Compose configuration or runtime data was changed by this context task.

## Delivered in this branch

- Root `AGENTS.md` and scoped instructions for Laravel, Vue, engine adapter, shared numerical package and standards.
- Four local Skills under `.agents/skills`: Laravel catalog, engineering rule validation, CSI/Excel interoperability and repository verification.
- `context/GOALS.md`, `ARCHITECTURE.md`, `AUDIT.md`, `PLAN.md`, and this filled handoff.
- Durable context lives outside root `docs/`, which Pages rebuilds.

[Audit](AUDIT.md) contains evidence/findings. [Plan](PLAN.md) defines independent Steel, Wind and CSI MVP acceptance slices and deferred model/MCP/agent-team work. No blank template is being presented as a completed module.

## Verified current facts

- Laravel 12: cookie/session + CSRF, global admin/user roles; default DB SQLite.
- Global engineering library: authenticated reads/admin writes. Projects are separate nullable-user-owned records; combo state is unique per user. No project-scoped section revision graph exists on main.
- Catalog writes use FastAPI → Node shared core, validate response and save canonical snapshot/formula report. GET reads historical snapshots; imports recompute rather than trust client results.
- Geometry has ten profiles/nine models and is shared by Steel/RC. Python analytical code is an oracle; production has no numerical fallback.
- Steel AISC 360-10 and ASCE 7-10 wind are partial/review-gated. ASCE source extraction is not execution approval.
- Main tracks the full ASCE PDF in Vue `public/standards` and root `docs/standards` (same 658-page artifact). Backend private storage is a second distribution path; do not claim private-only originals. SOURCE-01 records the policy decision; no artifacts/history were removed.
- Native mode persists through Laravel; Pages demo uses localStorage. CSI adapter is a scaffold; Combo S2K is offline new-model export.

## Executed audit checks

| Check / source | Result |
| --- | --- |
| Main-baseline Laravel suite, isolated SQLite memory | 66 passed / 525 assertions |
| Main-baseline Vue typecheck / complete Node suite | Passed / 92 passed, zero failed/skipped |
| API route list | 41 entries |
| Context links / skill frontmatter / scope checks | 15 Markdown files, 76 local links, four skill metadata blocks and five scope-inheritance links checked |

The workspace also contains three generated, untracked browser bundles (`frontend/vue/public/aisc360-10-resistance.js`, `aisc360-10-verified-hi.mjs`, `hi-section-properties-core.mjs`), regenerated by existing npm hooks. They are excluded from this context PR; PR #19 adds their ignore entries. Do not treat them as hand-edited implementation changes or stage them with a blanket `git add .`.

Tests ran on preinstalled dependencies; private app databases/source artifacts were not reset. Browser workflows, PostgreSQL, live SAP2000/ETABS and actual workbook recalculation were not revalidated in this documentation task. See [audit limitations](AUDIT.md).

## Other branches: do not confuse with main

| Work | State checked on 2026-10-16 | Next action |
| --- | --- | --- |
| [PR #19](https://github.com/DucVu89260/GeekCalculus/pull/19), `fix/isolated-section-engine-build`, head `05403c0` | Ready PR, mergeable, unmerged; frontend/backend/engine CI passed; prior task verified 96 Node and 270 Python tests plus installed/live API | Review/integrate the runtime build fix independently; refresh pending-build wording when main includes it |
| [PR #18](https://github.com/DucVu89260/GeekCalculus/pull/18), `feat/aisc36010-library-source-review`, head `8e9f058` | Draft, conflicts with main ASCE work; latest local Node suite 88 passed; current head has no new merge CI because of conflicts | Dedicated reconciliation of importer/routes/schema/reader; preserve both standards, rerun migration/import/source/auth checks after integration |
| [PR #20](https://github.com/DucVu89260/GeekCalculus/pull/20), this branch | Context/documentation only, based on `991342d`; pushed for review | Review context against code/dated baseline; do not bundle functional fixes; latest CI status is on the PR |

Do not merge/overwrite shared controller, routes, migrations or reader files from either standards branch without inspecting both versions. Optional PostgreSQL/source-review facilities in PR #18 are not the deployed default.

## Next session: smallest useful start

1. Run `git status --short`, identify current branch and fetch/read main/PR state. Preserve local edits and coordinate any other session's shared files.
2. Read root AGENTS and the relevant scoped file, then select one Plan row. For immediate runtime work use BUILD-01; for AISC/ASCE integration use STD-01 before inventing new registry tables.
3. Read the matching Skill and actual source/tests. State one acceptance target and dependencies; do useful source-independent work if an artifact/product is unavailable.
4. Run only checks appropriate to the change. Test DBs must be disposable; browser native accounts remain in private `AUTH_FIXTURES`.
5. Update this handoff with exact branch/commit/PR, changed contracts, executed commands/results, remaining issues and next step. Update architecture/audit only when their underlying facts change; do not append a transcript.

## Runtime notes

Existing cloud containers and installed dependencies were reused for the audit; their processes/credentials are not guaranteed to exist in a new environment. Setup instructions are in [the platform README](../structural-platform/README.md). Main's clean engine Docker build needs the pending PR #19 fix; the current monolithic builder fails when browser source is absent. Do not delete user data to repair that build.

The human's Windows repository path and cloud checkout are different machines. Pushing a branch does not change their local checkout or deploy the public website. Never put local account passwords/private artifact paths into this handoff.


## Local domains — current shared-data contract (2026-10-16)

Updated from main `9e8475d` per explicit user request: main and test are separate runtimes, not separate Git branches or isolated datasets. `geekcalculus.com` serves the built native app; `geekcalculus.test` serves native Vite. Both backend services explicitly use the same existing `backend/laravel/database/database.sqlite` and share `storage/app` for standards/private documents. Test retains its own session cookie and `local/test-data/storage` sessions/cache/logs. Existing main accounts work on either domain; login sessions are independent. Data edits through test affect main. The former test-only SQLite and underlying test documents are retained on disk, not deleted, overwritten or automatically merged.

Main alone runs ordinary additive startup migrations; test waits for main health and does not migrate/seed/reset the shared DB. Both PHP processes retain Compose environment overrides through `artisan serve --no-reload`. Never run database-mutating suites against either running app; explicitly use disposable SQLite memory or another disposable DB.

The hostname-guarded `public/test-environment.js` adds one non-interactive Test label fixed at bottom left. Vue loads it directly on the test hostname; standalone I/H and Combo HTML load it through a deferred script. Nginx injection remains a fallback for other test HTML, so a stale gateway no longer blocks the badge on the current app/tools. Main and embedded frames do not display it. Startup validates/reloads Nginx. It builds with the Compose Node 24 container and requires no host npm.

Validation: local-domain startup/build and typecheck passed; runtime inode checks confirmed both processes use the identical SQLite file and document directory, with different cookie names. The native browser smoke passed health/CSRF/guest rejection, main-versus-Vite routing, HMR, fixed app/standalone/mobile marker and main marker absence. An auxiliary local HTTP proxy removed gateway marker injection, and Test still appeared once on Vue login, direct I/H and Combo pages. No real accounts or app records were changed to validate the shared-data setup.

User machine: after updating main, run `bash scripts/start-local-domains.sh` in `structural-platform`, then Ctrl+F5 on `http://geekcalculus.test`. Hosts must have uncommented `127.0.0.1 geekcalculus.com geekcalculus.test`; for a Windows browser edit Windows hosts even if Docker runs in WSL. We cannot update the user's laptop configuration from this cloud checkout. Public DNS/GitHub Pages are unchanged. See `structural-platform/local/README.md`.

## AISC equation reader — 2026-10-16

Work branch `work`, base `8052158`, intended publication `HEAD:main`. Reported 231 AISC labels were indexed candidates: the outline importer stores labels/pages, not mathematical expressions. No database reset/reimport is required for this UI fix.

`StandardsExplorer.vue` uses exact AISC360-10 canonical I/H `FORMULAS` matches as separately marked implementation references when stored math is missing; stored math wins, unknown/composite labels are not inferred, review statuses remain untouched. `src/aisc-equation-library.mjs` reuses the registry without changing engineering rules. Selected labels visibly scroll to PDF source and offer a new-tab link, with an unmapped state. API clause/equation JSON includes the clause's `document_id`; source selection follows that artifact, falls back only to a unique specification, and refuses ambiguous/missing artifacts. Other-edition expressions are not enriched. No migrations, source ingestion, approval, private artifact publication or app-data mutations.

Executed: `node --test tests/geometry/aisc-equation-library.test.js` (3 passed); `docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --filter=StandardsRegistryTest` (6 passed, 35 assertions); `npm run typecheck`; native `npm run build -- --outDir /tmp/geek-equation-review --emptyOutDir` (passed, chunk-size warning). `PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright node structural-platform/tests/aisc-equation-reader-smoke.cjs` passed on fresh native build: reference/candidate retention, stored math precedence, exact artifact/page, visible source scroll, unmapped ambiguity, mobile width and edition isolation. Browser uses synthetic authenticated API/PDF fixtures, not the user's private local PDF. API authorization/edition behavior checked independently on disposable SQLite memory. Initial API fixture collided with seeded E3; corrected to associate existing clause and reran successfully.

Remaining: complete 231-expression semantic library requires source transcription/review beyond current label importer. Unknown expressions remain indexed-only with original-page access. User laptop must pull main and run `bash scripts/start-local-domains.sh` from `structural-platform`, then Ctrl+F5. Their laptop/live public deployment were not validated here. Generated docs/public bundles and private PDFs excluded from source commit.
