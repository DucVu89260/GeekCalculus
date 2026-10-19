/** SAP → Steel Design preparation. No capacity, axis mapping or Cb defaults inferred. */
const field=(r,name)=>Object.entries(r?.data||{}).find(([k])=>k.toLowerCase()===name.toLowerCase())?.[1]
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0
const item=(value,unit,source,status=value==null?'input_required':'provided')=>({value:value==null?null:(typeof value==='object'?structuredClone(value):value),unit,source,status})
export const MODULES=Object.freeze([
 {id:'symmetric_i',standard:'AISC360-10',label:'Symmetric I/H · ANSI/AISC 360-10',shape:'i_wide_flange',status:'input_review'},
 {id:'asymmetric_i',standard:'AISC360-10',label:'Asymmetric I/H · ANSI/AISC 360-10',shape:'i_wide_flange',status:'not_supported'},
])
export function prepareDesignJob({snapshot,dataset,positions,summary,mode='full',frames=null,module='symmetric_i',standard='AISC360-10',method=null,lengthSource='sap',manualLengths={},referenceLengthConfirmed=false}){
 if(!snapshot||!dataset||snapshot.model!==dataset.model)throw Error('Read a member snapshot and forces from the same model first')
 if(snapshot.units?.system!=='kN_m_C'||dataset.units!=='kN_m_C'||dataset.axes!=='SAP2000_local_123')throw Error('Expected confirmed kN–m SAP local123 source units/axes')
 if(!['full','summary'].includes(mode))throw Error('Unknown check mode')
 if(standard!=='AISC360-10'||!MODULES.some(m=>m.id===module&&m.standard===standard))throw Error('Unsupported component/edition')
 if(lengthSource!=='sap'&&lengthSource!=='manual')throw Error('Unknown length source')
 if(method!==null&&!['ASD','LRFD'].includes(method))throw Error('Explicit ASD/LRFD method required')
 if(mode==='summary'&&!summary)throw Error('Build the Section extreme summary first')
 if(positions&&positions.model!==dataset.model)throw Error('Position samples belong to another model')
 if(summary&&summary.model!==dataset.model)throw Error('Summary belongs to another model')
 for(const source of [positions,summary])if(source?.extracted_at&&source.extracted_at!==dataset.extracted_at)throw Error('Derived results are stale; recompute from the current force dataset')
 const wanted=frames?new Set(frames):new Set([...(dataset.members||[]).map(m=>m.frame),...dataset.rows.map(r=>r.frame)]),profiles=new Map(snapshot.members.map(m=>[m.frame,m])),rows=new Map(),provenance=new Map()
 const add=r=>{if(wanted.has(r.frame))rows.set(r.record_id,r)}
 if(mode==='full'){
  dataset.rows.forEach(add)
  for(const sample of positions?.data||[])for(const row of sample.rows||[]){add(row);provenance.set(row.record_id,{method:sample.method,source_record_ids:sample.source_record_ids||[],weight:sample.weight??null})}
 }else for(const group of summary.data||[])for(const type of ['min','max'])for(const [i,row] of (group[type]?.rows||[]).entries()){add(row);const location=group[type]?.locations?.[i];if(location)provenance.set(row.record_id,{method:location.method,source_record_ids:location.source_record_ids||[],weight:location.weight??null})}
 const forceFrames=new Set([...rows.values()].map(r=>r.frame))
 const members=[...wanted].map(frame=>{
  const m=profiles.get(frame),section=snapshot.sections[m?.analysis_section],materialName=m?.data?.materials?.effective_material,material=snapshot.materials[materialName],issues=[]
  if(!m)issues.push('Member snapshot missing')
  if(!forceFrames.has(frame))issues.push('No governing force rows available for this member in the selected mode')
  const type=section?.section_type?.key,d=section?.i_dimensions_mm
  const componentSections=(section?.components||[]).map(c=>{const child=snapshot.sections[c.name];return {name:c.name,section_type:structuredClone(child?.section_type??c.section_type??null),geometry:item(child?.i_dimensions_mm??child?.dimensions_mm??null,'mm','SAP component section '+c.name)}})
  if(type!=='i_wide_flange')issues.push(type==='nonprismatic'?'Tapered member requires a separately verified design method':'No supported component for this section family')
  if(module!=='symmetric_i')issues.push('Asymmetric I/H component is not supported by this handoff')
  if(d&&(![d.h,d.bf_top,d.bf_bottom,d.tf_top,d.tf_bottom,d.tw].every(positive)||Math.abs(d.bf_top-d.bf_bottom)>1e-6||Math.abs(d.tf_top-d.tf_bottom)>1e-6))issues.push('Symmetric I/H geometry not confirmed')
  if(!d)issues.push('I-section dimensions missing')
  const length=m?.data?.geometry?.length_m,overwrites=m?.data?.design_overwrites
  const lengths={}
  for(const [key,index] of [['major',18],['minor',19],['ltb',20]]){
   const overwrite=Array.isArray(overwrites)?overwrites.find(o=>o.item===index):null,ratio=field(overwrite,'Value'),prog=field(overwrite,'ProgDet')
   const valid=lengthSource==='sap'&&referenceLengthConfirmed&&positive(length)&&overwrite?.status==='ok'&&prog===false&&positive(ratio)
   const value=lengthSource==='manual'?manualLengths[frame]?.[key]:(valid?length*ratio:null)
   lengths[key]={...item(positive(value)?value:null,'m',lengthSource==='manual'?'manual':'SAP overwrite × confirmed frame I–J reference length'),sap_ratio:ratio??null,ProgDet:prog??null,reference_length_m:positive(length)?length:null}
   if(!positive(value))issues.push('Unbraced length '+key+' requires confirmation/input')
  }
  if(!positive(material?.normalized?.Fy_MPa)||!positive(material?.normalized?.Fu_MPa))issues.push('Material Fy/Fu missing or overwrite unresolved')
  if(!method)issues.push('Confirm ASD/LRFD and demand basis')
  issues.push('Confirm both exports represent the same analysis state, local-axis/sign mapping, fabrication, DAM assumptions, Lz and module-specific inputs before calculation')
  return {frame,section:m?.analysis_section??null,section_type:section?.section_type??null,material_name:materialName??null,
   geometry:item(d??null,'mm','SAP GetISection'),material:item(material?.normalized?Object.fromEntries(['Fy_MPa','Fu_MPa','E_MPa','G_MPa','expected_Fy_MPa','expected_Fu_MPa'].map(k=>[k,material.normalized[k]??null])):null,'MPa','Assigned SAP material; design overrides remain separate'),
   length:item(positive(length)?length:null,'m','SAP Global I/J coordinates'),unbraced_lengths:lengths,
   component_sections:componentSections,nonprismatic_segments:structuredClone(section?.segments||[]),design_overwrites:structuredClone(overwrites??null),issues}
 })
 const cases=[...rows.values()].map(row=>({frame:row.frame,record_id:row.record_id,output_case:row.output_case,case_kind:row.case_kind,step_type:row.step_type,step_num:row.step_num,element:row.element,station_m:row.station,
  provenance:provenance.get(row.record_id)||{method:'SAP_original',source_record_ids:[row.record_id],weight:null},forces:Object.fromEntries(['P','V2','V3','T','M2','M3'].map(k=>[k,row[k]])),force_units:{P:'kN',V2:'kN',V3:'kN',T:'kN·m',M2:'kN·m',M3:'kN·m'},axes:'SAP2000_local_123',concurrency:row.concurrency,
  status:row.concurrency==='concurrent'?'input_review':'nonconcurrent_review_required',
  Cb:{value:null,status:'input_required',basis:'Separate Combo/Step/Lb diagram and applicability confirmations required; no default Cb inferred'}}))
 return {schema_version:'sap-steel-handoff-1',status:'INPUT_REVIEW_ONLY',standard,module,method,mode,model:dataset.model,pid:snapshot.pid,
  source_times:{snapshot:snapshot.extracted_at,forces:dataset.extracted_at},members,cases,
  coverage:{scope:mode==='full'?'all exported members, original stations plus available five-point samples':'only exported Summary governing previews; not all cases or all ties',requested_frames:[...wanted],record_count:cases.length,
   five_point_samples:positions?'available samples only; see unavailable_positions':'not available; five-point coverage not established',missing_force_results:structuredClone(dataset.missing_results||[]),unavailable_positions:(positions?.data||[]).filter(p=>wanted.has(p.frame)&&p.method==='unavailable').map(p=>({frame:p.frame,output_case:p.output_case,step_type:p.step_type,step_num:p.step_num,fraction:p.fraction,reason:p.reason}))},
  note:'Preparation only, not design acceptance. Original signed force vectors retained; no capacities, utilization, Cb or tapered geometry calculated.'}
}
