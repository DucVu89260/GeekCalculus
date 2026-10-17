import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE, FORMULAS, exposureCoefficient, velocityPressure, wallCoefficients, lowSlopeRoofZones, calculateWind710 } from '../../../../standards/asce7-10-wind.mjs';
const near = (a,b,t=1e-10) => assert.ok(Math.abs(a-b)<t, `${a} != ${b}`);
const fixture = () => ({ edition:'ASCE7-10', rigid:true, regular_shape:true, chapter2_combinations:true,
  wind_normal_to_ridge:true, wind:{v_mps:40, exposure:'C', kzt:1},
  building:{h_m:10,z_m:5,length_m:20,width_m:10,slope_deg:5,roof_type:'GABLE',enclosure:'ENCLOSED'} });
test('edition-specific source and clause/page trace retained',()=>{
  assert.equal(SOURCE.sha256.length,64); assert.equal(FORMULAS.kz.pdf_page,308);
  const r=calculateWind710(fixture()); assert.equal(r.overall_status,'REVIEW_REQUIRED');
  assert.equal(r.source.edition,'ASCE7-10'); assert.equal(r.status,'CALCULATED');
});
test('Table 27.3-1 independent tabulated values, including B minimum distinct from Ch28',()=>{
  for (const [exp,z,expected] of [['B',0,.57],['C',0,.85],['D',0,1.03],['B',30*.3048,.70],['C',100*.3048,1.26],['D',500*.3048,1.89]])
    near(exposureCoefficient(exp,z).value,expected,.006);
  near(exposureCoefficient('B',0).value,exposureCoefficient('B',15*.3048).value);
  assert.throws(()=>exposureCoefficient('C',275)); assert.throws(()=>exposureCoefficient('A',10));
});
test('27.3-1 SI hand calculation and V squared scaling; no importance or elevation factor',()=>{
  near(velocityPressure({v_mps:40,kz:1,kzt:1,kd:.85}),.83368);
  near(velocityPressure({v_mps:80,kz:1,kzt:1,kd:.85}),4*.83368);
  assert.throws(()=>velocityPressure({v_mps:40,kz:1,kzt:.9,kd:.85}));
});
test('Fig27.4-1 wall Cp knots, interpolation, tails',()=>{
  for(const [ratio,cp] of [[.5,-.5],[1,-.5],[1.5,-.4],[2,-.3],[3,-.25],[4,-.2],[8,-.2]])
    near(wallCoefficients(ratio,1).leeward,cp);
});
test('27.4-1 pressure signs, qz versus qh and simultaneous internal pressure',()=>{
  const r=calculateWind710(fixture()),[neg,pos]=r.cases;
  near(pos.walls.windward.net_kpa,r.trace.qz_kpa*.85*.8-r.trace.qh_kpa*.18);
  near(neg.walls.leeward.net_kpa,r.trace.qh_kpa*(-.85*.3+.18));
  near(pos.walls.side_left.net_kpa,pos.walls.side_right.net_kpa);
  assert.ok(neg.walls.windward.net_kpa>pos.walls.windward.net_kpa);
  assert.notEqual(r.trace.qz_kpa,r.trace.qh_kpa);
});
test('partially enclosed positive qi uses highest opening; negative qi remains qh',()=>{
  const i=fixture();i.building.enclosure='PARTIALLY_ENCLOSED';
  assert.throws(()=>calculateWind710(i));
  i.positive_internal_basis='HIGHEST_OPENING';i.building.highest_opening_m=5;
  const r=calculateWind710(i);near(r.cases[1].qi_kpa,r.trace.qz_kpa);near(r.cases[0].qi_kpa,r.trace.qh_kpa);
  assert.equal(r.cases[1].gcpi,.55);
  i.positive_internal_basis='QH_CONSERVATIVE';near(calculateWind710(i).cases[1].qi_kpa,r.trace.qh_kpa);
});
test('low-slope roof spatial zones and same-sign h/L interpolation',()=>{
  assert.deepEqual(lowSlopeRoofZones(10,40,0).zones.map(z=>z.cp_cases[0]),[-.9,-.9,-.5,-.3]);
  assert.deepEqual(lowSlopeRoofZones(10,10,9).zones.map(z=>z.cp_cases[0]),[-1.3,-.7]);
  const r=lowSlopeRoofZones(15,20,5);near(r.zones[0].cp_cases[0],-1.1);
  near(r.zones[1].cp_cases[0],-.8);assert.ok(r.zones.every(z=>z.cp_cases[1]===-.18));
  assert.equal(lowSlopeRoofZones(10,20,10).status,'NOT_IMPLEMENTED');
});
test('missing eligibility never calculates and unsupported branches never certify',()=>{
  for(const field of ['rigid','regular_shape','chapter2_combinations','wind_normal_to_ridge']) {
    const i=fixture();delete i[field];assert.equal(calculateWind710(i).status,'INPUT_REQUIRED');
  }
  const i=fixture();i.building.slope_deg=15;const r=calculateWind710(i);
  assert.equal(r.roof.status,'NOT_IMPLEMENTED');assert.equal(r.cases[0].roof,null);
  assert.equal(r.minimum.status,'REVIEW_REQUIRED');assert.equal(r.minimum.wall_kpa,.77);
});
test('invalid values rejected without coercion; input preserved',()=>{
  for(const bad of [NaN,Infinity,0,-1,'40',null]) {const i=fixture();i.wind.v_mps=bad;assert.throws(()=>calculateWind710(i));}
  const i=fixture(),before=structuredClone(i);calculateWind710(i);assert.deepEqual(i,before);
  i.edition='ASCE7-16';assert.throws(()=>calculateWind710(i));
  i.edition='ASCE7-10';i.building.z_m=11;assert.throws(()=>calculateWind710(i));
});
