<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { demoMode, request } from '../api'

type GeometryType = 'rectangle' | 'circle' | 'i_section'
type Dimensions = Record<string, number>
type SectionPropertiesRequest = {
  geometry: {
    type: GeometryType
    geometry_variant: 'solid' | 'sharp_corner'
    geometry_model_version: '1.0.0'
    dimensions: Dimensions
  }
  units: 'mm'
  options: {
    solver: 'analytical'
    include_plastic: true
    include_advanced: true
    rectangle_j_relative_tolerance: number
    rectangle_j_max_terms: number
  }
}
type ShearCenterValue = { x: number; y: number; offset_x: number; offset_y: number }
type EffectiveShearAreaValue = { x: number; y: number }
type AdvancedProperty<T = number> = { status: 'computed' | 'not_computed'; value: T | null; reason: string | null; method?: string | null }
type CalculationResult = {
  schema_version: string
  geometry_model_version: string
  geometry_type: GeometryType
  geometry_hash: string
  solver: { method: string; version: string; config_hash: string }
  units: Record<string, string>
  normalized_input: Record<string, unknown>
  properties: {
    geometric: { area: number; perimeter: number; centroid_x: number; centroid_y: number }
    elastic: { ix: number; iy: number; ixy: number; sx_positive: number; sx_negative: number; sy_positive: number; sy_negative: number; rx: number; ry: number }
    plastic: { pna_x: number; pna_y: number; zx: number; zy: number } | null
    principal: { i_major: number; i_minor: number; major_axis_angle_degrees: number | null; orientation_status: string }
  }
  advanced: {
    torsion_constant_j: AdvancedProperty
    warping_constant_cw: AdvancedProperty
    shear_center: AdvancedProperty<ShearCenterValue>
    effective_shear_area: AdvancedProperty<EffectiveShearAreaValue>
  }
  diagnostics: { bounding_box?: { x_min: number; y_min: number; x_max: number; y_max: number }; [key: string]: unknown }
  status: string
}

const props = defineProps({ locale: { type: String, required: true }, asymmetricOnly: { type: Boolean, default: false } })

const copy = {
  vi: {
    title: 'Đặc trưng tiết diện', subtitle: 'Máy tính hình học phân tích · kết quả chỉ hiển thị trong phiên này.', analytical: 'Phân tích', pythonEngine: 'Bộ máy Python', demoEngine: 'Demo trình duyệt · đối chiếu Python', solverLabel: 'Bộ giải',
    type: 'Hình học tiết diện', resultUnit: 'Đơn vị kết quả', asymmetricI: 'I/H không đối xứng', thinWall: 'Xấp xỉ thành mỏng', thinWallNote: 'Cw, tâm cắt và diện tích cắt hữu hiệu dùng mô hình đường trung bình thành mỏng. Tâm cắt tính từ gốc hộp bao; độ lệch Δ tính từ trọng tâm tiết diện nguyên. Ax/Ay ứng với lực cắt Vx/Vy. Không phải nghiệm đàn hồi 2D cho tiết diện thành dày.', exportUnits: 'Tệp JSON giữ số liệu gốc theo mm; đơn vị hiển thị được ghi riêng.', offset: 'Độ lệch', rectangle: 'Chữ nhật đặc', circle: 'Tròn đặc', i_section: 'Chữ I / H',
    presets: 'Ví dụ kiểm tra', presetHint: 'Chọn ví dụ để điền kích thước; nhấn Tính toán để chạy.', tc001: 'TC-001 · Chữ nhật 200 × 400', tc002: 'TC-002 · Tròn D200', tc003: 'TC-003 · I/H không đối xứng',
    dimensions: 'Kích thước (mm)', width: 'Bề rộng b', height: 'Chiều cao h', diameter: 'Đường kính D', depth: 'Chiều cao h', top_flange_width: 'Bề rộng cánh trên bt', bottom_flange_width: 'Bề rộng cánh dưới bb', web_thickness: 'Bề dày bụng tw', top_flange_thickness: 'Bề dày cánh trên tt', bottom_flange_thickness: 'Bề dày cánh dưới tb',
    calculate: 'Tính toán', calculating: 'Đang tính…', reset: 'Xóa kích thước', retry: 'Thử lại', export: 'Tải kết quả JSON',
    calculationNote: 'Chỉ tính đặc trưng tiết diện lý tưởng theo mô hình hình học đã nhập. Không kiểm tra thiết kế theo tiêu chuẩn, không lưu vào dự án hoặc thư viện.',
    resultTitle: 'Kết quả tính toán', geometry: 'Sơ đồ hình học', geometric: 'Hình học', elastic: 'Đàn hồi', plastic: 'Dẻo', principal: 'Trục chính', advanced: 'Đặc trưng nâng cao',
    area: 'Diện tích A', perimeter: 'Chu vi P', centroid: 'Trọng tâm', inertias: 'Mô men quán tính', sectionModuli: 'Mô đun chống uốn', radii: 'Bán kính quán tính', majorInertia: 'Mô men chính lớn Imax', minorInertia: 'Mô men chính nhỏ Imin', angle: 'Góc trục chính', orientation: 'Trạng thái phương', determinate: 'Xác định', indeterminate: 'Không xác định',
    pna: 'Trục trung hòa dẻo PNA', pnaX: 'Tọa độ PNA x', pnaY: 'Tọa độ PNA y', plasticModuli: 'Mô đun dẻo',
    torsion: 'Hằng số xoắn Saint-Venant J', warping: 'Hằng số vênh Cw', shearCenter: 'Tâm cắt', effectiveShear: 'Diện tích chịu cắt hữu hiệu', computed: 'Đã tính', unavailable: 'Chưa có giá trị', reason_not_requested: 'Chưa yêu cầu', reason_solver_not_implemented: 'Chưa triển khai', reason_convergence_not_achieved: 'Chưa đạt độ chính xác yêu cầu', reason_numerical_precision_limit: 'Giới hạn độ chính xác số', reason_numerical_range: 'Ngoài phạm vi số', reason_default: 'Không thể tính với cấu hình hiện tại',
    svgDescription: 'Sơ đồ tiết diện theo tỷ lệ; gốc tọa độ ở góc dưới trái, X hướng sang phải và Y hướng lên trên.', centroidMark: 'Trọng tâm', pnaMark: 'PNA',
    errorTitle: 'Không thể tính đặc trưng tiết diện.', errorGeneric: 'Máy chủ không thể hoàn tất yêu cầu. Kiểm tra kích thước rồi thử lại.', errorInvalidGeometry: 'Hình học không hợp lệ. Kiểm tra các kích thước và quan hệ giữa chúng.', errorUnsupported: 'Thuộc tính được yêu cầu chưa được hỗ trợ.', errorCalculation: 'Không thể tính kết quả hữu hạn với kích thước hiện tại.', errorNetwork: 'Không kết nối được dịch vụ tính toán. Kiểm tra máy chủ rồi thử lại.', errorFields: 'Trường cần kiểm tra', errorCode: 'Mã lỗi', errorStatus: 'Trạng thái HTTP',
    downloaded: 'Đã tạo tệp kết quả.', resetDone: 'Đã xóa kích thước và kết quả.',
  },
  en: {
    title: 'Section properties', subtitle: 'Analytical geometry calculator · results remain in this session only.', analytical: 'Analytical', pythonEngine: 'Python engine', demoEngine: 'Browser demo · Python parity', solverLabel: 'Solver',
    type: 'Section geometry', resultUnit: 'Result unit', asymmetricI: 'Asymmetric I/H section', thinWall: 'Thin-wall approximation', thinWallNote: 'Cw, shear center, and effective shear areas use a thin-wall centerline model. Shear-center coordinates use the bounding-box origin; offsets Δ are relative to the gross centroid. Ax/Ay correspond to shear forces Vx/Vy. These are not full 2D elasticity results for thick-walled sections.', exportUnits: 'JSON retains canonical values in mm; the display unit is recorded separately.', offset: 'Offset', rectangle: 'Solid rectangle', circle: 'Solid circle', i_section: 'I / H section',
    presets: 'Reference examples', presetHint: 'Choose an example to fill the dimensions, then calculate.', tc001: 'TC-001 · Rectangle 200 × 400', tc002: 'TC-002 · Circle D200', tc003: 'TC-003 · Asymmetric I/H',
    dimensions: 'Dimensions (mm)', width: 'Width b', height: 'Height h', diameter: 'Diameter D', depth: 'Depth h', top_flange_width: 'Top flange width bt', bottom_flange_width: 'Bottom flange width bb', web_thickness: 'Web thickness tw', top_flange_thickness: 'Top flange thickness tt', bottom_flange_thickness: 'Bottom flange thickness tb',
    calculate: 'Calculate', calculating: 'Calculating…', reset: 'Clear dimensions', retry: 'Retry', export: 'Download result JSON',
    calculationNote: 'Calculates idealized section properties from the entered geometry only. It does not perform design-code checks or save data to a project or library.',
    resultTitle: 'Calculation result', geometry: 'Geometry diagram', geometric: 'Geometric', elastic: 'Elastic', plastic: 'Plastic', principal: 'Principal axes', advanced: 'Advanced properties',
    area: 'Area A', perimeter: 'Perimeter P', centroid: 'Centroid', inertias: 'Second moments of area', sectionModuli: 'Elastic section moduli', radii: 'Radii of gyration', majorInertia: 'Major principal inertia Imax', minorInertia: 'Minor principal inertia Imin', angle: 'Major-axis angle', orientation: 'Orientation status', determinate: 'Determinate', indeterminate: 'Indeterminate',
    pna: 'Plastic neutral axis PNA', pnaX: 'PNA coordinate x', pnaY: 'PNA coordinate y', plasticModuli: 'Plastic section moduli',
    torsion: 'Saint-Venant torsion constant J', warping: 'Warping constant Cw', shearCenter: 'Shear center', effectiveShear: 'Effective shear area', computed: 'Computed', unavailable: 'No value available', reason_not_requested: 'Not requested', reason_solver_not_implemented: 'Not implemented', reason_convergence_not_achieved: 'Requested tolerance was not met', reason_numerical_precision_limit: 'Numerical precision limit', reason_numerical_range: 'Outside numeric range', reason_default: 'Cannot calculate with the current settings',
    svgDescription: 'Section diagram to scale; origin at the lower-left corner, X points right, and Y points up.', centroidMark: 'Centroid', pnaMark: 'PNA',
    errorTitle: 'Section properties could not be calculated.', errorGeneric: 'The service could not complete the request. Check the dimensions and try again.', errorInvalidGeometry: 'The geometry is invalid. Check the dimensions and their proportions.', errorUnsupported: 'A requested property is not supported.', errorCalculation: 'The current dimensions cannot produce finite results.', errorNetwork: 'Could not connect to the calculation service. Check the server and retry.', errorFields: 'Fields to review', errorCode: 'Error code', errorStatus: 'HTTP status',
    downloaded: 'The result file was created.', resetDone: 'Dimensions and results were cleared.',
  },
}

const t = (key: string) => (copy[props.locale as 'vi' | 'en'] ?? copy.en)[key as keyof typeof copy.en] ?? copy.en[key as keyof typeof copy.en] ?? key
const geometryType = ref<GeometryType>(props.asymmetricOnly ? 'i_section' : 'rectangle')
const resultUnit = ref<'mm' | 'cm' | 'm'>('mm')
const resultScale = computed(() => ({ mm: 1, cm: 0.1, m: 0.001 })[resultUnit.value])
const forms = reactive({
  rectangle: { width: null as number | null, height: null as number | null },
  circle: { diameter: null as number | null },
  i_section: { depth: null as number | null, top_flange_width: null as number | null, bottom_flange_width: null as number | null, web_thickness: null as number | null, top_flange_thickness: null as number | null, bottom_flange_thickness: null as number | null },
})
const loading = ref(false)
const result = ref<CalculationResult | null>(null)
const calculationError = ref<{ code: string; status: number | null; fields: string[]; kind: string } | null>(null)
const lastRequest = ref<SectionPropertiesRequest | null>(null)
const notice = ref('')
let requestSequence = 0
const instanceId = useId().replaceAll(':', '')
const axisMarkerId = `section-axis-arrow-${instanceId}`

const fieldDefinitions: Record<GeometryType, { key: string; label: string }[]> = {
  rectangle: [{ key: 'width', label: 'width' }, { key: 'height', label: 'height' }],
  circle: [{ key: 'diameter', label: 'diameter' }],
  i_section: [
    { key: 'depth', label: 'depth' }, { key: 'top_flange_width', label: 'top_flange_width' },
    { key: 'bottom_flange_width', label: 'bottom_flange_width' }, { key: 'web_thickness', label: 'web_thickness' },
    { key: 'top_flange_thickness', label: 'top_flange_thickness' }, { key: 'bottom_flange_thickness', label: 'bottom_flange_thickness' },
  ],
}
const currentFields = computed(() => fieldDefinitions[geometryType.value])
const dimensionValues = computed(() => forms[geometryType.value] as Record<string, number | null>)
const validDimensions = computed(() => currentFields.value.every(({ key }) => {
  const value = dimensionValues.value[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}))
const currentFingerprint = computed(() => JSON.stringify({ type: geometryType.value, dimensions: dimensionValues.value }))
const readyResult = computed(() => result.value && result.value.geometry_type === geometryType.value ? result.value : null)

function clearResult() {
  requestSequence++
  loading.value = false
  result.value = null
  calculationError.value = null
  lastRequest.value = null
  notice.value = ''
}

watch(currentFingerprint, clearResult)
watch(() => props.asymmetricOnly, restricted => { if (restricted) geometryType.value = 'i_section' })

function setExample(example: 'tc001' | 'tc002' | 'tc003') {
  clearResult()
  if (example === 'tc001') {
    geometryType.value = 'rectangle'
    Object.assign(forms.rectangle, { width: 200, height: 400 })
  } else if (example === 'tc002') {
    geometryType.value = 'circle'
    Object.assign(forms.circle, { diameter: 200 })
  } else {
    geometryType.value = 'i_section'
    Object.assign(forms.i_section, { depth: 400, top_flange_width: 200, bottom_flange_width: 250, web_thickness: 8, top_flange_thickness: 12, bottom_flange_thickness: 16 })
  }
}

function buildRequest(): SectionPropertiesRequest {
  const dimensions: Record<string, number> = {}
  for (const { key } of currentFields.value) {
    const value = dimensionValues.value[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('invalid_dimensions')
    dimensions[key] = value
  }
  return {
    geometry: {
      type: geometryType.value,
      geometry_variant: geometryType.value === 'i_section' ? 'sharp_corner' : 'solid',
      geometry_model_version: '1.0.0',
      dimensions,
    },
    units: 'mm',
    options: {
      solver: 'analytical', include_plastic: true, include_advanced: true,
      rectangle_j_relative_tolerance: 1e-10, rectangle_j_max_terms: 10000,
    },
  }
}

function errorFields(error: unknown): string[] {
  const record = error as { errors?: Record<string, unknown> | unknown[] } | null
  if (!record?.errors || typeof record.errors !== 'object') return []
  const labels = new Set<string>()
  const entries = Array.isArray(record.errors)
    ? record.errors.map((issue, index) => {
      const detail = issue as { loc?: unknown[]; msg?: unknown; message?: unknown; type?: unknown }
      return [Array.isArray(detail?.loc) ? detail.loc.join('.') : String(index), JSON.stringify(detail)]
    })
    : Object.entries(record.errors)
  for (const [path, value] of entries) {
    const candidate = `${path} ${Array.isArray(value) ? value.join(' ') : String(value)}`
    for (const { key, label } of fieldDefinitions[geometryType.value]) {
      if (candidate.includes(key)) labels.add(t(label))
    }
  }
  return [...labels]
}

function errorKind(error: unknown): string {
  const record = error as { code?: string; status?: number; message?: string } | null
  const code = String(record?.code ?? '').toUpperCase()
  const message = String(record?.message ?? '').toLowerCase()
  if (code.includes('INVALID_GEOMETRY') || code.includes('INVALID_INPUT') || message.includes('geometry')) return 'errorInvalidGeometry'
  if (code.includes('UNSUPPORTED')) return 'errorUnsupported'
  if (code.includes('CALCULATION') || code.includes('CONVERGENCE')) return 'errorCalculation'
  if (!record?.status || record.status >= 500) return 'errorNetwork'
  return 'errorGeneric'
}

async function calculate(payload = lastRequest.value) {
  if (loading.value || !payload) return
  const currentRequest = ++requestSequence
  const fingerprint = currentFingerprint.value
  loading.value = true
  calculationError.value = null
  result.value = null
  notice.value = ''
  lastRequest.value = payload
  try {
    const response = await request('/api/v1/sections/calculate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (currentRequest !== requestSequence || fingerprint !== currentFingerprint.value) return
    result.value = response as CalculationResult
  } catch (error) {
    if (currentRequest !== requestSequence || fingerprint !== currentFingerprint.value) return
    const typedError = error as { code?: string; status?: number }
    calculationError.value = {
      code: typedError.code ?? 'CALCULATION_ERROR',
      status: typeof typedError.status === 'number' ? typedError.status : null,
      fields: errorFields(error),
      kind: errorKind(error),
    }
  } finally {
    if (currentRequest === requestSequence) loading.value = false
  }
}

function onCalculate() {
  if (!validDimensions.value) return
  try {
    void calculate(buildRequest())
  } catch {
    calculationError.value = { code: 'INVALID_INPUT', status: null, fields: [], kind: 'errorInvalidGeometry' }
  }
}

function resetForm() {
  if (geometryType.value === 'rectangle') Object.assign(forms.rectangle, { width: null, height: null })
  if (geometryType.value === 'circle') Object.assign(forms.circle, { diameter: null })
  if (geometryType.value === 'i_section') Object.assign(forms.i_section, { depth: null, top_flange_width: null, bottom_flange_width: null, web_thickness: null, top_flange_thickness: null, bottom_flange_thickness: null })
  clearResult()
}

function format(value: number | null | undefined, maximumSignificantDigits = 8): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits }).format(value)
}

function formatDim(value: number | null | undefined, power = 1): string {
  if (typeof value !== 'number') return '—'
  const converted = value * resultScale.value ** power
  if (!Number.isFinite(converted) || (value !== 0 && converted === 0)) return '—'
  return format(converted)
}
function unitLabel(power = 1): string {
  return resultUnit.value + ({ 1: '', 2: '²', 3: '³', 4: '⁴', 6: '⁶' } as Record<number, string>)[power]
}
function isShearCenter(value: unknown): value is ShearCenterValue {
  return !!value && typeof value === 'object' && 'offset_x' in value && 'offset_y' in value
}
function isShearArea(value: unknown): value is EffectiveShearAreaValue {
  return !!value && typeof value === 'object' && 'x' in value && 'y' in value && !('offset_x' in value)
}

function advancedLabel(key: string): string {
  const labels: Record<string, string> = { torsion_constant_j: 'torsion', warping_constant_cw: 'warping', shear_center: 'shearCenter', effective_shear_area: 'effectiveShear' }
  return t(labels[key] ?? key)
}

function advancedReason(reason: string | null): string {
  const key = `reason_${reason ?? 'default'}`
  return t(key)
}

function downloadResult() {
  if (!readyResult.value) return
  const payload = { request: lastRequest.value, result: readyResult.value, display_unit: resultUnit.value }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
  link.href = url
  link.download = `geekcalculus-section-properties-${geometryType.value}-${timestamp}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  notice.value = 'downloaded'
}

const svgGeometry = computed(() => {
  const d = dimensionValues.value
  const width = geometryType.value === 'circle' ? (d.diameter ?? 1) : geometryType.value === 'rectangle' ? (d.width ?? 1) : Math.max(d.top_flange_width ?? 1, d.bottom_flange_width ?? 1)
  const height = geometryType.value === 'circle' ? (d.diameter ?? 1) : geometryType.value === 'rectangle' ? (d.height ?? 1) : (d.depth ?? 1)
  const scale = Math.min(205 / Math.max(width, Number.EPSILON), 170 / Math.max(height, Number.EPSILON))
  const drawWidth = width * scale
  const drawHeight = height * scale
  const left = 65 + (205 - drawWidth) / 2
  const top = 205 - drawHeight
  const x = (value: number) => left + value * scale
  const y = (value: number) => top + (height - value) * scale
  const outline = geometryType.value === 'rectangle'
    ? `M ${x(0)} ${y(0)} L ${x(width)} ${y(0)} L ${x(width)} ${y(height)} L ${x(0)} ${y(height)} Z`
    : geometryType.value === 'circle'
      ? ''
      : (() => {
        const bt = d.top_flange_width ?? width
        const bb = d.bottom_flange_width ?? width
        const tw = d.web_thickness ?? 1
        const tt = d.top_flange_thickness ?? 1
        const tb = d.bottom_flange_thickness ?? 1
        const cx = width / 2
        const points = [
          [cx - bb / 2, 0], [cx + bb / 2, 0], [cx + bb / 2, tb], [cx + tw / 2, tb],
          [cx + tw / 2, height - tt], [cx + bt / 2, height - tt], [cx + bt / 2, height],
          [cx - bt / 2, height], [cx - bt / 2, height - tt], [cx - tw / 2, height - tt],
          [cx - tw / 2, tb], [cx - bb / 2, tb],
        ]
        return `M ${points.map(([px, py]) => `${x(px)} ${y(py)}`).join(' L ')} Z`
      })()
  const centroid = readyResult.value?.properties.geometric
  const plastic = readyResult.value?.properties.plastic
  const shearCenter = readyResult.value?.advanced.shear_center.value
  return {
    width, height, left, right: left + drawWidth, top, bottom: top + drawHeight, x, y, outline,
    circleX: x(width / 2), circleY: y(height / 2), circleRadius: Math.min(drawWidth, drawHeight) / 2,
    centroid: centroid ? { x: x(centroid.centroid_x), y: y(centroid.centroid_y) } : null,
    pnaY: plastic ? y(plastic.pna_y) : null,
    shearCenter: shearCenter ? { x: x(shearCenter.x), y: y(shearCenter.y) } : null,
  }
})
</script>

<template>
  <section class="section-properties" :aria-label="t('title')">
    <header class="section-properties-heading">
      <div>
        <span class="section-properties-kicker">{{ t('title') }} · {{ t('analytical') }}</span>
        <h2>{{ t('title') }}</h2>
        <p>{{ t('subtitle') }}</p>
      </div>
      <span class="section-properties-badge">{{ demoMode ? t('demoEngine') : t('pythonEngine') }}</span>
    </header>

    <div class="section-properties-layout">
      <form class="section-properties-form" @submit.prevent="onCalculate">
        <div class="section-properties-field">
          <label for="section-geometry-type">{{ t('type') }}</label>
          <select id="section-geometry-type" v-model="geometryType" class="section-properties-control">
            <option v-if="!asymmetricOnly" value="rectangle">{{ t('rectangle') }}</option>
            <option v-if="!asymmetricOnly" value="circle">{{ t('circle') }}</option>
            <option value="i_section">{{ asymmetricOnly ? t('asymmetricI') : t('i_section') }}</option>
          </select>
        </div>

        <fieldset class="section-properties-presets">
          <legend>{{ t('presets') }}</legend>
          <p>{{ t('presetHint') }}</p>
          <div class="section-properties-preset-buttons">
            <button v-if="!asymmetricOnly" type="button" @click="setExample('tc001')">{{ t('tc001') }}</button>
            <button v-if="!asymmetricOnly" type="button" @click="setExample('tc002')">{{ t('tc002') }}</button>
            <button type="button" @click="setExample('tc003')">{{ t('tc003') }}</button>
          </div>
        </fieldset>

        <fieldset class="section-properties-dimensions">
          <legend>{{ t('dimensions') }}</legend>
          <div class="section-properties-input-grid" :class="{ 'section-properties-input-grid-single': currentFields.length === 1 }">
            <label v-for="field in currentFields" :key="field.key" class="section-properties-field">
              <span>{{ t(field.label) }} <small>mm</small></span>
              <input v-model.number="dimensionValues[field.key]" type="number" min="0" step="any" required class="section-properties-control" inputmode="decimal" />
            </label>
          </div>
        </fieldset>

        <div class="section-properties-actions">
          <button class="section-properties-primary" type="submit" :disabled="loading || !validDimensions">
            <span v-if="loading" class="section-properties-spinner" aria-hidden="true"></span>{{ loading ? t('calculating') : t('calculate') }}
          </button>
          <button class="section-properties-secondary" type="button" :disabled="loading" @click="resetForm">{{ t('reset') }}</button>
        </div>
        <label class="section-properties-field section-properties-result-unit">
          <span>{{ t('resultUnit') }}</span>
          <select v-model="resultUnit" :aria-label="t('resultUnit')" class="section-properties-control">
            <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
          </select>
        </label>
        <p class="section-properties-caveat">{{ t('calculationNote') }}</p>
      </form>

      <section class="section-properties-output" :aria-live="loading ? 'polite' : 'off'">
        <div v-if="loading" class="section-properties-output-state" role="status"><span class="section-properties-spinner"></span>{{ t('calculating') }}</div>
        <div v-else-if="calculationError" class="section-properties-error" role="alert">
          <strong>{{ t('errorTitle') }}</strong>
          <p>{{ t(calculationError.kind) }}</p>
          <p v-if="calculationError.fields.length"><span>{{ t('errorFields') }}: </span>{{ calculationError.fields.join(', ') }}</p>
          <dl><template v-if="calculationError.code"><dt>{{ t('errorCode') }}</dt><dd>{{ calculationError.code }}</dd></template><template v-if="calculationError.status"><dt>{{ t('errorStatus') }}</dt><dd>{{ calculationError.status }}</dd></template></dl>
          <button v-if="lastRequest" class="section-properties-secondary" type="button" @click="calculate()">{{ t('retry') }}</button>
        </div>
        <div v-else-if="readyResult" class="section-properties-result">
          <header class="section-properties-result-heading">
            <div><span class="section-properties-kicker">{{ t('resultTitle') }}</span><h3>{{ t('resultTitle') }}</h3></div>
            <button type="button" class="section-properties-export" @click="downloadResult">{{ t('export') }}</button>
          </header>

          <p class="section-properties-caveat">{{ t('exportUnits') }}</p>
          <div class="section-properties-result-top">
            <article class="section-properties-diagram-card">
              <h4>{{ t('geometry') }}</h4>
              <svg viewBox="0 0 320 250" role="img" :aria-label="t('svgDescription')" class="section-properties-svg">
                <title>{{ t('svgDescription') }}</title>
                <defs><marker :id="axisMarkerId" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M 0 0 L 6 3 L 0 6 z" fill="#65809a" /></marker></defs>
                <path v-if="geometryType !== 'circle'" :d="svgGeometry.outline" fill="#dce9f4" stroke="#375f83" stroke-width="1.5" />
                <circle v-else :cx="svgGeometry.circleX" :cy="svgGeometry.circleY" :r="svgGeometry.circleRadius" fill="#dce9f4" stroke="#375f83" stroke-width="1.5" />
                <line v-if="readyResult.properties.plastic" :x1="svgGeometry.left" :x2="svgGeometry.right" :y1="svgGeometry.pnaY ?? 0" :y2="svgGeometry.pnaY ?? 0" stroke="#ba7650" stroke-width="1.5" stroke-dasharray="5 4" />
                <circle v-if="svgGeometry.centroid" :cx="svgGeometry.centroid.x" :cy="svgGeometry.centroid.y" r="4" fill="#b94f4f" stroke="#fff" stroke-width="1.5" />
                <circle v-if="svgGeometry.shearCenter" :cx="svgGeometry.shearCenter.x" :cy="svgGeometry.shearCenter.y" r="4" fill="#654b8c" stroke="#fff" stroke-width="1.5" class="section-properties-shear-marker" />
                <line :x1="svgGeometry.left" :y1="svgGeometry.bottom" :x2="svgGeometry.left + 34" :y2="svgGeometry.bottom" stroke="#65809a" stroke-width="1.2" :marker-end="`url(#${axisMarkerId})`" />
                <line :x1="svgGeometry.left" :y1="svgGeometry.bottom" :x2="svgGeometry.left" :y2="svgGeometry.bottom - 34" stroke="#65809a" stroke-width="1.2" :marker-end="`url(#${axisMarkerId})`" />
                <text :x="svgGeometry.left + 39" :y="svgGeometry.bottom + 4" fill="#65809a" font-size="12">X</text><text :x="svgGeometry.left - 3" :y="svgGeometry.bottom - 39" fill="#65809a" font-size="12">Y</text><text :x="svgGeometry.left - 13" :y="svgGeometry.bottom + 13" fill="#65809a" font-size="10">O</text>
              </svg>
              <div class="section-properties-legend"><span v-if="svgGeometry.shearCenter"><i class="section-properties-legend-shear"></i>{{ t('shearCenter') }}</span><span><i class="section-properties-legend-centroid"></i>{{ t('centroidMark') }}</span><span v-if="readyResult.properties.plastic"><i class="section-properties-legend-pna"></i>{{ t('pnaMark') }} · y={{ formatDim(readyResult.properties.plastic.pna_y, 1) }} {{ unitLabel() }}</span></div>
            </article>
            <article class="section-properties-summary-card">
              <h4>{{ t('geometric') }}</h4>
              <dl class="section-properties-values">
                <div><dt>{{ t('area') }}</dt><dd>{{ formatDim(readyResult.properties.geometric.area, 2) }} <small>{{ unitLabel(2) }}</small></dd></div>
                <div><dt>{{ t('perimeter') }}</dt><dd>{{ formatDim(readyResult.properties.geometric.perimeter, 1) }} <small>{{ unitLabel(1) }}</small></dd></div>
                <div><dt>{{ t('centroid') }} x</dt><dd>{{ formatDim(readyResult.properties.geometric.centroid_x, 1) }} <small>{{ unitLabel(1) }}</small></dd></div>
                <div><dt>{{ t('centroid') }} y</dt><dd>{{ formatDim(readyResult.properties.geometric.centroid_y, 1) }} <small>{{ unitLabel(1) }}</small></dd></div>
              </dl>
            </article>
          </div>

          <div class="section-properties-result-grid">
            <article class="section-properties-result-card">
              <h4>{{ t('elastic') }}</h4>
              <dl class="section-properties-values">
                <div><dt>Ix</dt><dd>{{ formatDim(readyResult.properties.elastic.ix, 4) }} <small>{{ unitLabel(4) }}</small></dd></div>
                <div><dt>Iy</dt><dd>{{ formatDim(readyResult.properties.elastic.iy, 4) }} <small>{{ unitLabel(4) }}</small></dd></div>
                <div><dt>Ixy</dt><dd>{{ formatDim(readyResult.properties.elastic.ixy, 4) }} <small>{{ unitLabel(4) }}</small></dd></div>
                <div><dt>{{ t('sectionModuli') }} Sx+</dt><dd>{{ formatDim(readyResult.properties.elastic.sx_positive, 3) }} <small>{{ unitLabel(3) }}</small></dd></div>
                <div><dt>{{ t('sectionModuli') }} Sx−</dt><dd>{{ formatDim(readyResult.properties.elastic.sx_negative, 3) }} <small>{{ unitLabel(3) }}</small></dd></div>
                <div><dt>{{ t('sectionModuli') }} Sy+</dt><dd>{{ formatDim(readyResult.properties.elastic.sy_positive, 3) }} <small>{{ unitLabel(3) }}</small></dd></div>
                <div><dt>{{ t('sectionModuli') }} Sy−</dt><dd>{{ formatDim(readyResult.properties.elastic.sy_negative, 3) }} <small>{{ unitLabel(3) }}</small></dd></div>
                <div><dt>{{ t('radii') }} rx</dt><dd>{{ formatDim(readyResult.properties.elastic.rx, 1) }} <small>{{ unitLabel(1) }}</small></dd></div>
                <div><dt>{{ t('radii') }} ry</dt><dd>{{ formatDim(readyResult.properties.elastic.ry, 1) }} <small>{{ unitLabel(1) }}</small></dd></div>
              </dl>
            </article>
            <article class="section-properties-result-card">
              <h4>{{ t('principal') }}</h4>
              <dl class="section-properties-values">
                <div><dt>{{ t('majorInertia') }}</dt><dd>{{ formatDim(readyResult.properties.principal.i_major, 4) }} <small>{{ unitLabel(4) }}</small></dd></div>
                <div><dt>{{ t('minorInertia') }}</dt><dd>{{ formatDim(readyResult.properties.principal.i_minor, 4) }} <small>{{ unitLabel(4) }}</small></dd></div>
                <div><dt>{{ t('angle') }}</dt><dd>{{ readyResult.properties.principal.major_axis_angle_degrees === null ? '—' : `${format(readyResult.properties.principal.major_axis_angle_degrees)}°` }}</dd></div>
                <div><dt>{{ t('orientation') }}</dt><dd>{{ t(readyResult.properties.principal.orientation_status) }}</dd></div>
              </dl>
            </article>
            <article v-if="readyResult.properties.plastic" class="section-properties-result-card">
              <h4>{{ t('plastic') }}</h4>
              <dl class="section-properties-values">
                <div><dt>{{ t('pnaX') }}</dt><dd>{{ formatDim(readyResult.properties.plastic.pna_x, 1) }} <small>{{ unitLabel(1) }}</small></dd></div>
                <div><dt>{{ t('pnaY') }}</dt><dd>{{ formatDim(readyResult.properties.plastic.pna_y, 1) }} <small>{{ unitLabel(1) }}</small></dd></div>
                <div><dt>{{ t('plasticModuli') }} Zx</dt><dd>{{ formatDim(readyResult.properties.plastic.zx, 3) }} <small>{{ unitLabel(3) }}</small></dd></div>
                <div><dt>{{ t('plasticModuli') }} Zy</dt><dd>{{ formatDim(readyResult.properties.plastic.zy, 3) }} <small>{{ unitLabel(3) }}</small></dd></div>
              </dl>
            </article>
            <article class="section-properties-result-card section-properties-advanced-card">
              <h4>{{ t('advanced') }}</h4>
              <p v-if="readyResult.geometry_type === 'i_section'" class="section-properties-caveat">{{ t('thinWallNote') }}</p>
              <dl class="section-properties-values">
                <div v-for="(property, key) in readyResult.advanced" :key="key">
                  <dt>{{ advancedLabel(String(key)) }}<small v-if="property.method" class="section-properties-method">{{ t('thinWall') }}</small></dt>
                  <dd v-if="property.status === 'computed' && typeof property.value === 'number'">{{ formatDim(property.value, key === 'warping_constant_cw' ? 6 : 4) }} <small>{{ unitLabel(key === 'warping_constant_cw' ? 6 : 4) }}</small></dd>
                  <dd v-else-if="property.status === 'computed' && isShearCenter(property.value)" class="section-properties-vector">
                    <span>x = {{ formatDim(property.value.x) }}, y = {{ formatDim(property.value.y) }} <small>{{ unitLabel() }}</small></span>
                    <span>{{ t('offset') }} Δx = {{ formatDim(property.value.offset_x) }}, Δy = {{ formatDim(property.value.offset_y) }} <small>{{ unitLabel() }}</small></span>
                  </dd>
                  <dd v-else-if="property.status === 'computed' && isShearArea(property.value)" class="section-properties-vector">
                    <span>Ax (Vx) = {{ formatDim(property.value.x, 2) }} <small>{{ unitLabel(2) }}</small></span>
                    <span>Ay (Vy) = {{ formatDim(property.value.y, 2) }} <small>{{ unitLabel(2) }}</small></span>
                  </dd>
                  <dd v-else><span class="section-properties-unavailable">{{ advancedReason(property.reason) }}</span></dd>
                </div>
              </dl>
            </article>
          </div>
          <footer class="section-properties-result-meta"><span>{{ t('solverLabel') }} {{ readyResult.solver.version }}</span><span>{{ readyResult.geometry_hash.slice(0, 16) }}…</span></footer>
        </div>
        <div v-else class="section-properties-output-state section-properties-output-empty">
          <div class="section-properties-empty-mark" aria-hidden="true">A / I / S</div>
          <strong>{{ t('resultTitle') }}</strong>
          <span>{{ t('calculationNote') }}</span>
        </div>
      </section>
    </div>
    <p v-if="notice" class="section-properties-notice" role="status">{{ t(notice) }}</p>
  </section>
</template>

<style scoped>
.section-properties { color: #233850; }
.section-properties-heading, .section-properties-result-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-properties-heading { margin-bottom: 17px; }
.section-properties-kicker { color: #4977a4; font-size: 14px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.section-properties-heading h2 { margin: 6px 0 5px; color: #203b58; font-size: 24px; letter-spacing: -.03em; }
.section-properties-heading p { margin: 0; color: #70849a; font-size: 15px; line-height: 1.5; }
.section-properties-badge { flex: 0 0 auto; padding: 7px 9px; border: 1px solid #d6e3ee; border-radius: 20px; background: var(--soft-bg); color: #52789b; font-size: 14px; font-weight: 700; }
.section-properties-layout { display: grid; grid-template-columns: minmax(260px, .74fr) minmax(0, 1.65fr); align-items: start; gap: 14px; }
.section-properties-form, .section-properties-output { min-width: 0; padding: 18px; border: 1px solid var(--surface-border); border-radius: 11px; background: var(--surface-bg); }
.section-properties-field { display: flex; min-width: 0; flex-direction: column; gap: 6px; color: #5d7690; font-size: 14px; font-weight: 700; }
.section-properties-field small { color: #8495a7; font-size: 14px; font-weight: 550; }
.section-properties-control { width: 100%; min-height: 39px; padding: 8px 10px; border: 1px solid var(--surface-border); border-radius: 7px; background: var(--surface-bg); color: #233850; font: inherit; font-size: 15px; }
select.section-properties-control { background: var(--workspace-bg); }
.section-properties-control:focus-visible { outline: 3px solid #b7d5ed; outline-offset: 1px; border-color: #6d9bc5; }
.section-properties-presets, .section-properties-dimensions { min-width: 0; margin: 15px 0 0; padding: 0; border: 0; }
.section-properties-presets legend, .section-properties-dimensions legend { padding: 0; color: #4e6a85; font-size: 14px; font-weight: 750; }
.section-properties-presets p { margin: 5px 0 8px; color: #7d8fa0; font-size: 14px; line-height: 1.45; }
.section-properties-preset-buttons { display: grid; grid-template-columns: 1fr; gap: 5px; }
.section-properties-preset-buttons button { min-height: 30px; padding: 6px 8px; border: 1px solid #dce6ee; border-radius: 6px; background: var(--field-bg); color: #53718e; cursor: pointer; font: inherit; font-size: 14px; text-align: left; }
.section-properties-preset-buttons button:hover, .section-properties-preset-buttons button:focus-visible { border-color: #23395d; background: #23395d; color: white; }
.section-properties-input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
.section-properties-input-grid-single { grid-template-columns: 1fr; }
.section-properties-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.section-properties-primary, .section-properties-secondary, .section-properties-export { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 37px; padding: 8px 12px; border-radius: 7px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700; transition: background .15s, color .15s, border-color .15s; }
.section-properties-primary { border: 1px solid #294b6b; background: #294b6b; color: white; }
.section-properties-primary:hover:not(:disabled) { border-color: #23395d; background: #23395d; }
.section-properties-secondary, .section-properties-export { border: 1px solid #d5e1ea; background: var(--field-bg); color: #53708c; }
.section-properties-secondary:hover:not(:disabled), .section-properties-export:hover { border-color: #23395d; background: #23395d; color: white; }
.section-properties-primary:disabled, .section-properties-secondary:disabled { cursor: not-allowed; opacity: .56; }
.section-properties-primary:focus-visible, .section-properties-secondary:focus-visible, .section-properties-export:focus-visible { outline: 3px solid #9bc3e2; outline-offset: 2px; }
.section-properties-spinner { width: 13px; height: 13px; border: 2px solid #b7cada; border-top-color: currentColor; border-radius: 50%; animation: section-spin .8s linear infinite; }
@keyframes section-spin { to { transform: rotate(360deg); } }
.section-properties-result-unit { margin-top: 16px; }
.section-properties-method { display: block; margin-top: 3px; font-size: 14px; font-weight: 500; }
.section-properties-vector { display: grid; gap: 5px; }
.section-properties-legend .section-properties-legend-shear { background: #654b8c; }
.section-properties-caveat { margin: 13px 0 0; color: #788b9e; font-size: 14px; line-height: 1.6; }
.section-properties-output { min-height: 290px; }
.section-properties-output-state { display: flex; min-height: 250px; flex-direction: column; align-items: center; justify-content: center; gap: 11px; color: #73879b; font-size: 15px; text-align: center; }
.section-properties-output-empty { padding: 25px; }
.section-properties-output-empty span { max-width: 400px; color: #8999a9; font-size: 14px; line-height: 1.6; }
.section-properties-empty-mark { margin-bottom: 2px; color: #7292af; font-size: 25px; font-weight: 300; letter-spacing: .08em; }
.section-properties-error { padding: 14px; border: 1px solid #efd5d5; border-radius: 9px; background: #fff8f8; color: #834a4d; font-size: 14px; line-height: 1.6; }
.section-properties-error > p { margin: 6px 0 0; }
.section-properties-error dl { display: flex; flex-wrap: wrap; gap: 3px 8px; margin: 8px 0 11px; font-size: 14px; }
.section-properties-error dt { color: #8d6265; font-weight: 700; }.section-properties-error dd { margin: 0; color: #72585a; overflow-wrap: anywhere; }
.section-properties-result-heading { align-items: center; margin-bottom: 12px; }
.section-properties-result-heading h3 { margin: 4px 0 0; color: #294661; font-size: 18px; }
.section-properties-export { flex: 0 0 auto; min-height: 32px; padding: 6px 9px; font-size: 14px; }
.section-properties-result-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(190px, .75fr); gap: 10px; }
.section-properties-diagram-card, .section-properties-summary-card, .section-properties-result-card { min-width: 0; padding: 12px; border: 1px solid #e1e9ef; border-radius: 8px; background: var(--soft-bg); }
.section-properties-result h4 { margin: 0 0 9px; color: #4d6c88; font-size: 14px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
.section-properties-svg { display: block; width: 100%; max-height: 220px; }
.section-properties-legend { display: flex; flex-wrap: wrap; gap: 8px 12px; padding-top: 5px; color: #70849a; font-size: 14px; }
.section-properties-legend span { display: inline-flex; align-items: center; gap: 5px; }
.section-properties-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #b94f4f; }
.section-properties-legend .section-properties-legend-pna { width: 12px; height: 0; border-top: 2px dashed #ba7650; border-radius: 0; background: transparent; }
.section-properties-values { display: grid; gap: 0; margin: 0; }
.section-properties-values > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; min-width: 0; padding: 6px 0; border-bottom: 1px solid #edf1f4; }
.section-properties-values > div:last-child { border-bottom: 0; }
.section-properties-values dt { color: var(--muted-ink); font-size: 14px; line-height: 1.45; }
.section-properties-values dd { margin: 0; color: #344f69; font-size: 14px; font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
.section-properties-values dd small { color: #8496a7; font-size: 14px; font-weight: 500; white-space: nowrap; }
.section-properties-result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 9px; }
.section-properties-advanced-card { grid-column: span 2; }
.section-properties-unavailable { color: var(--muted-ink); font-weight: 550; }
.section-properties-result-meta { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; color: #93a0ad; font-size: 14px; overflow-wrap: anywhere; }
.section-properties-notice { margin: 10px 0 0; color: #4e7960; font-size: 14px; }
@media (max-width: 860px) { .section-properties-layout { grid-template-columns: 1fr; }.section-properties-preset-buttons { grid-template-columns: repeat(3, minmax(0, 1fr)); }.section-properties-preset-buttons button { min-height: 42px; text-align: center; } }
@media (max-width: 600px) { .section-properties-form, .section-properties-output { padding: 14px 12px; }.section-properties-heading h2 { font-size: 21px; }.section-properties-badge { font-size: 14px; }.section-properties-preset-buttons { grid-template-columns: 1fr; }.section-properties-preset-buttons button { min-height: 31px; text-align: left; }.section-properties-input-grid { grid-template-columns: 1fr; }.section-properties-result-top { grid-template-columns: 1fr; }.section-properties-result-grid { grid-template-columns: 1fr; }.section-properties-advanced-card { grid-column: auto; }.section-properties-result-meta { flex-direction: column; gap: 3px; } }
@media (prefers-reduced-motion: reduce) { .section-properties-spinner { animation-duration: 2s; }.section-properties-primary, .section-properties-secondary, .section-properties-export { transition: none; } }
</style>
