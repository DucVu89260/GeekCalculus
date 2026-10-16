---
name: laravel-catalog-workflow
description: Extend GeekCalculus Laravel catalog, session-authenticated APIs, section snapshots, or per-user Combo Generator persistence using the existing controllers, schema and tests.
---

# Laravel catalog/API workflow

Use for Materials/Section types/Sections, auth/admin roles, projects, imports or Combo workspace changes. This is not a generic Laravel scaffold generator.

## Establish the actual contract

1. Read root and Laravel `AGENTS.md`, then `context/ARCHITECTURE.md`.
2. Inspect `structural-platform/backend/laravel/routes/api.php` and the relevant controller/model/migration. Routes mix `/api/library`, `/api/projects`, `/api/sections` and `/api/v1/...`; do not invent a second resource API.
3. Trace the consumer in `frontend/vue/src/api.js`, `LibraryBrowser.vue` or `ComboGeneratorView.vue`. Record request/response/error shape and native/demo differences.
4. Classify ownership: catalog is global/admin-write; projects are user-owned/admin-readable; combo workspace is one per user. Section definitions are not project-owned entities on main.

## Implement in the existing path

- Preserve `web` + `auth` + server-side `admin` middleware, CSRF and throttles. New auth flows must fit the session model; no token framework migration without an explicit task.
- Extend validation and existing controllers/services. Add a service when it resolves a concrete repeated responsibility; do not impose repositories/DTO layers on unrelated modules.
- For section input changes, update the shared registry/payload mapper and `SectionPropertyCalculator` contract together. Server create/update/copy/import recomputes and saves a canonical snapshot only after validating the engine response; GET reads it unchanged.
- Engine failure is 503/no write. Keep transactional reference checks and all-or-nothing import. Library import uses stable codes, not source-machine IDs; absent archive records are not deletions.
- Use a new additive migration. Check actual database dialect and seed-state protections. No schema reset, automatic PostgreSQL conversion or seed overwrite to make a test pass.

## Validate the behavior

From `structural-platform`, with backend running and tests isolated:

```sh
docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --filter=AuthLibraryTest
docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --filter=SectionPropertyPersistenceTest
docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --filter=LibraryTransferTest
```

Select the relevant subset. `LibraryClassificationTest`, `EngineeringApiTest`, `ComboGeneratorWorkspaceTest`, `StandardsRegistryTest` and `StandardSourceCorpusTest` cover other boundaries. Inspect tests first: persistence tests fake engine HTTP; they do not establish live service parity. For a changed engine contract, also exercise the real FastAPI path and native UI.

Check user/admin/guest rejection, cross-user isolation where applicable, validation errors, failed-write rollback and retained legacy snapshots. UI-only edits do not require every backend suite.

## Handoff

Record changed route/table/JSON fields, migration and rollback implications, consumer impact, exact commands/results and any untested live integration. Update the matching Plan row/Handoff. Do not claim PostgreSQL support from SQLite-only tests.
