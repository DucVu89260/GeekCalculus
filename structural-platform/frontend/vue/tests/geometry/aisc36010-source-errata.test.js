import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calculateIH36010 } from '../../../../standards/aisc360-10-verified-hi.mjs';

const base=join(dirname(fileURLToPath(import.meta.url)),'../../../../standards');
const factors=JSON.parse(readFileSync(join(base,'aisc360-10-strength-factors.json'),'utf8')).factors;
const factorLib={
 availableStrength(nominal,method,key){
  const factor=factors[key];
  assert.ok(factor,'Missing AISC coefficient '+key);
  return method==='LRFD'?factor.phi*nominal:nominal/factor.omega;
 }
};
const sectionProperties=Object.freeze({
 area_mm2:12000,ix_mm4:1.5e9,iy_mm4:5e7,sx_mm3:3.75e6,sy_mm3:4e5,
 zx_mm3:4e6,zy_mm3:6e5,rx_mm:353.5533906,ry_mm:64.5497224,
 torsion_constant_j_mm4:5e5,warping_constant_cw_mm6:2.9e12
});
const baseInput={
 method:'LRFD',
 // Welded, sharp-corner built-up I: B4.1 §1b defines h as flange clear distance.
 // Thus h=hc=800-2(16)=768 mm; ho=800-16=784 mm.
 section:{h_mm:800,bf_mm:250,tf_mm:16,tw_mm:5,fabrication:'BUILT_UP',web_attachment:'WELDED'},
 material:{fy_mpa:345,e_mpa:200000},
 member:{kx:1,ky:1,kz:1,lx_mm:5000,ly_mm:4000,lz_mm:4000,lb_mm:3000,g_mpa:77000},
 moment_diagram:{mode:'CONSERVATIVE'},
 forces:{axial_kN:-120,moment_x_kNm:140,moment_y_kNm:20}
};
const calculate=(lb,method='LRFD')=>{
 const input=structuredClone(baseInput);
 input.member.lb_mm=lb;
 input.method=method;
 return calculateIH36010(input,sectionProperties,factorLib);
};

test('Noncompact web applicability reports F4 and keeps the unsupported branch blocked',()=>{
 const input=structuredClone(baseInput);
 input.section.tw_mm=7; // h/tw=109.714: between 3.76 and 5.70 sqrt(E/Fy).
 const result=calculateIH36010(input,sectionProperties,factorLib);
 assert.equal(result.classification.flexureWeb,'NONCOMPACT');
 assert.equal(result.classification.flexureChapter,'F4');
 assert.equal(result.limit_states.major_flexure.status,'REVIEW_REQUIRED');
 assert.equal(result.limit_states.major_flexure.clause,'F4');
 assert.equal(result.overall_status,'REVIEW_REQUIRED');
});
const near=(actual,expected,tol=1e-8)=>assert.ok(
 Math.abs(actual-expected)<=tol*Math.max(1,Math.abs(expected)),
 `Expected ${actual} near ${expected}`
);

test('AISC 360-10 F4-11/F5 and E7 match independent source fixtures for LRFD and ASD',()=>{
 // Hand-calculated from F4-11/F4-12 on physical 108 (printed 16.1-52),
 // using h from B4.1 §1b on physical 71 (printed 16.1-15), then F5-3/F5-4.
 // These constants are independent of the member-engine implementation.
 const inelastic=calculate(3000);
 const inelasticF5=inelastic.limit_states.major_flexure;
 assert.equal(inelastic.classification.flexureWeb,'SLENDER');
 assert.equal(inelasticF5.trace.ltb_clause,'F5-3');
 near(inelasticF5.trace.aw,0.96);
 near(inelasticF5.trace.rt_mm,67.87670728578018);
 near(inelasticF5.trace.lp_mm,1797.7069684753726);
 near(inelasticF5.trace.lr_mm,6136.589454560457);
 near(inelasticF5.nominal,1173.681309946845);
 near(inelasticF5.available,1056.313178952161);

 const asdInelastic=calculate(3000,'ASD').limit_states.major_flexure;
 near(asdInelastic.nominal,1173.681309946845);
 near(asdInelastic.available,702.803179608889);

 // Lb=8000 mm is above the independently calculated Lr and exercises F5-4.
 const elastic=calculate(8000).limit_states.major_flexure;
 assert.equal(elastic.trace.ltb_clause,'F5-4');
 near(elastic.trace.rt_mm,67.87670728578018);
 near(elastic.nominal,527.247173916884);
 near(elastic.available,474.522456525196);
 const asdElastic=calculate(8000,'ASD').limit_states.major_flexure;
 near(asdElastic.nominal,527.247173916884);
 near(asdElastic.available,315.716870608913);

 // Independent E7 fixture for this geometry/canonical-property input: Qs=1,
 // Qa=0.798706562513, Fcr=175.504342252476 MPa, Pn=2106.052107029712 kN.
 const eLrfd=inelastic.limit_states.compression;
 const eAsd=calculate(3000,'ASD').limit_states.compression;
 near(eLrfd.trace.qs,1);
 near(eLrfd.trace.qa,0.798706562513);
 near(eLrfd.trace.governing_fcr_mpa,175.504342252476);
 near(eLrfd.nominal,2106.052107029712);
 near(eLrfd.available,1895.446896326741);
 near(eAsd.nominal,2106.052107029712);
 near(eAsd.available,1261.109046125576);
});

function rectangleBuiltUpIProperties({h_mm:d,bf_mm:bf,tf_mm:tf,tw_mm:tw}) {
 const hw=d-2*tf;
 const area=2*bf*tf+hw*tw;
 const ix=2*(bf*tf**3/12+bf*tf*((d-tf)/2)**2)+tw*hw**3/12;
 const iy=2*tf*bf**3/12+hw*tw**3/12;
 return {
  area_mm2:area,ix_mm4:ix,iy_mm4:iy,
  sx_mm3:ix/(d/2),sy_mm3:iy/(bf/2),
  zx_mm3:bf*tf*(d-tf)+tw*hw**2/4,
  zy_mm3:tf*bf**2/2+hw*tw**2/4,
  rx_mm:Math.sqrt(ix/area),ry_mm:Math.sqrt(iy/area)
 };
}

test('F4-11/F5 independent benchmark with rectangle-derived welded-I section properties',()=>{
 // This is a separate, physically consistent section case. Rectangle hand
 // properties are independently formed from d=800, bf=250, tf=16, tw=5 mm:
 // A=11840 mm2, Ix=1418226346.666667 mm4, Iy=41674666.666667 mm4,
 // Sx=3545565.866667 mm3, Sy=333397.333333 mm3, Zx=3873280 mm3,
 // Zy=504800 mm3, rx=346.096274 mm, ry=59.328069 mm. J and Cw are omitted:
 // this cross-check covers only F5 major-axis flexure, not E4 compression.
 const physicalProperties=rectangleBuiltUpIProperties(baseInput.section);
 near(physicalProperties.area_mm2,11840);
 near(physicalProperties.ix_mm4,1418226346.666667);
 near(physicalProperties.iy_mm4,41674666.666667);
 near(physicalProperties.sx_mm3,3545565.866667);
 near(physicalProperties.sy_mm3,333397.333333);
 near(physicalProperties.zx_mm3,3873280);
 near(physicalProperties.zy_mm3,504800);
 near(physicalProperties.rx_mm,346.096273644532);
 near(physicalProperties.ry_mm,59.3280694091744);

 const calculatePhysical=(lb,method='LRFD')=>{
  const input=structuredClone(baseInput);
  input.member.lb_mm=lb;
  input.method=method;
  return calculateIH36010(input,physicalProperties,factorLib);
 };
 // B4.1 §1b gives h=hc=768 mm for this welded clear-web geometry.
 // F4-11/F4-12 give rt=67.8767072857802 mm; F4-7/F5-5 give
 // Lp=1797.70696847537 mm and Lr=6136.58945456046 mm; F5-6 gives
 // Rpg=0.989445079043727. Constants below were hand-calculated outside
 // calculateIH36010 from those source equations and the rectangle Sx above.
 const f5_3=calculatePhysical(3000).limit_states.major_flexure;
 assert.equal(f5_3.trace.ltb_clause,'F5-3');
 near(f5_3.trace.aw,0.96);
 near(f5_3.trace.rt_mm,67.8767072857802);
 near(f5_3.trace.lp_mm,1797.70696847537);
 near(f5_3.trace.lr_mm,6136.58945456046);
 near(f5_3.trace.rpg,0.989445079043727);
 near(f5_3.trace.mn_ltb_kNm,1109.69717090457);
 near(f5_3.nominal,1109.69717090457);
 near(f5_3.available,998.727453814117);
 const f5_3Asd=calculatePhysical(3000,'ASD').limit_states.major_flexure;
 near(f5_3Asd.nominal,1109.69717090457);
 near(f5_3Asd.available,664.489323894955);

 const f5_4=calculatePhysical(8000).limit_states.major_flexure;
 assert.equal(f5_4.trace.ltb_clause,'F5-4');
 near(f5_4.trace.rt_mm,67.8767072857802);
 near(f5_4.trace.rpg,0.989445079043727);
 near(f5_4.trace.mn_ltb_kNm,498.503888836312);
 near(f5_4.nominal,498.503888836312);
 near(f5_4.available,448.65349995268);
 const f5_4Asd=calculatePhysical(8000,'ASD').limit_states.major_flexure;
 near(f5_4Asd.nominal,498.503888836312);
 near(f5_4Asd.available,298.505322656474);
});
