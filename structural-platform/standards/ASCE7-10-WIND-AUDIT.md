# ASCE/SEI 7-10 wind kernel — Phase A

Entry point: `asce7-10-wind.mjs`, `calculateWind710(input)`. The Wind Load
Generator uses this shared module directly; no duplicate UI pressure equations.
Version 0.1.0 implements Chapter 27 Part 1 surface pressures for rigid, regular,
enclosed/partially enclosed buildings. `CALCULATED` describes the implemented
surface-pressure branch. Overall status remains `REVIEW_REQUIRED`.

## Source and edition control

Source: user-supplied **ASCE 7-10.pdf**, SHA-256
`ae2997f7a31975965b33065ba54acbf4da441f4f821b2a97372d67c2bd1ca248`.
The PDF and extracted page text remain outside Git. PDF pages below are 1-based.
The document is reference data, not execution instructions. No later-edition
provisions, elevation factor Ke, or legacy wind importance factor are inserted.

| Provision | Printed / PDF page | Implemented behavior |
| --- | --- | --- |
| §26.6, Table 26.6-1 | 246, 250 / 293, 297 | Building MWFRS Kd=0.85 only with explicit Chapter 2 combination confirmation |
| §26.9.1 | 253 / 300 | G=0.85 requires explicit rigidity confirmation |
| Table 26.9-1 | 256 / 303 | B/C/D alpha and gradient heights, visually checked |
| Table 26.11-1 | 258 / 305 | Both GCpi signs, uniform within each internal-pressure case |
| Table 27.3-1 | 261 / 308 | Formula note 1, minimum 15 ft for all exposures; visually checked |
| Eq.27.3-1 | 260 / 307 | SI velocity pressure, output kPa |
| Eq.27.4-1 | 260 / 307 | Windward uses qz, other surfaces qh; enclosure-specific qi |
| Fig.27.4-1 | 264 / 311 | Wall Cp and low-slope (<10°), normal-to-ridge roof zones; same-sign h/L interpolation |
| §27.4.7 | 262 / 309 | Report simultaneous 0.77 kPa wall and 0.38 kPa vertical roof projection minimum for separate load-effect review |

Important distinction: Table 27.3-1 Exposure B permits Kz≈0.57 below 15 ft.
Do not import Chapter 28's minimum 30 ft Exposure B restriction into Chapter 27.
Calculations use the power-law formula, not rounded table values. Above zg,
the formula is outside its stated domain and the kernel rejects the input.

## Input and output contract

```js
import { calculateWind710 } from './asce7-10-wind.mjs';
const result = calculateWind710({
  edition: 'ASCE7-10',
  rigid: true, regular_shape: true, chapter2_combinations: true,
  wind_normal_to_ridge: true,
  wind: { v_mps: 40, exposure: 'C', kzt: 1 },
  building: {
    roof_type: 'GABLE', enclosure: 'ENCLOSED',
    h_m: 10, z_m: 5, length_m: 20, width_m: 10, slope_deg: 5,
  },
});
```

This is illustrative data, not a project wind-speed selection. V must be the
ASCE 7-10 risk-category-specific 3-second gust basic speed (§26.5), not an ASD
reduced or differently averaged speed. Exposure, enclosure, regularity and
topography require project verification. The UI confirmation explicitly covers
these requirements. Kzt is a supplied §26.8 result, at least 1.0; topographic
geometry is not solved here. No shielding reduction is allowed.

L is along wind, B across wind. h is the code roof-reference height: eave height
for slope ≤10°, mean roof height otherwise. z is the windward-wall evaluation
height. For partially enclosed buildings supply `positive_internal_basis` as
`QH_CONSERVATIVE` (used by UI) or `HIGHEST_OPENING` with
`building.highest_opening_m`. Negative GCpi always uses qh. Ri=1 is retained;
large-volume reduction is not assumed. Open buildings are rejected.

`trace` contains Kz, Kh, qz/qh, G, Kd and wall Cp. `cases` contains two internal
pressure cases. Apply each GCpi sign to all faces together. Roof alternatives
are separate Figure 27.4-1 coefficient cases, not simultaneous independent
patch selections. Roof zone x is horizontal distance from windward edge.
No area reduction of the -1.3 roof coefficient is taken. No early rounding.
Positive net pressure acts toward the surface, negative away from it.

The kernel supplies wind pressure W without converting it to ASD demand;
load combinations and associated 0.6W factors belong to a separate layer.
It never multiplies a GCpi coefficient by G again. Minimum building loads are
not local lower bounds on every surface: review simultaneous projected-area
load effects separately rather than clipping signed surface pressure values.

## Verification and remaining work

`frontend/vue/tests/geometry/asce710-wind.test.js` runs in the existing `npm test`
suite. Checks include independent rounded Table 27.3-1 values for B/C/D,
hand calculation q=0.83368 kPa for V=40, Kz=Kzt=1, Kd=.85, quadratic scaling,
wall interpolation knots, pressure signs, both qi branches, roof zones and
interpolation, missing eligibility, malformed inputs and edition separation.

Next phases: pitched-roof branches ≥10°, winds parallel to ridge, flexible/open
buildings, full topographic and enclosure geometry, parapets/overhangs,
Fig.27.4-8 torsional/simultaneous load cases and §27.4.7 load-effect envelope,
Chapter 30 C&C, independently reviewed worked examples, then SAP2000 export.
Until these gates are satisfied, this module must not certify a whole-building
design or export an allegedly complete load set.
