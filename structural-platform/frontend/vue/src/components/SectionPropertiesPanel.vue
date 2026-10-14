<script setup>
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { request } from '../api'
import {
  buildSectionCalculationRequest,
  resolveSectionProfile,
  sectionInputFingerprint,
  SECTION_PROFILES,
  SECTION_REGISTRY,
  sectionProfileDimensions,
  sectionProfilesForCatalogShape,
} from '../sectional-properties/catalog.js'
import SectionCalculatedProperties from './SectionCalculatedProperties.vue'
import SectionGeometrySketch from './SectionGeometrySketch.vue'

const props = defineProps({
  locale: { type: String, required: true },
  mode: { type: String, default: 'standalone' },
  profileId: { type: String, default: '' },
  catalogShape: { type: String, default: '' },
  dimensions: { type: Object, default: () => ({}) },
  debounce: { type: Number, default: 250 },
})
const emit = defineEmits(['update:profile-id', 'update:dimensions', 'state', 'calculated', 'error'])

const copy = {
  en: {
    title: 'Section Properties', subtitle: 'Enter a section profile and its dimensions to calculate the full canonical property set.',
    profile: 'Section profile', dimensions: 'Dimensions', calculateStatus: 'Calculating section properties…',
    resultUnit: 'Display unit', clear: 'Clear dimensions', invalid: 'Enter all required dimensions to calculate properties.',
    requestFailed: 'Section properties could not be calculated for these dimensions.', standaloneNote: 'Calculation results remain in this session until exported.',
    units: 'mm',
  },
  vi: {
    title: 'Section Properties', subtitle: 'Chọn dạng tiết diện và nhập kích thước để tính đầy đủ các đặc trưng.',
    profile: 'Dạng tiết diện', dimensions: 'Kích thước', calculateStatus: 'Đang tính Section Properties…',
    resultUnit: 'Đơn vị hiển thị', clear: 'Xóa kích thước', invalid: 'Nhập đủ kích thước hợp lệ để tính đặc trưng.',
    requestFailed: 'Không thể tính Section Properties với các kích thước này.', standaloneNote: 'Kết quả chỉ lưu trong phiên này cho đến khi xuất tệp.',
    units: 'mm',
  },
}
const t = (key) => copy[props.locale]?.[key] ?? copy.en[key] ?? key
const instanceId = useId().replaceAll(':', '')

function initialProfileId() {
  const explicit = resolveSectionProfile(props.profileId)
  if (explicit) return explicit.id
  if (props.catalogShape) return sectionProfilesForCatalogShape(props.catalogShape)[0]?.id ?? 'rectangle'
  return 'rectangle'
}
function initialDimensions(profileId, source = props.dimensions) {
  const profile = resolveSectionProfile(profileId)
  if (!profile) return {}
  const merged = props.mode === 'standalone'
    ? { ...profile.default_dimensions, ...(source ?? {}) }
    : { ...(source ?? {}) }
  const dimensions = sectionProfileDimensions(profile, merged, { includeDefaults: props.mode === 'standalone' })
  return Object.fromEntries(profile.dimensions.map((key) => [key, props.mode === 'standalone' && !hasValue(dimensions[key])
    ? profile.default_dimensions?.[key] ?? ''
    : dimensions[key] ?? '']))
}
function hasValue(value) { return value !== '' && value !== null && value !== undefined }

const selectedProfileId = ref(initialProfileId())
const dimensionValues = ref(initialDimensions(selectedProfileId.value))
const result = ref(null)
const calculationError = ref(null)
const calculationState = ref('invalid')
const displayUnit = ref('mm')
let requestSequence = 0
let debounceHandle = null

const profileChoices = computed(() => props.mode === 'catalog' && props.catalogShape
  ? sectionProfilesForCatalogShape(props.catalogShape)
  : SECTION_PROFILES)
const selectedProfile = computed(() => resolveSectionProfile(selectedProfileId.value))
const dimensionFields = computed(() => (selectedProfile.value?.dimensions ?? []).map((key) => ({
  key,
  symbol: SECTION_REGISTRY.dimensions[key]?.symbol ?? key,
  label: props.locale === 'vi' ? SECTION_REGISTRY.dimensions[key]?.name_vi : SECTION_REGISTRY.dimensions[key]?.name_en,
  unit: SECTION_REGISTRY.dimensions[key]?.unit ?? SECTION_REGISTRY.canonical_units,
  minimum: SECTION_REGISTRY.dimensions[key]?.minimum ?? 0,
  allowZero: SECTION_REGISTRY.dimensions[key]?.allow_zero === true,
})))
const requestPayload = computed(() => selectedProfile.value
  ? buildSectionCalculationRequest(selectedProfile.value, dimensionValues.value)
  : null)
const fingerprint = computed(() => sectionInputFingerprint(selectedProfile.value, dimensionValues.value))
const profileLabel = (profile) => props.locale === 'vi' ? profile.name_vi : profile.name_en

function emitState(status, currentFingerprint = fingerprint.value, error = null) {
  calculationState.value = status
  emit('state', { status, fingerprint: currentFingerprint, profileId: selectedProfileId.value, error })
}

function clearCalculation() {
  if (debounceHandle !== null) window.clearTimeout(debounceHandle)
  debounceHandle = null
  requestSequence += 1
  result.value = null
  calculationError.value = null
}

function notifyDimensions() {
  emit('update:dimensions', { ...dimensionValues.value })
}

function setProfile(value) {
  const allowed = profileChoices.value.find((profile) => profile.id === value)
  if (!allowed || selectedProfileId.value === value) return
  const previousProfile = selectedProfile.value
  const sharedDimensions = Object.fromEntries((previousProfile?.dimensions ?? [])
    .filter((key) => allowed.dimensions.includes(key))
    .map((key) => [key, dimensionValues.value[key]]))
  clearCalculation()
  selectedProfileId.value = value
  dimensionValues.value = initialDimensions(value, sharedDimensions)
  emit('update:profile-id', value)
  notifyDimensions()
}

function updateDimension(key, event) {
  const raw = event.currentTarget.value
  const parsed = raw === '' ? '' : Number(raw)
  dimensionValues.value = { ...dimensionValues.value, [key]: parsed }
  notifyDimensions()
}

function clearDimensions() {
  dimensionValues.value = Object.fromEntries(dimensionFields.value.map(({ key }) => [key, '']))
  notifyDimensions()
}

function calculateSoon() {
  clearCalculation()
  const currentFingerprint = fingerprint.value
  const payload = requestPayload.value
  if (!payload) {
    emitState('invalid', currentFingerprint)
    return
  }
  const sequence = requestSequence
  emitState('calculating', currentFingerprint)
  debounceHandle = window.setTimeout(() => calculate(payload, currentFingerprint, sequence), Math.max(0, props.debounce))
}

async function calculate(payload, currentFingerprint, sequence) {
  debounceHandle = null
  try {
    const response = await request('/api/v1/sections/calculate', { method: 'POST', body: JSON.stringify(payload) })
    if (sequence !== requestSequence || currentFingerprint !== fingerprint.value) return
    result.value = response?.data ?? response
    calculationError.value = null
    emitState('ready', currentFingerprint)
    emit('calculated', { result: result.value, request: payload, profile: selectedProfile.value, dimensions: { ...dimensionValues.value }, fingerprint: currentFingerprint })
  } catch (error) {
    if (sequence !== requestSequence || currentFingerprint !== fingerprint.value) return
    calculationError.value = error
    emitState('error', currentFingerprint, error)
    emit('error', error)
  }
}

function calculateNow() {
  calculateSoon()
}

watch(fingerprint, calculateSoon, { immediate: true })
watch(() => props.profileId, (value) => {
  const profile = resolveSectionProfile(value)
  if (profile && profile.id !== selectedProfileId.value) setProfile(profile.id)
})
watch(() => props.catalogShape, (shape) => {
  if (props.mode !== 'catalog' || !shape) return
  if (!profileChoices.value.some((profile) => profile.id === selectedProfileId.value)) {
    const next = sectionProfilesForCatalogShape(shape)[0]
    if (next) setProfile(next.id)
  }
})
watch(() => props.dimensions, (dimensions) => {
  if (props.mode !== 'catalog' || !selectedProfile.value) return
  const incoming = initialDimensions(selectedProfileId.value, dimensions)
  if (JSON.stringify(incoming) !== JSON.stringify(dimensionValues.value)) dimensionValues.value = incoming
}, { deep: true })

onBeforeUnmount(clearCalculation)
</script>

<template>
  <section class="section-properties-panel" :aria-label="t('title')" :data-mode="mode">
    <header class="section-properties-panel-heading">
      <div><h2>{{ t('title') }}</h2><p>{{ t('subtitle') }}</p></div>
      <span class="section-properties-panel-units">XY · {{ SECTION_REGISTRY.canonical_units }}</span>
    </header>

    <div class="section-properties-panel-layout">
      <section class="section-properties-panel-inputs" :aria-label="t('dimensions')">
        <label v-if="profileChoices.length > 1" class="section-properties-panel-field">
          <span>{{ t('profile') }}</span>
          <select :value="selectedProfileId" :aria-label="`${t('profile')} ${instanceId}`" @change="setProfile($event.currentTarget.value)">
            <option v-for="profile in profileChoices" :key="profile.id" :value="profile.id">{{ profileLabel(profile) }}</option>
          </select>
        </label>
        <h3>{{ t('dimensions') }}</h3>
        <div class="section-properties-panel-dimensions">
          <label v-for="field in dimensionFields" :key="field.key" class="section-properties-panel-field">
            <span>{{ field.label }} <small>{{ field.symbol }} · {{ field.unit }}</small></span>
            <input :value="dimensionValues[field.key]" :name="`dimension-${field.key}`" type="number" :min="field.allowZero ? 0 : field.minimum" step="any" inputmode="decimal" @input="updateDimension(field.key, $event)" />
          </label>
        </div>
        <div class="section-properties-panel-actions">
          <button type="button" class="quiet-button" @click="clearDimensions">{{ t('clear') }}</button>
        </div>
        <p class="section-properties-panel-coordinate-note">{{ SECTION_REGISTRY.coordinate_system.origin.replaceAll('_', ' ') }} · X {{ SECTION_REGISTRY.coordinate_system.x }} · Y {{ SECTION_REGISTRY.coordinate_system.y }}</p>
        <SectionGeometrySketch :profile-id="selectedProfileId" :dimensions="dimensionValues" :locale="locale" />
      </section>

      <section class="section-properties-panel-output" aria-live="polite">
        <p v-if="calculationState === 'invalid'" class="section-properties-panel-status">{{ t('invalid') }}</p>
        <p v-else-if="calculationState === 'calculating'" class="section-properties-panel-status" role="status"><span class="section-properties-panel-spinner" aria-hidden="true"></span>{{ t('calculateStatus') }}</p>
        <div v-else-if="calculationState === 'error'" class="section-properties-panel-error" role="alert">
          {{ t('requestFailed') }}
          <span v-if="calculationError?.code">{{ calculationError.code }}</span>
          <span v-if="calculationError?.status">HTTP {{ calculationError.status }}</span>
        </div>
        <SectionCalculatedProperties v-if="result" :result="result" :locale="locale" v-model:display-unit="displayUnit" />
      </section>
    </div>
    <p v-if="mode === 'standalone'" class="section-properties-panel-note">{{ t('standaloneNote') }}</p>
  </section>
</template>

<style scoped>
.section-properties-panel { display: grid; gap: 15px; min-width: 0; padding: 20px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--surface-bg); }
.section-properties-panel-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; align-items: start; }
.section-properties-panel-heading h2 { margin: 0; color: #254d78; font-size: 22px; }
.section-properties-panel-heading p, .section-properties-panel-coordinate-note, .section-properties-panel-note { color: var(--muted-ink); font-size: 14px; line-height: 1.5; margin: 4px 0 0; }
.section-properties-panel-units { color: #64809b; font-size: 14px; font-weight: 650; white-space: nowrap; }
.section-properties-panel-layout { display: grid; grid-template-columns: minmax(240px, .8fr) minmax(0, 1.2fr); gap: 14px; align-items: start; }
.section-properties-panel-inputs, .section-properties-panel-output { min-width: 0; padding: 14px; border: 1px solid #e2e9ef; border-radius: 9px; background: var(--soft-bg); }
.section-properties-panel-inputs h3 { margin: 12px 0 8px; color: #456681; font-size: 15px; }
.section-properties-panel-field { display: grid; min-width: 0; gap: 5px; color: #53708c; font-size: 14px; }
.section-properties-panel-field > span { display: flex; flex-wrap: wrap; gap: 4px 7px; align-items: baseline; }
.section-properties-panel-field small { color: #8496a7; font-size: 12px; }
.section-properties-panel-field input, .section-properties-panel-field select { width: 100%; min-width: 0; min-height: 38px; padding: 8px 10px; border: 1px solid var(--surface-border); border-radius: 6px; background: var(--surface-bg); color: var(--ink); font: inherit; }
.section-properties-panel-dimensions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.section-properties-panel-actions { display: flex; justify-content: flex-end; margin-top: 9px; }
.section-properties-panel-coordinate-note { margin: 10px 0; font-size: 12px; }
.section-properties-panel-status { display: flex; align-items: center; gap: 8px; min-height: 40px; margin: 0; color: var(--muted-ink); font-size: 14px; }
.section-properties-panel-error { padding: 11px; border: 1px solid #efd5d5; border-radius: 7px; background: #fff8f8; color: #834a4d; font-size: 14px; }
.section-properties-panel-error span { display: block; margin-top: 4px; }
.section-properties-panel-spinner { width: 13px; height: 13px; border: 2px solid #b7cada; border-top-color: currentColor; border-radius: 50%; animation: section-properties-spin .8s linear infinite; }
.section-properties-panel-note { border-top: 1px solid #e8edf1; padding-top: 10px; }
@keyframes section-properties-spin { to { transform: rotate(360deg); } }
@media (max-width: 820px) { .section-properties-panel-layout { grid-template-columns: 1fr; } }
@media (max-width: 500px) { .section-properties-panel { padding: 13px 10px; }.section-properties-panel-inputs, .section-properties-panel-output { padding: 10px 8px; }.section-properties-panel-dimensions { grid-template-columns: 1fr; } }
</style>
