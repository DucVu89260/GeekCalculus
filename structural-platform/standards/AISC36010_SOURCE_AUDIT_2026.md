# ANSI/AISC 360-10 source audit — 2026-10-16

This report compares the supplied PDF with the current symmetric I/H reference module, its factor registry, and its tests. It records source evidence and coverage limits; it does not certify the full standard.

## Source identity and page map

The audited artifact is `AISC-360-10.pdf`, *Specification for Structural Steel Buildings*, ANSI/AISC 360-10, June 22, 2010. Its SHA-256 is `f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99`. `pdfinfo` and PyMuPDF both report 612 physical pages. PDF metadata identifies the title as `AISC_PART 16_Spec.1_A:14th Ed.` and the PDF as version 1.5. The PDF contains 231 native outline bookmarks.

The PDF has no useful explicit page-label mapping: `pypdf` returns default numeric labels 1–612. The printed page footer and printed table of contents were checked against physical pages. The main specification and commentary have a measured 56-page offset: physical page 57 is printed page 16.1-1; physical page 108 is printed page 16.1-52. This mapping is evidence from the pages, not a PDF page-label assumption.

The boundary is physical page 296, printed 16.1-240, the final Specification page (`Appendix 8.2`), followed by physical page 297, printed 16.1-241, the Commentary title page. The source outline extractor's ranges (Specification 57–296, Commentary 297–608) agree with this boundary. Physical pages 1–56 are front matter; pages 609–612 are the conversion appendix and trailing pages.

| Provision | Physical PDF pages | Printed AISC pages | Source locations checked |
| --- | ---: | ---: | --- |
| B4 definitions and element dimensions | 70–71 | 16.1-14–15 | B4.1 §1; web width definitions |
| B4.1a | 72 | 16.1-16 | Table cases 1, 2, 5 |
| B4.1b | 73 | 16.1-17 | Table cases 10, 11, 13, 15; footnotes |
| E3 and E4 | 89–91 | 16.1-33–35 | E3-1–4; E4-4 and E4 definitions |
| E7 | 96–99 | 16.1-40–43 | E7-1–17, including Qs and Qa |
| F1–F2 | 102–104 | 16.1-46–48 | F1-1; F2-1–8 |
| F3 | 105 | 16.1-49 | F3 flange local buckling |
| F4 | 106–109 | 16.1-50–53 | F4-7, F4-11, F4-12 and applicability |
| F5–F6 | 110–112 | 16.1-54–56 | F5-1–10; F6-1–4 |
| G | 123–128 | 16.1-67–72 | G2-1–8; G3 tension field and stiffeners |
| H | 129–136 | 16.1-73–80 | H1-1a/b, H1-2, H2–H4 boundaries |

## Indexing audit

Before this change, running `scripts/extract_standard_outline.py` against the supplied PDF produced 231 bookmark rows: 5 front matter, 183 tagged normative, and 43 tagged commentary. Its equation-label scan produced 328 unique candidates, with first matches on physical pages 67–217. These are labels only, marked `candidate`; the script does not transcribe formulas, definitions, units, applicability, or printed-page anchors. Its regular expression does not capture appendix equation styles such as `(1-1)`, and it does not produce a full clause index.

The native PDF outline is incomplete for the normative chapters after I. It points to commentary text for its J–N chapter entries: for example, normative Chapter J begins at physical 161 / printed 16.1-105, while the `CHAP J` bookmark points to physical 439 / printed 16.1-383, the Commentary's Chapter J. The corresponding normative/commentary pairs are K 196/480, L 219/495, M 221/501, and N 226/506. The previous extractor imported these native bookmark destinations unchanged, so its rows could not be described as the complete normative TOC. The printed contents pages and chapter headings need to be cross-checked when indexing J–N and appendices.

The revised extractor scans measured content headings and separates normative/commentary source contexts. The real private import now contains **787 heading/anchor rows** (448 normative, 334 commentary, 5 other), **508 equation identifier candidates** (385 normative, 123 commentary, including appendix identifiers), and **26 table candidates**. Its 612-page map reads printed labels from page furniture and recovers the normative J–N destinations listed above. Candidate counts include reference-only identifiers; they do not establish full transcription or complete heading recall.

No source PDF, page image, or page-text extract was added to the repository. Temporary renders and text extracts used for this audit were kept under `/tmp`.

## Engineering source comparison

The inspected implementation is `aisc360-10-verified-hi.mjs`; it contains 47 `FORMULAS` registry entries, including grouped entries. The registry records clause labels and short expressions/conditions, but no PDF physical page, printed page, symbol definitions, units, or explicit per-record verification status. The audited test suite currently has 10 cases in `aisc36010-verified-ih.test.js` and 6 in `hi-aisc36010-design-method.test.js`. Existing F5 coverage checks the Rpg expression against a duplicate calculation; it does not independently check F4-11's effective radius or a published worked result.

| Area | Source comparison | Current implementation/coverage |
| --- | --- | --- |
| B4.1a | Table cases 1, 2, and 5 use 0.56√(E/Fy), 0.64√(kcE/Fy), and 1.49√(E/Fy). | Values and rolled/built-up distinction match. Built-up `h` is modeled as clear welded-plate web depth; bolted fastener-line spacing is not an input. Rolled fillet/corner dimensions are approximated and warned about. |
| B4.1b | Cases 10, 11, 13, and 15 match the recorded compact/noncompact/slender limits. For symmetric built-up I, the case 11 assumption `FL = 0.7Fy` is valid because `Sxt/Sxc = 1`. | Recorded values match for the represented doubly symmetric I geometry. The data model does not support singly symmetric I, even though some source cases do. |
| E3/E4 | E3-1–4 and E4-4 match the source forms for flexural and doubly symmetric torsional buckling. | Separate x/y Euler values and an E4 torsional candidate are calculated. The formula scope is the represented doubly symmetric I/H member; required K/L/G and section torsion inputs are fail-closed. |
| E7 | E7-1–3, E7-4–9, E7-16, and E7-17 match the source expressions and branch limits for the supported rolled/built-up flange and stiffened web cases. | Formula transcription spot-checks match. Existing tests do not compare Qs/Qa/Fcr against an independent AISC worked example. |
| F1/F2/F3/F6 | F1-1, F2-1–8, F3-1/2, and F6-1–4 match the source equations for a doubly symmetric I member, with `c=1` in F2. | Implemented branches align with the source; F2/F3 require a compact web, and F4 noncompact-web strength is deliberately blocked for review. |
| F4/F5 | Source F4-11 and F4-12 govern the F5 effective radius and `aw`; F5-1–9 are used for the slender-web branch. | F4-11 had a geometry substitution defect: the source uses web clear dimension `h²`, but the code used overall depth `d²`. This was corrected in the current worktree to use `hc²`, where `hc` is the represented clear web depth. For the supported symmetric welded I geometry, B4.1 §1b gives `h = clear distance between flanges`, and `h = hc = d−2tf`. Rolled profiles and built-up bolted webs remain outside this source-verified F5 geometry model. |
| G | G2-1–8 and G3 require web shear, shear buckling, stiffener, and tension-field checks; G2.1(a) provides the rolled-I exception `φv=1.00`, `Ωv=1.50`, `Cv=1.0` under its h/tw criterion. | The member engine does not calculate G2/G3. The factor registry contains generic and G2.1(a) factors; its rolled selector derives clear web height from sharp-corner dimensions and cannot account for rolled fillets, so the selected exception is only reliable with verified h/tw geometry. |
| H | H1-1a/b match the source interaction forms and 0.2 axial ratio split. H1-2 is a special permissible alternative for doubly symmetric rolled compact members under the conditions on printed page 16.1-75. | H1-1a/b are implemented for completed compression and biaxial flexural strengths. Tension blocks pending D2/D3. H1-2 is not implemented; H1-1 remains the implemented interaction route. H2–H4 are out of scope. |

### F4-11 independent benchmark

The source image on physical page 108 / printed 16.1-52 shows:

`rt = bfc / sqrt(12 [ho/d + (1/6) aw h²/(ho d)])` (F4-11), and `aw = hc tw/(bfc tfc)` (F4-12).

B4.1 §1b on physical page 71 / printed 16.1-15 defines built-up web `h` as the distance between fastener lines, or the clear distance between flanges where welds are used. The represented fixture is a sharp-corner welded built-up I section, so `h = hc = d - 2tf = 768 mm`.

The first regression fixture is formula-level only: the member engine receives canonical section properties separately from the geometric dimensions, and the test manually supplies `A=12,000 mm²`, `Ix=1.5×10⁹ mm⁴`, and `Sx=3.75×10⁶ mm³` among its canonical values. Those values are not derived from the displayed rectangular-plate geometry. This fixture isolates the F4/F5 equation response at a known `Sx`; it does not validate section-property consistency. Its E7 comparison likewise uses the supplied canonical-property fixture rather than a geometry-derived section.

Independent hand calculation from F4-11/F4-12 and F5-3/F5-4 for that formula-level fixture (`d=800`, `bf=250`, `tf=16`, `tw=5 mm`, `E=200000`, `Fy=345 MPa`, `Sx=3.75×10⁶ mm³`, `aw=0.96`, `Cb=1`):

| Result | Source equation using h² | Prior code using d² |
| --- | ---: | ---: |
| `rt` | 67.876707 mm | 67.495664 mm |
| `Lp` (F4-7) | 1797.707 mm | 1787.615 mm |
| `Lr` (F5-5) | 6136.589 mm | 6102.140 mm |
| `Fcr`, `Lb=3000 mm` (F5-3) | 316.320420 MPa | 315.916419 MPa |
| `Mn`, `Lb=3000 mm` | 1173.681310 kN·m | 1172.182297 kN·m |
| LRFD `φbMn`, `Lb=3000 mm` | 1056.313179 kN·m | 1054.964068 kN·m |
| ASD `Mn/Ωb`, `Lb=3000 mm` | 702.803180 kN·m | 701.905567 kN·m |
| `Fcr`, `Lb=8000 mm` (F5-4) | 142.099091 MPa | 140.508149 MPa |
| `Mn`, `Lb=8000 mm` | 527.247174 kN·m | 521.344114 kN·m |
| LRFD `φbMn`, `Lb=8000 mm` | 474.522457 kN·m | 469.209702 kN·m |
| ASD `Mn/Ωb`, `Lb=8000 mm` | 315.716871 kN·m | 312.182104 kN·m |

### Physically consistent welded-I section-property cross-check

A second, separate benchmark derives the sharp-corner welded-I canonical properties directly from rectangle hand formulas for the same dimensions (`d=800`, `bf=250`, `tf=16`, `tw=5 mm`, `hw=h=hc=768 mm`). The source geometry and F4-11 inputs therefore use the same section. The derived values are `A=11,840 mm²`, `Ix=1,418,226,346.666667 mm⁴`, `Iy=41,674,666.666667 mm⁴`, `Sx=3,545,565.866667 mm³`, `Sy=333,397.333333 mm³`, `Zx=3,873,280 mm³`, `Zy=504,800 mm³`, `rx=346.096274 mm`, and `ry=59.328069 mm`. The cross-check omits `J` and `Cw`, so compression/E4 is intentionally not part of this benchmark.

With `E=200,000 MPa`, `Fy=345 MPa`, `aw=0.96`, and `Cb=1`, independent calculations from F4-11, F4-12, F4-7, F5-5, F5-6, and F5-3/F5-4 give `rt=67.876707 mm`, `Lp=1,797.706968 mm`, `Lr=6,136.589455 mm`, and `Rpg=0.989445079`. The new test checks both lateral-torsional buckling branches and method conversions against these hard-coded constants:

| Result | `Lb=3000 mm` (F5-3) | `Lb=8000 mm` (F5-4) |
| --- | ---: | ---: |
| `Fcr` | 316.320420 MPa | 142.099091 MPa |
| Nominal `Mn` | 1109.697171 kN·m | 498.503889 kN·m |
| LRFD `φbMn` | 998.727454 kN·m | 448.653500 kN·m |
| ASD `Mn/Ωb` | 664.489324 kN·m | 298.505323 kN·m |

The focused test hard-codes independent expected values for both the formula-level fixture and this geometry-derived section fixture. It also checks the formula-level E7 compression result: `Pn=2106.052107 kN`, LRFD `1895.446896 kN`, and ASD `1261.109046 kN`. These are test references calculated from the cited provisions, not published AISC design-example values. The focused test passed under Node 24 during this audit.

## Resistance factors and verification status

The factor registry has six keys. The values inspected against the edition are: flexure and compression `φ=0.90`, `Ω=1.67`; gross tension `0.90/1.67`; net-section rupture `0.75/2.00`; general shear `0.90/1.67`; and rolled-I G2.1(a) shear `1.00/1.50`. The edition values and method application in `aisc360-10-resistance.ts` match the source provisions checked. The registry's source URL points to a third-party copy, and its factor rows do not carry physical/printed PDF page anchors. The G2.1(a) selector still needs verified rolled `h` dimensions before an engineering calculation can rely on the exception.

The module leaves `overall_status` as `REVIEW_REQUIRED`, blocks F4 noncompact-web strength, blocks tension without the required D2/D3 connection/net-section inputs, and does not calculate G shear/stiffener/TFA checks. These are appropriate coverage barriers. The related presentation defect was corrected: `classification.flexureChapter` now labels a noncompact web as F4. A regression verifies this label and the unchanged `REVIEW_REQUIRED` calculation barrier; no F4 strength solver was introduced.

No complete-standard verification is claimed. Source equations were visually checked against the PDF for the clauses listed above; independent published design-example validation for the implemented branches remains outstanding.

## Executed verification

Node 24 mathematical regression suite: **84 passed** (including three source-errata tests). Python synthetic source-index suite: **8 passed**. The PostgreSQL-backed private reader smoke passed with the actual source: E3 math rendering, F4-11 at physical 108 / printed 16.1-52, exact source SHA, authentication denial, notes/review UI, mobile layout and no draft execution. See the implementation coverage report for final backend test counts and remaining approval work.
