<script setup>
import { computed, ref } from 'vue'
import { calculateCraneStrength } from '../steel-design/crane-beam-strength.ts'
import { SECTION_PROFILES, buildSectionCalculationRequest } from '../sectional-properties/catalog.js'
import { calculateSectionProperties } from '../sectional-properties/demo-calculator.ts'

const props = defineProps({ locale: { type: String, required: true } })
const method = ref('ASD')
const design = ref(null)
const profile = SECTION_PROFILES.find(p => p.id === 'asymmetric_i')
const dimensions = ref({ ...profile.default_dimensions })
const action = ref({ fy: 345, e: 200000, n_kn: 0, klx_mm: 9000, kly_mm: 4500, mx_knm: 200, my_knm: 15, vy_kn: 95, vx_kn: 20, deflection_y_mm: 8, deflection_x_mm: 5, wlmax_kn: 150, bearing_mm: 100, k_mm: 16 })
const groups = [
 {name:'Material & axial',fields:[['fy','Fy (MPa)'],['e','E (MPa)'],['n_kn','N (kN; +tension / −compression)'],['klx_mm','KLx (mm)'],['kly_mm','KLy (mm)']]},
 {name:'Y · Vertical | Major-axis bending',fields:[['mx_knm','Mx · Major (kN·m)'],['vy_kn','Vy (kN)'],['deflection_y_mm','Deflection y (mm)']]},
 {name:'X · Horizontal | Minor-axis bending',fields:[['my_knm','My · Minor (kN·m)'],['vx_kn','Vx (kN)'],['deflection_x_mm','Deflection x (mm)']]},
 {name:'Wheel local bearing · Section J10',fields:[['wlmax_kn','WLmax · one side (kN)'],['bearing_mm','Bearing length N (mm)'],['k_mm','Distance k (mm)']]}
]
const loading = ref(false)
const error = ref('')
const result = ref(null)
const preliminary = computed(() => {
  if (!result.value) return null
  const a = action.value
  const d = result.value.normalized_input.geometry.dimensions
  const clearWeb = d.depth - d.top_flange_thickness - d.bottom_flange_thickness
  if (clearWeb <= 0 || Object.entries(a).some(([key,x]) => !Number.isFinite(Number(x)) || (key !== 'n_kn' && Number(x) < 0)) || a.fy <= 0 || a.e <= 0 || a.bearing_mm <= 0 || a.k_mm < d.top_flange_thickness || a.wlmax_kn <= 0) return null
  const flangeTop = d.top_flange_width / (2 * d.top_flange_thickness)
  const flangeBottom = d.bottom_flange_width / (2 * d.bottom_flange_thickness)
  const webRatio = clearWeb / d.web_thickness
  const lpFlange = .38 * Math.sqrt(a.e / a.fy), lrFlange = Math.sqrt(a.e / a.fy)
  const lpWeb = 3.76 * Math.sqrt(a.e / a.fy), lrWeb = 5.7 * Math.sqrt(a.e / a.fy)
  // AISC 360-10 J10.2 web local yielding: interior loading only.
  // Rn = Fy * tw * (5k + N); ASD omega = 1.50, k is user-supplied.
  const j10NominalKn = a.fy * d.web_thickness * (5 * a.k_mm + a.bearing_mm) / 1000
  const j10AllowableKn = j10NominalKn / 1.5
  const j10Ratio = a.wlmax_kn / j10AllowableKn
  const classification = (lambda, lp, lr) => lambda <= lp ? 'Compact' : lambda <= lr ? 'Noncompact' : 'Slender'
  return {
    flangeTop, flangeBottom, webRatio, lpFlange, lrFlange, lpWeb, lrWeb,
    classTop: classification(flangeTop, lpFlange, lrFlange),
    classBottom: classification(flangeBottom, lpFlange, lrFlange),
    classWeb: classification(webRatio, lpWeb, lrWeb),
    j10NominalKn, j10AllowableKn, j10Ratio,
  }
})
const items = [
  ['AISC 360-10 B4.1b', 'Element classification'],
  ['AISC 360-10 E7', 'Axial compression'],
  ['AISC 360-10 F4', 'Major-axis bending / LTB'],
  ['AISC 360-10 F6', 'Minor-axis bending'],
  ['AISC 360-10 G2 / G7', 'Shear'],
  ['AISC 360-10 H1', 'Interaction'],
  ['AISC 360-10 J10.3–J10.5', 'Web crippling, sidesway and compression (pending)'],
  ['Excel', 'Section fatigue and stiffeners (verification pending)'],
]
async function calculate() {
  error.value = ''
  result.value = null
  design.value = null
  const request = buildSectionCalculationRequest(profile, dimensions.value)
  if (!request) { error.value = 'Invalid Asymmetric I/H dimensions.'; return }
  loading.value = true
  try {
    const computed = await calculateSectionProperties(request)
    if (computed.geometry_type !== 'i_section') throw new Error('Unexpected geometry type')
    const g = computed.normalized_input.geometry.dimensions
    if (g.depth <= g.top_flange_thickness + g.bottom_flange_thickness || g.web_thickness > Math.min(g.top_flange_width, g.bottom_flange_width)) throw new Error('Invalid physical I/H dimensions')
    const sectionDesign = calculateCraneStrength(computed, computed.normalized_input.geometry.dimensions, action.value, method.value)
    design.value = sectionDesign
    result.value = computed
  } catch (err) { error.value = err.message || String(err) }
  finally { loading.value = false }
}
</script>

<template>
  <section class="crane-beam">
    <header><div><small>Steel Design / Component / Crane Beam</small><h3>Crane Beam · AISC 360-10 {{ method }}</h3>
      <p>{{ locale === 'vi' ? 'Tiết diện I/H bất đối xứng · Dùng chung Section Properties' : 'Asymmetric I/H · Shared Section Properties engine' }}</p></div></header>
    <div class="crane-panel"><h4>Asymmetric I/H · Section geometry</h4>
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
          </g><path d="M187 109H214M260 47H275M286 222H296" stroke="#4e708a" stroke-width="1"/><g stroke="#b36835" stroke-width="2.5" fill="none"><path d="M175 148V90"/><path d="M175 148H249"/><path d="M170 99L175 89L180 99"/><path d="M239 143L251 148L239 153"/></g><g fill="#b36835" font-size="18" font-weight="bold"><text x="160" y="89">Y</text><text x="254" y="154">X</text></g><circle cx="175" cy="148" r="3" fill="#b36835"/>
        </svg><figcaption>01 · Asymmetric I/H cross-section · Section Properties input</figcaption></figure>
      </div><p class="drawing-note">Coordinate convention: Y vertical (Vy, deflection y, Mx major); X horizontal (Vx, deflection x, My minor). Section schematic not to scale. Geometric properties are obtained from the shared Section Properties engine.</p>
    </div>
    <div class="crane-panel"><h4>02 · Wheel bearing · Web local yielding J10.2</h4>
      <figure class="bearing-figure"><svg viewBox="0 0 360 260" role="img" aria-label="Wheel bearing and web local yielding detail">
        <rect x="62" y="99" width="236" height="18" fill="#c7e0ed" stroke="#285474" stroke-width="2"/>
        <rect x="172" y="117" width="15" height="118" fill="#c7e0ed" stroke="#285474" stroke-width="2"/>
        <path d="M133 84h95v15h-95z" fill="#c1bfc1" stroke="#586979"/>
        <path d="M181 20V77" stroke="#ad653b" stroke-width="3"/><path d="M174 69l7 11 7-11" fill="none" stroke="#ad653b" stroke-width="2"/>
        <path d="M139 70H223" stroke="#597c92"/><path d="M139 66v8M223 66v8" stroke="#597c92"/>
        <g fill="#345670" text-anchor="middle" font-size="13"><text x="181" y="12">WLmax</text><text x="181" y="61">N</text><text x="265" y="133">t<tspan baseline-shift="sub" font-size="9">f</tspan></text><text x="206" y="192">t<tspan baseline-shift="sub" font-size="9">w</tspan></text><text x="165" y="252">Web local yielding · AISC J10.2</text></g>
      </svg><figcaption>Concentrated force acting through the rail/bearing onto the top flange. Only the local resistance is calculated here; WLmax must be supplied by the user or a future Crane Loading module.</figcaption></figure>
    </div>
    <div class="crane-panel"><h4>01 · Input Data — Asymmetric I/H</h4>
      <form @submit.prevent="calculate"><fieldset class="design-method"><legend>Design Method · AISC 360-10</legend><label><input v-model="method" type="radio" value="ASD"> ASD — Allowable Strength Design</label><label><input v-model="method" type="radio" value="LRFD"> LRFD — Load and Resistance Factor Design</label></fieldset><p class="drawing-note">Enter member actions corresponding to the selected ASD or LRFD load combinations. Selecting a method does not convert the applied forces.</p><div class="dimensions">
        <label v-for="key in profile.dimensions" :key="key"><span>{{ key.replaceAll('_',' ') }} (mm)</span>
          <input v-model.number="dimensions[key]" type="number" step="any" min="0.001" required /></label>
      </div><h4>Material properties & section design actions</h4><div class="action-groups"><section v-for="group in groups" :key="group.name" class="action-group"><h5>{{ group.name }}</h5><div class="dimensions"><label v-for="field in group.fields" :key="field[0]"><span>{{ field[1] }}</span><input v-model.number="action[field[0]]" type="number" step="any" :min="field[0]==='n_kn' ? undefined : 0" required /></label></div></section></div><button type="submit" :disabled="loading">{{ loading ? 'Calculating…' : 'Calculate section properties' }}</button></form>
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
      <p>Preliminary element classification and a scoped J10.2 web yielding check using user-provided WLmax. Influence-line analysis and wheel positioning remain a separate future module.</p>
      <table v-if="preliminary"><tbody>
        <tr><th>B4.1b flange top / bottom</th><td>{{ preliminary.flangeTop.toFixed(3) }} / {{ preliminary.flangeBottom.toFixed(3) }} — {{ preliminary.classTop }} / {{ preliminary.classBottom }}</td></tr>
        <tr><th>B4.1b web slenderness</th><td>{{ preliminary.webRatio.toFixed(3) }} — {{ preliminary.classWeb }}</td></tr>
        <tr><th>J10.2 nominal Rn (kN)</th><td>{{ preliminary.j10NominalKn.toFixed(3) }}</td></tr>
        <tr><th>J10.2 ASD Rn/Ω, Ω=1.50 (kN)</th><td>{{ preliminary.j10AllowableKn.toFixed(3) }}</td></tr>
        <tr><th>J10.2 WLmax / Ra</th><td>{{ preliminary.j10Ratio.toFixed(3) }} · PRELIMINARY — end-distance, k and load path require verification</td></tr>
      </tbody></table>
      <p v-else>Calculate with valid geometry and actions to display Excel-based preliminary checks.</p>
    </div>
    <div class="crane-panel"><h4>04 · AISC 360-10 Strength Checks — {{ method }}</h4>
      <p v-if="design">Resistance uses the published AISC 360-10 factor registry from main; status PRELIMINARY PASS / FAIL is limited to each scoped equation and is not an overall design certification.</p>
      <table v-if="design"><thead><tr><th>Clause / limit state</th><th>Demand</th><th>Nominal</th><th>Factor</th><th>Available</th><th>D/C</th><th>State</th></tr></thead><tbody>
        <tr v-for="check in design.checks" :key="check.id">
          <th>{{ check.clause }} · {{ check.label }}</th>
          <td>{{ check.demand == null ? '—' : check.demand.toFixed(3) }}</td>
          <td>{{ check.nominal == null ? '—' : check.nominal.toFixed(3) }}</td>
          <td>{{ check.factor ? check.factor.symbol + ' = ' + check.factor.value : '—' }}</td>
          <td>{{ check.capacity == null ? '—' : check.capacity.toFixed(3) }}</td>
          <td>{{ check.ratio == null ? '—' : check.ratio.toFixed(3) }}</td>
          <td>{{ check.status }}</td>
        </tr>
      </tbody></table>
      <details v-if="design"><summary>Formula, assumptions and limitations</summary><article v-for="check in design.checks" :key="check.id"><h5>{{ check.clause }} — {{ check.label }}</h5><p>{{ check.formula }}</p><p v-for="warning in check.warnings" :key="warning">{{ warning }}</p></article></details>
    </div>
    <div class="crane-panel"><h4>05 · Excel Migration Coverage</h4>
      <p>Excel ASD_Q345_CR1_5T_L27_B10.xlsm — pending formula migration and benchmark verification. No design PASS is inferred from geometry results.</p>
      <table><tbody><tr v-for="item in items" :key="item[0]"><th>{{ item[0] }} · {{ item[1] }}</th><td>NOT VERIFIED</td></tr></tbody></table>
    </div>
    <div class="crane-panel"><h4>06 · Calculation Details & Excel Traceability</h4>
      <template v-if="preliminary"><p><strong>J10.2 (interior concentrated force):</strong> Rn = Fy × tw × (5k + N), Ra = Rn / 1.50; WLmax/Ra = {{ preliminary.j10Ratio.toFixed(3) }}. This is not applicable within the end-region without using the correct J10.2 end equation. k must include root radius/weld detail, and other J10 checks remain NOT VERIFIED.</p><p><strong>Flange compactness:</strong> λp=0.38√(E/Fy)={{ preliminary.lpFlange.toFixed(3) }}; λr=√(E/Fy)={{ preliminary.lrFlange.toFixed(3) }}.</p>
      <p><strong>Web compactness:</strong> λp=3.76√(E/Fy)={{ preliminary.lpWeb.toFixed(3) }}; λr=5.7√(E/Fy)={{ preliminary.lrWeb.toFixed(3) }}. Confirm h/hc applicability.</p>
</template>
      <p v-if="result">Section Properties formula manifest: {{ result.formula_report.manifest_hash }} · {{ result.formula_report.properties.length }} property records</p>
      <p v-else>Section Properties calculations will be available after running geometry.</p>
    </div>
  </section>
</template>
<style scoped>
.crane-beam{margin-top:18px;color:#243d55}.crane-beam>header{padding:18px 20px;background:#edf3f7;border-radius:12px}.crane-beam h3{margin:7px 0;font-size:23px}.crane-beam p{line-height:1.5}.crane-panel{padding:18px 20px;background:var(--workspace-bg);border:1px solid var(--surface-border);border-radius:12px;margin-top:14px}.crane-panel h4{margin:0 0 14px;font-size:18px}.dimensions{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.dimensions label{display:grid;gap:6px;text-transform:capitalize}.dimensions input{padding:9px;border:1px solid #aebdcc;border-radius:6px;width:100%;box-sizing:border-box}.crane-panel button{margin-top:16px;padding:11px 18px;border:0;border-radius:6px;background:#294c70;color:white;cursor:pointer}.crane-panel button:disabled{opacity:.6}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;text-align:left;border-bottom:1px solid #d8e1e8}th{font-weight:600}.error{color:#a21e1e;overflow-wrap:anywhere}
.bearing-figure{margin:0;max-width:570px;background:#fcfbf7;border:1px solid #d8e2e9;border-radius:10px;padding:14px}.bearing-figure svg{display:block;width:100%;height:260px}.bearing-figure figcaption{font-size:13px;color:#46637a;line-height:1.5}.crane-drawings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.crane-drawings figure{margin:0;padding:12px;background:#fcfbf7;border:1px solid #d8e2e9;border-radius:10px}.crane-drawings svg{display:block;width:100%;height:220px}.crane-drawings figcaption{font-size:13px;line-height:1.5;color:#46637a}.drawing-note{font-size:12px;color:#796b54}@media(max-width:850px){.crane-drawings{grid-template-columns:1fr}}
.action-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:14px 0}.action-group{padding:14px;border:1px solid #d1dfe8;border-radius:9px;background:#f8fbfd}.action-group h5{font-size:16px;color:#2b4d6c;margin:0 0 12px}@media(max-width:850px){.action-groups{grid-template-columns:1fr}}.design-method{display:flex;flex-wrap:wrap;gap:15px;padding:12px;border:1px solid #cedce6;border-radius:8px;margin-bottom:10px}.design-method legend{font-weight:700}.design-method label{display:inline-flex;align-items:center;gap:6px}.design-method input{accent-color:#345f84}details{margin-top:15px}details article{padding:8px 0;border-bottom:1px solid #e2e6ea}
</style>