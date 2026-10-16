# GeekCalculus — goals and boundaries

Baseline: `main` at `991342d`, audited 2026-10-16. This is a product/workflow context, not evidence that planned features are deployed. See [architecture](ARCHITECTURE.md), [audit](AUDIT.md), [plan](PLAN.md) and [handoff](HANDOFF.md).

## Product goal

Build a bilingual structural engineering platform in which users can reuse trusted material/section libraries, calculate geometric properties and progressively apply source-traceable design rules. Laravel remains responsible for identity, permissions, data and engineering-service integration; it is not a place to duplicate numerical formulas.

Preserve the existing user spaces in order: Loading, Steel Structure, RC Structure. Steel and RC reuse the material-independent geometric module. Keep the current admin library and VI/EN experience usable while individual engineering modules evolve.

## Outcomes to preserve

- A library entered once survives container restarts and incremental upgrades. Catalog edits/imports respect references and user edits; backup/restore is explicit.
- One shared geometric source supplies browser, native API and saved catalog snapshots, with canonical units/axes, provenance and formula reports.
- AISC/ASCE calculations declare their actual edition, applicable branch, inputs, factors and remaining checks. A partial calculation never masquerades as complete engineering approval.
- Native persistence/authorization and frontend-only demo behavior are clearly distinguished.
- Excel/CSI interchange evolves from measurable file contracts toward validated product integration; it does not start by claiming the scaffold is a live SAP2000 connection.

## Current scope versus next work

| Layer | Current implementation | Next bounded objective |
| --- | --- | --- |
| Laravel data | Global library, user projects, per-user combo workspace, private standards sources; SQLite default | Preserve contracts; resolve standards integration before extending review tables |
| Geometry | Ten profiles/nine types, canonical snapshots and mechanics | Stabilize build separation and version/contract verification |
| Steel | Legacy I/H preview plus separate partial AISC 360-10 reference rules | Independently validate one applicable branch at a time |
| Wind | ASCE 7-10 Ch27 Phase A, source corpus integration | Source-backed pressure-case/report tests; no complete-building/load-set claim |
| CSI/Excel | Combo JSON/S2K file export; CSI agent scaffold | Offline read-only exchange contract and real product import evidence |
| RC | Shared geometric properties and preliminary UI | RC design rules require a separate specification; not part of this context PR |

## Decisions not made by this documentation

PostgreSQL is a requested direction, not the active shared main database. A migration requires preserving current SQLite libraries, testing the target dialect and choosing deployment/storage/rollback explicitly. Existing integer IDs do not become UUIDs through documentation.

Project-specific section definitions, immutable revision/calculation-run entities, organization tenancy, complete steel shear/stability/connection design and live Windows COM automation are not assumed present. Scope each as a separate accepted contract before implementing it.

This change does not alter product functionality, schemas, formulas, runtime configuration, models or subscriptions. It does not add MCP servers/hooks or a multi-agent framework. Model/effort tuning comes after measured task outcomes; see the later milestones in [the plan](PLAN.md).
