import catalog from '../../../database/seeds/catalog.json'
import schema from '../../../database/seeds/engineering-schema.json'
import seed from '../../../database/seeds/engineering-data.json'
const DB_KEY = 'geekcalculus-demo-library-v1'
const PROJECT_KEY = 'geekcalculus-web-demo-projects-v1'
const SESSION_KEY = 'geekcalculus-demo-session-v1'
const LEGACY_SESSION_KEY = 'geekcalculus-demo-user'
const fields = { project_type: 'project_types', module: 'modules', standard: 'standards', material: 'materials', unit: 'units' }
function fail(status, message, errors = {}) { const error = new Error(message); error.status = status; error.errors = errors; throw error }
async function hash(password, salt) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)))).map(v => v.toString(16).padStart(2, '0')).join('') }
async function database() {
  const saved = localStorage.getItem(DB_KEY)
  if (saved) return JSON.parse(saved)
  const users = []
  for (const role of ['admin', 'user']) { const salt = crypto.randomUUID(); users.push({ id: role, name: role === 'admin' ? 'Demo Admin' : 'Demo User', email: `${role}@demo.geekcalculus.test`, role, salt, passwordHash: await hash('demo', salt) }) }
  const db = { users, materials: seed.materials.map((row, i) => ({ ...row, id: i + 1 })), section_types: seed.section_types.map((row, i) => ({ ...row, id: i + 1 })), sections: [] }
  localStorage.setItem(DB_KEY, JSON.stringify(db)); return db
}
function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)) }
function publicUser(user) { if (!user) return null; const { salt, passwordHash, ...data } = user; return data }
function present(resource, row) { if (resource === 'materials') return { ...row, computed: { shear_modulus: row.properties.elastic_modulus / (2 * (1 + row.properties.poisson_ratio)) } }; if (resource === 'sections') return { ...row, computed: { radius_y: Math.sqrt(row.properties.inertia_y / row.properties.area), radius_z: Math.sqrt(row.properties.inertia_z / row.properties.area) } }; return row }
function validate(resource, body, db, old) {
  const errors = {}
  const add = (field, message) => { errors[field] = [message] }
  for (const key of ['code', 'name_vi', 'name_en']) if (typeof body[key] !== 'string' || !body[key].trim()) add(key, 'This field is required.')
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(body.code)) add('code', 'Use a unique code containing letters, numbers, hyphens or underscores.')
  if (db[resource].some(row => row.code === body.code && row.id !== old?.id)) add('code', 'Code is already in use.')
  let category = body.category, shape
  if (resource === 'sections') {
    const type = db.section_types.find(row => row.id === Number(body.section_type_id)); const material = db.materials.find(row => row.id === Number(body.material_id))
    if (!type) add('section_type_id', 'Choose a section type.')
    if (!material || (type && material.category !== (type.category === 'rc' ? 'concrete' : 'steel'))) add('material_id', 'Material category must match the section type.')
    category = type?.category; shape = type?.shape
  } else if (!schema.categories[resource].some(option => option.code === category)) add('category', 'Invalid category.')
  if (resource === 'section_types') {
    if (!schema.shapes.some(option => option.code === body.shape && option.category === category)) add('shape', 'Shape must match the category.')
    if (old && (body.category !== old.category || body.shape !== old.shape) && db.sections.some(row => row.section_type_id === old.id)) fail(409, 'A referenced type cannot change shape or category.')
  } else {
    const descriptors = schema.fields[resource].filter(f => (!f.categories || f.categories.includes(category)) && (!f.shapes || f.shapes.includes(shape)))
    const p = body.properties || {}
    for (const f of descriptors) {
      if (p[f.key] === undefined || p[f.key] === '') { if (f.required) add(`properties.${f.key}`, 'This property is required.'); continue }
      const value = Number(p[f.key]); if (!Number.isFinite(value) || value < f.min || value > (f.max ?? 1e24)) add(`properties.${f.key}`, 'Property is outside the allowed range.')
    }
    for (const key of Object.keys(p)) if (!descriptors.some(f => f.key === key)) add(`properties.${key}`, 'Unsupported property.')
    if (resource === 'materials') {
      if (p.ultimate_strength < p.yield_strength) add('properties.ultimate_strength', 'Ultimate strength must be at least yield strength.')
      if (old && old.category !== category && db.sections.some(row => row.material_id === old.id)) fail(409, 'A referenced material cannot change category.')
    } else {
      if (['shear_area_y', 'shear_area_z'].some(key => p[key] > p.area)) add('properties', 'Shear area cannot exceed gross area.')
      if ((['i', 'channel', 'tee'].includes(shape) && (p.web_thickness >= p.width || (shape === 'tee' ? 1 : 2) * p.flange_thickness >= p.depth)) || (shape === 'angle' && p.thickness >= Math.min(p.depth, p.width)) || (shape === 'rectangular_hollow' && 2 * p.thickness >= Math.min(p.depth, p.width)) || (shape === 'circular_hollow' && 2 * p.thickness >= p.diameter)) add('properties', 'Thickness is incompatible with outer dimensions.')
      if (p.concrete_cover !== undefined && 2 * p.concrete_cover >= (shape === 'circle' ? p.diameter : Math.min(p.depth, p.width))) add('properties.concrete_cover', 'Cover is too large.')
    }
  }
  if (Object.keys(errors).length) fail(422, 'Check the entered values.', errors)
}
// UI simulation only: localStorage can be edited. This is never server authorization.
export async function demoRequest(path, options = {}) {
  const url = new URL(path, location.origin); const body = options.body ? JSON.parse(options.body) : {}; const method = options.method || 'GET'
  if (!localStorage.getItem(SESSION_KEY) && sessionStorage.getItem(LEGACY_SESSION_KEY)) { localStorage.setItem(SESSION_KEY, sessionStorage.getItem(LEGACY_SESSION_KEY)); sessionStorage.removeItem(LEGACY_SESSION_KEY) }
  const db = await database(); const user = db.users.find(row => row.id === localStorage.getItem(SESSION_KEY))
  if (url.pathname === '/api/auth/me') return { data: publicUser(user) }
  if (url.pathname === '/api/auth/login') {
    const account = db.users.find(row => row.email.toLowerCase() === String(body.email).toLowerCase())
    if (!account || account.passwordHash !== await hash(String(body.password), account.salt)) fail(422, 'Invalid email or password.', { email: ['Invalid email or password.'] })
    localStorage.setItem(SESSION_KEY, account.id); return { data: publicUser(account) }
  }
  if (url.pathname === '/api/auth/logout') { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(LEGACY_SESSION_KEY); return { data: null } }
  if (url.pathname === '/api/health') return { status: 'ok', storage: 'browser-demo' }
  if (!user) fail(401, 'Please sign in.')
  const locale = url.searchParams.get('locale') || body.locale || 'vi'
  if (!['vi', 'en'].includes(locale)) fail(422, 'Unsupported locale')
  if (url.pathname === '/api/library/schema') return schema
  if (url.pathname === '/api/catalog') return { locale, locales: [{ code: 'vi', name: 'Tiếng Việt' }, { code: 'en', name: 'English' }], ...Object.fromEntries(Object.entries(catalog).map(([kind, rows]) => [kind, kind === 'materials' ? db.materials.map(row => ({ code: row.code, name: row[`name_${locale}`] })) : rows.map(row => ({ code: row.code, name: row.translations[locale] }))])) }
  if (url.pathname === '/api/projects') {
    const projects = JSON.parse(localStorage.getItem(PROJECT_KEY) || '[]')
    if (method === 'POST') {
      if (!body.name?.trim() || body.name.trim().length > 160) fail(422, 'Invalid project name')
      for (const [key, kind] of Object.entries(fields)) if (!(kind === 'materials' ? db.materials : catalog[kind]).some(row => row.code === body[key])) fail(422, `Invalid ${key}`)
      const project = { id: crypto.randomUUID(), user_id: user.id, name: body.name.trim(), status: 'draft', ...Object.fromEntries(Object.keys(fields).map(key => [key, body[key]])), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      projects.unshift(project); localStorage.setItem(PROJECT_KEY, JSON.stringify(projects)); return { data: project }
    }
    const visible = user.role === 'admin' ? projects : projects.filter(row => row.user_id === user.id); const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    return { data: visible.slice((page - 1) * 50, page * 50), meta: { total: visible.length, current_page: page, last_page: Math.max(1, Math.ceil(visible.length / 50)) } }
  }
  const match = url.pathname.match(/^\/api\/(materials|section-types|sections|admin\/users)(?:\/([^/]+))?$/)
  if (!match) fail(404, 'Not found')
  const resource = match[1] === 'admin/users' ? 'users' : match[1].replace('-', '_'); const id = match[2]
  if ((method !== 'GET' || resource === 'users') && user.role !== 'admin') fail(403, 'Administrator access required.')
  if (method === 'GET') return { data: db[resource].map(row => resource === 'users' ? publicUser(row) : present(resource, row)) }
  const index = id === undefined ? -1 : db[resource].findIndex(row => String(row.id) === id); const old = db[resource][index]
  if (id !== undefined && !old) fail(404, 'Record not found')
  if (method === 'DELETE') {
    if (resource === 'users' && (old.id === user.id || (old.role === 'admin' && db.users.filter(row => row.role === 'admin').length === 1))) fail(409, 'Cannot delete the current or last administrator.')
    if (resource === 'materials' && (db.sections.some(row => row.material_id === old.id) || JSON.parse(localStorage.getItem(PROJECT_KEY) || '[]').some(row => row.material === old.code))) fail(409, 'Material is referenced by a section or project.')
    if (resource === 'section_types' && db.sections.some(row => row.section_type_id === old.id)) fail(409, 'Section type is referenced by a section.')
    db[resource].splice(index, 1); save(db); return { data: null }
  }
  let record
  if (resource === 'users') {
    if (!body.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || '') || !['admin', 'user'].includes(body.role)) fail(422, 'Name, email and role are required.')
    if (db.users.some(row => row.email.toLowerCase() === body.email.toLowerCase() && row.id !== old?.id)) fail(422, 'Email already in use.', { email: ['Email already in use.'] })
    if ((!old || body.password) && (typeof body.password !== 'string' || body.password.length < 12)) fail(422, 'Password must contain at least 12 characters.', { password: ['Password must contain at least 12 characters.'] })
    if (old?.role === 'admin' && body.role !== 'admin' && (old.id === user.id || db.users.filter(row => row.role === 'admin').length === 1)) fail(409, 'Cannot demote the current or last administrator.')
    record = { ...old, id: old?.id || crypto.randomUUID(), name: body.name.trim(), email: body.email, role: body.role }
    if (body.password) { record.salt = crypto.randomUUID(); record.passwordHash = await hash(body.password, record.salt) }
  } else {
    validate(resource, body, db, old)
    if (resource === 'materials' && old && body.code !== old.code && (db.sections.some(row => row.material_id === old.id) || JSON.parse(localStorage.getItem(PROJECT_KEY) || '[]').some(row => row.material === old.code))) fail(409, 'Referenced material codes cannot change.')
    record = { id: old?.id || Math.max(0, ...db[resource].map(row => row.id)) + 1, code: body.code, name_vi: body.name_vi, name_en: body.name_en }
    if (resource === 'section_types') Object.assign(record, { category: body.category, shape: body.shape })
    else Object.assign(record, { ...(resource === 'materials' ? { category: body.category } : { material_id: Number(body.material_id), section_type_id: Number(body.section_type_id) }), source: body.source || '', properties: Object.fromEntries(Object.entries(body.properties).map(([key, value]) => [key, Number(value)])) })
  }
  if (old) db[resource][index] = record; else db[resource].push(record)
  save(db); return { data: resource === 'users' ? publicUser(record) : present(resource, record) }
}
