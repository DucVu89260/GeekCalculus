import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateIH36010} from '../../../../standards/aisc360-10-verified-hi.mjs';
const coeff=JSON.parse(readFileSync(new URL('../../../../standards/aisc360-10-strength-factors.json',import.meta.url))).factors;
const factors={availableStrength:(n,m,key)=>m==='LRFD'?n*coeff[key].phi:n/coeff[key].omega};
// Independent rectangle integration; unchanged gross d300/b150/tf12/tw8 fixture.
const props={area_mm2:5808,ix_mm4:88709184,iy_mm4:6761776,sx_mm3:591394.56,sy_mm3:90157.0133333333,
 zx_mm3:670752,zy_mm3:139416,rx_mm:Math.sqrt(88709184/5808),ry_mm:Math.sqrt(6761776/5808),torsion_constant_j_mm4:160000,warping_constant_cw_mm6:140000000000};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
function input(method='LRFD') {return {method,assessment:{scope:'GROSS_MEMBER',force_source:'MANUAL'},
 section:{h_mm:300,bf_mm:150,tw_mm:8,tf_mm:12,fabrication:'BUILT_UP',web_attachment:'WELDED'},
 material:{fy_mpa:345,e_mpa:200000},member:{kx:1,ky:1,kz:1,lx_mm:3000,ly_mm:2000,lz_mm:2000,lb_mm:500,g_mpa:77200},
 forces:{axial_kN:200,moment_x_kNm:100,moment_y_kNm:10,shear_x_kN:0,shear_y_kN:0,torsion_kNm:0},stiffeners:{spacing_mm:0}};}
const run=i=>calculateIH36010(i,props,factors);
test('gross ASD/LRFD capacities and biaxial H1 match independent hand calculations without connection flags',()=>{
 for(const method of ['LRFD','ASD']){
  const i=input(method),r=run(i),lrfd=method==='LRFD';
  near(r.limit_states.major_flexure.nominal,231.40944);
  near(r.limit_states.minor_flexure.nominal,48.09852);
  near(r.limit_states.major_flexure.available,lrfd?208.268496:231.40944/1.67);
  near(r.limit_states.minor_flexure.available,lrfd?43.288668:48.09852/1.67);
  near(r.limit_states.tension.available,lrfd?1803.384:2003.76/1.67);
  const eta=200/(lrfd?1803.384:2003.76/1.67)/2+100/(lrfd?208.268496:231.40944/1.67)+10/(lrfd?43.288668:48.09852/1.67);
  near(r.limit_states.interaction.nominal,eta);
  assert.equal(r.overall_status,lrfd?'PASS':'FAIL');
  assert.equal(r.member_compliance.scope,'GROSS_SECTION_MEMBER_STRENGTH');
  assert.equal(r.analysis_basis.analysis.status,'ASSUMED');
  assert.equal(r.analysis_basis.analysis.trace.model_verified,false);
  assert.equal(r.analysis_basis.analysis.source.physical_pages.includes(81),true);
  for(const key of ['analysis','load_basis','net_section','flange_holes','flange_hole_interaction'])assert.equal(Object.hasOwn(r.limit_states,key),false);
 }
});
test('only explicit gross scope bypasses local-hole assessment; connection-aware mode stays blocked',()=>{
 const i=input(),r=run(i);i.holes={pattern:'STAGGERED',top_flange_count:2};i.tension_connection={load_transfer:'UNSUPPORTED'};
 near(run(i).limit_states.major_flexure.available,r.limit_states.major_flexure.available);
 delete i.assessment;
 assert.notEqual(run(i).overall_status,'PASS');
 assert.equal(run(i).limit_states.net_section.status,'INPUT_REQUIRED');
});
test('C3 external Direct Analysis computes compression without fictitious C2 confirmations',()=>{
 const i=input();i.forces.axial_kN=-200;i.analysis={method:'DIRECT',second_order_global_confirmed:false};
 const r=run(i);assert.equal(r.limit_states.compression.status,'CALCULATED');
 assert.notEqual(r.limit_states.compression.trace.fex_mpa,r.limit_states.compression.trace.fey_mpa);
 assert.equal(r.limit_states.interaction.status,'CALCULATED');assert.equal(r.analysis_basis.analysis.trace.model_verified,false);
});
test('C3 K and material assumptions remain enforceable while flexural capacities stay visible',()=>{
 for(const mutate of [i=>i.member.ky=2,i=>i.material.e_mpa=160000,i=>i.member.g_mpa=70000,i=>i.analysis={method:'USER_K'}]){
  const i=input();i.forces.axial_kN=-200;mutate(i);const r=run(i);
  assert.equal(r.limit_states.compression.status,'INPUT_REQUIRED');assert.equal(r.overall_status,'REVIEW_REQUIRED');
  assert.equal(r.limit_states.major_flexure.status,'CALCULATED');assert.equal(r.limit_states.minor_flexure.status,'CALCULATED');
 }
});
test('unsupported member geometry, torsion, missing restraint and pending API never get gross-member PASS',()=>{
 for(const mutate of [i=>i.section.fabrication='ROLLED',i=>i.section.web_attachment='BOLTED',i=>i.forces.torsion_kNm=1,
  i=>{i.forces.axial_kN=-200;delete i.member.ly_mm},i=>i.assessment.force_source='SAP2000']){
  const i=input();mutate(i);assert.notEqual(run(i).overall_status,'PASS');
 }
});
test('manual demand does not rescale between methods; signs and zero actions retain complete H1',()=>{
 const i=input(),forces=structuredClone(i.forces);run(i);i.method='ASD';run(i);assert.deepEqual(i.forces,forces);
 i.method='LRFD';const positive=run(i);i.forces.moment_x_kNm*=-1;i.forces.moment_y_kNm*=-1;
 near(run(i).limit_states.interaction.nominal,positive.limit_states.interaction.nominal);
 Object.assign(i.forces,{axial_kN:0,moment_x_kNm:0,moment_y_kNm:0});near(run(i).limit_states.interaction.nominal,0);
});
