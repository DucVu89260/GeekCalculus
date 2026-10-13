<script setup>
import { nextTick, ref } from 'vue'
import { useWorkspace } from '../composables/useWorkspace'
import { moduleGroups as groups, moduleHref } from '../modules'

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
        <p>{{ t('platformSubtitle') }}</p>
        <svg class="branch-icon" aria-hidden="true" viewBox="0 0 32 32"><path d="M10 7v16m0-6c10 0 12-3 12-10"/><circle cx="10" cy="24" r="3"/><circle cx="22" cy="7" r="3"/></svg>
      </div>
      <div class="module-grid">
        <a v-for="group in groups" :key="group.code" class="module-card" :href="moduleHref(group.code)" target="_blank" rel="noopener noreferrer">
          <span class="module-copy"><strong>{{ t(group.title) }}</strong><span>{{ t(group.description) }}</span></span>
          <svg class="module-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
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
