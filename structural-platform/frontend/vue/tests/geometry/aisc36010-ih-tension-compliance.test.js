import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateIHNetSection,calculateIHTension,calculateIHFlangeHoles} from '../../../../standards/aisc360-10-ih-tension.mjs';
import {calculateIH36010} from '../../../../standards/aisc360-10-verified-hi.mjs';
import {reviewIHAnalysis} from '../../../../standards/aisc360-10-ih-compliance.mjs';

const coefficients=JSON.parse(readFileSync(new URL('../../../../standards/aisc360-10-strength-factors.json',import.meta.url))).factors;
const lib={availableStrength:(n,m,k)=>m==='LRFD'?n*coefficients[k].phi:n/coefficients[k].omega};
// Independent rectangle hand properties for d300/b150/tf12/tw8. Source D2/F13/H4
// checked on actual PDF SHA f9b150...f4e99, physical74,82–84,120,135–136.
const props={area_mm2:5808,ix_mm4:88709184,iy_mm4:6761776,sx_mm3:591394.56,sy_mm3:90157.0133333333,
  zx_mm3:670752,zy_mm3:139416,rx_mm:Math.sqrt(88709184/5808),ry_mm:Math.sqrt(6761776/5808),
  torsion_constant_j_mm4:160000,warping_constant_cw_mm6:140000000000};
function input(method='LRFD'){
  return {method,section:{h_mm:300,bf_mm:150,tf_mm:12,tw_mm:8,fabrication:'BUILT_UP',web_attachment:'WELDED'},
    material:{fy_mpa:345,fu_mpa:450,e_mpa:200000},member:{kx:1,ky:1,kz:1,lx_mm:3000,ly_mm:2000,lz_mm:2000,lb_mm:500,g_mpa:77200},
    forces:{axial_kN:200,moment_x_kNm:100,moment_y_kNm:0,shear_x_kN:0,shear_y_kN:0,torsion_kNm:0},
    holes:{pattern:'STRAIGHT',top_flange_count:2,bottom_flange_count:2,web_count:2,flange_hole_diameter_mm:22,web_hole_diameter_mm:22,critical_path_confirmed:true},
    tension_connection:{load_transfer:'ALL_ELEMENTS'},stiffeners:{spacing_mm:0},
    analysis:{method:'DIRECT',forces_method:method,evidence:'Independent manual fixture, simultaneous combination 1',second_order_global_confirmed:true,member_p_delta_confirmed:true,
      imperfections_confirmed:true,reduced_stiffness_confirmed:true,all_loads_confirmed:true,asd_scaling_confirmed:true,bracing_confirmed:true},
    compliance:{scope_confirmed:true,envelope_confirmed:true,other_limit_states_confirmed:true}};
}
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);

test('D2/D3 independent net rupture fixture applies the correct separate factors',()=>{
  for(const method of ['LRFD','ASD']){
    const i=input(method),net=calculateIHNetSection(i,props),t=calculateIHTension(i,props,lib,net);
    near(net.net_area_mm2,4272);near(net.flange_net_areas_mm2.top,1224);
    near(t.trace.ae_mm2,4272);near(t.trace.gross_yield_nominal_kN,2003.76);near(t.trace.rupture_nominal_kN,1922.4);
    near(t.available,method==='LRFD'?1441.8:961.2);assert.equal(t.trace.governing,'NET_RUPTURE');
    assert.equal(t.source.sha256,'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99');
  }
});
test('D3 case 2 needs connected elements and applies the open-section area floor',()=>{
  const i=input();i.tension_connection={load_transfer:'PARTIAL_LONGITUDINAL',connected_elements:['WEB'],connection_length_mm:100,eccentricity_mm:25};
  const t=calculateIHTension(i,props,lib);near(t.trace.u,.75);near(t.trace.ae_mm2,3204);near(t.available,1081.35);
  i.tension_connection.eccentricity_mm=90;
  near(calculateIHTension(i,props,lib).trace.u,2208/5808);
  delete i.tension_connection.connected_elements;
  assert.equal(calculateIHTension(i,props,lib).status,'INPUT_REQUIRED');
  i.tension_connection.connected_elements=['TOP','BOTTOM','WEB'];
  assert.equal(calculateIHTension(i,props,lib).status,'INPUT_REQUIRED'); // All elements use case 1, not case 2.
  i.tension_connection={load_transfer:'TRANSVERSE_WELD'};
  assert.equal(calculateIHTension(i,props,lib).status,'INPUT_REQUIRED');
});
test('hole declarations reject unknown, staggered, empty, invalid and exhausted paths',()=>{
  const i=input();delete i.holes;
  assert.equal(calculateIHNetSection(i,props).status,'INPUT_REQUIRED');
  i.holes=input().holes;i.holes.pattern='STAGGERED';
  assert.equal(calculateIHNetSection(i,props).status,'REVIEW_REQUIRED');
  for(const count of [undefined,null,-1,1.5,Infinity,1000]){
    const a=input();a.holes.web_count=count;
    assert.equal(calculateIHNetSection(a,props).status,'INPUT_REQUIRED');
  }
  const unknown=input();unknown.holes.critical_path_confirmed=false;
  assert.equal(calculateIHNetSection(unknown,props).status,'INPUT_REQUIRED');
});
test('F13 and signed H4 independently match LRFD/ASD hand fixtures',()=>{
  for(const method of ['LRFD','ASD']){
    const i=input(method);if(method==='ASD')Object.assign(i.forces,{axial_kN:130,moment_x_kNm:70});
    const net=calculateIHNetSection(i,props),t=calculateIHTension(i,props,lib,net);
    const f=calculateIHFlangeHoles(i,props,lib,net,t);
    near(f.flexure.nominal,180.96673536);
    near(f.interaction.nominal,method==='LRFD'?.752701763937641:.781223131429049,2e-6);
    const result=calculateIH36010(i,props,lib);
    near(result.limit_states.major_flexure.nominal,180.96673536);
    near(result.limit_states.interaction.nominal,method==='LRFD'?.683344011145367:.713599287282567,2e-6);
    assert.equal(result.overall_status,'PASS');
    assert.equal(result.member_compliance.scope,'MEMBER_STRENGTH_WITHIN_DECLARED_SCOPE');
  }
});
test('H4 retains compression sign, checks each tension flange and rejects biaxial flange-hole scope',()=>{
  const i=input(),net=calculateIHNetSection(i,props),t=calculateIHTension(i,props,lib,net);
  const positive=calculateIHFlangeHoles(i,props,lib,net,t);
  i.forces.axial_kN=-200;
  const compression=calculateIHFlangeHoles(i,props,lib,net,t);
  assert.ok(compression.interaction.nominal<positive.interaction.nominal);
  assert.equal(compression.interaction.trace.flanges[0].pr_kN,-200);
  i.forces.moment_x_kNm=-100;
  assert.equal(calculateIHFlangeHoles(i,props,lib,net,t).interaction.trace.flanges[0].flange,'top');
  i.forces.moment_y_kNm=1;
  assert.equal(calculateIHFlangeHoles(i,props,lib,net,t).interaction.status,'REVIEW_REQUIRED');
});
test('F13 threshold is inclusive and uses Yt only in the applicability test',()=>{
  const i=input();Object.assign(i.material,{fy_mpa:300,fu_mpa:500});
  i.holes.flange_hole_diameter_mm=28; // Afn=1080; Fu Afn = Fy Afg =540000 N.
  const net=calculateIHNetSection(i,props);
  const f=calculateIHFlangeHoles(i,props,lib,net,calculateIHTension(i,props,lib,net));
  assert.equal(f.flexure.trace.flanges[0].rupture_applies,false);
  near(f.flexure.nominal,201.2256); // Mp, not an accidental Fu*Sx cap with no reduction.
  i.material.fu_mpa=499.999;
  assert.equal(calculateIHFlangeHoles(i,props,lib,net,calculateIHTension(i,props,lib,net)).flexure.trace.flanges[0].rupture_applies,true);
});
test('Chapter C confirmations govern K=1 and do not reduce nominal resistance E twice',()=>{
  const i=input(),ok=reviewIHAnalysis(i,props);
  assert.equal(ok.analysis.status,'CONFIRMED');near(ok.analysis.trace.analysis_axial_stiffness_factor,.8);
  i.analysis.member_p_delta_confirmed=false;
  assert.equal(calculateIH36010({...i,forces:{...i.forces,axial_kN:-200}},props,lib).limit_states.compression.status,'INPUT_REQUIRED');
  assert.equal(calculateIH36010(i,props,lib).overall_status,'REVIEW_REQUIRED');
  const wrongK=input();wrongK.member.ky=2;
  assert.equal(reviewIHAnalysis(wrongK,props).analysis.status,'INPUT_REQUIRED');
  const asd=input('ASD');asd.analysis.asd_scaling_confirmed=false;
  assert.equal(reviewIHAnalysis(asd,props).analysis.status,'INPUT_REQUIRED');
});
test('manual force-method mismatch, missing torque and incomplete envelopes cannot pass',()=>{
  for(const mutate of [i=>i.analysis.forces_method='ASD',i=>delete i.forces.torsion_kNm,i=>i.compliance.envelope_confirmed=false,i=>i.compliance.other_limit_states_confirmed=false]){
    const i=input();mutate(i);assert.notEqual(calculateIH36010(i,props,lib).overall_status,'PASS');
  }
  const overloaded=input();overloaded.forces.moment_x_kNm=1000;
  assert.equal(calculateIH36010(overloaded,props,lib).overall_status,'FAIL');
  const unspecified=input();delete unspecified.forces.axial_kN;
  assert.throws(()=>calculateIH36010(unspecified,props,lib),/N must be finite/);
});
test('E7-17 full-width applicability at low Fcr prevents spurious negative effective widths',()=>{
  const i=input();Object.assign(i.section,{h_mm:600,bf_mm:200,tf_mm:6,tw_mm:4});
  i.forces.axial_kN=-100;Object.assign(i.member,{lx_mm:1e6,ly_mm:1e6,lz_mm:1e6});
  i.holes={...i.holes,top_flange_count:0,bottom_flange_count:0,web_count:0};
  const p={...props,area_mm2:4752,ix_mm4:279474624,iy_mm4:8003136,rx_mm:242.511855,ry_mm:41.038538};
  const result=calculateIH36010(i,p,lib);
  assert.equal(result.classification.axialWeb,'SLENDER');
  assert.equal(result.limit_states.compression.status,'CALCULATED');
  near(result.limit_states.compression.trace.qa,1);
  near(result.limit_states.compression.trace.effective_web_mm,588);
});
test('independent E3/E4/E7 hand fixture keeps both flexural axes and torsional buckling separate',()=>{
  const i=input();Object.assign(i.section,{h_mm:600,bf_mm:200,tf_mm:6,tw_mm:4});
  Object.assign(i.member,{lx_mm:6000,ly_mm:4000,lz_mm:5000});i.forces.axial_kN=-100;
  i.holes={...i.holes,top_flange_count:0,bottom_flange_count:0,web_count:0};
  const p={...props,area_mm2:4752,ix_mm4:279474624,iy_mm4:8003136,
    rx_mm:Math.sqrt(279474624/4752),ry_mm:Math.sqrt(8003136/4752),torsion_constant_j_mm4:40745.684,warping_constant_cw_mm6:705948623424};
  const c=calculateIH36010(i,p,lib).limit_states.compression;
  near(c.trace.fex_mpa,3224.729,1e-5);near(c.trace.fey_mpa,207.775,1e-5);near(c.trace.fez_mpa,204.833,1e-5);
  near(c.trace.qs,.657391,1e-5);near(c.trace.qa,.708936,1e-5);near(c.nominal,550.098,1e-5);
  near(c.available,495.089,1e-5);
  i.method='ASD';i.analysis.forces_method='ASD';
  near(calculateIH36010(i,p,lib).limit_states.compression.available,329.400,1e-5);
});
test('unknown or bolted attachments cannot be approved as a welded member',()=>{
  const i=input();delete i.section.web_attachment;
  assert.equal(calculateIH36010(i,props,lib).overall_status,'REVIEW_REQUIRED');
  i.section.web_attachment='BOLTED';i.section.web_clear_height_mm=270;i.section.web_clear_height_verified=true;
  const result=calculateIH36010(i,props,lib);
  assert.equal(result.limit_states.major_flexure.status,'REVIEW_REQUIRED');
  assert.equal(result.overall_status,'REVIEW_REQUIRED');
});
