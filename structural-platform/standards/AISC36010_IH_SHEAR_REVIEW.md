# AISC 360-10 Chapter G I/H shear review

This review supports the scoped calculator in `aisc360-10-ih-shear.mjs`. It records equation transcription and numerical checks; it is not an AISC approval or whole-member certification.

## Source and covered cases

Source: supplied ANSI/AISC 360-10 PDF, SHA-256 `f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99`. The applicable pages were visually inspected from the supplied PDF: physical pages 123–128, printed pages 16.1-67–72.

| Clause | Source | Implemented scope |
| --- | --- | --- |
| G1, G2.1 / G2-1 through G2-6 | Physical 123–125; printed 16.1-67–69 | I/H web shear; rolled-I exception; unstiffened or verified intermediate-stiffener buckling coefficient |
| G2.2 / G2-7 and G2-8 | Physical 125; printed 16.1-69 | Intermediate stiffener rigidity and omission criteria; rectangular plate inertias are integrated about the source-defined axis |
| G3.1–G3.4 / G3-1 through G3-5 | Physical 126–127; printed 16.1-70–71 | Opt-in tension-field action, eligibility, panel capacity, stiffener slenderness and adjacent-panel rigidity interpolation |
| G7 | Physical 128; printed 16.1-72 | Weak-axis shear in doubly symmetric I/H sections with explicit zero torsion; two flange elements are summed |

The G2.1(b) branch limits were checked directly against physical page 124: G2-3 uses `h/tw ≤ 1.10√(kvE/Fy)`; G2-4 applies above that limit through `1.37√(kvE/Fy)`; G2-5 applies above `1.37√(kvE/Fy)`. Its upper bound is not `1.37 × 1.10√(kvE/Fy)`.

Inputs use mm, MPa, kN and kN·m. The module accepts LRFD or ASD demands as supplied and applies the edition-specific strength factors; it does not make load combinations. Rolled webs require a verified clear height excluding fillets/corners. Built-up continuously welded plates may use `d−2tf`; bolted webs require a verified distance between fastener lines. G7 requires explicit zero torsion. End/bearing stiffeners, Chapter J concentrated-force checks, openings, torsional shear and unsupported section types remain outside scope.

TFA is disabled by default. Failure or omission of any TFA gate retains the G2 capacity. TFA credit requires all current and adjacent panels to pass G3.1, verified shared and other boundary stiffeners, G2.2/G3.3 checks and both G3.4 interpolations. A rectangular stiffener pair is integrated about the web centerline; a single plate is integrated about its contact face. Custom shapes need supplied positive inertia and explicit verification of the G2.2 axis.

## Independent numerical fixtures

Expected values below were calculated from the transcribed equations separately from the production function.

| Fixture | Independent result |
| --- | --- |
| Unstiffened web: `d=1000`, `h=960`, `tw=8`, `Fy=345`, `E=200000`, `kv=5` | `h/tw=120`; `Cv=1.51·5·200000/(345·120²)=0.303945249597`; `Vn=503.333333 kN`; LRFD `453.000000 kN`; ASD `301.397206 kN` |
| G2-4: `h/tw=70`, same material and `kv=5` | `Cv=1.10√(5·200000/345)/70=0.846028703234`; `Vn=840.614120 kN` for `d=600`, `tw=8` |
| G2-4/G2-5 boundary, `kv=5` | At `h/tw=1.37√(kvE/Fy)=73.758320582`, G2-4 is inclusive and `Cv=1.10/1.37=0.802919708029`; at `1.44√(kvE/Fy)`, G2-5 gives `Cv=1.51/1.44²=0.728202160494` |
| Paired plates: `bs=50`, `ts=8`, `tw=8` | `Ist=2ts[(bs+tw/2)³−(tw/2)³]/3=839466.666667 mm⁴`; for `a=900`, `h=960`, §G2.2 minimum is `389120 mm⁴` |
| TFA case from the test fixture | G2 `Vn=1076.014815 kN`; G3 `Vn=1443.945920 kN`; LRFD G3 available strength `1299.551328 kN`; G3.4 required inertia `497114.547755 mm⁴` at `Vr=1000 kN` |
| Rolled G2.1(a): `d=500`, `h=450`, `tw=10`, `Fy=345` | `h/tw=45≤2.24√(E/Fy)`; `Aw=5000 mm²`, `Cv=1`, `Vn=1035 kN`; LRFD `1035 kN`, ASD `690 kN` |
| G7: `bf=300`, `tf=20`, `Fy=345` | `b/tf=7.5`, `kv=1.2`, `Cv=1`; `Vn=2484 kN` for two flanges; LRFD `2235.6 kN`, ASD `1487.425150 kN` |

## Verification

From `structural-platform/frontend/vue`:

```sh
node --test tests/geometry/aisc36010-ih-shear.test.js
```

Result: 18 tests passed. The suite covers source trace, the corrected G2-4 upper boundary and neighboring G2-5 interval, G2-6 spacing cutoffs, ASD/LRFD factors, stiffener inertia and attachment gates, rolled-clear-height requirements, G2.2 omission, G3 fallback/eligibility, G7 torsion applicability, missing and negative demands, and invalid geometry. Additional regressions cover missing optional stiffener geometry, right-boundary trace identity, and the Ist2<Ist1 interpolation floor.
