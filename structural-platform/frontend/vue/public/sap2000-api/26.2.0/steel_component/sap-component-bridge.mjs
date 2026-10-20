import {cbF11} from './aisc360-10-verified-hi.mjs';
/** Explicit, reviewed SAP local123 → existing AISC360-10 symmetric I/H input. No strength formulas. */
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function prepareSymmetricComponent(job,index,options={}){
 if(job?.schema_version!=='sap-steel-handoff-1'||job.standard!=='AISC360-10'||job.module!=='symmetric_i')throw Error('Select Symmetric I/H · AISC 360-10. Asymmetric I/H is pending.');
 if(!['LRFD','ASD'].includes(job.method))throw Error('Confirm ASD/LRFD in input review.');
 if(!Number.isInteger(index)||index<0||index>=job.cases.length)throw Error('Select an available force record.');
 const row=job.cases[index],member=job.members.find(m=>m.frame===row.frame),d=member?.geometry?.value,mat=member?.material?.value;
 if(member?.section_type?.key!=='i_wide_flange'||!d)throw Error('Prismatic I/Wide Flange required. Nonprismatic remains input review.');
 if(![d.h,d.bf_top,d.bf_bottom,d.tw,d.tf_top,d.tf_bottom].every(positive)||d.h<=d.tf_top+d.tf_bottom||Math.abs(d.bf_top-d.bf_bottom)>1e-6||Math.abs(d.tf_top-d.tf_bottom)>1e-6)throw Error('Positive doubly symmetric I/H dimensions required.');
 if(member.geometry.unit!=='mm'||member.material.unit!=='MPa'||!positive(mat?.Fy_MPa)||!positive(mat?.Fu_MPa)||!positive(member.length?.value))throw Error('Confirmed geometry/material units, Fy/Fu and frame length required.');
 const lengths=member.unbraced_lengths;
 if(!['major','minor','ltb'].every(k=>positive(lengths?.[k]?.value)&&lengths[k].unit==='m'))throw Error('Enter/confirm Major, Minor and LTB lengths for this Frame.');
 if(options.lz_source==='declared_Lz_equals_Lb'&&options.lz_m!==lengths.ltb.value)throw Error('Declared Lz=Lb source must match the current Lb.');
 if(!positive(options.lz_m))throw Error('Enter independent torsional restraint length Lz (m).');
 if(row.axes!=='SAP2000_local_123'||!['P','V2','V3','T','M2','M3'].every(k=>finite(row.forces?.[k])&&row.force_units?.[k]===(['P','V2','V3'].includes(k)?'kN':'kN·m')))throw Error('Expected finite six-force vector in confirmed SAP local123 kN / kN·m.');
 if(row.concurrency!=='concurrent')throw Error('Envelope/modal/nonconcurrent vector: choose a concurrent constituent case/combo/step.');
 for(const key of ['mappingConfirmed','builtUpConfirmed','damConfirmed','unstiffenedConfirmed'])if(options[key]!==true)throw Error('Confirm axes/signs, welded built-up section, DAM, conservative Cb=1 and unstiffened web before loading.');
 if(!options.momentDiagram&&options.cbOneConfirmed!==true)throw Error('Adopt conservative Cb=1 or supply a source-bound moment diagram.');
 if(options.momentDiagram?.source&&(options.momentDiagram.source.frame!==row.frame||options.momentDiagram.source.case!==row.output_case||options.momentDiagram.source.step!==row.step_type||options.momentDiagram.source.step_num!==row.step_num))throw Error('Cb source does not match the current frame/combo/step.');
 if(options.momentDiagram&&cbF11(options.momentDiagram).value==null)throw Error('Cb diagram requires complete same-combo segment input.');
 const f=row.forces;
 const input={material:{fy_mpa:mat.Fy_MPa,fu_mpa:mat.Fu_MPa,e_mpa:200000},
 section:{h_mm:d.h,bf_mm:d.bf_top,tw_mm:d.tw,tf_mm:d.tf_top,fabrication:'BUILT_UP',web_attachment:'WELDED',web_clear_height_mm:null,web_clear_height_verified:false},
 member:{lx_mm:lengths.major.value*1000,ly_mm:lengths.minor.value*1000,lb_mm:lengths.ltb.value*1000,lz_mm:options.lz_m*1000,kx:1,ky:1,kz:1,g_mpa:77200},
 forces:{axial_kN:f.P,moment_x_kNm:f.M3,moment_y_kNm:f.M2,shear_y_kN:f.V2,shear_x_kN:f.V3,torsion_kNm:f.T,moment_25_kNm:null,moment_50_kNm:null,moment_75_kNm:null},
 stiffeners:{spacing_mm:0,thickness_mm:0,width_mm:0,fy_mpa:null,layout:'PAIRED',orientation:'PERPENDICULAR_RECTANGULAR_PLATE',inertia_mm4:null,inertia_axis_verified:false,attachment_details_verified:false},
 assessment:{scope:'GROSS_MEMBER',force_source:'MANUAL'},analysis:{method:'DIRECT',forces_method:job.method},
 tension_field_action:{enabled:false,is_end_panel:null,panel_position:'',panel_position_confirmed:false,four_sides_supported:null,four_sides_supported_confirmed:false,adjacent_panels:[],bounding_stiffeners:[],same_boundaries_confirmed:false}};
 if(options.momentDiagram)input.moment_diagram=structuredClone(options.momentDiagram);
 return {schema:'gc-sap-symmetric-component-1',standard:job.standard,component:'symmetric_i',method:job.method,input,
 source:{demand_method:job.method,model:job.model,pid:job.pid,source_times:structuredClone(job.source_times),mode:job.mode,frame:row.frame,section:member.section,material:member.material_name,record_id:row.record_id,case:row.output_case,case_kind:row.case_kind,step_type:row.step_type,step_num:row.step_num,station_m:row.station_m,element:row.element,forces:structuredClone(row.forces),provenance:structuredClone(row.provenance),geometry:structuredClone(member.geometry),material_values:structuredClone(member.material),poisson_ratio:structuredClone(member.poisson_ratio??null),length:structuredClone(member.length),unbraced_lengths:structuredClone(lengths),mapping:'N=P; Mx=M3; My=M2; Vy=V2; Vx=V3; torsion=T; signs retained, confirmed by user',nominal_moduli:'AISC resistance E=200000 MPa, G=77200 MPa; original SAP values retained separately',Cb:cbF11(options.momentDiagram??{mode:'CONSERVATIVE'}),Lz:{value:options.lz_m,unit:'m',source:options.lz_source||'manual'},assumptions:structuredClone(options),review:'User-reviewed SAP values enter the existing manual-input gross member engine. Analysis model not verified; no automatic batch or full-member certification.'}};
}
export function validateComponentPacket(packet){
 if(packet?.schema!=='gc-sap-symmetric-component-1'||packet.standard!=='AISC360-10'||packet.component!=='symmetric_i'||!['LRFD','ASD'].includes(packet.method))throw Error('Unsupported component packet/edition.');
 if(packet.source?.station_reference||packet.source?.original_section_type?.key==='nonprismatic')throw Error('Tapered station reference is not a prismatic member design packet.');
 const i=packet.input;
 if(packet.source?.Lz?.source==='declared_Lz_equals_Lb'&&(i?.member?.lz_mm!==i?.member?.lb_mm||packet.source.Lz.value*1000!==i?.member?.lz_mm))throw Error('Declared Lz=Lb input/source mismatch.');
 if(!positive(i?.material?.fy_mpa)||!positive(i.material.fu_mpa)||i.material.e_mpa!==200000||i.member?.g_mpa!==77200)throw Error('Invalid component material.');
 if(!['h_mm','bf_mm','tw_mm','tf_mm'].every(k=>positive(i.section?.[k]))||i.section.h_mm<=2*i.section.tf_mm||i.section.fabrication!=='BUILT_UP'||i.section.web_attachment!=='WELDED')throw Error('Invalid component geometry.');
 if(!['lx_mm','ly_mm','lb_mm','lz_mm'].every(k=>positive(i.member[k]))||!['kx','ky','kz'].every(k=>i.member[k]===1))throw Error('Invalid member lengths/K.');
 if(!['axial_kN','moment_x_kNm','moment_y_kNm','shear_x_kN','shear_y_kN','torsion_kNm'].every(k=>finite(i.forces?.[k])))throw Error('Invalid component forces.');
 if(!packet.source||typeof packet.source.frame!=='string'||typeof packet.source.case!=='string')throw Error('Missing source trace.');
 for(const key of ['mappingConfirmed','builtUpConfirmed','damConfirmed','unstiffenedConfirmed'])if(packet.source.assumptions?.[key]!==true)throw Error('Missing input confirmation.');
 if(!i.moment_diagram&&packet.source.assumptions?.cbOneConfirmed!==true)throw Error('Missing Cb basis.');
 if(i.moment_diagram&&cbF11(i.moment_diagram).value==null)throw Error('Invalid Cb diagram.');
 return structuredClone(packet);
}
