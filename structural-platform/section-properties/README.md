# Section Properties — shared production package

This is the single numerical implementation for Section Properties, Steel Design,
Concrete Design, admin previews, browser demo persistence and native Laravel CRUD.
The registry owns profile names, dimension symbols, catalog aliases and formulas.
The Python solver in `engineering/` is an independent verification oracle, not a
production fallback.

## Public API

```ts
import { calculateSectionProperties, sectionRegistry } from './index'

const result = await calculateSectionProperties({
  profile_id: 'double_angle',
  geometry: {
    type: 'double_angle', geometry_variant: 'back_to_back',
    dimensions: { depth: 200, width: 100, thickness: 8, distance: 40 },
  },
  units: 'mm',
  options: { include_plastic: true, include_advanced: true },
})
console.log(result.properties.elastic.ix) // mm^4
console.log(result.formula_report)        // formulas + numeric substitution
```

Profiles: `rectangle`, `circle`, `chs`, `shs_rhs`, `symmetric_i`, `asymmetric_i`,
`channel`, `angle`, `tee`, `double_angle`. Consult `section-registry.json` for
actual IDs/input mappings; the two I/H profiles use one `i_section` geometry.
Catalog legacy identifiers remain aliases; no existing type IDs are replaced.
All dimensions must be finite numbers in mm. The legacy Geometry Models facade
converts its supported input units to mm before calling this core. Outputs and saved formulas remain canonical mm regardless of display unit.

`core/calculator.ts` validates dimensions and computes values;
`core/formula-report.ts` attaches the registry's explanations. `index.ts` is the
supported entrypoint. The compatibility facade in the old Analytical Engine
calls the same core synchronously; it does not contain another numerical solver.

## Geometry conventions and properties

Origin is the bottom-left of the bounding box. X points right and Y up; moments
use centroidal axes. `Ixy = ∫(x−x̄)(y−ȳ)dA`. Principal major-axis angle is measured
counterclockwise from X in (−90°, 90°]; it is null for an indeterminate direction.
Channel opens right; Tee has the flange at the top; Angle has bottom/left legs.
CHS uses outer D; SHS/RHS uses outer b/h and uniform t. Fillets are omitted.

The original 25 report entries cover A/P/x̄/ȳ, Ix/Iy/Ixy, Sx±/Sy±, rx/ry, PNAx/PNAy,
Zx/Zy, Imax/Imin/angle/orientation, J, Cw, shear center and effective shear areas.
The latter two entries contain multiple coordinates/components. Gross results
are exact for the idealized geometry; advanced results use these conventions:

| Geometry | J | Cw / shear center | Effective shear areas |
| --- | --- | --- | --- |
| Rectangle | Convergent Saint-Venant odd series | Convergent harmonic warping Fourier norm; centroid | Jourawski energy: 5A/6 |
| Circle | Polar moment, exact | Cw = 0, centroid | Geometric Jourawski energy: 9A/10 |
| CHS | Polar moment, exact | Cw = 0, centroid | Median-ring thin wall: A/2 |
| SHS/RHS | Single-cell Bredt thin wall | Periodic sectorial warping, centroid; square Cw = 0 | Closed-cell shear flow with ∮q/t ds = 0 |
| I/H, Channel, Angle, Tee, Double Angle | Σ L t³/3 on median walls | Open-section sectorial warping and shear-flow torque | Unit-force shear energy: 1/∫q²/t ds |

Advanced thin-wall results are not full 2D elasticity solutions for thick walls.
T/L Cw = 0 is exact within the adopted straight median-wall model. Solid square
rectangle Cw is nonzero; do not confuse it with a square hollow section. Cw = 0
is never used to represent missing calculations. Shear center may lie outside
the material/bounding box; its coordinates and offsets can be negative. Ax is
for Vx and Ay for Vy. These energy definitions do not incorporate a material
Poisson ratio or a design-code reduction/effective-width rule.

Double Angle means two identical L sections back-to-back, horizontal toes
outwards at the bottom. `distance`/g is the clear gap between vertical backs,
including g = 0. Gross properties integrate the two actual L areas. Advanced
properties assume a fully composite ideal rigid heel link: it transfers shear
reactions and maintains the sectorial path, while adding no area, torsional
stiffness or shear strain energy. Connection detailing must substantiate this
assumption. Zero gap does not imply a continuously welded 2t web; J remains the
sum of the two angles. The connection model is included in every saved report.

For open/closed walls, `diagnostics.advanced_model` records normalized line
integrals/flows. `normalization_length_mm` gives their length scale and
`normalized_geometry_diagnostics=true` distinguishes them from dimensional
properties. Returned J/Cw/shear center/shear areas are physical mm powers.
Convergence diagnostics for solid rectangle include tail/roundoff estimates;
unavailable optional results are null with a reason. Catalog writes require all
advanced entries to be computed and reject incomplete responses atomically.

## Saved formulas and reuse

`result.formula_report` contains the formula-library version and manifest hash,
core/geometry versions, profile, normalized dimensions with symbols, expressions,
numeric substitutions, intermediate inputs, assumptions and reference IDs.
Formulas are explanatory expressions, not a second executable solver.

Laravel saves the complete result in `sections.section_properties` and a timestamp
in `section_properties_calculated_at`. Read stored values without recalculation:

```php
$ix = data_get($section->section_properties, 'properties.elastic.ix');
$cw = data_get($section->section_properties, 'advanced.warping_constant_cw.value');
$formulas = $section->formulaReport();
```

Always check success/status, axis conventions, model assumptions and version when
consuming a snapshot. GET preserves historical formula reports. Create/update/copy
and import recompute with the current package; imported calculated values are not
trusted. Existing manual records remain unchanged until explicitly saved again.

## Build and extend

From `structural-platform/frontend/vue`, run `npm ci` then `npm run build`.
The dev/build/typecheck pre-hooks call `scripts/build-section-properties-core.cjs
--target=browser`: only the synchronous compatibility facade and Steel/AISC browser
assets are emitted. Docker uses `--target=engine` to build the Node CLI/registry
packaged by FastAPI, without reading browser or standard-specific source files.
Use `--target=library` (or `npm run build:section-properties-library` from Vue)
for the public ESM library. Omitting `--target` defaults to `all` for backward compatibility;
the test pre-hook also builds all targets to check engine/browser/library parity.
Generated artifacts are ignored by Git; Docker builds them from the same source.
API path: Laravel → FastAPI → `node-cli.ts` → this package. No Python fallback.

To add/change a shape, update the registry, input validation/types, numerical core
and formula report context together. Add independent geometry/advanced benchmarks,
Python-oracle parity and browser/database coverage. Bump the solver/model/formula
library versions as appropriate; never alter a published formula set without a
version change. Rebuild the native engine image and web bundle together so manifest
hashes agree. For tests see `../engineering/README.md` and `../tests/`.

## Mechanics foundation (mechanics solver 1.0.0, formula library 1.1.0)

The public API returns `mechanics`, stored unchanged with the section snapshot.
The manifest now has 73 entries. This is the classical homogeneous beam-section
foundation for the ten supported idealized profiles, independent of material
strengths, design standards and member loads. Fillets, arbitrary 2D/3D elasticity
and material systems outside the stated models are not represented.

`mechanics.geometry` stores material integration primitives, centroidal polar
inertia/radius, principal-axis positive/negative extreme fibers, elastic moduli,
plastic moduli/PNA, radii, and third area moments (mm⁵) in XY and uv. Nonunique
principal directions use an explicitly chosen reference basis. Here PNA is a
centroidal coordinate; the original PNAx/PNAy are bbox coordinates. Coupled Mx/My
moduli account for Ixy≠0; original Ix/c moduli retain their geometric definition.
Plastic opt-out produces null principal PNA/Z with not_requested metadata.

`mechanics.advanced` stores polar inertia/radius about the shear center, geometric
coupling factor, Wagner integrals with explicit sign definitions, Wt, peak-shear
moduli Wvx/Wvy and the full shear-energy compliance matrix including cross term.
Wv=V/max(|τ|) is distinct from energy-effective As. Both are mechanical quantities.

Warping data include signed ω± (mm²), Wω±=Cw/|ω±| (mm⁴), normalized wall coordinates
and unit-force shear polynomials. Rectangles retain their harmonic Fourier field;
maximum principle and boundary Lipschitz enclosures record tail/roundoff estimates
and extrema error. Wω uses the upper ω enclosure, yielding a lower modulus bound.
Circle/CHS, ideal T/L and square RHS have zero warping within their models; Wω is
null with **not_applicable**, never a fake zero. Thin-wall assumptions carry into
the stress fields. Double Angle retains its ideal rigid heel-link constraint:
zero-area links transfer reaction flows but have no material stress/strain energy.

Raw fields remain physical canonical mm powers. The shear-flow polynomial is
`q(s)/V=q0+q1*s+q2*s²`; s runs from the stored segment start to end. Warping is
`ω(s)=ω0+ω1*s`. Integration primitive conventions and moment signs are preserved
in `formula_report.inputs.mechanics`. No design-code classification is stored.

The package exports `sectionNormalStress(result, actions, point)`: actions are N
(N), Mx/My (N·mm), optional bimoment (N·mm²); point is bbox x/y with optional ω
(mm²). Tension is positive; generalized Mx=∫YσdA and My=∫XσdA. Callers select
material points using stored integration primitives. A nonzero bimoment requires
positive Cw and supplied ω. Member conventions need an explicit axis/sign adapter.

Old snapshots remain historical. Create/update/copy/import recalculate the new
mechanics. Laravel `$section->mechanicalProperties()` retrieves it. Optional
numeric-range failures remain explicitly unavailable; catalog writes require the
complete mechanics foundation. This is section data, not a member capacity check.
