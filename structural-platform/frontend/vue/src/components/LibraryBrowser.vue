<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import { request, demoMode } from '../api'
import { copy } from '../i18n'
import { buildCatalogSectionCalculationRequest, CATALOG_GEOMETRY_KEYS, catalogGeometryMode, catalogSectionInputProperties, isCatalogDerivedSectionProperty } from '../sectional-properties/catalog-payload.js'
import DesignCodeIcon from './DesignCodeIcon.vue'
import DesignCodeSelect from './DesignCodeSelect.vue'
import SectionCalculatedProperties from './SectionCalculatedProperties.vue'
import SectionGeometrySketch from './SectionGeometrySketch.vue'

const props = defineProps({ locale: { type: String, required: true }, canEdit: { type: Boolean, default: false } })
const t = (key) => copy[props.locale]?.[key] ?? copy.en[key] ?? key
const transferId = useId()
const regionDatalistId = useId()

const metadataCopy = {
  vi: {
    designCode: 'Thị trường (Design Code)', regionType: 'Nhóm catalog (Region type)', unclassified: 'Chưa phân loại',
    allDesignCodes: 'Tất cả thị trường', allRegionTypes: 'Tất cả nhóm catalog',
    regionTypeHint: 'Tùy chọn; gợi ý phụ thuộc thị trường và hình dạng.',
  },
  en: {
    designCode: 'Design Code', regionType: 'Region type', unclassified: 'Unclassified',
    allDesignCodes: 'All design codes', allRegionTypes: 'All section families',
    regionTypeHint: 'Optional; suggestions depend on design code and shape.',
  },
}
const metaT = (key) => metadataCopy[props.locale]?.[key] ?? metadataCopy.en[key] ?? key

const resourceDefinitions = {
  materials: { endpoint: '/api/materials', schemaKey: 'materials', addKey: 'addMaterial' },
  section_types: { endpoint: '/api/section-types', schemaKey: null, addKey: 'addSectionType' },
  sections: { endpoint: '/api/sections', schemaKey: 'sections', addKey: 'addSection' },
}
const resourceKeys = ['materials', 'section_types', 'sections']
const activeResource = ref('materials')
const schema = ref(null)
const records = ref({ materials: [], section_types: [], sections: [] })
const loading = ref(true)
const schemaLoading = ref(true)
const schemaError = ref(false)
const errorKey = ref('')
const validationFieldKeys = ref([])
const messageKey = ref('')
const search = ref('')
const categoryFilter = ref('')
const shapeFilter = ref('')
const designCodeFilter = ref('')
const regionTypeFilter = ref('')
const editorOpen = ref(false)
const editorMode = ref('create')
const editorResource = ref('materials')
const copySourceCode = ref('')
const saving = ref(false)
const deletingId = ref(null)
const fileInput = ref(null)
const archivePreview = ref(null)
const importMode = ref('skip')
const transferBusy = ref(false)
const transferPhase = ref('')
const transferErrorKey = ref('')
const transferErrorPaths = ref([])
const transferErrorDetails = ref([])
const transferErrorStatus = ref(null)
const transferMessageKey = ref('')
const transferResult = ref(null)
let listRequestId = 0
let sectionEngineDebounce = null

const transferCopy = {
  vi: {
    title: 'Sao lưu và chuyển thư viện', description: 'Xuất hoặc nhập vật liệu, loại tiết diện và tiết diện dưới dạng JSON.',
    export: 'Xuất JSON', exporting: 'Đang xuất…', chooseFile: 'Chọn tệp JSON', import: 'Nhập thư viện', importing: 'Đang nhập…', preparingBackup: 'Đang tạo bản sao…', fileLimit: 'Tệp tối đa 10 MB. Chọn tệp chỉ để xem trước; không tự động nhập.',
    fileSelected: 'Đã chọn', preview: 'Xem trước tệp', importedAt: 'Thời điểm xuất', materials: 'vật liệu', sectionTypes: 'loại tiết diện', sections: 'tiết diện',
    existingCodes: 'Khi trùng mã', skipExisting: 'Bỏ qua mục đã có (mặc định)', overwriteExisting: 'Ghi đè mục cùng mã',
    skipHelp: 'Mục có cùng mã sẽ được giữ nguyên.', overwriteHelp: 'Mục có cùng mã sẽ được cập nhật; mục không có trong tệp sẽ được giữ nguyên.',
    backupNote: 'Trước khi nhập, hệ thống sẽ tải bản sao thư viện hiện tại. Nếu không tạo được bản tải xuống, dữ liệu sẽ không được nhập.',
    scopeNote: 'Tệp chỉ chứa thư viện kỹ thuật; không gồm tài khoản người dùng, dự án hoặc kết quả tính toán.',
    downloadNote: 'Tệp được xử lý bởi trình duyệt. Hãy kiểm tra vị trí tải xuống và lưu bản sao ở nơi an toàn.',
    demoWarning: 'Dữ liệu thư viện demo, gồm mục tham khảo công khai và nội dung bạn thêm, chỉ nằm trong trình duyệt này. Hãy xuất JSON thường xuyên; trình duyệt quản lý tệp tải xuống và không đảm bảo lưu trữ lâu dài.',
    invalidJson: 'Tệp không phải JSON hợp lệ.', invalidFormat: 'Định dạng thư viện không được hỗ trợ.', invalidArrays: 'Tệp phải có các danh sách vật liệu, loại tiết diện và tiết diện.',
    tooLarge: 'Tệp vượt quá giới hạn 10 MB.', unknownDate: 'Không có thời điểm xuất.',
    exportFailed: 'Không thể xuất thư viện. Vui lòng thử lại.', backupFailed: 'Không tải được bản sao hiện tại; thao tác nhập đã bị dừng.',
    importFailed: 'Không thể nhập thư viện. Vui lòng kiểm tra dữ liệu và thử lại.', importForbidden: 'Bạn cần quyền quản trị để nhập thư viện.',
    importConflict: 'Dữ liệu nhập xung đột với thư viện hiện tại.', importValidation: 'Máy chủ từ chối một hoặc nhiều trường trong tệp.',
    errorPaths: 'Đường dẫn trường từ máy chủ', exportSuccess: 'Đã tạo tệp JSON tải xuống.', importSuccess: 'Đã nhập thư viện.',
    created: 'Đã tạo', updated: 'Đã cập nhật', skipped: 'Đã bỏ qua', clearPreview: 'Xóa bản xem trước',
    formatVersion: 'Phiên bản định dạng', section: 'thư viện kỹ thuật',
  },
  en: {
    title: 'Library backup and transfer', description: 'Export or import materials, section types, and sections as JSON.',
    export: 'Export JSON', exporting: 'Exporting…', chooseFile: 'Choose JSON file', import: 'Import library', importing: 'Importing…', preparingBackup: 'Creating backup…', fileLimit: 'Maximum file size is 10 MB. Choosing a file only previews it; nothing is imported automatically.',
    fileSelected: 'Selected', preview: 'File preview', importedAt: 'Exported at', materials: 'materials', sectionTypes: 'section types', sections: 'sections',
    existingCodes: 'When codes match', skipExisting: 'Skip existing records (default)', overwriteExisting: 'Overwrite matching codes',
    skipHelp: 'Records with matching codes are left unchanged.', overwriteHelp: 'Records with matching codes are updated; records missing from the file are preserved.',
    backupNote: 'Before importing, the current library is downloaded as a backup. If the download cannot be created, the import will stop.',
    scopeNote: 'The file contains only the engineering library; it excludes user accounts, projects, and calculation results.',
    downloadNote: 'The browser handles downloads. Check the download location and store a copy safely.',
    demoWarning: 'Demo library data, including public reference entries and your edits, stays in this browser. Export JSON often; downloads are managed by the browser and are not guaranteed to remain stored long term.',
    invalidJson: 'The file is not valid JSON.', invalidFormat: 'The library format is not supported.', invalidArrays: 'The file must contain materials, section types, and sections arrays.',
    tooLarge: 'The file exceeds the 10 MB limit.', unknownDate: 'No export time provided.',
    exportFailed: 'Could not export the library. Please try again.', backupFailed: 'The current backup could not be downloaded, so the import was stopped.',
    importFailed: 'Could not import the library. Check the file and try again.', importForbidden: 'Administrator access is required to import a library.',
    importConflict: 'The imported data conflicts with the current library.', importValidation: 'The server rejected one or more fields in the file.',
    errorPaths: 'Server field paths', exportSuccess: 'The JSON download was started.', importSuccess: 'Library import completed.',
    created: 'Created', updated: 'Updated', skipped: 'Skipped', clearPreview: 'Clear preview',
    formatVersion: 'Format version', section: 'engineering library',
  },
}
const transferT = (key) => transferCopy[props.locale]?.[key] ?? transferCopy.en[key] ?? key

const editForm = reactive({
  id: null, code: '', name_vi: '', name_en: '', category: '', shape: '', design_code: '', region_type: '', source: '',
  section_type_id: '', material_id: '', properties: {},
})
const sectionGeometryMode = ref('symmetric')

const sectionEditorCopy = {
  vi: {
    geometry: 'Hình học tiết diện', geometryHint: 'Sơ đồ dùng kích thước tiết diện theo mm; khi thiếu kích thước, sơ đồ hiển thị theo tỷ lệ minh họa.', geometryTypeHint: 'Sơ đồ minh họa theo loại tiết diện. Nhập kích thước chính xác khi tạo tiết diện.', dimensionsHeader: 'Kích thước hình học', manualProperties: 'Thông số phụ do người dùng nhập',
    engine: 'Section Properties', engineAxes: 'XY · mm', calculating: 'Đang tính…', calculated: 'Đã cập nhật bản xem trước.',
    iGeometryMode: 'Dạng cánh tiết diện I', iSymmetric: 'Đối xứng', iAsymmetric: 'Không đối xứng',
    enterDimensions: 'Nhập đủ kích thước hình học hợp lệ để tự động tính Section Properties.', unsupported: 'Hình dạng này chưa được bộ máy hỗ trợ.',
    result: 'Đặc trưng đã tính', geometric: 'Hình học', elastic: 'Đàn hồi', plastic: 'Dẻo', principal: 'Trục chính', advanced: 'Đặc trưng nâng cao',
    area: 'Diện tích A', perimeter: 'Chu vi P', centroid: 'Trọng tâm', sx: 'Mô đun đàn hồi Sx', sy: 'Mô đun đàn hồi Sy', radii: 'Bán kính quán tính',
    angle: 'Góc trục chính', orientation: 'Trạng thái phương', determinate: 'Xác định', indeterminate: 'Không xác định',
    pnaX: 'Tọa độ PNA x', pnaY: 'Tọa độ PNA y', zx: 'Mô đun dẻo Zx', zy: 'Mô đun dẻo Zy',
    torsion: 'Hằng số xoắn J', warping: 'Hằng số vênh Cw', shearCenter: 'Tâm cắt', effectiveShear: 'Diện tích chịu cắt hữu hiệu',
    computed: 'Đã tính', unavailable: 'Chưa tính', failed: 'Không thể tính đặc trưng với kích thước hiện tại.', status: 'Trạng thái HTTP', errorCode: 'Mã lỗi', errorFields: 'Trường kích thước cần kiểm tra',
    reason_not_requested: 'Chưa yêu cầu', reason_solver_not_implemented: 'Chưa triển khai', reason_convergence_not_achieved: 'Chưa đạt độ chính xác yêu cầu', reason_numerical_precision_limit: 'Giới hạn độ chính xác số', reason_default: 'Không có giá trị với cấu hình hiện tại',
  },
  en: {
    geometry: 'Section geometry', geometryHint: 'The sketch uses section dimensions in mm. Missing dimensions use schematic proportions.', geometryTypeHint: 'Schematic for this section type. Enter exact dimensions when creating a section record.', dimensionsHeader: 'Geometry dimensions', manualProperties: 'User supplied auxiliary inputs',
    engine: 'Section Properties', engineAxes: 'XY · mm', calculating: 'Calculating…', calculated: 'Preview updated.',
    iGeometryMode: 'I-section flange geometry', iSymmetric: 'Symmetric', iAsymmetric: 'Asymmetric',
    enterDimensions: 'Enter complete, valid geometry dimensions to calculate Section Properties automatically.', unsupported: 'This shape is not supported by the calculation engine.',
    result: 'Calculated properties', geometric: 'Geometric', elastic: 'Elastic', plastic: 'Plastic', principal: 'Principal axes', advanced: 'Advanced properties',
    area: 'Area A', perimeter: 'Perimeter P', centroid: 'Centroid', sx: 'Elastic modulus Sx', sy: 'Elastic modulus Sy', radii: 'Radii of gyration',
    angle: 'Major-axis angle', orientation: 'Orientation status', determinate: 'Determinate', indeterminate: 'Indeterminate',
    pnaX: 'PNA coordinate x', pnaY: 'PNA coordinate y', zx: 'Plastic modulus Zx', zy: 'Plastic modulus Zy',
    torsion: 'Torsion constant J', warping: 'Warping constant Cw', shearCenter: 'Shear center', effectiveShear: 'Effective shear area',
    computed: 'Computed', unavailable: 'Not computed', failed: 'Could not calculate properties for these dimensions.', status: 'HTTP status', errorCode: 'Error code', errorFields: 'Dimension fields to review',
    reason_not_requested: 'Not requested', reason_solver_not_implemented: 'Not implemented', reason_convergence_not_achieved: 'Requested tolerance was not met', reason_numerical_precision_limit: 'Numerical precision limit', reason_default: 'No value is available for the current configuration',
  },
}
const sectionEditorT = (key) => sectionEditorCopy[props.locale]?.[key] ?? sectionEditorCopy.en[key] ?? key
const sectionEngineResult = ref(null)
const sectionEngineResultFingerprint = ref('')
const sectionEngineError = ref(null)
const sectionEngineLoading = ref(false)
let sectionEngineSequence = 0

const activeRecords = computed(() => records.value[activeResource.value] ?? [])
const categories = computed(() => schema.value?.categories?.[activeResource.value === 'sections' ? 'section_types' : activeResource.value] ?? [])
const visibleShapes = computed(() => (schema.value?.shapes ?? []).filter((shape) => !categoryFilter.value || shape.category === categoryFilter.value))
const editorShapes = computed(() => (schema.value?.shapes ?? []).filter((shape) => shape.category === editForm.category))
const designCodeOptions = computed(() => {
  const options = schema.value?.design_codes
  return Array.isArray(options) && options.length ? options : ['EN', 'AISC/ACI', 'AS', 'VN'].map((code) => ({ code, name_vi: code, name_en: code }))
})
const regionTypeOptions = computed(() => {
  const candidates = new Map()
  for (const option of schema.value?.region_types ?? []) {
    if (designCodeFilter.value && option.design_code !== designCodeFilter.value) continue
    if (shapeFilter.value && option.shape !== shapeFilter.value) continue
    if (option.code) candidates.set(option.code, option)
  }
  const types = activeResource.value === 'section_types'
    ? records.value.section_types
    : activeResource.value === 'sections'
      ? records.value.section_types.filter((type) => records.value.sections.some((section) => String(section.section_type_id) === String(type.id)))
      : []
  for (const type of types) {
    if (!type.region_type) continue
    if (designCodeFilter.value && type.design_code !== designCodeFilter.value) continue
    if (shapeFilter.value && type.shape !== shapeFilter.value) continue
    if (!candidates.has(type.region_type)) candidates.set(type.region_type, { code: type.region_type, name_vi: type.region_type, name_en: type.region_type })
  }
  return [...candidates.values()].sort((a, b) => String(a.code).localeCompare(String(b.code)))
})
const regionSuggestions = computed(() => {
  const known = (schema.value?.region_types ?? []).filter((item) => {
    if (editForm.design_code && item.design_code !== editForm.design_code) return false
    if (editForm.shape && item.shape !== editForm.shape) return false
    return Boolean(item.code)
  }).map((item) => item.code)
  return [...new Set(known)]
})
const selectedSectionType = computed(() => records.value.section_types.find((row) => String(row.id) === String(editForm.section_type_id)) ?? null)
const compatibleMaterials = computed(() => {
  if (!selectedSectionType.value) return []
  const requiredCategory = selectedSectionType.value.category === 'rc' ? 'concrete' : 'steel'
  return records.value.materials.filter((item) => item.category === requiredCategory)
})
const propertyFields = computed(() => {
  const definitionKey = editorResource.value === 'materials' ? 'materials' : editorResource.value === 'sections' ? 'sections' : null
  if (!definitionKey) return []
  const category = editorResource.value === 'materials' ? editForm.category : selectedSectionType.value?.category
  const shape = selectedSectionType.value?.shape
  return (schema.value?.fields?.[definitionKey] ?? []).filter((field) => {
    if (field.categories?.length && !field.categories.includes(category)) return false
    if (field.shapes?.length && !field.shapes.includes(shape)) return false
    return true
  })
})
const editorSectionShape = computed(() => editorResource.value === 'section_types' ? editForm.shape : selectedSectionType.value?.shape ?? '')
const editorSectionDimensions = computed(() => editorResource.value === 'sections' ? editForm.properties : {})
const sectionAllGeometryKeys = computed(() => new Set(CATALOG_GEOMETRY_KEYS[editorSectionShape.value] ?? []))
const sectionDimensionKeys = computed(() => ({
  i: sectionGeometryMode.value === 'asymmetric'
    ? ['depth', 'top_flange_width', 'bottom_flange_width', 'web_thickness', 'top_flange_thickness', 'bottom_flange_thickness']
    : ['depth', 'width', 'web_thickness', 'flange_thickness'],
  channel: ['depth', 'width', 'web_thickness', 'flange_thickness'],
  angle: ['depth', 'width', 'thickness'],
  tee: ['depth', 'width', 'web_thickness', 'flange_thickness'],
  rectangular_hollow: ['depth', 'width', 'thickness'],
  circular_hollow: ['diameter', 'thickness'],
  rectangle: ['depth', 'width'],
  circle: ['diameter'],
}[editorSectionShape.value] ?? []))
const sectionDimensionFields = computed(() => propertyFields.value.filter((field) => sectionDimensionKeys.value.includes(field.key)))
const sectionManualPropertyFields = computed(() => propertyFields.value.filter((field) => !sectionAllGeometryKeys.value.has(field.key) && field.read_only !== true && !isCatalogDerivedSectionProperty(field.key)))
const sectionDimensionFingerprint = computed(() => JSON.stringify({
  shape: editorSectionShape.value,
  mode: editorSectionShape.value === 'i' ? sectionGeometryMode.value : null,
  dimensions: Object.fromEntries(sectionDimensionKeys.value.map((key) => [key, editForm.properties[key] ?? ''])),
}))
const sectionEngineRequest = computed(() => {
  if (editorResource.value !== 'sections') return null
  return buildCatalogSectionCalculationRequest(editorSectionShape.value, editForm.properties)
})
const sectionEngineCanCalculate = computed(() => Boolean(sectionEngineRequest.value))
const sectionEngineSupportsShape = computed(() => ['rectangle', 'circle', 'i', 'channel', 'tee', 'angle', 'rectangular_hollow', 'circular_hollow'].includes(editorSectionShape.value))
const sectionPreviewReady = computed(() => Boolean(sectionEngineResult.value && sectionEngineResultFingerprint.value === sectionDimensionFingerprint.value && !sectionEngineLoading.value && !sectionEngineError.value))
const canSaveSection = computed(() => editorResource.value !== 'sections' || sectionPreviewReady.value)

function clearSectionEngineResult() {
  if (sectionEngineDebounce !== null) window.clearTimeout(sectionEngineDebounce)
  sectionEngineDebounce = null
  sectionEngineSequence += 1
  sectionEngineResult.value = null
  sectionEngineResultFingerprint.value = ''
  sectionEngineError.value = null
  sectionEngineLoading.value = false
}

watch([editorOpen, editorResource, sectionDimensionFingerprint], () => {
  clearSectionEngineResult()
  if (!editorOpen.value || editorResource.value !== 'sections' || !sectionEngineRequest.value) return
  sectionEngineDebounce = window.setTimeout(() => calculateSectionProperties(), 250)
}, { flush: 'sync' })

function sectionEngineErrorDetails(error) {
  const errorText = `${String(error?.message ?? '')} ${JSON.stringify(error?.errors ?? {})}`
  const fieldAliases = { depth: ['height'] }
  const fields = sectionDimensionFields.value
    .filter((field) => errorText.includes(field.key) || (fieldAliases[field.key] ?? []).some((alias) => errorText.includes(alias)))
    .map((field) => propertyLabel(field))
  const messageCode = String(error?.message ?? '').match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/)?.[0]
  return {
    code: error?.code ?? error?.error_code ?? messageCode ?? null,
    status: typeof error?.status === 'number' ? error.status : null,
    fields: [...new Set(fields)],
  }
}

async function calculateSectionProperties() {
  const payload = sectionEngineRequest.value
  if (!payload) return
  const sequence = ++sectionEngineSequence
  const fingerprint = sectionDimensionFingerprint.value
  sectionEngineLoading.value = true
  sectionEngineResult.value = null
  sectionEngineResultFingerprint.value = ''
  sectionEngineError.value = null
  try {
    const result = await request('/api/v1/sections/calculate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (sequence !== sectionEngineSequence || fingerprint !== sectionDimensionFingerprint.value) return
    sectionEngineResult.value = result?.data ?? result
    sectionEngineResultFingerprint.value = fingerprint
  } catch (error) {
    if (sequence !== sectionEngineSequence || fingerprint !== sectionDimensionFingerprint.value) return
    sectionEngineError.value = sectionEngineErrorDetails(error)
  } finally {
    if (sequence === sectionEngineSequence) sectionEngineLoading.value = false
  }
}

function setISectionGeometryMode(mode) {
  if (!['symmetric', 'asymmetric'].includes(mode) || mode === sectionGeometryMode.value) return
  sectionGeometryMode.value = mode
  const keys = mode === 'symmetric'
    ? ['top_flange_width', 'bottom_flange_width', 'top_flange_thickness', 'bottom_flange_thickness']
    : ['width', 'flange_thickness']
  for (const key of keys) delete editForm.properties[key]
}

const filteredRecords = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return activeRecords.value.filter((record) => {
    const sectionType = records.value.section_types.find((item) => String(item.id) === String(record.section_type_id))
    const category = record.category ?? sectionType?.category ?? ''
    const shape = record.shape ?? sectionType?.shape ?? ''
    const designCode = activeResource.value === 'sections' ? sectionType?.design_code ?? '' : record.design_code ?? ''
    const regionType = activeResource.value === 'section_types' ? record.region_type ?? '' : activeResource.value === 'sections' ? sectionType?.region_type ?? '' : ''
    if (categoryFilter.value && category !== categoryFilter.value) return false
    if (shapeFilter.value && shape !== shapeFilter.value) return false
    if (designCodeFilter.value && designCode !== designCodeFilter.value) return false
    if (regionTypeFilter.value && regionType !== regionTypeFilter.value) return false
    if (!query) return true
    const material = records.value.materials.find((item) => String(item.id) === String(record.material_id))
    const haystack = [record.code, record.name_vi, record.name_en, record.source, shape, category, record.design_code, record.region_type, designCode, regionType, designCodeName(designCode), regionTypeName(regionType), sectionType?.code, sectionType?.name_vi, sectionType?.name_en, material?.name_vi, material?.name_en]
      .filter(Boolean).join(' ').toLocaleLowerCase()
    return haystack.includes(query)
  })
})
const basisText = computed(() => props.locale === 'vi' ? schema.value?.property_basis_vi : schema.value?.property_basis_en)
const validationFieldLabels = computed(() => {
  const fields = [...(schema.value?.fields?.materials ?? []), ...(schema.value?.fields?.sections ?? [])]
  const aliases = {
    code: 'code', name_vi: 'nameVi', name_en: 'nameEn', category: 'category', shape: 'shape',
    source: 'source', section_type_id: 'sectionType', material_id: 'material',
  }
  return validationFieldKeys.value.map((path) => {
    const key = String(path).replace(/\[(.*?)\]/g, '.$1').split('.').filter(Boolean).at(-1) ?? ''
    const descriptor = fields.find((field) => field.key === key)
    if (descriptor) return `${propertyLabel(descriptor)}${descriptor.unit ? ` (${descriptor.unit})` : ''}`
    if (key === 'design_code') return metaT('designCode')
    if (key === 'region_type') return metaT('regionType')
    return aliases[key] ? t(aliases[key]) : t('otherField')
  })
})

function localizedName(record) {
  return props.locale === 'vi' ? record.name_vi || record.name_en || record.code : record.name_en || record.name_vi || record.code
}

function localizedSchemaName(record) {
  const key = props.locale === 'vi' ? 'name_vi' : 'name_en'
  return record?.[key] || record?.name_en || record?.name_vi || record?.code || ''
}

function designCodeName(code) {
  if (!code) return metaT('unclassified')
  const option = designCodeOptions.value.find((item) => item.code === code)
  return option ? localizedSchemaName(option) : code
}

function regionTypeName(code) {
  if (!code) return metaT('unclassified')
  const option = (schema.value?.region_types ?? []).find((item) => item.code === code)
  return option ? localizedSchemaName(option) : code
}

function sectionTypeClassification(type) {
  if (!type) return metaT('unclassified')
  const parts = [type.design_code ? designCodeName(type.design_code) : '', type.region_type ? regionTypeName(type.region_type) : ''].filter(Boolean)
  return parts.join(' · ') || metaT('unclassified')
}

function sectionTypeSelectionLabel(type) {
  return `${type.code} · ${localizedName(type)} · ${sectionTypeClassification(type)}`
}

function categoryName(code) {
  const fromSchema = (schema.value?.categories?.materials ?? []).find((item) => item.code === code)
    ?? (schema.value?.categories?.section_types ?? []).find((item) => item.code === code)
  if (fromSchema) return localizedSchemaName(fromSchema)
  const fallback = { steel: 'categorySteel', concrete: 'categoryConcrete', rebar: 'categoryRebar', rc: 'categoryRc' }
  return fallback[code] ? t(fallback[code]) : code || '—'
}

function shapeName(code) {
  const shape = (schema.value?.shapes ?? []).find((item) => item.code === code)
  return shape ? localizedSchemaName(shape) : code || '—'
}

function propertyLabel(field) {
  return props.locale === 'vi' ? field.label_vi || field.label_en || field.key : field.label_en || field.label_vi || field.key
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object' && 'value' in value) return `${formatValue(value.value)}${value.unit ? ` ${value.unit}` : ''}`
  if (typeof value === 'number') return new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 7 }).format(value)
  return String(value)
}

function recordPropertyFields(record) {
  const resource = activeResource.value === 'materials' ? 'materials' : activeResource.value === 'sections' ? 'sections' : null
  if (!resource) return (schema.value?.fields?.sections ?? []).filter(field => (!field.categories || field.categories.includes(record.category)) && (!field.shapes || field.shapes.includes(record.shape)))
  const type = records.value.section_types.find((item) => String(item.id) === String(record.section_type_id))
  const category = record.category ?? type?.category
  const shape = record.shape ?? type?.shape
  return (schema.value?.fields?.[resource] ?? []).filter((field) => {
    if (field.categories?.length && !field.categories.includes(category)) return false
    if (field.shapes?.length && !field.shapes.includes(shape)) return false
    if (resource === 'sections' && record.section_properties && (field.read_only === true || isCatalogDerivedSectionProperty(field.key))) return false
    return record.properties && record.properties[field.key] !== null && record.properties[field.key] !== undefined
  })
}

function computedLabel(key) {
  const normalized = String(key).toLowerCase()
  if (['g', 'shear_modulus', 'computed_g'].includes(normalized)) return t('computedShearModulus')
  if (['r_y', 'ry', 'gyration_y', 'radius_gyration_y', 'radius_y'].includes(normalized)) return t('computedGyrationY')
  if (['r_z', 'rz', 'gyration_z', 'radius_gyration_z', 'radius_z'].includes(normalized)) return t('computedGyrationZ')
  if (['mass', 'mass_per_length', 'linear_mass'].includes(normalized)) return t('computedMass')
  return key.replaceAll('_', ' ')
}

function computedEntries(record) {
  if (activeResource.value === 'sections' && record.section_properties) return []
  return Object.entries(record.computed ?? {})
}

function formatComputed(key, value) {
  if (value && typeof value === 'object' && value.unit) return formatValue(value)
  const normalized = String(key).toLowerCase()
  const unit = ['g', 'shear_modulus', 'computed_g'].includes(normalized) ? 'MPa'
    : ['r_y', 'ry', 'gyration_y', 'radius_gyration_y', 'radius_y', 'r_z', 'rz', 'gyration_z', 'radius_gyration_z', 'radius_z'].includes(normalized) ? 'mm' : ''
  return `${formatValue(value)}${unit ? ` ${unit}` : ''}`
}

function sectionTypeName(id) {
  const row = records.value.section_types.find((item) => String(item.id) === String(id))
  return row ? localizedName(row) : '—'
}

function materialName(id) {
  const row = records.value.materials.find((item) => String(item.id) === String(id))
  return row ? localizedName(row) : '—'
}

function resetFilters() {
  search.value = ''
  categoryFilter.value = ''
  shapeFilter.value = ''
  designCodeFilter.value = ''
  regionTypeFilter.value = ''
}

async function loadSchema() {
  schemaLoading.value = true
  try {
    schema.value = await request('/api/library/schema')
    schemaError.value = false
  } catch {
    schemaError.value = true
  } finally {
    schemaLoading.value = false
  }
}

async function loadRecords() {
  const resource = activeResource.value
  const requestId = ++listRequestId
  loading.value = true
  errorKey.value = ''
  messageKey.value = ''
  try {
    const needsSectionLookups = resource === 'sections'
    const requests = [request(resourceDefinitions[resource].endpoint)]
    if (needsSectionLookups) requests.push(request('/api/section-types'), request('/api/materials'))
    const [payload, sectionTypePayload, materialPayload] = await Promise.all(requests)
    if (requestId !== listRequestId) return
    const data = payload?.data ?? payload
    records.value[resource] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
    if (sectionTypePayload) {
      const types = sectionTypePayload?.data ?? sectionTypePayload
      records.value.section_types = Array.isArray(types) ? types : Array.isArray(types?.data) ? types.data : []
    }
    if (materialPayload) {
      const materials = materialPayload?.data ?? materialPayload
      records.value.materials = Array.isArray(materials) ? materials : Array.isArray(materials?.data) ? materials.data : []
    }
  } catch (error) {
    if (requestId !== listRequestId) return
    errorKey.value = error?.status === 403 ? 'readOnlyMessage' : 'libraryError'
  } finally {
    if (requestId === listRequestId) loading.value = false
  }
}

function normalizeArchive(payload) {
  return payload?.data ?? payload
}

function archiveIssue(archive) {
  if (!archive || typeof archive !== 'object' || Array.isArray(archive) || archive.format !== 'geekcalculus-engineering-library' || archive.version !== 1) return 'invalidFormat'
  if (!Array.isArray(archive.materials) || !Array.isArray(archive.section_types) || !Array.isArray(archive.sections)) return 'invalidArrays'
  return ''
}

function resetTransferStatus() {
  transferErrorKey.value = ''
  transferErrorPaths.value = []
  transferErrorDetails.value = []
  transferErrorStatus.value = null
  transferMessageKey.value = ''
}

function dateStamp() {
  return new Date().toISOString().slice(0, 19).replaceAll(':', '-')
}

function triggerArchiveDownload(archive, kind) {
  if (!globalThis.URL?.createObjectURL || typeof Blob === 'undefined') throw new Error('Downloads are unavailable')
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `geekcalculus-library-${kind}-${dateStamp()}.json`
  anchor.style.position = 'fixed'
  anchor.style.left = '-10000px'
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
}

function formatTransferDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return transferT('unknownDate')
  return new Intl.DateTimeFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function clearTransferPreview() {
  archivePreview.value = null
  transferResult.value = null
  resetTransferStatus()
  if (fileInput.value) fileInput.value.value = ''
}

async function handleArchiveFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  archivePreview.value = null
  transferResult.value = null
  resetTransferStatus()
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    transferErrorKey.value = 'tooLarge'
    return
  }
  try {
    const parsed = JSON.parse(await file.text())
    const archive = normalizeArchive(parsed)
    const issue = archiveIssue(archive)
    if (issue) {
      transferErrorKey.value = issue
      return
    }
    archivePreview.value = {
      archive,
      fileName: file.name,
      exportedAt: archive.exported_at ?? '',
      counts: {
        materials: archive.materials.length,
        section_types: archive.section_types.length,
        sections: archive.sections.length,
      },
    }
  } catch {
    transferErrorKey.value = 'invalidJson'
  }
}

async function exportLibrary() {
  if (!props.canEdit || transferBusy.value) return
  transferBusy.value = true
  transferPhase.value = 'export'
  resetTransferStatus()
  transferResult.value = null
  try {
    const archive = normalizeArchive(await request('/api/library/export'))
    if (archiveIssue(archive)) throw new Error('Invalid export response')
    triggerArchiveDownload(archive, 'export')
    transferMessageKey.value = 'exportSuccess'
  } catch {
    transferErrorKey.value = 'exportFailed'
  } finally {
    transferBusy.value = false
    transferPhase.value = ''
  }
}

function importErrorKey(error) {
  transferErrorPaths.value = Object.keys(error?.errors ?? {})
  transferErrorStatus.value = Number(error?.status) || null
  const details = []
  for (const [path, messages] of Object.entries(error?.errors ?? {})) {
    for (const message of Array.isArray(messages) ? messages : [messages]) {
      const detail = typeof message === 'string' ? message : JSON.stringify(message)
      if (detail) details.push({ path, message: detail.slice(0, 500) })
    }
  }
  if (typeof error?.message === 'string' && error.message && !/^HTTP \d+$/.test(error.message)) {
    details.unshift({ path: '', message: error.message.slice(0, 500) })
  }
  transferErrorDetails.value = details.slice(0, 12)
  if (error?.status === 403 || error?.status === 401) return 'importForbidden'
  if (error?.status === 409) return 'importConflict'
  if (error?.status === 422) return 'importValidation'
  return 'importFailed'
}

async function refreshAllRecords() {
  const requestId = ++listRequestId
  loading.value = true
  errorKey.value = ''
  try {
    const [materialPayload, typePayload, sectionPayload] = await Promise.all([
      request('/api/materials'), request('/api/section-types'), request('/api/sections'),
    ])
    if (requestId !== listRequestId) return
    const rows = (payload) => {
      const data = payload?.data ?? payload
      return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
    }
    records.value = {
      materials: rows(materialPayload),
      section_types: rows(typePayload),
      sections: rows(sectionPayload),
    }
  } catch (error) {
    if (requestId !== listRequestId) return
    errorKey.value = error?.status === 403 ? 'readOnlyMessage' : 'libraryError'
  } finally {
    if (requestId === listRequestId) loading.value = false
  }
}

async function importLibrary() {
  if (!props.canEdit || !archivePreview.value || transferBusy.value) return
  transferBusy.value = true
  transferPhase.value = 'backup'
  resetTransferStatus()
  transferResult.value = null
  try {
    const backup = normalizeArchive(await request('/api/library/export'))
    if (archiveIssue(backup)) throw new Error('Invalid backup response')
    triggerArchiveDownload(backup, 'backup')
  } catch {
    transferErrorKey.value = 'backupFailed'
    transferBusy.value = false
    transferPhase.value = ''
    return
  }

  transferPhase.value = 'import'
  try {
    const payload = await request('/api/library/import', {
      method: 'POST',
      body: JSON.stringify({ archive: archivePreview.value.archive, mode: importMode.value }),
    })
    const result = payload?.data ?? payload
    transferResult.value = {
      created: Number(result?.created ?? 0),
      updated: Number(result?.updated ?? 0),
      skipped: Number(result?.skipped ?? 0),
    }
    await refreshAllRecords()
    archivePreview.value = null
    if (fileInput.value) fileInput.value.value = ''
  } catch (error) {
    transferErrorKey.value = importErrorKey(error)
  } finally {
    transferBusy.value = false
    transferPhase.value = ''
  }
}

function setResource(resource) {
  if (!resourceKeys.includes(resource) || resource === activeResource.value) return
  activeResource.value = resource
  resetFilters()
}

function nextCopyCode(code) {
  const codes = new Set(records.value[activeResource.value].map((row) => row.code))
  for (let index = 1; ; index++) {
    const suffix = index === 1 ? '_copy' : `_copy_${index}`
    const candidate = `${code.slice(0, 64 - suffix.length)}${suffix}`
    if (!codes.has(candidate)) return candidate
  }
}

function openEditor(record = null, mode = record ? 'edit' : 'create') {
  if (!props.canEdit) return
  clearSectionEngineResult()
  errorKey.value = ''
  validationFieldKeys.value = []
  messageKey.value = ''
  editorResource.value = activeResource.value
  editorMode.value = mode
  copySourceCode.value = mode === 'copy' ? record.code : ''
  const firstCategory = schema.value?.categories?.[activeResource.value]?.[0]?.code ?? ''
  const category = record?.category ?? firstCategory
  const shapesForCategory = (schema.value?.shapes ?? []).filter((shape) => shape.category === category)
  const shape = record?.shape ?? shapesForCategory[0]?.code ?? ''
  Object.assign(editForm, {
    id: mode === 'edit' ? record?.id ?? null : null,
    code: mode === 'copy' ? nextCopyCode(record.code) : record?.code ?? '',
    name_vi: record?.name_vi ?? '',
    name_en: record?.name_en ?? '',
    category,
    shape,
    design_code: record?.design_code ?? '',
    region_type: record?.region_type ?? '',
    source: record?.source ?? '',
    section_type_id: record?.section_type_id ?? '',
    material_id: record?.material_id ?? '',
    properties: { ...(record?.properties ?? {}) },
  })
  sectionGeometryMode.value = catalogGeometryMode(editorSectionShape.value, editForm.properties) ?? 'symmetric'
  editorOpen.value = true
}

function updateEditorCategory() {
  const shapes = (schema.value?.shapes ?? []).filter((shape) => shape.category === editForm.category)
  if (!shapes.some((shape) => shape.code === editForm.shape)) editForm.shape = shapes[0]?.code ?? ''
}

function sectionDimensionRequired(field) {
  return sectionDimensionKeys.value.includes(field.key)
}

function makePayload() {
  const payload = { code: editForm.code.trim(), name_vi: editForm.name_vi.trim(), name_en: editForm.name_en.trim() }
  if (editorResource.value === 'materials') {
    payload.category = editForm.category
    payload.design_code = editForm.design_code || null
    payload.source = editForm.source.trim()
  } else if (editorResource.value === 'section_types') {
    payload.category = editForm.category
    payload.shape = editForm.shape
    payload.design_code = editForm.design_code || null
    payload.region_type = editForm.region_type.trim() || null
  } else {
    payload.section_type_id = editForm.section_type_id
    payload.material_id = editForm.material_id
    payload.source = editForm.source.trim()
    payload.properties = catalogSectionInputProperties(editorSectionShape.value, editForm.properties, propertyFields.value)
  }
  if (editorResource.value === 'materials') {
    payload.properties = Object.fromEntries(propertyFields.value
      .map((field) => [field.key, editForm.properties[field.key]])
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => [key, Number(value)]))
  }
  return payload
}

function operationErrorKey(error) {
  validationFieldKeys.value = error?.status === 422 ? Object.keys(error.errors ?? {}) : []
  if (error?.status === 403) return 'readOnlyMessage'
  if (error?.status === 409) return 'resourceConflict'
  if (error?.status === 422) return 'validationError'
  return 'operationError'
}

async function saveRecord() {
  if (editorResource.value === 'sections' && !sectionPreviewReady.value) return
  saving.value = true
  errorKey.value = ''
  validationFieldKeys.value = []
  messageKey.value = ''
  const resource = editorResource.value
  const endpoint = resourceDefinitions[resource].endpoint
  const isEdit = editorMode.value === 'edit'
  const path = isEdit ? `${endpoint}/${encodeURIComponent(editForm.id)}` : endpoint
  try {
    await request(path, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(makePayload()) })
    editorOpen.value = false
    await loadRecords()
    if (!errorKey.value) messageKey.value = isEdit ? 'updateSuccess' : 'createSuccess'
  } catch (error) {
    errorKey.value = operationErrorKey(error)
  } finally {
    saving.value = false
  }
}

async function deleteRecord(record) {
  if (!props.canEdit || deletingId.value !== null) return
  const confirmed = window.confirm(`${t('deleteConfirmTitle')}\n${t('deleteConfirmBody')}`)
  if (!confirmed) return
  deletingId.value = record.id
  errorKey.value = ''
  validationFieldKeys.value = []
  messageKey.value = ''
  try {
    await request(`${resourceDefinitions[activeResource.value].endpoint}/${encodeURIComponent(record.id)}`, { method: 'DELETE' })
    await loadRecords()
    if (!errorKey.value) messageKey.value = 'deleteSuccess'
  } catch (error) {
    errorKey.value = operationErrorKey(error)
  } finally {
    deletingId.value = null
  }
}

watch(selectedSectionType, (type) => {
  if (!type) return
  const selectedMaterial = records.value.materials.find((item) => String(item.id) === String(editForm.material_id))
  const requiredCategory = type.category === 'rc' ? 'concrete' : 'steel'
  if (selectedMaterial && selectedMaterial.category !== requiredCategory) editForm.material_id = ''
})

watch([designCodeFilter, shapeFilter], () => {
  if (regionTypeFilter.value && !regionTypeOptions.value.some((item) => item.code === regionTypeFilter.value)) regionTypeFilter.value = ''
})

watch(activeResource, () => loadRecords())

onMounted(async () => {
  await Promise.all([loadSchema(), loadRecords()])
})
onBeforeUnmount(clearSectionEngineResult)
</script>

<template>
  <section class="library-browser" :aria-label="t('databaseTitle')">
    <div class="library-toolbar">
      <div class="library-tabs" role="tablist" :aria-label="t('databaseTitle')">
        <button v-for="resource in resourceKeys" :key="resource" type="button" role="tab" :aria-selected="activeResource === resource" :class="{ active: activeResource === resource }" @click="setResource(resource)">{{ t(resource === 'section_types' ? 'sectionTypes' : resource) }}</button>
      </div>
      <button v-if="canEdit" type="button" class="primary-button library-add-button" :disabled="schemaLoading || schemaError || (activeResource === 'sections' && (!records.section_types.length || !records.materials.length))" @click="openEditor()">＋ {{ t(resourceDefinitions[activeResource].addKey) }}</button>
      <span v-else class="read-only-badge"><span></span>{{ t('libraryReadOnly') }}</span>
    </div>

    <section v-if="canEdit" class="library-transfer" :aria-labelledby="`${transferId}-title`">
      <header class="library-transfer-header">
        <div><h3 :id="`${transferId}-title`">{{ transferT('title') }}</h3><p>{{ transferT('description') }}</p></div>
        <button type="button" class="primary-button library-transfer-export" :disabled="transferBusy" @click="exportLibrary">
          {{ transferBusy && transferPhase === 'export' ? transferT('exporting') : transferT('export') }}
        </button>
      </header>
      <div class="library-transfer-controls">
        <div class="library-transfer-file-control">
          <input ref="fileInput" class="sr-only" type="file" :aria-label="transferT('chooseFile')" accept="application/json,.json" :disabled="transferBusy" @change="handleArchiveFile" />
          <button type="button" class="quiet-button library-transfer-choose" :disabled="transferBusy" @click="fileInput?.click()">{{ transferT('chooseFile') }}</button>
          <span v-if="archivePreview" class="library-transfer-filename">{{ transferT('fileSelected') }}: {{ archivePreview.fileName }}</span>
          <small>{{ transferT('fileLimit') }}</small>
        </div>
        <label class="library-transfer-mode">
          <span>{{ transferT('existingCodes') }}</span>
          <select v-model="importMode" :disabled="transferBusy" :aria-describedby="`${transferId}-mode-help`">
            <option value="skip">{{ transferT('skipExisting') }}</option>
            <option value="overwrite">{{ transferT('overwriteExisting') }}</option>
          </select>
        </label>
        <button type="button" class="primary-button library-transfer-import" :disabled="transferBusy || !archivePreview" @click="importLibrary">
          {{ transferBusy && transferPhase === 'backup' ? transferT('preparingBackup') : transferBusy && transferPhase === 'import' ? transferT('importing') : transferT('import') }}
        </button>
      </div>
      <p :id="`${transferId}-mode-help`" class="library-transfer-mode-help">{{ importMode === 'overwrite' ? transferT('overwriteHelp') : transferT('skipHelp') }}</p>
      <p class="library-transfer-backup-note">{{ transferT('backupNote') }}</p>
      <p class="library-transfer-download-note">{{ transferT('downloadNote') }}</p>
      <p class="library-transfer-download-note">{{ transferT('scopeNote') }}</p>
      <p v-if="demoMode" class="library-transfer-demo" role="note">{{ transferT('demoWarning') }}</p>

      <div v-if="archivePreview" class="library-transfer-preview" aria-live="polite">
        <div class="library-transfer-preview-heading"><strong>{{ transferT('preview') }}</strong><button type="button" class="quiet-button" :disabled="transferBusy" @click="clearTransferPreview">{{ transferT('clearPreview') }}</button></div>
        <p class="library-transfer-preview-file">{{ archivePreview.fileName }} · {{ transferT('formatVersion') }} 1 · {{ transferT('importedAt') }}: {{ formatTransferDate(archivePreview.exportedAt) }}</p>
        <ul class="library-transfer-counts"><li>{{ archivePreview.counts.materials }} {{ transferT('materials') }}</li><li>{{ archivePreview.counts.section_types }} {{ transferT('sectionTypes') }}</li><li>{{ archivePreview.counts.sections }} {{ transferT('sections') }}</li></ul>
      </div>
      <div v-if="transferErrorKey" class="library-transfer-message library-transfer-error" role="alert">
        <p>{{ transferT(transferErrorKey) }}<span v-if="transferErrorStatus"> · HTTP {{ transferErrorStatus }}</span></p>
        <template v-if="transferErrorPaths.length"><strong>{{ transferT('errorPaths') }}</strong><ul v-if="transferErrorDetails.length"><li v-for="(detail, index) in transferErrorDetails" :key="`${detail.path}-${index}`"><code v-if="detail.path">{{ detail.path }}</code><span v-if="detail.path"> — </span>{{ detail.message }}</li></ul><ul v-else><li v-for="path in transferErrorPaths" :key="path"><code>{{ path }}</code></li></ul></template>
        <ul v-else-if="transferErrorDetails.length"><li v-for="(detail, index) in transferErrorDetails" :key="index">{{ detail.message }}</li></ul>
      </div>
      <div v-if="transferMessageKey" class="library-transfer-message library-transfer-success" role="status">{{ transferT(transferMessageKey) }}</div>
      <div v-if="transferResult" class="library-transfer-result" role="status">
        <strong>{{ transferT('importSuccess') }}</strong>
        <dl><div><dt>{{ transferT('created') }}</dt><dd>{{ transferResult.created }}</dd></div><div><dt>{{ transferT('updated') }}</dt><dd>{{ transferResult.updated }}</dd></div><div><dt>{{ transferT('skipped') }}</dt><dd>{{ transferResult.skipped }}</dd></div></dl>
      </div>
    </section>

    <div class="library-filters">
      <label class="library-search"><span class="sr-only">{{ t('search') }}</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg><input v-model="search" type="search" :placeholder="t('searchPlaceholder')" /></label>
      <label class="filter-select"><span>{{ t('category') }}</span><select v-model="categoryFilter"><option value="">{{ t('allCategories') }}</option><option v-for="item in categories" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
      <label v-if="activeResource !== 'materials'" class="filter-select"><span>{{ t('shape') }}</span><select v-model="shapeFilter"><option value="">{{ t('allShapes') }}</option><option v-for="item in visibleShapes" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
      <label class="filter-select"><span>{{ metaT('designCode') }}</span><DesignCodeSelect v-model="designCodeFilter" :options="designCodeOptions" :locale="locale" :placeholder="metaT('allDesignCodes')" /></label>
      <label v-if="activeResource !== 'materials'" class="filter-select"><span>{{ metaT('regionType') }}</span><select v-model="regionTypeFilter"><option value="">{{ metaT('allRegionTypes') }}</option><option v-for="item in regionTypeOptions" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
    </div>

    <div v-if="basisText" class="library-basis"><span>i</span>{{ basisText }}</div>
    <p v-if="schema" class="library-caveat">{{ t('libraryCaveat') }}</p>
    <p v-if="!canEdit" class="read-only-hint">{{ t('libraryReadOnlyHint') }}</p>
    <p v-if="schemaError" class="library-message error-message" role="alert">{{ t('schemaError') }} <button type="button" class="inline-retry" @click="loadSchema">{{ t('retry') }}</button></p>
    <div v-if="errorKey && !editorOpen" class="library-message error-message" role="alert"><p>{{ t(errorKey) }} <button v-if="errorKey === 'libraryError'" type="button" class="inline-retry" @click="loadRecords">{{ t('retry') }}</button></p><ul v-if="validationFieldLabels.length"><li v-for="(label, index) in validationFieldLabels" :key="`${label}-${index}`">{{ label }}</li></ul></div>
    <p v-else-if="messageKey" class="library-message success-message" role="status">{{ t(messageKey) }}</p>

    <div v-if="schemaLoading || loading" class="library-empty" role="status"><span class="auth-spinner"></span>{{ t('loadingLibrary') }}</div>
    <div v-else-if="!filteredRecords.length" class="library-empty"><strong>{{ t('noRecords') }}</strong></div>
    <div v-else class="library-table-wrap">
      <table class="library-table">
        <thead><tr><th>{{ t('code') }}</th><th>{{ t('nameVi') }}</th><th>{{ t('nameEn') }}</th><th v-if="activeResource === 'materials'">{{ t('category') }}</th><th v-if="activeResource === 'materials' || activeResource === 'section_types'">{{ metaT('designCode') }}</th><th v-if="activeResource === 'section_types'">{{ metaT('regionType') }}</th><th v-if="activeResource === 'section_types'">{{ t('category') }}</th><th v-if="activeResource !== 'materials'">{{ t('shape') }}</th><th v-if="activeResource === 'sections'">{{ t('sectionType') }} / {{ t('material') }}</th><th>{{ t('properties') }}</th><th v-if="canEdit">{{ t('actions') }}</th></tr></thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.id">
            <td class="library-code">{{ record.code }}</td>
            <td>{{ record.name_vi }}</td>
            <td>{{ record.name_en }}</td>
            <td v-if="activeResource === 'materials'">{{ categoryName(record.category) }}</td>
            <td v-if="activeResource === 'materials' || activeResource === 'section_types'"><span class="library-design-code-cell"><DesignCodeIcon v-if="record.design_code" :code="record.design_code" aria-hidden="true" /><span>{{ designCodeName(record.design_code) }}</span></span></td>
            <td v-if="activeResource === 'section_types'">{{ regionTypeName(record.region_type) }}</td>
            <td v-if="activeResource === 'section_types'">{{ categoryName(record.category) }}</td>
            <td v-if="activeResource !== 'materials'">{{ shapeName(record.shape ?? records.section_types.find((item) => String(item.id) === String(record.section_type_id))?.shape) }}</td>
            <td v-if="activeResource === 'sections'" class="library-related">{{ sectionTypeName(record.section_type_id) }}<small>{{ sectionTypeClassification(records.section_types.find((item) => String(item.id) === String(record.section_type_id))) }}</small><small>{{ materialName(record.material_id) }}</small></td>
            <td>
              <details v-if="recordPropertyFields(record).length || computedEntries(record).length || record.section_properties" class="property-details">
                <summary>{{ t('properties') }} · {{ recordPropertyFields(record).length + computedEntries(record).length + (record.section_properties ? 1 : 0) }}</summary>
                <dl><div v-for="field in recordPropertyFields(record)" :key="field.key"><dt>{{ propertyLabel(field) }}<small v-if="field.unit">{{ field.unit }}</small></dt><dd>{{ activeResource === 'section_types' ? (field.required ? '*' : '—') : formatValue(record.properties?.[field.key]) }}</dd></div></dl>
                <div v-if="computedEntries(record).length" class="computed-details"><strong>{{ t('computedProperties') }}</strong><dl><div v-for="[key, value] in computedEntries(record)" :key="key"><dt>{{ computedLabel(key) }}</dt><dd>{{ formatComputed(key, value) }}</dd></div></dl></div>
                <SectionCalculatedProperties v-if="activeResource === 'sections' && record.section_properties" :result="record.section_properties" :calculated-at="record.section_properties_calculated_at" :locale="locale" />
                <p v-if="record.source" class="property-source"><strong>{{ t('source') }}:</strong> {{ record.source }}</p>
              </details>
              <span v-else>—</span>
            </td>
            <td v-if="canEdit" class="library-actions"><button type="button" class="quiet-button" @click="openEditor(record)">{{ t('editRecord') }}</button><button type="button" class="quiet-button" :disabled="schemaLoading || schemaError || deletingId === record.id" @click="openEditor(record, 'copy')">{{ t('copyRecord') }}</button><button type="button" class="quiet-button danger-button" :disabled="deletingId === record.id" @click="deleteRecord(record)">{{ t('deleteRecord') }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editorOpen" class="editor-backdrop" @click.self="editorOpen = false">
      <section class="library-editor" role="dialog" aria-modal="true" :aria-label="t(editorMode === 'copy' ? 'copyRecordTitle' : editorMode === 'edit' ? 'editRecord' : resourceDefinitions[editorResource].addKey)">
        <header class="editor-heading"><div><span class="auth-eyebrow">{{ t('databaseTitle') }}</span><h2>{{ t(editorMode === 'copy' ? 'copyRecordTitle' : editorMode === 'edit' ? 'editRecord' : resourceDefinitions[editorResource].addKey) }}</h2></div><button type="button" class="quiet-button editor-close" :aria-label="t('cancel')" @click="editorOpen = false">×</button></header>
        <p v-if="editorMode === 'copy'" class="library-copy-hint">{{ t('copyFrom') }} <strong>{{ copySourceCode }}</strong>. {{ t('copyRecordHint') }}</p>
        <form class="editor-form" @submit.prevent="saveRecord">
          <label class="field"><span>{{ t('code') }}<b>*</b></span><input v-model.trim="editForm.code" required maxlength="64" autocomplete="off" /></label>
          <label class="field"><span>{{ t('nameVi') }}<b>*</b></span><input v-model.trim="editForm.name_vi" required maxlength="255" /></label>
          <label class="field"><span>{{ t('nameEn') }}<b>*</b></span><input v-model.trim="editForm.name_en" required maxlength="255" /></label>

          <template v-if="editorResource === 'materials'">
            <label class="field"><span>{{ t('materialCategory') }}<b>*</b></span><select v-model="editForm.category" required><option v-for="item in schema?.categories?.materials ?? []" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
            <label class="field"><span>{{ metaT('designCode') }}</span><DesignCodeSelect v-model="editForm.design_code" :options="designCodeOptions" :locale="locale" :placeholder="metaT('unclassified')" /></label>
            <label class="field full-field"><span>{{ t('source') }}</span><input v-model.trim="editForm.source" maxlength="2000" :placeholder="t('sourcePlaceholder')" /><small class="field-hint">{{ t('sourceHelp') }}</small></label>
          </template>
          <template v-else-if="editorResource === 'section_types'">
            <label class="field"><span>{{ t('sectionCategory') }}<b>*</b></span><select v-model="editForm.category" required @change="updateEditorCategory"><option v-for="item in schema?.categories?.section_types ?? []" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
            <label class="field"><span>{{ t('shape') }}<b>*</b></span><select v-model="editForm.shape" required><option v-for="item in editorShapes" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
            <label class="field"><span>{{ metaT('designCode') }}</span><DesignCodeSelect v-model="editForm.design_code" :options="designCodeOptions" :locale="locale" :placeholder="metaT('unclassified')" /></label>
            <label class="field"><span>{{ metaT('regionType') }}</span><input v-model.trim="editForm.region_type" maxlength="64" :list="regionDatalistId" autocomplete="off" /><datalist :id="regionDatalistId"><option v-for="value in regionSuggestions" :key="value" :value="value" /></datalist><small class="field-hint">{{ metaT('regionTypeHint') }}</small></label>
          </template>
          <template v-else>
            <label class="field"><span>{{ t('sectionType') }}<b>*</b></span><select v-model="editForm.section_type_id" required><option value="">{{ t('selectOption') }}</option><option v-for="item in records.section_types" :key="item.id" :value="item.id">{{ sectionTypeSelectionLabel(item) }}</option></select></label>
            <label class="field"><span>{{ t('material') }}<b>*</b></span><select v-model="editForm.material_id" required><option value="">{{ t('selectOption') }}</option><option v-for="item in compatibleMaterials" :key="item.id" :value="item.id">{{ item.code }} · {{ localizedName(item) }}</option></select></label>
            <label class="field full-field"><span>{{ t('source') }}</span><input v-model.trim="editForm.source" maxlength="2000" :placeholder="t('sourcePlaceholder')" /><small class="field-hint">{{ t('sourceHelp') }}</small></label>
          </template>

          <div v-if="editorResource === 'materials'" class="property-editor full-field">
            <div class="property-editor-heading"><h3>{{ t('engineeringProperties') }}</h3><span>{{ t('basisUnits') }}</span></div>
            <div v-if="propertyFields.length" class="editor-form-grid">
              <label v-for="field in propertyFields" :key="field.key" class="field">
                <span>{{ propertyLabel(field) }} <small v-if="field.unit">{{ field.unit }}</small><b v-if="field.required">*</b></span>
                <input v-model="editForm.properties[field.key]" :name="`property-${field.key}`" type="number" inputmode="decimal" step="any" :min="field.min" :max="field.max" :required="field.required" />
              </label>
            </div>
            <p v-else class="property-placeholder">{{ t('noProperties') }}</p>
          </div>

          <div v-else-if="editorResource === 'sections'" class="property-editor full-field">
            <div class="property-editor-heading"><h3>{{ sectionEditorT('dimensionsHeader') }}</h3><span>XY · mm</span></div>
            <div v-if="!selectedSectionType" class="property-placeholder">{{ t('selectSectionTypeFirst') }}</div>
            <div v-else-if="sectionDimensionFields.length" class="editor-form-grid">
              <div v-if="editorSectionShape === 'i'" class="section-geometry-mode full-field" role="group" :aria-label="sectionEditorT('iGeometryMode')">
                <span>{{ sectionEditorT('iGeometryMode') }}</span>
                <button type="button" :aria-pressed="sectionGeometryMode === 'symmetric'" @click="setISectionGeometryMode('symmetric')">{{ sectionEditorT('iSymmetric') }}</button>
                <button type="button" :aria-pressed="sectionGeometryMode === 'asymmetric'" @click="setISectionGeometryMode('asymmetric')">{{ sectionEditorT('iAsymmetric') }}</button>
              </div>
              <label v-for="field in sectionDimensionFields" :key="field.key" class="field">
                <span>{{ propertyLabel(field) }} <small v-if="field.unit">{{ field.unit }}</small><b v-if="sectionDimensionRequired(field)">*</b></span>
                <input v-model="editForm.properties[field.key]" :name="`property-${field.key}`" type="number" inputmode="decimal" step="any" :min="field.min" :max="field.max" :required="sectionDimensionRequired(field)" />
              </label>
            </div>
            <p v-else class="property-placeholder">{{ t('noProperties') }}</p>
          </div>

          <section v-if="editorSectionShape" class="section-geometry-editor full-field" :aria-label="sectionEditorT('geometry')">
            <header class="section-geometry-editor-heading">
              <div><h3>{{ sectionEditorT('geometry') }}</h3><p>{{ sectionEditorT('geometryHint') }}</p></div>
              <span>XY · mm</span>
            </header>
            <div class="section-geometry-editor-body">
              <SectionGeometrySketch :shape="editorSectionShape" :dimensions="editorSectionDimensions" :locale="locale" />
              <div v-if="editorResource === 'sections' && sectionEngineSupportsShape" class="section-engine-controls">
                <div class="section-engine-controls-heading"><h4>{{ sectionEditorT('engine') }}</h4><span>{{ sectionEditorT('engineAxes') }}</span></div>
                <p v-if="sectionEngineLoading" class="section-engine-status" role="status"><span class="section-engine-spinner" aria-hidden="true"></span>{{ sectionEditorT('calculating') }}</p>
                <p v-else-if="sectionPreviewReady" class="section-engine-status" role="status">{{ sectionEditorT('calculated') }}</p>
                <p v-if="!sectionEngineCanCalculate" class="section-engine-dimensions-hint">{{ sectionEditorT('enterDimensions') }}</p>
                <p v-if="sectionEngineError" class="section-engine-error" role="alert">
                  {{ sectionEditorT('failed') }}
                  <span v-if="sectionEngineError.code"> {{ sectionEditorT('errorCode') }}: {{ sectionEngineError.code }}</span>
                  <span v-if="sectionEngineError.status"> {{ sectionEditorT('status') }}: {{ sectionEngineError.status }}</span>
                  <span v-if="sectionEngineError.fields.length"><br /><strong>{{ sectionEditorT('errorFields') }}:</strong> {{ sectionEngineError.fields.join(', ') }}</span>
                </p>
              </div>
              <p v-else-if="editorResource === 'sections'" class="section-engine-unsupported">{{ sectionEditorT('unsupported') }}</p>
              <p v-else class="section-engine-unsupported">{{ sectionEditorT('geometryTypeHint') }}</p>
            </div>

            <SectionCalculatedProperties v-if="sectionEngineResult" :result="sectionEngineResult" :locale="locale" />
          </section>

          <div v-if="editorResource === 'sections' && selectedSectionType" class="property-editor full-field">
            <div class="property-editor-heading"><h3>{{ sectionEditorT('manualProperties') }}</h3><span>{{ t('basisUnits') }}</span></div>
            <div v-if="sectionManualPropertyFields.length" class="editor-form-grid">
              <label v-for="field in sectionManualPropertyFields" :key="field.key" class="field">
                <span>{{ propertyLabel(field) }} <small v-if="field.unit">{{ field.unit }}</small><b v-if="field.required">*</b></span>
                <input v-model="editForm.properties[field.key]" :name="`property-${field.key}`" type="number" inputmode="decimal" step="any" :min="field.min" :max="field.max" :required="field.required" />
              </label>
            </div>
            <p v-else class="property-placeholder">{{ t('noProperties') }}</p>
          </div>

          <div v-if="errorKey" class="error-message full-field" role="alert"><p>{{ t(errorKey) }}</p><ul v-if="validationFieldLabels.length"><li v-for="(label, index) in validationFieldLabels" :key="`${label}-${index}`">{{ label }}</li></ul></div>
          <footer class="editor-actions full-field"><button type="button" class="quiet-button" @click="editorOpen = false">{{ t('cancel') }}</button><button type="submit" class="primary-button" :disabled="saving || (editorResource === 'sections' && (!selectedSectionType || !canSaveSection))">{{ saving ? t('saving') : t(editorMode === 'edit' ? 'saveChanges' : 'createRecord') }}</button></footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.library-browser .library-filters { flex-wrap: wrap; }
.library-browser .library-search { flex: 2 1 230px; }
.library-browser .filter-select { flex: 1 1 138px; }
.library-design-code-cell { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.library-copy-hint { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--surface-border); border-radius: 7px; background: var(--soft-bg); color: var(--muted-ink); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.library-transfer { margin: 14px 0 18px; padding: 16px; border: 1px solid var(--surface-border); border-radius: 11px; background: linear-gradient(145deg, var(--surface-bg), var(--soft-bg)); }
.library-transfer-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.library-transfer-header h3 { margin: 0; color: #294968; font-size: 16px; font-weight: 700; }
.library-transfer-header p { margin: 5px 0 0; color: var(--muted-ink); font-size: 14px; line-height: 1.5; }
.library-transfer-export, .library-transfer-import, .library-transfer-choose { min-height: 35px; padding: 8px 12px; font-size: 14px; }
.library-transfer-controls { display: grid; grid-template-columns: minmax(220px, 1.3fr) minmax(180px, 1fr) auto; align-items: end; gap: 12px; margin-top: 14px; }
.library-transfer-file-control { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 9px; min-width: 0; }
.library-transfer-choose { border: 1px solid var(--surface-border); background: var(--surface-bg); }
.library-transfer-file-control small { flex: 1 1 100%; color: var(--muted-ink); font-size: 13px; line-height: 1.45; }
.library-transfer-filename { min-width: 0; overflow: hidden; color: #557692; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.library-transfer-mode { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: #5a738b; font-size: 14px; font-weight: 650; }
.library-transfer-mode select { width: 100%; min-height: 35px; padding: 7px 9px; border: 1px solid var(--surface-border); border-radius: 7px; background: var(--workspace-bg); color: #304b65; font-size: 14px; }
.library-transfer-mode select:focus-visible, .library-transfer button:focus-visible { outline: 3px solid #a8c7e2; outline-offset: 2px; }
.library-transfer-mode-help, .library-transfer-backup-note, .library-transfer-download-note, .library-transfer-demo { margin: 9px 0 0; color: var(--muted-ink); font-size: 13px; line-height: 1.55; }
.library-transfer-backup-note { padding: 8px 10px; border-radius: 7px; background: var(--soft-bg); color: #5c7791; }
.library-transfer-download-note { color: var(--muted-ink); }
.library-transfer-demo { padding: 8px 10px; border: 1px solid #ecd9b8; border-radius: 7px; background: #fff9ef; color: #826742; }
.library-transfer-preview { margin-top: 12px; padding: 11px 12px; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--surface-bg); }
.library-transfer-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #456887; font-size: 14px; }
.library-transfer-preview-heading .quiet-button { padding: 4px 6px; font-size: 13px; }
.library-transfer-preview-file { margin: 4px 0 0; color: var(--muted-ink); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.library-transfer-counts { display: flex; flex-wrap: wrap; gap: 7px; margin: 8px 0 0; padding: 0; list-style: none; }
.library-transfer-counts li { padding: 5px 7px; border-radius: 6px; background: var(--soft-bg); color: #53728e; font-size: 13px; font-weight: 600; }
.library-transfer-message { margin-top: 10px; padding: 9px 11px; border-radius: 7px; font-size: 14px; line-height: 1.5; }
.library-transfer-message p { margin: 0; }
.library-transfer-error { border: 1px solid #efcfd1; background: #fff7f7; color: #984e52; }
.library-transfer-error strong { display: block; margin-top: 7px; font-size: 13px; }
.library-transfer-error ul { display: grid; gap: 3px; margin: 5px 0 0; padding-left: 18px; }
.library-transfer-error code { color: #814448; font-size: 13px; overflow-wrap: anywhere; }
.library-transfer-success, .library-transfer-result { border: 1px solid #cfe7d9; background: #f5fcf7; color: #3f7856; }
.library-transfer-result { margin-top: 10px; padding: 10px 12px; border: 1px solid #cfe7d9; border-radius: 7px; font-size: 14px; }
.library-transfer-result dl { display: flex; flex-wrap: wrap; gap: 7px; margin: 8px 0 0; }
.library-transfer-result dl > div { display: flex; align-items: center; gap: 5px; padding: 5px 7px; border-radius: 6px; background: #eaf6ee; }
.library-transfer-result dt { color: #587765; font-size: 13px; }
.library-transfer-result dd { margin: 0; color: #366b4b; font-size: 14px; font-weight: 750; font-variant-numeric: tabular-nums; }
.section-geometry-editor { margin-top: 2px; padding: 13px; border: 1px solid #dce6ee; border-radius: 9px; background: var(--soft-bg); }
.section-geometry-editor-heading, .section-engine-controls-heading, .section-engine-results-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.section-geometry-editor-heading h3 { margin: 0; color: #304f6c; font-size: 15px; }
.section-geometry-editor-heading p { margin: 4px 0 0; color: #7b8c9c; font-size: 14px; line-height: 1.5; }
.section-geometry-editor-heading > span, .section-engine-controls-heading > span, .section-engine-results-heading > span { flex: 0 0 auto; color: #6c87a0; font-size: 14px; font-weight: 700; }
.section-geometry-editor-body { display: grid; grid-template-columns: minmax(210px, .9fr) minmax(220px, 1fr); align-items: start; gap: 12px; margin-top: 10px; }
.section-engine-controls { min-width: 0; padding: 10px; border: 1px solid #e3ebf1; border-radius: 7px; background: var(--surface-bg); }
.section-engine-controls-heading { align-items: center; }
.section-engine-controls-heading h4, .section-engine-results-heading h4 { margin: 0; color: #456681; font-size: 14px; font-weight: 750; }
.section-geometry-mode { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.section-geometry-mode > span { flex: 1 0 100%; color: #5b7790; font-size: 13px; font-weight: 650; }
.section-geometry-mode button { padding: 5px 8px; border: 1px solid var(--surface-border); border-radius: 6px; background: var(--surface-bg); color: #55728d; font: inherit; font-size: 12px; cursor: pointer; }
.section-geometry-mode button[aria-pressed="true"] { border-color: #477da5; background: #eaf3fa; color: #294968; font-weight: 700; }
.section-engine-status { display: flex; align-items: center; gap: 7px; margin: 8px 0 0; color: #5d7c96; font-size: 13px; line-height: 1.5; }
.section-engine-calculate { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 33px; margin-top: 9px; padding: 7px 10px; border: 1px solid #3d6f96; border-radius: 6px; background: #477da5; color: #fff; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.section-engine-calculate:hover:not(:disabled) { background: #23395d; border-color: #23395d; color: white; }
.section-engine-calculate:disabled { border-color: #c7d3dd; background: #e7edf2; color: #8b9aa8; cursor: not-allowed; }
.section-engine-calculate:focus-visible { outline: 3px solid #a8c7e2; outline-offset: 2px; }
.section-engine-note, .section-engine-dimensions-hint, .section-engine-unsupported { margin: 7px 0 0; color: var(--muted-ink); font-size: 14px; line-height: 1.55; }
.section-engine-unsupported { align-self: center; padding: 10px; border: 1px dashed #d8e2eb; border-radius: 7px; }
.section-engine-error { margin: 8px 0 0; padding: 7px 8px; border: 1px solid #efd5d5; border-radius: 6px; background: #fff8f8; color: #884d51; font-size: 14px; line-height: 1.5; }
.section-engine-results { margin-top: 11px; padding-top: 10px; border-top: 1px solid #e7edf2; }
.section-engine-results-heading { align-items: center; margin-bottom: 8px; }
.section-engine-result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.section-engine-result-card { min-width: 0; padding: 9px; border: 1px solid #e3ebf1; border-radius: 7px; background: var(--surface-bg); }
.section-engine-result-card h5 { margin: 0 0 6px; color: #52738f; font-size: 14px; font-weight: 750; letter-spacing: .035em; text-transform: uppercase; }
.section-engine-values { display: grid; gap: 0; margin: 0; }
.section-engine-values > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 7px; padding: 5px 0; border-bottom: 1px solid #eef2f5; }
.section-engine-values > div:last-child { border-bottom: 0; }
.section-engine-values dt { color: var(--muted-ink); font-size: 14px; line-height: 1.45; }
.section-engine-values dd { margin: 0; color: #344f69; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
.section-engine-values .section-engine-unavailable, .section-engine-unavailable { color: var(--muted-ink); font-weight: 550; }
.section-engine-advanced-card { grid-column: 1 / -1; }
.section-engine-advanced-card .section-engine-values { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 12px; }
.section-engine-spinner { width: 12px; height: 12px; border: 2px solid #b9d0e1; border-top-color: currentColor; border-radius: 50%; animation: section-engine-spin .8s linear infinite; }
@keyframes section-engine-spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) { .library-transfer-controls { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }.library-transfer-import { grid-column: 1 / -1; }.library-transfer-export { align-self: flex-start; } }
@media (max-width: 600px) { .section-geometry-editor-body { grid-template-columns: minmax(0, 1fr); }.section-geometry-editor-heading { flex-direction: column; gap: 5px; }.section-engine-result-grid { grid-template-columns: minmax(0, 1fr); }.section-engine-advanced-card { grid-column: auto; } }
@media (max-width: 520px) { .library-transfer { padding: 12px; }.library-transfer-header { flex-direction: column; }.library-transfer-controls { grid-template-columns: 1fr; }.library-transfer-import { grid-column: auto; }.library-transfer-export { width: 100%; }.library-transfer-choose { flex: 1; }.section-engine-advanced-card .section-engine-values { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 760px) { .library-browser .library-filters { align-items: stretch; flex-direction: column; }.library-browser .library-search, .library-browser .filter-select { width: 100%; flex: initial; } }
@media (prefers-reduced-motion: reduce) { .section-engine-spinner { animation-duration: 2s; } }
</style>
