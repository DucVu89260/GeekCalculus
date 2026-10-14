<script setup>
import { reactive, ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { demoMode, request } from '../api'
defineProps({locale:{type:String,required:true}})
const section=reactive({h_mm:940,bf_mm:250,tw_mm:6,tf_mm:12,fabrication:'BUILT_UP'})
const material=reactive({fy_mpa:345,e_mpa:200000})
const member=reactive({lb_mm:5500,lx_mm:12000})
const stiffeners=reactive({spacing_mm:2500,thickness_mm:6,width_mm:100,layout:'PAIRED'})
const forces=reactive({axial_kN:-138.439,moment_x_kNm:-806.3536,moment_y_kNm:0.0903,shear_x_kN:67.821,shear_y_kN:0.214,moment_25_kNm:-713.0995337748,moment_50_kNm:-619.8454675497,moment_75_kNm:-370.3123961538})
const sections=[
 {name:'Hình học (mm)',data:section,fields:[['h_mm','h'],['bf_mm','bf'],['tw_mm','tw'],['tf_mm','tf']]},
 {name:'Vật liệu (MPa)',data:material,fields:[['fy_mpa','Fy'],['e_mpa','E']]},
 {name:'Chiều dài (mm)',data:member,fields:[['lb_mm','Lb'],['lx_mm','Lx']]},
 {name:'Sườn tăng cứng (mm)',data:stiffeners,fields:[['spacing_mm','a'],['thickness_mm','ts'],['width_mm','bs']]},
 {name:'Nội lực (kN / kN·m)',data:forces,fields:[['axial_kN','N (+ kéo)'],['moment_x_kNm','Mx'],['moment_y_kNm','My'],['shear_x_kN','Vx'],['shear_y_kN','Vy'],['moment_25_kNm','M¼'],['moment_50_kNm','M½'],['moment_75_kNm','M¾']]}
]
const result=ref(null),error=ref(''),busy=ref(false),active=ref(0)
const fmt=(v)=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:5}).format(v):v??'—'
const steps=[
 {name:'Section Properties',ref:'Chapter B · geometric section properties',lines:r=>[['A','2 bf tf + (h − 2tf)tw',r.section_properties.area_mm2,'mm²'],['Ix','[bf h³ − (bf − tw)(h − 2tf)³]/12',r.section_properties.ix_mm4,'mm⁴'],['Iy','[(h − 2tf)tw³ + 2tf bf³]/12',r.section_properties.iy_mm4,'mm⁴'],['Sx','2Ix/h',r.section_properties.sx_mm3,'mm³'],['Sy','2Iy/bf',r.section_properties.sy_mm3,'mm³'],['Zx','bf tf(h − tf) + tw(h − 2tf)²/4',r.section_properties.zx_mm3,'mm³']]},
 {name:'Section Classification',ref:'Table B4.1a and Table B4.1b',lines:r=>[['λf','bf/(2tf)',r.classification.lambda_flange,''],['λw','(h − 2tf)/tw',r.classification.lambda_web,''],['λp,f','0.38√(E/Fy)',r.classification.lambda_p_flange,''],['λr,f','Legacy limit — review applicability',r.classification.lambda_r_flange,''],['λp,w','3.76√(E/Fy)',r.classification.lambda_p_web,''],['λr,w','5.70√(E/Fy)',r.classification.lambda_r_web,'']]},
 {name:'Minor-axis Flexure',ref:'Section F6',lines:r=>[['φMn,y','0.90 min(Mp,y;Mn,FLB)',r.strengths.phi_mny_kNm,'kN·m']]},
 {name:'Major-axis Flexure',ref:'Sections F2–F5; Equation F1-1 (Cb)',lines:r=>[['Cb (legacy)','12.5 Mx/(2.5 Mx + 3 M¼ + 4 M½ + 3 M¾)',r.trace.cb_signed_legacy,''],['Lp','Limiting unbraced length (legacy branch)',r.trace.lp_mm,'mm'],['Lr','Limiting unbraced length (legacy branch)',r.trace.lr_mm,'mm'],['Mn,LTB','Lateral-torsional buckling',r.trace.mnx_ltb_kNm,'kN·m'],['Mn,FLB','Flange local buckling',r.trace.mnx_local_kNm,'kN·m'],['φMn,x','0.90 min(Mn,LTB;Mn,FLB;Mn,yield)',r.strengths.phi_mnx_kNm,'kN·m']]},
 {name:'Tension',ref:'Section D2 — gross yielding only',lines:r=>[['φPt','0.90 Fy A',r.strengths.phi_pn_tension_gross_kN,'kN']]},
 {name:'Compression',ref:'Sections E3 and E7',lines:r=>[['Qs','Flange reduction',r.trace.qs,''],['Qa','Effective area ratio',r.trace.qa,''],['Q','Qs Qa',r.trace.q,''],['Fcr,x','Flexural buckling stress',r.trace.fcrx_mpa,'MPa'],['Fcr,y (legacy)','Reuses strong-axis Fe; must be corrected',r.trace.fcry_mpa,'MPa'],['φPn','0.90 min(Fcr,x;Fcr,y) A',r.strengths.phi_pn_compression_kN,'kN']]},
 {name:'Interaction N–Mx–My',ref:'Equations H1-1a and H1-1b',lines:r=>[['Pr/Pc','|N|/φPn',r.interaction.axial_ratio,''],['Mrx/Mcx','|Mx|/φMn,x',r.interaction.moment_x_ratio,''],['Mry/Mcy','Rounded legacy ratio',r.interaction.moment_y_ratio_rounded,''],['H1 D/C',r.interaction.axial_ratio>=.2?'Pr/Pc + (8/9)(Mrx/Mcx + Mry/Mcy)':'Pr/(2Pc) + Mrx/Mcx + Mry/Mcy',r.interaction.lrfd_percent,'%']]},
 {name:'Shear Strength',ref:'Sections G2 and G7',lines:r=>[['Cv,web','Web shear coefficient',r.trace.web_cv,''],['φVn,web','φ × 0.6Fy Aw Cv',r.strengths.phi_vn_web_kN,'kN'],['Web D/C','100 |Vy|/φVn,web (legacy axes)',r.shear.web_percent,'%'],['Cv,flange','Flange shear coefficient',r.trace.flange_cv,''],['Flange D/C','100 |Vx|/φVn,flange',r.shear.flange_percent,'%']]},
 {name:'Stiffeners & Conclusion',ref:'Chapter G — check precise clause before use',lines:r=>[['Width check','Legacy stiffener width check',r.shear.stiffener_width_ok?'OK':'NOT OK',''],['Area check','Legacy reversed-inequality check',r.shear.stiffener_area_legacy_ok?'OK':'NOT OK',''],['Tension field','Only an unverified eligibility flag',r.shear.tension_field_eligible_legacy?'Unverified':'Not eligible',''],['Overall','Parity mode',r.overall_status,'']]}
]
const shown=computed(()=>result.value?steps.map((step,i)=>({...step,i,rows:step.lines(result.value)})):[])
let watcher
function startSpy(){
 watcher?.disconnect()
 watcher=new IntersectionObserver(entries=>{
   const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top))
   if(visible[0])active.value=Number(visible[0].target.dataset.index)
 },{rootMargin:'-15% 0px -65% 0px',threshold:[0,.15,.4]})
 document.querySelectorAll('.hi-step').forEach(el=>watcher.observe(el))
}
async function calculate(){
 error.value='';busy.value=true
 try{
  result.value=await request('/api/v1/steel-design/components/hi-doubly-symmetric/legacy-parity',{method:'POST',body:JSON.stringify({section,material,member,stiffeners,forces})})
  await nextTick();startSpy()
 }catch(e){error.value=e.message||'Calculation failed'}finally{busy.value=false}
}
async function go(i){
 const element=document.querySelector('.hi-step[data-index="'+i+'"]')
 if(!element)return
 element.open=true;active.value=i;await nextTick();element.scrollIntoView({behavior:'smooth',block:'start'})
}
onBeforeUnmount(()=>watcher?.disconnect())
</script>
<template>
<section class="hi-module">
<header class="hi-heading"><h3>H/I Doubly Symmetric</h3><small>Phase 1 · Legacy Excel Parity · LRFD</small></header>
<p class="hi-warning">Reference workbook: AISC 360-05. AISC 360-10 references below are research pointers, NOT validated formula certifications. Signed Cb, weak-axis Fe and stiffener checks retain known legacy issues. Do not use for structural design approval.</p>
<div class="hi-layout">
  <form class="hi-inputs" @submit.prevent="calculate">
   <h4>01 · Input Parameters</h4>
   <fieldset v-for="group in sections" :key="group.name"><legend>{{group.name}}</legend>
    <label v-for="[key,label] in group.fields" :key="key"><span>{{label}}</span><input v-model.number="group.data[key]" type="number" step="any" required /></label>
    <label v-if="group.data===section"><span>Fabrication</span><select v-model="section.fabrication"><option value="BUILT_UP">Built-up</option><option value="ROLLED">Rolled</option></select></label>
    <label v-if="group.data===stiffeners"><span>Layout</span><select v-model="stiffeners.layout"><option value="PAIRED">Paired</option><option value="SINGLE_ANGLE">Single angle</option><option value="SINGLE_PLATE">Single plate</option></select></label>
   </fieldset>
   <button type="submit" :disabled="busy||demoMode">{{busy?'Calculating…':'Calculate (parity)'}}</button>
   <small v-if="demoMode">Laravel API not available in static demo.</small>
   <p v-if="error" class="hi-error" role="alert">{{error}}</p>
  </form>
  <div class="hi-output">
   <section v-if="result"><h4>02 · Calculation Results</h4>
    <div class="hi-scroll"><table><thead><tr><th>Clause</th><th>Limit state</th><th>Demand</th><th>Capacity</th><th>D/C</th><th>Status</th></tr></thead>
    <tbody><tr v-for="c in result.limit_states" :key="c.id"><td>{{c.clause}}</td><td>{{c.id.replaceAll('_',' ')}}</td><td>{{fmt(c.demand)}}</td><td>{{fmt(c.capacity)}}</td><td>{{fmt(c.utilization*100)}}%</td><td>{{c.status}}</td></tr></tbody></table></div>
    <h4>03 · Calculation Details · Step by Step</h4>
    <div class="hi-notebook"><nav class="hi-index" aria-label="Calculation index"><strong>Calculation index</strong>
      <button v-for="step in shown" :key="step.i" type="button" :class="{active:active===step.i}" @click="go(step.i)">{{String(step.i+1).padStart(2,'0')}} · {{step.name}}</button>
    </nav><div class="hi-pages">
      <details v-for="step in shown" :key="step.i" class="hi-step" :data-index="step.i" :open="step.i===0||step.i===6"><summary><strong>{{String(step.i+1).padStart(2,'0')}} · {{step.name}}</strong><small>AISC 360-10 reference: {{step.ref}}</small></summary>
        <div class="hi-scroll"><table><thead><tr><th>Parameter</th><th>Formula / trace</th><th>Value</th><th>Reference to review</th></tr></thead>
          <tbody><tr v-for="(row,j) in step.rows" :key="j"><td>{{row[0]}}</td><td>{{row[1]}}</td><td>{{fmt(row[2])}} {{row[3]}}</td><td>AISC 360-10 · {{step.ref}}</td></tr></tbody></table></div>
      </details></div></div>
    <h4>Warnings</h4><ul><li v-for="w in result.warnings" :key="w.code"><strong>{{w.code}}</strong> — {{w.message}}</li></ul>
   </section>
   <p v-else>Nhấn Calculate để hiển thị Demand/Capacity và thuyết minh theo từng bước.</p>
  </div>
</div>
</section>
</template>
<style scoped>
.hi-module{color:#203b58}.hi-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.hi-heading h3{font-size:23px}.hi-heading small{color:#647a8b}.hi-warning{padding:12px;border:1px solid #d9ac67;background:#fff5e4;border-radius:9px;font-size:13px;line-height:1.65}.hi-layout{display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:18px;align-items:start}.hi-inputs,.hi-output{min-width:0;padding:15px;border:1px solid var(--surface-border);border-radius:12px;background:var(--workspace-bg)}.hi-inputs fieldset{min-width:0;border:1px solid var(--surface-border);border-radius:9px;margin-bottom:12px;display:grid;gap:8px}.hi-inputs legend{font-weight:700;font-size:13px}.hi-inputs label{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:6px;font-size:12px}.hi-inputs input,.hi-inputs select{width:100%;min-width:0;padding:7px;border:1px solid var(--surface-border);border-radius:5px;background:var(--field-bg)}.hi-inputs button{background:#23395d;color:white;border:0;border-radius:7px;padding:11px;font-weight:700}.hi-inputs button:disabled{opacity:.5}.hi-error{color:#a33}.hi-scroll{overflow:auto}.hi-output table{border-collapse:collapse;width:100%;font-size:12px}.hi-output th,.hi-output td{border-bottom:1px solid var(--surface-border);padding:9px;text-align:left;vertical-align:top}.hi-output th{color:#5c7385;font-size:11px}.hi-notebook{display:grid;grid-template-columns:175px minmax(0,1fr);gap:12px;align-items:start}.hi-index{position:sticky;top:20px;max-height:calc(100vh - 40px);overflow:auto;display:grid;gap:5px;padding:9px;border:1px solid var(--surface-border);border-radius:8px}.hi-index button{border:0;border-radius:5px;padding:9px 7px;text-align:left;background:transparent;color:#355e77;font-size:11px}.hi-index button.active,.hi-index button:hover{background:#d9eef1;color:#075f71;font-weight:700}.hi-pages{display:grid;gap:12px;min-width:0}.hi-step{scroll-margin-top:18px;padding:10px;border:1px solid var(--surface-border);border-radius:8px}.hi-step summary{cursor:pointer;font-size:13px}.hi-step summary small{display:block;margin-top:6px;color:#638098;font-size:11px}.hi-step td{min-width:70px;white-space:normal}.hi-step td:nth-child(2){min-width:150px}.hi-step td:last-child{min-width:135px;color:#5a7185}.hi-output h4{margin:14px 0}@media(max-width:900px){.hi-layout{grid-template-columns:1fr}.hi-notebook{grid-template-columns:1fr}.hi-index{position:static;max-height:none;grid-template-columns:repeat(2,minmax(0,1fr))}.hi-index strong{grid-column:1/-1}}
</style>