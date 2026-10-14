<script setup>
import { computed, ref } from 'vue'
import SectionGeometrySketch from './SectionGeometrySketch.vue'
import HIDoublySymmetricView from './HIDoublySymmetricView.vue'
import { SECTION_PROFILES } from '../sectional-properties/catalog.js'

const props = defineProps({ locale: { type: String, required: true } })
const selectedId = ref('')
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
        :aria-label="component.title" :aria-pressed="selectedId === component.id" @click="selectedId = component.id">
        <span class="steel-component-image"><SectionGeometrySketch :profile-id="component.id" :dimensions="component.profile.default_dimensions" :locale="locale" thumbnail /></span>
        <span class="steel-component-copy"><strong>{{ component.title }}</strong><span>{{ t(component.id) }}</span></span>
        <svg class="steel-component-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
      </button>
    </div>
    <HIDoublySymmetricView v-if="selected?.id === 'symmetric_i'" :locale="locale" />
    <section v-else-if="selected" class="steel-component-workspace" :data-component="selected.id" :aria-label="selected.title" aria-live="polite">
      <span class="steel-component-workspace-image" aria-hidden="true"><SectionGeometrySketch :profile-id="selected.id" :dimensions="selected.profile.default_dimensions" :locale="locale" thumbnail /></span>
      <div><h3>{{ selected.title }}</h3><p>{{ t('pending') }}</p></div>
    </section>
  </section>
</template>

<style scoped>
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
