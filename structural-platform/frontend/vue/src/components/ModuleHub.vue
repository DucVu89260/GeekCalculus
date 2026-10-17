<script setup>
import { computed, defineAsyncComponent, reactive } from 'vue'
import { copy } from '../i18n'
import { moduleGroups, groupTools, moduleHref, resolveModuleRoute } from '../modules'
import { demoMode } from '../api'
import SteelDesignView from './SteelDesignView.vue'
import CfsDesignView from './CfsDesignView.vue'
import SectionPropertiesPanel from './SectionPropertiesPanel.vue'
import LibraryBrowser from './LibraryBrowser.vue'
import StructureIllustration from './StructureIllustration.vue'
import ComboGeneratorView from './ComboGeneratorView.vue'
import WindLoadView from './WindLoadView.vue'

// Keep the PDF reader and math fonts out of the ordinary design workspace load.
const StandardsExplorer = defineAsyncComponent(() => import('./StandardsExplorer.vue'))

const homeHref = import.meta.env.BASE_URL
const props = defineProps({ moduleCode: { type: String, required: true }, user: { type: Object, required: true }, isAdmin: Boolean })
const locale = defineModel('locale', { type: String, required: true })
const emit = defineEmits(['home', 'open-admin', 'sign-out'])
const words = {
  vi: { navigation: 'Chức năng chính', home: 'Trang chính', tool: 'Chọn chức năng', choose: 'Chọn một mục…', pending: 'Danh sách sơ bộ. Chức năng này đang chờ triển khai; chưa có kết quả tính toán.', beam: 'Dầm BTCT', column: 'Cột BTCT', slab: 'Sàn BTCT', foundation: 'Móng BTCT', research: 'Nghiên cứu mô hình', nonlinear: 'Phân tích phi tuyến', optimization: 'Tối ưu kết cấu' },
  en: { navigation: 'Main modules', home: 'Home', tool: 'Select a tool', choose: 'Choose an option…', pending: 'Preliminary options. This tool is awaiting implementation; calculation results are not available.', beam: 'RC beam', column: 'RC column', slab: 'RC slab', foundation: 'RC foundation', research: 'Model research', nonlinear: 'Nonlinear analysis', optimization: 'Structural optimization' },
}
const t = key => words[locale.value][key] ?? copy[locale.value][key] ?? copy.en[key] ?? key
const currentRoute = computed(() => resolveModuleRoute(props.moduleCode))
const currentGroup = computed(() => currentRoute.value.group)
const currentTool = computed(() => currentRoute.value.tool)
const navigationTools = computed(() => groupTools[currentGroup.value.code])
const selectedTools = reactive({ concrete: '', future: '' })
const tools = { concrete: ['beam', 'column', 'slab', 'foundation'], future: ['research', 'nonlinear', 'optimization'] }
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
    <nav class="workspace-group-navigation" :aria-label="t('structureNavigation')">
      <a v-for="group in moduleGroups" :key="group.code" :href="moduleHref(group.code)" :class="{ active: currentGroup.code === group.code }">{{ t(group.title) }}</a>
    </nav>
    <nav class="module-navigation" :class="{ 'loading-navigation': currentGroup.code === 'loads', 'steel-navigation': currentGroup.code === 'steel' }" :aria-label="t('navigation')">
      <a v-for="tool in navigationTools" :key="tool.code" :href="moduleHref(tool.route)" :aria-current="currentTool.code === tool.code ? 'page' : undefined">{{ t(tool.title) }}</a>
    </nav>
    <header class="module-heading"><span class="workspace-group-label">{{ t(currentGroup.title) }}</span><h1>{{ t(currentTool.title) }}</h1><p>{{ t(currentTool.description) }}</p></header>
    <SteelDesignView v-if="currentGroup.code === 'steel' && currentTool.code === 'design'" :locale="locale" />
    <CfsDesignView v-else-if="currentGroup.code === 'steel' && currentTool.code === 'cfs'" :locale="locale" :user="user" :show-add-in="moduleCode === 'steel/cfs/lapping-node'" />
    <SectionPropertiesPanel v-else-if="currentTool.code === 'section-properties'" :key="currentGroup.code" :locale="locale" />
    <section v-else-if="currentTool.code === 'standards'" class="module-panel"><p class="standards-breadcrumb"><a :href="moduleHref('steel')">Steel Design</a> / <a :href="moduleHref('steel/library')">Library</a> / <strong>Standards</strong></p><StandardsExplorer :locale="locale" :can-edit="isAdmin" /></section>
    <section v-else-if="currentTool.code === 'library'" class="module-panel"><LibraryBrowser :key="currentGroup.code" :locale="locale" :can-edit="false" /></section>
    <section v-else-if="currentGroup.code === 'concrete' && currentTool.code === 'design'" class="module-panel concrete-module-panel">
      <div class="concrete-design-setup">
        <label class="pending-selector"><span>{{ t('tool') }}</span><select v-model="selectedTools.concrete"><option value="">{{ t('choose') }}</option><option v-for="tool in tools.concrete" :key="tool" :value="tool">{{ t(tool) }}</option></select></label>
        <p class="pending-note" role="status">{{ t('pending') }}</p>
      </div>
    </section>
    <WindLoadView v-else-if="currentGroup.code === 'loads' && currentTool.code === 'wind'" :locale="locale" />
    <ComboGeneratorView v-else-if="currentGroup.code === 'loads' && currentTool.code === 'combo'" :locale="locale" :demo-mode="demoMode" :user="user" />
    <section v-else-if="currentGroup.code === 'loads'" class="module-panel loading-pending-panel" :data-loading-tool="currentTool.code">
      <StructureIllustration group="loads" :label="t(currentTool.title)" />
      <div class="loading-pending-copy">
        <span class="tool-pending-badge">{{ t(currentTool.code === 'combo' ? 'integrationPending' : 'toolPending') }}</span>
        <h2>{{ t(currentTool.title) }}</h2>
        <p>{{ t(currentTool.description) }}</p>
        <p class="pending-note" role="status">{{ t('loadingPending') }}</p>
      </div>
    </section>
    <section v-else class="module-panel pending-panel">
      <label class="pending-selector"><span>{{ t('tool') }}</span><select v-model="selectedTools.future"><option value="">{{ t('choose') }}</option><option v-for="tool in tools.future" :key="tool" :value="tool">{{ t(tool) }}</option></select></label>
      <p class="pending-note" role="status">{{ t('pending') }}</p>
    </section>
    <p v-if="demoMode" class="demo-notice" role="note">{{ t('demoNotice') }}</p>
  </main>
</template>

<style scoped>
.module-page { width: calc(100% - 32px); max-width: 1280px; min-height: calc(100vh - 40px); padding: 0 28px 40px; margin: 16px auto 24px; border: 1px solid var(--surface-border); border-radius: 16px; background: var(--workspace-bg); box-shadow: 0 8px 24px #243b570a; }
.module-topbar { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.module-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.workspace-group-navigation { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.workspace-group-navigation a { padding: 7px 14px; border: 1px solid var(--surface-border); border-radius: 7px; background: var(--workspace-bg); color: #4b6a88; font-size: 15px; font-weight: 700; text-decoration: none; transition: background .15s, color .15s; }
.workspace-group-navigation a.active { border-color: #9cb0c6; background: var(--navigation-bg); color: #23395d; }
.workspace-group-navigation a:hover, .workspace-group-navigation a:focus-visible { background: #23395d; color: #fff; }
.module-navigation { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; padding: 6px; border: 1px solid var(--surface-border); background: var(--surface-bg); border-radius: 10px; }
.module-navigation.loading-navigation { grid-template-columns: repeat(6, minmax(0, 1fr)); } .module-navigation.steel-navigation { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.module-navigation a { text-align: center; display: flex; justify-content: center; align-items: center; padding: 13px 9px; border-radius: 6px; color: #547491; font-size: 16px; line-height: 1.5; text-decoration: none; transition: background .15s, color .15s; }
.module-navigation a[aria-current="page"], .module-navigation a:hover, .module-navigation a:focus-visible { color: white; background: #23395d; }
.module-heading { padding: 28px 0 22px; }.module-heading h1 { font-size: 29px; }.module-heading p { font-size: 17px; margin: 10px 0 0; color: var(--muted-ink); }
.workspace-group-label { display: block; margin-bottom: 6px; color: #647f9b; font-size: 13px; font-weight: 700; letter-spacing: .05em; }
.standards-breadcrumb { color: #617d97; margin: 0 0 14px; font-size: 14px; }.standards-breadcrumb a { color: #365c81; }.module-panel { background: var(--surface-bg); border: 1px solid var(--surface-border); padding: 24px; border-radius: 12px; }
.concrete-module-panel { padding: 20px; }
.pending-selector { display: flex; flex-direction: column; gap: 10px; max-width: 400px; font-size: 17px; color: #4b6a88; }
.pending-note { font-size: 17px; line-height: 1.8; color: var(--muted-ink); margin: 24px 0 0; }
.loading-pending-panel { display: flex; align-items: center; gap: 30px; }
.loading-pending-panel .structure-illustration { width: min(36%, 300px); flex: 0 0 auto; }
.loading-pending-copy { min-width: 0; }.loading-pending-copy h2 { margin: 15px 0 8px; }.loading-pending-copy > p { font-size: 17px; color: var(--muted-ink); }
.tool-pending-badge { display: inline-block; padding: 4px 10px; border: 1px solid #c7d3e0; border-radius: 20px; background: var(--navigation-bg); color: #365579; font-size: 14px; font-weight: 650; }
@media (max-width: 900px) { .module-navigation.steel-navigation { grid-template-columns: repeat(3, minmax(0, 1fr)); } .module-navigation.loading-navigation { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 600px) { .module-page { width: calc(100% - 16px); min-height: calc(100vh - 20px); padding: 0 16px 30px; margin: 8px auto 12px; border-radius: 12px; }.module-topbar { align-items: flex-start; flex-direction: column; padding: 20px 0; gap: 12px; }.module-actions { width: 100%; justify-content: space-between; gap: 4px; }.module-actions .quiet-button { padding: 7px 4px; font-size: 15px; }.workspace-group-navigation { gap: 5px; }.workspace-group-navigation a { padding: 7px 9px; font-size: 14px; }.module-navigation, .module-navigation.loading-navigation, .module-navigation.steel-navigation { grid-template-columns: repeat(2, minmax(0, 1fr)); }.module-heading h1 { font-size: 26px; }.module-panel { padding: 16px 12px; }.concrete-module-panel { padding: 16px 12px; }.loading-pending-panel { flex-direction: column; align-items: stretch; gap: 18px; }.loading-pending-panel .structure-illustration { width: 100%; max-width: 280px; align-self: center; } }
</style>
