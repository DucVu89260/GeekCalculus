# Crane Beam — Excel ASD/LRFD comparison

Source SHA-256: `a47d55dc165f905dc8720be62328fae66728d13ddef2e949c33cbfcfffec52c8`.

**NOT VERIFIED for design.** MATCH is numerical parity with saved Excel cache, not AISC approval. Different cells are retained with explanations; no global PASS is inferred.

- Excel cached values were not recalculated and VBA was not run. No Summary sheet exists in this upload.
- Workbook D9 is CLEAR web depth; UI H = D9 + F9 + I9. Exact T stems use one third of clear flange-to-CG distance.
- Extra KLx/KLy/KLz assumed equal worksheet H12 only to supply a reproducible demonstration; actual top-T bracing lengths require engineer input.
- Interior end distance assumed 2H to match J10-2/E222 worksheet assumption; actual end distance is not present in source.
- WLmax uses H244 impacted wheel effect directly. SAP actions / longitudinal N use each sheet saved values; method switching does not convert them.
- Worksheet does not establish physical bracing, paired stiffener sizes, end-panel anchorage or fatigue category/history. Defaults remain explicit assumptions.

## ASD — 32 matching, 5 differences, 2 blocked

| Property | Cell | Excel (canonical) | Code | Comparison | Note |
|---|---|---:|---:|---|---|
| A | AISC360-ASD!B27 | 9008 | 9008 | MATCH |  |
| Ix | AISC360-ASD!B28 | 261326250.7 | 261326250.7 | MATCH |  |
| Iy | AISC360-ASD!B29 | 31266042.67 | 31266042.67 | MATCH |  |
| Sx.top | AISC360-ASD!B30 | 1306631.253 | 1306631.253 | MATCH |  |
| Sx.bottom | AISC360-ASD!B31 | 1306631.253 | 1306631.253 | MATCH |  |
| Sy.top-flange | AISC360-ASD!B32 | 250128.3413 | 250128.3413 | MATCH |  |
| Sy.bottom-flange | AISC360-ASD!B33 | 250128.3413 | 250128.3413 | MATCH |  |
| rx | AISC360-ASD!B34 | 170.3245813 | 170.3245813 | MATCH |  |
| ry | AISC360-ASD!B35 | 58.91450992 | 58.91450992 | MATCH |  |
| Zx | AISC360-ASD!B36 | 1446752 | 1446752 | MATCH |  |
| Zy | AISC360-ASD!E36 | 381016 | 381016 | MATCH |  |
| yCG | AISC360-ASD!H36 | 200 | 200 | MATCH |  |
| yPNA | AISC360-ASD!E35 | 200 | 200 | MATCH |  |
| hc.top | AISC360-ASD!H34 | 376 | 376 | MATCH |  |
| hp.top | AISC360-ASD!H35 | 376 | 376 | MATCH |  |
| J | AISC360-ASD!E33 | 354218.6667 | 354218.6667 | MATCH |  |
| Cw | AISC360-ASD!E34 | 1176125000000 | 1176125000000 | MATCH |  |
| topT.A | AISC360-ASD!AP51 | 3501.333333 | 3501.333333 | MATCH |  |
| topT.yc.outer | AISC360-ASD!AP52 | 11.34551917 | 11.34551917 | MATCH |  |
| topT.Ix | AISC360-ASD!AP53 | 798764.122 | 798764.122 | MATCH |  |
| topT.Iy | AISC360-ASD!AP54 | 15627673.78 | 15627673.78 | MATCH |  |
| topT.Sy | AISC360-ASD!AP55 | 125021.3902 | 125021.3902 | MATCH |  |
| bottomT.A | AISC360-ASD!AP57 | 3501.333333 | 3501.333333 | MATCH |  |
| bottomT.yc.outer | AISC360-ASD!AP58 | 11.34551917 | 11.34551917 | MATCH |  |
| bottomT.Ix | AISC360-ASD!AP59 | 798764.122 | 798764.122 | MATCH |  |
| bottomT.Iy | AISC360-ASD!AP60 | 15627673.78 | 15627673.78 | MATCH |  |
| bottomT.Sy | AISC360-ASD!AP61 | 125021.3902 | 125021.3902 | MATCH |  |
| topT.A.displayed | AISC360-ASD!B38 | 3501.333333 | 3501.333333 | MATCH | B38 incorrectly references bottom AP57. |
| topT.yc.displayed | AISC360-ASD!B39 | 11.34551917 | 11.34551917 | MATCH | B39 incorrectly references bottom AP58. |
| topT.Zy | AISC360-ASD!B44 | 96758 | 188502.6667 | DIFF_REQUIRES_REVIEW | Workbook AY45 is not the full top-T plastic integral; use the shared T solver. |
| bottomT.Sy.displayed | AISC360-ASD!B52 | 798764.122 | 125021.3902 | DIFF_REQUIRES_REVIEW | B52 refers to Ix AP59, not Sy AP61. |
| compression_top_t | AISC360-ASD!D84 | 13977.91798 | — | BLOCKED | Top-T E4/E7, correct units and independent KLx/KLy/KLz differ from flawed worksheet E79/Q/area model. |
| major_governing | AISC360-ASD!D176 | 93.26187765 | 129.7878493 | DIFF_REQUIRES_REVIEW | Corrected dimensions/λpw, FL, Lr and LTB. Slender LRFD web uses F5 rather than blindly retaining F4. |
| minor_governing | AISC360-ASD!H199 | 19.85892854 | 37.52181478 | DIFF_REQUIRES_REVIEW | Correct top-T Zy; DG7/F6 applicability remains pending. |
| shear_g2 | AISC360-ASD!C257 | 396.6467066 | 396.6467066 | MATCH | Valid workbook G2 case; no tension-field credit. |
| shear_g7_top | AISC360-ASD!C270 | 185.9281437 | 371.8562874 | DIFF_REQUIRES_REVIEW | Top horizontal shear assigned to a full top flange with kv=1.2, not a half-flange shortcut. |
| tension_field_candidate | AISC360-ASD!E298 | 437.7735445 | — | BLOCKED | No credit if geometric/stiffener/end-panel gates fail. Excel uses flange thickness where Cv is required. |
| J10.yield.nominal | AISC360-ASD!C213 | 303.6 | 303.6 | MATCH | Saved available Excel value is normalized to nominal using its WORKBOOK-ONLY cell coefficient. Engine ASD/LRFD capacities remain blocked. |
| J10.crippling.interior.nominal | AISC360-ASD!E222 | 642.696671 | 642.696671 | MATCH | Same interior point-load assumption; actual end distance must be supplied. |

J10 available resistances, fatigue approval and G3 stiffener strength remain blocked pending source/detail verification.

## LRFD — 30 matching, 7 differences, 2 blocked

| Property | Cell | Excel (canonical) | Code | Comparison | Note |
|---|---|---:|---:|---|---|
| A | AISC360-LRFD!B27 | 17000 | 17000 | MATCH |  |
| Ix | AISC360-LRFD!B28 | 8764151026 | 8764151026 | MATCH |  |
| Iy | AISC360-LRFD!B29 | 31702666.67 | 31702666.67 | MATCH |  |
| Sx.top | AISC360-LRFD!B30 | 9941121.312 | 9941121.312 | MATCH |  |
| Sx.bottom | AISC360-LRFD!B31 | 7705465.406 | 7705465.406 | MATCH |  |
| Sy.top-flange | AISC360-LRFD!B32 | 211351.1111 | 211351.1111 | MATCH |  |
| Sy.bottom-flange | AISC360-LRFD!B33 | 317026.6667 | 317026.6667 | MATCH |  |
| rx | AISC360-LRFD!B34 | 718.0099551 | 718.0099551 | MATCH |  |
| ry | AISC360-LRFD!B35 | 43.18405661 | 43.18405661 | MATCH |  |
| Zx | AISC360-LRFD!B36 | 10824833.33 | 10824833.33 | MATCH |  |
| Zy | AISC360-LRFD!E36 | 358000 | 358000 | MATCH |  |
| yCG | AISC360-LRFD!H36 | 1137.394118 | 1137.394118 | MATCH |  |
| yPNA | AISC360-LRFD!E35 | 1190.333333 | 1190.333333 | MATCH |  |
| hc.top | AISC360-LRFD!H34 | 1739.211765 | 1739.211765 | MATCH |  |
| hp.top | AISC360-LRFD!H35 | 1633.333333 | 1633.333333 | MATCH |  |
| J | AISC360-LRFD!E33 | 340350.6667 | 340350.6667 | MATCH |  |
| Cw | AISC360-LRFD!E34 | 16067348570000 | 16067348570000 | MATCH |  |
| topT.A | AISC360-LRFD!AP51 | 5339.211765 | 5339.211765 | MATCH |  |
| topT.yc.outer | AISC360-LRFD!AP52 | 55.16582179 | 55.16582179 | MATCH |  |
| topT.Ix | AISC360-LRFD!AP53 | 38936049.31 | 38936049.31 | MATCH |  |
| topT.Iy | AISC360-LRFD!AP54 | 27005217.64 | 27005217.64 | MATCH |  |
| topT.Sy | AISC360-LRFD!AP55 | 180034.7842 | 180034.7842 | MATCH |  |
| bottomT.A | AISC360-LRFD!AP57 | 3660.788235 | 3660.788235 | MATCH |  |
| bottomT.yc.outer | AISC360-LRFD!AP58 | 122.0108283 | 122.0108283 | MATCH |  |
| bottomT.Ix | AISC360-LRFD!AP59 | 58592955.96 | 58592955.96 | MATCH |  |
| bottomT.Iy | AISC360-LRFD!AP60 | 4673449.031 | 4673449.031 | MATCH |  |
| bottomT.Sy | AISC360-LRFD!AP61 | 46734.49031 | 46734.49031 | MATCH |  |
| topT.A.displayed | AISC360-LRFD!B38 | 3660.788235 | 5339.211765 | DIFF_REQUIRES_REVIEW | B38 incorrectly references bottom AP57. |
| topT.yc.displayed | AISC360-LRFD!B39 | 122.0108283 | 55.16582179 | DIFF_REQUIRES_REVIEW | B39 incorrectly references bottom AP58. |
| topT.Zy | AISC360-LRFD!B44 | 161500 | 272608.8176 | DIFF_REQUIRES_REVIEW | Workbook AY45 is not the full top-T plastic integral; use the shared T solver. |
| bottomT.Sy.displayed | AISC360-LRFD!B52 | 58592955.96 | 46734.49031 | DIFF_REQUIRES_REVIEW | B52 refers to Ix AP59, not Sy AP61. |
| compression_top_t | AISC360-LRFD!D84 | 735.59522 | — | BLOCKED | Top-T E4/E7, correct units and independent KLx/KLy/KLz differ from flawed worksheet E79/Q/area model. |
| major_governing | AISC360-LRFD!D176 | 1926.901666 | 1525.580637 | DIFF_REQUIRES_REVIEW | Corrected dimensions/λpw, FL, Lr and LTB. Slender LRFD web uses F5 rather than blindly retaining F4. |
| minor_governing | AISC360-LRFD!H199 | 47.89559234 | 75.34744487 | DIFF_REQUIRES_REVIEW | Correct top-T Zy; DG7/F6 applicability remains pending. |
| shear_g2 | AISC360-LRFD!C257 | 93.34479042 | 93.34479042 | MATCH | Valid workbook G2 case; no tension-field credit. |
| shear_g7_top | AISC360-LRFD!C270 | 335.34 | 670.68 | DIFF_REQUIRES_REVIEW | Top horizontal shear assigned to a full top flange with kv=1.2, not a half-flange shortcut. |
| tension_field_candidate | AISC360-LRFD!E298 | 2321.728263 | — | BLOCKED | No credit if geometric/stiffener/end-panel gates fail. Excel uses flange thickness where Cv is required. |
| J10.yield.nominal | AISC360-LRFD!C213 | 227.7 | 227.7 | MATCH | Saved available Excel value is normalized to nominal using its WORKBOOK-ONLY cell coefficient. Engine ASD/LRFD capacities remain blocked. |
| J10.crippling.interior.nominal | AISC360-LRFD!E222 | 355.7845061 | 355.7845061 | MATCH | Same interior point-load assumption; actual end distance must be supplied. |

J10 available resistances, fatigue approval and G3 stiffener strength remain blocked pending source/detail verification.
