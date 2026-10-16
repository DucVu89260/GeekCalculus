# ANSI/AISC 360-10 — Symmetric I/H Formula Audit (Phase A & Phase B)

Source: **American Institute of Steel Construction**, *Specification for Structural Steel Buildings*, ANSI/AISC 360-10, June 22, 2010. Original edition source https://design.medeek.com/resources/DOCUMENTS/AISC_360-10.pdf (verify engineering use against authoritative printed edition/errata). Later editions MUST NOT be treated as identical by default.

## Scope and status
- Legacy workbook `DV_AISC360-05_DoublySymmetricI_LRFD_v2.xlsm` is **AISC 360-05** despite the present UI selecting AISC 360-10.
- Independent **AISC 360-10** module: `standards/aisc360-10-verified-hi.mjs` with machine-readable clause/formula registry `FORMULAS`. It uses canonical Section Properties results and AISC 360-10 phi/Omega factor registry.
- `CALCULATED` means the specific mathematical branch was evaluated, **not** whole-member PASS.
- **Global status remains REVIEW_REQUIRED** until all applicable Chapters C–H checks, shear/stiffeners, tension and relevant stability provisions have been validated.
- Units: mm, MPa, N, N·mm; actions accepted in kN and kN·m.

## Original edition formula map

| Clause | Implemented item | Applicability | Blocking issue |
| --- | --- | --- | --- |
| Table B4.1a case 1 | Rolled flange axial λr = 0.56√(E/Fy) | Uniform axial compression | Rolled fillet geometry must be sourced |
| Table B4.1a case 2 | Built-up flange axial λr = 0.64√(kc E/Fy) | kc = clip(4/√(h/tw),0.35,0.76) | Require real plate geometry |
| Table B4.1a case 5 | Web axial λr = 1.49√(E/Fy) | Axial compression | E7 effective web width verified by E7-16/E7-17; benchmark still pending |
| Table B4.1b cases 10,11 | Major flexure flange λp, λr | Rolled/built-up differentiated | λr for built-up uses FL=0.7Fy for symmetric I, kc |
| Table B4.1b case 13 | Minor flexure flange λp, λr | All I shapes | No shortcut from major flange classification |
| Table B4.1b case 15 | Web flexure λp = 3.76√(E/Fy), λr = 5.70√(E/Fy) | Doubly symmetric I-shapes | F4/F5 not completed |
| E3-1 through E3-4 | Pn = Ag min(Fcr,x,Fcr,y) and independent Euler Fe | Nonslender axial compression | Requires Kx/Lx and Ky/Ly |
| E4-4 | Fe,z = [π² E Cw/(Kz Lz)² + GJ]/(Ix+Iy) | Doubly symmetric torsional buckling | Requires separate Kz, Lz, G; no implicit Lb=Ly |
| E7-1–E7-17 | Qs rolled/built-up flanges; Qa effective web width; QFy/Fe compression | Slender I sections, single uniform web | Implemented; independent worked-example benchmark still required |
| F1-1 | Cb absolute Mmax,MA,MB,MC | Same segment and consistent load case | Cb=1 explicit conservative until SAP importer; never use signed legacy values |
| F2-1 through F2-8 | Mp, Lp, Lr, rts, elastic/inelastic LTB | Compact web and compact flange major flexure | Requires canonical J, Cw and real Lb; assumes restraint against twisting at supports |
| F3-1, F3-2 | Noncompact/slender flange local buckling | **Compact web** I-shaped major flexure | Uses correct built-up λr and kc |
| F4 | Other I and noncompact webs | Noncompact web flexure | **Blocked**, do not reuse F2/F3 |\n| F5 | Slender-web I flexure, Rpg, LTB and flange local buckling | Built-up symmetric slender web | Implemented per F4-7/11/12 and F5-1–F5-9; rolled fillet requires real catalog geometry |
| F6-1 through F6-4 | Minor-axis plastic yielding and flange local buckling | I-shaped members in minor flexure | Correct minor flange slenderness class |
| H1-1a and H1-1b | Axial + biaxial moment interaction; **no early rounding** | Strength checks complete | Block if compression, major or minor flexure missing; D2/D3 net rupture needed if axial tension |
| G2/G3 | Shear and transverse stiffeners/tension-field action | Axial shear | **Not in Phase B**: legacy checks must not certify |

## Correctness and input governance
1. Never use `feY = feX`. Independently calculate `Fe,x` and `Fe,y` from their own `KxLx/rx` and `KyLy/ry`; E4 torsional buckling is a separate potential governing state.
2. Never infer `Kx`, `Ky`, `Ly`, `Kz`, `Lz`, `G` or bracing from an existing LRFD workbook. Missing positive inputs produce `INPUT_REQUIRED`.
3. `Cb=1` is exposed as a conservative intentional choice pending trustworthy segment data. Future importer must provide the complete same-combo distribution and effective brace locations before computing Cb > 1.
4. ASD and LRFD share the same nominal strength formulas. The same factor registry computes `φRn` or `Rn/Ω`; load combinations are NOT auto-converted.
5. Tension gross yielding and net-section rupture, flange/web shear, fasteners/connections, stability effects and local strength are not silently treated as satisfied.
6. The current **sharp-corner rolled** geometry mode is approximation only. A real rolled profile with fillets must use validated section dimensions (AISC database or equivalent).
7. If legacy Excel parity cannot calculate on new inputs, the independent Phase A/B core still executes using shared geometry.

## Acceptance gate
- Unit tests for B4 compression vs flexure, built-up vs rolled and compact/noncompact/slender transitions.
- Unit tests for separate Fe,x/Fe,y and governing E4, F2 buckling transitions, F3 FLB, F6 minor, H1 method switching.
- Tests for missing critical inputs, F4/F5 and E7 deliberately blocked, Cb same-case/brace constraints.
- Manual independent worked-example verification required before removing engineering warnings.
- Export retains `aisc36010_phase_ab_review` and `section_properties_shared` to preserve audit trail, not replace legacy result data.

## Next development package (NOT claimed done)
Validate E7 Qs/Qa and F5 with independent design examples, complete F4 with all required limit states, D2/D3 with section-net connection model, G2/G3 and transverse stiffeners, Chapter C second-order/stability verification, independent test vectors from AISC design examples. Only then promote whole-member PASS eligibility.
