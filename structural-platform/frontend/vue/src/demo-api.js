import catalog from '../../../database/seeds/catalog.json'

const STORAGE_KEY = 'geekcalculus-web-demo-projects-v1'
const fields = { project_type: 'project_types', module: 'modules', standard: 'standards', material: 'materials', unit: 'units' }

function readProjects() {
  const projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  if (!Array.isArray(projects)) throw new Error('Invalid demo project storage')
  return projects
}

// Browser-only demo adapter. The local Laravel build never uses this adapter.
export async function demoRequest(path, options = {}) {
  const url = new URL(path, window.location.origin)
  let body = {}
  if (options.body) body = JSON.parse(options.body)
  const locale = url.searchParams.get('locale') || body.locale || 'vi'
  if (!['vi', 'en'].includes(locale)) throw new Error('Unsupported locale')
  if (url.pathname === '/api/health') return { status: 'ok', storage: 'browser-demo' }
  if (url.pathname === '/api/catalog') {
    return {
      locale,
      locales: [{ code: 'vi', name: 'Tiếng Việt' }, { code: 'en', name: 'English' }],
      ...Object.fromEntries(Object.entries(catalog).map(([kind, options]) => [kind,
        options.map(option => ({ code: option.code, name: option.translations[locale] })),
      ])),
    }
  }
  if (url.pathname === '/api/projects') {
    const projects = readProjects()
    if (options.method === 'POST') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 160) throw new Error('Invalid project name')
      for (const [field, kind] of Object.entries(fields)) {
        if (!catalog[kind].some(option => option.code === body[field])) throw new Error(`Invalid ${field}`)
      }
      const project = {
        id: crypto.randomUUID(), name: body.name.trim(), status: 'draft',
        ...Object.fromEntries(Object.keys(fields).map(field => [field, body[field]])),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      projects.unshift(project)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
      return { data: project }
    }
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    return { data: projects.slice((page - 1) * 50, page * 50), meta: { total: projects.length, current_page: page, last_page: Math.max(1, Math.ceil(projects.length / 50)) } }
  }
  throw new Error('Unsupported demo operation')
}
