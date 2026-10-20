/** Report orchestration: reuses shared geometry and AISC core; never merges demand vectors. */
import {calculateHISectionProperties} from './hi-section-properties-core.mjs';
import {calculateIH36010,cbF11} from './aisc360-10-verified-hi.mjs';
import {prepareSymmetricComponent} from './sap-component-bridge.mjs';
const key=r=>JSON.stringify([r.frame,r.case_kind,r.output_case,r.step_type,r.step_num]);
export function comboMomentDiagram(dataset,row,member,options={},sourceRows=null){
 if(options.cbMode==='CONSERVATIVE')return {mode:'CONSERVATIVE',source:{frame:row.frame,case:row.output_case,step:row.step_type,step_num:row.step_num}};
 const start=options.segmentStart,end=options.segmentEnd,lb=member.unbraced_lengths.ltb.value;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||Math.abs(end-start-lb)>1e-6||end>member.length.value+1e-6)throw Error('Khai báo đầu/cuối đoạn LTB có chiều dài bằng Lb; không tự suy điểm giằng.');
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
/** A user-declared linear-depth reference, not CSI's EI interpolation or tapered-member design. */
export function stationReferenceMember(member,row){
 if(member?.section_type?.key==='i_wide_flange')return {member,reference:null};
 if(member?.section_type?.key!=='nonprismatic')throw Error('Unsupported section family.');
 const assignment=member.nonprismatic_assignment;
 const field=(block,name)=>Object.entries(block?.data||{}).find(([k])=>k.toLowerCase()===name.toLowerCase())?.[1];
 if(assignment?.status!=='ok'||field(assignment,'sVarTotalLength')!==0||field(assignment,'sVarRelStartLoc')!==0)throw Error('Nonprismatic: partial/unknown property assignment requires verified station mapping.');
 const segments=member.nonprismatic_segments;
 if(segments?.length!==1||segments[0].length_type!==1||!(segments[0].length>0))throw Error('Nonprismatic: reference currently requires one full-length relative segment.');
 const segment=segments[0],start=member.component_sections.find(c=>c.name===segment.start_section),end=member.component_sections.find(c=>c.name===segment.end_section);
 if(![start,end].every(c=>c?.section_type?.key==='i_wide_flange'&&c.geometry?.unit==='mm'))throw Error('Nonprismatic: both endpoint I/Wide Flange geometries are required.');
 const a=start.geometry.value,b=end.geometry.value,keys=['h','bf_top','bf_bottom','tf_top','tf_bottom','tw'];
 if(!keys.every(k=>Number.isFinite(a?.[k])&&a[k]>0&&Number.isFinite(b?.[k])&&b[k]>0))throw Error('Nonprismatic: endpoint dimensions are incomplete.');
 if(keys.filter(k=>k!=='h').some(k=>Math.abs(a[k]-b[k])>1e-6))throw Error('Nonprismatic: varying flange/web dimensions are outside the linear-depth reference.');
 const overwrite=member.material_overwrite;
 const assigned=field(overwrite,'PropName');
 const confirmed=overwrite&&['ok','empty'].includes(overwrite.status);
 const noOverwrite=typeof assigned==='string'&&['','none'].includes(assigned.trim().toLowerCase());
 if(!confirmed||(!noOverwrite&&assigned!==member.material_name)||(noOverwrite&&(!start.material_name||start.material_name!==end.material_name||start.material_name!==member.material_name)))throw Error('Nonprismatic: effective endpoint material/overwrite is unresolved or differs.');
 const length=member.length?.value,x=row.station_m;
 if(!(length>0)||!Number.isFinite(x)||x<0||x>length)throw Error('Nonprismatic: station must lie within confirmed I–J length.');
 const fraction=x/length,d={...a,h:a.h+(b.h-a.h)*fraction};
 const reference={scope:'PRISMATIC_REFERENCE_AT_STATION',status:'REVIEW_REQUIRED',station_m:x,fraction,start_section:start.name,end_section:end.name,start_dimensions_mm:structuredClone(a),end_dimensions_mm:structuredClone(b),dimensions_mm:d,
  basis:'User-requested linear depth over full I–J length; constant flange/web dimensions. Not inferred from EI33/EI22 variation. Not verified CSI tapered-member geometry or stability.',
  limitation:'D/C is the existing prismatic engine evaluated with this station geometry and declared lengths. It is not tapered-member stability or a code-compliant tapered-member D/C.'};
 return {member:{...member,section_type:{...member.section_type,key:'i_wide_flange'},geometry:{value:d,unit:'mm',source:reference.basis,status:'reference_assumption'}},reference};
}
export async function calculateReport(job,dataset,optionsFor,factors,onProgress=()=>{}){
 const groups=new Map(),geometryCache=new Map(),diagramCache=new Map(),sources=new Map();
 for(const row of dataset.rows){const k=key(row);if(!sources.has(k))sources.set(k,[]);sources.get(k).push(row)}
 const score=r=>Math.max(-Infinity,...(r.result?.member_compliance.checks||[]).map(c=>c.utilization).filter(Number.isFinite));
 for(const [index,row] of job.cases.entries()){
  let record;
  try{
   const member=job.members.find(m=>m.frame===row.frame),options=optionsFor(member,row);
   const resolved=stationReferenceMember(member,row),reference=resolved.reference;
   if(!(options.lz_m>0))throw Error('Nhập Lz khống chế xoắn; không tự lấy bằng chiều dài major.');
   if(options.cbMode!=='CONSERVATIVE'&&(row.station_m<options.segmentStart-1e-6||row.station_m>options.segmentEnd+1e-6))throw Error('Station nằm ngoài đoạn LTB đang kiểm tra.');
   const diagramKey=JSON.stringify([key(row),options.segmentStart,options.segmentEnd,options.cbMode,options.endsBraced,options.cantilever]);
   if(!diagramCache.has(diagramKey))diagramCache.set(diagramKey,comboMomentDiagram(dataset,row,member,options,sources.get(key(row))||[]));
   const diagram=diagramCache.get(diagramKey),cb=cbF11(diagram);if(cb.value==null)throw Error(cb.reason);
   const calculationJob=reference?{...job,members:job.members.map(m=>m.frame===row.frame?resolved.member:m)}:job;
   const packet=prepareSymmetricComponent(calculationJob,index,{...options,mappingConfirmed:true,builtUpConfirmed:true,damConfirmed:true,momentDiagram:diagram,cbOneConfirmed:diagram.mode==='CONSERVATIVE'});
   if(reference){packet.source.station_reference=structuredClone(reference);packet.source.original_section_type=structuredClone(member.section_type)}
   packet.source.Cb=structuredClone(cb);packet.source.moment_diagram=structuredClone(diagram);
   const hash=JSON.stringify(packet.input.section);
   if(!geometryCache.has(hash))geometryCache.set(hash,await calculateHISectionProperties(packet.input.section,{}));
   const geometry=geometryCache.get(hash),result=calculateIH36010({...packet.input,method:job.method,geometry_hash:geometry.geometry_hash},geometry.canonical,factors);
   if(reference){result.member_compliance.status='REVIEW_REQUIRED';result.member_compliance.scope=reference.scope;result.member_compliance.blockers.push({key:'tapered_stability',reason:reference.limitation})}
   record={index,packet,result,cb,reference,status:result.member_compliance.status,reason:result.member_compliance.blockers.map(b=>b.reason).join('; ')};
  }catch(error){record={index,frame:row.frame,case:row.output_case,reason:error.message,status:'INPUT_REQUIRED'}}
  const groupKey=JSON.stringify([row.frame,row.case_kind,row.output_case]);
  if(!groups.has(groupKey))groups.set(groupKey,{rows:[],governing:null,incomplete:false,coverage:0});
  const group=groups.get(groupKey);group.coverage++;
  group.missing_positions=(job.coverage?.unavailable_positions||[]).filter(p=>p.frame===row.frame&&p.case_kind===row.case_kind&&p.output_case===row.output_case);
  if(group.missing_positions.length)group.incomplete=true;
  const blocked=!record.result||record.result.member_compliance.blockers.length>0;
  group.incomplete||=blocked;group.rows.push({index,status:record.status,reason:record.reason,blocked,reference:record.reference??null,geometry:record.packet?.source.geometry??null,cb:record.cb??null,utilization:record.result?.member_compliance.utilization??null,interaction:record.result?.limit_states.interaction?.nominal??null});
  if(!group.governing||score(record)>score(group.governing)||(!group.governing.packet&&record.packet))group.governing=record;
  onProgress(index+1,job.cases.length);if(index%20===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return [...groups.values()];
}
