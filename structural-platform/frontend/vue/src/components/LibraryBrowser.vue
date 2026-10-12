<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { request } from '../api'
import { copy } from '../i18n'

const props = defineProps({ locale: { type: String, required: true }, canEdit: { type: Boolean, default: false } })
const t = (key) => copy[props.locale]?.[key] ?? copy.en[key] ?? key

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
const editorOpen = ref(false)
const editorMode = ref('create')
const editorResource = ref('materials')
const saving = ref(false)
const deletingId = ref(null)
let listRequestId = 0

const editForm = reactive({
  id: null, code: '', name_vi: '', name_en: '', category: '', shape: '', source: '',
  section_type_id: '', material_id: '', properties: {},
})

const activeRecords = computed(() => records.value[activeResource.value] ?? [])
const categories = computed(() => schema.value?.categories?.[activeResource.value === 'sections' ? 'section_types' : activeResource.value] ?? [])
const visibleShapes = computed(() => (schema.value?.shapes ?? []).filter((shape) => !categoryFilter.value || shape.category === categoryFilter.value))
const editorShapes = computed(() => (schema.value?.shapes ?? []).filter((shape) => shape.category === editForm.category))
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
const filteredRecords = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return activeRecords.value.filter((record) => {
    const sectionType = records.value.section_types.find((item) => String(item.id) === String(record.section_type_id))
    const category = record.category ?? sectionType?.category ?? ''
    const shape = record.shape ?? sectionType?.shape ?? ''
    if (categoryFilter.value && category !== categoryFilter.value) return false
    if (shapeFilter.value && shape !== shapeFilter.value) return false
    if (!query) return true
    const material = records.value.materials.find((item) => String(item.id) === String(record.material_id))
    const haystack = [record.code, record.name_vi, record.name_en, record.source, shape, category, sectionType?.name_vi, sectionType?.name_en, material?.name_vi, material?.name_en]
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

function setResource(resource) {
  if (!resourceKeys.includes(resource) || resource === activeResource.value) return
  activeResource.value = resource
  resetFilters()
}

function openEditor(record = null) {
  if (!props.canEdit) return
  editorResource.value = activeResource.value
  editorMode.value = record ? 'edit' : 'create'
  const firstCategory = schema.value?.categories?.[activeResource.value]?.[0]?.code ?? ''
  const category = record?.category ?? firstCategory
  const shapesForCategory = (schema.value?.shapes ?? []).filter((shape) => shape.category === category)
  const shape = record?.shape ?? shapesForCategory[0]?.code ?? ''
  Object.assign(editForm, {
    id: record?.id ?? null,
    code: record?.code ?? '',
    name_vi: record?.name_vi ?? '',
    name_en: record?.name_en ?? '',
    category,
    shape,
    source: record?.source ?? '',
    section_type_id: record?.section_type_id ?? '',
    material_id: record?.material_id ?? '',
    properties: { ...(record?.properties ?? {}) },
  })
  editorOpen.value = true
}

function updateEditorCategory() {
  const shapes = (schema.value?.shapes ?? []).filter((shape) => shape.category === editForm.category)
  if (!shapes.some((shape) => shape.code === editForm.shape)) editForm.shape = shapes[0]?.code ?? ''
}

function makePayload() {
  const payload = { code: editForm.code.trim(), name_vi: editForm.name_vi.trim(), name_en: editForm.name_en.trim() }
  if (editorResource.value === 'materials') {
    payload.category = editForm.category
    payload.source = editForm.source.trim()
  } else if (editorResource.value === 'section_types') {
    payload.category = editForm.category
    payload.shape = editForm.shape
  } else {
    payload.section_type_id = editForm.section_type_id
    payload.material_id = editForm.material_id
    payload.source = editForm.source.trim()
  }
  if (editorResource.value !== 'section_types') {
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

watch(activeResource, () => loadRecords())

onMounted(async () => {
  await Promise.all([loadSchema(), loadRecords()])
})
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

    <div class="library-filters">
      <label class="library-search"><span class="sr-only">{{ t('search') }}</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg><input v-model="search" type="search" :placeholder="t('searchPlaceholder')" /></label>
      <label class="filter-select"><span>{{ t('category') }}</span><select v-model="categoryFilter"><option value="">{{ t('allCategories') }}</option><option v-for="item in categories" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
      <label v-if="activeResource !== 'materials'" class="filter-select"><span>{{ t('shape') }}</span><select v-model="shapeFilter"><option value="">{{ t('allShapes') }}</option><option v-for="item in visibleShapes" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
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
        <thead><tr><th>{{ t('code') }}</th><th>{{ t('nameVi') }}</th><th>{{ t('nameEn') }}</th><th v-if="activeResource === 'materials'">{{ t('category') }}</th><th v-if="activeResource === 'section_types'">{{ t('category') }}</th><th v-if="activeResource !== 'materials'">{{ t('shape') }}</th><th v-if="activeResource === 'sections'">{{ t('sectionType') }} / {{ t('material') }}</th><th>{{ t('properties') }}</th><th v-if="canEdit">{{ t('actions') }}</th></tr></thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.id">
            <td class="library-code">{{ record.code }}</td>
            <td>{{ record.name_vi }}</td>
            <td>{{ record.name_en }}</td>
            <td v-if="activeResource === 'materials'">{{ categoryName(record.category) }}</td>
            <td v-if="activeResource === 'section_types'">{{ categoryName(record.category) }}</td>
            <td v-if="activeResource !== 'materials'">{{ shapeName(record.shape ?? records.section_types.find((item) => String(item.id) === String(record.section_type_id))?.shape) }}</td>
            <td v-if="activeResource === 'sections'" class="library-related">{{ sectionTypeName(record.section_type_id) }}<small>{{ materialName(record.material_id) }}</small></td>
            <td>
              <details v-if="recordPropertyFields(record).length || computedEntries(record).length" class="property-details">
                <summary>{{ t('properties') }} · {{ recordPropertyFields(record).length + computedEntries(record).length }}</summary>
                <dl><div v-for="field in recordPropertyFields(record)" :key="field.key"><dt>{{ propertyLabel(field) }}<small v-if="field.unit">{{ field.unit }}</small></dt><dd>{{ activeResource === 'section_types' ? (field.required ? '*' : '—') : formatValue(record.properties?.[field.key]) }}</dd></div></dl>
                <div v-if="computedEntries(record).length" class="computed-details"><strong>{{ t('computedProperties') }}</strong><dl><div v-for="[key, value] in computedEntries(record)" :key="key"><dt>{{ computedLabel(key) }}</dt><dd>{{ formatComputed(key, value) }}</dd></div></dl></div>
                <p v-if="record.source" class="property-source"><strong>{{ t('source') }}:</strong> {{ record.source }}</p>
              </details>
              <span v-else>—</span>
            </td>
            <td v-if="canEdit" class="library-actions"><button type="button" class="quiet-button" @click="openEditor(record)">{{ t('editRecord') }}</button><button type="button" class="quiet-button danger-button" :disabled="deletingId === record.id" @click="deleteRecord(record)">{{ t('deleteRecord') }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editorOpen" class="editor-backdrop" @click.self="editorOpen = false">
      <section class="library-editor" role="dialog" aria-modal="true" :aria-label="t(editorMode === 'edit' ? 'editRecord' : resourceDefinitions[editorResource].addKey)">
        <header class="editor-heading"><div><span class="auth-eyebrow">{{ t('databaseTitle') }}</span><h2>{{ t(editorMode === 'edit' ? 'editRecord' : resourceDefinitions[editorResource].addKey) }}</h2></div><button type="button" class="quiet-button editor-close" :aria-label="t('cancel')" @click="editorOpen = false">×</button></header>
        <form class="editor-form" @submit.prevent="saveRecord">
          <label class="field"><span>{{ t('code') }}<b>*</b></span><input v-model.trim="editForm.code" required maxlength="64" autocomplete="off" /></label>
          <label class="field"><span>{{ t('nameVi') }}<b>*</b></span><input v-model.trim="editForm.name_vi" required maxlength="160" /></label>
          <label class="field"><span>{{ t('nameEn') }}<b>*</b></span><input v-model.trim="editForm.name_en" required maxlength="160" /></label>

          <template v-if="editorResource === 'materials'">
            <label class="field"><span>{{ t('materialCategory') }}<b>*</b></span><select v-model="editForm.category" required><option v-for="item in schema?.categories?.materials ?? []" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
            <label class="field full-field"><span>{{ t('source') }}</span><input v-model.trim="editForm.source" maxlength="500" :placeholder="t('sourcePlaceholder')" /><small class="field-hint">{{ t('sourceHelp') }}</small></label>
          </template>
          <template v-else-if="editorResource === 'section_types'">
            <label class="field"><span>{{ t('sectionCategory') }}<b>*</b></span><select v-model="editForm.category" required @change="updateEditorCategory"><option v-for="item in schema?.categories?.section_types ?? []" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
            <label class="field"><span>{{ t('shape') }}<b>*</b></span><select v-model="editForm.shape" required><option v-for="item in editorShapes" :key="item.code" :value="item.code">{{ localizedSchemaName(item) }}</option></select></label>
          </template>
          <template v-else>
            <label class="field"><span>{{ t('sectionType') }}<b>*</b></span><select v-model="editForm.section_type_id" required><option value="">{{ t('selectOption') }}</option><option v-for="item in records.section_types" :key="item.id" :value="item.id">{{ item.code }} · {{ localizedName(item) }}</option></select></label>
            <label class="field"><span>{{ t('material') }}<b>*</b></span><select v-model="editForm.material_id" required><option value="">{{ t('selectOption') }}</option><option v-for="item in compatibleMaterials" :key="item.id" :value="item.id">{{ item.code }} · {{ localizedName(item) }}</option></select></label>
            <label class="field full-field"><span>{{ t('source') }}</span><input v-model.trim="editForm.source" maxlength="500" :placeholder="t('sourcePlaceholder')" /><small class="field-hint">{{ t('sourceHelp') }}</small></label>
          </template>

          <div v-if="editorResource !== 'section_types'" class="property-editor full-field">
            <div class="property-editor-heading"><h3>{{ t('engineeringProperties') }}</h3><span>{{ t('basisUnits') }}</span></div>
            <div v-if="editorResource === 'sections' && !selectedSectionType" class="property-placeholder">{{ t('selectSectionTypeFirst') }}</div>
            <div v-else-if="propertyFields.length" class="editor-form-grid">
              <label v-for="field in propertyFields" :key="field.key" class="field">
                <span>{{ propertyLabel(field) }} <small v-if="field.unit">{{ field.unit }}</small><b v-if="field.required">*</b></span>
                <input v-model="editForm.properties[field.key]" :name="`property-${field.key}`" type="number" inputmode="decimal" step="any" :min="field.min" :max="field.max" :required="field.required" />
              </label>
            </div>
            <p v-else class="property-placeholder">{{ t('noProperties') }}</p>
          </div>

          <div v-if="errorKey" class="error-message full-field" role="alert"><p>{{ t(errorKey) }}</p><ul v-if="validationFieldLabels.length"><li v-for="(label, index) in validationFieldLabels" :key="`${label}-${index}`">{{ label }}</li></ul></div>
          <footer class="editor-actions full-field"><button type="button" class="quiet-button" @click="editorOpen = false">{{ t('cancel') }}</button><button type="submit" class="primary-button" :disabled="saving || (editorResource === 'sections' && !selectedSectionType)">{{ saving ? t('saving') : t(editorMode === 'edit' ? 'saveChanges' : 'createRecord') }}</button></footer>
        </form>
      </section>
    </div>
  </section>
</template>
