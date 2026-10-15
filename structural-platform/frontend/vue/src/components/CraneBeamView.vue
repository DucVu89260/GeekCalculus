<script setup>
import { ref } from 'vue'
import { SECTION_PROFILES, buildSectionCalculationRequest } from '../sectional-properties/catalog.js'
import { calculateSectionProperties } from '../sectional-properties/demo-calculator.ts'

const props = defineProps({ locale: { type: String, required: true } })
const profile = SECTION_PROFILES.find(p => p.id === 'asymmetric_i')
const dimensions = ref({ ...profile.default_dimensions })
const loading = ref(false)
const error = ref('')
const result = ref(null)
const items = [
  ['AISC 360-10 B4.1b', 'Element classification'],
  ['AISC 360-10 E7', 'Axial compression'],
  ['AISC 360-10 F4', 'Major-axis bending / LTB'],
  ['AISC 360-10 F6', 'Minor-axis bending'],
  ['AISC 360-10 G2 / G7', 'Shear'],
  ['AISC 360-10 H1', 'Interaction'],
  ['AISC 360-10 J10', 'Wheel load / web checks'],
  ['Excel', 'Fatigue / stiffeners / deflections'],
]
async function calculate() {
  error.value = ''
  result.value = null
  const request = buildSectionCalculationRequest(profile, dimensions.value)
  if (!request) { error.value = 'Invalid Asymmetric I/H dimensions.'; return }
  loading.value = true
  try {
    const computed = await calculateSectionProperties(request)
    if (computed.geometry_type !== 'i_section') throw new Error('Unexpected geometry type')
    result.value = computed
  } catch (err) { error.value = err.message || String(err) }
  finally { loading.value = false }
}
</script>

<template>
  <section class="crane-beam">
    <header><div><small>Steel Design / Component / Crane Beam</small><h3>Crane Beam · AISC 360-10 ASD</h3>
      <p>{{ locale === 'vi' ? 'Tiết diện I/H bất đối xứng · Dùng chung Section Properties' : 'Asymmetric I/H · Shared Section Properties engine' }}</p></div></header>
    <div class="crane-panel"><h4>01 · Input Data — Asymmetric I/H</h4>
      <form @submit.prevent="calculate"><div class="dimensions">
        <label v-for="key in profile.dimensions" :key="key"><span>{{ key.replaceAll('_',' ') }} (mm)</span>
          <input v-model.number="dimensions[key]" type="number" step="any" min="0.001" required /></label>
      </div><button type="submit" :disabled="loading">{{ loading ? 'Calculating…' : 'Calculate section properties' }}</button></form>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
    </div>
    <div class="crane-panel"><h4>02 · Calculation Results</h4>
      <p v-if="!result">Enter dimensions and calculate to view results.</p>
      <template v-else><p>Source: Section Properties shared numerical core · Geometry hash: {{ result.geometry_hash }}</p>
        <table><tbody>
          <tr><th>Area A (mm²)</th><td>{{ result.properties.geometric.area.toFixed(3) }}</td></tr>
          <tr><th>Ix (mm⁴)</th><td>{{ result.properties.elastic.ix.toFixed(3) }}</td></tr>
          <tr><th>Iy (mm⁴)</th><td>{{ result.properties.elastic.iy.toFixed(3) }}</td></tr>
          <tr><th>Sx+ (mm³)</th><td>{{ result.properties.elastic.sx_positive.toFixed(3) }}</td></tr>
          <tr><th>Sx− (mm³)</th><td>{{ result.properties.elastic.sx_negative.toFixed(3) }}</td></tr>
          <tr><th>rx (mm)</th><td>{{ result.properties.elastic.rx.toFixed(3) }}</td></tr>
          <tr><th>ry (mm)</th><td>{{ result.properties.elastic.ry.toFixed(3) }}</td></tr>
        </tbody></table>
      </template>
    </div>
    <div class="crane-panel"><h4>03 · Crane Beam Design Checks</h4>
      <p>Excel ASD_Q345_CR1_5T_L27_B10.xlsm — pending formula migration and benchmark verification. No design PASS is inferred from geometry results.</p>
      <table><tbody><tr v-for="item in items" :key="item[0]"><th>{{ item[0] }} · {{ item[1] }}</th><td>NOT VERIFIED</td></tr></tbody></table>
    </div>
    <div class="crane-panel"><h4>04 · Calculation Details</h4>
      <p v-if="result">Section Properties formula manifest: {{ result.formula_report.manifest_hash }} · {{ result.formula_report.properties.length }} property records</p>
      <p v-else>Section Properties calculations will be available after running geometry.</p>
    </div>
  </section>
</template>
<style scoped>
.crane-beam{margin-top:18px;color:#243d55}.crane-beam>header{padding:18px 20px;background:#edf3f7;border-radius:12px}.crane-beam h3{margin:7px 0;font-size:23px}.crane-beam p{line-height:1.5}.crane-panel{padding:18px 20px;background:var(--workspace-bg);border:1px solid var(--surface-border);border-radius:12px;margin-top:14px}.crane-panel h4{margin:0 0 14px;font-size:18px}.dimensions{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.dimensions label{display:grid;gap:6px;text-transform:capitalize}.dimensions input{padding:9px;border:1px solid #aebdcc;border-radius:6px;width:100%;box-sizing:border-box}.crane-panel button{margin-top:16px;padding:11px 18px;border:0;border-radius:6px;background:#294c70;color:white;cursor:pointer}.crane-panel button:disabled{opacity:.6}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;text-align:left;border-bottom:1px solid #d8e1e8}th{font-weight:600}.error{color:#a21e1e;overflow-wrap:anywhere}
</style>