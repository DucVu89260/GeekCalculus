/** Report orchestration: reuses shared geometry and AISC core; never merges demand vectors. */
import {calculateHISectionProperties} from './hi-section-properties-core.mjs';
import {calculateIH36010,cbF11} from './aisc360-10-verified-hi.mjs';
import {prepareSymmetricComponent} from './sap-component-bridge.mjs';
const key=r=>JSON.stringify([r.frame,r.case_kind,r.output_case,r.step_type,r.step_num]);
/** Input/coverage validation only: brace coordinates are declarations, not inferred from ratios. */
export function reviewLtbSegment(member,options={}){
 const start=options.segmentStart,end=options.segmentEnd,lb=member?.unbraced_lengths?.ltb?.value,length=member?.length?.value;
 const result={start,end,lb,length,quarters:[],status:'INPUT_REQUIRED',reason:null};
 if(options.cbMode==='CONSERVATIVE'||options.cantilever===true)return {...result,status:'NOT_REQUIRED',reason:'Cb = 1: không cần tọa độ đoạn để tính Cb; Lb vẫn cần cho sức kháng.'};
 const fail=reason=>({...result,reason});
 if(!Number.isFinite(lb)||lb<=0)return fail('Chưa có Lb dương. Đọc ratio LTB từ SAP hoặc nhập Lb trước.');
 if(!Number.isFinite(length)||length<=0)return fail('Chưa có chiều dài Frame để kiểm tra tọa độ đoạn LTB.');
 if(!Number.isFinite(start))return fail('Chưa chọn đầu đoạn LTB. Nhập tọa độ start đã xác định; cuối đoạn có thể lấy start + Lb.');
 if(!Number.isFinite(end))return fail('Chưa có cuối đoạn LTB. Nhập end hoặc dùng start + Lb.');
 if(start<0||end<=start||end>length+1e-6)return fail('Đoạn LTB phải có 0 ≤ start < end ≤ Length của Frame.');
 if(Math.abs(end-start-lb)>1e-6)return fail('Chiều dài đoạn end − start khác Lb. Kiểm tra hai tọa độ hoặc dùng end = start + Lb.');
 return {...result,status:'READY',quarters:[.25,.5,.75].map(f=>start+f*(end-start))};
}
/** One root cause per group, counting force records once even when three metrics depend on it. */
export function summarizeMissingResults(group){
 const reasons=new Map();
 for(const row of group.rows||[])for(const [metric,reason] of Object.entries(row.metric_reasons||{}))if(reason){
  if(!reasons.has(reason))reasons.set(reason,{reason,metrics:new Set(),records:new Set()});
  const entry=reasons.get(reason);entry.metrics.add(metric);entry.records.add(row.index);
 }
 return [...reasons.values()].map(entry=>({reason:entry.reason,metrics:[...entry.metrics],record_count:entry.records.size}));
}
export function comboMomentDiagram(dataset,row,member,options={},sourceRows=null){
 if(options.cbMode==='CONSERVATIVE')return {mode:'CONSERVATIVE',source:{frame:row.frame,case:row.output_case,step:row.step_type,step_num:row.step_num}};
 if(options.cantilever===true)return {mode:'QUARTER_POINTS',is_unbraced_cantilever:true,source:{frame:row.frame,case:row.output_case,step:row.step_type,step_num:row.step_num,basis:'User-declared unbraced free-end cantilever; F1-1 Cb=1.'}};
 const segment=reviewLtbSegment(member,options);if(segment.status!=='READY')throw Error(segment.reason);
 const {start,end}=segment;
 if(row.station_m<start-1e-6||row.station_m>end+1e-6)throw Error('Station nằm ngoài đoạn LTB đang kiểm tra.');
 const source=sourceRows??dataset.rows.filter(r=>key(r)===key({...row,output_case:row.output_case}));
 const x=[...new Set(source.map(r=>r.station))].sort((a,b)=>a-b);
 function sample(target){
  const exact=source.filter(r=>Math.abs(r.station-target)<=Math.max(1e-6,(end-start)*1e-8));
  if(exact.length)return {station:target,value:exact.reduce((a,b)=>Math.abs(a.M3)>=Math.abs(b.M3)?a:b).M3,method:'SAP_original',ids:exact.map(r=>r.record_id)};
  const lo=x.filter(v=>v<target).at(-1),hi=x.find(v=>v>target);
  if(lo==null||hi==null)throw Error('Thiếu station kẹp mốc Cb; không ngoại suy.');
  const left=source.filter(r=>r.station===lo),right=source.filter(r=>r.station===hi);
  const pairs=left.flatMap(a=>right.filter(b=>b.element===a.element).map(b=>[a,b]));
  if(pairs.length!==1)throw Error('Mốc Cb qua ranh giới element/gián đoạn chưa xác định; không nội suy.');
  const [a,b]=pairs[0],w=(target-lo)/(hi-lo);return {station:target,value:a.M3+w*(b.M3-a.M3),method:'linear',weight:w,ids:[a.record_id,b.record_id]};
 }
 const samples=[0,.25,.5,.75,1].map(f=>sample(start+(end-start)*f));
 const originals=source.filter(r=>r.station>=start&&r.station<=end);
 const mmax=Math.max(...originals.map(r=>Math.abs(r.M3)),...samples.map(s=>Math.abs(s.value)));
 return {mode:'QUARTER_POINTS',ends_braced:options.endsBraced===true,same_case:true,segment_maximum_confirmed:true,is_unbraced_cantilever:options.cantilever===true,
  mmax,ma:samples[1].value,mb:samples[2].value,mc:samples[3].value,
  source:{frame:row.frame,case_kind:row.case_kind,case:row.output_case,step:row.step_type,step_num:row.step_num,start_m:start,end_m:end,samples,source_record_ids:originals.map(r=>r.record_id),coverage:'Mmax from all exported stations plus segment samples; complete SAP station export assumed as declared, not an independent analysis.'}};
}
/** CSI MyType1=relative,2=absolute; local reference mapping, not tapered stability. */
export function nonprismaticSegmentLayout(member){
 const segments=member.nonprismatic_segments,length=member.length?.value;
 if(!(Number.isFinite(length)&&length>0)||!Array.isArray(segments)||!segments.length)throw Error('Nonprismatic: confirmed length and segment definitions are required.');
 if(segments.some(s=>![1,2].includes(s.length_type)||!Number.isFinite(s.length)||s.length<=0))throw Error('Nonprismatic: invalid segment length or length type.');
 const absolute=segments.filter(s=>s.length_type===2).reduce((sum,s)=>sum+s.length,0),relative=segments.filter(s=>s.length_type===1).reduce((sum,s)=>sum+s.length,0);
 if(!Number.isFinite(absolute)||!Number.isFinite(relative))throw Error('Nonprismatic: segment length totals must be finite.');
 let scale=1;
 if(!relative){
  if(Math.abs(absolute-length)>1e-4)throw Error('Nonprismatic: absolute segment lengths do not cover the Frame; verify property assignment.');
  scale=length/absolute;
 }else if(absolute>=length)throw Error('Nonprismatic: no positive Frame length remains for relative segments.');
 let cursor=0;
 return segments.map((segment,index)=>{const span=segment.length_type===2?segment.length*scale:(length-absolute)*segment.length/relative,start=cursor;cursor+=span;return {...segment,index:index+1,start_m:start,end_m:index===segments.length-1?length:cursor,span_m:span,absolute_length_scale:scale,length_basis:relative?'absolute lengths plus remaining length by relative weights':scale===1?'absolute lengths':'absolute lengths proportionally reconciled to Frame within 0.1 mm'};});
}
/** User-declared piecewise linear depth, not CSI EI interpolation or tapered-member design. */
export function stationReferenceMember(member,row){
 if(member?.section_type?.key==='i_wide_flange')return {member,reference:null};
 if(member?.section_type?.key!=='nonprismatic')throw Error('Unsupported section family.');
 const assignment=member.nonprismatic_assignment;
 const field=(block,name)=>Object.entries(block?.data||{}).find(([k])=>k.toLowerCase()===name.toLowerCase())?.[1];
 if(assignment?.status!=='ok'||field(assignment,'sVarTotalLength')!==0||field(assignment,'sVarRelStartLoc')!==0)throw Error('Nonprismatic: partial/unknown property assignment requires verified station mapping.');
 const layout=nonprismaticSegmentLayout(member),length=member.length.value,x=row.station_m,tolerance=1e-6;
 if(!Number.isFinite(x)||x< -tolerance||x>length+tolerance)throw Error('Nonprismatic: station must lie within confirmed I–J length.');
 const effectiveX=Math.max(0,Math.min(length,x)),keys=['h','bf_top','bf_bottom','tf_top','tf_bottom','tw'];
 const overwrite=member.material_overwrite,assigned=field(overwrite,'PropName'),confirmed=overwrite&&['ok','empty'].includes(overwrite.status),noOverwrite=typeof assigned==='string'&&['','none'].includes(assigned.trim().toLowerCase());
 function resolve(segment){
  const start=member.component_sections.find(c=>c.name===segment.start_section),end=member.component_sections.find(c=>c.name===segment.end_section);
  if(![start,end].every(c=>c?.section_type?.key==='i_wide_flange'&&c.geometry?.unit==='mm'))throw Error('Nonprismatic: both endpoint I/Wide Flange geometries are required.');
  const a=start.geometry.value,b=end.geometry.value;
  if(!keys.every(k=>Number.isFinite(a?.[k])&&a[k]>0&&Number.isFinite(b?.[k])&&b[k]>0))throw Error('Nonprismatic: endpoint dimensions are incomplete.');
  if(keys.filter(k=>k!=='h').some(k=>Math.abs(a[k]-b[k])>1e-6))throw Error('Nonprismatic: varying flange/web dimensions are outside the linear-depth reference.');
  if(!confirmed||(!noOverwrite&&assigned!==member.material_name)||(noOverwrite&&(!start.material_name||start.material_name!==end.material_name||start.material_name!==member.material_name)))throw Error('Nonprismatic: effective endpoint material/overwrite is unresolved or differs.');
  const fraction=Math.max(0,Math.min(1,(effectiveX-segment.start_m)/segment.span_m)),d={...a,h:a.h+(b.h-a.h)*fraction};
  return {segment,start,end,a,b,fraction,d};
 }
 const candidates=layout.filter(s=>effectiveX>=s.start_m-1e-9&&effectiveX<=s.end_m+1e-9).map(resolve);
 const selected=candidates[0];
 if(!selected)throw Error('Nonprismatic: station has no mapped segment.');
 if(candidates.some(c=>keys.some(k=>Math.abs(c.d[k]-selected.d[k])>1e-3)))throw Error('Nonprismatic: discontinuous section at segment boundary; source side requires verification.');
 const {segment,start,end,a,b,fraction,d}=selected;
 const reference={scope:'PRISMATIC_REFERENCE_AT_STATION',status:'REVIEW_REQUIRED',station_m:x,effective_station_m:effectiveX,fraction,frame_fraction:effectiveX/length,segment_index:segment.index,boundary_segment_indices:candidates.map(c=>c.segment.index),segment_start_m:segment.start_m,segment_end_m:segment.end_m,segment_layout:layout,start_section:start.name,end_section:end.name,start_dimensions_mm:structuredClone(a),end_dimensions_mm:structuredClone(b),dimensions_mm:d,
  basis:'User-requested linear depth within each mapped segment; constant flange/web dimensions within the segment. Absolute/relative lengths retained; sub-0.1mm full-length discrepancy proportionally reconciled and disclosed. Not inferred from EI33/EI22 variation. Not verified CSI tapered-member stability.',
  limitation:'D/C is the existing prismatic engine evaluated with this station geometry and declared lengths. It is not tapered-member stability or a code-compliant tapered-member D/C.'};
 return {member:{...member,section_type:{...member.section_type,key:'i_wide_flange'},geometry:{value:d,unit:'mm',source:reference.basis,status:'reference_assumption'}},reference};
}
export async function calculateReport(job,dataset,optionsFor,factors,onProgress=()=>{}){
 const groups=new Map(),geometryCache=new Map(),diagramCache=new Map(),sources=new Map();
 for(const row of dataset.rows){const k=key(row);if(!sources.has(k))sources.set(k,[]);sources.get(k).push(row)}
 const score=r=>Math.max(-Infinity,...(r.result?.member_compliance.checks||[]).map(c=>c.utilization).filter(Number.isFinite));
 for(const [index,row] of job.cases.entries()){
  let record,cb=null,diagram=null,cbReason=null,resolved=null;
  const member=job.members.find(m=>m.frame===row.frame);
  let options;
  try{
   options=optionsFor(member,row);
   if(row.concurrency!=='concurrent')throw Error('Envelope/modal/nonconcurrent vector: choose a concurrent constituent case/combo/step.');
   const segment=reviewLtbSegment(member,options);
   if(segment.status==='INPUT_REQUIRED')throw Error(segment.reason);
   // This row-level guard must precede the cache: a prior in-segment row cannot authorize another station.
   if(segment.status==='READY'&&(row.station_m<segment.start-1e-6||row.station_m>segment.end+1e-6))throw Error('Station nằm ngoài đoạn LTB đang kiểm tra.');
   const diagramKey=JSON.stringify([key(row),options.segmentStart,options.segmentEnd,options.cbMode,options.endsBraced,options.cantilever]);
   if(!diagramCache.has(diagramKey))diagramCache.set(diagramKey,comboMomentDiagram(dataset,row,member,options,sources.get(key(row))||[]));
   diagram=diagramCache.get(diagramKey);cb=cbF11(diagram);if(cb.value==null)throw Error(cb.reason);
  }catch(error){cbReason=error.message;cb=null}
  try{
   resolved=stationReferenceMember(member,row);const reference=resolved.reference;
   if(!(options?.lz_m>0))throw Error('Nhập Lz khống chế xoắn; không tự lấy bằng chiều dài major.');
   if(cbReason)throw Error(cbReason);
   const calculationJob=reference?{...job,members:job.members.map(m=>m.frame===row.frame?resolved.member:m)}:job;
   const packet=prepareSymmetricComponent(calculationJob,index,{...options,mappingConfirmed:true,builtUpConfirmed:true,damConfirmed:true,momentDiagram:diagram,cbOneConfirmed:diagram.mode==='CONSERVATIVE'});
   if(reference){packet.source.station_reference=structuredClone(reference);packet.source.original_section_type=structuredClone(member.section_type)}
   packet.source.Cb=structuredClone(cb);packet.source.moment_diagram=structuredClone(diagram);
   const hash=JSON.stringify(packet.input.section);
   if(!geometryCache.has(hash))geometryCache.set(hash,await calculateHISectionProperties(packet.input.section,{}));
   const geometry=geometryCache.get(hash),result=calculateIH36010({...packet.input,method:job.method,geometry_hash:geometry.geometry_hash},geometry.canonical,factors);
   if(reference){result.overall_status='REVIEW_REQUIRED';result.member_compliance.status='REVIEW_REQUIRED';result.member_compliance.scope=reference.scope;result.member_compliance.blockers.push({key:'tapered_stability',reason:reference.limitation})}
   record={index,packet,result,cb,reference,status:result.member_compliance.status,reason:result.member_compliance.blockers.map(b=>b.reason).join('; ')};
  }catch(error){record={index,frame:row.frame,case:row.output_case,cb,reference:resolved?.reference??null,geometry:resolved?.member.geometry??null,reason:error.message,status:'INPUT_REQUIRED'}}
  const interaction=record.result?.limit_states.interaction;
  const knownChecks=(record.result?.member_compliance.checks||[]).filter(c=>Number.isFinite(c.utilization));
  record.metric_reasons={Cb:cbReason,H1:Number.isFinite(interaction?.nominal)?null:(interaction?.reason||record.reason||'H1 resistance/demand is incomplete.'),DC:knownChecks.length?null:(record.reason||'No applicable resistance check was calculated.')};
  record.calculated_utilization=knownChecks.length?record.result.member_compliance.utilization:null;
  const groupKey=JSON.stringify([row.frame,row.case_kind,row.output_case]);
  if(!groups.has(groupKey))groups.set(groupKey,{rows:[],governing:null,incomplete:false,coverage:0});
  const group=groups.get(groupKey);group.coverage++;
  group.missing_positions=(job.coverage?.unavailable_positions||[]).filter(p=>p.frame===row.frame&&p.case_kind===row.case_kind&&p.output_case===row.output_case);
  if(group.missing_positions.length)group.incomplete=true;
  const blocked=!record.result||record.result.member_compliance.blockers.length>0;
  group.incomplete||=blocked;group.rows.push({index,status:record.status,reason:record.reason,blocked,reference:record.reference??null,geometry:record.packet?.source.geometry??record.geometry??null,cb:record.cb??null,metric_reasons:record.metric_reasons,utilization:record.calculated_utilization,interaction:record.result?.limit_states.interaction?.nominal??null,checks:Object.fromEntries(knownChecks.map(c=>[c.key,c.utilization]))});
  if(!group.governing||score(record)>score(group.governing)||(!group.governing.packet&&record.packet)||(!group.governing.result&&!group.governing.cb&&record.cb))group.governing=record;
  onProgress(index+1,job.cases.length);if(index%20===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return [...groups.values()];
}

/** Reuse the batch kernel on demand; do not retain a full packet for every station. */
export async function calculateStationResult(job,dataset,index,options,factors){
 if(!Number.isInteger(index)||index<0||index>=job.cases.length)throw Error('Invalid station record index.');
 const row=job.cases[index];
 const groups=await calculateReport({...job,cases:[row]},dataset,()=>structuredClone(options),factors);
 const record=groups[0].governing;
 return {...record,index};
}
