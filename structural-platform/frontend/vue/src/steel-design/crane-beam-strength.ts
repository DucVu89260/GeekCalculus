import type { StrengthKey, DesignMethod } from '../../../../standards/aisc360-10-resistance'
import { availableStrength, factorNotation, selectedMethod } from '../../../../standards/aisc360-10-resistance'

/**
 * AISC 360-10 crane beam strength calculation.
 * Uses the shared Section Properties numerical core for geometric properties.
 * Every check explicitly reports its coverage; unsupported limit states remain NOT VERIFIED.
 */
type Numerics = Record<string, number>
type SectionResult = { properties: { geometric: { area: number }, elastic: {rx: number,ry: number,sy_positive: number,sy_negative: number}, plastic: {zx: number,zy: number} | null } }
type LimitState = {id:string,clause:string,label:string,demand:number|null,nominal:number|null,capacity:number|null,ratio:number|null,status:string,coverage:string,formula:string,factor?:ReturnType<typeof factorNotation>,warnings:string[]}
export function calculateCraneStrength(section: SectionResult, dimensions: Numerics, actions: Numerics, requestedMethod: DesignMethod) {
  const method = selectedMethod(requestedMethod)
  const a = actions
  const d = dimensions
  const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
  const positive = (x: number) => finite(x) && x > 0
  const checks: LimitState[] = []
  function check(id: string, clause: string, label: string, demand: number, nominal: number, factorKey: StrengthKey, formula: string, coverage = 'SCOPED', warnings: string[] = []) {
    const capacity = finite(nominal) && nominal >= 0 ? availableStrength(nominal, method, factorKey) : null
    const ratio = capacity !== null && capacity > 0 && finite(demand) ? Math.abs(demand) / capacity : null
    checks.push({
      id, clause, label, demand, nominal, capacity, ratio,
      status: coverage === 'SCOPED' && ratio !== null ? (ratio <= 1 ? 'PRELIMINARY PASS' : 'PRELIMINARY FAIL') : 'NOT VERIFIED',
      coverage, formula, factor: factorNotation(method, factorKey), warnings,
    })
  }
  function pending(id: string, clause: string, label: string, reason: string) {
    checks.push({id,clause,label,demand:null,nominal:null,capacity:null,ratio:null,status:'NOT VERIFIED',coverage:'PENDING',formula:'',warnings:[reason]})
  }
  if (![a.fy,a.e,a.mx_knm,a.my_knm,a.vy_kn,a.vx_kn,a.n_kn,a.klx_mm,a.kly_mm,d.depth,d.top_flange_width,d.bottom_flange_width,d.top_flange_thickness,d.bottom_flange_thickness,d.web_thickness]
    .every(finite) || !positive(a.fy)||!positive(a.e)||!positive(a.klx_mm)||!positive(a.kly_mm)) {
    throw new RangeError('Invalid engineering inputs. Provide E, Fy, KLx, KLy and signed member actions.')
  }
  const area = section.properties.geometric.area
  const elastic = section.properties.elastic
  const plastic = section.properties.plastic
  const webDepth = d.depth - d.top_flange_thickness - d.bottom_flange_thickness
  if (!(webDepth > 0) || !positive(area) || !positive(elastic.rx) || !positive(elastic.ry)) throw new RangeError('Invalid section properties')
  const webLambda = webDepth / d.web_thickness
  const flangeTopLambda = d.top_flange_width / (2 * d.top_flange_thickness)
  const flangeBottomLambda = d.bottom_flange_width / (2 * d.bottom_flange_thickness)
  const sqrtEFy = Math.sqrt(a.e / a.fy)
  const slenderWebCompression = webLambda > 1.49 * sqrtEFy
  const slenderTopCompression = flangeTopLambda > .56 * sqrtEFy
  const slenderBottomCompression = flangeBottomLambda > .56 * sqrtEFy
  const compressionSlender = slenderWebCompression || slenderTopCompression || slenderBottomCompression

  // E3 only for nonslender elements; E7 effective-area approach is separate.
  const feX = Math.PI ** 2 * a.e / (a.klx_mm / elastic.rx) ** 2
  const feY = Math.PI ** 2 * a.e / (a.kly_mm / elastic.ry) ** 2
  const fe = Math.min(feX,feY)
  const fcr = a.fy / fe <= 2.25 ? .658 ** (a.fy / fe) * a.fy : .877 * fe
  if (!compressionSlender) {
    check('compression_e3','E3','Axial compression (nonslender I/H)',Math.max(-a.n_kn,0),fcr * area / 1000,
      'COMPRESSION','Fe = π²E/(KL/r)²; Fcr = 0.658^(Fy/Fe)Fy or 0.877Fe; Pn = Fcr A')
  } else {
    pending('compression_e7','E7','Compression with slender elements','E7 effective-width/effective-area Qs/Qa not yet reproduced from Excel; E3 must not be applied.')
  }

  // F4 strong-axis yielding is a component of full F4; LTB/web local buckling pending.
  if (plastic && positive(plastic.zx)) {
    check('flexure_f4_yield','F4','Major-axis yielding component only',Math.abs(a.mx_knm),a.fy * plastic.zx / 1e6,
      'FLEXURE','Mny = Fy Zx; this does NOT represent governing F4 Mn','COMPONENT_ONLY',
      ['F4 lateral torsional buckling, compression flange local buckling, web plastification require additional equations.'])
  } else pending('flexure_f4_yield','F4','Strong-axis yielding','Plastic modulus Zx not available from shared engine.')
  pending('flexure_f4_governing','F4','Governing major-axis flexure','Missing Lb/Cb, Sxc, Sxt, hc/hp, Cw, J and complete F4 state selection; do not claim F4 capacity.')

  // Crane Beam minor-axis bending follows a designated T-shaped effective portion
  // of the cross-section in the source Excel (top flange + specified web portion).
  // Do NOT use full I-section Zy/Sy for this check.
  // The exact web participation and T-section resistance model require worksheet
  // and AISC Design Guide validation before calculating final F6 utilization.
  const effectiveTWebDepth = webDepth / 3
  const topArea = d.top_flange_width * d.top_flange_thickness
  const tWebArea = d.web_thickness * effectiveTWebDepth
  const tArea = topArea + tWebArea
  const tIy = d.top_flange_thickness * d.top_flange_width ** 3 / 12
    + effectiveTWebDepth * d.web_thickness ** 3 / 12
  pending('flexure_minor_t_section','F6 / Crane Design Guide','Minor-axis flexure — equivalent top T section',
    'Excel uses a T-shaped section, not full I/H. Effective web participation is tentatively 1/3 web; derive actual required T-section properties and governing equations from Excel before strength assessment.')
  pending('flexure_f6_governing','F6','Governing minor-axis flexure','Do not use entire I-section Zy or Sy; T-section local buckling and design-guide equations remain to be implemented.')
  // G2 rolled exceptional factor is disallowed for built-up crane I sections.
  const kv = 5.0
  const lambda1 = 1.10 * Math.sqrt(kv * a.e / a.fy)
  const lambda2 = 1.37 * Math.sqrt(kv * a.e / a.fy)
  const cv = webLambda <= lambda1 ? 1
    : webLambda <= lambda2 ? lambda1 / webLambda
    : 1.51 * kv * a.e / (webLambda ** 2 * a.fy)
  const aw = d.depth * d.web_thickness
  check('shear_g2','G2','Web shear without tension field action',Math.abs(a.vy_kn),.6 * a.fy * aw * cv / 1000,
    'SHEAR_GENERAL','Vn = 0.6 Fy Aw Cv; kv = 5 for unstiffened web; stiffener/tension-field paths excluded.','SCOPED',
    ['For crane-specific transverse stiffeners, verify kv, panel aspect ratio and applicability to web dimensions.'])
  pending('shear_g7','G7','Weak-axis shear through flanges','G7 weak-axis shear capacity for both asymmetric flanges not yet benchmarked to AISC/Excel.')
  pending('interaction_h1','H1','Combined axial and biaxial bending','Requires GOVERNING available F4/F6 and E3/E7 strengths. Component-only yielding must not enter H1.')

  return { method, edition:'AISC360-10', checks,
    summary_status:'NOT VERIFIED', geometry_source:'Section Properties / Asymmetric I/H',
    factors: {flexure:factorNotation(method,'FLEXURE'),compression:factorNotation(method,'COMPRESSION'),shear:factorNotation(method,'SHEAR_GENERAL')},
    derived:{ webLambda,flangeTopLambda,flangeBottomLambda,compressionSlender,feX,feY,fcr,cv,webDepth,tSectionPreliminary:{area_mm2:tArea,iy_mm4:tIy,effectiveWebDepth_mm:effectiveTWebDepth,status:'GEOMETRY_ONLY_NOT_VERIFIED'}},
    note: 'Method affects RESISTANCE only; ASD and LRFD member actions require their respective load combinations.'}
}
