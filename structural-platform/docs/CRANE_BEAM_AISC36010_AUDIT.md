# Crane Beam — AISC 360-10, Issue #17 / draft PR #12

## Stage 1 — shared section geometry and workbook evidence

Source: user-supplied `CRANEBEAM_AISC360-10.xlsm`. The private binary is not committed.
`tests/fixtures/crane-beam/workbook.json` retains its SHA-256, exact formula text,
defined-name scopes and saved Excel values. Run:

```sh
python scripts/extract-crane-workbook.py /path/CRANEBEAM_AISC360-10.xlsm tests/fixtures/crane-beam/workbook.json
node --test tests/crane-beam-section.test.cjs
```

Extraction reads OOXML only, executes no VBA, follows no external links, and does
not recalculate Excel. Saved cell values are regression evidence, not independent
AISC verification. This upload contains **AISC360-ASD and AISC360-LRFD only**;
there is no `Summary` sheet from the earlier handoff. The cases have different
dimensions and actions; changing method alone cannot reproduce both cases.

All section numerics come from the existing Section Properties package. The
adapter composes I/H and two existing T profiles without copying A/I/S/Z formulas.
The sheet's exact participation is:

- top T clear stem = `(H − yCG − tt)/3` (`AS44`);
- bottom T clear stem = `(yCG − tb)/3` (`AS47`);
- total T depth adds the corresponding flange thickness (`AS45`, `AS48`).

This is **not one third of the entire web**. Local T coordinates are reflected
for the bottom portion; each T has its own centroid, plastic axis and r values.
Base and T geometry matches valid worksheet helper cells to relative tolerance
`1e-8` in tests. UI/store use mm powers; cm^n values are converted by `10^n`.

### Workbook discrepancies retained, not silently replicated

| Cells | Finding |
|---|---|
| `B38`, `B39` | Top-T displayed A and yc point to bottom-T `AP57/AP58`; visible in asymmetric LRFD case. |
| `B52` | Bottom-T Sy points to `AP59` (Ix), instead of `AP61` (Sy), dimensionally invalid. |
| `AY45`, `B44` | Top-T Zy contains full-web and bottom-flange terms; differs from the independent T plastic integral. |
| `BB39`, `E33` | Compare workbook torsion convention separately from shared-engine J; never overwrite the canonical J. |
| `D70`, `E79`, `AN82`, `D84` | E7 branch selection, mixed length units/radius and top-flange-only area require correction and load-path review. |
| `AQ93`, `B152`, `F104`, `E117` | F4 uses inconsistent hc/web/T depth and mm/cm terms; do not infer standard validity from saved Mn. |
| `AN240` | `IF(AN239,999999,D240)` treats both nonzero codes as true, suppressing sidesway strength. |
| `C262:C263`, `C270` | G7 limits use kv=5 despite declared 1.2; capacity ignores Cv and uses a half flange. |
| `E298` | Tension-field formula uses `AP249` flange thickness as a dimensionless Cv and ignores failed eligibility limits. |
| fatigue / biaxial blocks | No usable complete fatigue detail/history or biaxial worksheet result; independent inputs and source verification required. |

## Engineering verification gate

Geometry regression passing does not establish a member capacity PASS. Primary
AISC 360-10 / Design Guide 7 formula and applicability review, governing limit
states, stiffener/connection restraint, fatigue detail and load combination
evidence must remain separate from workbook parity. Keep PR #12 draft and global
status **NOT VERIFIED** while any required branch lacks that evidence.

The GitHub API is denied in this environment, but Issue #17 and PR #12 were read
through their GitHub HTML pages; pushes to the existing PR head update its code.
Direct AISC/Medeek PDF access is currently denied (403). No source PDF was found
in this instance's private backend storage. Do not claim a new primary-source
audit has occurred without access to the actual licensed/source documents.

## Stage 2 — calculation worksheet and explicit approval gates

The UI now follows headings 1–12 from Issue #17. Two source-case loaders explicitly
load different ASD/LRFD dimensions and actions; a method toggle alone only changes
resistance factors. Editing method/inputs clears the result and disables JSON
export until recalculation. Locale/unit changes preserve the current snapshot.
The JSON includes all three canonical calculations, formula reports, hashes,
solver versions, submitted inputs and strength traces.

| Item | Implemented calculation | Remaining gate |
|---|---|---|
| 1 | Material, geometry/fabrication, SAP X/Y actions, explicit stability/bearing/stiffener/fatigue inputs | Actual loads, concurrent wheel effects and restraints remain user/project inputs. |
| 2 | Shared I/H and two T profiles; A/I/S/Z/r/CG/PNA/J/Cw, hc/hp, mm/cm/m display, mirrored bottom coordinates | Geometry is verified separately from any code resistance. |
| 3 | Distinct axial/major/minor flange limits; singly symmetric web limit, compression-face sign | Original-edition applicability and fabrication details still require source review. |
| 4 | Top-T E3/E4/E7 numerical diagnostic incl. separate lengths and flexural-torsional coupling | **Not equivalent to Excel's flange-only assumption. Available strength is blocked by default.** Explicit top-T hypothesis selection enables only a review candidate, not approval. Source flange-only longitudinal stability model is not finalized. |
| 5 | Compression yielding, LTB, compression-flange local buckling, tension yielding and minimum; F4/F5 routing | Original AISC review and independent worked-example validation; out-of-envelope geometry is blocked. |
| 6 | Actual top-T Sy/Zy, yielding/local-buckling candidates using sheet's F6-style equations | **F6 is not asserted generally applicable to a T. DG7 split-section rule requires verification.** |
| 7 | H1-style screening from governing candidates, including both axial-ratio branches | Blocked without the explicit axial hypothesis / all governing values; candidate dependency never implies member stability approval. |
| 8 | J10 interior/end yielding, crippling including long end bearing, conditional sidesway nominal equations | **No J10 phi/Omega keys promoted without original-standard verification. Available strengths remain null.** Applicable sidesway also requires an explicitly supplied concurrent wheel-point moment; global Mx/My maxima are not silently substituted. |
| 9 | G2 three-region Cv, built-up/rolled factor distinction, kv=5 without unverified stiffener credit | Exact saved ASD/LRFD G2 parity is numerical evidence only; rolled fillets/restraints require real data. |
| 10 | kv=1.2 and separate full top/bottom flange shear candidates | Top-flange horizontal-load distribution requires DG7/shear-flow validation. |
| 11 | Explicit stress-range/allowable-range ratio after detail/cycle inputs | **No automatic detail/category/cycle-law capacity inferred from Excel constants.** Fatigue range and wheel-local effects are not recovered from force maxima. |
| 12 | Five panel inequalities, paired-stiffener rigidity diagnostic, conditional G3 nominal expression | **No available tension-field strength or D/C until G3 stiffener strength/area/attachment and anchorage are verified.** Default and failed/end panels receive no credit. |

All strength rows and global status stay **NOT VERIFIED**, including low D/C.
The existing authoritative factor registry is reused for its supported keys;
no new J10/fatigue coefficient registry was invented. Unverified higher stiffener
kv and tension-field contributions cannot increase a reported available strength.

The stiffness expression retained for source review is `a tw^3 j`, not `a h^3 j`.
The latter would replace web thickness by web depth without primary evidence.
Bottom T physical global Y equals `H_Tbottom − y_core`; the original core report
continues to describe its upper-flange local T coordinates and the export retains
the explicit reflection transform.

## Stage 3 — repeatable regression and UI validation

```sh
cd frontend/vue
npm run typecheck
npm run test:crane-beam
npm run build
```

`test:crane-beam` runs geometry/strength boundary tests and checks the deterministic
[comparison report](CRANE_BEAM_WORKBOOK_COMPARISON.md). The JSON counterpart retains
each original cell formula, saved value, normalization, code result, mismatch
reason and source hash. Regenerate deliberately with:

```sh
node ../../scripts/compare-crane-workbook.cjs
```

`tests/crane-beam-ui-smoke.cjs` exercises the production demo in Chromium: existing
picker/new tab, ordered headings, both source cases, downloaded geometry parity,
method/input invalidation, retained VI/EN snapshots, units, diagram placement,
mobile overflow and invalid-input guards. It uses the existing browser-test
dependencies and `TEST_DEMO=1` / `MODULE_BASE_URL`; no private database writes.

Validated in this instance: **22 focused Crane Beam tests**, **19 existing
Section Properties/AISC integration tests**, Vue typecheck, production build,
and Chromium checks at **320/390 px** all passed. Workbook re-extraction also
matched the committed fixture byte-for-byte. CI is configured to run the focused
regression; this report does not claim that an unobserved remote CI run passed.
The GitHub API returned Forbidden when updating PR title/body; code pushes to
the PR head succeeded, and its HTML page still showed Draft.

Before declaring the design implementation complete, obtain the actual AISC
360-10/DG7 text and review the specific blocked items above, establish the
longitudinal load path/bracing, fatigue detail/history and transverse-stiffener
attachments, and add independent worked-example benchmarks. The current work is
a reviewable calculation migration; it does **not** meet full design approval.
