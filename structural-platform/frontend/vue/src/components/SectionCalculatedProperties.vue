<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  result: { type: Object, default: null },
  calculatedAt: { type: String, default: '' },
  locale: { type: String, default: 'en' },
  displayUnit: { type: String, default: undefined },
})
const emit = defineEmits(['update:displayUnit'])

const labels = {
  en: {
    title: 'Section Properties', calculatedAt: 'Calculated', geometric: 'Geometric', elastic: 'Elastic',
    plastic: 'Plastic', principal: 'Principal axes', advanced: 'Advanced', area: 'A · Area', perimeter: 'P · Perimeter',
    xbar: 'x̄ · Centroid x', ybar: 'ȳ · Centroid y', ix: 'Ix', iy: 'Iy', ixy: 'Ixy', sxPositive: 'Sx+', sxNegative: 'Sx−',
    syPositive: 'Sy+', syNegative: 'Sy−', rx: 'rx', ry: 'ry', pnaX: 'PNAx', pnaY: 'PNAy', zx: 'Zx', zy: 'Zy',
    imax: 'Imax', imin: 'Imin', angle: 'Major-axis angle', orientation: 'Orientation', determinate: 'Determinate',
    indeterminate: 'Indeterminate', j: 'J · Torsion constant', cw: 'Cw · Warping constant', shearCenter: 'Shear center',
    shearCenterX: 'SCx', shearCenterY: 'SCy', shearOffsetX: 'SCx offset', shearOffsetY: 'SCy offset', shearAreas: 'Effective shear areas',
    ax: 'Ax · Effective shear area x', ay: 'Ay · Effective shear area y', thinWall: 'Thin-wall approximation', notComputed: 'Not computed', computedValueOmitted: 'Computed; value omitted',
    noSnapshot: 'No calculated section properties are saved for this record.',
    displayUnit: 'Display unit', formulaReport: 'Formula report', canonicalInput: 'Canonical input (mm)',
    components: 'Components', assumptions: 'Assumptions', references: 'References', expression: 'Expression',
    substitution: 'Substitution', method: 'Method', status: 'Status', value: 'Value', model: 'Profile', coordinateSystem: 'Coordinate system',
    referenceIds: 'Reference IDs', computed: 'Computed', omitted: 'Not computed',
    properties: 'Properties',
    downloadReport: 'Download formula report JSON', substitutionDetails: 'Substitution details', reportInputs: 'Shared calculation inputs',
  },
  vi: {
    title: 'Section Properties', calculatedAt: 'Thời điểm tính', geometric: 'Hình học', elastic: 'Đàn hồi',
    plastic: 'Dẻo', principal: 'Trục chính', advanced: 'Nâng cao', area: 'A · Diện tích', perimeter: 'P · Chu vi',
    xbar: 'x̄ · Tọa độ trọng tâm x', ybar: 'ȳ · Tọa độ trọng tâm y', ix: 'Ix', iy: 'Iy', ixy: 'Ixy',
    sxPositive: 'Sx+', sxNegative: 'Sx−', syPositive: 'Sy+', syNegative: 'Sy−', rx: 'rx', ry: 'ry',
    pnaX: 'PNAx', pnaY: 'PNAy', zx: 'Zx', zy: 'Zy', imax: 'Imax', imin: 'Imin', angle: 'Góc trục chính',
    orientation: 'Trạng thái phương', determinate: 'Xác định', indeterminate: 'Không xác định',
    j: 'J · Hằng số xoắn', cw: 'Cw · Hằng số vênh', shearCenter: 'Tâm cắt', shearCenterX: 'SCx', shearCenterY: 'SCy',
    shearOffsetX: 'Độ lệch SCx', shearOffsetY: 'Độ lệch SCy', shearAreas: 'Diện tích cắt hữu hiệu',
    ax: 'Ax · Diện tích cắt hữu hiệu x', ay: 'Ay · Diện tích cắt hữu hiệu y', thinWall: 'Xấp xỉ thành mỏng', computedValueOmitted: 'Đã tính; không có giá trị',
    notComputed: 'Chưa tính', noSnapshot: 'Bản ghi này chưa có Section Properties đã lưu.',
    displayUnit: 'Đơn vị hiển thị', formulaReport: 'Báo cáo công thức', canonicalInput: 'Đầu vào chuẩn (mm)',
    components: 'Các phần hình học', assumptions: 'Giả thiết', references: 'Tài liệu tham khảo', expression: 'Biểu thức',
    substitution: 'Thay số', method: 'Phương pháp', status: 'Trạng thái', value: 'Giá trị', model: 'Dạng tiết diện', coordinateSystem: 'Hệ tọa độ',
    referenceIds: 'Mã tài liệu', computed: 'Đã tính', omitted: 'Chưa tính',
    properties: 'Đặc trưng',
    downloadReport: 'Tải JSON báo cáo công thức', substitutionDetails: 'Chi tiết thay số', reportInputs: 'Đầu vào tính toán dùng chung',
  },
}
const t = (key) => labels[props.locale]?.[key] ?? labels.en[key] ?? key
const localDisplayUnit = ref(props.displayUnit ?? 'mm')
const selectedDisplayUnit = computed(() => props.displayUnit ?? localDisplayUnit.value)
watch(() => props.displayUnit, (value) => { if (value) localDisplayUnit.value = value })
function setDisplayUnit(value) {
  if (!['mm', 'cm', 'm'].includes(value)) return
  localDisplayUnit.value = value
  emit('update:displayUnit', value)
}

const groups = computed(() => {
  const properties = props.result?.properties ?? {}
  const geometric = properties.geometric ?? {}
  const elastic = properties.elastic ?? {}
  const plastic = properties.plastic
  const principal = properties.principal ?? {}
  const advanced = props.result?.advanced ?? {}
  return [
    { key: 'geometric', title: t('geometric'), rows: [
      ['area', 'area', 'mm²'], ['perimeter', 'perimeter', 'mm'], ['xbar', 'centroid_x', 'mm'], ['ybar', 'centroid_y', 'mm'],
    ].map(([label, key, unit]) => row(t(label), geometric[key], unit)) },
    { key: 'elastic', title: t('elastic'), rows: [
      ['ix', 'ix', 'mm⁴'], ['iy', 'iy', 'mm⁴'], ['ixy', 'ixy', 'mm⁴'],
      ['sxPositive', 'sx_positive', 'mm³'], ['sxNegative', 'sx_negative', 'mm³'],
      ['syPositive', 'sy_positive', 'mm³'], ['syNegative', 'sy_negative', 'mm³'], ['rx', 'rx', 'mm'], ['ry', 'ry', 'mm'],
    ].map(([label, key, unit]) => row(t(label), elastic[key], unit)) },
    { key: 'plastic', title: t('plastic'), rows: plastic ? [
      ['pnaX', 'pna_x', 'mm'], ['pnaY', 'pna_y', 'mm'], ['zx', 'zx', 'mm³'], ['zy', 'zy', 'mm³'],
    ].map(([label, key, unit]) => row(t(label), plastic[key], unit)) : [], emptyReason: props.result?.diagnostics?.plastic?.reason ?? 'not_requested' },
    { key: 'principal', title: t('principal'), rows: [
      row(t('imax'), principal.i_major, 'mm⁴'), row(t('imin'), principal.i_minor, 'mm⁴'),
      row(t('angle'), principal.major_axis_angle_degrees, '°'),
      row(t('orientation'), t(principal.orientation_status ?? ''), ''),
    ] },
    { key: 'advanced', title: t('advanced'), rows: advancedRows(advanced) },
  ].filter((group) => group.rows.length || group.key === 'plastic')
})

function row(label, value, unit) { return { label, value, unit, method: '', reason: '' } }
function advancedRows(advanced) {
  const rows = []
  const methodText = (method) => {
    if (!method) return ''
    if (String(method).toLowerCase().includes('thin_wall') || String(method).toLowerCase().includes('thin-wall')) return t('thinWall')
    return String(method).replaceAll('_', ' ')
  }
  const add = (key, label, unit) => {
    const property = advanced[key]
    if (!property) return
    const common = { method: methodText(property.method), reason: property.reason ?? '' }
    if (property.status !== 'computed') {
      rows.push({ label, value: null, unit, kind: 'unavailable', ...common })
      return
    }
    if (property.value === null || property.value === undefined) {
      rows.push({ label, value: null, unit, kind: 'computed-without-value', ...common })
      return
    }
    if (key === 'shear_center' && property.value && typeof property.value === 'object') {
      rows.push({ label: t('shearCenter'), value: null, unit: '', kind: 'vector-heading', ...common })
      rows.push({ ...row(t('shearCenterX'), property.value.x, 'mm'), method: common.method })
      rows.push({ ...row(t('shearCenterY'), property.value.y, 'mm'), method: common.method })
      rows.push({ ...row(t('shearOffsetX'), property.value.offset_x, 'mm'), method: common.method })
      rows.push({ ...row(t('shearOffsetY'), property.value.offset_y, 'mm'), method: common.method })
      return
    }
    if (key === 'effective_shear_area' && property.value && typeof property.value === 'object') {
      rows.push({ label: t('shearAreas'), value: null, unit: '', kind: 'vector-heading', ...common })
      rows.push({ ...row(t('ax'), property.value.x, 'mm²'), method: common.method })
      rows.push({ ...row(t('ay'), property.value.y, 'mm²'), method: common.method })
      return
    }
    rows.push({ label, value: property.value, unit, ...common })
  }
  add('torsion_constant_j', t('j'), 'mm⁴')
  add('warping_constant_cw', t('cw'), 'mm⁶')
  add('shear_center', t('shearCenter'), 'mm')
  add('effective_shear_area', t('shearAreas'), 'mm²')
  return rows
}
function unitPower(unit) {
  const normalized = String(unit ?? '').replaceAll('²', '2').replaceAll('³', '3').replaceAll('⁴', '4').replaceAll('⁶', '6')
  if (!/^mm(?:\^?\d+)?$/.test(normalized)) return null
  const power = Number(normalized.match(/\d+$/)?.[0] ?? 1)
  return [1, 2, 3, 4, 6].includes(power) ? power : null
}
function displayUnitLabel(unit) {
  const power = unitPower(unit)
  if (power === null) return unit
  const superscript = { 1: '', 2: '²', 3: '³', 4: '⁴', 6: '⁶' }[power]
  return `${selectedDisplayUnit.value}${superscript}`
}
function format(value, unit = '') {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    const power = unitPower(unit)
    const scale = { mm: 1, cm: 0.1, m: 0.001 }[selectedDisplayUnit.value] ?? 1
    const converted = power === null ? value : value * scale ** power
    const formatted = new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 8 }).format(converted)
    const label = displayUnitLabel(unit)
    return label ? `${formatted} ${label}` : formatted
  }
  return String(value)
}
function formulaUnit(unit) { return String(unit ?? '').replaceAll('mm2', 'mm²').replaceAll('mm3', 'mm³').replaceAll('mm4', 'mm⁴').replaceAll('mm6', 'mm⁶') }
function pretty(value) {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
function formulaProperties() { return props.result?.formula_report?.properties ?? [] }
function formulaComponents() { return props.result?.formula_report?.components ?? [] }
function substitutionSummary(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return pretty(value)
  return [value.expression, value.result].filter(Boolean).join(' · ') || pretty(value)
}
function substitutionDetails(value) {
  if (!value || typeof value !== 'object') return value
  return { context_ref: value.context_ref, expression: value.expression, result: value.result }
}
function downloadFormulaReport() {
  if (!props.result?.formula_report) return
  const blob = new Blob([JSON.stringify(props.result.formula_report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `section-formula-report-${props.result.formula_report.profile_id ?? 'section'}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function formulaReferences() {
  const report = props.result?.formula_report
  const refs = report?.references ?? []
  const byId = new Map(refs.map((item) => [item.id, item]))
  return (report?.reference_ids ?? []).map((id) => byId.get(id) ?? { id, title: id })
}
function reason(value) {
  if (!value) return t('notComputed')
  const display = {
    not_requested: props.locale === 'vi' ? 'chưa yêu cầu' : 'not requested',
    solver_not_implemented: props.locale === 'vi' ? 'chưa triển khai' : 'not implemented',
    convergence_not_achieved: props.locale === 'vi' ? 'chưa đạt hội tụ' : 'convergence not achieved',
    numerical_precision_limit: props.locale === 'vi' ? 'giới hạn độ chính xác số' : 'numerical precision limit',
  }
  return display[value] ?? value.replaceAll('_', ' ')
}
function formatDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
</script>

<template>
  <section class="section-calculated-properties" :aria-label="t('title')">
    <header>
      <strong>{{ t('title') }}</strong>
      <div class="section-calculated-view-options">
        <label><span>{{ t('displayUnit') }}</span><select :value="selectedDisplayUnit" :aria-label="t('displayUnit')" @change="setDisplayUnit($event.currentTarget.value)"><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></select></label>
        <small v-if="calculatedAt">{{ t('calculatedAt') }}: {{ formatDate(calculatedAt) }}</small>
      </div>
    </header>
    <p v-if="!result" class="section-calculated-empty">{{ t('noSnapshot') }}</p>
    <div v-else class="section-calculated-grid">
      <article v-for="group in groups" :key="group.key" class="section-calculated-group">
        <h5>{{ group.title }}</h5>
        <dl>
          <div v-for="item in group.rows" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd v-if="item.kind === 'vector-heading'" class="section-calculated-vector-heading"><small v-if="item.method">{{ item.method }}</small></dd>
            <dd v-else-if="item.kind === 'computed-without-value'" class="section-calculated-computed-without-value">
              {{ t('computedValueOmitted') }}<small v-if="item.method">{{ item.method }}</small>
            </dd>
            <dd v-else-if="item.reason || item.kind === 'unavailable' || (group.key === 'advanced' && item.value === null)" class="section-calculated-unavailable">
              {{ reason(item.reason) }}<small v-if="item.method">{{ item.method }}</small>
            </dd>
            <dd v-else>{{ format(item.value, item.unit) }}<small v-if="item.method">{{ item.method }}</small></dd>
          </div>
          <li v-if="group.key === 'plastic' && !group.rows.length" class="section-calculated-empty-row">{{ reason(group.emptyReason) }}</li>
        </dl>
      </article>
    </div>
    <details v-if="result?.solver" class="section-calculated-provenance">
      <summary>{{ result.solver.method }} · {{ result.solver.version }} · {{ result.geometry_hash }}</summary>
      <ul><li v-for="assumption in result.diagnostics?.assumptions ?? []" :key="assumption">{{ assumption.replaceAll('_', ' ') }}</li></ul>
    </details>
    <details v-if="result?.formula_report" class="section-calculated-formula-report">
      <summary>{{ t('formulaReport') }} · {{ result.formula_report.library_version }} · {{ result.formula_report.manifest_hash }}</summary>
      <button type="button" class="section-calculated-report-download" @click="downloadFormulaReport">{{ t('downloadReport') }}</button>
      <dl class="section-calculated-report-meta">
        <div><dt>{{ t('model') }}</dt><dd>{{ result.formula_report.profile_id }}</dd></div>
        <div><dt>{{ t('coordinateSystem') }}</dt><dd>{{ result.formula_report.coordinate_system?.origin?.replaceAll('_', ' ') }} · +X {{ result.formula_report.coordinate_system?.x }} · +Y {{ result.formula_report.coordinate_system?.y }}</dd></div>
      </dl>
      <details v-if="result.formula_report.inputs" class="section-calculated-report-inputs">
        <summary>{{ t('reportInputs') }}</summary><pre>{{ JSON.stringify(result.formula_report.inputs, null, 2) }}</pre>
      </details>
      <section v-if="result.formula_report.dimensions?.length">
        <h6>{{ t('canonicalInput') }}</h6>
        <dl><div v-for="dimension in result.formula_report.dimensions" :key="dimension.key"><dt>{{ dimension.symbol }} · {{ dimension.key }}</dt><dd>{{ pretty(dimension.value) }} {{ dimension.unit }}</dd></div></dl>
      </section>
      <section v-if="formulaComponents().length">
        <h6>{{ t('components') }}</h6>
        <article v-for="(component, index) in formulaComponents()" :key="index" class="section-calculated-report-component">
          <strong>{{ component.name ?? `${t('components')} ${index + 1}` }}</strong>
          <dl><div v-for="[key, value] in Object.entries(component).filter(([key]) => key !== 'name')" :key="key"><dt>{{ key.replaceAll('_', ' ') }}</dt><dd>{{ pretty(value) }}</dd></div></dl>
        </article>
      </section>
      <section v-if="formulaProperties().length">
        <h6>{{ t('properties') }}</h6>
        <article v-for="property in formulaProperties()" :key="property.key" class="section-calculated-report-property">
          <header><strong>{{ property.symbol }} · {{ property.key }}</strong><span>{{ property.status === 'computed' ? t('computed') : t('omitted') }} · {{ pretty(property.value) }} {{ formulaUnit(property.unit) }}</span></header>
          <p v-if="property.expression"><b>{{ t('expression') }}:</b> {{ property.expression }}</p>
          <p v-if="property.substitution"><b>{{ t('substitution') }}:</b> {{ substitutionSummary(property.substitution) }}</p>
          <details v-if="property.substitution && typeof property.substitution === 'object'" class="section-calculated-substitution-details">
            <summary>{{ t('substitutionDetails') }}</summary><pre>{{ JSON.stringify(substitutionDetails(property.substitution), null, 2) }}</pre>
          </details>
          <p v-if="property.method"><b>{{ t('method') }}:</b> {{ property.method }}</p>
          <p v-if="property.assumptions?.length"><b>{{ t('assumptions') }}:</b> {{ property.assumptions.join('; ') }}</p>
          <p v-if="property.reference_ids?.length"><b>{{ t('referenceIds') }}:</b> {{ property.reference_ids.join(', ') }}</p>
        </article>
      </section>
      <section v-if="result.formula_report.assumptions?.length">
        <h6>{{ t('assumptions') }}</h6><ul><li v-for="item in result.formula_report.assumptions" :key="item">{{ item }}</li></ul>
      </section>
      <section v-if="formulaReferences().length">
        <h6>{{ t('references') }}</h6><ul><li v-for="item in formulaReferences()" :key="item.id"><strong>{{ item.id }}</strong> · {{ item.title }}</li></ul>
      </section>
    </details>
  </section>
</template>

<style scoped>
.section-calculated-properties { margin-top: 11px; padding: 10px; border: 1px solid #e3ebf1; border-radius: 7px; background: var(--surface-bg); }
.section-calculated-properties > header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; color: #456681; font-size: 14px; }
.section-calculated-properties > header small { color: var(--muted-ink); font-size: 12px; font-weight: 500; }
.section-calculated-view-options { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.section-calculated-view-options label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted-ink); font-size: 12px; }
.section-calculated-view-options select { min-height: 28px; padding: 3px 6px; border: 1px solid #dce5ec; border-radius: 5px; background: var(--surface-bg); color: #344f69; font: inherit; }
.section-calculated-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.section-calculated-group { min-width: 0; padding: 8px; border: 1px solid #e9eef2; border-radius: 6px; }
.section-calculated-group h5 { margin: 0 0 5px; color: #52738f; font-size: 13px; font-weight: 750; letter-spacing: .035em; text-transform: uppercase; }
.section-calculated-group dl { display: grid; gap: 0; margin: 0; }
.section-calculated-group dl > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px solid #eef2f5; }
.section-calculated-group dl > div:last-child { border-bottom: 0; }
.section-calculated-group dt { color: var(--muted-ink); font-size: 13px; line-height: 1.4; }
.section-calculated-group dd { margin: 0; color: #344f69; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
.section-calculated-group dd small { display: block; color: var(--muted-ink); font-size: 12px; font-weight: 500; }
.section-calculated-group dd.section-calculated-vector-heading { color: #52738f; }
.section-calculated-group .section-calculated-unavailable, .section-calculated-empty-row, .section-calculated-empty { color: var(--muted-ink); font-size: 12px; font-weight: 500; }
.section-calculated-empty-row { margin: 3px 0; list-style: none; text-align: right; }
.section-calculated-provenance { margin-top: 8px; color: var(--muted-ink); font-size: 12px; overflow-wrap: anywhere; }
.section-calculated-provenance summary { cursor: pointer; }
.section-calculated-provenance ul { display: flex; flex-wrap: wrap; gap: 4px 14px; padding-left: 16px; }
.section-calculated-formula-report { min-width: 0; max-width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #e9eef2; border-radius: 6px; color: #456681; font-size: 12px; overflow-wrap: anywhere; }
.section-calculated-formula-report > summary { max-width: 100%; cursor: pointer; font-weight: 700; overflow-wrap: anywhere; }
.section-calculated-report-download { margin-top: 7px; padding: 5px 8px; border: 1px solid #dce5ec; border-radius: 5px; background: var(--surface-bg); color: #456681; font: inherit; font-size: 13px; cursor: pointer; }
.section-calculated-substitution-details { margin-top: 4px; color: var(--muted-ink); }
.section-calculated-substitution-details summary { cursor: pointer; }
.section-calculated-substitution-details pre { max-height: 260px; overflow: auto; padding: 7px; border-radius: 5px; background: var(--soft-bg); color: #49637c; font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.section-calculated-report-inputs { margin-top: 7px; color: var(--muted-ink); }
.section-calculated-report-inputs summary { cursor: pointer; }
.section-calculated-report-inputs pre { max-height: 260px; overflow: auto; padding: 8px; border-radius: 5px; background: var(--soft-bg); color: #49637c; font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.section-calculated-formula-report section { margin-top: 9px; }
.section-calculated-formula-report h6 { margin: 0 0 4px; color: #52738f; font-size: 12px; text-transform: uppercase; }
.section-calculated-formula-report dl { display: grid; gap: 3px; margin: 0; }
.section-calculated-formula-report dl > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 8px; border-bottom: 1px solid #eef2f5; padding: 3px 0; }
.section-calculated-formula-report dt { color: var(--muted-ink); }
.section-calculated-formula-report dd { min-width: 0; margin: 0; text-align: right; overflow-wrap: anywhere; }
.section-calculated-report-component, .section-calculated-report-property { margin-top: 6px; padding: 7px; border: 1px solid #edf1f4; border-radius: 5px; }
.section-calculated-report-component > strong { display: block; margin-bottom: 4px; }
.section-calculated-report-property > header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; }
.section-calculated-report-property > p { margin: 4px 0 0; overflow-wrap: anywhere; }
.section-calculated-formula-report ul { margin: 3px 0 0; padding-left: 18px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .section-calculated-grid { grid-template-columns: 1fr; } }
</style>
