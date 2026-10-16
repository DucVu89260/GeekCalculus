---
name: geekcalculus-verification
description: Select and execute GeekCalculus checks by Laravel, shared-core, standards, Vue/native-demo or Docker boundary, preserving test data and reporting exact evidence instead of generic test claims.
---

# Verification map

Read `context/HANDOFF.md` for dated baseline results, then inspect current scripts. Commands below are workflows, not claims that services/dependencies are already installed. Working directories are explicit.

## Choose checks that cross the changed boundary

| Change | Checks |
| --- | --- |
| Auth/catalog/API | Matching Laravel Feature tests; guest/admin/user and rejected writes; native request for changed auth/CSRF behavior |
| Catalog snapshot/engine contract | `SectionPropertyPersistenceTest`, `LibraryTransferTest`, real FastAPI calculation; fake HTTP tests alone are insufficient |
| Shared geometry/mechanics | Node core/geometry suites, matching Python oracle/property-based tests, parity where relevant |
| AISC/ASCE rule | Matching standard tests plus independent source-backed benchmark and unsupported-branch cases |
| Vue UI/routing | `npm run typecheck`, production build and matching browser smoke; native mode for server persistence/permissions |
| Engine packaging | Docker build, Python suite inside image and installed-wheel API from outside `/engine` |
| Documentation/context only | Check links, referenced paths/commands, skill frontmatter, scope rules and truthful branch/test state; no need to rerun unrelated application suites |

## Reproducible commands

From `structural-platform`, after dependency setup and backend startup:

```sh
docker compose exec -T backend php artisan route:list --path=api
docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test
```

`phpunit.xml` defaults to SQLite memory, but external container variables can take precedence. Never point `RefreshDatabase` tests at the app DB. PostgreSQL testing requires its own disposable database, explicit connection variables and separate report.

From `structural-platform/frontend/vue`:

```sh
npm ci
npm run typecheck
npm test
npm run build -- --outDir /tmp/geek-vue-review --emptyOutDir
```

Choose a writable absolute output on your OS. `npm test` includes build preparation; direct `node --test` may require a bundle first. Main's monolithic builder has a known sparse Docker-context bug; PR #19 fixes it and adds four isolation tests. Verify current branch before expecting those targets/tests.

From `structural-platform`, once the engine build fix is present:

```sh
docker build -f engineering/Dockerfile -t geek-section-engine:review .
docker run --rm geek-section-engine:review python -m pytest -q
```

For packaging changes, run a calculation using the installed wheel with `--workdir /tmp`, as demonstrated in PR #19's engine CI. A source-directory import can hide missing package data.

## Browser and deployment

Use `structural-platform/tests/browser-auth.cjs`. Native accounts come from a private `AUTH_FIXTURES` JSON containing test `role/email/password`; never commit or print it. The helper's demo credentials are demo-only. Inspect the smoke script for its base-URL/environment variable before running it; several scripts target different module routes.

Examples to select: `auth-library-smoke.cjs`, `catalog-section-smoke.cjs`, `structure-groups-smoke.cjs`, `sectional-ui-smoke.cjs`, `standards-source-smoke.cjs`, `hi-bilingual-smoke.cjs`. Run on an isolated test app for data mutations. Missing private fixtures are an unrun prerequisite, not a pass.

`.github/workflows/web-demo.yml` builds Pages from Vue/public sources into root `docs/` after main pushes. Inspect its paths and actual test steps: main's backend CI only selects Combo tests; PR #19 expands frontend checks and adds Docker CI; PR #18 has its own pending full source-review checks. Local tests, PR CI, merge and published site are separate evidence.

## Record outcomes

Capture the checked SHA, dependency/runtime versions when material, command/CWD, executed test count, failures/warnings/skips, disposable DB/artifact use and whether services were newly started. Preserve failing exit codes when logging. Stop broadening tests once sufficient evidence exists. Update Handoff with a concrete next action for any blocker; do not turn an unrun or partial check into a readiness/compliance claim.
