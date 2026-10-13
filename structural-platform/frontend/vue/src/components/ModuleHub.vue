<script setup>
import { computed, reactive } from 'vue'
import { copy } from '../i18n'
import { moduleGroups, moduleHref } from '../modules'
import { demoMode } from '../api'
import SteelDesignView from './SteelDesignView.vue'
import GeometryWorkbench from './GeometryWorkbench.vue'
import LibraryBrowser from './LibraryBrowser.vue'

const homeHref = import.meta.env.BASE_URL
const props = defineProps({ moduleCode: { type: String, required: true }, user: { type: Object, required: true }, isAdmin: Boolean })
const locale = defineModel('locale', { type: String, required: true })
const emit = defineEmits(['home', 'open-admin', 'sign-out'])
const words = {
  vi: { navigation: 'Chức năng chính', home: 'Trang chính', tool: 'Chọn chức năng', choose: 'Chọn một mục…', pending: 'Danh sách sơ bộ. Chức năng này đang chờ triển khai; chưa có kết quả tính toán.', beam: 'Dầm BTCT', column: 'Cột BTCT', slab: 'Sàn BTCT', foundation: 'Móng BTCT', sap: 'Nhập dữ liệu SAP2000', etabs: 'Nhập dữ liệu ETABS', cases: 'Trường hợp tải', combinations: 'Tổ hợp tải', wind: 'Tải gió', research: 'Nghiên cứu mô hình', nonlinear: 'Phân tích phi tuyến', optimization: 'Tối ưu kết cấu' },
  en: { navigation: 'Main modules', home: 'Home', tool: 'Select a tool', choose: 'Choose an option…', pending: 'Preliminary options. This tool is awaiting implementation; calculation results are not available.', beam: 'RC beam', column: 'RC column', slab: 'RC slab', foundation: 'RC foundation', sap: 'Import SAP2000 data', etabs: 'Import ETABS data', cases: 'Load cases', combinations: 'Load combinations', wind: 'Wind loads', research: 'Model research', nonlinear: 'Nonlinear analysis', optimization: 'Structural optimization' },
}
const t = key => words[locale.value][key] ?? copy[locale.value][key] ?? copy.en[key] ?? key
const currentGroup = computed(() => moduleGroups.find(group => group.code === props.moduleCode))
const selectedTools = reactive({ concrete: '', analysis: '', loads: '', future: '' })
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
    <GeometryWorkbench v-else-if="moduleCode === 'analysis'" :locale="locale" />
    <section v-else-if="moduleCode === 'library'" class="module-panel"><LibraryBrowser :locale="locale" :can-edit="false" /></section>
    <section v-else class="module-panel pending-panel">
      <label class="pending-selector"><span>{{ t('tool') }}</span><select v-model="selectedTools[moduleCode]"><option value="">{{ t('choose') }}</option><option v-for="tool in tools[moduleCode]" :key="tool" :value="tool">{{ t(tool) }}</option></select></label>
      <p class="pending-note" role="status">{{ t('pending') }}</p>
    </section>
    <p v-if="demoMode" class="demo-notice" role="note">{{ t('demoNotice') }}</p>
  </main>
</template>

<style scoped>
.module-page { max-width: 1180px; padding: 0 28px 40px; margin: auto; }
.module-topbar { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.module-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.module-navigation { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; padding: 6px; border: 1px solid var(--surface-border); background: var(--surface-bg); border-radius: 10px; }
.module-navigation a { text-align: center; display: flex; justify-content: center; align-items: center; padding: 13px 9px; border-radius: 6px; color: #547491; font-size: 13px; line-height: 1.5; text-decoration: none; transition: background .15s, color .15s; }
.module-navigation a[aria-current="page"], .module-navigation a:hover, .module-navigation a:focus-visible { color: white; background: #23395d; }
.module-heading { padding: 32px 0 22px; }.module-heading h1 { font-size: 26px; }.module-heading p { font-size: 14px; margin: 10px 0 0; color: var(--muted-ink); }
.module-panel { background: var(--surface-bg); border: 1px solid var(--surface-border); padding: 24px; border-radius: 12px; }
.pending-selector { display: flex; flex-direction: column; gap: 10px; max-width: 400px; font-size: 14px; color: #4b6a88; }
.pending-note { font-size: 14px; line-height: 1.8; color: var(--muted-ink); margin: 24px 0 0; }
@media (max-width: 900px) { .module-navigation { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 600px) { .module-page { padding: 0 16px 30px; }.module-topbar { align-items: flex-start; flex-direction: column; padding: 20px 0; gap: 12px; }.module-actions { width: 100%; justify-content: space-between; gap: 4px; }.module-actions .quiet-button { padding: 7px 4px; font-size: 12px; }.module-navigation { grid-template-columns: repeat(2, minmax(0, 1fr)); }.module-heading h1 { font-size: 23px; }.module-panel { padding: 16px 12px; } }
</style>
