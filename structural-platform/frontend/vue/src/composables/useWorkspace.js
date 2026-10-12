import { computed, onMounted, ref, watch } from 'vue'
import { demoRequest } from '../demo-api'
import { copy } from '../i18n'

export function useWorkspace() {
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'


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

  return { demoMode, locale, t, apiStatus, catalogError, projectError, createError, projectLoading, creating, projectName, projects, totalProjects, currentPage, lastPage, formErrorKey, selections, refresh, loadProjects, selectOptions, optionName, statusName, formatDate, createProject, changePage }
}
