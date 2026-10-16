# Engineering adapter scope

Inherits [root instructions](../../AGENTS.md). Read [the shared package](../section-properties/README.md), [engine contracts](README.md) and the [engineering rule skill](../../.agents/skills/engineering-rule-validation/SKILL.md).

- Production path: Laravel → FastAPI `structural_engine/sectional_properties/api/main.py` → `canonical.py` → packaged `data/section-core.mjs` → shared TypeScript package. Do not switch HTTP requests to the Python analytical oracle when the Node bridge fails.
- The oracle modules (`solver.py`, `torsion.py`) remain useful for independent checks. A duplicate oracle is not a second production source of truth.
- Registry has ten UI profiles over nine geometry types; symmetric/asymmetric I share a geometry model. Do not regress to the historical three-shape v1 scope.
- Validate finite dimensions, variants, canonical mm/XY, optional-property statuses, hashes/versions and formula reports. A change to numerical meaning requires fixtures and a version decision.
- Main Docker build is known to call browser-dependent build work without those sources. PR #19 provides `--target=engine`. Keep Docker inputs bounded to the shared package/tooling, rather than copying the entire frontend to hide the dependency error.
- AISC/ASCE material/code checks do not belong in generic geometric properties. CSI axes and imported/overridden properties need explicit future adapters.

Build/test from `structural-platform` after applying the build fix or confirming it is merged:

```sh
docker build -f engineering/Dockerfile -t geek-section-engine:review .
docker run --rm geek-section-engine:review python -m pytest -q
```

Build the Node bundle before packaging a Python wheel. Test the installed wheel from outside `/engine` as well as source-directory tests when changing packaging. Keep the original failure behavior for an unavailable core; do not substitute zeros or fake advanced properties.
