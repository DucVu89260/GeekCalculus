<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { request } from '../api'
import DesignCodeIcon from './DesignCodeIcon.vue'
import DesignCodeSelect from './DesignCodeSelect.vue'
import SectionPropertiesPanel from './SectionPropertiesPanel.vue'

const props = defineProps({ locale: { type: String, required: true } })
const emit = defineEmits(['open-library'])

const text = {
  vi: {
    title: 'Thiết kế kết cấu thép', subtitle: 'Thiết lập sơ bộ cấu kiện và liên kết thép.',
    status: 'Sơ bộ · Chưa sẵn sàng tính toán', componentSubtitle: 'Cấu kiện · Thiết lập sơ bộ', connectionSubtitle: 'Liên kết · Thiết lập sơ bộ',
    member: 'Cấu kiện', memberType: 'Loại cấu kiện', beam: 'Dầm', column: 'Cột', brace: 'Thanh giằng',
    standard: 'Tiêu chuẩn thiết kế', material: 'Vật liệu thép', section: 'Tiết diện thép',
    catalogDesignCode: 'Thị trường thư viện (Design Code)', allDesignCodes: 'Tất cả thị trường', regionType: 'Nhóm catalog (Region type)', allRegionTypes: 'Tất cả nhóm catalog', unclassified: 'Chưa phân loại',
    choose: 'Chọn một mục', noMaterials: 'Chưa có vật liệu thép trong thư viện.', noSections: 'Chưa có tiết diện thép dùng vật liệu đã chọn.',
    openLibrary: 'Mở thư viện kỹ thuật', loading: 'Đang tải dữ liệu thư viện…', loadError: 'Không tải được vật liệu hoặc tiết diện thép.', retry: 'Thử lại',
    materialProperties: 'Đặc trưng cơ học vật liệu', sectionProperties: 'Đặc trưng tiết diện', computedProperties: 'Thông số có sẵn',
    emptyProperties: 'Chưa có đặc trưng được ghi nhận cho mục đã chọn.', code: 'Mã', source: 'Nguồn',
    selectionOnly: 'Lựa chọn này chỉ dùng để chuẩn bị hồ sơ. Chưa có kiểm tra theo tiêu chuẩn hoặc kết quả tính toán.',
    dataOnly: 'Các giá trị hiển thị được lấy từ thư viện đã nhập; màn hình này không tự tính toán.',
    connectionType: 'Loại liên kết', beamColumn: 'Dầm – cột', splice: 'Nối cấu kiện', basePlate: 'Bản đế', braceGusset: 'Bản mã thanh giằng',
    fastener: 'Phương thức liên kết', bolted: 'Bu lông', welded: 'Hàn', mixed: 'Bu lông và hàn',
    boltGrade: 'Cấp bền bu lông', weldType: 'Dạng đường hàn', fillet: 'Hàn góc', butt: 'Hàn giáp mối',
    connectionNote: 'Các lựa chọn liên kết là thông tin sơ bộ. Chưa có thiết kế, kiểm tra sức chịu tải hoặc cấu tạo liên kết.',
    standardPlaceholder: 'Tiêu chuẩn chỉ là lựa chọn tham khảo; chưa có kiểm tra theo tiêu chuẩn.',
    component: 'Cấu kiện', connection: 'Liên kết', noDescription: 'Không có mô tả',
    sectionCalculator: 'Đặc trưng tiết diện', sectionCalculatorSubtitle: 'Tính chất hình học · Không lưu vào dự án',
    computedShearModulus: 'Mô đun trượt G', computedGyrationY: 'Bán kính quán tính ry', computedGyrationZ: 'Bán kính quán tính rz',
  },
  en: {
    title: 'Steel design', subtitle: 'Set up preliminary steel members and connections.',
    status: 'Preliminary · Calculation is not ready', componentSubtitle: 'Member · Preliminary setup', connectionSubtitle: 'Connection · Preliminary setup',
    member: 'Member', memberType: 'Member type', beam: 'Beam', column: 'Column', brace: 'Brace',
    standard: 'Design standard', material: 'Steel material', section: 'Steel section',
    catalogDesignCode: 'Library Design Code', allDesignCodes: 'All design codes', regionType: 'Region type', allRegionTypes: 'All section families', unclassified: 'Unclassified',
    choose: 'Select an item', noMaterials: 'No steel materials are available in the library.', noSections: 'No steel sections use the selected material.',
    openLibrary: 'Open engineering library', loading: 'Loading library data…', loadError: 'Could not load steel materials or sections.', retry: 'Retry',
    materialProperties: 'Material mechanical properties', sectionProperties: 'Section properties', computedProperties: 'Available derived values',
    emptyProperties: 'No recorded properties are available for this selection.', code: 'Code', source: 'Source',
    selectionOnly: 'These choices are for preliminary setup only. Code checks and calculated results are not available.',
    dataOnly: 'Displayed values come from the entered library; this screen does not calculate them.',
    connectionType: 'Connection type', beamColumn: 'Beam-column', splice: 'Splice', basePlate: 'Base plate', braceGusset: 'Brace gusset',
    fastener: 'Fastening method', bolted: 'Bolted', welded: 'Welded', mixed: 'Bolted and welded',
    boltGrade: 'Bolt grade', weldType: 'Weld type', fillet: 'Fillet weld', butt: 'Butt weld',
    connectionNote: 'Connection choices are preliminary only. Connection design, resistance checks, and detailing are not available.',
    standardPlaceholder: 'Standards are reference selections only; no code checks are performed.',
    component: 'Member setup', connection: 'Connection setup', noDescription: 'No description',
    sectionCalculator: 'Section properties', sectionCalculatorSubtitle: 'Geometric calculator · Not saved to a project',
    computedShearModulus: 'Shear modulus G', computedGyrationY: 'Radius of gyration ry', computedGyrationZ: 'Radius of gyration rz',
  },
}

const t = (key) => text[props.locale]?.[key] ?? text.en[key] ?? key
const activeTab = ref('component')
const memberType = ref('beam')
const componentStandard = ref('tcvn_5575_2024')
const connectionType = ref('beam_column')
const fastener = ref('bolted')
const boltGrade = ref('8.8')
const weldType = ref('fillet')
const connectionStandard = ref('tcvn_5575_2024')
const marketFilter = ref('all')
const regionTypeFilter = ref('all')

const loading = ref(true)
const loadError = ref(false)
const materials = ref([])
const sections = ref([])
const sectionTypes = ref([])
const schema = ref(null)
const selectedMaterialId = ref('')
const selectedSectionId = ref('')
let requestSequence = 0

const allSteelTypes = computed(() => sectionTypes.value.filter((item) => item.category === 'steel'))
const designCodeOptions = computed(() => {
  const options = schema.value?.design_codes
  return Array.isArray(options) && options.length ? options : ['EN', 'AISC/ACI', 'AS', 'VN'].map((code) => ({ code, name_vi: code, name_en: code }))
})
const steelTypes = computed(() => allSteelTypes.value.filter((item) => {
  if (marketFilter.value !== 'all' && item.design_code !== marketFilter.value) return false
  if (regionTypeFilter.value === '__unclassified__' && item.region_type) return false
  if (regionTypeFilter.value !== 'all' && regionTypeFilter.value !== '__unclassified__' && item.region_type !== regionTypeFilter.value) return false
  return true
}))
const steelTypeIds = computed(() => new Set(steelTypes.value.map((item) => String(item.id))))
const steelMaterials = computed(() => materials.value.filter((item) => item.category === 'steel' && (marketFilter.value === 'all' || item.design_code === marketFilter.value)))
const steelSections = computed(() => sections.value.filter((item) => steelTypeIds.value.has(String(item.section_type_id)) && String(item.material_id) === String(selectedMaterialId.value)))
const selectedMaterial = computed(() => steelMaterials.value.find((item) => String(item.id) === String(selectedMaterialId.value)) ?? null)
const selectedSection = computed(() => steelSections.value.find((item) => String(item.id) === String(selectedSectionId.value)) ?? null)
const selectedSectionType = computed(() => steelTypes.value.find((item) => String(item.id) === String(selectedSection.value?.section_type_id)) ?? null)
const regionTypeOptions = computed(() => {
  const options = new Map()
  for (const item of schema.value?.region_types ?? []) {
    if (marketFilter.value !== 'all' && item.design_code !== marketFilter.value) continue
    if (item.code) options.set(item.code, item)
  }
  let includesUnclassified = false
  for (const type of allSteelTypes.value) {
    if (marketFilter.value !== 'all' && type.design_code !== marketFilter.value) continue
    if (!type.region_type) includesUnclassified = true
    else if (!options.has(type.region_type)) options.set(type.region_type, { code: type.region_type, name_vi: type.region_type, name_en: type.region_type })
  }
  const result = [...options.values()].sort((a, b) => String(a.code).localeCompare(String(b.code)))
  if (includesUnclassified) result.push({ code: '__unclassified__', name_vi: t('unclassified'), name_en: t('unclassified') })
  return result
})

const standards = [
  { value: 'tcvn_5575_2024', label: 'TCVN 5575:2024' },
  { value: 'eurocode_3', label: 'Eurocode 3 · EN 1993' },
  { value: 'aisc_360', label: 'AISC 360' },
]
const memberTypes = [
  { value: 'beam', label: 'beam' }, { value: 'column', label: 'column' }, { value: 'brace', label: 'brace' },
]
const connectionTypes = [
  { value: 'beam_column', label: 'beamColumn' }, { value: 'splice', label: 'splice' },
  { value: 'base_plate', label: 'basePlate' }, { value: 'brace_gusset', label: 'braceGusset' },
]
const fasteningOptions = ['bolted', 'welded', 'mixed']
const boltGrades = ['4.6', '8.8', '10.9']
const weldTypes = ['fillet', 'butt']

const materialFields = computed(() => fieldsFor('materials', selectedMaterial.value?.category, null, selectedMaterial.value?.properties))
const sectionFields = computed(() => fieldsFor('sections', selectedSectionType.value?.category, selectedSectionType.value?.shape, selectedSection.value?.properties))

function unwrapRows(payload) {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  return Array.isArray(data?.data) ? data.data : []
}

function fieldsFor(resource, category, shape, values) {
  return (schema.value?.fields?.[resource] ?? []).filter((field) => {
    if (field.categories?.length && !field.categories.includes(category)) return false
    if (field.shapes?.length && !field.shapes.includes(shape)) return false
    return values?.[field.key] !== null && values?.[field.key] !== undefined
  })
}

function localizedName(record) {
  if (!record) return ''
  return props.locale === 'vi'
    ? record.name_vi || record.name_en || record.code
    : record.name_en || record.name_vi || record.code
}

function designCodeName(code) {
  if (!code) return t('unclassified')
  const option = designCodeOptions.value.find((item) => item.code === code)
  return option ? localizedName(option) : code
}

function regionTypeName(code) {
  if (!code) return t('unclassified')
  const option = (schema.value?.region_types ?? []).find((item) => item.code === code)
  return option ? localizedName(option) : code
}

function sectionTypeClassification(type) {
  if (!type) return t('unclassified')
  return [type.design_code ? designCodeName(type.design_code) : '', type.region_type ? regionTypeName(type.region_type) : ''].filter(Boolean).join(' · ') || t('unclassified')
}

function sectionLabel(section) {
  const type = sectionTypes.value.find((item) => String(item.id) === String(section.section_type_id))
  const typeCode = type?.code ? ` · ${type.code}` : ''
  const classification = sectionTypeClassification(type)
  return `${section.code} · ${localizedName(section)}${typeCode} · ${classification}`
}

function localizedField(field) {
  return props.locale === 'vi' ? field.label_vi || field.label_en || field.key : field.label_en || field.label_vi || field.key
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object' && 'value' in value) return `${formatValue(value.value)}${value.unit ? ` ${value.unit}` : ''}`
  if (typeof value === 'number') return new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 7 }).format(value)
  return String(value)
}

function computedLabel(key) {
  const labels = { shear_modulus: 'computedShearModulus', radius_y: 'computedGyrationY', radius_z: 'computedGyrationZ' }
  return t(labels[key] ?? key.replaceAll('_', ' '))
}

function computedValue(key, value) {
  if (value && typeof value === 'object' && value.unit) return formatValue(value)
  const unit = key === 'radius_y' || key === 'radius_z' ? 'mm' : key === 'shear_modulus' ? 'MPa' : ''
  return `${formatValue(value)}${unit ? ` ${unit}` : ''}`
}

function sectionTypeName(typeId) {
  return localizedName(steelTypes.value.find((item) => String(item.id) === String(typeId)))
}

function propertyCount(record, fields) {
  return fields.length + Object.keys(record?.computed ?? {}).length
}

function chooseFirstAvailable() {
  if (!steelMaterials.value.some((item) => String(item.id) === String(selectedMaterialId.value))) {
    selectedMaterialId.value = String(steelMaterials.value[0]?.id ?? '')
  }
  if (!steelSections.value.some((item) => String(item.id) === String(selectedSectionId.value))) {
    selectedSectionId.value = String(steelSections.value[0]?.id ?? '')
  }
}

async function loadLibrary() {
  const currentRequest = ++requestSequence
  loading.value = true
  loadError.value = false
  try {
    const [materialPayload, typePayload, sectionPayload, schemaPayload] = await Promise.all([
      request('/api/materials'), request('/api/section-types'), request('/api/sections'), request('/api/library/schema'),
    ])
    if (currentRequest !== requestSequence) return
    materials.value = unwrapRows(materialPayload)
    sectionTypes.value = unwrapRows(typePayload)
    sections.value = unwrapRows(sectionPayload)
    schema.value = schemaPayload?.data ?? schemaPayload
    chooseFirstAvailable()
  } catch {
    if (currentRequest !== requestSequence) return
    loadError.value = true
  } finally {
    if (currentRequest === requestSequence) loading.value = false
  }
}

watch(steelSections, (available) => {
  if (!available.some(item => String(item.id) === String(selectedSectionId.value))) selectedSectionId.value = String(available[0]?.id ?? '')
})
watch(steelMaterials, (available) => {
  if (!available.some(item => String(item.id) === String(selectedMaterialId.value))) selectedMaterialId.value = String(available[0]?.id ?? '')
})
watch([marketFilter, regionTypeOptions], () => {
  if (regionTypeFilter.value !== 'all' && !regionTypeOptions.value.some((item) => item.code === regionTypeFilter.value)) regionTypeFilter.value = 'all'
})
onMounted(loadLibrary)
</script>

<template>
  <section class="steel-design" :aria-label="t('title')">
    <header class="steel-design-header">
      <div class="steel-design-heading">
        <span v-if="activeTab !== 'section-properties'" class="steel-design-eyebrow">{{ t('status') }}</span>
        <h2>{{ t('title') }}</h2>
        <p>{{ t('subtitle') }}</p>
      </div>
      <div class="steel-design-mark" aria-hidden="true"><span></span><span></span><span></span></div>
    </header>

    <div class="steel-design-tabs" role="tablist" :aria-label="t('title')">
      <button type="button" role="tab" :aria-selected="activeTab === 'component'" :class="{ active: activeTab === 'component' }" @click="activeTab = 'component'">
        <strong>Component</strong><small>{{ t('componentSubtitle') }}</small>
      </button>
      <button type="button" role="tab" :aria-selected="activeTab === 'connection'" :class="{ active: activeTab === 'connection' }" @click="activeTab = 'connection'">
        <strong>Connection</strong><small>{{ t('connectionSubtitle') }}</small>
      </button>
      <button type="button" role="tab" :aria-selected="activeTab === 'section-properties'" :class="{ active: activeTab === 'section-properties' }" @click="activeTab = 'section-properties'">
        <strong>{{ t('sectionCalculator') }}</strong><small>{{ t('sectionCalculatorSubtitle') }}</small>
      </button>
    </div>

    <section v-if="activeTab === 'component'" class="steel-design-panel" role="tabpanel">
      <div class="steel-design-form-grid">
        <label class="steel-design-field">
          <span>{{ t('memberType') }}</span>
          <select v-model="memberType" class="steel-design-select">
            <option v-for="item in memberTypes" :key="item.value" :value="item.value">{{ t(item.label) }}</option>
          </select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('standard') }}</span>
          <select v-model="componentStandard" class="steel-design-select">
            <option v-for="item in standards" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('catalogDesignCode') }}</span>
          <DesignCodeSelect v-model="marketFilter" :options="designCodeOptions" :locale="locale" :placeholder="t('allDesignCodes')" placeholder-value="all" />
        </label>
        <label class="steel-design-field">
          <span>{{ t('regionType') }}</span>
          <select v-model="regionTypeFilter" class="steel-design-select">
            <option value="all">{{ t('allRegionTypes') }}</option>
            <option v-for="item in regionTypeOptions" :key="item.code" :value="item.code">{{ item.code === '__unclassified__' ? t('unclassified') : localizedName(item) }}</option>
          </select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('material') }}</span>
          <select v-model="selectedMaterialId" class="steel-design-select" :disabled="loading || loadError || !steelMaterials.length">
            <option value="" disabled>{{ t('choose') }}</option>
            <option v-for="item in steelMaterials" :key="item.id" :value="String(item.id)">{{ item.code }} · {{ localizedName(item) }} · {{ designCodeName(item.design_code) }}</option>
          </select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('section') }}</span>
          <select v-model="selectedSectionId" class="steel-design-select" :disabled="loading || loadError || !steelSections.length">
            <option value="" disabled>{{ t('choose') }}</option>
            <option v-for="item in steelSections" :key="item.id" :value="String(item.id)">{{ sectionLabel(item) }}</option>
          </select>
        </label>
      </div>

      <div class="steel-design-standard-note"><span aria-hidden="true">i</span>{{ t('standardPlaceholder') }}</div>

      <div v-if="loading" class="steel-design-state" role="status"><span class="steel-design-spinner"></span>{{ t('loading') }}</div>
      <div v-else-if="loadError" class="steel-design-state steel-design-state-error" role="alert">
        <span>{{ t('loadError') }}</span><button type="button" class="steel-design-retry" @click="loadLibrary">{{ t('retry') }}</button>
      </div>
      <template v-else>
        <div v-if="!steelMaterials.length || !steelSections.length" class="steel-design-empty" role="status">
          <div class="steel-design-empty-icon" aria-hidden="true">∅</div>
          <div class="steel-design-empty-copy">
            <p v-if="!steelMaterials.length">{{ t('noMaterials') }}</p>
            <p v-if="!steelSections.length">{{ t('noSections') }}</p>
            <button type="button" class="steel-design-link" @click="emit('open-library')">{{ t('openLibrary') }} <span aria-hidden="true">↗</span></button>
          </div>
        </div>

        <div v-if="selectedMaterial || selectedSection" class="steel-design-record-grid">
          <article v-if="selectedMaterial" class="steel-design-record-card">
            <header><div><span class="steel-design-card-kicker">{{ t('materialProperties') }}</span><h3>{{ localizedName(selectedMaterial) }}</h3><p>{{ selectedMaterial.code }} · <span class="steel-design-classification"><DesignCodeIcon v-if="selectedMaterial.design_code" :code="selectedMaterial.design_code" aria-hidden="true" />{{ t('catalogDesignCode') }}: {{ designCodeName(selectedMaterial.design_code) }}</span></p></div><span class="steel-design-chip">{{ t('material') }}</span></header>
            <dl v-if="materialFields.length" class="steel-design-property-list">
              <div v-for="field in materialFields" :key="field.key"><dt>{{ localizedField(field) }}<small v-if="field.unit">{{ field.unit }}</small></dt><dd>{{ formatValue(selectedMaterial.properties?.[field.key]) }}</dd></div>
            </dl>
            <p v-else class="steel-design-no-properties">{{ t('emptyProperties') }}</p>
          </article>
          <article v-if="selectedSection" class="steel-design-record-card">
            <header><div><span class="steel-design-card-kicker">{{ t('sectionProperties') }}</span><h3>{{ localizedName(selectedSection) }}</h3><p>{{ selectedSection.code }}<span v-if="selectedSectionType"> · {{ selectedSectionType.code }} · {{ sectionTypeName(selectedSection.section_type_id) }} · <span class="steel-design-classification"><DesignCodeIcon v-if="selectedSectionType.design_code" :code="selectedSectionType.design_code" aria-hidden="true" />{{ sectionTypeClassification(selectedSectionType) }}</span></span></p></div><span class="steel-design-chip">{{ t('section') }}</span></header>
            <dl v-if="sectionFields.length" class="steel-design-property-list">
              <div v-for="field in sectionFields" :key="field.key"><dt>{{ localizedField(field) }}<small v-if="field.unit">{{ field.unit }}</small></dt><dd>{{ formatValue(selectedSection.properties?.[field.key]) }}</dd></div>
            </dl>
            <div v-if="Object.keys(selectedSection.computed ?? {}).length" class="steel-design-computed">
              <span>{{ t('computedProperties') }}</span>
              <dl class="steel-design-property-list"><div v-for="(value, key) in selectedSection.computed" :key="key"><dt>{{ computedLabel(key) }}</dt><dd>{{ computedValue(key, value) }}</dd></div></dl>
            </div>
            <p v-if="!propertyCount(selectedSection, sectionFields)" class="steel-design-no-properties">{{ t('emptyProperties') }}</p>
          </article>
        </div>
      </template>

      <p class="steel-design-footnote">{{ t('dataOnly') }}</p>
    </section>

    <section v-else-if="activeTab === 'connection'" class="steel-design-panel" role="tabpanel">
      <div class="steel-design-form-grid">
        <label class="steel-design-field">
          <span>{{ t('connectionType') }}</span>
          <select v-model="connectionType" class="steel-design-select">
            <option v-for="item in connectionTypes" :key="item.value" :value="item.value">{{ t(item.label) }}</option>
          </select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('fastener') }}</span>
          <select v-model="fastener" class="steel-design-select">
            <option v-for="item in fasteningOptions" :key="item" :value="item">{{ t(item) }}</option>
          </select>
        </label>
        <label v-if="fastener !== 'welded'" class="steel-design-field">
          <span>{{ t('boltGrade') }}</span>
          <select v-model="boltGrade" class="steel-design-select"><option v-for="grade in boltGrades" :key="grade" :value="grade">{{ grade }}</option></select>
        </label>
        <label v-if="fastener !== 'bolted'" class="steel-design-field">
          <span>{{ t('weldType') }}</span>
          <select v-model="weldType" class="steel-design-select"><option v-for="item in weldTypes" :key="item" :value="item">{{ t(item) }}</option></select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('standard') }}</span>
          <select v-model="connectionStandard" class="steel-design-select">
            <option v-for="item in standards" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
      </div>

      <div class="steel-design-standard-note"><span aria-hidden="true">i</span>{{ t('standardPlaceholder') }}</div>
      <div class="steel-design-connection-notice"><span class="steel-design-notice-icon" aria-hidden="true">↗</span><p>{{ t('connectionNote') }}</p></div>
    </section>

    <div v-show="activeTab === 'section-properties'" class="steel-design-properties-panel" role="tabpanel">
      <SectionPropertiesPanel :locale="locale" asymmetric-only />
    </div>
  </section>
</template>

<style scoped>
.steel-design { color: #233850; }
.steel-design-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 4px 2px 20px; }
.steel-design-eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #4977a4; font-size: 12px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.steel-design-eyebrow::before { width: 7px; height: 7px; border-radius: 50%; background: #d4973d; content: ''; }
.steel-design-heading h2 { margin: 7px 0 5px; color: #203b58; font-size: 24px; letter-spacing: -.035em; }
.steel-design-heading p { margin: 0; color: var(--muted-ink); font-size: 14px; }
.steel-design-mark { display: flex; align-items: center; justify-content: center; gap: 6px; width: 48px; height: 48px; border: 1px solid var(--surface-border); border-radius: 14px; background: linear-gradient(145deg, var(--surface-bg), var(--page-bg)); }
.steel-design-mark span { display: block; width: 4px; border-radius: 3px; background: #6488ad; transform: skew(-20deg); }
.steel-design-mark span:nth-child(1) { height: 18px; }.steel-design-mark span:nth-child(2) { height: 28px; background: #355e86; }.steel-design-mark span:nth-child(3) { height: 22px; }
.steel-design-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 5px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--soft-bg); }
.steel-design-tabs button { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; padding: 13px 16px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: #4e6984; cursor: pointer; text-align: left; transition: color .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease; }
.steel-design-tabs button strong { font-size: 14px; font-weight: 700; }
.steel-design-tabs button small { color: inherit; font-size: 12px; opacity: .78; }
.steel-design-tabs button:hover, .steel-design-tabs button.active { border-color: #23395d; background: #23395d; color: #fff; box-shadow: 0 4px 12px #23395d26; }
.steel-design-tabs button:focus-visible, .steel-design-select:focus-visible, .steel-design-link:focus-visible, .steel-design-retry:focus-visible { outline: 3px solid #8bb6df; outline-offset: 2px; }
.steel-design-panel { margin-top: 14px; padding: 22px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--surface-bg); }
.steel-design-properties-panel { margin-top: 14px; }
.steel-design-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.steel-design-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; color: #5d7690; font-size: 13px; font-weight: 650; }
.steel-design-select { width: 100%; min-height: 42px; padding: 9px 36px 9px 12px; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--workspace-bg); color: #233850; font: inherit; font-size: 14px; }
.steel-design-select:focus { border-color: #6d9bc5; box-shadow: 0 0 0 3px #d9e9f7; outline: none; }
.steel-design-select:disabled { cursor: not-allowed; opacity: .65; }
.steel-design-select option:hover, .steel-design-select option:checked { background: #23395d; color: white; }
.steel-design-standard-note { display: flex; gap: 9px; align-items: flex-start; margin: 16px 0 0; padding: 10px 12px; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--soft-bg); color: var(--muted-ink); font-size: 12px; line-height: 1.55; }
.steel-design-standard-note > span { display: grid; flex: 0 0 17px; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: #e5eff8; color: #537b9f; font-family: Georgia, serif; font-size: 13px; font-weight: 700; }
.steel-design-state { display: flex; align-items: center; gap: 10px; min-height: 88px; justify-content: center; color: var(--muted-ink); font-size: 13px; }
.steel-design-state-error { flex-wrap: wrap; color: #a24e53; }
.steel-design-spinner { width: 17px; height: 17px; border: 2px solid var(--surface-border); border-top-color: #4f81ad; border-radius: 50%; animation: steel-spin .8s linear infinite; }
@keyframes steel-spin { to { transform: rotate(360deg); } }
.steel-design-retry { padding: 7px 11px; border: 1px solid var(--surface-border); border-radius: 7px; background: var(--surface-bg); color: #416e98; cursor: pointer; font: inherit; }
.steel-design-empty { display: flex; align-items: center; gap: 14px; margin-top: 16px; padding: 16px; border: 1px dashed var(--surface-border); border-radius: 10px; background: var(--soft-bg); }
.steel-design-empty-icon { display: grid; flex: 0 0 36px; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--soft-bg); color: #637e97; font-size: 22px; }
.steel-design-empty-copy p { margin: 0 0 8px; color: #637a90; font-size: 13px; line-height: 1.5; }
.steel-design-link { padding: 0; border: 0; background: transparent; color: #356b9d; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; }
.steel-design-link:hover { color: #23395d; text-decoration: underline; }
.steel-design-link span { margin-left: 4px; }
.steel-design-record-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.steel-design-record-card { min-width: 0; padding: 16px; border: 1px solid var(--surface-border); border-radius: 10px; background: var(--workspace-bg); }
.steel-design-record-card header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--surface-border); }
.steel-design-card-kicker { color: var(--muted-ink); font-size: 11px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
.steel-design-record-card h3 { overflow-wrap: anywhere; margin: 5px 0 3px; color: #294661; font-size: 15px; }
.steel-design-record-card header p { margin: 0; color: var(--muted-ink); font-size: 12px; }
.steel-design-classification { display: inline-flex; align-items: center; gap: 5px; }
.steel-design-chip { flex: 0 0 auto; padding: 5px 7px; border-radius: 6px; background: var(--soft-bg); color: #5d7893; font-size: 11px; font-weight: 650; }
.steel-design-property-list { display: grid; gap: 0; margin: 0; }
.steel-design-property-list > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--surface-border); }
.steel-design-property-list > div:last-child { border-bottom: 0; }
.steel-design-property-list dt { color: #61798f; font-size: 12px; line-height: 1.45; }
.steel-design-property-list dt small { display: inline-block; margin-left: 4px; color: var(--muted-ink); font-size: 11px; }
.steel-design-property-list dd { margin: 0; color: #344f69; font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 650; text-align: right; overflow-wrap: anywhere; }
.steel-design-computed { margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--surface-border); }
.steel-design-computed > span { color: #5e7d99; font-size: 11px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
.steel-design-computed .steel-design-property-list { margin-top: 4px; }
.steel-design-no-properties { margin: 12px 0 0; color: var(--muted-ink); font-size: 12px; line-height: 1.55; }
.steel-design-footnote { margin: 14px 2px 0; color: var(--muted-ink); font-size: 12px; line-height: 1.55; }
.steel-design-connection-notice { display: flex; align-items: flex-start; gap: 12px; margin-top: 22px; padding: 17px; border: 1px solid var(--surface-border); border-radius: 10px; background: linear-gradient(135deg, var(--soft-bg), var(--soft-bg)); }
.steel-design-notice-icon { display: grid; flex: 0 0 30px; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: #e2edf7; color: #547da2; font-size: 16px; }
.steel-design-connection-notice p { margin: 1px 0 0; color: var(--muted-ink); font-size: 13px; line-height: 1.65; }
@media (max-width: 760px) { .steel-design-record-grid { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .steel-design-tabs { grid-template-columns: 1fr; }.steel-design-header { align-items: flex-start; padding-bottom: 15px; }.steel-design-heading h2 { font-size: 21px; }.steel-design-mark { flex: 0 0 42px; width: 42px; height: 42px; }.steel-design-tabs button { padding: 11px 10px; }.steel-design-tabs button small { font-size: 11px; }.steel-design-panel { padding: 15px 12px; }.steel-design-form-grid { grid-template-columns: 1fr; gap: 12px; }.steel-design-record-card { padding: 13px; } }
@media (prefers-reduced-motion: reduce) { .steel-design-spinner { animation-duration: 2s; } .steel-design-tabs button { transition: none; } }
</style>
