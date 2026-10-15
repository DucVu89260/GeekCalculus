<script setup>
import { computed, ref } from 'vue'
import { SECTION_PROFILES, buildSectionCalculationRequest } from '../sectional-properties/catalog.js'
import { calculateSectionProperties } from '../sectional-properties/demo-calculator.ts'

const props = defineProps({ locale: { type: String, required: true } })
const profile = SECTION_PROFILES.find(p => p.id === 'asymmetric_i')
const dimensions = ref({ ...profile.default_dimensions })
const action = ref({ fy: 345, e: 200000, span_m: 9, wheel_kn: 150, impact_percent: 25, bearing_mm: 100, mx_knm: 200, my_knm: 15, vy_kn: 95, vx_kn: 20, dy_mm: 8, dx_mm: 5, vertical_limit: 600, lateral_limit: 400 })
const actionLabels = {
  fy: 'Fy (MPa)', e: 'E (MPa)', span_m: 'Span (m)', wheel_kn: 'Wheel load (kN)',
  impact_percent: 'Impact (%)', bearing_mm: 'Bearing length lb (mm)', mx_knm: 'Mx (kN·m)',
  my_knm: 'My (kN·m)', vy_kn: 'Vy (kN)', vx_kn: 'Vx (kN)',
  dy_mm: 'Vertical displacement (mm)', dx_mm: 'Lateral displacement (mm)',
  vertical_limit: 'Vertical allowable L /', lateral_limit: 'Lateral allowable L /',
}
const loading = ref(false)
const error = ref('')
const result = ref(null)
const preliminary = computed(() => {
  if (!result.value) return null
  const a = action.value
  const d = result.value.normalized_input.geometry.dimensions
  const clearWeb = d.depth - d.top_flange_thickness - d.bottom_flange_thickness
  if (clearWeb <= 0 || Object.values(a).some(x => !Number.isFinite(Number(x)) || Number(x) < 0)
    || a.fy <= 0 || a.e <= 0 || a.span_m <= 0 || a.vertical_limit <= 0 || a.lateral_limit <= 0
    || a.bearing_mm <= 0 || a.wheel_kn <= 0) return null
  const flangeTop = d.top_flange_width / (2 * d.top_flange_thickness)
  const flangeBottom = d.bottom_flange_width / (2 * d.bottom_flange_thickness)
  const webRatio = clearWeb / d.web_thickness
  const lpFlange = .38 * Math.sqrt(a.e / a.fy), lrFlange = Math.sqrt(a.e / a.fy)
  const lpWeb = 3.76 * Math.sqrt(a.e / a.fy), lrWeb = 5.7 * Math.sqrt(a.e / a.fy)
  const wheelDesign = a.wheel_kn * (1 + a.impact_percent / 100)
  const wheelWebAllowable = a.fy * d.web_thickness * (5 * d.top_flange_thickness + a.bearing_mm) / 1500
  const verticalAllowed = a.span_m * 1000 / a.vertical_limit
  const lateralAllowed = a.span_m * 1000 / a.lateral_limit
  const classification = (lambda, lp, lr) => lambda <= lp ? 'Compact' : lambda <= lr ? 'Noncompact' : 'Slender'
  return {
    flangeTop, flangeBottom, webRatio, lpFlange, lrFlange, lpWeb, lrWeb,
    classTop: classification(flangeTop, lpFlange, lrFlange),
    classBottom: classification(flangeBottom, lpFlange, lrFlange),
    classWeb: classification(webRatio, lpWeb, lrWeb),
    wheelDesign, wheelWebAllowable,
    wheelRatio: wheelDesign / wheelWebAllowable,
    verticalAllowed, lateralAllowed,
    verticalRatio: Math.abs(a.dy_mm) / verticalAllowed,
    lateralRatio: Math.abs(a.dx_mm) / lateralAllowed,
  }
})
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
    const g = computed.normalized_input.geometry.dimensions
    if (g.depth <= g.top_flange_thickness + g.bottom_flange_thickness || g.web_thickness > Math.min(g.top_flange_width, g.bottom_flange_width)) throw new Error('Invalid physical I/H dimensions')
    result.value = computed
  } catch (err) { error.value = err.message || String(err) }
  finally { loading.value = false }
}
</script>

<template>
  <section class="crane-beam">
    <header><div><small>Steel Design / Component / Crane Beam</small><h3>Crane Beam · AISC 360-10 ASD</h3>
      <p>{{ locale === 'vi' ? 'Tiết diện I/H bất đối xứng · Dùng chung Section Properties' : 'Asymmetric I/H · Shared Section Properties engine' }}</p></div></header>
    <div class="crane-panel"><h4>Engineering diagrams · Excel calculation references</h4>
      <div class="crane-drawings">
        <figure><svg viewBox="0 0 360 260" role="img" aria-label="Asymmetric I/H section with dimension annotations">
          <defs><marker id="cb-arrow" markerWidth="7" markerHeight="7" refX="4" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#4e708a"/></marker></defs>
          <path d="M86 35 H260 V57 H187 V210 H286 V235 H65 V210 H165 V57 H86 Z" fill="#d1e4ed" stroke="#244f72" stroke-width="2"/>
          <g stroke="#4e708a" stroke-width="1.3" fill="none" marker-start="url(#cb-arrow)" marker-end="url(#cb-arrow)">
            <path d="M86 20H260"/><path d="M65 249H286"/><path d="M315 35V235"/>
          </g><g font-size="13" fill="#294a65" text-anchor="middle">
            <text x="173" y="14">b<tspan baseline-shift="sub" font-size="9">t</tspan></text><text x="173" y="244">b<tspan baseline-shift="sub" font-size="9">b</tspan></text>
            <text x="330" y="135">H</text><text x="221" y="105">t<tspan baseline-shift="sub" font-size="9">w</tspan></text>
            <text x="278" y="50">t<tspan baseline-shift="sub" font-size="9">t</tspan></text>
            <text x="297" y="223">t<tspan baseline-shift="sub" font-size="9">b</tspan></text>
          </g><path d="M187 109H214M260 47H275M286 222H296" stroke="#4e708a" stroke-width="1"/>
        </svg><figcaption>01 · Asymmetric I/H cross-section · Section Properties input</figcaption></figure>
        <figure><svg viewBox="0 0 360 260" role="img" aria-label="Simply supported crane beam with vertical wheel loads and span">
          <defs><marker id="cb-load" markerWidth="8" markerHeight="8" refX="5" refY="6" orient="auto"><path d="M1 1L5 6L9 1" fill="none" stroke="#b56438" stroke-width="1.5"/></marker></defs>
          <rect x="34" y="135" width="292" height="12" fill="#bed9e8" stroke="#285474"/>
          <path d="M55 147l-17 22h34zM305 147l-17 22h34z" fill="#dae4eb" stroke="#285474"/>
          <g stroke="#b56438" stroke-width="2.5" marker-end="url(#cb-load)"><path d="M116 38V124"/><path d="M240 38V124"/></g>
          <g fill="#a75b2c" text-anchor="middle" font-size="13"><text x="116" y="29">P<tspan baseline-shift="sub" font-size="10">wheel,1</tspan></text><text x="240" y="29">P<tspan baseline-shift="sub" font-size="10">wheel,2</tspan></text></g>
          <g fill="#2d5874" font-size="13"><text x="160" y="116">Rail / runway</text><text x="175" y="215" text-anchor="middle">L · span</text></g>
          <path d="M55 184V206M305 184V206M55 196H305" stroke="#56758a" stroke-width="1.3"/><path d="M55 196l7-4v8zM305 196l-7-4v8z" fill="#56758a"/>
        </svg><figcaption>02 · Wheel loads and crane runway beam (schematic)</figcaption></figure>
        <figure><svg viewBox="0 0 360 260" role="img" aria-label="Wheel concentrated load and web yielding detail">
          <rect x="62" y="99" width="236" height="18" fill="#c7e0ed" stroke="#285474" stroke-width="2"/>
          <rect x="172" y="117" width="15" height="118" fill="#c7e0ed" stroke="#285474" stroke-width="2"/>
          <path d="M133 84h95v15h-95z" fill="#c1bfc1" stroke="#586979"/>
          <path d="M181 20V77" stroke="#ad653b" stroke-width="3"/><path d="M174 69l7 11 7-11" fill="none" stroke="#ad653b" stroke-width="2"/>
          <path d="M139 70H223" stroke="#597c92"/><path d="M139 66v8M223 66v8" stroke="#597c92"/>
          <g fill="#345670" text-anchor="middle" font-size="13"><text x="181" y="12">P<tspan baseline-shift="sub" font-size="9">wheel</tspan></text><text x="181" y="61">l<tspan baseline-shift="sub" font-size="9">b</tspan></text><text x="265" y="133">t<tspan baseline-shift="sub" font-size="9">f</tspan></text><text x="206" y="192">t<tspan baseline-shift="sub" font-size="9">w</tspan></text><text x="165" y="252">Web local yielding · J10</text></g>
        </svg><figcaption>03 · Wheel bearing and web local yielding (schematic)</figcaption></figure>
      </div><p class="drawing-note">Schematic illustrations adapted from the calculation workflow; not to scale. Verify rail bearing, k-distance, wheel spacing, supports and load distribution from the original Excel/project drawings.</p>
    </div>
    <div class="crane-panel"><h4>01 · Input Data — Asymmetric I/H</h4>
      <form @submit.prevent="calculate"><div class="dimensions">
        <label v-for="key in profile.dimensions" :key="key"><span>{{ key.replaceAll('_',' ') }} (mm)</span>
          <input v-model.number="dimensions[key]" type="number" step="any" min="0.001" required /></label>
      </div><h4>Crane loading, analysis actions & serviceability</h4><div class="dimensions"><label v-for="(label,key) in actionLabels" :key="key"><span>{{ label }}</span><input v-model.number="action[key]" type="number" step="any" min="0" required /></label></div><button type="submit" :disabled="loading">{{ loading ? 'Calculating…' : 'Calculate section properties' }}</button></form>
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
    <div class="crane-panel"><h4>03 · Excel ASD Calculation Nodes (preliminary)</h4>
      <p>The following checks are ported as live preliminary calculation nodes from the ASD sheet. Classification is indicative; the wheel calculation assumes interior loading and k = top flange thickness, subject to detailing verification.</p>
      <table v-if="preliminary"><tbody>
        <tr><th>B4.1b flange top / bottom</th><td>{{ preliminary.flangeTop.toFixed(3) }} / {{ preliminary.flangeBottom.toFixed(3) }} — {{ preliminary.classTop }} / {{ preliminary.classBottom }}</td></tr>
        <tr><th>B4.1b web slenderness</th><td>{{ preliminary.webRatio.toFixed(3) }} — {{ preliminary.classWeb }}</td></tr>
        <tr><th>Wheel load with impact (kN)</th><td>{{ preliminary.wheelDesign.toFixed(3) }}</td></tr>
        <tr><th>J10-2 interior web yielding allowable (kN)</th><td>{{ preliminary.wheelWebAllowable.toFixed(3) }}</td></tr>
        <tr><th>J10-2 preliminary demand / allowable</th><td>{{ preliminary.wheelRatio.toFixed(3) }} — REVIEW REQUIRED</td></tr>
        <tr><th>Vertical deflection (mm)</th><td>{{ action.dy_mm }} / {{ preliminary.verticalAllowed.toFixed(3) }} — D/C {{ preliminary.verticalRatio.toFixed(3) }}</td></tr>
        <tr><th>Lateral deflection (mm)</th><td>{{ action.dx_mm }} / {{ preliminary.lateralAllowed.toFixed(3) }} — D/C {{ preliminary.lateralRatio.toFixed(3) }}</td></tr>
      </tbody></table>
      <p v-else>Calculate with valid geometry and actions to display Excel-based preliminary checks.</p>
    </div>
    <div class="crane-panel"><h4>04 · Remaining Design Checks — NOT VERIFIED</h4>
      <p>Excel ASD_Q345_CR1_5T_L27_B10.xlsm — pending formula migration and benchmark verification. No design PASS is inferred from geometry results.</p>
      <table><tbody><tr v-for="item in items" :key="item[0]"><th>{{ item[0] }} · {{ item[1] }}</th><td>NOT VERIFIED</td></tr></tbody></table>
    </div>
    <div class="crane-panel"><h4>05 · Calculation Details & Excel Traceability</h4>
      <template v-if="preliminary"><p><strong>Wheel:</strong> P × (1 + impact / 100) = {{ preliminary.wheelDesign.toFixed(3) }} kN. ASD sheet J10 wheel check (interior).</p>
      <p><strong>Web local yielding (preliminary):</strong> Fy × tw × (5 × tf,top + lb) / (1000 × 1.5) = {{ preliminary.wheelWebAllowable.toFixed(3) }} kN. Source worksheet J10; k≈tf,top requires review.</p>
      <p><strong>Flange compactness:</strong> λp=0.38√(E/Fy)={{ preliminary.lpFlange.toFixed(3) }}; λr=√(E/Fy)={{ preliminary.lrFlange.toFixed(3) }}.</p>
      <p><strong>Web compactness:</strong> λp=3.76√(E/Fy)={{ preliminary.lpWeb.toFixed(3) }}; λr=5.7√(E/Fy)={{ preliminary.lrWeb.toFixed(3) }}. Confirm h/hc applicability.</p>
      <p><strong>Deflection:</strong> span × 1000 / limit, with displacements entered from structural analysis.</p></template>
      <p v-if="result">Section Properties formula manifest: {{ result.formula_report.manifest_hash }} · {{ result.formula_report.properties.length }} property records</p>
      <p v-else>Section Properties calculations will be available after running geometry.</p>
    </div>
  </section>
</template>
<style scoped>
.crane-beam{margin-top:18px;color:#243d55}.crane-beam>header{padding:18px 20px;background:#edf3f7;border-radius:12px}.crane-beam h3{margin:7px 0;font-size:23px}.crane-beam p{line-height:1.5}.crane-panel{padding:18px 20px;background:var(--workspace-bg);border:1px solid var(--surface-border);border-radius:12px;margin-top:14px}.crane-panel h4{margin:0 0 14px;font-size:18px}.dimensions{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.dimensions label{display:grid;gap:6px;text-transform:capitalize}.dimensions input{padding:9px;border:1px solid #aebdcc;border-radius:6px;width:100%;box-sizing:border-box}.crane-panel button{margin-top:16px;padding:11px 18px;border:0;border-radius:6px;background:#294c70;color:white;cursor:pointer}.crane-panel button:disabled{opacity:.6}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;text-align:left;border-bottom:1px solid #d8e1e8}th{font-weight:600}.error{color:#a21e1e;overflow-wrap:anywhere}
.crane-drawings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.crane-drawings figure{margin:0;padding:12px;background:#fcfbf7;border:1px solid #d8e2e9;border-radius:10px}.crane-drawings svg{display:block;width:100%;height:220px}.crane-drawings figcaption{font-size:13px;line-height:1.5;color:#46637a}.drawing-note{font-size:12px;color:#796b54}@media(max-width:850px){.crane-drawings{grid-template-columns:1fr}}
</style>