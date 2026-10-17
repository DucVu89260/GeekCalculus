# Gross-section Built-up Symmetric I/H — 2026-10-17

This is the current Component UI contract. It narrows the earlier connection-aware member review to gross-section member strength; it does not erase the detailed D2/D3/F13/H4 implementation for other consumers.

## Source and K=1

User-supplied ANSI/AISC 360-10 June 22, 2010, 612 physical pages, SHA-256 `f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99` was downloaded again in the new cloud workspace. C3 was visually checked on physical PDF page 81 / printed 16.1-25. It requires K=1 for Direct Analysis unless a smaller value is justified by rational analysis; bracing defining member unbraced lengths requires sufficient stiffness/strength. C2.3 on physical80 / printed16.1-24 puts the 0.8 and tau_b stiffness adjustments in the structural analysis.

The component assumes external Chapter C2 Direct Analysis, as requested by the user. A software name alone is not evidence that C2 was configured. The export records `analysis_basis.analysis.status=ASSUMED` and `model_verified=false`; no checkboxes or fabricated source-comparison/model approval are supplied. Kx/Ky/Kz=1, nominal E200000/G77200 and positive independent Lx/Ly/Lz/Lb remain enforced. For ASD, external C2.1(4) uses 1.6 times ASD analysis loads then divides required strengths by 1.6. The member calculator does not rescale entered forces or reduce resistance E/G again.

## Explicit execution contract

Set `assessment: {scope: "GROSS_MEMBER", force_source: "MANUAL"}`. The selected top-level `method` is the manual force/resistance basis. Changing ASD/LRFD does not change force values. An unimplemented SAP source cannot claim a connected/verified analysis. The existing default contract, without explicit gross scope, retains net-path/D3/F13/H4 checks and their fail-closed behavior.

Gross scope returns:

- F2/F3/F4/F5 major and F6 minor available strengths from canonical Section Properties, without hole deductions or hole declarations.
- E3/E4/E7 compression from separate flexural and torsional axes.
- D2-1 gross tensile yielding, with phi=.90 or Omega=1.67; this is explicitly **not** a net-rupture/connection result.
- Existing G2/G7/G2.2/G3 branches and their applicability/attachment/TFA checks.
- H1 using the applicable gross tensile or compression resistance and both demanded bending components. Zero actions and signs retain their existing treatment.
- `member_compliance.scope=GROSS_SECTION_MEMBER_STRENGTH` with PASS/FAIL/REVIEW_REQUIRED for that scope. No envelope, connection or local-hole review is asserted. Unknown geometry, torsion, invalid K/E/G, missing independent restraint data or applicable G gaps still prevent PASS.

Analysis/load-basis records are calculation-basis metadata in this scope, not member limit-state rows. The UI exports the scope explicitly and drops older connection/acknowledgment payload groups rather than reusing them as model approval. Detailed connection-aware engine consumers are unchanged.

## UI

Four input tabs: Geometry, Material & lengths, Forces, Shear & stiffeners. Analysis basis and Tension Connection tabs/confirmation lists are removed. Fabrication remains visible above the tabs, with Built-up supported and Hot-rolled pending. The design summary includes Mnx/Mny, compression, gross tensile yielding, shear and H1 interaction with nominal/available values, D/C and source clauses. Existing one-column layout and Contents are preserved.

The disabled SAP2000 API button identifies future force, section-geometry and moment-diagram import for Cb (or a corresponding standard-specific factor). Cb remains1; no live connection or Cb extraction is implemented. Bottom notes state homogeneous built-up plates, no hybrid steel/cover plates, web openings deferred, independent restraint lengths, external Direct Analysis and the C3 source page. There are no repeated connection/critical-hole/envelope blockers in the gross-member UI.

## Independent fixtures and verification

Sharp welded d300, bf150, tf12, tw8 mm; Fy345 MPa; Ag5808 mm², Zx670752 mm³, Zy139416 mm³; Lb500 mm makes LTB inapplicable for this fixture.

| Hand result | LRFD | ASD |
| --- | --- | --- |
| Gross tensile nominal | 2003.76 kN | 2003.76 kN |
| Available gross tensile yield | 1803.384 kN | 1199.85628742515 kN |
| Major nominal | 231.40944 kN·m | 231.40944 kN·m |
| Major available | 208.268496 kN·m | 138.568526946108 kN·m |
| Minor nominal | 48.09852 kN·m | 48.09852 kN·m |
| Minor available | 43.288668 kN·m | 28.801508982036 kN·m |
| H1, N200 kN / Mx100 / My10 kN·m | 0.766608077738583 | 1.152211940841091 |

Expected capacities follow independent rectangular integration and the source factors; expected H1 uses these hand capacities, not production-generated outputs. Tests also cover compression without invented confirmations, default strict-mode preservation, invalid K/E/G, rolled/bolted/torsion/missing restraints, unsupported API, zero/sign invariance and no demand scaling. Browser checks retain a separate ASD PASS example N130/Mx70/My5.

Executed: complete Node suite151 passed (145 existing +6 gross-member tests), Vue typecheck, native/demo builds and browser regression evidence recorded in context/HANDOFF.md. The earlier actual-PDF registry import/approval remains a separate workflow. No PDF publication, DB migration or backend change in this slice.
