import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEnvelope710, envelopeCoefficients } from '../../../../standards/asce7-10-envelope.mjs';
import { WIND_GROUPS, WIND_BUILDINGS } from '../../../../standards/asce7-10-wind-catalog.mjs';
const fixture=()=>({windSpeed:196,speedUnit:'km/h',exposure:'B',ridgeHeight:12,eaveHeight:10,width:50,length:95,roofType:'GABLE',kzt:1,kd:.85,enclosure:'ENCLOSED',hurricane:false,conditionsConfirmed:false});
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('Chapter 28 default worked case: independent SI hand values and source table constants',()=>{
  const r=calculateEnvelope710(fixture());
  assert.equal(r.status,'CALCULATED_PRELIMINARY');assert.equal(r.overall_status,'REVIEW_REQUIRED');
  near(r.derived.theta,4.573921259900861);near(r.derived.h,10);
  near(r.derived.kh,.7187346278850155);near(r.derived.qh,1.1100821278279371);
  near(r.derived.a,4);near(r.derived.two_a,8);near(r.zone2.transverse,25);near(r.zone2.longitudinal,25);
  assert.deepEqual(r.transverse.map(x=>x.gcpf),[.4,-.69,-.37,-.29,.61,-1.07,-.53,-.43]);
  near(r.transverse[0].positive,.2442180681221462);near(r.transverse[0].negative,.6438476341402036);
  near(r.transverse[5].positive,-1.3876026597849214);
  near(r.longitudinal[0].positive,-.6993517405316004);
  assert.equal(r.source.pdf_pages.at(-1),348);assert.equal(r.conditions_confirmed,false);
});
test('Chapter28 B exposure uses minimum 30 ft and C/D use 15 ft',()=>{
  const i=fixture();i.ridgeHeight=i.eaveHeight=3;
  const r=calculateEnvelope710(i);near(r.derived.kh,2.01*(30/1200)**(2/7));
  assert.equal(r.derived.effective_height,9.144);
  i.exposure='C';near(calculateEnvelope710(i).derived.kh,2.01*(15/900)**(2/9.5));
  i.exposure='D';near(calculateEnvelope710(i).derived.kh,2.01*(15/700)**(2/11.5));
});
test('Fig28.4-1 interpolation at 12.5 degrees, 20/30/45 knots and fixed Case B',()=>{
  const middle=envelopeCoefficients(12.5);
  [.465,-.69,-.425,-.36,.705,-1.07,-.61,-.535].forEach((v,i)=>near(middle.transverse[i].gcpf,v));
  near(envelopeCoefficients(20).transverse[1].gcpf,-.69);
  near(envelopeCoefficients(25).transverse[1].gcpf,-.24);
  near(envelopeCoefficients(30).transverse[1].gcpf,.21);
  assert.deepEqual(envelopeCoefficients(30),envelopeCoefficients(45));
  assert.deepEqual(envelopeCoefficients(0).longitudinal,envelopeCoefficients(45).longitudinal);
  assert.throws(()=>envelopeCoefficients(45.01));
});
test('mean roof height changes above ten degrees and geometry eligibility blocks pressure rows',()=>{
  const i=fixture();i.ridgeHeight=20;const r=calculateEnvelope710(i);near(r.derived.h,15);
  i.eaveHeight=20;i.ridgeHeight=22;assert.equal(calculateEnvelope710(i).checks.height,false);
  assert.deepEqual(calculateEnvelope710(i).transverse,[]);
  i.eaveHeight=10;i.ridgeHeight=12;i.width=5;assert.equal(calculateEnvelope710(i).checks.plan,false);
  i.width=50;i.ridgeHeight=i.eaveHeight=18;assert.equal(calculateEnvelope710(i).checks.height,true);
  i.ridgeHeight=i.eaveHeight=18.01;assert.equal(calculateEnvelope710(i).checks.height,false);
  i.ridgeHeight=12;i.eaveHeight=10;i.roofType='MONOSLOPE';const m=calculateEnvelope710(i);
  assert.equal(m.status,'OUTSIDE_SCOPE');assert.deepEqual(m.torsionB,[]);assert.ok(m.messages.includes('MONOSLOPE_REVIEW'));
});
test('torsion quarter applies to full net pressure, both GCpi signs; partial enclosure not guessed from hurricane',()=>{
  const i=fixture();const r=calculateEnvelope710(i);
  near(r.torsionA[0].positive,.06105451703053655);near(r.torsionA[0].negative,.1609619085350509);
  near(r.torsionB[0].positive,r.longitudinal[4].positive*.25);
  i.enclosure='PARTIALLY_ENCLOSED';const p=calculateEnvelope710(i);near(p.derived.gcpi,.55);
  near(p.transverse[0].positive,p.derived.qh*(-.15));
  i.enclosure='ENCLOSED';i.hurricane=true;const h=calculateEnvelope710(i);
  near(h.derived.gcpi,.18);assert.ok(h.messages.includes('OPENING_PROTECTION_REVIEW'));
});
test('units, pressure signs, invalid inputs and source-specific catalog grouping',()=>{
  const i=fixture(),original=structuredClone(i),a=calculateEnvelope710(i);
  assert.deepEqual(i,original);i.speedUnit='m/s';i.windSpeed=196/3.6;near(calculateEnvelope710(i).derived.qh,a.derived.qh);
  for(const value of [null,'196',NaN,Infinity,0,-1]){i.windSpeed=value;assert.throws(()=>calculateEnvelope710(i));}
  i.windSpeed=40;i.ridgeHeight=9;assert.throws(()=>calculateEnvelope710(i));
  assert.equal(new Set(WIND_BUILDINGS.map(x=>x.id)).size,WIND_BUILDINGS.length);
  assert.equal(WIND_GROUPS.find(x=>x.id==='directional').chapter,27);
  assert.equal(WIND_BUILDINGS.find(x=>x.id==='signs').group,'other');
});
