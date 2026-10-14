<script setup>
import { nextTick, ref } from 'vue'
import { useWorkspace } from '../composables/useWorkspace'
import { moduleGroups as groups, moduleHref } from '../modules'
import StructureIllustration from './StructureIllustration.vue'

defineProps({ user: { type: Object, required: true }, isAdmin: { type: Boolean, default: false } })
const emit = defineEmits(['sign-out', 'open-admin'])
const locale = defineModel('locale', { type: String, required: true })
const { demoMode, t, apiStatus, catalogError, projectError, createError, projectLoading, creating, projectName, projects, totalProjects, currentPage, lastPage, formErrorKey, selections, refresh, loadCatalog, loadProjects, selectOptions, optionName, statusName, formatDate, createProject, changePage } = useWorkspace(locale)

const projectOpen = ref(false)

async function showProjects() {
  projectOpen.value = true
  await loadCatalog()
  await nextTick()
  document.getElementById('project-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

</script>

<template>
  <main class="platform-page">
    <header class="topbar">
      <a class="wordmark" href="#home">GeekCalculus<span class="brand-dot">.</span></a>
      <div class="topbar-actions">
        <button class="quiet-button" type="button" @click="showProjects">{{ t('projects') }}</button>
        <button v-if="isAdmin" class="quiet-button admin-switch-button" type="button" @click="emit('open-admin')">{{ t('openAdmin') }}</button>
        <div class="language-switch" role="group" :aria-label="t('language')">
          <button type="button" :aria-pressed="locale === 'vi'" @click="locale = 'vi'">VI</button>
          <button type="button" :aria-pressed="locale === 'en'" @click="locale = 'en'">EN</button>
        </div>
        <span class="signed-in-label">{{ user.name || user.email }}</span>
        <button class="quiet-button sign-out-button" type="button" @click="emit('sign-out')">{{ t('signOut') }}</button>
      </div>
    </header>

    <section id="home" class="platform-card" :aria-label="t('modulesLabel')">
      <div class="platform-heading">
        <h1>GeekCalculus</h1>
        <p>{{ t('structureIntro') }}</p>
        <h2 class="structure-heading">{{ t('structureChoose') }}</h2>
      </div>
      <div class="structure-grid">
        <a v-for="(group, index) in groups" :key="group.code" class="module-card structure-card" :href="moduleHref(group.code)" target="_blank" rel="noopener noreferrer">
          <span class="structure-number" aria-hidden="true">0{{ index + 1 }} / GEEKCALCULUS</span>
          <StructureIllustration :group="group.code" :label="t(group.title)" />
          <span class="module-copy"><strong>{{ t(group.title) }}</strong><span>{{ t(group.description) }}</span></span>
          <span class="structure-enter">{{ t('structureEnter') }}<svg class="module-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></span>
        </a>
      </div>
    </section>

    <div class="platform-footer">
      <p>{{ t('selectGroup') }}</p>
      <button type="button" class="primary-button" @click="showProjects">{{ t('newProject') }}</button>
    </div>
    <p v-if="demoMode" class="demo-notice" role="note">{{ t('demoNotice') }}</p>
    <p class="service-status" :class="apiStatus" role="status"><span class="status-dot"></span>{{ t(apiStatus === 'online' ? 'apiOnline' : apiStatus === 'offline' ? 'apiOffline' : 'apiChecking') }}</p>

    <section v-if="projectOpen" id="project-workspace" class="project-workspace">
      <div class="section-heading"><div><h2>{{ t('projectSetup') }}</h2><p>{{ t('setupText') }}</p></div><button type="button" class="quiet-button" @click="projectOpen = false">{{ t('close') }}</button></div>
      <form class="project-form" @submit.prevent="createProject">
        <label class="field full-field"><span>{{ t('projectName') }}</span><input v-model="projectName" name="name" type="text" maxlength="160" :placeholder="t('projectNamePlaceholder')" /></label>
        <label class="field"><span>{{ t('projectType') }}</span><select v-model="selections.project_type"><option v-for="option in selectOptions('project_types')" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <label class="field"><span>{{ t('module') }}</span><select v-model="selections.module"><option v-for="option in selectOptions('modules')" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <label class="field"><span>{{ t('standard') }}</span><select v-model="selections.standard"><option v-for="option in selectOptions('standards')" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <label class="field"><span>{{ t('material') }}</span><select v-model="selections.material"><option v-for="option in selectOptions('materials')" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <label class="field"><span>{{ t('units') }}</span><select v-model="selections.unit"><option v-for="option in selectOptions('units')" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <div class="form-actions full-field"><p>{{ t('projectHint') }}</p><button type="submit" class="primary-button" :disabled="creating || !selectOptions('materials').length">{{ creating ? t('creating') : t('create') }}</button></div>
        <p v-if="!selectOptions('materials').length" class="error-message full-field" role="status">{{ t('emptyMaterialCatalog') }}</p>
        <p v-if="formErrorKey" class="error-message full-field" role="alert">{{ t(formErrorKey) }}</p><p v-else-if="createError" class="error-message full-field" role="alert">{{ t('errorCreate') }}</p>
      </form>
      <div class="projects-heading section-heading"><h2>{{ t('recentProjects') }} <span class="count">{{ totalProjects }}</span></h2><button type="button" class="quiet-button" @click="refresh">{{ t('viewAll') }}</button></div>
      <p v-if="projectLoading" class="empty-state">{{ t('loading') }}</p>
      <div v-else-if="projectError" class="empty-state"><p class="error-message">{{ t('errorProjects') }}</p><button type="button" class="quiet-button" @click="loadProjects()">{{ t('retry') }}</button></div>
      <div v-else-if="!projects.length" class="empty-state"><strong>{{ t('emptyProjects') }}</strong><p>{{ t('emptyProjectsHint') }}</p></div>
      <div v-else class="project-list"><article v-for="project in projects" :key="project.id" class="project-row"><div><h3>{{ project.name }}</h3><p>{{ optionName('module', project.module) }} · {{ optionName('standard', project.standard) }}</p></div><div class="project-meta"><span>{{ statusName(project.status) }}</span><time>{{ formatDate(project.created_at) }}</time></div></article></div>
      <div v-if="lastPage > 1" class="pagination"><button type="button" class="quiet-button" :disabled="currentPage <= 1 || projectLoading" @click="changePage(currentPage - 1)">{{ t('previousPage') }}</button><span>{{ t('page') }} {{ currentPage }} / {{ lastPage }}</span><button type="button" class="quiet-button" :disabled="currentPage >= lastPage || projectLoading" @click="changePage(currentPage + 1)">{{ t('nextPage') }}</button></div>
      <p v-if="catalogError" class="error-message" role="alert">{{ t('errorCatalog') }}</p>
    </section>
    <footer class="page-footer">{{ t('footerBrand') }}</footer>
  </main>
</template>

<style scoped>
.structure-heading { margin-top: 18px; font-size: 21px; }
.structure-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-top: 28px; }
.structure-card { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 18px; min-width: 0; padding: 22px; background: var(--workspace-bg); border-radius: 16px; box-shadow: 0 3px 12px #23395d08; transition: transform .22s ease, box-shadow .22s ease, background .18s ease, color .18s ease; }
.structure-number { color: var(--muted-ink); font-size: 12px; font-weight: 700; letter-spacing: .1em; }
.structure-card .structure-illustration { transition: transform .25s ease; }
.structure-card .module-copy { flex: 1; gap: 8px; }
.structure-card .module-copy strong { font-size: 25px; color: #23395d; }
.structure-card .module-copy > span { font-size: 16px; line-height: 1.65; }
.structure-enter { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid var(--surface-border); color: #365579; font-size: 15px; font-weight: 700; }
.structure-enter .module-arrow { transition: transform .2s ease; }
.structure-card:hover, .structure-card:focus-visible { transform: translateY(-6px); background: #23395d; color: #fff; box-shadow: 0 16px 30px #23395d26; }
.structure-card:hover .structure-illustration, .structure-card:focus-visible .structure-illustration { transform: scale(1.025); }
.structure-card:is(:hover, :focus-visible) :is(.structure-number, .structure-enter) { color: #fff; }
.structure-card:is(:hover, :focus-visible) .structure-enter { border-color: #ffffff30; }
.structure-card:is(:hover, :focus-visible) .module-arrow { transform: translateX(4px); stroke: #fff; }
@media (max-width: 950px) { .structure-grid { gap: 12px; }.structure-card { padding: 15px; }.structure-card .module-copy strong { font-size: 22px; } }
@media (max-width: 760px) { .structure-grid { grid-template-columns: 1fr; gap: 16px; }.structure-card { padding: 20px; gap: 14px; }.structure-card .structure-illustration { max-width: 340px; margin: 0 auto; } }
@media (prefers-reduced-motion: reduce) { .structure-card, .structure-card .structure-illustration, .structure-enter .module-arrow { transition: none; }.structure-card:is(:hover, :focus-visible), .structure-card:is(:hover, :focus-visible) .structure-illustration, .structure-card:is(:hover, :focus-visible) .module-arrow { transform: none; } }
</style>
