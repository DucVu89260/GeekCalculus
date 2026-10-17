/** Chapter C is a required-strength contract with an EXTERNAL structural analysis.
 * This module checks explicit declarations, never performs/claims a frame analysis.
 */
export const STABILITY_SOURCE = Object.freeze({edition:'AISC360-10',
  sha256:'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99',
  physical_pages:[76,77,78,79,80,81],printed_pages:['16.1-20','16.1-21','16.1-22','16.1-23','16.1-24','16.1-25']});
const requirements=Object.freeze({
  second_order_global_confirmed:'C2.1: second-order structural response including P-Δ and P-δ',
  member_p_delta_confirmed:'C2.1: individual member P-δ included',
  imperfections_confirmed:'C2.2: modeled imperfections or required notional loads included',
  reduced_stiffness_confirmed:'C2.3: 0.8 stability stiffness and 0.8τb flexural stiffness (or the prescribed extra-notional-load alternative)',
  all_loads_confirmed:'C2.1: all destabilizing gravity/applied loads included',
  bracing_confirmed:'C3 / Appendix 6: brace strengths/stiffness and actual brace points verified',
});
/** Component's explicit gross-member scope accepts externally analysed forces.
 * ASSUMED records the calculation basis; it never asserts the SAP model was checked.
 * C3 (physical81 / printed16.1-25) sets K=1 for Direct Analysis under C2.
 */
export function reviewGrossIHAnalysis(input) {
  const missing=[], m=input.member||{},a=input.analysis||{};
  if(a.method && a.method!=='DIRECT')missing.push('This gross-member workflow uses external Direct Analysis with C3 K=1.');
  if(['kx','ky','kz'].some(key=>m[key]!==1))missing.push('AISC 360-10 C3: use Kx=Ky=Kz=1 for the external Direct Analysis basis.');
  if(input.material?.e_mpa!==200000||m.g_mpa!==77200)missing.push('Use nominal AISC E=200,000 MPa and G=77,200 MPa in member resistance checks.');
  const manual=input.assessment?.force_source==='MANUAL';
  const load_basis={id:'LOAD_BASIS',status:manual?'CONFIRMED':'INPUT_REQUIRED',clause:'B3.3/B3.4',source:STABILITY_SOURCE,
    reason:manual?'Manual forces use the selected ASD/LRFD method; values are not converted.':'SAP2000 integration is pending; supply manual forces using the selected ASD/LRFD method.',
    trace:{force_source:input.assessment?.force_source??null,resistance_method:input.method,automatic_conversion:false}};
  return {load_basis,analysis:{id:'ANALYSIS',status:missing.length?'INPUT_REQUIRED':'ASSUMED',clause:'C2/C3',source:STABILITY_SOURCE,
    reason:missing.length?missing.join('; '):'External Chapter C2 Direct Analysis is the supplied-force basis; C3 uses K=1. The software model is not verified by this component.',
    trace:{method:'EXTERNAL_DIRECT_ANALYSIS',model_verified:false,k_unity_basis:'C3',missing,
      lengths:'Lx, Ly, Lz and Lb are independent physical restraint lengths; K=1 does not replace these lengths.',
      nominal_moduli:'Chapter E/F resistances use nominal E/G; C2 stiffness reductions belong to the external analysis.',
      asd_basis:'External ASD Direct Analysis follows C2.1(4): analyse at 1.6 times ASD loads and divide resulting required strengths by 1.6; no conversion here.'}}};
}
export function reviewIHAnalysis(input,canonical) {
  if(input.assessment?.scope==='GROSS_MEMBER')return reviewGrossIHAnalysis(input);
  const a=input.analysis||{},missing=[];
  const loadMatches=['LRFD','ASD'].includes(a.forces_method)&&a.forces_method===input.method;
  const load_basis={id:'LOAD_BASIS',status:loadMatches?'CONFIRMED':'INPUT_REQUIRED',clause:'B3.3/B3.4/C2.1(4)',
    reason:loadMatches?'Manual simultaneous forces declared for the selected design method; no automatic load conversion.':'Declare whether the supplied forces are ASD or LRFD; this must match the resistance method. Forces are never converted automatically.',
    trace:{input_method:a.forces_method??null,resistance_method:input.method},source:STABILITY_SOURCE};
  if(a.method!=='DIRECT') missing.push('Direct Analysis is not declared. User K factors can give reference capacities, but Appendix 7 eligibility is not verified by this module.');
  for(const [field,label] of Object.entries(requirements))if(a[field]!==true)missing.push(label);
  if(input.method==='ASD'&&a.asd_scaling_confirmed!==true)missing.push('C2.1(4): analysis at 1.6× ASD combinations, then results divided by 1.6');
  if(typeof a.evidence!=='string'||a.evidence.trim().length<10)missing.push('Record model/analysis and load-combination evidence (at least 10 characters).');
  if(a.method==='DIRECT'&&['kx','ky','kz'].some(k=>input.member?.[k]!==1))missing.push('C3: this supported Direct Analysis path uses Kx=Ky=Kz=1. Rational K<1 needs a separate justification.');
  if(a.method==='DIRECT'&&input.member?.g_mpa!==77200)missing.push('E4 steel shear modulus G=77,200 MPa must be used in the supported source-specific Direct Analysis member check.');
  if(a.method==='DIRECT'&&input.material?.e_mpa!==200000)missing.push('E3/F1 steel elastic modulus E=200,000 MPa is required for the supported AISC 360-10 steel check.');
  const fy=input.material?.fy_mpa,ag=canonical.area_mm2;
  const alpha=input.method==='ASD'?1.6:1,pr=Math.max(0,-input.forces.axial_kN),py=fy*ag/1000;
  const ratio=alpha*pr/py,tau=ratio<=.5?1:4*ratio*(1-ratio);
  return {load_basis,analysis:{id:'ANALYSIS',status:missing.length?'INPUT_REQUIRED':'CONFIRMED',clause:'C1/C2/C3',source:STABILITY_SOURCE,
    reason:missing.length?missing.join('; '):'External Direct Analysis and brace conditions explicitly confirmed by the user; the frame analysis itself is not reproduced here.',
    trace:{method:a.method??'UNSPECIFIED',missing,evidence:a.evidence??'',k_unity_basis:'C3',
      lengths:'Lx/Ly = lateral restraint lengths for each compression axis; Lz = torsional restraint length; Lb = compression-flange lateral/twist restraint length. No equality is inferred.',
      alpha,alpha_pr_over_py:ratio,required_tau_b:tau,analysis_axial_stiffness_factor:.8,analysis_flexural_stiffness_factor:.8*tau,
      capacity_modulus:'Use nominal E/G in Chapters E/F; the 0.8τb reductions belong to the structural analysis, not to the member resistance equations.',
      asd_requirement:'1.6× ASD combination analysis, results divided by 1.6; no scaling is performed by this module'}}};
}

export function assessIHMemberCompliance(input,result) {
  const gross=input.assessment?.scope==='GROSS_MEMBER';
  const n=input.forces.axial_kN,mx=input.forces.moment_x_kNm,my=input.forces.moment_y_kNm;
  const states=result.limit_states,c=input.compliance||{},checks=[],blockers=[];
  const addBlock=(key,reason)=>blockers.push({key,reason});
  for(const key of ['analysis','load_basis'])if(!(states[key]?.status==='CONFIRMED'||(gross&&key==='analysis'&&states[key]?.status==='ASSUMED')))addBlock(key,states[key]?.reason||'Required analysis/load-basis declaration is missing.');
  if(input.section.fabrication!=='BUILT_UP')addBlock('geometry','Rolled fillets and actual catalogue properties are not represented by the sharp-corner geometric model; use an independently verified catalogue geometry before member approval.');
  if(!['WELDED','CONTINUOUS_WELDED_PLATES'].includes(input.section.web_attachment))addBlock('web_attachment','Member Compliance requires explicit continuous welded rectangular plates. Bolted built-up member attachment/E6 is outside this supported scope.');
  if(!gross&&c.scope_confirmed!==true)addBlock('scope','Confirm static, prismatic, doubly symmetric welded I/H with rectangular plates; no hybrid steel, cover plates, web openings or moment redistribution.');
  if(!gross&&c.envelope_confirmed!==true)addBlock('envelope','Confirm all critical locations/combinations were evaluated and these simultaneous section forces represent the governing member check.');
  if(!gross&&c.other_limit_states_confirmed!==true)addBlock('other_limit_states','Connections, brace design, local concentrated-force effects (J10), fatigue and serviceability must be verified separately or explicitly inapplicable.');
  if(input.forces.torsion_kNm!==0)addBlock('torsion','Explicit zero torsion is required in the supported H1/G7 scope; nonzero torsion needs Chapter H3 checks.');
  const demanded=[['compression',n<0,-n],['tension',n>0,n],['major_flexure',mx!==0,Math.abs(mx)],['minor_flexure',my!==0,Math.abs(my)],
    ['interaction',true,states.interaction?.nominal],['shear_web',input.forces.shear_y_kN!==0,Math.abs(input.forces.shear_y_kN)],
    ['shear_flange',input.forces.shear_x_kN!==0,Math.abs(input.forces.shear_x_kN)]];
  // Connection-aware scope needs a declared hole path; gross-member scope excludes local-hole checks.
  if(!gross&&states.net_section?.status!=='CALCULATED')addBlock('net_section',states.net_section?.reason||'Declare the critical hole path.');
  for(const key of ['flange_hole_interaction','stiffeners','tension_field_action','proportion_limits']){
    const entry=states[key];
    if(!entry)continue;
    if(['INPUT_REQUIRED','REVIEW_REQUIRED'].includes(entry.status))addBlock(key,entry.reason);
    else if(entry.status==='FAIL')checks.push({key,status:'FAIL',utilization:entry.utilization??null,reason:entry.reason});
    else if(entry.status==='CALCULATED'&&entry.unit==='ratio')checks.push({key,status:entry.nominal<=1?'PASS':'FAIL',utilization:entry.nominal,clause:entry.clause});
  }
  for(const [key,applicable,demand] of demanded){
    if(!applicable)continue;
    const entry=states[key];
    if(entry?.status!=='CALCULATED'||!Number.isFinite(demand)||!Number.isFinite(entry.available)||entry.available<=0){addBlock(key,entry?.reason||'Required resistance/demand is incomplete.');continue;}
    const utilization=demand/entry.available;
    checks.push({key,status:utilization<=1?'PASS':'FAIL',demand,available:entry.available,utilization,clause:entry.clause});
  }
  const failed=checks.some(c=>c.status==='FAIL');
  const utilization=Math.max(0,...checks.map(c=>c.utilization).filter(Number.isFinite));
  return {status:blockers.length?'REVIEW_REQUIRED':failed?'FAIL':'PASS',scope:gross?'GROSS_SECTION_MEMBER_STRENGTH':'MEMBER_STRENGTH_WITHIN_DECLARED_SCOPE',
    summary:gross?'Gross-section built-up I/H member strength at the entered forces, with external Direct Analysis assumed.':'AISC 360-10 supported member-strength checks at the declared governing section/load combination; external frame analysis and out-of-scope checks remain the engineer’s responsibility.',
    source:STABILITY_SOURCE,checks,blockers,utilization,
    approval_basis:gross?'Gross member calculations with an external Direct Analysis assumption; no SAP model or connection approval.':'Numerical capacities and explicit user declarations; not an automatic certification of the structural model or complete project.'};
}
