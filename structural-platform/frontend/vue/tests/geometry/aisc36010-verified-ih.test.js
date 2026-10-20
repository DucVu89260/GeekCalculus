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
 method:'LRFD',section:{h_mm:800,bf_mm:250,tf_mm:16,tw_mm:24,fabrication:'BUILT_UP',web_attachment:'WELDED'},
 material:{fy_mpa:345,e_mpa:200000},
 member:{kx:1,ky:1,kz:1,lx_mm:5000,ly_mm:4000,lz_mm:4000,lb_mm:3000,g_mpa:77000},
 moment_diagram:{mode:'CONSERVATIVE'},
 forces:{axial_kN:-120,moment_x_kNm:140,moment_y_kNm:20,shear_x_kN:0,shear_y_kN:0,torsion_kNm:0},
 holes:{pattern:'STRAIGHT',top_flange_count:0,bottom_flange_count:0,web_count:0,critical_path_confirmed:true}
};
const copy=()=>structuredClone(baseInput);
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`Expected ${a} near ${b}`);
test('Phase A registry preserves specific original 2010 clauses and correct B4 distinction',()=>{
 for(const id of ['B4.1a-2','B4.1b-11','E3-4','E4-4','E7-17','F2-6','F3-2','F5-6','F6-4','H1-1a'])
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
test('missing or nonfinite Cw is not coerced to zero in E4 torsional buckling',()=>{
 for(const cw of [null,undefined,NaN,Infinity]){
  const result=calculateIH36010(copy(),{...props,warping_constant_cw_mm6:cw},lib);
  assert.equal(result.limit_states.compression.status,'INPUT_REQUIRED');
  assert.equal(result.limit_states.major_flexure.status,'INPUT_REQUIRED');
  assert.equal(result.limit_states.interaction.status,'INPUT_REQUIRED');
 }
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
test('2010 E7 + F5 evaluate slender-web I branch from original equations',()=>{
 const d=copy();d.section.tw_mm=5;
 const r=calculateIH36010(d,props,lib);
 assert.equal(r.classification.flexureChapter,'F5');
 assert.equal(r.limit_states.major_flexure.status,'CALCULATED');
 assert.equal(r.limit_states.compression.status,'CALCULATED');
 assert.equal(r.limit_states.major_flexure.clause,'F5-1/F5-2/F5-7');
 const f5=r.limit_states.major_flexure.trace;
 const hw=d.section.h_mm-2*d.section.tf_mm;
 const aw=Math.min(10,hw*d.section.tw_mm/(d.section.bf_mm*d.section.tf_mm));
 const expectedRpg=1-aw/(1200+300*aw)*(hw/d.section.tw_mm-5.7*Math.sqrt(d.material.e_mpa/d.material.fy_mpa));
 near(f5.rpg,expectedRpg);
 assert.ok(f5.rpg>0&&f5.rpg<=1);
 assert.ok(r.limit_states.compression.trace.qa<1);
 assert.equal(r.limit_states.compression.trace.qs,1);
 assert.ok(r.limit_states.compression.trace.effective_web_mm<hw);
 assert.ok(r.limit_states.major_flexure.nominal>0);
 assert.equal(r.limit_states.minor_flexure.status,'CALCULATED');
 assert.equal(r.overall_status,'REVIEW_REQUIRED');
});
test('E7 flange Qs follows built-up and rolled limits without global PASS',()=>{
 for(const fabrication of ['BUILT_UP','ROLLED']){
  const d=copy();d.section.fabrication=fabrication;d.section.tf_mm=3;d.section.tw_mm=24;
  const r=calculateIH36010(d,props,lib);
  assert.equal(r.classification.axialFlange,'SLENDER');
  assert.equal(r.limit_states.compression.status,'CALCULATED');
  assert.ok(r.limit_states.compression.trace.qs<1);
  assert.ok(r.limit_states.compression.trace.qs>0);
  assert.equal(r.limit_states.compression.trace.qa,1);
  assert.equal(r.overall_status,'REVIEW_REQUIRED');
 }
});
test('F1-1 uses absolute moment magnitudes and single-segment validation',()=>{
 const value=cbF11({mode:'QUARTER_POINTS',ends_braced:true,same_case:true,segment_maximum_confirmed:true,
  mmax:-200,ma:-140,mb:120,mc:-60});
 near(value.value,12.5*200/(2.5*200+3*140+4*120+3*60));
 assert.equal(cbF11({mode:'CONSERVATIVE'}).value,1);
 assert.equal(cbF11({mode:'QUARTER_POINTS',ends_braced:true,same_case:false,
  mmax:200,ma:120,mb:80,mc:10}).source,'REVIEW_REQUIRED');
});
test('quarter points alone cannot confirm the segment extreme used by F1-1',()=>{
 const diagram={mode:'QUARTER_POINTS',ends_braced:true,same_case:true,mmax:200,ma:140,mb:120,mc:60};
 assert.equal(cbF11(diagram).value,null);
 assert.match(cbF11(diagram).reason,/entire unbraced segment/);
 near(cbF11({...diagram,segment_maximum_confirmed:true}).value,2500/1580);
});
test('Chapter G now supplies source-specific shear without inheriting workbook capacities',()=>{
 const input=copy();input.forces.shear_y_kN=-120;input.forces.shear_x_kN=0;
 input.stiffeners={spacing_mm:1500};
 const result=calculateIH36010(input,props,lib);
 assert.equal(result.limit_states.shear_web.status,'CALCULATED');
 assert.equal(result.limit_states.shear_web.demand,120);
 near(result.limit_states.shear_web.nominal,3974.4); // G2: 0.6×345×(800×24)/1000, Cv=1.
 near(result.limit_states.shear_web.available,3576.96);
 assert.equal(result.limit_states.shear_flange.status,'NOT_APPLICABLE');
 assert.equal(result.limit_states.stiffeners.status,'NOT_REQUIRED'); // kv=5 alone carries the demand.
 assert.equal(result.overall_status,'REVIEW_REQUIRED');
 delete input.forces.shear_x_kN;
 assert.equal(calculateIH36010(input,props,lib).limit_states.shear_flange.status,'INPUT_REQUIRED');
});
test('H1 requires verified axial strength and both bending resistances; no phantom PASS',()=>{
 const tension=copy();tension.forces.axial_kN=200;
 const result=calculateIH36010(tension,props,lib);
 assert.equal(result.limit_states.tension.status,'INPUT_REQUIRED');
 assert.equal(result.limit_states.interaction.status,'INPUT_REQUIRED');
 assert.equal(result.overall_status,'REVIEW_REQUIRED');
});

// Independent F1-1 hand checks: values below are ratios of small integers,
// not expected values generated by the production Cb implementation.
const verifiedDiagram=(mmax,ma,mb,mc)=>({mode:'QUARTER_POINTS',ends_braced:true,
 same_case:true,segment_maximum_confirmed:true,mmax,ma,mb,mc});
test('F1-1 hand diagrams, sign/scale invariance and no unsupported universal 2.3 cap',()=>{
 const fixtures=[
  [100,100,100,100,1], // uniform: 1250/1250
  [100,75,50,25,5/3], // triangular: 1250/750
  [100,-50,0,50,25/11], // reverse curvature: 1250/550
  [100,75,100,75,25/22], // simply supported uniform-load parabola: 1250/1100
  [100,0,0,0,5], // exported interior peak between quarter points: 1250/250
 ];
 for(const [peak,a,b,c,expected] of fixtures)for(const scale of [1,-1,1e-300,1e300]){
  const result=cbF11(verifiedDiagram(peak*scale,a*scale,b*scale,c*scale));
  assert.ok(Number.isFinite(result.value));near(result.value,expected,1e-13);
  assert.ok(result.value>=1&&result.value<=5);
 }
 // Finite moments can overflow the original weighted numerator/denominator.
 near(cbF11(verifiedDiagram(1e308,1e308,1e308,1e308)).value,1);
 // Subnormal inputs used to underflow 12.5*Mmax and distort a valid ratio.
 near(cbF11(verifiedDiagram(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE)).value,1);
});
test('F1-1 zero, invalid maxima and explicit free-end declarations fail safely',()=>{
 assert.equal(cbF11(verifiedDiagram(0,0,0,0)).value,1);
 assert.equal(cbF11(verifiedDiagram(0,1,0,0)).value,null);
 assert.equal(cbF11(verifiedDiagram(10,11,0,0)).value,null);
 for(const bad of [NaN,Infinity,-Infinity,'100',null])assert.throws(()=>cbF11(verifiedDiagram(bad,1,1,1)),/finite/);
 assert.equal(cbF11({mode:'QUARTER_POINTS',is_unbraced_cantilever:true}).value,1);
 assert.equal(cbF11({mode:'QUARTER_POINTS',is_unbraced_cantilever:'false'}).value,null);
});
test('F1-1 feeds F2/F4/F5 LTB only; yielding/local limits and ASD/LRFD remain independent',()=>{
 for(const tw of [24,7,5]){
  const input=copy();input.section.tw_mm=tw;input.member.lb_mm=12000;
  input.moment_diagram=verifiedDiagram(100,-50,0,50);
  const gradient=calculateIH36010(input,props,lib),major=gradient.limit_states.major_flexure;
  assert.equal(major.status,'CALCULATED');near(major.trace.cb,25/11);
  const uniform=copy();uniform.section.tw_mm=tw;uniform.member.lb_mm=12000;
  const base=calculateIH36010(uniform,props,lib);
  const t=major.trace, bt=base.limit_states.major_flexure.trace;
  near(t.mn_ltb_kNm,Math.min(t.mn_yield_kNm??t.mn_compression_flange_yielding_kNm??t.mp_kNm,
   bt.mn_ltb_kNm*25/11));
  assert.ok(major.nominal>=base.limit_states.major_flexure.nominal-1e-8);
  near(gradient.limit_states.compression.nominal,base.limit_states.compression.nominal);
  near(gradient.limit_states.minor_flexure.nominal,base.limit_states.minor_flexure.nominal);
  const asd=structuredClone(input);asd.method='ASD';const strength=calculateIH36010(asd,props,lib).limit_states.major_flexure;
  near(strength.nominal,major.nominal);near(strength.available,major.nominal/1.67);
  near(major.available,major.nominal*.9);
 }
});
