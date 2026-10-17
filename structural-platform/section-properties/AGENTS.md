# Shared numerical core scope

Inherits [root instructions](../../AGENTS.md). Use the [engineering validation skill](../../.agents/skills/engineering-rule-validation/SKILL.md).

- `index.ts` is the production entry; `core/calculator.ts`, mechanics helpers, `core/formula-report.ts` and `section-registry.json` define numerical behavior and reporting. Browser and Node entrypoints package this same source.
- Keep ten profiles/nine types, aliases, finite-dimension validation, geometry/config/manifest hashes, canonical mm/XY, status semantics and stored formula-report compatibility coherent.
- The catalog requires plastic and advanced results. A finite zero can be valid (for example model-specific Cw); unavailable results must retain explicit status/reason, not invented zeros.
- A numerical/geometry-model change needs independent expected values and a documented version choice. An input or report-shape change also affects Laravel's strict `SectionPropertyCalculator::validResult` validator and saved fixtures.
- Do not insert material strengths, AISC section classifications, load combinations or CSI axis conversions into this geometric layer.
- Build outputs in `dist/` and Python `data/` are generated. Regenerate through the builder; do not patch bundled formulas. PR #19 adds isolated build targets; check availability on the active branch.
- Use existing `tests/section-properties-core.test.cjs`, `tests/section-mechanics-advanced.test.cjs`, Vue geometry tests and Python oracle tests. A matching duplicated formula in a test is not sufficient independent verification.
