const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./helpers/crane-module.cjs')
const { calculateCraneSections } = load('crane-beam-section')
const { calculateCraneDesign, DEFAULT_CRANE_ACTIONS, CRANE_STAGES, shearCv } = load('crane-beam-strength')
const { workbookCase } = require('./helpers/crane-workbook.cjs')
const factorRegistry = require('../standards/aisc360-10-strength-factors.json')
const near = (a,b) => assert.ok(Math.abs(a-b) <= 1e-9*Math.max(1,Math.abs(b)), `${a} vs ${b}`)
const all = result => result.groups.flatMap(group => group.checks)
const check = (result,id) => all(result).find(item => item.id === id)
const fixture = async (method='ASD', overrides={}) => {
  const f = workbookCase(method), sections = await calculateCraneSections(f.dimensions)
  const actions = { ...DEFAULT_CRANE_ACTIONS, ...f.actions, ...overrides }
  return { f, sections, actions, result: calculateCraneDesign(sections,actions,method) }
}

for (const method of ['ASD','LRFD']) test(`${method}: every required calculation stage has traceable checks; no unverified PASS`,async()=>{
  const {result}=await fixture(method)
  assert.deepEqual(result.groups.map(g=>g.number),[3,4,5,6,7,8,9,10,11,12])
  assert.equal(result.groups.length,CRANE_STAGES.length)
  for (const group of result.groups) {
    assert.ok(group.checks.length>0,group.id)
    for (const item of group.checks) {
      assert.equal(item.status,'NOT VERIFIED',item.id)
      assert.ok(item.formula || item.warnings.length,item.id)
      for (const key of ['ratio','nominal','capacity','available_asd','available_lrfd']) assert.ok(item[key] === null || Number.isFinite(item[key]),item.id)
    }
  }
  assert.equal(result.summary_status,'NOT VERIFIED')
})

test('method changes only factored resistance, uses the authoritative coefficient registry and preserves actions',async()=>{
  const {sections,actions}=await fixture('ASD'), saved=structuredClone(actions)
  const asd=calculateCraneDesign(sections,actions,'ASD'), lrfd=calculateCraneDesign(sections,actions,'LRFD')
  assert.deepEqual(actions,saved)
  for (const item of all(asd).filter(item=>item.factor)) {
    const other=check(lrfd,item.id), f=factorRegistry.factors[item.factor.key]
    near(other.nominal,item.nominal)
    near(item.capacity,item.nominal/f.omega);near(other.capacity,item.nominal*f.phi)
    near(item.available_lrfd,other.capacity);near(other.available_asd,item.capacity)
    assert.equal(item.demand,other.demand)
  }
})

test('minor bending uses the complete top-T plastic integral and never full-I Sy/Zy',async()=>{
  const {sections,actions,result}=await fixture('LRFD')
  const t=sections.top.properties,d=sections.base.normalized_input.geometry.dimensions
  near(check(result,'minor_yield').nominal,345*Math.min(t.plastic.zy,1.6*t.elastic.sy_positive)/1e6)
  near(t.plastic.zy,d.top_flange_thickness*d.top_flange_width**2/4+sections.top_web_depth_mm*d.web_thickness**2/4)
  const altered=structuredClone(sections)
  altered.base.properties.plastic.zy*=50;altered.base.properties.elastic.sy_positive*=100;altered.base.properties.elastic.sy_negative*=100
  near(check(calculateCraneDesign(altered,actions,'LRFD'),'minor_governing').nominal,check(result,'minor_governing').nominal)
  assert.match(check(result,'minor_governing').warnings.join(' '),/DG7/)
})

test('axial check uses top-T area, independent effective lengths and flexural-torsional reduction',async()=>{
  const {sections,actions,result}=await fixture('LRFD')
  const tr=result.derived.compression
  near(tr.Fex,Math.PI**2*actions.e/(actions.klx_mm/sections.top.properties.elastic.rx)**2)
  near(tr.Fey,Math.PI**2*actions.e/(actions.kly_mm/sections.top.properties.elastic.ry)**2)
  assert.notEqual(tr.Fex,tr.Fey)
  assert.ok(tr.FeFT<=Math.min(tr.Fey,tr.Fez))
  near(check(result,'compression_top_t').nominal,tr.Fcr*sections.top.properties.geometric.area/1000)
  const changed=calculateCraneDesign(sections,{...actions,klx_mm:1e6},'LRFD')
  assert.ok(check(changed,'compression_top_t').nominal<check(result,'compression_top_t').nominal)
})

test('longer unbraced length reduces governing F4 resistance; short braces reach yielding without infinite sentinels',async()=>{
  const {sections,actions}=await fixture('ASD')
  const short=calculateCraneDesign(sections,{...actions,lb_mm:500},'ASD')
  const medium=calculateCraneDesign(sections,{...actions,lb_mm:4000},'ASD')
  const long=calculateCraneDesign(sections,{...actions,lb_mm:14000},'ASD')
  near(check(short,'major_ltb').nominal,check(short,'major_compression_yield').nominal)
  assert.ok(check(long,'major_ltb').nominal<check(medium,'major_ltb').nominal)
  for(const r of [short,medium,long]) near(check(r,'major_governing').nominal,Math.min(...['major_compression_yield','major_ltb','major_flb','major_tension_yield'].map(id=>check(r,id).nominal)))
})

test('a slender-web worksheet is routed to F5, and negative major bending swaps the compression flange',async()=>{
  const {sections,actions,result}=await fixture('LRFD')
  assert.equal(result.derived.classification.majorWeb,'SLENDER')
  assert.equal(check(result,'major_governing').clause,'F5')
  assert.ok(result.derived.major.Rpg<1)
  const reverse=calculateCraneDesign(sections,{...actions,mx_knm:-actions.mx_knm},'LRFD')
  near(reverse.derived.major.Sxc,sections.base.properties.elastic.sx_negative)
  near(reverse.derived.major.hc,sections.hc_bottom_mm)
  assert.notEqual(reverse.derived.major.Sxc,result.derived.major.Sxc)
})

test('an extreme slender web outside the positive Rpg envelope returns blocked major checks rather than negative resistance',async()=>{
  const sections=await calculateCraneSections({depth:20000,top_flange_width:300,bottom_flange_width:300,top_flange_thickness:20,bottom_flange_thickness:20,web_thickness:2})
  const r=calculateCraneDesign(sections,{...DEFAULT_CRANE_ACTIONS,k_mm:20},'ASD')
  assert.equal(check(r,'major_ltb').capacity,null)
  assert.equal(check(r,'major_ltb').coverage,'INPUT_OR_SOURCE_REQUIRED')
  assert.equal(check(r,'biaxial_h1').ratio,null)
  assert.equal(r.summary_status,'NOT VERIFIED')
})

test('G2 Cv evaluates all three regions, including their boundaries',()=>{
  const e=210000,fy=345,kv=5,l1=1.1*Math.sqrt(kv*e/fy),l2=1.37*Math.sqrt(kv*e/fy)
  near(shearCv(l1,kv,e,fy),1)
  near(shearCv((l1+l2)/2,kv,e,fy),l1/((l1+l2)/2))
  near(shearCv(200,kv,e,fy),1.51*kv*e/(fy*200**2))
  assert.throws(()=>shearCv(0,kv,e,fy),/Invalid/)
})

test('G2 exactly reproduces saved valid ASD/LRFD shear capacities; G7 corrects half-flange area and declared kv',async()=>{
  for(const method of ['ASD','LRFD']) {
    const {result,f,sections}=await fixture(method)
    near(check(result,'shear_g2').capacity,f.cells.C257.value)
    const d=sections.base.normalized_input.geometry.dimensions
    near(check(result,'shear_g7_top').nominal,.6*345*d.top_flange_width*d.top_flange_thickness/1000)
    near(check(result,'shear_g7_top').capacity,2*f.cells.C270.value)
    assert.match(check(result,'shear_g7_top').formula,/kv=1.2/)
  }
})

test('J10 interior/end equations and long bearing are distinct; unapproved factor keys never produce available capacities',async()=>{
  const {sections,actions,result}=await fixture('ASD'),d=sections.base.normalized_input.geometry.dimensions
  near(check(result,'web_local_yielding').nominal,345*d.web_thickness*(5*actions.k_mm+actions.bearing_mm)/1000)
  const end=calculateCraneDesign(sections,{...actions,end_distance_mm:0,bearing_mm:.3*d.depth},'ASD')
  assert.equal(check(end,'web_local_yielding').clause,'J10-3')
  assert.equal(check(end,'web_crippling').clause,'J10-5b')
  const partial=calculateCraneDesign(sections,{...actions,end_distance_mm:0},'ASD')
  near(check(partial,'web_crippling').nominal,.5*check(result,'web_crippling').nominal)
  for(const r of [result,end]) for(const id of ['web_local_yielding','web_crippling']) {
    assert.equal(check(r,id).capacity,null)
    assert.equal(check(r,id).available_asd,null)
    assert.equal(check(r,id).available_lrfd,null)
    assert.equal(check(r,id).factor,undefined)
  }
})

test('sidesway is calculated for an unrestrained applicable web and excluded with null values, never 999999',async()=>{
  const {sections,actions,result}=await fixture('ASD')
  assert.ok(check(result,'web_sidesway').nominal>0)
  const braced=calculateCraneDesign(sections,{...actions,compression_flange_braced:true},'ASD')
  assert.equal(check(braced,'web_sidesway').nominal,null)
  assert.match(check(braced,'web_sidesway').coverage,/NOT_APPLICABLE/)
  const {result:slender}=await fixture('LRFD')
  assert.equal(check(slender,'web_sidesway').nominal,null)
})

test('H1 screening uses governing major/minor strengths and both axial-ratio branches',async()=>{
  const {sections,actions,result}=await fixture('ASD',{axial_top_t_model:true})
  for(const axialRatio of [.19,.21]) {
    const pc=check(result,'compression_top_t').capacity
    const r=calculateCraneDesign(sections,{...actions,n_kn:-pc*axialRatio},'ASD')
    const momentSum=Math.abs(actions.mx_knm)/check(r,'major_governing').capacity+Math.abs(actions.my_knm)/check(r,'minor_governing').capacity
    near(check(r,'biaxial_h1').ratio,axialRatio>=.2?axialRatio+8/9*momentSum:axialRatio/2+momentSum)
  }
  const tensile=calculateCraneDesign(sections,{...actions,n_kn:10},'ASD')
  assert.equal(check(tensile,'biaxial_h1').ratio,null)
  assert.ok(check(tensile,'top_t_tension'))
})

test('failed tension-field geometry denies extra strength; eligible interior panels remain conditional on stiffener strength',async()=>{
  const {result:invalid}=await fixture('LRFD',{transverse_stiffeners:true,end_panel:false,tension_field:true})
  assert.equal(check(invalid,'tension_field_candidate').nominal,null)
  const sections=await calculateCraneSections({depth:1000,top_flange_width:300,bottom_flange_width:300,top_flange_thickness:20,bottom_flange_thickness:20,web_thickness:6})
  const r=calculateCraneDesign(sections,{...DEFAULT_CRANE_ACTIONS,k_mm:20,stiffener_spacing_mm:480,transverse_stiffeners:true,end_panel:false,tension_field:true},'LRFD')
  const t=check(r,'tension_field_candidate')
  assert.ok(t.nominal>0)
  assert.ok(t.nominal<=.6*345*960*6/1000)
  assert.equal(t.coverage,'CONDITIONAL_NOT_GOVERNING')
  assert.equal(t.capacity,null)
  assert.equal(t.available_asd,null)
  assert.equal(t.available_lrfd,null)
  assert.equal(r.derived.shear.kv,5,'Unverified stiffeners cannot boost available G2 resistance')
  assert.equal(check(r,'stiffener_strength').coverage,'INPUT_OR_SOURCE_REQUIRED')
  assert.equal(r.summary_status,'NOT VERIFIED')
})

test('the source flange-only axial assumption is not silently promoted to a top-T available strength',async()=>{
  const {result}=await fixture('ASD')
  assert.ok(check(result,'compression_top_t').nominal>0,'retain a diagnostic for review')
  assert.equal(check(result,'compression_top_t').capacity,null)
  assert.equal(check(result,'compression_top_t').coverage,'AXIAL_LOAD_PATH_UNCONFIRMED')
  assert.equal(check(result,'biaxial_h1').ratio,null)
})

test('fatigue demands actual detail/cycle inputs, has no phi/Omega and remains unverified even below allowable range',async()=>{
  const {sections,actions,result}=await fixture('ASD')
  assert.equal(check(result,'fatigue_bottom').capacity,null)
  const a={...actions,fatigue_detail_confirmed:true,fatigue_cycles:100000,fatigue_stress_range_mpa:40,fatigue_allowable_range_mpa:80}
  const asd=check(calculateCraneDesign(sections,a,'ASD'),'fatigue_bottom'),lrfd=check(calculateCraneDesign(sections,a,'LRFD'),'fatigue_bottom')
  near(asd.ratio,.5);near(lrfd.ratio,.5)
  assert.equal(asd.status,'NOT VERIFIED');assert.equal(asd.factor,undefined)
})

test('missing, nonfinite and physically invalid engineering inputs cannot return plausible results',async()=>{
  const {sections,actions}=await fixture('ASD')
  for(const delta of [{e:0},{fy:-1},{fu:100},{mx_knm:NaN},{cb:Infinity},{klx_mm:0},{fabrication:'guess'},{tension_field:1},{k_mm:0}]) assert.throws(()=>calculateCraneDesign(sections,{...actions,...delta},'ASD'),/Invalid|positive|Fu|k must/i)
  const missing={...actions};delete missing.klz_mm
  assert.throws(()=>calculateCraneDesign(sections,missing,'ASD'),/klz_mm/)
  assert.throws(()=>calculateCraneDesign(sections,actions,'360-05'),/method/)
  const zero=calculateCraneDesign(sections,{...actions,n_kn:0,mx_knm:0,my_knm:0,vx_kn:0,vy_kn:0,wlmax_kn:0},'ASD')
  assert.equal(zero.summary_status,'NOT VERIFIED')
  assert.equal(check(zero,'minor_governing').ratio,0)
})
