# Symmetric I/H — AISC 360-10 source and member-strength review

Review date: 2026-10-17. Branch: `feature/aisc36010-formula-digitization`, continuing Draft PR #21 from `e64faa3`. The uploaded source replaced the earlier cloud-source blocker. Four Luna max tasks independently covered source/tension/stability review, F4, Chapter G/stiffeners, and UI integration. Root integrated the contracts and independently checked critical page images and hand fixtures.

## Source identity and review boundary

Actual attachment: ANSI/AISC 360-10, June 22, 2010, Specification and Commentary; 4,908,523 bytes; 612 physical pages; SHA-256 `f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99`. This matches the inherited artifact-specific draft registry. The source PDF, page images and complete text remain private and are excluded from Git/Pages.

| Rule family | Physical PDF / printed Specification pages | Review and implementation |
| --- | --- | --- |
| B4 classifications / B4.3b | 72–74 / 16.1-16–18 | Separate axial/major/minor classifications; nominal round-hole dimension plus 2 mm; declared critical straight path |
| C1–C3 | 76–81 / 16.1-20–25 | External Direct Analysis prerequisites and independent restraint lengths, explicit load basis and scoped compliance gates |
| D2 / D3 | 82–84 / 16.1-26–28 | Gross yield, effective-net rupture, Table D3.1 cases 1 and 2; separate ASD/LRFD factors |
| E3 / E4 / E7 | 89–91, 96–99 / 16.1-33–35, 40–43 | Independent flexural/torsional buckling; effective area; low-stress full-width E7-17 applicability |
| F1–F6 | 102–115 / 16.1-46–59 | Cb fixed at 1; F2/F3/F5/F6 source comparison; new noncompact-web F4 implementation |
| F13.1 / F13.2 | 120–121 / 16.1-64–65 | Flange-hole rupture cap and slender-web proportion limits |
| G1/G2/G3/G7 | 123–128 / 16.1-67–72 | Web and flange shear, G2.2 stiffener rigidity, opt-in G3 tension-field action with adjacent-panel checks |
| H1 / H4 | 129–131, 135–136 / 16.1-73–75, 79–80 | Complete applicable strength inputs, signed flange-hole axial/major bending interaction |

The code exposes 79 equation/table navigation records with exact-artifact page links. This is **not** 79 approved database equations. Actual-source CLI indexing produced 508 equation occurrences (385 normative, 123 commentary) and conservative E/F extraction produced 133 candidates. Neither operation promotes an equation. No application DB migration, source import, review approval or publication was executed in this slice; no approved DB count is inferred from code or extraction. Existing content-bound admin review remains the route to `verified`/`published`. Typed member rules never evaluate draft database LaTeX.

E3-2 was visually compared on physical page 89: `Fcr=[0.658^(Fy/Fe)]Fy`, applicable for `Fy/Fe ≤ 2.25`; E3-3 gives `0.877Fe` above that boundary. E3-4 uses each axis's own `KL/r`. Rendering tests exercise the transcribed draft; this source comparison does not forge an admin approval event.

## Screenshot warnings: resulting behavior

| Original warning | Current behavior |
| --- | --- |
| LEGACY_EDITION | Primary calculation is AISC 360-10 using canonical Section Properties. Excel 360-05 runs only when explicitly selected as a historical comparison. Primary export contains no legacy capacities. |
| LEGACY_CB | Production Cb is fixed at 1; signed spreadsheet stations are unused. Moment-diagram/SAP integration is deferred. |
| LEGACY_WEAK_AXIS_FE | `Fex=π²E/(Kx Lx/rx)²` and `Fey=π²E/(Ky Ly/ry)²` are independent. E4 uses shared J/Cw and its own Kz/Lz. Built-up/E7 applicability is not dropped merely because Lz≤Ly. |
| INCOMPLETE_TENSION | Top/bottom/web round-hole counts and nominal hole diameters establish An after explicit path confirmation. Fu and supported D3 transfer data establish Ae; D2 checks both gross yield and rupture. F13/H4 also apply at holed flanges. |
| STIFFENER_PARITY_ONLY | Chapter G replaces the workbook area formula. G2.2 rigidity, G3 slenderness/rigidity, boundary conditions and ASD/LRFD factors are checked explicitly. |
| NO_GLOBAL_PASS | Member Compliance shows PASS, FAIL or REVIEW_REQUIRED within a declared member-strength scope. Incomplete applicable checks or external-analysis declarations block PASS. |
| LOAD_COMBINATION_METHOD | Independent manual ASD/LRFD load-basis selection must match the design method. Selecting a method never rescales entered forces. Disabled SAP2000 API button marks the future adapter. |
| STIFFENER_REVIEW | Verified stiffener geometry/attachment is required for stiffened kv and G3 credit. Missing or failed G3 gates retain G2 resistance. End/bearing stiffeners and J10 are separate checks. |

## Inputs, dimensions and engineering rules

Canonical units: mm, MPa, kN, kN·m. Geometric properties come from the shared TypeScript Section Properties package. The strength modules contain no second overall geometry solver.

- Geometry: `d=h_mm` overall height, `bf`, `tf`, `tw`; clear web `h=hc=d−2tf`, flange-centroid distance `ho=d−tf` for welded rectangular plates. Rolled clear height excludes fillets and needs verification; full rolled-member approval remains blocked by the sharp-corner geometry model.
- Lengths: `Lx` and `Ly` are actual lateral restraint lengths for the corresponding compression buckling axes; `Lz` is torsional restraint length; `Lb` is lateral/twist restraint length of the compression flange. They are independent and are not copied from each other. C3's supported Direct Analysis path fixes Kx=Ky=Kz=1, E=200000 MPa and G=77200 MPa. It does not make Lb equal the member length or eliminate LTB.
- Direct Analysis: external analysis must include the C2 second-order response and all relevant deformations, individual-member P-δ, destabilizing loads, imperfections/notional loads, prescribed stiffness reductions and actual bracing. ASD requires analysis at 1.6 times ASD combinations and division of results by 1.6. The calculator records declarations/evidence; it does not perform the frame analysis or this scaling. Nominal member resistance E/G are not reduced a second time.
- Net area: `An=Ag−Σn(dhole+2)t`. Counts are explicit nonnegative integers. Critical paths must be confirmed. Table D3.1 case 1 uses U=1 only for all-element load transfer. Supported partial longitudinal transfer uses `U=max(1−x̄/l,Ag,connected/Ag)` with explicit proper-subset connected elements, l and x̄. Slots, stagger and other connection types remain review-required.
- D2: take `min(φy Fy Ag, φu Fu Ae)` for LRFD, or `min(Fy Ag/Ωy, Fu Ae/Ωu)` for ASD. Yield factors .90/1.67 differ from rupture .75/2.00; factoring the minimum nominal resistance with a single factor is wrong.
- F13: for a holed tension flange with `Fu Afn < Yt Fy Afg`, cap `Mn` at `Fu Afn Sx/Afg`. Yt=1 or 1.1 is used in the applicability threshold, **not** as an extra denominator in F13-1. Positive Mx puts the bottom flange in tension. Unholed flanges receive no artificial rupture cap.
- H4: each holed flange in tension is checked using signed axial force and major-axis moment; net rupture Pc and F13 Mcx. H4-1 supplies no minor-axis term. Flange holes with My≠0 remain REVIEW_REQUIRED rather than silently omitting the interaction.
- F4: `rt=bfc/sqrt(12[ho/d+(aw/6)h²/(ho d)])`. Here h is the clear web height, not overall d. New F4 evaluates yielding, LTB and flange local buckling and reports their minimum. See the [F4 review](AISC36010_IH_FLEXURE_REVIEW.md).
- G2: web shear uses `Aw=d tw`; slenderness uses clear h/tw. G2-4 ends at `1.37√(kvE/Fy)`, not `1.37×1.10√(kvE/Fy)`. General shear .90/1.67 and rolled G2.1(a) 1.00/1.50 remain distinct. G7 sums both flange elements using b=bf/2 and explicit zero torsion.
- Stiffeners: bs is clear outstand, ts is thickness along the member. Paired plates use the web-center axis; a single plate uses its contact-face axis. Other profiles require supplied inertia and explicit source-axis verification. TFA is opt-in; current/adjacent panel eligibility, two boundary stiffeners, attachment, b/t and G3.4 interpolation must all pass. See the [Chapter G review](AISC36010_IH_SHEAR_REVIEW.md).

Formula expressions, applicability, source pages and numerical traces are included in the primary review/report and exported result. Dirty input invalidates results and prior confirmations. Imported confirmations are always reset; an imported JSON cannot assert engineering approval.

## Independent numerical acceptance

Expected results were established separately from production functions. Browser checks use the actual shared geometry package and the fixed expected strengths below.

### D2/F13/H4

Welded I: d300, bf150, tf12, tw8; Fy345/Fu450. Two nominal Ø22 holes in each flange and web; straight path; U=1. Plate integration gives Ag=5808 mm², An=Ae=4272 mm², Sx=591394.56 mm³, Zx=670752 mm³, Afg=1800 mm², Afn=1224 mm².

| Result | Hand value |
| --- | --- |
| Gross tensile nominal | 2003.76 kN |
| Net rupture nominal | 1922.4 kN |
| Available tension LRFD / ASD | 1441.8 / 961.2 kN |
| F13 nominal major moment | 180.96673536 kN·m |
| LRFD N=200 kN, Mx=100 kN·m, My=0 | H1=0.683344011145367; H4=0.752701763937641 |
| ASD N=130 kN, Mx=70 kN·m, My=0 | H1=0.713599287282567; H4=0.781223131429049 |

Both browser fixtures give scoped PASS **only after** explicit analysis, critical-path, envelope and separate-limit-state confirmations. Missing/imported acknowledgments give REVIEW_REQUIRED; overload gives FAIL.

### Independent compression axes / E7

Welded I d600, bf200, tf6, tw4; Ag4752, Ix279474624, Iy8003136 mm⁴; J40745.684 mm⁴, Cw705948623424 mm⁶; Fy345, E200000, G77200; K=1; Lx6000, Ly4000, Lz5000 mm. Independently calculated Fex≈3224.729, Fey≈207.775, Fez≈204.833 MPa; Qs≈0.657391, Qa≈0.708936; nominal compression≈550.098 kN; LRFD≈495.089 kN; ASD≈329.400 kN. Relative tolerance 1e−5 on rounded hand values. A long-column regression verifies E7-17's full-width applicability without negative effective widths.

F4 has independent short/intermediate/long Lb fixtures and web/flange boundaries. Chapter G has independent buckling branches, method factors, inertia, TFA and neighboring-panel benchmarks. Their detailed values are in the linked family reports. The all-suite count below includes those tests; do not sum them twice.

## Executed checks and limits

| Check | This slice |
| --- | --- |
| Complete Node suite / npm test | 145 passed, zero failed/skipped |
| New focused families within that suite | F4: 8; Chapter G: 18; tension/stability/compliance: 11 |
| Vue typecheck | Passed |
| Native and demo production builds | Passed; existing large PDF-reader chunk warning remains |
| Primary I/H browser | Passed independent D2/F13/H4 LRFD/ASD values, scoped compliance, separate Euler axes, Cb=1, export, stale-input, legacy isolation, mobile |
| Member-compliance UI browser | Passed declarations, optional inputs, import reset, no automatic force scaling, source hash/page links, mobile |
| Bilingual legacy browser | Passed EN/VI numeric/dirty/validation/import/export/report/mobile/fresh-build parity |
| Standards Explorer ordinary/admin browser | Passed exact SHA/page deep links, missing-hash/out-of-range refusal; synthetic API/PDF fixtures. Admin upload regression also passed |
| Actual source CLI index / E/F extraction | Executed on supplied PDF: 508 occurrences / 133 candidates; no status promotion |
| Laravel / Python synthetic suites | Earlier branch evidence retained; not rerun for this numerical/UI slice with no backend/extractor change |
| Application DB migration/import/approval | Not executed; preserves user data |

Scope remains limited to static, prismatic, continuously welded, doubly symmetric I/H rectangular plates, supported straight round-hole paths/D3 cases, explicit zero torsion and all required external declarations. Catalogue-accurate rolled profiles, bolted built-up member E6, stagger/slots, biaxial flange-hole interaction, torsion, bearing/end stiffeners, J10, connection J3/J4/block shear, fatigue, serviceability and the actual frame/brace design are not silently certified. They must be separately verified/inapplicable or remain explicit blockers as appropriate. SAP2000 and Cb APIs remain pending. No automatic merge or public source publication is authorized by a green numerical test.
