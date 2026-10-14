<script setup>
import { ref } from 'vue'
import SectionPropertiesPanel from './SectionPropertiesPanel.vue'
import SteelComponentMenu from './SteelComponentMenu.vue'
import SteelConnectionMenu from './SteelConnectionMenu.vue'

const props = defineProps({ locale: { type: String, required: true } })

const text = {
  vi: {
    title: 'Thiết kế kết cấu thép',
    subtitle: 'Thiết lập sơ bộ cấu kiện và liên kết thép.',
    status: 'Sơ bộ · Chưa sẵn sàng tính toán',
    componentSubtitle: 'Chọn loại tiết diện',
    connectionSubtitle: 'Chọn nhóm liên kết',
    sectionCalculator: 'Đặc trưng tiết diện',
    sectionCalculatorSubtitle: 'Tính chất hình học · Không lưu vào dự án',
  },
  en: {
    title: 'Steel design',
    subtitle: 'Set up preliminary steel members and connections.',
    status: 'Preliminary · Calculation is not ready',
    componentSubtitle: 'Choose a section type',
    connectionSubtitle: 'Choose a connection group',
    sectionCalculator: 'Section properties',
    sectionCalculatorSubtitle: 'Geometric calculator · Not saved to a project',
  },
}

const t = (key) => text[props.locale]?.[key] ?? text.en[key] ?? key
const activeTab = ref('component')
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

    <SteelComponentMenu v-show="activeTab === 'component'" :locale="locale" />

    <SteelConnectionMenu v-show="activeTab === 'connection'" :locale="locale" />

    <div v-show="activeTab === 'section-properties'" class="steel-design-properties-panel" role="tabpanel">
      <SectionPropertiesPanel :locale="locale" />
    </div>
  </section>
</template>

<style scoped>
.steel-design { color: #233850; }
.steel-design-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 4px 2px 20px; }
.steel-design-eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #4977a4; font-size: 14px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.steel-design-eyebrow::before { width: 7px; height: 7px; border-radius: 50%; background: #d4973d; content: ''; }
.steel-design-heading h2 { margin: 7px 0 5px; color: #203b58; font-size: 26px; letter-spacing: -.035em; }
.steel-design-heading p { margin: 0; color: var(--muted-ink); font-size: 16px; }
.steel-design-mark { display: flex; align-items: center; justify-content: center; gap: 6px; width: 48px; height: 48px; border: 1px solid var(--surface-border); border-radius: 14px; background: linear-gradient(145deg, var(--surface-bg), var(--page-bg)); }
.steel-design-mark span { display: block; width: 4px; border-radius: 3px; background: #6488ad; transform: skew(-20deg); }
.steel-design-mark span:nth-child(1) { height: 18px; }.steel-design-mark span:nth-child(2) { height: 28px; background: #355e86; }.steel-design-mark span:nth-child(3) { height: 22px; }
.steel-design-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 5px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--soft-bg); }
.steel-design-tabs button { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; padding: 13px 16px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: #4e6984; cursor: pointer; text-align: left; transition: color .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease; }
.steel-design-tabs button strong { font-size: 16px; font-weight: 700; }
.steel-design-tabs button small { color: inherit; font-size: 14px; opacity: .78; }
.steel-design-tabs button:hover, .steel-design-tabs button.active { border-color: #23395d; background: #23395d; color: #fff; box-shadow: 0 4px 12px #23395d26; }
.steel-design-tabs button:focus-visible { outline: 3px solid #8bb6df; outline-offset: 2px; }
.steel-design-properties-panel { margin-top: 14px; }
@media (max-width: 560px) { .steel-design-tabs { grid-template-columns: 1fr; }.steel-design-header { align-items: flex-start; padding-bottom: 15px; }.steel-design-heading h2 { font-size: 23px; }.steel-design-mark { flex: 0 0 42px; width: 42px; height: 42px; }.steel-design-tabs button { padding: 11px 10px; }.steel-design-tabs button small { font-size: 13px; }}
@media (prefers-reduced-motion: reduce) { .steel-design-tabs button { transition: none; } }
</style>
