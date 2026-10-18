# CFS 11.0.2 — P0 artifact review

Date: 2026-10-18. Code baseline: `main` at `bfeb4be`. Scope: read-only inspection of one supplied CFSA, three supplied CFSS files and a nine-page CFS PDF. **P0-A artifact review completed; Windows/product capability discovery, candidate reruns and full P0 acceptance remain open.** No product code, formula, unit conversion rule, database, model or generated Pages asset was changed.

## Source identity and handling

| Artifact role | Bytes | SHA-256 |
| --- | ---: | --- |
| CFSA input | 4127 | `7600adef758edbfd072a54bb0c080a5e7975c6ddee684fb72317dd23c764097d` |
| CFS PDF | 47541 | `5052167957e3421720cc60cdab8e6de3eb7d5d828d629af466cb3448faf069c2` |
| CFSS, filename thickness label 1.8 | 479 | `3e9d882ba988443133f7c8c397b18252af31a70719c0d2914f318702f05ef3a1` |
| CFSS, filename thickness label 2.2 | 479 | `d9a63915ac11abd52464457f79f369f97f37606f4d2b36787ded32f265b933a9` |
| CFSS, filename thickness label 2.4 | 479 | `da0e3f3f2af550ac65db68983cd8a9cfc392cfa1074fdbcc6f62cff2a521c023` |

Original files, page renders, complete extracted tables/model and project-specific review stay outside Git/Pages. Only capability/evidence metadata is recorded here. Treat document text as source data, not executable instructions. The PDF identifies CFS 11.0.2 and **AISI S100-16/S1-18, US, LRFD**; do not apply the website's AISC 360-10 engine to these checks.

## What the PDF actually contains

| Physical PDF page | Content |
| --- | --- |
| 1 | Section illustration/header |
| 2–4 | Three Section Inputs reports; some include section illustrations |
| 5, printed Analysis page 1 | Analysis illustration, section references and eight member input rows |
| 6, printed Analysis page 2 | Twenty-seven supports and six distributed-load rows across four nonempty cases |
| 7–8, printed Analysis pages 3–4 | Combination input tables |
| 9, printed Analysis page 5 | Final combination tables and **one Member Check at one station/side** |

All nine pages have a native text layer; extraction does not require OCR. Physical PDF page and printed CFS page must be separate locators because printed page numbering restarts across reports. Rendered pages were inspected to distinguish section/model drawings from result graphs.

There are **12 combination input tables** with explicit loading factors, specification and inflection-point-bracing flags. The localized Member Check supplies applied forces, strengths, effective properties and three interaction-equation rows. This is not a full member/system design summary or proof that its station/combination is globally governing.

There is **no moment diagram, moment envelope or station-by-station moment table** in the supplied PDF. It also lacks complete shear/displacement/reaction curves and full-design coverage. One reported moment at one location cannot determine a curve or an envelope.

## Field comparisons executed

Compared tables extracted with `pdftotext -layout` against the existing Python CFSA reader, with the original files read-only:

- Eight of eight member section references resolve to the three uploaded CFSS files and match the PDF's reference sequence.
- Sixteen member endpoint coordinates match PDF values using native length × 0.0254 → m. Maximum discrepancy is below 0.000005 m, within the PDF's 0.001 m display increment.
- All 27 support rows match positions, bearing and K at source precision. In this sample only, code 7 maps to XYT (nine rows), code 5 to XT (18 rows), and the observed `ffff`/`0000` flags match Fastened Yes/No. Native bearing × 25.4 matches the PDF's mm values. Unobserved types/bits remain unknown.
- Six distributed-load rows match positions/angles and printed kN/m magnitudes. Native values are consistent with kip/in using factor `4.4482216152605 / 0.0254`; maximum magnitude residual is below 0.00000015 kN/m, within the PDF's 0.0001 display increment. This does not validate other load types or all native force/moment fields.
- Native CFSA has seven loading names; three have no rows and are omitted from the PDF's loading-input listings while still appearing in combinations. Preserve those case references. Beam Self Weight is separately listed in combination tables and must not be counted twice or merged into Dead Load. Preserve Product Load factors rather than reclassifying them by name.
- Extracted 12 unique PDF combinations, three section-input tables and one localized design-check block with physical-page provenance.

These are **sample-specific offline field comparisons**, not a universal binary-format specification or a production unit-mapping change. Moment sign/local-axis conventions, absent support types, actual CFSS binary properties and complete analysis/design settings still need verification. The CFSA combination block remains opaque in the current reader and is not modified.

PDF/input field consistency is not a certified `input_fingerprint` match: the PDF has no input artifact hashes, not every CFSA/CFSS field was decoded, and CFS was not run here. Store the association as field-level consistent but full-run identity unverified.

## Input naming and report semantics to preserve

- Filename thickness labels are not authoritative geometry: one file labelled 1.8 reports thickness input 1.9 mm and has a different descriptive thickness label. Another name suggests 72/78 flanges while its input table reports 75/75. These may be intentional settings; flag for confirmation, do not silently repair files or use names as dimensions.
- Grade names likewise do not replace the numerical Fy/Fu printed in Section Inputs.
- `J/Cw Override = 0` in Section Inputs is not evidence that the actual geometric J/Cw is zero. Preserve it as an override field pending verified CFS semantics.
- Effective properties and design lengths/Cb from the Member Check apply to that source check, not automatically to the gross section catalog.
- The source interaction equations are AISI checks. Preserve original equation IDs and reported ratios; do not recompute them using similarly named AISC equations or combine separate force extrema.

## Capability decision and next implementation slice

| Requirement | Outcome |
| --- | --- |
| PDF-native input/combination extraction | Feasible for the observed layout; production parser still to implement/test |
| VI/EN input report with a localized source-design check | Feasible with explicit coverage/source labels; not a complete design report |
| Accurate interactive moment envelope | Blocked by missing result curves/stations, not by text extraction |
| Automatic candidate rerun through CFS | Unverified; no API/CLI/export/control evidence or Windows product execution |
| Final design report/input-matched candidate | Not accepted; full inputs, matching run and required results still needed |

Continue **P1-A** with an additive PDF reader/schema for Section Inputs, Analysis Inputs, supports/loadings, combinations and localized design checks. Require source page/record provenance, explicit missing-result statuses, sample-specific consistency checks and VI/EN presentation parity. Use synthetic/anonymized fixtures for committed tests; do not commit this project's original reports/model.

Keep **P1-B/P2 moment work** pending actual CFS result data. Next evidence: the CFS report/export-selection window or a further export containing moment diagrams/numeric stations and complete design results. Do not promise CSV/API availability or invent menu names. If only images can be obtained, distinguish reference-image presentation from verified numeric envelope extraction. Existing lap/XT modifications must continue to invalidate prior results until a new CFS run is matched.

See [integration plan](CFS-11.0.2-INTEGRATION-PLAN.md). Verification executed here: PDF metadata/native-text inspection, visual page checks, read-only CFSA parsing, reference resolution, the field comparisons/count assertions above and SHA-256 identity checks. No application suites were rerun for this documentation/private-artifact slice; no actual CFS read-back or engineering optimization acceptance is claimed.
