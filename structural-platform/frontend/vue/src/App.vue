<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { demoRequest } from './demo-api'

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const copy = {
  vi: {
    demoNotice: 'Bản demo web: dự án chỉ lưu trong trình duyệt này, chưa kết nối database Laravel. Không nhập dữ liệu cần lưu lâu dài.', demoStatus: 'Demo trên trình duyệt', browserData: 'Trình duyệt',
    brand: 'GeekCalculus', brandSub: 'KỸ THUẬT KẾT CẤU', workspace: 'Không gian làm việc',
    overview: 'Tổng quan', projects: 'Dự án', integrations: 'Tích hợp', settings: 'Cài đặt',
    workspaceLabel: 'KHÔNG GIAN LÀM VIỆC', greeting: 'Chào mừng trở lại',
    title: 'Thiết kế bắt đầu từ đây.', subtitle: 'Thiết lập dự án kết cấu của bạn và giữ mọi thông số kỹ thuật ở cùng một nơi.',
    newProject: 'Tạo dự án mới', projectCount: 'Tổng số dự án', activeModules: 'Mô-đun kết cấu',
    standards: 'Tiêu chuẩn thiết kế', apiService: 'Dịch vụ API', projectSetup: 'Thiết lập dự án',
    setupText: 'Chọn hệ kết cấu, tiêu chuẩn và đơn vị cho dự án mới.', projectName: 'Tên dự án',
    projectNamePlaceholder: 'Ví dụ: Tòa nhà văn phòng Riverside', projectType: 'Loại công trình',
    module: 'Mô-đun kết cấu', standard: 'Tiêu chuẩn thiết kế', material: 'Vật liệu',
    units: 'Hệ đơn vị', create: 'Tạo dự án', creating: 'Đang tạo dự án…',
    projectHint: 'Hiện tại, GeekCalculus hỗ trợ cấu hình và quản lý dự án. Các phép tính kết cấu chưa được bật.',
    recentProjects: 'Dự án gần đây', viewAll: 'Làm mới danh sách', loading: 'Đang tải dữ liệu…',
    previousPage: 'Trang trước', nextPage: 'Trang sau', page: 'Trang', totalProjectsSuffix: 'dự án',
    emptyProjects: 'Chưa có dự án nào', emptyProjectsHint: 'Tạo dự án đầu tiên để bắt đầu không gian làm việc kết cấu của bạn.',
    project: 'Dự án', configuration: 'Cấu hình', updated: 'Ngày tạo', status: 'Trạng thái',
    draft: 'Bản nháp', inProgress: 'Đang thực hiện', complete: 'Hoàn tất',
    integrationsTitle: 'Kết nối phần mềm', integrationsText: 'Chuẩn bị quy trình làm việc với các công cụ phân tích phổ biến.',
    available: 'Sẵn sàng kết nối', planned: 'Đang lên kế hoạch', apiOnline: 'API đang hoạt động',
    apiOffline: 'Không kết nối được API', apiChecking: 'Đang kiểm tra API',
    apiHint: 'Trạng thái máy chủ', connected: 'Đã kết nối', localeVietnamese: 'Tiếng Việt',
    localeEnglish: 'English', language: 'Ngôn ngữ', errorCatalog: 'Không tải được danh mục từ API. Đang dùng danh mục mẫu.',
    errorProjects: 'Không tải được danh sách dự án. Vui lòng thử lại.',
    errorCreate: 'Không thể tạo dự án. Vui lòng kiểm tra kết nối rồi thử lại.',
    nameRequired: 'Vui lòng nhập tên dự án.', retry: 'Thử lại', navProjects: 'Danh sách dự án',
    catalogSource: 'Dữ liệu danh mục', refreshDone: 'Đã cập nhật',
    type_building: 'Nhà dân dụng', type_industrial: 'Công nghiệp', type_infrastructure: 'Hạ tầng',
    module_rc_beam: 'Dầm bê tông cốt thép', module_rc_column: 'Cột bê tông cốt thép',
    module_rc_slab: 'Sàn bê tông cốt thép', module_steel: 'Kết cấu thép', module_foundation: 'Móng', module_wind: 'Tải trọng gió',
    material_concrete_b25: 'Bê tông B25', material_concrete_b30: 'Bê tông B30', material_steel_cb400: 'Thép CB400', material_steel_s235: 'Thép S235',
    unit_kn_m: 'kN · m', unit_n_mm: 'N · mm',
    standard_tcvn_5574_2018: 'TCVN 5574:2018', standard_tcvn_5575_2024: 'TCVN 5575:2024',
    standard_eurocode_2: 'Eurocode 2', standard_aci_318_19: 'ACI 318-19', standard_tcvn_2737_2023: 'TCVN 2737:2023',
  },
  en: {
    demoNotice: 'Web demo: projects are stored only in this browser, without a Laravel database connection. Avoid entering data you need to keep long term.', demoStatus: 'Browser demo', browserData: 'Browser',
    brand: 'GeekCalculus', brandSub: 'STRUCTURAL ENGINEERING', workspace: 'Workspace',
    overview: 'Overview', projects: 'Projects', integrations: 'Integrations', settings: 'Settings',
    workspaceLabel: 'WORKSPACE', greeting: 'Welcome back', title: 'Design starts here.',
    subtitle: 'Set up your structural projects and keep every engineering choice in one place.',
    newProject: 'New project', projectCount: 'Total projects', activeModules: 'Structural modules',
    standards: 'Design standards', apiService: 'API service', projectSetup: 'Project setup',
    setupText: 'Choose a structural system, design standard, and units for your new project.',
    projectName: 'Project name', projectNamePlaceholder: 'e.g. Riverside Office Building',
    projectType: 'Project type', module: 'Structural module', standard: 'Design standard',
    material: 'Material', units: 'Units', create: 'Create project', creating: 'Creating project…',
    projectHint: 'GeekCalculus currently supports project setup and management. Structural calculations are not enabled yet.',
    recentProjects: 'Recent projects', viewAll: 'Refresh list', loading: 'Loading data…',
    previousPage: 'Previous', nextPage: 'Next', page: 'Page', totalProjectsSuffix: 'projects',
    emptyProjects: 'No projects yet', emptyProjectsHint: 'Create your first project to start your structural workspace.',
    project: 'Project', configuration: 'Configuration', updated: 'Created', status: 'Status',
    draft: 'Draft', inProgress: 'In progress', complete: 'Complete',
    integrationsTitle: 'Software integrations', integrationsText: 'Prepare your workflow with popular analysis tools.',
    available: 'Ready to connect', planned: 'Planned', apiOnline: 'API is online', apiOffline: 'API unavailable',
    apiChecking: 'Checking API', apiHint: 'Server status', connected: 'Connected',
    localeVietnamese: 'Tiếng Việt', localeEnglish: 'English', language: 'Language',
    errorCatalog: 'Could not load the API catalog. Showing sample options.',
    errorProjects: 'Could not load projects. Please try again.',
    errorCreate: 'Could not create the project. Check the connection and try again.',
    nameRequired: 'Enter a project name.', retry: 'Retry', navProjects: 'Project list',
    catalogSource: 'Catalog source', refreshDone: 'Updated',
    type_building: 'Building', type_industrial: 'Industrial', type_infrastructure: 'Infrastructure',
    module_rc_beam: 'Reinforced concrete beam', module_rc_column: 'Reinforced concrete column',
    module_rc_slab: 'Reinforced concrete slab', module_steel: 'Steel structure', module_foundation: 'Foundation', module_wind: 'Wind load',
    material_concrete_b25: 'Concrete B25', material_concrete_b30: 'Concrete B30', material_steel_cb400: 'Steel CB400', material_steel_s235: 'Steel S235',
    unit_kn_m: 'kN · m', unit_n_mm: 'N · mm',
    standard_tcvn_5574_2018: 'TCVN 5574:2018', standard_tcvn_5575_2024: 'TCVN 5575:2024',
    standard_eurocode_2: 'Eurocode 2', standard_aci_318_19: 'ACI 318-19', standard_tcvn_2737_2023: 'TCVN 2737:2023',
  },
}

const locale = ref(localStorage.getItem('geekcalculus-locale') === 'en' ? 'en' : 'vi')
const t = (key) => {
  const resolved = demoMode && ['apiOnline', 'apiHint'].includes(key) ? 'demoStatus' : key
  return copy[locale.value][resolved] ?? copy.en[resolved] ?? resolved
}
const apiStatus = ref('checking')
const catalogError = ref(false)
const projectError = ref(false)
const createError = ref(false)
const projectLoading = ref(true)
const creating = ref(false)
const projectName = ref('')
const projects = ref([])
const totalProjects = ref(0)
const currentPage = ref(1)
const lastPage = ref(1)
const catalog = ref({ modules: [], standards: [], materials: [], units: [], project_types: [] })
const formErrorKey = ref('')
let catalogRequestId = 0
let projectsRequestId = 0

const sampleCatalog = computed(() => ({
  modules: [
    { code: 'rc_beam', name: t('module_rc_beam') }, { code: 'rc_column', name: t('module_rc_column') },
    { code: 'rc_slab', name: t('module_rc_slab') }, { code: 'steel', name: t('module_steel') },
    { code: 'foundation', name: t('module_foundation') }, { code: 'wind', name: t('module_wind') },
  ],
  standards: [
    { code: 'tcvn_5574_2018', name: t('standard_tcvn_5574_2018') }, { code: 'tcvn_5575_2024', name: t('standard_tcvn_5575_2024') },
    { code: 'eurocode_2', name: t('standard_eurocode_2') }, { code: 'aci_318_19', name: t('standard_aci_318_19') },
    { code: 'tcvn_2737_2023', name: t('standard_tcvn_2737_2023') },
  ],
  materials: [
    { code: 'concrete_b25', name: t('material_concrete_b25') }, { code: 'concrete_b30', name: t('material_concrete_b30') },
    { code: 'steel_cb400', name: t('material_steel_cb400') }, { code: 'steel_s235', name: t('material_steel_s235') },
  ],
  units: [
    { code: 'kn_m', name: t('unit_kn_m') }, { code: 'n_mm', name: t('unit_n_mm') },
  ],
  project_types: [
    { code: 'building', name: t('type_building') }, { code: 'industrial', name: t('type_industrial') },
    { code: 'infrastructure', name: t('type_infrastructure') },
  ],
}))

const selections = ref({ project_type: 'building', module: 'rc_beam', standard: 'tcvn_5574_2018', material: 'concrete_b25', unit: 'kn_m' })
const catalogOptions = computed(() => {
  const result = {}
  for (const key of Object.keys(sampleCatalog.value)) {
    result[key] = (catalog.value[key]?.length ? catalog.value[key] : sampleCatalog.value[key]).map((entry) => {
      if (typeof entry === 'string') return { value: entry, label: translatedCode(key, entry) || entry }
      const value = String(entry.code ?? entry.value ?? entry.id ?? entry.name ?? '')
      const label = entry.name ?? entry.label ?? entry.title ?? translatedCode(key, value) ?? value
      return { value, label }
    }).filter((entry) => entry.value)
  }
  return result
})

const stats = computed(() => [
  { label: t('projectCount'), value: totalProjects.value, icon: 'layers', color: 'mint' },
  { label: t('activeModules'), value: catalogOptions.value.modules.length, icon: 'grid', color: 'lavender' },
  { label: t('standards'), value: catalogOptions.value.standards.length, icon: 'ruler', color: 'peach' },
  { label: t('apiService'), value: t(apiStatus.value === 'online' ? 'apiOnline' : apiStatus.value === 'offline' ? 'apiOffline' : 'apiChecking'), icon: 'pulse', color: apiStatus.value === 'online' ? 'mint' : 'peach', text: true },
])

function translatedCode(group, code) {
  const normalized = String(code ?? '').toLowerCase().replace(/[ .:-]+/g, '_')
  const aliases = {
    modules: 'module_', standards: 'standard_', materials: 'material_', units: 'unit_', project_types: 'type_',
  }
  const key = `${aliases[group] ?? ''}${normalized}`
  return copy[locale.value][key] ?? copy.en[key] ?? ''
}

function request(path, options = {}) {
  if (demoMode) return demoRequest(path, options)
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  return fetch(path, { ...options, headers }).then(async (response) => {
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`)
    return payload
  })
}

async function loadHealth() {
  try {
    await request('/api/health')
    apiStatus.value = 'online'
  } catch {
    apiStatus.value = 'offline'
  }
}

async function loadCatalog(requestedLocale = locale.value) {
  const requestId = ++catalogRequestId
  try {
    const payload = await request(`/api/catalog?locale=${encodeURIComponent(requestedLocale)}`)
    if (requestId !== catalogRequestId) return
    const source = payload.data ?? payload
    catalog.value = {
      modules: Array.isArray(source.modules) ? source.modules : [],
      standards: Array.isArray(source.standards) ? source.standards : [],
      materials: Array.isArray(source.materials) ? source.materials : [],
      units: Array.isArray(source.units) ? source.units : [],
      project_types: Array.isArray(source.project_types) ? source.project_types : [],
    }
    catalogError.value = false
  } catch {
    if (requestId !== catalogRequestId) return
    catalog.value = { modules: [], standards: [], materials: [], units: [], project_types: [] }
    catalogError.value = true
  }
}

async function loadProjects(requestedLocale = locale.value, page = currentPage.value) {
  const requestId = ++projectsRequestId
  projectLoading.value = true
  projectError.value = false
  try {
    const payload = await request(`/api/projects?locale=${encodeURIComponent(requestedLocale)}&page=${page}`)
    if (requestId !== projectsRequestId) return
    const source = payload.data ?? payload
    const rows = Array.isArray(source) ? source : Array.isArray(source.data) ? source.data : []
    const meta = payload.meta ?? (!Array.isArray(source) ? source.meta : null) ?? {}
    projects.value = rows
    currentPage.value = Number(meta.current_page ?? page)
    lastPage.value = Math.max(1, Number(meta.last_page ?? 1))
    totalProjects.value = Number(meta.total ?? rows.length)
  } catch {
    if (requestId !== projectsRequestId) return
    projectError.value = true
    projects.value = []
  } finally {
    if (requestId === projectsRequestId) projectLoading.value = false
  }
}

async function refresh() {
  await Promise.all([loadHealth(), loadCatalog(), loadProjects()])
}

function selectOptions(key) {
  return catalogOptions.value[key] ?? []
}

function ensureSelection(selectionKey, optionsKey, value) {
  const options = selectOptions(optionsKey)
  if (!options.some((option) => option.value === value) && options.length) selections.value[selectionKey] = options[0].value
}

watch(catalogOptions, () => {
  const optionsBySelection = { project_type: 'project_types', module: 'modules', standard: 'standards', material: 'materials', unit: 'units' }
  for (const [selectionKey, optionsKey] of Object.entries(optionsBySelection)) {
    ensureSelection(selectionKey, optionsKey, selections.value[selectionKey])
  }
}, { immediate: true })

watch(locale, async (nextLocale) => {
  localStorage.setItem('geekcalculus-locale', nextLocale)
  document.documentElement.lang = nextLocale
  document.title = nextLocale === 'vi' ? 'GeekCalculus — Không gian kết cấu' : 'GeekCalculus — Structural workspace'
  await Promise.all([loadCatalog(nextLocale), loadProjects(nextLocale, currentPage.value)])
})

function optionName(group, value) {
  const key = group === 'project_type' ? 'project_types' : group === 'module' ? 'modules' : group === 'standard' ? 'standards' : group === 'material' ? 'materials' : 'units'
  const option = catalogOptions.value[key]?.find((entry) => entry.value === String(value ?? ''))
  if (option) return option.label
  return translatedCode(key, value) || String(value ?? '—')
}

function statusName(value) {
  const status = String(value ?? 'draft').toLowerCase()
  if (['complete', 'completed', 'done'].includes(status)) return t('complete')
  if (['in_progress', 'in-progress', 'active'].includes(status)) return t('inProgress')
  return t('draft')
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(locale.value === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

async function createProject() {
  formErrorKey.value = ''
  createError.value = false
  if (!projectName.value.trim()) {
    formErrorKey.value = 'nameRequired'
    return
  }
  const requestedLocale = locale.value
  creating.value = true
  try {
    await request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: projectName.value.trim(), ...selections.value, locale: requestedLocale }),
    })
    projectName.value = ''
    currentPage.value = 1
    await loadProjects(locale.value, 1)
  } catch {
    createError.value = true
  } finally {
    creating.value = false
  }
}

function changePage(page) {
  if (page < 1 || page > lastPage.value || page === currentPage.value) return
  currentPage.value = page
  loadProjects(locale.value, page)
}

onMounted(() => {
  document.documentElement.lang = locale.value
  document.title = locale.value === 'vi' ? 'GeekCalculus — Không gian kết cấu' : 'GeekCalculus — Structural workspace'
  refresh()
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#top" :aria-label="`${t('brand')} · ${t('overview')}`">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
        <span class="brand-copy"><strong>GeekCalculus</strong><small>{{ t('brandSub') }}</small></span>
      </a>

      <div class="side-section-label">{{ t('workspace') }}</div>
      <nav class="side-nav" :aria-label="t('workspace')">
        <a href="#top" class="nav-link active"><span class="nav-icon"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="4" rx="1.5"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/></svg></span>{{ t('overview') }}</a>
        <a href="#projects" class="nav-link"><span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 7.5h6l1.7 2H20v9.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.7z"/><path d="M4 8V5.8A1.8 1.8 0 0 1 5.8 4h4l1.7 2H18"/></svg></span>{{ t('projects') }}</a>
        <a href="#integrations" class="nav-link"><span class="nav-icon"><svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="m9.2 9.2 5.6 5.6M14 6h4v4M6 14v4h4"/></svg></span>{{ t('integrations') }}<span class="nav-count">2</span></a>
      </nav>

      <div class="sidebar-bottom">
        <div class="user-card"><div class="avatar">GC</div><div class="user-copy"><strong>GeekCalculus</strong><span>{{ t('workspace') }}</span></div></div>
      </div>
    </aside>

    <main id="top" class="main-content">
      <header class="topbar">
        <div class="breadcrumb"><span>{{ t('workspace') }}</span><span class="crumb-slash">/</span><strong>{{ t('overview') }}</strong></div>
        <div class="topbar-actions">
          <div class="api-indicator" :class="apiStatus"><span class="api-dot" :class="apiStatus"></span><span>{{ t(apiStatus === 'online' ? 'apiOnline' : apiStatus === 'offline' ? 'apiOffline' : 'apiChecking') }}</span></div>
          <div class="language-switch" role="group" :aria-label="t('language')">
            <button type="button" :class="{ chosen: locale === 'vi' }" :aria-pressed="locale === 'vi'" @click="locale = 'vi'">VI</button>
            <button type="button" :class="{ chosen: locale === 'en' }" :aria-pressed="locale === 'en'" @click="locale = 'en'">EN</button>
          </div>
        </div>
      </header>

      <div class="page-wrap">
        <p v-if="demoMode" class="demo-notice" role="note">{{ t('demoNotice') }}</p>
        <section class="welcome-row">
          <div>
            <div class="eyebrow"><span class="eyebrow-mark"></span>{{ t('greeting') }}</div>
            <h1>{{ t('title') }}</h1>
            <p class="welcome-subtitle">{{ t('subtitle') }}</p>
          </div>
          <a class="primary-button hero-button" href="#new-project"><span class="plus">+</span>{{ t('newProject') }}<span class="button-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg></span></a>
        </section>

        <section class="stats-grid" :aria-label="t('workspace')">
          <article v-for="stat in stats" :key="stat.label" class="stat-card">
            <div class="stat-top"><span>{{ stat.label }}</span><span class="stat-icon" :class="stat.color"><svg v-if="stat.icon === 'layers'" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg><svg v-else-if="stat.icon === 'grid'" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg><svg v-else-if="stat.icon === 'ruler'" viewBox="0 0 24 24"><path d="m4 16 12-12 4 4L8 20H4v-4Z"/><path d="m13 7 4 4M10 10l2 2M7 13l2 2"/></svg><svg v-else viewBox="0 0 24 24"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg></span></div>
            <strong :class="{ 'stat-value-text': stat.text }">{{ stat.text ? stat.value : stat.value }}</strong>
            <span v-if="stat.text" class="stat-foot"><span class="api-dot" :class="apiStatus"></span>{{ t('apiHint') }}</span>
            <span v-else class="stat-foot">{{ locale === 'vi' ? 'Trong không gian làm việc' : 'In your workspace' }}</span>
          </article>
        </section>

        <div class="content-grid">
          <section id="new-project" class="panel setup-panel">
            <div class="panel-heading">
              <div class="heading-icon mint"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/></svg></div>
              <div><h2>{{ t('projectSetup') }}</h2><p>{{ t('setupText') }}</p></div>
              <span class="step-indicator"><i>01</i><span></span><i>02</i></span>
            </div>

            <form class="project-form" @submit.prevent="createProject">
              <label class="field full-field"><span>{{ t('projectName') }}<b>*</b></span><input v-model="projectName" type="text" name="name" maxlength="120" autocomplete="off" :placeholder="t('projectNamePlaceholder')" /></label>
              <label class="field"><span>{{ t('projectType') }}</span><select v-model="selections.project_type"><option v-for="option in selectOptions('project_types')" :key="option.value" :value="option.value">{{ option.label }}</option></select><span class="select-chevron">⌄</span></label>
              <label class="field"><span>{{ t('module') }}</span><select v-model="selections.module"><option v-for="option in selectOptions('modules')" :key="option.value" :value="option.value">{{ option.label }}</option></select><span class="select-chevron">⌄</span></label>
              <label class="field"><span>{{ t('standard') }}</span><select v-model="selections.standard"><option v-for="option in selectOptions('standards')" :key="option.value" :value="option.value">{{ option.label }}</option></select><span class="select-chevron">⌄</span></label>
              <label class="field"><span>{{ t('material') }}</span><select v-model="selections.material"><option v-for="option in selectOptions('materials')" :key="option.value" :value="option.value">{{ option.label }}</option></select><span class="select-chevron">⌄</span></label>
              <label class="field"><span>{{ t('units') }}</span><select v-model="selections.unit"><option v-for="option in selectOptions('units')" :key="option.value" :value="option.value">{{ option.label }}</option></select><span class="select-chevron">⌄</span></label>
              <div class="form-footer">
                <p class="form-note"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>{{ t('projectHint') }}</p>
                <button class="primary-button submit-button" type="submit" :disabled="creating"><span v-if="creating" class="spinner"></span><span v-else class="plus">+</span>{{ creating ? t('creating') : t('create') }}<span v-if="!creating" class="button-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg></span></button>
              </div>
              <p v-if="formErrorKey" class="inline-error" role="alert">{{ t(formErrorKey) }}</p>
              <p v-else-if="createError" class="inline-error" role="alert">{{ t('errorCreate') }}</p>
            </form>
          </section>

          <aside id="integrations" class="panel integrations-panel">
            <div class="panel-heading compact-heading">
              <div class="heading-icon lavender"><svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="m9.2 9.2 5.6 5.6M14 6h4v4M6 14v4h4"/></svg></div>
              <div><h2>{{ t('integrationsTitle') }}</h2><p>{{ t('integrationsText') }}</p></div>
            </div>
            <div class="integration-list">
              <article class="integration-item">
                <div class="integration-logo sap-logo">S<span>A</span>P</div>
                <div class="integration-copy"><strong>SAP2000</strong><span>{{ locale === 'vi' ? 'Phân tích kết cấu' : 'Structural analysis' }}</span></div>
                <span class="integration-state planned-state"><i></i>{{ t('planned') }}</span>
              </article>
              <article class="integration-item">
                <div class="integration-logo etabs-logo"><span class="etabs-symbol">E</span></div>
                <div class="integration-copy"><strong>ETABS</strong><span>{{ locale === 'vi' ? 'Phân tích nhà cao tầng' : 'Building analysis' }}</span></div>
                <span class="integration-state planned-state"><i></i>{{ t('planned') }}</span>
              </article>
            </div>
            <div class="integration-footer"><span class="status-line"><i></i></span>{{ locale === 'vi' ? 'Kết nối phần mềm đang được phát triển' : 'Software connections are in development' }}</div>
            <div class="standards-strip"><span class="strip-label">{{ locale === 'vi' ? 'TIÊU CHUẨN PHỔ BIẾN' : 'POPULAR STANDARDS' }}</span><div><span>TCVN</span><span>EUROCODE</span><span>ACI</span></div></div>
          </aside>
        </div>

        <section id="projects" class="panel projects-panel">
          <div class="projects-heading">
            <div class="panel-heading compact-heading">
              <div class="heading-icon peach"><svg viewBox="0 0 24 24"><path d="M4 7.5h6l1.7 2H20v9.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.7z"/><path d="M4 8V5.8A1.8 1.8 0 0 1 5.8 4h4l1.7 2H18"/></svg></div>
              <div><h2>{{ t('recentProjects') }}</h2><p>{{ t('navProjects') }}</p></div>
            </div>
            <button type="button" class="text-button" @click="refresh"><svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.9-2L20 12M4 12l2.5 5a7 7 0 0 0 11.9-2"/></svg>{{ t('viewAll') }}</button>
          </div>

          <div v-if="projectLoading" class="empty-state loading-state"><span class="spinner"></span>{{ t('loading') }}</div>
          <div v-else-if="projectError" class="empty-state error-state"><span class="empty-icon"><svg viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01"/><path d="m10.2 4.4-7 12.1A2 2 0 0 0 5 19.5h14a2 2 0 0 0 1.8-3L13.8 4.4a2.1 2.1 0 0 0-3.6 0Z"/></svg></span><strong>{{ t('errorProjects') }}</strong><button type="button" class="text-button" @click="loadProjects()">{{ t('retry') }}</button></div>
          <div v-else-if="projects.length === 0" class="empty-state"><span class="empty-icon"><svg viewBox="0 0 24 24"><path d="M4 7.5h6l1.7 2H20v9.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.7z"/><path d="M4 8V5.8A1.8 1.8 0 0 1 5.8 4h4l1.7 2H18"/></svg></span><strong>{{ t('emptyProjects') }}</strong><span>{{ t('emptyProjectsHint') }}</span></div>
          <div v-else class="table-wrap">
            <table><thead><tr><th>{{ t('project') }}</th><th>{{ t('configuration') }}</th><th>{{ t('updated') }}</th><th>{{ t('status') }}</th></tr></thead>
              <tbody><tr v-for="(project, index) in projects" :key="project.id ?? `${project.name}-${index}`"><td><span class="project-initial">{{ (project.name ?? 'P').slice(0, 1).toUpperCase() }}</span><span class="project-name-cell"><strong>{{ project.name }}</strong><small>{{ optionName('project_type', project.project_type) }}</small></span></td><td><div class="config-cell"><span>{{ optionName('module', project.module) }}</span><i></i><span>{{ optionName('standard', project.standard) }}</span><i></i><span>{{ optionName('material', project.material) }}</span></div></td><td class="date-cell">{{ formatDate(project.created_at) }}</td><td><span class="project-status" :class="String(project.status ?? 'draft').toLowerCase().replaceAll('_', '-')"><i></i>{{ statusName(project.status) }}</span></td></tr></tbody>
            </table>
          </div>
          <div v-if="!projectLoading && !projectError && lastPage > 1" class="pagination">
            <span>{{ t('page') }} {{ currentPage }} / {{ lastPage }} · {{ totalProjects }} {{ t('totalProjectsSuffix') }}</span>
            <div class="pagination-actions">
              <button type="button" class="pagination-button" :aria-label="t('previousPage')" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">← {{ t('previousPage') }}</button>
              <button type="button" class="pagination-button" :aria-label="t('nextPage')" :disabled="currentPage >= lastPage" @click="changePage(currentPage + 1)">{{ t('nextPage') }} →</button>
            </div>
          </div>
          <div v-if="catalogError" class="catalog-alert"><span class="api-dot offline"></span>{{ t('errorCatalog') }}</div>
        </section>

        <footer class="page-footer"><span>© 2026 GeekCalculus</span><span class="footer-divider"></span><span>{{ locale === 'vi' ? 'Nền tảng kỹ thuật kết cấu' : 'Structural engineering platform' }}</span><span class="footer-right">{{ t('catalogSource') }}: <b>{{ catalogError ? (locale === 'vi' ? 'Mẫu cục bộ' : 'Local sample') : apiStatus === 'online' ? (demoMode ? t('browserData') : 'API') : (locale === 'vi' ? 'Mẫu cục bộ' : 'Local sample') }}</b></span></footer>
      </div>
    </main>
  </div>
</template>
