<script setup>
import { computed, reactive, ref } from 'vue'
import { copy } from '../i18n'
import { moduleGroups, moduleHref } from '../modules'
import { demoMode } from '../api'
import SteelDesignView from './SteelDesignView.vue'
import SectionPropertiesPanel from './SectionPropertiesPanel.vue'
import LibraryBrowser from './LibraryBrowser.vue'

const homeHref = import.meta.env.BASE_URL
const props = defineProps({ moduleCode: { type: String, required: true }, user: { type: Object, required: true }, isAdmin: Boolean })
const locale = defineModel('locale', { type: String, required: true })
const emit = defineEmits(['home', 'open-admin', 'sign-out'])
const words = {
  vi: { navigation: 'Chức năng chính', home: 'Trang chính', tool: 'Chọn chức năng', choose: 'Chọn một mục…', pending: 'Danh sách sơ bộ. Chức năng này đang chờ triển khai; chưa có kết quả tính toán.', beam: 'Dầm BTCT', column: 'Cột BTCT', slab: 'Sàn BTCT', foundation: 'Móng BTCT', sap: 'Nhập dữ liệu SAP2000', etabs: 'Nhập dữ liệu ETABS', cases: 'Trường hợp tải', combinations: 'Tổ hợp tải', wind: 'Tải gió', research: 'Nghiên cứu mô hình', nonlinear: 'Phân tích phi tuyến', optimization: 'Tối ưu kết cấu', concreteSetup: 'Thiết lập thiết kế', sectionProperties: 'Đặc trưng tiết diện' },
  en: { navigation: 'Main modules', home: 'Home', tool: 'Select a tool', choose: 'Choose an option…', pending: 'Preliminary options. This tool is awaiting implementation; calculation results are not available.', beam: 'RC beam', column: 'RC column', slab: 'RC slab', foundation: 'RC foundation', sap: 'Import SAP2000 data', etabs: 'Import ETABS data', cases: 'Load cases', combinations: 'Load combinations', wind: 'Wind loads', research: 'Model research', nonlinear: 'Nonlinear analysis', optimization: 'Structural optimization', concreteSetup: 'Design setup', sectionProperties: 'Section properties' },
}
const t = key => words[locale.value][key] ?? copy[locale.value][key] ?? copy.en[key] ?? key
const currentGroup = computed(() => moduleGroups.find(group => group.code === props.moduleCode))
const selectedTools = reactive({ concrete: '', analysis: '', loads: '', future: '' })
const concreteView = ref('design')
const tools = { concrete: ['beam', 'column', 'slab', 'foundation'], analysis: ['sap', 'etabs'], loads: ['cases', 'combinations', 'wind'], future: ['research', 'nonlinear', 'optimization'] }
function navigate(code) { window.location.hash = `/modules/${code}` }
</script>

<template>
  <main class="module-page">
    <header class="module-topbar">
      <a class="wordmark" :href="homeHref" @click.prevent="emit('home')">GeekCalculus<span class="brand-dot">.</span></a>
      <div class="module-actions">
        <button type="button" class="quiet-button" @click="emit('home')">{{ t('home') }}</button>
        <button v-if="isAdmin" type="button" class="quiet-button" @click="emit('open-admin')">{{ t('openAdmin') }}</button>
        <div class="language-switch" role="group" :aria-label="t('language')"><button type="button" :aria-pressed="locale === 'vi'" @click="locale = 'vi'">VI</button><button type="button" :aria-pressed="locale === 'en'" @click="locale = 'en'">EN</button></div>
        <button type="button" class="quiet-button" @click="emit('sign-out')">{{ t('signOut') }}</button>
      </div>
    </header>
    <nav class="module-navigation" :aria-label="t('navigation')">
      <a v-for="group in moduleGroups" :key="group.code" :href="moduleHref(group.code)" :aria-current="moduleCode === group.code ? 'page' : undefined">{{ t(group.title) }}</a>
    </nav>
    <header class="module-heading"><h1>{{ t(currentGroup.title) }}</h1><p>{{ t(currentGroup.description) }}</p></header>
    <SteelDesignView v-if="moduleCode === 'steel'" :locale="locale" @open-library="navigate('library')" />
    <SectionPropertiesPanel v-else-if="moduleCode === 'analysis'" :locale="locale" />
    <section v-else-if="moduleCode === 'library'" class="module-panel"><LibraryBrowser :locale="locale" :can-edit="false" /></section>
    <section v-else-if="moduleCode === 'concrete'" class="module-panel concrete-module-panel">
      <div class="concrete-module-tabs" role="tablist" :aria-label="t('groupConcrete')">
        <button type="button" role="tab" :aria-selected="concreteView === 'design'" :class="{ active: concreteView === 'design' }" @click="concreteView = 'design'">{{ t('concreteSetup') }}</button>
        <button type="button" role="tab" :aria-selected="concreteView === 'section-properties'" :class="{ active: concreteView === 'section-properties' }" @click="concreteView = 'section-properties'">{{ t('sectionProperties') }}</button>
      </div>
      <div v-if="concreteView === 'design'" class="concrete-design-setup" role="tabpanel">
        <label class="pending-selector"><span>{{ t('tool') }}</span><select v-model="selectedTools.concrete"><option value="">{{ t('choose') }}</option><option v-for="tool in tools.concrete" :key="tool" :value="tool">{{ t(tool) }}</option></select></label>
        <p class="pending-note" role="status">{{ t('pending') }}</p>
      </div>
      <div v-show="concreteView === 'section-properties'" class="concrete-section-properties" role="tabpanel">
        <SectionPropertiesPanel :locale="locale" asymmetric-only />
      </div>
    </section>
    <section v-else class="module-panel pending-panel">
      <label class="pending-selector"><span>{{ t('tool') }}</span><select v-model="selectedTools[moduleCode]"><option value="">{{ t('choose') }}</option><option v-for="tool in tools[moduleCode]" :key="tool" :value="tool">{{ t(tool) }}</option></select></label>
      <p class="pending-note" role="status">{{ t('pending') }}</p>
    </section>
    <p v-if="demoMode" class="demo-notice" role="note">{{ t('demoNotice') }}</p>
  </main>
</template>

<style scoped>
.module-page { width: calc(100% - 32px); max-width: 1180px; min-height: calc(100vh - 40px); padding: 0 28px 40px; margin: 16px auto 24px; border: 1px solid var(--surface-border); border-radius: 16px; background: var(--workspace-bg); box-shadow: 0 8px 24px #243b570a; }
.module-topbar { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.module-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.module-navigation { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; padding: 6px; border: 1px solid var(--surface-border); background: var(--surface-bg); border-radius: 10px; }
.module-navigation a { text-align: center; display: flex; justify-content: center; align-items: center; padding: 13px 9px; border-radius: 6px; color: #547491; font-size: 13px; line-height: 1.5; text-decoration: none; transition: background .15s, color .15s; }
.module-navigation a[aria-current="page"], .module-navigation a:hover, .module-navigation a:focus-visible { color: white; background: #23395d; }
.module-heading { padding: 32px 0 22px; }.module-heading h1 { font-size: 26px; }.module-heading p { font-size: 14px; margin: 10px 0 0; color: var(--muted-ink); }
.module-panel { background: var(--surface-bg); border: 1px solid var(--surface-border); padding: 24px; border-radius: 12px; }
.concrete-module-panel { padding: 16px; }
.concrete-module-tabs { display: flex; gap: 6px; padding: 4px; border: 1px solid var(--surface-border); border-radius: 9px; background: var(--soft-bg); }
.concrete-module-tabs button { flex: 1 1 0; min-height: 38px; padding: 8px 12px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #54718d; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; transition: background .15s, color .15s, border-color .15s; }
.concrete-module-tabs button:hover, .concrete-module-tabs button.active, .concrete-module-tabs button:focus-visible { border-color: #23395d; background: #23395d; color: white; }
.concrete-module-tabs button:focus-visible { outline: 3px solid #8bb6df; outline-offset: 2px; }
.concrete-design-setup { padding-top: 20px; }
.concrete-section-properties { padding-top: 18px; }
.pending-selector { display: flex; flex-direction: column; gap: 10px; max-width: 400px; font-size: 14px; color: #4b6a88; }
.pending-note { font-size: 14px; line-height: 1.8; color: var(--muted-ink); margin: 24px 0 0; }
@media (max-width: 900px) { .module-navigation { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 600px) { .module-page { width: calc(100% - 16px); min-height: calc(100vh - 20px); padding: 0 16px 30px; margin: 8px auto 12px; border-radius: 12px; }.module-topbar { align-items: flex-start; flex-direction: column; padding: 20px 0; gap: 12px; }.module-actions { width: 100%; justify-content: space-between; gap: 4px; }.module-actions .quiet-button { padding: 7px 4px; font-size: 12px; }.module-navigation { grid-template-columns: repeat(2, minmax(0, 1fr)); }.module-heading h1 { font-size: 23px; }.module-panel { padding: 16px 12px; }.concrete-module-panel { padding: 12px 9px; }.concrete-module-tabs button { padding: 8px 4px; font-size: 10px; } }
</style>
