<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { SECTION_PROFILES } from '../sectional-properties/catalog.js'
import { calculateCraneSections } from '../steel-design/crane-beam-section.ts'
import { calculateCraneDesign } from '../steel-design/crane-beam-strength.ts'
import { CRANE_INPUT_FIELDS, CRANE_STAGES, DEFAULT_CRANE_ACTIONS } from '../steel-design/crane-beam-inputs.ts'
import workbookCases from '../steel-design/crane-beam-workbook-cases.json'
import CraneBeamSectionDiagram from './CraneBeamSectionDiagram.vue'

const props = defineProps({ locale: { type: String, required: true } })
const words = {
  en: {
    breadcrumb: 'Steel Design / Component / Crane Beam', title: 'Crane Beam · AISC 360-10',
    method: 'Design method', asd: 'ASD — Allowable Strength Design', lrfd: 'LRFD — Load and Resistance Factor Design',
    loadMethodNote: 'Enter actions from the load combinations for the selected method. Changing ASD/LRFD never rescales actions.',
    loadExcelASD: 'Load Excel ASD case', loadExcelLRFD: 'Load Excel LRFD case',
    excelCaseNote: 'The source workbook ASD and LRFD cases have different saved input sets, not scaled versions of one another. Loading a case replaces the method, geometry, and actions. Review the unverified bracing, end-distance, and model defaults before use.',
    material: '1. Input Data · Material', section: 'Section', forces: 'SAP2000 / Internal Forces',
    dimensions: 'Asymmetric I/H section dimensions', fabrication: 'Fabrication and stiffeners',
    sectionProperties: '2. Section Properties', baseTitle: 'Whole I/H section', topTitle: 'Effective top T section', bottomTitle: 'Effective bottom T section',
    cg: 'Centroid y', pna: 'Plastic neutral axis y', hcTop: 'hc · top', hcBottom: 'hc · bottom', hpTop: 'hp · top', hpBottom: 'hp · bottom',
    ycOuter: 'yc · from physical outer face', ycGlobal: 'yc · global Y', pnaOuter: 'PNA · from physical outer face', pnaGlobal: 'PNA · global Y',
    bottomTransformNote: 'The bottom T is reflected from the engine’s flange-up geometry. Sx+ and Sx− are swapped for physical Y; PNA coordinates use the physical outer face and whole-section global Y.',
    displayUnit: 'Property display unit', unitMm: 'Millimetres (mm)', unitCm: 'Centimetres (cm)', unitM: 'Metres (m)',
    property: 'Property', value: 'Value', unit: 'Unit', methodCol: 'Method / status',
    calculate: 'Calculate', calculating: 'Calculating…', calculateHint: 'Calculate to generate the current geometry and strength worksheets.',
    stale: 'Inputs or design method changed. Calculate again to refresh the results.', invalidated: 'Results are cleared whenever an input or method changes.',
    designResults: 'Strength Checks', notVerified: 'NOT VERIFIED', summary: 'Summary status',
    check: 'Limit state / clause', demand: 'Demand', nominal: 'Nominal', availableASD: 'Available ASD', availableLRFD: 'Available LRFD',
    selectedAvailable: 'Selected available', ratio: 'D/C', factor: 'Factor', status: 'Status', coverage: 'Coverage',
    formula: 'Formula', substitution: 'Substitution', warnings: 'Warnings', references: 'Worksheet references', details: 'Calculation trace and limitations',
    noChecks: 'No checks were returned for this stage.', pending: 'NOT VERIFIED — no strength checks are available yet.',
    error: 'Calculation could not be completed.', download: 'Download calculation JSON', exportName: 'crane-beam-aisc360-10.json',
    geometryHash: 'Geometry hashes', inputMethod: 'Selected method', bearingNote: 'User-supplied local wheel load and bearing geometry; this illustration is not a wheel-travel analysis.',
    inputsRequired: 'Enter valid section dimensions and all required inputs before calculating.',
    sectionSource: 'All section values come from the shared Section Properties calculation.',
  },
  vi: {
    breadcrumb: 'Thiết kế thép / Cấu kiện / Dầm cầu trục', title: 'Dầm cầu trục · AISC 360-10',
    method: 'Phương pháp thiết kế', asd: 'ASD — Thiết kế ứng suất cho phép', lrfd: 'LRFD — Thiết kế hệ số sức kháng',
    loadMethodNote: 'Nhập nội lực từ tổ hợp tải tương ứng với phương pháp đã chọn. Đổi ASD/LRFD không tự thay đổi nội lực.',
    loadExcelASD: 'Nạp bộ dữ liệu Excel ASD', loadExcelLRFD: 'Nạp bộ dữ liệu Excel LRFD',
    excelCaseNote: 'Đây là hai bộ đầu vào ASD và LRFD riêng biệt được lưu từ Excel, không phải một bộ nội lực được tự quy đổi. Nạp bộ sẽ thay thế phương pháp, hình học và nội lực. Hãy kiểm tra các giả thiết chưa xác minh về giằng, khoảng cách đến đầu dầm và mô hình trước khi dùng.',
    material: '1. Dữ liệu đầu vào · Vật liệu', section: 'Tiết diện', forces: 'SAP2000 / Nội lực',
    dimensions: 'Kích thước tiết diện I/H bất đối xứng', fabrication: 'Chế tạo và sườn tăng cứng',
    sectionProperties: '2. Đặc trưng tiết diện', baseTitle: 'Tiết diện I/H hoàn chỉnh', topTitle: 'Tiết diện T hiệu dụng phía trên', bottomTitle: 'Tiết diện T hiệu dụng phía dưới',
    cg: 'Tọa độ trọng tâm y', pna: 'Tọa độ trục trung hòa dẻo y', hcTop: 'hc · phía trên', hcBottom: 'hc · phía dưới', hpTop: 'hp · phía trên', hpBottom: 'hp · phía dưới',
    ycOuter: 'yc · từ mặt ngoài thực tế', ycGlobal: 'yc · tọa độ Y toàn tiết diện', pnaOuter: 'PNA · từ mặt ngoài thực tế', pnaGlobal: 'PNA · tọa độ Y toàn tiết diện',
    bottomTransformNote: 'Tiết diện T dưới được phản chiếu từ hình học lõi có cánh hướng lên. Đổi chỗ Sx+ và Sx− theo trục Y vật lý; tọa độ PNA tính từ mặt ngoài thực tế và theo Y toàn tiết diện.',
    displayUnit: 'Đơn vị hiển thị đặc trưng', unitMm: 'Milimét (mm)', unitCm: 'Xentimét (cm)', unitM: 'Mét (m)',
    property: 'Đặc trưng', value: 'Giá trị', unit: 'Đơn vị', methodCol: 'Phương pháp / trạng thái',
    calculate: 'Tính toán', calculating: 'Đang tính…', calculateHint: 'Tính để tạo kết quả hình học và bảng tính sức kháng hiện tại.',
    stale: 'Đầu vào hoặc phương pháp thiết kế đã đổi. Hãy tính lại để cập nhật kết quả.', invalidated: 'Kết quả được xóa khi thay đổi đầu vào hoặc phương pháp.',
    designResults: 'Kiểm tra sức kháng', notVerified: 'CHƯA KIỂM CHỨNG', summary: 'Trạng thái tổng hợp',
    check: 'Trạng thái giới hạn / điều khoản', demand: 'Nội lực', nominal: 'Danh định', availableASD: 'Sức kháng ASD', availableLRFD: 'Sức kháng LRFD',
    selectedAvailable: 'Sức kháng đã chọn', ratio: 'Nội lực/sức kháng', factor: 'Hệ số', status: 'Trạng thái', coverage: 'Phạm vi',
    formula: 'Công thức', substitution: 'Thay số', warnings: 'Cảnh báo', references: 'Tham chiếu bảng tính', details: 'Dấu vết tính toán và giới hạn',
    noChecks: 'Giai đoạn này chưa có kiểm tra được trả về.', pending: 'CHƯA KIỂM CHỨNG — chưa có kiểm tra sức kháng.',
    error: 'Không thể hoàn tất phép tính.', download: 'Tải JSON phép tính', exportName: 'crane-beam-aisc360-10.json',
    geometryHash: 'Mã băm hình học', inputMethod: 'Phương pháp đã chọn', bearingNote: 'Tải bánh xe cục bộ và hình học gối do người dùng nhập; hình minh họa không phân tích vị trí bánh xe dọc dầm.',
    inputsRequired: 'Nhập kích thước tiết diện hợp lệ và đầy đủ dữ liệu bắt buộc trước khi tính.',
    sectionSource: 'Mọi đặc trưng tiết diện được tính từ Section Properties dùng chung.',
  },
}
const t = (key) => words[props.locale]?.[key] ?? words.en[key] ?? key

const profile = SECTION_PROFILES.find((item) => item.id === 'asymmetric_i')
if (!profile) throw new Error('The asymmetric I/H profile is missing from the shared section registry.')
const dimensionKeys = [...profile.dimensions]
const dimensions = reactive({ ...profile.default_dimensions })
const actions = reactive(structuredClone(DEFAULT_CRANE_ACTIONS))
const method = ref('ASD')
const displayUnit = ref('mm')
const loading = ref(false)
const error = ref('')
const result = ref(null)
const revision = ref(0)
const hasCalculatedInputs = ref(false)
let applyingWorkbookCase = false

const inputFields = computed(() => {
  if (Array.isArray(CRANE_INPUT_FIELDS)) return CRANE_INPUT_FIELDS
  return Object.entries(CRANE_INPUT_FIELDS ?? {}).flatMap(([group, fields]) =>
    Array.isArray(fields) ? fields.map((field) => ({ group, ...field })) : [],
  )
})
const materialFields = computed(() => inputFields.value.filter((field) => field.group === 'material'))
const fabricationFields = computed(() => inputFields.value.filter((field) => field.group === 'section'))
const stiffenerFields = computed(() => inputFields.value.filter((field) => field.group === 'stiffeners'))
const actionGroupOrder = ['actions_vertical', 'actions_horizontal', 'axial', 'bearing', 'stability', 'fatigue']
const actionGroups = computed(() => actionGroupOrder
  .map((id) => ({ id, fields: inputFields.value.filter((field) => field.group === id) }))
  .filter((group) => group.fields.length))
const groupTitles = computed(() => ({
  actions_vertical: props.locale === 'vi' ? 'Y · Phương đứng | Trục chính' : 'Y · Vertical | Major axis',
  actions_horizontal: props.locale === 'vi' ? 'X · Phương ngang | Trục phụ' : 'X · Horizontal | Minor axis',
  axial: props.locale === 'vi' ? 'Lực dọc và chiều dài tính toán' : 'Axial force and effective lengths',
  bearing: props.locale === 'vi' ? 'Tải bánh xe và ép cục bộ · J10' : 'Wheel load and local bearing · J10',
  stability: props.locale === 'vi' ? 'Ổn định' : 'Stability',
  fatigue: props.locale === 'vi' ? 'Mỏi' : 'Fatigue',
}))

const dimensionLabels = computed(() => ({
  depth: props.locale === 'vi' ? 'Chiều cao dầm H' : 'Beam depth H',
  top_flange_width: props.locale === 'vi' ? 'Bề rộng cánh trên bt' : 'Top flange width bt',
  bottom_flange_width: props.locale === 'vi' ? 'Bề rộng cánh dưới bb' : 'Bottom flange width bb',
  web_thickness: props.locale === 'vi' ? 'Bề dày bụng tw' : 'Web thickness tw',
  top_flange_thickness: props.locale === 'vi' ? 'Bề dày cánh trên tt' : 'Top flange thickness tt',
  bottom_flange_thickness: props.locale === 'vi' ? 'Bề dày cánh dưới tb' : 'Bottom flange thickness tb',
}))

watch([method, dimensions, actions], () => {
  if (applyingWorkbookCase) return
  const previousResultExists = result.value !== null || hasCalculatedInputs.value
  revision.value += 1
  result.value = null
  loading.value = false
  error.value = ''
  hasCalculatedInputs.value = previousResultExists
}, { deep: true, flush: 'sync' })

const stages = computed(() => [...(CRANE_STAGES ?? [])].sort((a, b) => a.number - b.number))
const stageChecks = (stage) => result.value?.design?.groups?.find((group) => group.id === stage.id)?.checks ?? []
const sectionTables = computed(() => {
  if (!result.value?.sections) return []
  const sections = result.value.sections
  const baseProps = sections.base?.properties ?? {}
  const base = [
    ['A · Area', baseProps.geometric?.area, 'mm²'],
    ['Ix', baseProps.elastic?.ix, 'mm⁴'], ['Iy', baseProps.elastic?.iy, 'mm⁴'], ['Ixy', baseProps.elastic?.ixy, 'mm⁴'],
    ['Sx+', baseProps.elastic?.sx_positive, 'mm³'], ['Sx−', baseProps.elastic?.sx_negative, 'mm³'],
    ['Sy · top flange', sections.sy_top_flange_mm3, 'mm³'], ['Sy · bottom flange', sections.sy_bottom_flange_mm3, 'mm³'],
    ['rx', baseProps.elastic?.rx, 'mm'], ['ry', baseProps.elastic?.ry, 'mm'],
    ['Zx', baseProps.plastic?.zx, 'mm³'], ['Zy', baseProps.plastic?.zy, 'mm³'],
    ['yCG', baseProps.geometric?.centroid_y, 'mm'], ['yPNA', baseProps.plastic?.pna_y, 'mm'],
    ['hc · top', sections.hc_top_mm, 'mm'], ['hc · bottom', sections.hc_bottom_mm, 'mm'],
    ['hp · top', sections.hp_top_mm, 'mm'], ['hp · bottom', sections.hp_bottom_mm, 'mm'],
    ['J · Torsion constant', advancedValue(sections.base, 'torsion_constant_j'), 'mm⁴'],
    ['Cw · Warping constant', advancedValue(sections.base, 'warping_constant_cw'), 'mm⁶'],
  ].map((row) => makePropertyRow(...row))
  const forT = (section, title, yc, globalY, pnaOuter, pnaGlobal, reflected = false) => {
    const properties = section?.properties ?? {}
    const sxPositive = reflected ? properties.elastic?.sx_negative : properties.elastic?.sx_positive
    const sxNegative = reflected ? properties.elastic?.sx_positive : properties.elastic?.sx_negative
    return {
      key: title,
      title: t(title),
      note: reflected ? t('bottomTransformNote') : '',
      rows: [
        ['A · Area', properties.geometric?.area, 'mm²'], [t('ycOuter'), yc, 'mm'], [t('ycGlobal'), globalY, 'mm'],
        ['Ix', properties.elastic?.ix, 'mm⁴'], ['Iy', properties.elastic?.iy, 'mm⁴'], ['Ixy', properties.elastic?.ixy, 'mm⁴'],
        ['Sx+', sxPositive, 'mm³'], ['Sx−', sxNegative, 'mm³'],
        ['Sy+', properties.elastic?.sy_positive, 'mm³'], ['Sy−', properties.elastic?.sy_negative, 'mm³'],
        ['rx', properties.elastic?.rx, 'mm'], ['ry', properties.elastic?.ry, 'mm'],
        ['Zx', properties.plastic?.zx, 'mm³'], ['Zy', properties.plastic?.zy, 'mm³'],
        [t('pnaOuter'), pnaOuter, 'mm'], [t('pnaGlobal'), pnaGlobal, 'mm'],
      ].map((row) => makePropertyRow(...row)),
    }
  }
  return [
    { key: 'base', title: t('baseTitle'), rows: base },
    forT(sections.top, 'topTitle', sections.top_yc_from_outer_face_mm, sections.top_centroid_global_y_mm, sections.top_pna_from_outer_face_mm, sections.top_pna_global_y_mm),
    forT(sections.bottom, 'bottomTitle', sections.bottom_yc_from_outer_face_mm, sections.bottom_centroid_global_y_mm, sections.bottom_pna_from_outer_face_mm, sections.bottom_pna_global_y_mm, true),
  ]
})

function advancedValue(section, name) {
  return section?.advanced?.[name] ?? section?.properties?.advanced?.[name] ?? null
}
function makePropertyRow(label, value, unit) {
  const advanced = value && typeof value === 'object' && 'status' in value
  return {
    label,
    value: advanced && 'value' in value ? value.value : value,
    unit,
    method: advanced ? value.method ?? value.status : '',
    status: advanced ? value.status : '',
  }
}

function setDimension(key, event) {
  const raw = event?.target?.value
  dimensions[key] = raw === '' ? null : Number(raw)
}
function setAction(field, event) {
  if (field.type === 'checkbox') {
    actions[field.id] = Boolean(event?.target?.checked)
    return
  }
  const raw = event?.target?.value
  if (field.type === 'number') actions[field.id] = raw === '' ? null : Number(raw)
  else actions[field.id] = raw
}
function actionValue(field) {
  return actions[field.id] ?? (actions[field.id] === false ? false : '')
}
function fieldLabel(field) {
  return props.locale === 'vi' ? field.label_vi || field.label_en || field.id : field.label_en || field.label_vi || field.id
}
function optionLabel(option) {
  return props.locale === 'vi' ? option.label_vi || option.label_en || option.value : option.label_en || option.label_vi || option.value
}
function localeNumber(value, maximumFractionDigits = 6) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits }).format(number)
}
function canonicalPower(unit) {
  if (!unit) return null
  const ascii = String(unit).replaceAll('⁰', '0').replaceAll('¹', '1').replaceAll('²', '2').replaceAll('³', '3').replaceAll('⁴', '4').replaceAll('⁵', '5').replaceAll('⁶', '6').replaceAll('⁻', '-')
  const match = /^mm(?:\^?(-?\d+))?$/.exec(ascii)
  return match ? Number(match[1] ?? 1) : null
}
function displayValue(value, unit) {
  if (value === null || value === undefined) return '—'
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  const power = canonicalPower(unit)
  if (power === null) return localeNumber(value)
  const mmPerUnit = { mm: 1, cm: 10, m: 1000 }[displayUnit.value]
  return localeNumber(value / (mmPerUnit ** power))
}
function displayUnitLabel(unit) {
  const power = canonicalPower(unit)
  if (power === null) return unit ?? ''
  return `${displayUnit.value}${power === 1 ? '' : `^${power}`}`
}
function stringifyTrace(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
function checkStatus(check) {
  const status = String(check.status ?? 'NOT VERIFIED')
  return /\bpass\b|not[_ -]?verified|pending/i.test(status) ? t('notVerified') : status
}
function checkName(check) {
  return props.locale === 'vi' ? check.label_vi || check.label_en || check.id : check.label_en || check.label_vi || check.id
}
function stageTitle(stage) {
  return props.locale === 'vi' ? stage.title_vi || stage.title_en : stage.title_en || stage.title_vi
}
function stageGroupTitle(stage) {
  const group = result.value?.design?.groups?.find((item) => item.id === stage.id)
  return props.locale === 'vi' ? group?.title_vi || stage.title_vi : group?.title_en || stage.title_en
}
function methodFactor(check) {
  const factor = check.factor
  if (factor && typeof factor === 'object') return `${factor.symbol ?? ''}${factor.symbol ? ' = ' : ''}${factor.value ?? ''}`
  return factor ?? '—'
}
function geometryHashes() {
  const sections = result.value?.sections
  return sections ? Object.fromEntries(['base', 'top', 'bottom'].map((name) => [name, sections[name]?.geometry_hash ?? null])) : {}
}
function loadWorkbookCase(requestedMethod) {
  const selectedCase = workbookCases.cases.find((item) => item.method === requestedMethod)
  if (!selectedCase) return

  revision.value += 1
  result.value = null
  loading.value = false
  error.value = ''
  hasCalculatedInputs.value = false
  applyingWorkbookCase = true
  try {
    method.value = selectedCase.method
    Object.assign(dimensions, structuredClone(selectedCase.dimensions))
    for (const key of Object.keys(actions)) {
      if (!(key in selectedCase.actions)) delete actions[key]
    }
    Object.assign(actions, structuredClone(selectedCase.actions))
  } finally {
    applyingWorkbookCase = false
  }
}
function sectionSnapshot(section) {
  if (!section) return null
  return {
    status: section.status,
    schema_version: section.schema_version,
    geometry_model_version: section.geometry_model_version,
    geometry_type: section.geometry_type,
    geometry_hash: section.geometry_hash,
    solver: section.solver,
    units: section.units,
    normalized_input: section.normalized_input,
    properties: section.properties,
    advanced: section.advanced,
    mechanics: section.mechanics,
    diagnostics: section.diagnostics,
    formula_report: section.formula_report,
  }
}
function exportPayload() {
  if (!result.value) return null
  const sections = result.value.sections
  return {
    schema: 'geekcalculus.crane-beam-calculation.v1',
    selected_method: result.value.input.method,
    submitted_input: { dimensions_mm: result.value.input.dimensions, actions: result.value.input.actions },
    input_fingerprint: result.value.input.fingerprint,
    geometry: {
      hashes: geometryHashes(),
      section_dimensions_mm: result.value.sections.base?.normalized_input?.geometry?.dimensions ?? result.value.input.dimensions,
      top_effective_web_depth_mm: result.value.sections.top_web_depth_mm,
      bottom_effective_web_depth_mm: result.value.sections.bottom_web_depth_mm,
      construction: {
        convention: sections.convention,
        top_yc_from_outer_face_mm: sections.top_yc_from_outer_face_mm,
        bottom_yc_from_outer_face_mm: sections.bottom_yc_from_outer_face_mm,
        top_centroid_global_y_mm: sections.top_centroid_global_y_mm,
        bottom_centroid_global_y_mm: sections.bottom_centroid_global_y_mm,
        top_pna_from_outer_face_mm: sections.top_pna_from_outer_face_mm,
        bottom_pna_from_outer_face_mm: sections.bottom_pna_from_outer_face_mm,
        top_pna_global_y_mm: sections.top_pna_global_y_mm,
        bottom_pna_global_y_mm: sections.bottom_pna_global_y_mm,
        bottom_core_transform: sections.bottom_core_transform,
        worksheet_references: sections.worksheet_references,
      },
    },
    solver_versions: Object.fromEntries(['base', 'top', 'bottom'].map((name) => [name, sections[name]?.solver?.version ?? null])),
    section_calculations: {
      base: sectionSnapshot(sections.base),
      top: sectionSnapshot(sections.top),
      bottom: sectionSnapshot(sections.bottom),
    },
    formula_reports: {
      base: sections.base?.formula_report ?? null,
      top: sections.top?.formula_report ?? null,
      bottom: sections.bottom?.formula_report ?? null,
    },
    strength: result.value.design,
    verification: {
      overall: result.value.design?.summary_status ?? 'NOT VERIFIED',
      checks: (result.value.design?.groups ?? []).flatMap((group) => group.checks ?? []).map((check) => ({
        id: check.id, status: check.status ?? 'NOT VERIFIED', coverage: check.coverage ?? 'PENDING',
        formula: check.formula ?? null, substitution: check.substitution ?? null, worksheet_refs: check.worksheet_refs ?? [],
      })),
    },
  }
}
function downloadJSON() {
  const payload = exportPayload()
  if (!payload) return
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = t('exportName')
  anchor.click()
  URL.revokeObjectURL(url)
}

async function calculate() {
  error.value = ''
  result.value = null
  hasCalculatedInputs.value = false
  const input = {
    method: method.value,
    dimensions: { ...dimensions },
    actions: { ...actions },
  }
  if (Object.values(input.dimensions).some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0)) {
    error.value = t('inputsRequired')
    return
  }
  const ticket = ++revision.value
  input.fingerprint = JSON.stringify(input)
  loading.value = true
  try {
    const sections = await calculateCraneSections(input.dimensions)
    if (ticket !== revision.value) return
    const design = await calculateCraneDesign(sections, input.actions, input.method)
    if (ticket !== revision.value) return
    result.value = { input, sections, design }
    hasCalculatedInputs.value = true
  } catch (cause) {
    if (ticket === revision.value) error.value = cause?.message || t('error')
  } finally {
    if (ticket === revision.value) loading.value = false
  }
}

</script>

<template>
  <section class="crane-beam">
    <header class="crane-header">
      <small>{{ t('breadcrumb') }}</small>
      <h3>{{ t('title') }}</h3>
      <fieldset class="design-method">
        <legend>{{ t('method') }}</legend>
        <label><input v-model="method" name="design-method" type="radio" value="ASD"> {{ t('asd') }}</label>
        <label><input v-model="method" name="design-method" type="radio" value="LRFD"> {{ t('lrfd') }}</label>
      </fieldset>
      <div class="excel-case-actions">
        <button type="button" :disabled="loading" @click="loadWorkbookCase('ASD')">{{ t('loadExcelASD') }}</button>
        <button type="button" :disabled="loading" @click="loadWorkbookCase('LRFD')">{{ t('loadExcelLRFD') }}</button>
      </div>
      <p class="note">{{ t('excelCaseNote') }}</p>
      <p class="note">{{ t('loadMethodNote') }}</p>
    </header>

    <section class="crane-panel" aria-labelledby="input-heading">
      <h4 id="input-heading">{{ t('material') }}</h4>
      <div class="input-subsection">
        <div class="field-grid">
          <label v-for="field in materialFields" :key="field.id" class="input-field">
            <span>{{ fieldLabel(field) }} <small v-if="field.unit">({{ field.unit }})</small></span>
            <input v-if="field.type === 'number'" :name="field.id" :value="actionValue(field)" type="number" step="any" :min="field.min" @input="setAction(field, $event)">
            <select v-else-if="field.type === 'select'" :name="field.id" :value="actionValue(field)" @change="setAction(field, $event)">
              <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ optionLabel(option) }}</option>
            </select>
            <input v-else-if="field.type === 'checkbox'" :name="field.id" type="checkbox" :checked="Boolean(actionValue(field))" @change="setAction(field, $event)">
          </label>
        </div>
      </div>

      <h4 class="section-input-heading">{{ t('section') }}</h4>
      <div class="input-subsection">
        <h5>{{ t('dimensions') }}</h5>
        <div class="field-grid">
          <label v-for="key in dimensionKeys" :key="key" class="input-field">
            <span>{{ dimensionLabels[key] || key }} <small>(mm)</small></span>
            <input :name="`dimension-${key}`" :value="dimensions[key]" type="number" min="0.001" step="any" required @input="setDimension(key, $event)">
          </label>
        </div>
      </div>
      <div v-if="fabricationFields.length || stiffenerFields.length" class="input-subsection nested-section">
        <h5>{{ t('fabrication') }}</h5>
        <div class="field-grid">
          <label v-for="field in [...fabricationFields, ...stiffenerFields]" :key="field.id" class="input-field">
            <span>{{ fieldLabel(field) }} <small v-if="field.unit">({{ field.unit }})</small></span>
            <input v-if="field.type === 'number'" :name="field.id" :value="actionValue(field)" type="number" step="any" :min="field.min" @input="setAction(field, $event)">
            <select v-else-if="field.type === 'select'" :name="field.id" :value="actionValue(field)" @change="setAction(field, $event)">
              <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ optionLabel(option) }}</option>
            </select>
            <input v-else-if="field.type === 'checkbox'" :name="field.id" type="checkbox" :checked="Boolean(actionValue(field))" @change="setAction(field, $event)">
          </label>
        </div>
      </div>

      <h4 class="section-input-heading">{{ t('forces') }}</h4>
      <div class="action-groups">
        <section v-for="group in actionGroups" :key="group.id" class="action-group">
          <h5>{{ groupTitles[group.id] || group.id }}</h5>
          <div class="field-grid">
            <label v-for="field in group.fields" :key="field.id" class="input-field">
              <span>{{ fieldLabel(field) }} <small v-if="field.unit">({{ field.unit }})</small></span>
              <input v-if="field.type === 'number'" :name="field.id" :value="actionValue(field)" type="number" step="any" :min="field.min" @input="setAction(field, $event)">
              <select v-else-if="field.type === 'select'" :name="field.id" :value="actionValue(field)" @change="setAction(field, $event)">
                <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ optionLabel(option) }}</option>
              </select>
              <input v-else-if="field.type === 'checkbox'" :name="field.id" type="checkbox" :checked="Boolean(actionValue(field))" @change="setAction(field, $event)">
            </label>
          </div>
        </section>
      </div>

      <div class="action-row">
        <button type="button" :disabled="loading" @click="calculate">{{ loading ? t('calculating') : t('calculate') }}</button>
        <p>{{ t('invalidated') }}</p>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
    </section>

    <section class="crane-panel" aria-labelledby="properties-heading">
      <div class="panel-heading-row">
        <h4 id="properties-heading">{{ t('sectionProperties') }}</h4>
        <label class="unit-select"><span>{{ t('displayUnit') }}</span>
          <select v-model="displayUnit">
            <option value="mm">{{ t('unitMm') }}</option><option value="cm">{{ t('unitCm') }}</option><option value="m">{{ t('unitM') }}</option>
          </select>
        </label>
      </div>
      <p class="note">{{ t('sectionSource') }}</p>
      <CraneBeamSectionDiagram v-if="result" :dimensions="result.input.dimensions" :sections="result.sections" :locale="locale" />
      <p v-else>{{ t('calculateHint') }}</p>
      <div v-if="sectionTables.length" class="property-tables">
        <section v-for="table in sectionTables" :key="table.key" class="property-table">
          <h5>{{ table.title }}</h5>
          <p v-if="table.note" class="note">{{ table.note }}</p>
          <div class="table-scroll"><table><thead><tr><th>{{ t('property') }}</th><th>{{ t('value') }}</th><th>{{ t('unit') }}</th><th>{{ t('methodCol') }}</th></tr></thead>
            <tbody><tr v-for="(row, index) in table.rows" :key="`${row.label}-${index}`">
              <th>{{ row.label }}</th><td>{{ displayValue(row.value, row.unit) }}</td><td>{{ displayUnitLabel(row.unit) }}</td><td>{{ row.method || row.status || '—' }}</td>
            </tr></tbody></table></div>
        </section>
      </div>
      <p v-if="result" class="hash-line">{{ t('geometryHash') }}: {{ JSON.stringify(geometryHashes()) }}</p>
    </section>

    <section v-if="stages.length" class="crane-panel" aria-labelledby="strength-heading">
      <div class="panel-heading-row">
        <h4 id="strength-heading">{{ t('designResults') }} · {{ result?.input.method || method }}</h4>
        <button v-if="result" type="button" class="secondary-button" @click="downloadJSON">{{ t('download') }}</button>
      </div>
      <p v-if="result" class="status-banner"><strong>{{ t('summary') }}:</strong> {{ checkStatus({ status: result.design.summary_status }) }}</p>
      <p v-else>{{ hasCalculatedInputs ? t('stale') : t('pending') }}</p>
      <section v-for="stage in stages" :key="stage.id" class="stage-card">
        <h5>{{ stage.number }}. {{ stageGroupTitle(stage) || stageTitle(stage) }}</h5>
        <template v-if="result">
          <div v-if="stage.number === 8" class="bearing-detail">
            <CraneBeamSectionDiagram variant="bearing" :dimensions="result.input.dimensions" :sections="result.sections" :locale="locale" />
            <p class="note">{{ t('bearingNote') }}</p>
          </div>
          <p v-if="!stageChecks(stage).length" class="pending-check">{{ t('noChecks') }} · {{ t('notVerified') }}</p>
          <div v-for="check in stageChecks(stage)" :key="check.id" class="check-card">
            <div class="check-title"><strong>{{ check.clause }} · {{ checkName(check) }}</strong><span class="status-chip">{{ checkStatus(check) }}</span></div>
            <div class="table-scroll"><table><thead><tr>
              <th>{{ t('demand') }}</th><th>{{ t('nominal') }}</th><th>{{ t('availableASD') }}</th><th>{{ t('availableLRFD') }}</th>
              <th>{{ t('selectedAvailable') }} · {{ result.input.method }}</th><th>{{ t('ratio') }}</th><th>{{ t('factor') }}</th><th>{{ t('coverage') }}</th>
            </tr></thead><tbody><tr>
              <td>{{ localeNumber(check.demand) }} {{ check.unit || '' }}</td>
              <td>{{ localeNumber(check.nominal) }} {{ check.unit || '' }}</td>
              <td>{{ localeNumber(check.available_asd) }} {{ check.unit || '' }}</td>
              <td>{{ localeNumber(check.available_lrfd) }} {{ check.unit || '' }}</td>
              <td>{{ localeNumber(check.capacity) }} {{ check.unit || '' }}</td>
              <td>{{ displayValue(check.ratio, '') }}</td><td>{{ methodFactor(check) }}</td><td>{{ check.coverage || 'PENDING' }}</td>
            </tr></tbody></table></div>
            <details>
              <summary>{{ t('details') }}</summary>
              <p v-if="check.formula"><strong>{{ t('formula') }}:</strong> <span class="trace-text">{{ stringifyTrace(check.formula) }}</span></p>
              <p v-if="check.substitution"><strong>{{ t('substitution') }}:</strong></p><pre v-if="check.substitution">{{ stringifyTrace(check.substitution) }}</pre>
              <template v-if="check.warnings?.length"><strong>{{ t('warnings') }}:</strong><ul><li v-for="(warning, index) in check.warnings" :key="index">{{ warning }}</li></ul></template>
              <p v-if="check.worksheet_refs?.length"><strong>{{ t('references') }}:</strong> {{ check.worksheet_refs.join(', ') }}</p>
            </details>
          </div>
        </template>
        <p v-else class="pending-check">{{ t('notVerified') }}</p>
      </section>
    </section>
  </section>
</template>

<style scoped>
.crane-beam{grid-template-columns:minmax(0,1fr);min-width:0}.crane-beam>*{min-width:0}.design-method{min-width:0}.design-method input[type=radio]{width:auto;min-height:auto;padding:0;flex:0 0 auto}.design-method label{min-width:0}.unit-select{min-width:0;flex-wrap:wrap}.unit-select select{max-width:100%}.input-field,.table-scroll,.check-card{min-width:0}.check-title strong{overflow-wrap:anywhere}@media(max-width:540px){.crane-beam .field-grid{grid-template-columns:minmax(0,1fr)}}
.crane-beam{margin-top:18px;color:#243d55;display:grid;gap:14px}.crane-header,.crane-panel{padding:18px 20px;background:var(--workspace-bg);border:1px solid var(--surface-border);border-radius:12px}.crane-header{background:#edf3f7}.crane-header h3{margin:7px 0;font-size:23px}.crane-panel h4{margin:0 0 14px;font-size:19px}.crane-panel p,.crane-header p{line-height:1.5}.note{font-size:13px;color:#526c80}.design-method{display:flex;flex-wrap:wrap;gap:15px;padding:12px;border:1px solid #cedce6;border-radius:8px;margin:12px 0 0}.design-method legend{font-weight:700}.design-method label{display:inline-flex;align-items:center;gap:6px}.design-method input{accent-color:#345f84}.excel-case-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.excel-case-actions button{padding:9px 13px;border:1px solid #9eb2c2;border-radius:6px;background:#fff;color:#284b68;font-weight:600;cursor:pointer}.excel-case-actions button:disabled{opacity:.6;cursor:wait}.input-subsection{padding:16px;border:1px solid #cbd9e5;border-radius:10px;background:#f9fbfd}.nested-section{margin-top:12px}.input-subsection h5,.property-table h5,.stage-card>h5{margin:0 0 12px;font-size:16px;color:#274662}.section-input-heading{margin-top:20px!important}.field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.input-field{display:grid;align-content:start;gap:6px}.input-field span{font-weight:550}.input-field small{font-size:12px;color:#61798d}.input-field input,.input-field select,.unit-select select{box-sizing:border-box;width:100%;min-height:38px;padding:8px;border:1px solid #aebdcc;border-radius:6px;background:#fff}.input-field input[type=checkbox]{width:auto;min-height:auto;justify-self:start}.action-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.action-group{min-width:0;padding:14px;border:1px solid #d1dfe8;border-radius:9px;background:#f8fbfd}.action-group h5{margin:0 0 12px;font-size:16px;color:#2b4d6c}.action-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:15px}.action-row p{margin:0;color:#526c80;font-size:13px}.crane-panel button{padding:10px 16px;border:0;border-radius:6px;background:#294c70;color:white;cursor:pointer}.crane-panel button:disabled{opacity:.6;cursor:wait}.crane-panel .secondary-button{background:#edf3f7;color:#284b68;border:1px solid #adc0ce}.error{color:#a21e1e;overflow-wrap:anywhere}.panel-heading-row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}.panel-heading-row h4{margin-bottom:4px}.unit-select{display:flex;align-items:center;gap:8px;font-size:14px}.unit-select select{width:auto}.property-tables{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.property-table{min-width:0;padding:12px;border:1px solid #d8e2e9;border-radius:9px;background:#fcfbf7}.property-table:first-child{grid-column:1/-1}.table-scroll{width:100%;overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:8px 9px;text-align:left;vertical-align:top;border-bottom:1px solid #d8e1e8;white-space:nowrap}th{font-weight:600}.hash-line{font-size:12px;overflow-wrap:anywhere;color:#61798d}.status-banner{padding:10px 12px;border-left:4px solid #b36835;background:#fff7ed}.stage-card{margin-top:16px;padding:14px;border:1px solid #d8e2e9;border-radius:10px;background:#fbfcfd}.stage-card>h5{font-size:18px}.check-card{margin-top:12px;padding:12px;border:1px solid #d1dfe8;border-radius:8px;background:white}.check-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}.status-chip{padding:3px 8px;border-radius:999px;background:#fff1dc;color:#744311;font-size:12px;font-weight:700;white-space:nowrap}.pending-check{padding:9px 12px;background:#fff7ed;color:#744311;border-radius:6px}.bearing-detail{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin:8px 0 14px}.bearing-detail .note{max-width:420px}.check-card details{margin-top:10px}.check-card summary{cursor:pointer;font-weight:600}.check-card pre{max-height:340px;overflow:auto;padding:10px;border-radius:6px;background:#f4f7f9;white-space:pre-wrap;overflow-wrap:anywhere}.trace-text{white-space:pre-wrap}.check-card ul{padding-left:22px}@media(max-width:850px){.action-groups,.property-tables{grid-template-columns:1fr}.property-table:first-child{grid-column:auto}}@media(max-width:540px){.crane-header,.crane-panel{padding:14px}.check-title{display:grid}.table-scroll table{min-width:760px}}
</style>
