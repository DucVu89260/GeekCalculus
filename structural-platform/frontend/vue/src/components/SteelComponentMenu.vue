<script setup>
import { computed, nextTick, ref } from 'vue'
import SectionGeometrySketch from './SectionGeometrySketch.vue'
import { symmetricIStandardHref } from '../modules'
import { demoMode } from '../api'
import { SECTION_PROFILES } from '../sectional-properties/catalog.js'

const props = defineProps({ locale: { type: String, required: true } })
const selectedId = ref('')
const standardChooserOpen = ref(false)
const dismissButton = ref(null)
let triggerButton = null
const standards = [
  { code: 'aisc-360-10', label: 'AISC 360-10', available: true },
  { code: 'aisc-360-16', label: 'AISC 360-16', available: false },
  { code: 'aisc-360-22', label: 'AISC 360-22', available: false },
  { code: 'en-1993', label: 'EN 1993 (Eurocode 3)', available: false },
]
async function chooseSection(id, event) {
  selectedId.value = id
  if (id !== 'symmetric_i') {
    standardChooserOpen.value = false
    return
  }
  triggerButton = event.currentTarget
  standardChooserOpen.value = true
  await nextTick()
  dismissButton.value?.focus()
}
function closeStandards() {
  standardChooserOpen.value = false
  nextTick(() => triggerButton?.focus())
}
function openStandard(code) {
  if (code !== 'aisc-360-10') return
  standardChooserOpen.value = false
  if (demoMode) {
    // GitHub Pages has no Laravel calculation API; use the standalone parity preview.
    const url = new URL(`${import.meta.env.BASE_URL}hi-doubly-symmetric-aisc360-10.html`, window.location.origin)
    window.location.assign(url.href)
    return
  }
  window.location.hash = symmetricIStandardHref(code).split('#')[1]
}
const text = {
  vi: { title: 'Chọn loại tiết diện', description: 'Chọn nhóm cấu kiện để mở chức năng tương ứng.', pending: 'Chức năng này đang được phát triển.',
    symmetric_i: 'Hai cánh giống nhau', asymmetric_i: 'Cánh trên và dưới độc lập', channel: 'Tiết diện U/C', angle: 'Tiết diện góc L', tee: 'Tiết diện chữ T', double_angle: 'Hai góc đối lưng', circle: 'Tròn đặc', chs: 'Ống tròn', shs_rhs: 'Hộp chữ nhật / vuông' },
  en: { title: 'Choose a section type', description: 'Choose a member family to open its workspace.', pending: 'This feature is in development.',
    symmetric_i: 'Equal flanges', asymmetric_i: 'Independent upper and lower flanges', channel: 'U/C section', angle: 'L section', tee: 'T section', double_angle: 'Back-to-back angles', circle: 'Solid circle', chs: 'Circular hollow section', shs_rhs: 'Rectangular / square hollow section' },
}
const t = key => text[props.locale]?.[key] ?? text.en[key]
const definitions = [
  ['symmetric_i', 'Symmetric I/H'], ['asymmetric_i', 'Asymmetric I/H'], ['channel', 'Channel'],
  ['angle', 'Angle'], ['tee', 'Tee'], ['double_angle', 'Double Angle'],
  ['circle', 'Circle'], ['chs', 'CHS'], ['shs_rhs', 'RHS/SHS'],
]
const components = definitions.map(([id, title]) => ({ id, title, profile: SECTION_PROFILES.find(profile => profile.id === id) }))
const selected = computed(() => components.find(component => component.id === selectedId.value))
</script>

<template>
  <section class="steel-component-menu steel-design-panel" role="tabpanel" :aria-label="t('title')">
    <header class="steel-component-heading"><h3>{{ t('title') }}</h3><p>{{ t('description') }}</p></header>
    <div class="steel-component-grid">
      <button v-for="component in components" :key="component.id" type="button" class="steel-component-card"
        :class="{ selected: selectedId === component.id }" :data-component="component.id"
        :aria-label="component.title" :aria-pressed="selectedId === component.id" @click="chooseSection(component.id, $event)">
        <span class="steel-component-image"><SectionGeometrySketch :profile-id="component.id" :dimensions="component.profile.default_dimensions" :locale="locale" thumbnail /></span>
        <span class="steel-component-copy"><strong>{{ component.title }}</strong><span>{{ t(component.id) }}</span></span>
        <svg class="steel-component-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
      </button>
    </div>
    <section v-if="selected && selected.id !== 'symmetric_i'" class="steel-component-workspace" :data-component="selected.id" :aria-label="selected.title" aria-live="polite">
      <span class="steel-component-workspace-image" aria-hidden="true"><SectionGeometrySketch :profile-id="selected.id" :dimensions="selected.profile.default_dimensions" :locale="locale" thumbnail /></span>
      <div><h3>{{ selected.title }}</h3><p>{{ t('pending') }}</p></div>
    </section>
    <div v-if="standardChooserOpen" class="standard-backdrop" @click.self="closeStandards">
      <section class="standard-dialog" role="dialog" aria-modal="true" aria-labelledby="hi-standard-heading" aria-describedby="hi-standard-description" @keydown.esc.stop.prevent="closeStandards">
        <header class="standard-dialog-heading">
          <div>
            <span class="standard-dialog-kicker">Steel Design / Component / Symmetric I/H</span>
            <h3 id="hi-standard-heading">{{ locale === 'vi' ? 'Chọn tiêu chuẩn thiết kế' : 'Select design standard' }}</h3>
            <p id="hi-standard-description">{{ locale === 'vi' ? 'Chọn phiên bản tiêu chuẩn để mở trang kiểm tra cấu kiện I/H đối xứng.' : 'Choose a standard to open the symmetric I/H member calculation page.' }}</p>
          </div>
          <button ref="dismissButton" class="standard-dialog-close" type="button" :aria-label="locale === 'vi' ? 'Đóng' : 'Close'" @click="closeStandards">×</button>
        </header>
        <div class="standard-options">
          <button v-for="standard in standards" :key="standard.code" type="button" class="standard-choice"
            :disabled="!standard.available" :class="{ 'standard-choice-ready': standard.available }"
            @click="openStandard(standard.code)">
            <span><strong>{{ standard.label }}</strong>
              <small>{{ standard.available ? (locale === 'vi' ? 'Phase 1 · Excel Parity (đang kiểm chứng)' : 'Phase 1 · Excel Parity (under verification)') : (locale === 'vi' ? 'Đang phát triển' : 'Coming soon') }}</small>
            </span>
            <span v-if="standard.available" aria-hidden="true">→</span>
            <span v-else aria-hidden="true">○</span>
          </button>
        </div>
        <p class="standard-dialog-note">{{ locale === 'vi' ? 'AISC 360-10 hiện là màn hình thử nghiệm, chưa phải bộ tính toán được xác nhận theo tiêu chuẩn.' : 'AISC 360-10 is currently a parity preview and has not been verified as standard-compliant.' }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.standard-backdrop { position:fixed; inset:0; z-index:1100; padding:24px; background:rgba(12,27,45,.60); display:grid; place-items:center; }
.standard-dialog { width:min(100%,670px); max-height:min(90vh,850px); overflow:auto; border:1px solid var(--surface-border); border-radius:16px; padding:25px; background:var(--workspace-bg, #fff); box-shadow:0 24px 70px #07172655; }
.standard-dialog-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.standard-dialog-kicker { color:#51728f; font-size:12px; font-weight:700; }
.standard-dialog-heading h3 { margin:7px 0; font-size:23px; color:#203b58; }
.standard-dialog-heading p { margin:0; color:var(--muted-ink); font-size:15px; line-height:1.6; }
.standard-dialog-close { min-width:38px; min-height:38px; border:1px solid var(--surface-border); border-radius:9px; background:var(--surface-bg); color:#294d70; font-size:25px; }
.standard-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:24px; }
.standard-choice { display:flex; justify-content:space-between; align-items:center; gap:14px; min-height:102px; padding:19px; border-radius:12px; border:1px solid var(--surface-border); background:var(--surface-bg); text-align:left; color:#597085; }
.standard-choice span:first-child { display:grid; gap:8px; }
.standard-choice strong { font-size:17px; color:inherit; }
.standard-choice small { font-size:12px; line-height:1.45; }
.standard-choice-ready { cursor:pointer; border-color:#6ba7b2; color:#174b65; background:#e8f4f4; }
.standard-choice-ready:hover,.standard-choice-ready:focus-visible { border-color:#186b7b; background:#d5eeee; }
.standard-choice:disabled { cursor:not-allowed; opacity:.7; }
.standard-dialog-note { margin:18px 0 0; color:#8f611a; font-size:13px; line-height:1.6; }
@media(max-width:600px){.standard-backdrop{padding:12px}.standard-dialog{padding:16px}.standard-options{grid-template-columns:1fr}.standard-choice{min-height:74px;padding:14px}}

.steel-component-menu { margin-top: 14px; padding: 22px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--surface-bg); }
.steel-component-heading h3 { margin: 0; font-size: 21px; color: #203b58; }
.steel-component-heading p { margin: 7px 0 20px; color: var(--muted-ink); font-size: 16px; }
.steel-component-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.steel-component-card { position: relative; display: flex; align-items: center; gap: 14px; padding: 16px; min-width: 0; min-height: 148px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--workspace-bg); color: #23395d; text-align: left; font: inherit; cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.steel-component-card:hover, .steel-component-card.selected { background: #23395d; border-color: #23395d; color: white; }
.steel-component-card:focus-visible { outline: 3px solid #8bb6df; outline-offset: 3px; }
.steel-component-image, .steel-component-workspace-image { --soft-bg: #f1ede6; display: block; flex: 0 0 100px; border-radius: 9px; background: var(--soft-bg); padding: 5px; }
.steel-component-copy { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.steel-component-copy strong { font-size: 17px; }
.steel-component-copy > span { font-size: 14px; line-height: 1.5; opacity: .8; }
.steel-component-arrow { position: absolute; top: 9px; right: 12px; width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; opacity: .6; }
.steel-component-workspace { display: flex; align-items: center; gap: 20px; margin-top: 20px; padding: 18px; border: 1px solid #a6b8ca; border-radius: 10px; background: var(--workspace-bg); }
.steel-component-workspace h3 { margin: 0 0 8px; font-size: 20px; color: #203b58; }.steel-component-workspace p { margin: 0; color: var(--muted-ink); line-height: 1.6; }
@media (max-width: 1050px) { .steel-component-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .steel-component-menu { padding: 16px 12px; }.steel-component-grid { grid-template-columns: 1fr; gap: 10px; }.steel-component-card { min-height: 126px; padding: 12px; }.steel-component-image { flex-basis: 88px; }.steel-component-workspace { padding: 12px; gap: 12px; }.steel-component-workspace-image { flex-basis: 76px; } }
@media (prefers-reduced-motion: reduce) { .steel-component-card { transition: none; } }
</style>
