import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FORMULAS, classifyI, cbF11, calculateIH36010 } from '../../../../standards/aisc360-10-verified-hi.mjs';
const base=join(dirname(fileURLToPath(import.meta.url)),'../../../../standards');
const factors=JSON.parse(readFileSync(join(base,'aisc360-10-strength-factors.json'),'utf8')).factors;
const lib={
 availableStrength(n,method,key){
  const f=factors[key];assert.ok(f,'Missing AISC coefficient '+key);
  return method==='LRFD'?f.phi*n:n/f.omega;
 }
};
const props=Object.freeze({
 area_mm2:12000,ix_mm4:1.5e9,iy_mm4:5e7,sx_mm3:3.75e6,sy_mm3:4e5,
 zx_mm3:4e6,zy_mm3:6e5,rx_mm:353.5533906,ry_mm:64.5497224,
 torsion_constant_j_mm4:5e5,warping_constant_cw_mm6:2.9e12
});
const baseInput={
 method:'LRFD',section:{h_mm:800,bf_mm:250,tf_mm:16,tw_mm:24,fabrication:'BUILT_UP'},
 material:{fy_mpa:345,e_mpa:200000},
 member:{kx:1,ky:1,kz:1,lx_mm:5000,ly_mm:4000,lz_mm:4000,lb_mm:3000,g_mpa:77000},
 moment_diagram:{mode:'CONSERVATIVE'},
 forces:{axial_kN:-120,moment_x_kNm:140,moment_y_kNm:20}
};
const copy=()=>structuredClone(baseInput);
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`Expected ${a} near ${b}`);
test('Phase A registry preserves specific original 2010 clauses and correct B4 distinction',()=>{
 for(const id of ['B4.1a-2','B4.1b-11','E3-4','E4-4','F2-6','F3-2','F6-4','H1-1a'])
  assert.ok(FORMULAS[id]?.clause);
 const t=classifyI(copy());
 assert.equal(t.axial,'NONSLENDER');assert.equal(t.flexureWeb,'COMPACT');assert.equal(t.flexureChapter,'F2');
 near(t.limits.lrMajorFlange,.95*Math.sqrt(t.kc*200000/(.7*345)));
 near(t.flangeCompressionLimit,.64*Math.sqrt(t.kc*200000/345));
});
test('E3 uses different Euler Fe values for x/y and includes torsional E4 limit state',()=>{
 const r=calculateIH36010(copy(),props,lib);
 assert.equal(r.limit_states.compression.status,'CALCULATED');
 const t=r.limit_states.compression.trace;
 near(t.fex_mpa,Math.PI**2*200000/(5000/props.rx_mm)**2);
 near(t.fey_mpa,Math.PI**2*200000/(4000/props.ry_mm)**2);
 assert.notEqual(t.fex_mpa,t.fey_mpa);
 near(t.fez_mpa,(Math.PI**2*200000*props.warping_constant_cw_mm6/4000**2+
  77000*props.torsion_constant_j_mm4)/(props.ix_mm4+props.iy_mm4));
 const asd=copy();asd.method='ASD';
 const v=calculateIH36010(asd,props,lib);
 near(v.limit_states.compression.nominal,r.limit_states.compression.nominal);
 near(v.limit_states.compression.available,r.limit_states.compression.nominal/1.67);
 near(r.limit_states.compression.available,r.limit_states.compression.nominal*.9);
});
test('missing Ky, Ly, torsion restraint and G fail closed, never infer Ly=Lb',()=>{
 const a=copy();delete a.member.ly_mm;
 assert.equal(calculateIH36010(a,props,lib).limit_states.compression.status,'INPUT_REQUIRED');
 const b=copy();delete b.member.lz_mm;
 const entry=calculateIH36010(b,props,lib).limit_states.compression;
 assert.equal(entry.status,'INPUT_REQUIRED');
 assert.ok(entry.trace.fcrx_mpa>0&&entry.trace.fcry_mpa>0);
});
test('F2 major, F6 minor and H1 report clause-linked nominal and ASD ratios',()=>{
 const a=calculateIH36010(copy(),props,lib);
 assert.equal(a.limit_states.major_flexure.status,'CALCULATED');
 assert.equal(a.limit_states.major_flexure.clause,'F2');
 assert.equal(a.limit_states.minor_flexure.status,'CALCULATED');
 assert.equal(a.limit_states.interaction.status,'CALCULATED');
 const d=copy();d.method='ASD';
 const b=calculateIH36010(d,props,lib);
 near(a.limit_states.major_flexure.nominal,b.limit_states.major_flexure.nominal);
 near(b.limit_states.major_flexure.available,b.limit_states.major_flexure.nominal/1.67);
 assert.ok(b.limit_states.interaction.nominal>a.limit_states.interaction.nominal);
 assert.equal(b.overall_status,'REVIEW_REQUIRED');
});
test('F2 uses piecewise LTB and remains bounded by Mp',()=>{
 for(const lb of [400,4000,12000]){
  const d=copy();d.member.lb_mm=lb;
  const a=calculateIH36010(d,props,lib).limit_states.major_flexure;
  assert.equal(a.status,'CALCULATED');
  assert.ok(a.nominal<=345*props.zx_mm3/1e6+1e-6);
  assert.ok(a.nominal>0);
 }
});
test('F3 compact web but noncompact/slender flange computes FLB not F2',()=>{
 for(const tf of [8,5]){
  const d=copy();d.section.tf_mm=tf;
  const a=calculateIH36010(d,props,lib);
  assert.equal(a.classification.flexureWeb,'COMPACT');
  assert.equal(a.classification.flexureChapter,'F3');
  assert.equal(a.limit_states.major_flexure.clause,'F3');
  assert.ok(['F3-1','F3-2'].includes(a.limit_states.major_flexure.trace.flb_clause));
 }
});
test('2010 B4/F5 deliberately blocks slender-web major flexure and E7',()=>{
 const d=copy();d.section.tw_mm=5;
 const r=calculateIH36010(d,props,lib);
 assert.equal(r.classification.flexureChapter,'F5');
 assert.equal(r.limit_states.major_flexure.status,'REVIEW_REQUIRED');
 assert.equal(r.limit_states.compression.status,'REVIEW_REQUIRED');
 assert.equal(r.limit_states.interaction.status,'INPUT_REQUIRED');
 assert.equal(r.limit_states.minor_flexure.status,'CALCULATED');
});
test('F1-1 uses absolute moment magnitudes and single-segment validation',()=>{
 const value=cbF11({mode:'QUARTER_POINTS',ends_braced:true,same_case:true,
  mmax:-200,ma:-140,mb:120,mc:-60});
 near(value.value,12.5*200/(2.5*200+3*140+4*120+3*60));
 assert.equal(cbF11({mode:'CONSERVATIVE'}).value,1);
 assert.equal(cbF11({mode:'QUARTER_POINTS',ends_braced:true,same_case:false,
  mmax:200,ma:120,mb:80,mc:10}).source,'REVIEW_REQUIRED');
});
test('H1 requires verified axial strength and both bending resistances; no phantom PASS',()=>{
 const tension=copy();tension.forces.axial_kN=200;
 const result=calculateIH36010(tension,props,lib);
 assert.equal(result.limit_states.tension.status,'INPUT_REQUIRED');
 assert.equal(result.limit_states.interaction.status,'INPUT_REQUIRED');
 assert.equal(result.overall_status,'REVIEW_REQUIRED');
});
