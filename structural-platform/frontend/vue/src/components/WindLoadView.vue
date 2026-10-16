<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ locale: { type: String, default: 'vi' } })
const standard = ref('asce7-10')
const family = computed(() => standard.value.startsWith('asce') ? 'asce' : 'eurocode')
const roof = ref('gable')
const enclosure = ref('enclosed')
const windSpeed = ref(40)
const kh = ref(0.85)
const kzt = ref(1)
const kd = ref(0.85)
const pressure = computed(() => {
  const values = [windSpeed.value, kh.value, kzt.value, kd.value].map(Number)
  if (values.some(v => !Number.isFinite(v) || v <= 0)) return null
  return 0.000613 * values[0] ** 2 * values[1] * values[2] * values[3]
})
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
          <label><span>K<sub>h</sub> / K<sub>z</sub></span><input v-model.number="kh" type="number" min="0.01" step="0.01" /></label>
          <label><span>K<sub>zt</sub></span><input v-model.number="kzt" type="number" min="0.01" step="0.01" /></label>
          <label><span>K<sub>d</sub></span><input v-model.number="kd" type="number" min="0.01" step="0.01" /></label>
        </div>
        <p class="wind-helper">{{ msg('Các hệ số Kh/Kz, Kzt, Kd đang do người dùng nhập; chưa có bộ tra bảng tự động. Các giá trị có sẵn chỉ minh họa, không phải số liệu dự án.', 'Kh/Kz, Kzt and Kd are manual inputs; automatic code lookups are not available. Initial values are illustrative, not project-specific.') }}</p>
      </section>
      <section class="wind-panel">
        <h3>02. {{ msg('Kết quả sơ bộ', 'Preliminary results') }}</h3>
        <div class="wind-stat"><span>{{ msg('Áp lực vận tốc gió', 'Velocity pressure') }} q</span><strong>{{ pressure === null ? '—' : fmt(pressure) }} <small>kN/m²</small></strong></div>
        <p class="wind-equation">q = 0.000613 × K × Kzt × Kd × V²</p>
        <div class="wind-stat"><span>GC<sub>pi</sub></span><strong>±{{ gcpi.toFixed(2) }}</strong></div>
        <p class="wind-helper">{{ msg('GCpi được chọn theo phân loại độ kín; phải xác minh openings trước khi sử dụng. Vận tốc và các hệ số phải đáp ứng phạm vi áp dụng của phương pháp.', 'GCpi follows the enclosure selection; verify opening classification and code method eligibility before use.') }}</p>
        <p class="wind-warning" role="status">{{ msg('Chưa tính áp lực thiết kế mái/tường MWFRS hoặc C&C. Cần tra đúng hệ số ngoài, vùng tải và các trường hợp gió đồng thời theo ASCE 7-10 trước khi xuất tải SAP2000.', 'MWFRS and C&C roof/wall design pressures are not calculated yet. External coefficients, zones and simultaneous load cases must be verified before SAP2000 export.') }}</p>
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
