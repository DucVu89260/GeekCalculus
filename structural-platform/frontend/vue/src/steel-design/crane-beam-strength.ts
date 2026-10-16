import type { StrengthKey, DesignMethod } from '../../../../standards/aisc360-10-resistance'
import { availableStrength, factorNotation, selectedMethod } from '../../../../standards/aisc360-10-resistance'
import { CRANE_STAGES, DEFAULT_CRANE_ACTIONS, CRANE_INPUT_FIELDS } from './crane-beam-inputs'
import type { CraneActions } from './crane-beam-inputs'
import type { CraneSections } from './crane-beam-section'
export { CRANE_STAGES, DEFAULT_CRANE_ACTIONS, CRANE_INPUT_FIELDS }

export type CraneCheck = {
  id: string; clause: string; label_en: string; label_vi: string; unit: string
  demand: number | null; nominal: number | null; capacity: number | null
  available_asd: number | null; available_lrfd: number | null; ratio: number | null
  status: 'NOT VERIFIED'; coverage: string; formula: string; substitution: string
  factor?: ReturnType<typeof factorNotation>; warnings: string[]; worksheet_refs: string[]
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const classify = (lambda: number, lp: number, lr: number) => lambda <= lp ? 'COMPACT' : lambda <= lr ? 'NONCOMPACT' : 'SLENDER'
export function shearCv(lambda: number, kv: number, e: number, fy: number) {
  if (![lambda, kv, e, fy].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('Invalid G2 slenderness/material')
  const l1 = 1.10 * Math.sqrt(kv * e / fy), l2 = 1.37 * Math.sqrt(kv * e / fy)
  return lambda <= l1 ? 1 : lambda <= l2 ? l1 / lambda : 1.51 * kv * e / (fy * lambda ** 2)
}

/**
 * Issue #17 calculation worksheet. Units: mm/MPa internally; kN/kN.m resistances.
 * Candidate math, workbook parity and primary-source approval are separate gates.
 * No check may acquire a PASS status merely because its numerical D/C is < 1.
 */
export function calculateCraneDesign(sections: CraneSections, submitted: CraneActions, requestedMethod: DesignMethod) {
  const method = selectedMethod(requestedMethod), a = { ...DEFAULT_CRANE_ACTIONS, ...submitted }
  // Defaults belong to the input form, never silently fill missing submitted data.
  for (const field of CRANE_INPUT_FIELDS) {
    const value = submitted[field.id]
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || (!field.signed && value < 0))) throw new RangeError(`Invalid engineering input: ${field.id}`)
    if (field.type === 'checkbox' && typeof value !== 'boolean') throw new RangeError(`Invalid checkbox: ${field.id}`)
    if (field.type === 'select' && !field.options?.some(option => option.value === value)) throw new RangeError(`Invalid selection: ${field.id}`)
  }
  const n = (key: string) => a[key] as number
  const fy = n('fy'), e = n('e'), g = n('g'), lb = n('lb_mm'), cb = n('cb')
  for (const key of ['fy', 'fu', 'e', 'g', 'lb_mm', 'cb', 'klx_mm', 'kly_mm', 'klz_mm', 'bearing_mm', 'stiffener_spacing_mm', 'stiffener_fy']) if (!(n(key) > 0)) throw new RangeError(`${key} must be positive`)
  if (n('fu') < fy) throw new RangeError('Fu must not be less than Fy')
  const base = sections.base, top = sections.top, d = base.normalized_input.geometry.dimensions
  if (base.geometry_type !== 'i_section' || top.geometry_type !== 'tee' || sections.bottom.geometry_type !== 'tee' || !base.properties.plastic || !top.properties.plastic) throw new RangeError('Canonical I/H and top/bottom T sections with plastic properties are required')
  const p = base.properties, tp = top.properties, h = d.depth - d.top_flange_thickness - d.bottom_flange_thickness
  if (n('k_mm') < d.top_flange_thickness || n('k_mm') >= d.depth / 2) throw new RangeError('k must include flange/weld/root and remain less than half the section depth')
  const root = Math.sqrt(e / fy), kc = clamp(4 / Math.sqrt(h / d.web_thickness), .35, .76)
  const groups = CRANE_STAGES.map(stage => ({ ...stage, checks: [] as CraneCheck[] }))
  function row(group: string, id: string, clause: string, label_en: string, label_vi: string, data: Partial<CraneCheck> = {}) {
    const value: CraneCheck = { id, clause, label_en, label_vi, unit: '', demand: null, nominal: null, capacity: null, available_asd: null, available_lrfd: null, ratio: null, status: 'NOT VERIFIED', coverage: 'CALCULATED_PENDING_REVIEW', formula: '', substitution: '', warnings: [], worksheet_refs: [], ...data }
    // Status cannot be overridden by a caller's data or a low utilization.
    value.status = 'NOT VERIFIED'
    groups.find(stage => stage.id === group)!.checks.push(value)
    return value
  }
  function resistance(group: string, id: string, clause: string, en: string, vi: string, demand: number, nominal: number, key: StrengthKey | null, formula: string, inputs: Record<string, number>, refs: string[], warnings: string[] = []) {
    if (!Number.isFinite(nominal) || nominal < 0) throw new RangeError(`Non-finite or negative nominal resistance: ${id}`)
    const capacity = key ? availableStrength(nominal, method, key) : null
    return row(group, id, clause, en, vi, { unit: group === 'compression' || group.startsWith('shear') || group === 'wheel_web' || group === 'tension_field' ? 'kN' : 'kN·m', demand: Math.abs(demand), nominal, capacity,
      available_asd: key ? availableStrength(nominal, 'ASD', key) : null, available_lrfd: key ? availableStrength(nominal, 'LRFD', key) : null,
      ratio: capacity !== null && capacity > 0 ? Math.abs(demand) / capacity : null,
      ...(key ? { factor: factorNotation(method, key) } : {}), formula, substitution: Object.entries(inputs).map(([k, v]) => `${k}=${v.toPrecision(8)}`).join('; '),
      worksheet_refs: refs, warnings: [...warnings, 'Numerical candidate only: primary-source applicability and independent design benchmark remain required.'],
    })
  }
  function pending(group: string, id: string, clause: string, en: string, vi: string, reason: string, refs: string[] = []) {
    return row(group, id, clause, en, vi, { coverage: 'INPUT_OR_SOURCE_REQUIRED', warnings: [reason], worksheet_refs: refs })
  }

  // 3. Element classification: compression, major and minor flexure are distinct.
  const topCompression = n('mx_knm') >= 0, bf = topCompression ? d.top_flange_width : d.bottom_flange_width,
    tf = topCompression ? d.top_flange_thickness : d.bottom_flange_thickness,
    sxc = topCompression ? p.elastic.sx_positive : p.elastic.sx_negative,
    sxt = topCompression ? p.elastic.sx_negative : p.elastic.sx_positive,
    hc = topCompression ? sections.hc_top_mm : sections.hc_bottom_mm,
    hp = topCompression ? sections.hp_top_mm : sections.hp_bottom_mm
  const mp = Math.min(fy * p.plastic!.zx, 1.6 * fy * sxc), myc = fy * sxc, myt = fy * sxt
  const fl = Math.max(.5 * fy, Math.min(.7 * fy, fy * sxt / sxc))
  const lpF = .38 * root, lrF = a.fabrication === 'BUILT_UP' ? .95 * Math.sqrt(kc * e / fl) : root
  const lpW = hp > 0 ? Math.min(5.7 * root, (hc / hp) * root / (.54 * mp / myc - .09) ** 2) : 0, lrW = 5.7 * root
  const majorWeb = hp > 0 ? classify(hc / d.web_thickness, lpW, lrW) : 'OUT_OF_SCOPE'
  for (const [id, b, t] of [['top',d.top_flange_width,d.top_flange_thickness],['bottom',d.bottom_flange_width,d.bottom_flange_thickness]] as const) {
    const lambda = b / (2 * t), axialLimit = a.fabrication === 'BUILT_UP' ? .64 * Math.sqrt(kc * e / fy) : .56 * root
    row('local_buckling', `b4_${id}`, 'Tables B4.1a/B4.1b', `${id} flange: axial / major / minor`, `Cánh ${id === 'top' ? 'trên' : 'dưới'}: nén / uốn mạnh / uốn yếu`, {
      formula: 'λf=bf/(2tf); axial λr=0.64√(kcE/Fy) built-up or 0.56√(E/Fy) rolled; major λr=0.95√(kcE/FL) built-up; minor λr=√(E/Fy)',
      substitution: `λ=${lambda}; axial limit=${axialLimit}; λp=${lpF}; major λr=${lrF}; minor λr=${root}; axial=${lambda <= axialLimit ? 'NONSLENDER' : 'SLENDER'}; major=${classify(lambda,lpF,lrF)}; minor=${classify(lambda,lpF,root)}`,
      worksheet_refs: ['G57:G60','D71:D74'], warnings: ['Built-up major-axis flange classification must not use the workbook minor-axis λr indiscriminately.'],
    })
  }
  row('local_buckling','b4_web','Table B4.1b case 16 / B4.1a','Web: major flexure / uniform compression','Bụng: uốn trục mạnh / nén đều',{
    formula:'λw=hc/tw; λpw=min[λrw,(hc/hp)√(E/Fy)/(0.54Mp/Myc−0.09)²]; λrw=5.7√(E/Fy); axial λr=1.49√(E/Fy)',
    substitution:`hc/tw=${hc/d.web_thickness}; h/tw=${h/d.web_thickness}; λpw=${lpW}; λrw=${lrW}; web=${majorWeb}; kc=${kc}`,
    worksheet_refs:['G61:G64','AW96'], warnings:['M x ≥ 0 means top compression; negative Mx mirrors the compression flange. Workbook uses inconsistent hc/mm/cm references.'],
  })

  // 4. Top-T axial hypothesis is diagnostic, NOT the worksheet flange-only
  // load-path model. No available strength without an explicit model selection.
  // Include T monosymmetric flexural-torsional buckling instead of full-I E3.
  const td = top.normalized_input.geometry.dimensions, at = tp.geometric.area
  const fex = Math.PI ** 2 * e / (n('klx_mm') / tp.elastic.rx) ** 2
  const fey = Math.PI ** 2 * e / (n('kly_mm') / tp.elastic.ry) ** 2
  const sc = top.advanced.shear_center.value, jt = top.advanced.torsion_constant_j.value, cwt = top.advanced.warping_constant_cw.value
  let compression: CraneCheck | null = null
  const compressionDemand = Math.max(-n('n_kn'), 0)
  const compTrace: Record<string, number> = { At: at, rxT: tp.elastic.rx, ryT: tp.elastic.ry, Fex: fex, Fey: fey }
  if (jt !== null && cwt !== null && sc) {
    const x0 = sc.x - tp.geometric.centroid_x, y0 = sc.y - tp.geometric.centroid_y
    const r0sq = (tp.elastic.ix + tp.elastic.iy) / at + x0*x0 + y0*y0
    const H = 1 - (x0*x0 + y0*y0) / r0sq
    const fez = (Math.PI ** 2 * e * cwt / n('klz_mm') ** 2 + g * jt) / (at * r0sq)
    // Numerically stable form of the smaller E4 root; symmetric about local y.
    const coupled = 2 * fey * fez / (fey + fez + Math.sqrt(Math.max(0, (fey + fez) ** 2 - 4 * fey * fez * H)))
    const fe = Math.min(fex, coupled)
    const lf = d.top_flange_width / (2*d.top_flange_thickness), stemLambda = sections.top_web_depth_mm / d.web_thickness
    // T flange/stem are both unstiffened elements under uniform compression.
    const qsFlange = lf <= .56*root ? 1 : lf <= 1.03*root ? 1.415-.74*lf/root : .69*e/(fy*lf**2)
    const qsStem = stemLambda <= .75*root ? 1 : stemLambda <= 1.03*root ? 1.908-1.22*stemLambda/root : .69*e/(fy*stemLambda**2)
    const q = clamp(Math.min(qsFlange,qsStem),0,1)
    const fcr = q * fy / fe <= 2.25 ? q * fy * .658 ** (q * fy / fe) : .877 * fe
    Object.assign(compTrace,{r0sq,H,Fez:fez,FeFT:coupled,Fe:fe,Qs_flange:qsFlange,Qs_stem:qsStem,Q:q,Fcr:fcr})
    compression = resistance('compression','compression_top_t','E3 / E4 / E7', 'Top-T longitudinal compression incl. flexural-torsional candidate','Nén dọc T trên gồm ứng viên mất ổn định uốn xoắn', compressionDemand, fcr*at/1000,'COMPRESSION',
      'Fe,x/y=π²E/(KL/r)²; Fe,z=[π²ECw/(KLz)²+GJ]/(AT r0²); Fe=min(Fe,x, smaller E4 root); Q=min(Qs,flange,Qs,stem), Qa=1; Fcr=QFy·0.658^(QFy/Fe) or 0.877Fe; Pn=Fcr AT',compTrace,['D70:D84'],
      ['The source worksheet assigns longitudinal load to the top FLANGE ONLY. This top-T diagnostic is a different hypothesis; T element limits and connection restraints require DG7 / AISC E4/E7 verification. Full-I area/radii must not replace top-T properties.'])
    if (!a.axial_top_t_model) {
      compression.capacity = compression.available_asd = compression.available_lrfd = compression.ratio = null
      delete compression.factor
      compression.coverage = 'AXIAL_LOAD_PATH_UNCONFIRMED'
      compression.warnings.push('Source flange-only bracing/local-element model is unresolved. Top-T nominal is diagnostic only; no available strength or H1 credit is granted by default.')
    }
  } else pending('compression','compression_top_t','E3 / E4 / E7','Top-T compression','Nén T trên','Canonical T torsion/shear-center data unavailable.')
  if (n('n_kn') > 0) pending('compression','top_t_tension','D2 / D3','Longitudinal tensile action','Lực dọc kéo','Net-area rupture and connection load path are not supplied; a zero compression ratio is not a tension check.')

  // 5. Major bending: all four states, F4 vs F5 explicit and sign-aware.
  const iyc = tf * bf ** 3 / 12, iyRatio = iyc / p.elastic.iy
  const h0 = d.depth - (d.top_flange_thickness+d.bottom_flange_thickness)/2
  const aw = hc*d.web_thickness/(bf*tf), rt = bf/Math.sqrt(12*(h0/d.depth+aw*h*h/(6*h0*d.depth)))
  const lp = 1.1*rt*root, j = base.advanced.torsion_constant_j.value
  const slender = majorWeb === 'SLENDER', majorClause = slender ? 'F5' : 'F4'
  const rpgCandidate = Math.min(1,1-Math.min(aw,10)/(1200+300*Math.min(aw,10))*(hc/d.web_thickness-5.7*root))
  let major: CraneCheck | null = null
  const majorTrace: Record<string,number> = {Sxc:sxc,Sxt:sxt,hc,hp,lambda_pw:lpW,lambda_rw:lrW,Iyc_Iy:iyRatio,Mp:mp,Myc:myc,Myt:myt,FL:fl,kc,rt,Lp:lp,Lb:lb,Cb:cb}
  if (hp > 0 && iyRatio >= .1 && iyRatio <= .9 && j !== null && j > 0 && (!slender || rpgCandidate > 0)) {
    const rpc = iyRatio <= .23 ? 1 : majorWeb === 'COMPACT' ? mp/myc : clamp(mp/myc-(mp/myc-1)*(hc/d.web_thickness-lpW)/(lrW-lpW),1,mp/myc)
    const rpt = majorWeb === 'COMPACT' ? mp/myt : clamp(mp/myt-(mp/myt-1)*(hc/d.web_thickness-lpW)/(lrW-lpW),1,Math.max(1,mp/myt))
    const rpg = rpgCandidate
    const q = j/(sxc*h0)
    const lr = slender ? Math.PI*rt*Math.sqrt(e/(.7*fy)) : 1.95*rt*e/fl*Math.sqrt(q+Math.sqrt(q*q+6.76*(fl/e)**2))
    const compressionYield = slender ? rpg*fy*sxc : rpc*myc
    const fcrLTB = cb*Math.PI**2*e/(lb/rt)**2 * (slender ? 1 : Math.sqrt(1+.078*q*(lb/rt)**2))
    const ltb = lb <= lp ? compressionYield : lb <= lr
      ? Math.min(compressionYield, slender ? rpg*sxc*Math.min(fy,cb*(fy-.3*fy*(lb-lp)/(lr-lp))) : cb*(compressionYield-(compressionYield-fl*sxc)*(lb-lp)/(lr-lp)))
      : Math.min(compressionYield, (slender ? rpg : 1)*fcrLTB*sxc)
    const lf = bf/(2*tf), cls = classify(lf,lpF,lrF)
    const flb = cls === 'COMPACT' ? compressionYield : cls === 'NONCOMPACT'
      ? (slender ? rpg*sxc*(fy-.3*fy*(lf-lpF)/(lrF-lpF)) : compressionYield-(compressionYield-fl*sxc)*(lf-lpF)/(lrF-lpF))
      : (slender ? rpg : 1)*.9*e*kc*sxc/(lf**2)
    const tensionYield = slender ? myt : rpt*myt
    Object.assign(majorTrace,{J:j,Rpc:rpc,Rpt:rpt,Rpg:rpg,Lr:lr,Fcr_LTB:fcrLTB,lambda_f:lf,lambda_pf:lpF,lambda_rf:lrF})
    const modes: [string,string,string,number,string][] = [
      ['major_compression_yield','Compression flange yielding','Chảy cánh nén',compressionYield,slender?'Mn=Rpg Fy Sxc':'Mn=Rpc Fy Sxc'],
      ['major_ltb','Lateral torsional buckling','Mất ổn định uốn xoắn',ltb,'Lp=1.1rt√(E/Fy); Lr per F4-8 or F5-5; Mn=min(compression yield, inelastic interpolation or Fcr Sxc)'],
      ['major_flb','Compression flange local buckling','Mất ổn định cục bộ cánh nén',Math.min(compressionYield,flb),'compact: local buckling does not apply; noncompact: interpolate; slender: Mn=0.9 E kc Sxc/λf² (×Rpg for F5)'],
      ['major_tension_yield','Tension flange yielding','Chảy cánh kéo',tensionYield,slender?'Mn=Fy Sxt':'Mn=Rpt Fy Sxt'],
    ]
    for (const [id,en,vi,nominal,formula] of modes) resistance('major_bending',id,majorClause,en,vi,n('mx_knm'),nominal/1e6,'FLEXURE',formula,majorTrace,['C91','E124','F144','E171'],[`${majorClause} candidate selected from hc/tw; workbook incorrectly keeps F4 even for a slender-web plate girder.`,...(a.fabrication === 'ROLLED' ? ['Sharp-corner rolled geometry lacks actual fillet dimensions.'] : [])])
    major = resistance('major_bending','major_governing',majorClause,'Governing major bending candidate','Ứng viên uốn trục mạnh chi phối',n('mx_knm'),Math.min(...modes.map(mode=>mode[3]))/1e6,'FLEXURE','Mn=min(Mn,compression,Mn,LTB,Mn,FLB,Mn,tension)',majorTrace,['D176'])
  } else for (const [id,en,vi] of [['major_compression_yield','Compression flange yielding','Chảy cánh nén'],['major_ltb','Lateral torsional buckling','Mất ổn định uốn xoắn'],['major_flb','Compression flange local buckling','Mất ổn định cục bộ cánh nén'],['major_tension_yield','Tension flange yielding','Chảy cánh kéo']] as const) pending('major_bending',id,'F4 / F5 / F12',en,vi,'Outside current F4/F5 geometric envelope (hp > 0, 0.1≤Iyc/Iy≤0.9, valid J, positive Rpg); requires separate applicability review.')

  // 6. Candidate DG7 split-section rule. F6 is not asserted applicable to a T
  // simply because a full-I F6 function happens to accept its Sy/Zy.
  const syT = tp.elastic.sy_positive, zyT = tp.plastic!.zy, lfT = d.top_flange_width/(2*d.top_flange_thickness)
  const mpT = Math.min(fy*zyT,1.6*fy*syT), minorClass = classify(lfT,lpF,root)
  const minorFLB = minorClass === 'COMPACT' ? mpT : minorClass === 'NONCOMPACT' ? mpT-(mpT-.7*fy*syT)*(lfT-lpF)/(root-lpF) : .69*e*syT/lfT**2
  const minorInputs = {IyT:tp.elastic.iy,SyT:syT,ZyT:zyT,Fy:fy,lambda:lfT,lambda_p:lpF,lambda_r:root}
  const minorWarnings = ['DG7 §18.1 split-section load path and applicability of this flange F6 candidate remain unverified; this is not generic T-section F6 certification.']
  resistance('minor_bending','minor_yield','F6 candidate / DG7 §18.1','Top-T yielding candidate','Ứng viên chảy T trên',n('my_knm'),mpT/1e6,'FLEXURE','Mp=min(Fy Zy,T,1.6 Fy Sy,T)',minorInputs,['D182','F182','AY45'],minorWarnings)
  resistance('minor_bending','minor_flb','F6 candidate / DG7 §18.1','Top-flange local buckling candidate','Ứng viên mất ổn định cục bộ cánh trên',n('my_knm'),Math.min(mpT,minorFLB)/1e6,'FLEXURE','Mn=Mp (compact); Mp−(Mp−0.7Fy Sy,T)(λ−λp)/(λr−λp) (noncompact); 0.69E Sy,T/λ² (slender)',minorInputs,['E189','F196'],minorWarnings)
  const minor = resistance('minor_bending','minor_governing','DG7 / F6 applicability pending','Governing top-T bending candidate','Ứng viên uốn T trên chi phối',n('my_knm'),Math.min(mpT,minorFLB)/1e6,'FLEXURE','Mn=min(Mp,T,Mn,FLB,T)',minorInputs,['H199'],minorWarnings)

  // 7. Dependency-gated H1 screening only, not an assertion of DG7 applicability.
  if (compression?.capacity && major?.capacity && minor.capacity && n('n_kn') <= 0) {
    const axial = compressionDemand/compression.capacity, mx = Math.abs(n('mx_knm'))/major.capacity, my = Math.abs(n('my_knm'))/minor.capacity
    const ratio = axial >= .2 ? axial+8/9*(mx+my) : axial/2+mx+my
    row('biaxial','biaxial_h1','H1-1a / H1-1b (candidate)','Top-flange combined-action screening','Sàng lọc tổ hợp nội lực cánh trên', {demand:ratio,ratio,unit:'',formula:axial>=.2?'Pr/Pc+(8/9)(Mrx/Mcx+Mry/Mcy)':'Pr/(2Pc)+Mrx/Mcx+Mry/Mcy',substitution:`Pr/Pc=${axial}; Mrx/Mcx=${mx}; Mry/Mcy=${my}; η=${ratio}`,worksheet_refs:['G204'],warnings:['Uses candidate governing resistances, never isolated yielding. H1 applicability to the split top-T load path and member stability is not established; no design PASS.']})
  } else pending('biaxial','biaxial_h1','H1 / DG7','Combined top-flange actions','Tổ hợp nội lực cánh trên','Requires all governing strengths and a validated split-section load path. Tensile action also requires rupture/connection checks.',['G204'])

  // 8. J10 nominal equations. Missing edition-verified factor keys are NOT
  // invented or borrowed from G2. Candidates stay nominal-only until verified.
  const wl = n('wlmax_kn'), N = n('bearing_mm'), end = n('end_distance_mm'), tw = d.web_thickness, tt = d.top_flange_thickness
  const jWarnings = ['J10 phi/Omega are not in the approved central registry. Nominal equation is shown; available ASD/LRFD resistance is blocked pending primary-source coefficient review.', 'Direct WLmax is used unchanged; impact/load combinations are not applied again.']
  const yielding = fy*tw*((end > d.depth ? 5 : 2.5)*n('k_mm')+N)/1000
  resistance('wheel_web','web_local_yielding',end>d.depth?'J10-2':'J10-3','Web local yielding','Chảy cục bộ bụng',wl,yielding,null,'Rn=Fy tw (5k+N) interior; Fy tw (2.5k+N) near end',{Fy:fy,tw,k:n('k_mm'),N,end,d:d.depth},['C213'],jWarnings)
  const interior = end >= d.depth/2, bearingRatio = N/d.depth
  const multiplier = interior ? 3*bearingRatio : bearingRatio <= .2 ? 3*bearingRatio : 4*bearingRatio-.2
  const crippling = (interior?.8:.4)*tw**2*Math.sqrt(e*fy*tt/tw)*(1+multiplier*(tw/tt)**1.5)/1000
  resistance('wheel_web','web_crippling',interior?'J10-4':bearingRatio<=.2?'J10-5a':'J10-5b','Web local crippling','Ép nhăn cục bộ bụng',wl,crippling,null,'Rn=(0.8 interior / 0.4 end)tw²√(E Fy tf/tw)[1+α(tw/tf)^1.5]; α=3N/d or 4N/d−0.2',{E:e,Fy:fy,tw,tf:tt,N,d:d.depth,end,alpha:multiplier},['E222','E228','C231'],jWarnings)
  const swayParameter = (h/tw)/(lb/d.top_flange_width), restrained = a.load_flange_rotation === 'RESTRAINED', swayLimit = restrained ? 2.3 : 1.7
  if (a.compression_flange_braced || swayParameter > swayLimit) row('wheel_web','web_sidesway','J10.4','Web sidesway applicability','Phạm vi mất ổn định ngang bụng',{coverage:'NOT_APPLICABLE_PENDING_RESTRAINT_REVIEW',formula:`s=(h/tw)/(Lb/bf); applicability limit=${swayLimit}`,substitution:`s=${swayParameter}; braced=${a.compression_flange_braced}`,worksheet_refs:['B235','AN239:AN240'],warnings:['Exclusion is conditional on verified bracing/rotation assumptions; not a PASS or a fabricated infinite resistance.']})
  else if (!a.wheel_local_moment_known) pending('wheel_web','web_sidesway','J10.4','Web sidesway buckling candidate','Ứng viên mất ổn định ngang bụng','Supply the concurrent major moment at the actual wheel point and load case; a global Mx maximum or the worksheet My is not an acceptable implicit substitute.',['B237:B240'])
  else {
    const majorAtLoad = Math.abs(n('wheel_local_mx_knm'))*(method==='ASD'?1.5:1)*1e6
    const cr = majorAtLoad < myc ? 6.62e6 : 3.31e6
    const sway = cr*tw**3*tt/h**2*(restrained ? 1+.4*swayParameter**3 : .4*swayParameter**3)/1000
    resistance('wheel_web','web_sidesway','J10-6 / J10-7','Web sidesway buckling candidate','Ứng viên mất ổn định ngang bụng',wl,sway,null,'Rn=Cr tw³ tf/h² × [1+0.4s³ restrained / 0.4s³ unrestrained]; Cr depends on local major moment',{Cr:cr,tw,tf:tt,h,s:swayParameter,local_major_Nmm:majorAtLoad,My_Nmm:myc},['D240','B238'],[...jWarnings,'Concurrent local wheel moment is explicitly supplied; original-edition Cr decision rule and restraint applicability remain pending source review.'])
  }

  // 9. G2: no tension-field credit here. Fabrication controls exceptional factors.
  const panel = n('stiffener_spacing_mm')/h, panelLimit = Math.min(3,(260/(h/tw))**2)
  const stiffenerKv = a.transverse_stiffeners && panel <= panelLimit
  const proposedKv = stiffenerKv ? 5+5/panel**2 : 5
  // No higher kv in an available resistance while G3 strength/attachments are
  // unverified. The proposed panel value is retained only as a diagnostic.
  const kv = 5, cv = shearCv(h/tw,kv,e,fy)
  const rolledException = a.fabrication === 'ROLLED' && h/tw <= 2.24*root
  const webNominal = .6*fy*d.depth*tw*(rolledException?1:cv)/1000
  resistance('shear_vertical','shear_g2','G2.1','Vertical web shear without tension-field action','Cắt đứng của bụng không kể trường kéo',n('vy_kn'),webNominal,rolledException?'SHEAR_ROLLED_G21A':'SHEAR_GENERAL','Vn=0.6 Fy Aw Cv; Aw=d tw; kv=5 (no credit for unverified stiffeners)',{h,tw,Aw:d.depth*tw,kv,proposed_kv:proposedKv,Cv:cv,a_h:panel},['C257','AN254'],[...(rolledException?['Rolled exceptional factors require actual rolled fillet geometry; current profile is sharp-corner.']:[]),...(stiffenerKv?['Stiffener rigidity, strength and connections are unverified; proposed higher kv is NOT credited.']:[])])

  // 10. Evaluate flanges separately; no arbitrary half-flange, and kv=1.2.
  for (const [which,b,t] of [['top',d.top_flange_width,d.top_flange_thickness],['bottom',d.bottom_flange_width,d.bottom_flange_thickness]] as const) {
    const lambda = b/(2*t), c = shearCv(lambda,1.2,e,fy), demand = which==='top'?n('vx_kn'):0
    resistance('shear_horizontal',`shear_g7_${which}`,'G7 / G2.1',`${which} flange horizontal shear`, `Cắt ngang cánh ${which==='top'?'trên':'dưới'}`,demand,.6*fy*b*t*c/1000,'SHEAR_GENERAL','Vn=0.6 Fy Af Cv; Af=bf tf; kv=1.2',{bf:b,tf:t,lambda,kv:1.2,Cv:c},['C260:C270'],['Split-section model assigns the complete horizontal shear to the top flange; bottom zero demand is a load-path assumption, not proof of force distribution.'])
  }

  // 11. Fatigue is a stress-range/detail/cycle check, not φRn or an ASD/LRFD
  // force maximum. No hardcoded workbook Fsr/Fth or invented detail category.
  if (a.fatigue_detail_confirmed && n('fatigue_cycles') > 0 && n('fatigue_allowable_range_mpa') > 0) {
    const range = n('fatigue_stress_range_mpa'), allowable = n('fatigue_allowable_range_mpa')
    row('fatigue','fatigue_bottom','Appendix 3 / DG7 (detail review required)','Bottom-flange detail stress range','Biên độ ứng suất chi tiết cánh dưới',{unit:'MPa',demand:range,capacity:allowable,ratio:range/allowable,formula:'Δσdetail/Δσallow(detail category,cycles); service stress history incl. wheel-local stress, no φ/Ω',substitution:`Δσ=${range} MPa; Δσallow=${allowable} MPa; n=${n('fatigue_cycles')}`,worksheet_refs:['B277:B278'],warnings:['Allowable range is an explicit user input; detail category/cycle-law and local wheel stress are not independently validated. Switching method does not change the service fatigue history.']})
  } else pending('fatigue','fatigue_bottom','Appendix 3 / DG7','Bottom-flange fatigue','Mỏi cánh dưới','Requires service stress range including local effects, cycles and a documented detail-specific allowable stress range. Workbook constants alone are insufficient.',['B277:B278'])

  // 12. G3 eligibility, stiffener rigidity, and a conditional tension-field value.
  const eligibility = [
    ['panel_aspect',panel,3,'a/h ≤ 3'],['panel_slenderness',panel,(260/(h/tw))**2,'a/h ≤ [260/(h/tw)]²'],
    ['web_flange_area',2*h*tw/(d.top_flange_width*d.top_flange_thickness+d.bottom_flange_width*d.bottom_flange_thickness),2.5,'2Aw/(Aft+Afb) ≤ 2.5'],
    ['web_top_width',h/d.top_flange_width,6,'h/bft ≤ 6'],['web_bottom_width',h/d.bottom_flange_width,6,'h/bfb ≤ 6'],
  ] as const
  for (const [id,value,limit,formula] of eligibility) row('tension_field',id,'G3.1',formula,formula,{demand:value,ratio:value/limit,substitution:`value=${value}; limit=${limit}; eligible=${value<=limit}`,formula,worksheet_refs:['B285','C288','C290','C293','C295'],warnings:['Geometric eligibility alone does not establish transverse-stiffener or anchorage adequacy.']})
  const bs = n('stiffener_width_mm'), ts = n('stiffener_thickness_mm'), stiffI = 2*ts*((tw/2+bs)**3-(tw/2)**3)/3
  const jStiff = Math.max(2.5/panel**2-2,.5), stiffRequired = n('stiffener_spacing_mm')*tw**3*jStiff
  row('tension_field','stiffener_rigidity','G2.2 / G3.3','Paired transverse-stiffener rigidity screen','Sàng lọc độ cứng cặp sườn ngang',{unit:'mm⁴',demand:stiffRequired,capacity:stiffI,ratio:stiffI>0?stiffRequired/stiffI:null,formula:'Ipaired=2ts[(tw/2+bs)³−(tw/2)³]/3; Ireq=a tw³ max(2.5/(a/h)²−2,0.5)',substitution:`Ipaired=${stiffI}; Ireq=${stiffRequired}; bs/ts=${ts>0?bs/ts:'undefined'}`,warnings:['This is the G2 rigidity screen only; G3 tension-field stiffener strength, area, attachment and end anchorage remain source-review dependent.']})
  const eligible = eligibility.every(([,v,l])=>v<=l) && a.transverse_stiffeners && !a.end_panel && ts>0 && bs>0 && stiffI>=stiffRequired
  if (a.tension_field && eligible) {
    const proposedCv = shearCv(h/tw,proposedKv,e,fy)
    const nominal = .6*fy*h*tw*(proposedCv+(1-proposedCv)/(1.15*Math.sqrt(1+panel**2)))/1000
    const item = resistance('tension_field','tension_field_candidate','G3-1 / G3-2','Conditional interior-panel tension-field candidate','Ứng viên trường kéo khoang trong có điều kiện',n('vy_kn'),nominal,null,'Vn=0.6 Fy h tw [Cv+(1−Cv)/(1.15√(1+(a/h)²))]',{Fy:fy,h,tw,Cv:proposedCv,a_h:panel},['E298'],['Nominal diagnostic only; no available strength, D/C or governing credit until G3 stiffener strength/area/attachment and anchorage are verified.'])
    item.coverage = 'CONDITIONAL_NOT_GOVERNING'
  } else pending('tension_field','tension_field_candidate','G3','Tension-field action excluded / not established','Chưa đủ điều kiện xét trường kéo','Requires selected tension-field action, eligible interior panel, adequate paired stiffeners, strength and connection verification. Failed geometric limits are not silently ignored.',['E298'])
  pending('tension_field','stiffener_strength','G3.3','Tension-field stiffener strength and attachment','Sức chịu lực và liên kết sườn do trường kéo','G3 area/force/attachment equations require original-edition and stiffener-detail verification; rigidity alone is insufficient.')

  // Reject numerical overflow, including nominal and trace outputs, before export.
  for (const group of groups) for (const check of group.checks) for (const key of ['nominal','capacity','available_asd','available_lrfd','ratio','demand'] as const) {
    if (check[key] !== null && !Number.isFinite(check[key])) throw new RangeError(`Non-finite ${check.id}.${key}`)
  }
  return { edition:'AISC360-10',method,summary_status:'NOT VERIFIED' as const,groups,
    derived:{classification:{majorWeb,minorClass,kc,lambda_pw:lpW,lambda_rw:lrW},compression:compTrace,major:majorTrace,minor:minorInputs,shear:{kv,proposed_kv:proposedKv,cv,panel_ratio:panel},tension_field_eligible:Boolean(eligible)},
    source_review:{primary_aisc:'PENDING_SOURCE_ACCESS',dg7_split_section:'PENDING_SOURCE_ACCESS',workbook:'SAVED_CACHE_REGRESSION_ONLY'},
    note:'ASD/LRFD alter resistance only. Actions, fatigue history and deflections are never automatically converted. All statuses remain NOT VERIFIED until formula, applicability and benchmark evidence are reviewed.',
  }
}
