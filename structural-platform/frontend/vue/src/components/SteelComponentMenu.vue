<script setup>
import { computed, nextTick, ref } from 'vue'
import SectionGeometrySketch from './SectionGeometrySketch.vue'
import CraneBeamView from './CraneBeamView.vue'
import { SECTION_PROFILES } from '../sectional-properties/catalog.js'

const props = defineProps({ locale: { type: String, required: true } })

const selectedId = ref('')
const standardsDialogOpen = ref(false)
const craneStandardOpen = ref(false)
const closeDialogButton = ref(null)
let originalTrigger = null
const designStandards = [
  { code: 'aisc360-10', label: 'AISC 360-10', ready: true },
  { code: 'aisc360-16', label: 'AISC 360-16', ready: false },
  { code: 'aisc360-22', label: 'AISC 360-22', ready: false },
  { code: 'en1993', label: 'EN 1993', ready: false },
]
async function selectSection(componentId, event) {
  selectedId.value = componentId
  craneStandardOpen.value = false
  if (componentId !== 'symmetric_i' && componentId !== 'crane_beam') {
    standardsDialogOpen.value = false
    return
  }
  originalTrigger = event.currentTarget
  standardsDialogOpen.value = true
  await nextTick()
  closeDialogButton.value?.focus()
}
function closeStandardsDialog() {
  standardsDialogOpen.value = false
  nextTick(() => originalTrigger?.focus())
}
function openDesignStandard(code) {
  if (code !== 'aisc360-10') return
  standardsDialogOpen.value = false
  if (selectedId.value === 'crane_beam') { craneStandardOpen.value = true; return }
  // This file is also present in Vite public/, so GitHub Pages and local demo builds agree.
  const path = `${import.meta.env.BASE_URL}hi-doubly-symmetric-aisc360-10.html`
  window.location.assign(new URL(path, window.location.origin).href)
}

const text = {
  vi: { title: 'Chọn loại tiết diện', description: 'Chọn nhóm cấu kiện để mở chức năng tương ứng.', pending: 'Chức năng này đang được phát triển.',
    chooseStandard: 'Chọn tiêu chuẩn thiết kế', standardDescription: 'Chọn tiêu chuẩn để mở bảng tính cấu kiện.', preview: 'Đang kiểm chứng · Phase 1', comingSoon: 'Đang phát triển', dismiss: 'Đóng', previewNote: 'AISC 360-10 hiện chỉ mở bản đối chiếu Excel AISC 360-05, chưa phải công cụ thiết kế được xác minh theo tiêu chuẩn.',
    crane_beam: 'Dầm cầu trục · I/H bất đối xứng', symmetric_i: 'Hai cánh giống nhau', asymmetric_i: 'Cánh trên và dưới độc lập', channel: 'Tiết diện U/C', angle: 'Tiết diện góc L', tee: 'Tiết diện chữ T', double_angle: 'Hai góc đối lưng', circle: 'Tròn đặc', chs: 'Ống tròn', shs_rhs: 'Hộp chữ nhật / vuông' },
  en: { title: 'Choose a section type', description: 'Choose a member family to open its workspace.', pending: 'This feature is in development.',
    chooseStandard: 'Choose design standard', standardDescription: 'Select a standard for the component calculation workspace.', preview: 'Under verification · Phase 1', comingSoon: 'Coming soon', dismiss: 'Close', previewNote: 'AISC 360-10 currently opens an AISC 360-05 Excel parity preview; it is not a code-verified design tool.',
    crane_beam: 'Crane runway girder · Asymmetric I/H', symmetric_i: 'Equal flanges', asymmetric_i: 'Independent upper and lower flanges', channel: 'U/C section', angle: 'L section', tee: 'T section', double_angle: 'Back-to-back angles', circle: 'Solid circle', chs: 'Circular hollow section', shs_rhs: 'Rectangular / square hollow section' },
}
const t = key => text[props.locale]?.[key] ?? text.en[key]
const definitions = [
  ['symmetric_i', 'Symmetric I/H'], ['crane_beam', 'Crane Beam'], ['asymmetric_i', 'Asymmetric I/H'], ['channel', 'Channel'],
  ['angle', 'Angle'], ['tee', 'Tee'], ['double_angle', 'Double Angle'],
  ['circle', 'Circle'], ['chs', 'CHS'], ['shs_rhs', 'RHS/SHS'],
]
const components = definitions.map(([id, title]) => ({ id, title, profile: SECTION_PROFILES.find(profile => profile.id === (id === 'crane_beam' ? 'asymmetric_i' : id)) }))
const selected = computed(() => components.find(component => component.id === selectedId.value))
</script>

<template>
  <section class="steel-component-menu steel-design-panel" role="tabpanel" :aria-label="t('title')">
    <header class="steel-component-heading"><h3>{{ t('title') }}</h3><p>{{ t('description') }}</p></header>
    <div class="steel-component-grid">
      <button v-for="component in components" :key="component.id" type="button" class="steel-component-card"
        :class="{ selected: selectedId === component.id }" :data-component="component.id"
        :aria-label="component.title" :aria-pressed="selectedId === component.id" @click="selectSection(component.id, $event)">
        <span class="steel-component-image"><SectionGeometrySketch :profile-id="component.id === 'crane_beam' ? 'asymmetric_i' : component.id" :dimensions="component.profile.default_dimensions" :locale="locale" thumbnail /></span>
        <span class="steel-component-copy"><strong>{{ component.title }}</strong><span>{{ t(component.id) }}</span></span>
        <svg class="steel-component-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
      </button>
    </div>
    <div v-if="standardsDialogOpen" class="steel-standards-backdrop" @click.self="closeStandardsDialog">
      <section class="steel-standards-dialog" role="dialog" aria-modal="true" :aria-label="t('chooseStandard')" @keydown.esc.stop.prevent="closeStandardsDialog">
        <header class="steel-standards-header">
          <div><small>Steel Design › Component › {{ selectedId === 'crane_beam' ? 'Crane Beam' : 'Symmetric I/H' }}</small><h3>{{ t('chooseStandard') }}</h3><p>{{ t('standardDescription') }}</p></div>
          <button ref="closeDialogButton" type="button" class="steel-standards-close" :aria-label="t('dismiss')" @click="closeStandardsDialog">×</button>
        </header>
        <div class="steel-standards-grid">
          <button v-for="standard in designStandards" :key="standard.code" type="button"
            :disabled="!standard.ready" :class="{ ready: standard.ready }" @click="openDesignStandard(standard.code)">
            <span><strong>{{ standard.label }}</strong><small>{{ standard.ready ? t('preview') : t('comingSoon') }}</small></span>
            <span aria-hidden="true">{{ standard.ready ? '→' : '○' }}</span>
          </button>
        </div>
        <p class="steel-standards-warning">{{ selectedId === 'crane_beam' ? 'AISC 360-10 ASD · Bản chuyển thể Excel đang được kiểm chứng. Những điều kiện chưa đối chiếu sẽ hiển thị NOT VERIFIED.' : t('previewNote') }}</p>
      </section>
    </div>
    <CraneBeamView v-if="selectedId === 'crane_beam' && craneStandardOpen && !standardsDialogOpen" :locale="locale" />
    <section v-if="selected && selected.id !== 'symmetric_i' && selected.id !== 'crane_beam'" class="steel-component-workspace" :data-component="selected.id" :aria-label="selected.title" aria-live="polite">
      <span class="steel-component-workspace-image" aria-hidden="true"><SectionGeometrySketch :profile-id="selected.id" :dimensions="selected.profile.default_dimensions" :locale="locale" thumbnail /></span>
      <div><h3>{{ selected.title }}</h3><p>{{ t('pending') }}</p></div>
    </section>
  </section>
</template>

<style scoped>
.steel-standards-backdrop{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:20px;background:#11283d99}
.steel-standards-dialog{width:min(100%,660px);max-height:90vh;overflow-y:auto;padding:25px;border:1px solid var(--surface-border);border-radius:14px;background:var(--workspace-bg);color:#233b55;box-shadow:0 20px 60px #081f3655}
.steel-standards-header{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}
.steel-standards-header h3{font-size:23px;margin:8px 0;color:#213c57}
.steel-standards-header small{font-size:12px;color:#6a8597}
.steel-standards-header p{font-size:15px;line-height:1.55;color:var(--muted-ink);margin:0}
.steel-standards-close{width:37px;min-width:37px;height:37px;font-size:26px;cursor:pointer;color:#314e6b;border-radius:8px;border:1px solid var(--surface-border);background:var(--surface-bg)}
.steel-standards-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:21px}
.steel-standards-grid button{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:102px;padding:17px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface-bg);color:#546c81;text-align:left;cursor:not-allowed}
.steel-standards-grid button strong{display:block;font-size:17px}
.steel-standards-grid button small{display:block;margin-top:8px;font-size:12px}
.steel-standards-grid button:disabled{opacity:.65}
.steel-standards-grid button.ready{background:#e4f1f3;border-color:#5e9ca7;color:#244c67;cursor:pointer}
.steel-standards-grid button.ready:hover,.steel-standards-grid button.ready:focus-visible{background:#cfe9ed;outline:2px solid #4e8cb1}
.steel-standards-warning{margin:17px 0 0;font-size:12px;color:#91651f;line-height:1.6}
@media(max-width:600px){.steel-standards-grid{grid-template-columns:1fr}.steel-standards-grid button{min-height:78px}.steel-standards-dialog{padding:16px}}

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
