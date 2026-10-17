# Standards and design-rule scope

Inherits [root instructions](../../AGENTS.md). Read the matching audit, [the architecture](../../context/ARCHITECTURE.md) and [engineering validation skill](../../.agents/skills/engineering-rule-validation/SKILL.md).

- AISC member rules: `aisc360-10-verified-hi.mjs`; factors: `aisc360-10-strength-factors.json` via `aisc360-10-resistance.ts`. The legacy workbook reference is 360-05, not an independent 360-10 authority.
- ASCE wind rules: `asce7-10-wind.mjs`; source index: `asce7-10-library.json`. Chapter 27 Phase A is partial, and global `REVIEW_REQUIRED` remains.
- Distinguish engineering implementation, candidate source extraction, formula transcription and approval. Full PDF/page counts or a green parser test do not prove full design coverage.
- Keep edition-specific factors and applicability. Do not insert later-edition coefficients or convert wind demand/ASD/LRFD combinations silently.
- Every changed branch needs source artifact identity/page/conditions/units plus independently established expected results and boundary/rejection tests. Preserve missing-input and unsupported branches; no whole-member/building PASS without all applicable checks.
- Keep private source artifacts/full extracted text/images outside public Git/Pages. Main intentionally includes a public static ASCE PDF; see the audit before claiming private-only distribution or changing that behavior. Do not add more public originals by default or remove existing ones without a scoped distribution decision. Personal notes do not change approved rules.
- PR #18 adds AISC source/review/versioning structures but conflicts with the ASCE corpus work already on main. Inspect both before editing importers, registry routes or shared reader components. Do not replace the ASCE implementation wholesale to resolve a conflict.
