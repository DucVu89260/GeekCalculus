# Laravel scope

Inherits [root instructions](../../../AGENTS.md). Consult [architecture](../../../context/ARCHITECTURE.md) and the [Laravel skill](../../../.agents/skills/laravel-catalog-workflow/SKILL.md).

- Existing code uses controllers, the query builder and a small Eloquent model set. Extend that pattern; do not add repository interfaces, another auth stack or duplicate tables merely for structural uniformity.
- `routes/api.php` wraps authenticated routes in `web` session/CSRF middleware, then `auth`; catalog writes/import/export/user management require `admin`. Hiding a Vue button is not authorization.
- `EngineeringController` scopes ordinary projects by `projects.user_id`; admins see all. Nullable legacy ownership is intentional. `ComboGeneratorWorkspaceController` scopes GET/PUT to the authenticated user; never accept a body-supplied owner.
- Section writes go through `SectionPropertyCalculator`; failed/invalid engine responses must not produce partial writes. Keep transaction/reference rechecks and all-or-nothing library import behavior.
- `sections.properties` stores input/legacy data; `sections.section_properties` is the canonical calculated snapshot. Do not merge those contracts or map catalog y/z names into XY without evidence.
- `Section::formulaReport()` returns the saved report. A formula-library update must not rewrite historical reports on read.
- `EngineeringSeeder` uses `library_seed_state`; retain one-time/user-data protection. Existing seed data is not an instruction to overwrite edited libraries.
- Main standards source tables are `standard_source_pages/items`; candidate OCR/text is not approved execution input. PR #18 adds a different review/version extension; resolve overlap explicitly rather than recreating tables/endpoints from memory.
- Default DB: SQLite. Read `.env.example`, `config/database.php`, migrations and actual runtime config before changing database engines. Never print `.env` or passwords.
- PHPUnit uses SQLite `:memory:`. In a PostgreSQL-configured container, override DB variables or use a named disposable test DB before any `RefreshDatabase` suite. Do not run tests against the application database.

Representative checks from `structural-platform`:

```sh
docker compose exec -T backend php artisan route:list --path=api
docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --filter=AuthLibraryTest
docker compose exec -T -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --filter=SectionPropertyPersistenceTest
```

Select additional tests by changed behavior; see the verification skill. Schema/auth changes need rejection/isolation cases, not only a successful response. Changes to API shape also require checking `frontend/vue/src/api.js` and native consumers.
