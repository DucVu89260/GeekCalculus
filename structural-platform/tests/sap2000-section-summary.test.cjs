const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path')
const html=fs.readFileSync(path.join(__dirname,'../engineering/structural_engine/member_forces/panel.html'),'utf8')
const code=html.split('// BEGIN_SECTION_SUMMARY')[1].split('// END_SECTION_SUMMARY')[0]
const reduce=vm.runInNewContext(code+';buildSectionSummary')
const summarize=(result,members)=>structuredClone(reduce(result,members))
const row=(id,frame,M3,P,V2,extra={})=>({record_id:id,frame,output_case:'Combo '+id,element:frame+'-1',station:2,step_type:'',step_num:0,concurrency:'concurrent',P,V2,M3,M2:-4,V3:1,T:0.3,...extra})
const loc=r=>({frame:r.frame,station:r.station,method:'original',source_record_ids:[r.record_id],weight:null})
const governing=(value,rows)=>({value,record_ids:rows.map(r=>r.record_id),tie_count:rows.length,rows:rows.slice(0,20),locations:rows.slice(0,20).map(loc),rows_truncated:rows.length>20})
const item=(frame,minRows,maxRows,component='M3')=>({group:frame,component,min:governing(minRows[0][component],minRows),max:governing(maxRows[0][component],maxRows)})
const response=data=>({scope:'per_frame',components:['M3'],position:'end_j',units:{force:'kN',moment:'kN.m',length:'m'},data,source_rows:[],unavailable_positions:[]})

test('section minimum/maximum retain the correct signed governing full vector, case and frame',()=>{
 const a=row('a','F1',-120,-10,4),b=row('b','F1',80,90,-9),c=row('c','F2',-20,-55,27),d=row('d','F2',175,8,-6)
 const otherLow=row('e','F3',-900,400,500),otherHigh=row('f','F3',500,600,700)
 const input=response([item('F1',[a],[b]),item('F2',[c],[d]),item('F3',[otherLow],[otherHigh])]),before=JSON.stringify(input)
 const output=summarize(input,[{frame:'F1',section:'RF1'},{frame:'F2',section:'RF1'},{frame:'F3',section:'SC1'}])
 assert.equal(output.data.length,2)
 const rf=output.data.find(g=>g.section==='RF1');assert.equal(rf.min.value,-120);assert.equal(rf.max.value,175)
 assert.deepEqual(rf.min.rows[0],a);assert.deepEqual(rf.max.rows[0],d)
 assert.equal(rf.max.rows[0].P,8);assert.equal(rf.max.rows[0].V2,-6)
 assert.equal(rf.max.rows[0].output_case,'Combo d');assert.equal(rf.max.locations[0].frame,'F2')
 assert.equal(output.scope,'section');assert.equal(output.source_scope,'per_frame');assert.equal(output.position,'end_j')
 assert.equal(JSON.stringify(input),before)
})

test('exact ties across members are retained independently; nearby values are not treated as ties',()=>{
 const a=row('a','F1',-120,-10,4),b=row('b','F2',-120,99,8),c=row('c','F3',-119.999999,7,2)
 const data=[item('F1',[a],[a]),item('F2',[b],[b]),item('F3',[c],[c])]
 const out=summarize(response(data),data.map(g=>({frame:g.group,section:'RF1'}))).data[0]
 assert.deepEqual(out.min.record_ids,['a','b']);assert.equal(out.min.tie_count,2)
 assert.deepEqual(out.min.rows.map(r=>r.P),[-10,99]);assert.equal(out.min.rows_truncated,false)
})

test('large tie sets keep every ID, bounded previews and aligned location provenance',()=>{
 const first=Array.from({length:25},(_,i)=>row('a'+i,'F1',10,i,2)),second=Array.from({length:25},(_,i)=>row('b'+i,'F2',10,-i,3))
 const out=summarize(response([item('F1',first,first),item('F2',second,second)]),[{frame:'F1',section:'RF1'},{frame:'F2',section:'RF1'}]).data[0]
 assert.equal(out.max.tie_count,50);assert.equal(out.max.record_ids.length,50);assert.equal(out.max.rows.length,20);assert.equal(out.max.rows_truncated,true)
 for(let i=0;i<20;i++)assert.equal(out.max.locations[i].source_record_ids[0],out.max.rows[i].record_id)
})

test('missing section metadata does not combine unrelated members; tiny original values remain exact',()=>{
 const a=row('a','F1',9.21e-21,160.234312313,-9.21e-21),b=row('b','F2',1,5,3)
 const out=summarize(response([item('F1',[a],[a]),item('F2',[b],[b])]),[])
 assert.equal(out.data.length,2);assert.notEqual(out.data[0].group,out.data[1].group)
 assert.equal(out.data[0].min.value,9.21e-21);assert.equal(out.data[0].min.rows[0].P,160.234312313)
})

test('each component keeps its own governing vector, interpolation sources and concurrency',()=>{
 const a=row('a','F1',-12,40,3,{concurrency:'nonconcurrent'}),b=row('b','F2',20,-55,10)
 const m3=item('F1',[a],[a]);m3.min.locations[0]={...loc(a),method:'linear',source_record_ids:['left','right'],weight:0.25}
 const p=item('F2',[b],[b],'P')
 const output=summarize(response([p,m3]),[{frame:'F1',section:'RF1'},{frame:'F2',section:'RF1'}])
 assert.deepEqual(output.data.map(i=>i.component),['M3','P'])
 assert.equal(output.data[0].min.locations[0].weight,0.25);assert.deepEqual(output.data[0].min.locations[0].source_record_ids,['left','right'])
 assert.equal(output.data[0].min.rows[0].concurrency,'nonconcurrent');assert.equal(output.data[1].min.rows[0].frame,'F2')
})
