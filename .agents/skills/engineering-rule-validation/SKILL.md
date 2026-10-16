---
name: engineering-rule-validation
description: Change or review GeekCalculus geometric properties, AISC 360-10 member rules, or ASCE 7-10 wind rules with edition-specific sources, applicability gates and independent numerical verification.
---

# Engineering rule validation

Use for formulas, factors, units/axes, applicability, solver status, or source-to-rule approval. Source indexing/UI changes need their own checks but are not engineering verification.

## Choose the layer and source

- Geometry: `section-properties/index.ts`, `core/`, `section-registry.json`; Python analytical modules are an oracle, not a production fallback.
- AISC: `standards/aisc360-10-verified-hi.mjs`, factor JSON/adapter and `AISC360-10-IH-PHASE-A-B-AUDIT.md`.
- Wind: `standards/asce7-10-wind.mjs`, source library JSON and `ASCE7-10-WIND-AUDIT.md`.
- Read current implementation and tests. Check branch/PR: AISC review data and F4-11 correction in PR #18 are not merged main behavior. Do not substitute the 360-05 legacy workbook for 360-10 evidence.
- Identify the exact edition/artifact hash, physical PDF page, printed page, clause/equation/table case, units, variable definitions, assumptions and branch boundaries. Do not assume another PDF has the same pagination. If source is unavailable, retain the blocked/review status and finish source-independent work.

## Verify before expanding execution

1. State one bounded mathematical change and its eligible geometry/material/load cases. List excluded cases explicitly in the engineering contract.
2. Establish independent expected values: source table/worked example or separately reviewed hand/polygon/integration calculation. Never generate expected fixtures by the production function being tested.
3. Cover branch limits, invalid/missing input, signs, units, scaling/symmetry and method-specific factors as relevant. Preserve previous regression behavior outside the changed branch.
4. Keep nominal resistance separate from ASD/LRFD factors and demand combinations. Wind pressure W is not an already-combined ASD demand. CSI force/axis conversion is a separate adapter.
5. Preserve `REVIEW_REQUIRED`, `INPUT_REQUIRED`, `not_computed` and reason fields. A calculated branch is not whole-member/building certification. Candidate OCR, equation ID or reviewer-note presence does not establish mathematical correctness.
6. For geometry/report changes, consider solver/model/schema/manifest versions and Laravel's saved-snapshot validator. Do not rewrite old results on read.

## Existing checks

From `structural-platform/frontend/vue`, `npm test` covers geometry/core/mechanics and AISC/ASCE test files. Target files include:

- `tests/geometry/aisc36010-verified-ih.test.js`, `hi-aisc36010-design-method.test.js`.
- `tests/geometry/asce710-wind.test.js`, `asce710-library.test.js`.
- `../../tests/section-properties-core.test.cjs`, `../../tests/section-mechanics-advanced.test.cjs`.

Node CLI fixtures require the shared bundle first. Use the actual branch's npm hooks/builder; isolated engine/browser/library flags are introduced by PR #19. For geometric changes also run the corresponding `engineering/tests` oracle/property-based tests and, where relevant, `tests/demo-engine-parity.cjs` with `ENGINE_PYTHON` pointing at the prepared environment.

High-risk changes need an independent check of source interpretation and expected values. Use a requested/authorized reviewer or disjoint read-only subagent when appropriate; do not create parallel competing formula implementations.

## Deliverable

Provide the source/branch coverage matrix, independent fixture derivation, numerical tolerances, checks run and remaining blocked states. Promote a rule only within demonstrated scope; no blanket “AISC/ASCE compliant” claim from partial tests. Keep private artifacts private. Main also has an intentionally public ASCE PDF; record that boundary from the audit and do not expand/change source distribution without an accepted artifact policy.
