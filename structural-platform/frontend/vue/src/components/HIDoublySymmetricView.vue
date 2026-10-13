<script setup>
import { reactive, ref } from 'vue'
import { demoMode, request } from '../api'
defineProps({ locale: { type: String, required: true } })
const section = reactive({h_mm:940,bf_mm:250,tw_mm:6,tf_mm:12,fabrication:'BUILT_UP'})
const material = reactive({fy_mpa:345,e_mpa:200000})
const member = reactive({lb_mm:5500,lx_mm:12000})
const stiffeners = reactive({spacing_mm:2500,thickness_mm:6,width_mm:100,layout:'PAIRED'})
const forces = reactive({axial_kN:-138.439,moment_x_kNm:-806.3536,moment_y_kNm:0.0903,shear_x_kN:67.821,shear_y_kN:0.214,moment_25_kNm:-713.0995337748,moment_50_kNm:-619.8454675497,moment_75_kNm:-370.3123961538})
const panels = [
  {name:'Geometry (mm)', data:section, fields:[['h_mm','h'],['bf_mm','bf'],['tw_mm','tw'],['tf_mm','tf']]},
  {name:'Material (MPa)',data:material,fields:[['fy_mpa','Fy'],['e_mpa','E']]},
  {name:'Unbraced lengths (mm)',data:member,fields:[['lb_mm','Lb'],['lx_mm','Lx']]},
  {name:'Stiffeners (mm)',data:stiffeners,fields:[['spacing_mm','a'],['thickness_mm','tst'],['width_mm','bst']]},
  {name:'Internal forces (kN / kN·m)',data:forces,fields:[['axial_kN','N (+ tension)'],['moment_x_kNm','Mx (signed)'],['moment_y_kNm','My'],['shear_x_kN','Vx'],['shear_y_kN','Vy'],['moment_25_kNm','M¼'],['moment_50_kNm','M½'],['moment_75_kNm','M¾']]}
]
const result=ref(null), error=ref(''),busy=ref(false)
const fmt=(n)=>Number.isFinite(n)?Number(n).toLocaleString(undefined,{maximumFractionDigits:5}):'—'
async function calculate(){
  busy.value=true;error.value='';result.value=null
  try{
    result.value=await request('/api/v1/steel-design/components/hi-doubly-symmetric/legacy-parity',{
      method:'POST',body:JSON.stringify({section,material,member,stiffeners,forces})
    })
  }catch(e){error.value=e.message||'Calculation failed'}finally{busy.value=false}
}
</script>
<template>
  <section class="hi-workbench">
    <header><h3>H/I Doubly Symmetric</h3><span>Legacy Excel Parity · LRFD</span></header>
    <p class="hi-notice" role="note">Verification only — source XLSM is labelled AISC 360-05. Not a validated AISC 360-10 design calculation. Results must not be used for construction design.</p>
    <form @submit.prevent="calculate">
      <div class="hi-grid">
        <fieldset v-for="panel in panels" :key="panel.name">
          <legend>{{panel.name}}</legend>
          <label v-for="[key,label] in panel.fields" :key="key"><span>{{label}}</span><input v-model.number="panel.data[key]" type="number" step="any" required /></label>
          <label v-if="panel.data===section"><span>Fabrication</span><select v-model="section.fabrication"><option value="BUILT_UP">Built-up</option><option value="ROLLED">Rolled</option></select></label>
          <label v-if="panel.data===stiffeners"><span>Layout</span><select v-model="stiffeners.layout"><option value="PAIRED">Paired</option><option value="SINGLE_ANGLE">Single angle</option><option value="SINGLE_PLATE">Single plate</option></select></label>
        </fieldset>
      </div>
      <button type="submit" :disabled="busy || demoMode">{{busy?'Calculating…':'Calculate LRFD · Excel parity'}}</button>
      <small v-if="demoMode">Static demo: Laravel calculation API unavailable.</small>
    </form>
    <p v-if="error" role="alert" class="hi-error">{{error}}</p>
    <section v-if="result" class="hi-results">
      <header><h4>H1 interaction: {{fmt(result.interaction.lrfd_percent)}}%</h4><strong>{{result.overall_status}}</strong></header>
      <dl><div><dt>A</dt><dd>{{fmt(result.section_properties.area_mm2)}} mm²</dd></div>
      <div><dt>φMn,x</dt><dd>{{fmt(result.strengths.phi_mnx_kNm)}} kN·m</dd></div>
      <div><dt>φMn,y</dt><dd>{{fmt(result.strengths.phi_mny_kNm)}} kN·m</dd></div>
      <div><dt>φPn</dt><dd>{{fmt(result.strengths.phi_pn_compression_kN)}} kN</dd></div>
      <div><dt>Web shear D/C</dt><dd>{{fmt(result.shear.web_percent)}}%</dd></div>
      <div><dt>Flange shear D/C</dt><dd>{{fmt(result.shear.flange_percent)}}%</dd></div></dl>
      <p>Classification: {{result.classification.flange}} flange / {{result.classification.web}} web · {{result.classification.flexure_chapter}}</p>
      <table><thead><tr><th>Clause</th><th>Check</th><th>D/C</th><th>Status</th></tr></thead>
      <tbody><tr v-for="row in result.limit_states" :key="row.id"><td>{{row.clause}}</td><td>{{row.id}}</td><td>{{fmt(row.utilization*100)}}%</td><td>{{row.status}}</td></tr></tbody></table>
      <h4>Warnings</h4><ul><li v-for="w in result.warnings" :key="w.code"><strong>{{w.code}}</strong> — {{w.message}}</li></ul>
    </section>
  </section>
</template>
<style scoped>
.hi-workbench{display:grid;gap:15px;color:#233850}.hi-workbench header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}.hi-workbench h3{font-size:20px;margin:0}.hi-workbench header span{font-size:11px;color:#98691b;font-weight:700}.hi-notice{padding:12px;border:1px solid #cfaa72;border-radius:9px;background:#fff4da;font-size:12px;line-height:1.6;margin:0}.hi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hi-grid fieldset{min-width:0;border:1px solid var(--surface-border);border-radius:10px;padding:15px;display:grid;gap:9px}.hi-grid legend{font-size:13px;font-weight:700;padding:0 5px}.hi-grid label{display:grid;grid-template-columns:minmax(0,1fr) 1fr;align-items:center;gap:8px;color:var(--muted-ink);font-size:12px}.hi-grid input,.hi-grid select{width:100%;min-width:0;padding:8px;border:1px solid var(--surface-border);border-radius:7px;background:var(--field-bg);color:inherit}.hi-workbench button{margin-top:15px;padding:10px 15px;background:#23395d;color:white;border:0;border-radius:8px;font-weight:700}.hi-workbench small{display:block;color:var(--muted-ink);margin-top:7px}.hi-results{display:grid;gap:12px;border-top:1px solid var(--surface-border);padding-top:13px}.hi-results header h4{font-size:20px;margin:0}.hi-results header strong{font-size:11px;color:#976a22}.hi-results dl{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0}.hi-results dl>div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--surface-border);padding:8px 0;font-size:12px}.hi-results dt{color:var(--muted-ink)}.hi-results dd{margin:0;text-align:right}.hi-results table{border-collapse:collapse;width:100%;font-size:11px}.hi-results th,.hi-results td{border-bottom:1px solid var(--surface-border);padding:7px;text-align:left}.hi-results ul{font-size:12px;line-height:1.65;padding-left:18px}.hi-error{color:#a33}@media(max-width:720px){.hi-grid,.hi-results dl{grid-template-columns:1fr}}
</style>