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
