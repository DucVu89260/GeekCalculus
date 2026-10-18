<script setup>
import { computed, ref } from 'vue'
import { calculateWind710 } from '../../../../standards/asce7-10-wind.mjs'

const props = defineProps({ locale: { type: String, default: 'vi' } })
const standard = ref('asce7-10')
const family = computed(() => standard.value.startsWith('asce') ? 'asce' : 'eurocode')
const roof = ref('gable')
const enclosure = ref('enclosed')
const windSpeed = ref(40)
const exposure = ref('C')
const height = ref(10)
const evaluationHeight = ref(10)
const length = ref(20)
const width = ref(10)
const slope = ref(5)
const confirmed = ref(false)
const kzt = ref(1)
const calculation = computed(() => {
  try {
    return calculateWind710({ edition: 'ASCE7-10', rigid: confirmed.value,
      regular_shape: confirmed.value, chapter2_combinations: confirmed.value, wind_normal_to_ridge: true,
      positive_internal_basis: 'QH_CONSERVATIVE',
      building: { roof_type: roof.value.toUpperCase(), enclosure: enclosure.value === 'enclosed' ? 'ENCLOSED' : 'PARTIALLY_ENCLOSED',
        h_m: height.value, z_m: evaluationHeight.value, length_m: length.value, width_m: width.value, slope_deg: slope.value },
      wind: { v_mps: windSpeed.value, exposure: exposure.value, kzt: kzt.value } })
  } catch (error) { return { status: 'INPUT_REQUIRED', reason: error.message } }
})
const pressure = computed(() => calculation.value.trace?.qh_kpa ?? null)
const gcpi = computed(() => enclosure.value === 'enclosed' ? 0.18 : 0.55)
const fmt = (n) => Number.isFinite(n) ? n.toFixed(3) : '—'
const en = computed(() => props.locale === 'en')
const msg = (vi, english) => en.value ? english : vi
</script>

<template>
  <section class="wind-workspace" aria-label="Wind Load Generator">
    <header class="wind-toolbar">
      <div>
        <span class="wind-eyebrow">LOADING / WIND LOAD GENERATOR</span>
        <h2>{{ msg('Tải trọng gió', 'Wind Load Generator') }}</h2>
        <p>{{ msg('Chọn hệ tiêu chuẩn trước khi thiết lập mô hình tải trọng.', 'Choose a code family and edition before configuring wind loads.') }}</p>
      </div>
      <label class="standard-field"><span>Standard</span>
        <select v-model="standard" aria-label="Wind design standard">
          <optgroup label="ASCE 7">
            <option value="asce7-10">ASCE 7-10</option>
            <option value="asce7-16" disabled>ASCE 7-16 — Coming soon</option>
            <option value="asce7-22" disabled>ASCE 7-22 — Coming soon</option>
          </optgroup>
          <optgroup label="Eurocode">
            <option value="en1991" disabled>EN 1991-1-4 — Coming soon</option>
          </optgroup>
        </select>
      </label>
    </header>
    <nav class="wind-family" aria-label="Standard family">
      <button type="button" :class="{ active: family === 'asce' }" @click="standard = 'asce7-10'">ASCE 7</button>
      <button type="button" disabled title="Coming soon">Eurocode <small>{{ msg('Chờ phát triển', 'Coming soon') }}</small></button>
    </nav>
    <div class="wind-editions" aria-label="ASCE editions">
      <button type="button" class="selected">ASCE 7-10 <span class="active-tag">{{ msg('Đang phát triển', 'In development') }}</span></button>
      <button type="button" disabled>ASCE 7-16</button>
      <button type="button" disabled>ASCE 7-22</button>
    </div>
    <div class="wind-content">
      <section class="wind-panel">
        <h3>01. {{ msg('Cấu hình công trình', 'Building configuration') }}</h3>
        <div class="wind-fields">
          <label><span>{{ msg('Loại mái', 'Roof geometry') }}</span>
            <select v-model="roof"><option value="gable">Gable Roof</option><option value="monoslope">Monoslope Roof</option></select>
          </label>
          <label><span>{{ msg('Phân loại độ kín', 'Enclosure classification') }}</span>
            <select v-model="enclosure"><option value="enclosed">Enclosed Building</option><option value="partially-enclosed">Partially Enclosed Building</option></select>
          </label>
          <label><span>V (m/s)</span><input v-model.number="windSpeed" type="number" min="0.01" step="0.1" /></label>
          <label><span>Exposure</span><select v-model="exposure"><option>B</option><option>C</option><option>D</option></select></label>
          <label><span>h (m)</span><input v-model.number="height" type="number" min="0.01" step="0.1" /></label>
          <label><span>z (m)</span><input v-model.number="evaluationHeight" type="number" min="0" step="0.1" /></label>
          <label><span>L (m) · {{ msg('Song song gió', 'Along wind') }}</span><input v-model.number="length" type="number" min="0.01" /></label>
          <label><span>B (m) · {{ msg('Vuông góc gió', 'Across wind') }}</span><input v-model.number="width" type="number" min="0.01" /></label>
          <label><span>{{ msg('Độ dốc mái', 'Roof slope') }} (°)</span><input v-model.number="slope" type="number" min="0" max="90" step="0.1" /></label>
          <label><span>K<sub>zt</sub></span><input v-model.number="kzt" type="number" min="0.01" step="0.01" /></label>
        </div>
        <label class="wind-helper"><input v-model="confirmed" type="checkbox" style="width:auto" /> {{ msg('Tôi xác nhận nhà cứng, hình dạng thông thường, gió vuông góc đỉnh mái; V đúng cấp rủi ro ASCE 7-10, exposure/độ kín/Kzt đã kiểm tra và dùng tổ hợp Chương 2.', 'I confirm a rigid, regular building, wind normal to ridge, ASCE 7-10 risk-specific V, verified exposure/enclosure/Kzt and Chapter 2 combinations.') }}</label>
        <p class="wind-helper">{{ msg('Dữ liệu ban đầu chỉ minh họa. h là cao độ tham chiếu mái; với độ dốc ≤10° dùng cao độ diềm mái. Kz/Kh theo Bảng 27.3-1; Kd = G = 0.85. Kzt nhập theo §26.8, không giảm do che chắn.', 'Initial data are illustrative. h is the roof reference height; use eave height for slope ≤10°. Kz/Kh: Table 27.3-1; Kd = G = 0.85. Supply Kzt per §26.8; no shielding reduction.') }}</p>
      </section>
      <section class="wind-panel">
        <h3>02. {{ msg('Kết quả sơ bộ', 'Preliminary results') }}</h3>
        <div class="wind-stat"><span>{{ msg('Áp lực vận tốc gió', 'Velocity pressure') }} q</span><strong>{{ pressure === null ? '—' : fmt(pressure) }} <small>kN/m²</small></strong></div>
        <p class="wind-equation">q = 0.000613 × K × Kzt × Kd × V²</p>
        <div class="wind-stat"><span>GC<sub>pi</sub></span><strong>±{{ gcpi.toFixed(2) }}</strong></div>
        <p class="wind-helper">{{ msg('GCpi được chọn theo phân loại độ kín; phải xác minh openings trước khi sử dụng. Vận tốc và các hệ số phải đáp ứng phạm vi áp dụng của phương pháp.', 'GCpi follows the enclosure selection; verify opening classification and code method eligibility before use.') }}</p>
        <p v-if="calculation.reason" class="wind-warning" role="status">{{ calculation.reason }}</p>
        <template v-if="calculation.cases">
          <div v-for="loadCase in calculation.cases" :key="loadCase.id">
            <h4>GCpi = {{ loadCase.gcpi }} · §27.4-1</h4>
            <div v-for="(surface, name) in loadCase.walls" :key="name" class="wind-stat"><span>{{ name }}</span><strong>{{ fmt(surface.net_kpa) }} <small>kPa</small></strong></div>
            <details v-if="loadCase.roof"><summary>{{ msg('Áp lực mái theo vùng', 'Roof pressure zones') }}</summary>
              <p v-for="zone in loadCase.roof" :key="zone.from_m">x = {{ fmt(zone.from_m) }}–{{ fmt(zone.to_m) }} m: {{ zone.alternatives.map(p => fmt(p.net_kpa)).join(' / ') }} kPa</p>
            </details>
          </div>
          <p v-if="calculation.roof.status !== 'CALCULATED'" class="wind-warning">{{ calculation.roof.reason }}</p>
        </template>
        <p class="wind-warning" role="status">{{ msg('REVIEW_REQUIRED · Áp lực mặt theo Chương 27, chưa phải bộ tải hoàn chỉnh. Hai dấu GCpi áp dụng đồng thời trên mọi mặt; hai hệ số mái là các phương án riêng. Còn kiểm tra tải tối thiểu §27.4.7, gió hai phương, xoắn Fig.27.4-8, C&C, diềm/tường chắn mái và ví dụ độc lập trước khi xuất SAP2000.', 'REVIEW_REQUIRED · Chapter 27 surface pressures, not a complete load set. Each GCpi sign applies simultaneously to all faces; roof coefficients are separate alternatives. Minimum loads §27.4.7, orthogonal winds, torsion Fig.27.4-8, C&C, overhangs/parapets and independent benchmarks remain before SAP2000 export.') }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.wind-workspace{border:1px solid #ccd9e6;background:#f6f9fc;border-radius:12px;padding:22px;color:#253e58}
.wind-toolbar{display:flex;justify-content:space-between;align-items:center;gap:22px;flex-wrap:wrap}
.wind-eyebrow{font-size:11px;letter-spacing:.14em;font-weight:800;color:#687f95}
.wind-toolbar h2{font-size:24px;margin:8px 0}.wind-toolbar p{margin:0;color:#667c92}
.standard-field{display:flex;flex-direction:column;gap:7px;min-width:225px;font-weight:700}
.wind-workspace select,.wind-workspace input{border:1px solid #bdccdd;border-radius:7px;background:white;color:#24415d;padding:10px;font:inherit;width:100%}
.wind-family,.wind-editions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}
.wind-family button,.wind-editions button{border:1px solid #c3d2e0;border-radius:7px;padding:10px 17px;background:white;color:#42617e;font-weight:700;cursor:pointer}
.wind-family button.active,.wind-editions button.selected{background:#23395d;border-color:#23395d;color:white}
.wind-family button:disabled,.wind-editions button:disabled{cursor:not-allowed;opacity:.52}
.wind-family small,.active-tag{font-size:11px;margin-left:6px;font-weight:500}
.active-tag{color:#cfe9ff}
.wind-content{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin-top:18px}
.wind-panel{background:#fff;border:1px solid #d3deea;border-radius:9px;padding:20px}
.wind-panel h3{font-size:18px;margin:0 0 19px;color:#24466c}
.wind-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
.wind-fields label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:650;color:#526b84}
.wind-helper{font-size:12px;line-height:1.7;color:#627b90;margin:15px 0 0}
.wind-stat{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid #e5ebf2;padding:14px 0}
.wind-stat strong{font-size:23px;color:#213e60}.wind-stat small{font-size:13px}
.wind-equation{font-family:Cambria,serif;font-size:15px;color:#526b84}
.wind-warning{background:#fff8e9;border:1px solid #ebd8ae;padding:13px;border-radius:7px;color:#805c24;font-size:13px;line-height:1.65}
@media(max-width:820px){.wind-content{grid-template-columns:1fr}}@media(max-width:500px){.wind-workspace{padding:12px}.wind-fields{grid-template-columns:1fr}.standard-field{width:100%}}
</style>
