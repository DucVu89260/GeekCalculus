const test=require('node:test'),assert=require('node:assert/strict')
const load=()=>import('../engineering/structural_engine/sap2000_v2/design_handoff.mjs')
function fixtures(){
 const member=frame=>({frame,analysis_section:'I1',data:{geometry:{length_m:frame==='1'?10:8},materials:{effective_material:'S'},design_overwrites:[18,19,20].map(item=>({item,status:'ok',data:{Value:.5,ProgDet:false}}))}})
 const snapshot={units:{system:'kN_m_C'},model:'fixture.sdb',pid:123,extracted_at:'one',members:[member('1'),member('2')],sections:{I1:{section_type:{key:'i_wide_flange'},i_dimensions_mm:{h:400,bf_top:200,bf_bottom:200,tf_top:12,tf_bottom:12,tw:8}}},materials:{S:{normalized:{Fy_MPa:345,Fu_MPa:450}}}}
 const row=(frame,id,station=0)=>({frame,record_id:id,station,element:frame+'e',output_case:'ULS',case_kind:'combination',step_type:'',step_num:0,P:-11,V2:2,V3:-3,T:0,M2:4,M3:-55,concurrency:'concurrent'})
 const dataset={units:'kN_m_C',axes:'SAP2000_local_123',model:'fixture.sdb',extracted_at:'two',rows:[row('1','a'),row('2','b')],missing_results:[]}
 const positions={model:'fixture.sdb',data:[{frame:'1',method:'linear',rows:[row('1','quarter',2.5)]},{frame:'1',method:'unavailable',fraction:.5,reason:'no bracket'}]}
 const summary={model:'fixture.sdb',data:[{min:{rows:[row('1','a')]},max:{rows:[row('2','b')]}}]}
 return {snapshot,dataset,positions,summary,method:'LRFD',referenceLengthConfirmed:true}
}
test('full preserves signed vectors and per-member lengths even with identical section names',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures(),before=JSON.stringify(f),job=prepareDesignJob(f)
 assert.equal(job.members[0].unbraced_lengths.major.value,5);assert.equal(job.members[1].unbraced_lengths.major.value,4)
 assert.equal(job.cases.length,3);assert.equal(job.cases[0].forces.M3,-55);assert.equal(job.cases[0].forces.P,-11)
 assert.equal(job.cases[0].Cb.value,null);assert.equal(job.status,'INPUT_REVIEW_ONLY');assert.equal(job.standard,'AISC360-10')
 assert.equal(job.coverage.unavailable_positions.length,1);assert.equal(JSON.stringify(f),before)
})
test('quick only retains summary rows and explicitly limits preview coverage',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures(),job=prepareDesignJob({...f,mode:'summary',frames:['2']})
 assert.equal(job.cases.length,1);assert.equal(job.members[0].frame,'2');assert.match(job.coverage.scope,/not all cases/)
 assert.throws(()=>prepareDesignJob({...f,mode:'summary',summary:null}),/summary/i)
})
test('wrong model/edition/position source rejected, no silent defaults',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures()
 assert.throws(()=>prepareDesignJob({...f,dataset:{...f.dataset,model:'other'}}),/same model/)
 assert.throws(()=>prepareDesignJob({...f,standard:'AISC360-22'}),/edition/)
 assert.throws(()=>prepareDesignJob({...f,positions:{...f.positions,model:'other'}}),/another model/)
})
test('ProgDet/zero/unconfirmed reference length do not become effective lengths',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures();f.snapshot.members[0].data.design_overwrites[0].data.ProgDet=true
 f.snapshot.members[0].data.design_overwrites[1].data.Value=0
 const job=prepareDesignJob(f);assert.equal(job.members[0].unbraced_lengths.major.value,null);assert.equal(job.members[0].unbraced_lengths.minor.value,null)
 assert.equal(prepareDesignJob({...f,referenceLengthConfirmed:false}).members[1].unbraced_lengths.ltb.value,null)
})
test('manual lengths independent per member and nonconcurrent rows are never design-ready',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures();f.dataset.rows[0].concurrency='nonconcurrent'
 const job=prepareDesignJob({...f,lengthSource:'manual',manualLengths:{'1':{major:3,minor:2,ltb:1}}})
 assert.equal(job.members[0].unbraced_lengths.major.source,'manual');assert.equal(job.members[1].unbraced_lengths.major.value,null)
 assert.equal(job.cases[0].status,'nonconcurrent_review_required')
})
test('tapered/asymmetric and unresolved geometry/material retain blockers',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures();f.snapshot.sections.I1.section_type.key='nonprismatic'
 const job=prepareDesignJob({...f,module:'asymmetric_i'})
 assert.match(job.members[0].issues.join(' '),/Tapered.*Asymmetric/)
 assert.equal('utilization' in job,false)
})
test('derived timestamps rejected and exported inputs cannot mutate the SAP snapshot',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures()
 assert.throws(()=>prepareDesignJob({...f,positions:{...f.positions,extracted_at:'old'}}),/stale/)
 const job=prepareDesignJob(f);job.members[0].geometry.value.h=999;job.members[0].design_overwrites[0].data.Value=99
 assert.equal(f.snapshot.sections.I1.i_dimensions_mm.h,400);assert.equal(f.snapshot.members[0].data.design_overwrites[0].data.Value,.5)
})

test('foreign units/axes cannot silently enter the handoff',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures()
 assert.throws(()=>prepareDesignJob({...f,dataset:{...f.dataset,units:'N_mm_C'}}),/units\/axes/)
 assert.throws(()=>prepareDesignJob({...f,dataset:{...f.dataset,axes:'Global'}}),/units\/axes/)
})

test('nonprismatic review includes child geometry without inventing intermediate dimensions',async()=>{
 const {prepareDesignJob}=await load(),f=fixtures()
 f.snapshot.sections.NP={section_type:{key:'nonprismatic'},components:[{name:'I1'}],segments:[{start_section:'I1',end_section:'I1'}]}
 f.snapshot.members[0].analysis_section='NP'
 const job=prepareDesignJob(f),member=job.members[0]
 assert.equal(member.geometry.value,null)
 assert.equal(member.component_sections[0].name,'I1')
 assert.equal(member.component_sections[0].geometry.value.h,400)
 assert.match(member.issues.join(' '),/Tapered/)
 member.component_sections[0].geometry.value.h=999
 assert.equal(f.snapshot.sections.I1.i_dimensions_mm.h,400)
})

const loadComponent=()=>import('../frontend/vue/public/sap-component-bridge.mjs')
const approvals={lz_m:2.2,mappingConfirmed:true,builtUpConfirmed:true,damConfirmed:true,cbOneConfirmed:true,unstiffenedConfirmed:true}
test('component transfer has explicit axis/unit mapping and independent lengths, no strength formulas',async()=>{
 const {prepareDesignJob}=await load(),{prepareSymmetricComponent,validateComponentPacket}=await loadComponent()
 const job=prepareDesignJob(fixtures()),before=JSON.stringify(job),packet=prepareSymmetricComponent(job,0,approvals)
 assert.deepEqual(packet.input.forces,{axial_kN:-11,moment_x_kNm:-55,moment_y_kNm:4,shear_y_kN:2,shear_x_kN:-3,torsion_kNm:0,moment_25_kNm:null,moment_50_kNm:null,moment_75_kNm:null})
 assert.equal(packet.input.member.lx_mm,5000);assert.equal(packet.input.member.lb_mm,5000);assert.equal(packet.input.member.lz_mm,2200)
 assert.equal(packet.input.material.fu_mpa,450);assert.equal(packet.input.material.e_mpa,200000)
 assert.equal(packet.source.frame,'1');assert.equal(packet.source.record_id,'a');assert.equal(packet.source.forces.M3,-55)
 assert.equal(JSON.stringify(job),before);assert.deepEqual(validateComponentPacket(packet),packet)
})
test('component blocks missing confirmations, lengths, nonconcurrent/tapered/asymmetric and editions',async()=>{
 const {prepareDesignJob}=await load(),{prepareSymmetricComponent}=await loadComponent(),job=prepareDesignJob(fixtures())
 for(const key of Object.keys(approvals))assert.throws(()=>prepareSymmetricComponent(job,0,{...approvals,[key]:null}))
 for(const patch of [{standard:'AISC360-22'},{module:'asymmetric_i'},{method:null}])assert.throws(()=>prepareSymmetricComponent({...job,...patch},0,approvals))
 assert.throws(()=>prepareSymmetricComponent({...job,cases:[{...job.cases[0],concurrency:'nonconcurrent'}]},0,approvals),/concurrent/)
 const copy=structuredClone(job);copy.members[0].section_type.key='nonprismatic';assert.throws(()=>prepareSymmetricComponent(copy,0,approvals),/Nonprismatic/)
 copy.members[0].section_type.key='i_wide_flange';copy.members[0].unbraced_lengths.major.value=null;assert.throws(()=>prepareSymmetricComponent(copy,0,approvals),/lengths/)
})

test('Cb diagram stays in one signed combo/step and uses full segment stations',async()=>{
 const {comboMomentDiagram}=await import('../frontend/vue/public/sap-steel-report.mjs')
 const row={frame:'1',case_kind:'combination',output_case:'ULS',step_type:'',step_num:0,station_m:5}
 const source=(id,x,m,extra={})=>({...row,record_id:id,element:'E',station:x,M3:m,...extra})
 const dataset={rows:[source('a',0,-100),source('b',10,0),source('foreign',5,9999,{output_case:'WIND'}),source('step',5,8888,{step_num:1})]}
 const member={length:{value:10},unbraced_lengths:{ltb:{value:10}}}
 const diagram=comboMomentDiagram(dataset,row,member,{segmentStart:0,segmentEnd:10,endsBraced:true})
 assert.equal(diagram.mmax,100);assert.equal(diagram.ma,-75);assert.equal(diagram.mb,-50);assert.equal(diagram.mc,-25)
 const {cbF11}=await import('../standards/aisc360-10-verified-hi.mjs');assert.ok(Math.abs(cbF11(diagram).value-5/3)<1e-12)
 assert.deepEqual(diagram.source.source_record_ids,['a','b'])
 assert.throws(()=>comboMomentDiagram({rows:[source('b',10,0)]},row,member,{segmentStart:0,segmentEnd:10,endsBraced:true}),/không ngoại suy/)
 assert.throws(()=>comboMomentDiagram(dataset,row,member,{segmentStart:0,segmentEnd:5,endsBraced:true}),/bằng Lb/)
})

test('report ranks calculated shear as well as H1 without combining vectors',async()=>{
 const {prepareDesignJob}=await load(),{calculateReport}=await import('../frontend/vue/public/sap-steel-report.mjs')
 const f=fixtures();f.positions=null;const a={...f.dataset.rows[0],P:0,M3:1,T:0,V2:0}
 f.dataset.rows=[a,{...a,record_id:'high-shear',station:10,V2:1e6}]
 const job=prepareDesignJob({...f,frames:['1'],lengthSource:'manual',manualLengths:{'1':{major:5,minor:5,ltb:10}}})
 const fs=require('node:fs'),vm=require('node:vm'),factors=vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../frontend/vue/public/aisc360-10-resistance.js'),'utf8')+';Aisc36010Resistance')
 const report=await calculateReport(job,f.dataset,()=>({lz_m:5,segmentStart:0,segmentEnd:10,endsBraced:true,unstiffenedConfirmed:true}),factors)
 assert.equal(report.length,1);assert.equal(report[0].coverage,2)
 assert.equal(report[0].governing.packet.source.record_id,'high-shear')
 assert.equal(report[0].governing.packet.input.forces.shear_y_kN,1e6)
 assert.equal(report[0].governing.packet.input.forces.moment_x_kNm,1)
})

test('zero/reversed moments and cantilever retain combo-specific Cb basis',async()=>{
 const {comboMomentDiagram}=await import('../frontend/vue/public/sap-steel-report.mjs'),{cbF11}=await import('../standards/aisc360-10-verified-hi.mjs')
 const row={frame:'F',case_kind:'combination',output_case:'C',step_type:'Min',step_num:0,station_m:2}
 const member={length:{value:4},unbraced_lengths:{ltb:{value:4}}},options={segmentStart:0,segmentEnd:4,endsBraced:true}
 const source=scale=>({rows:[{...row,station:0,record_id:'a',element:'E',M3:-100*scale},{...row,station:4,record_id:'b',element:'E',M3:100*scale}]})
 for(const scale of [1,-1,2])assert.ok(Math.abs(cbF11(comboMomentDiagram(source(scale),row,member,options)).value-25/11)<1e-12)
 assert.equal(cbF11(comboMomentDiagram(source(0),row,member,options)).value,1)
 assert.equal(cbF11(comboMomentDiagram(source(1),row,member,{...options,cantilever:true,endsBraced:false})).value,1)
})
