import { calculateSectionProperties } from '../../../section-properties/index.ts'
import { buildCatalogSectionCalculationRequest, catalogSectionInputProperties, isCatalogDerivedSectionProperty } from './sectional-properties/catalog-payload.js'
import catalog from '../../../database/seeds/catalog.json'
import schema from '../../../database/seeds/engineering-schema.json'
import seed from '../../../database/seeds/engineering-data.json'
const DB_KEY = 'geekcalculus-demo-library-v1'
const PROJECT_KEY = 'geekcalculus-web-demo-projects-v1'
const SESSION_KEY = 'geekcalculus-demo-session-v1'
const LEGACY_SESSION_KEY = 'geekcalculus-demo-user'
const DOUBLE_ANGLE_MIGRATION = 'section-properties-double-angle-v1'
const fields = { project_type: 'project_types', module: 'modules', standard: 'standards', material: 'materials', unit: 'units' }
function fail(status, message, errors = {}) { const error = new Error(message); error.status = status; error.errors = errors; throw error }
async function hash(password, salt) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)))).map(v => v.toString(16).padStart(2, '0')).join('') }
async function database() {
  const saved = localStorage.getItem(DB_KEY)
  if (saved) {
    const db = JSON.parse(saved)
    // Keep the same storage key and all existing IDs, properties and users.
    for (const resource of ['materials', 'section_types']) db[resource] = db[resource].map(row => withClassification(resource, row))
    migrateDoubleAngleType(db)
    return db
  }
  const users = []
  for (const role of ['admin', 'user']) { const salt = crypto.randomUUID(); users.push({ id: role, name: role === 'admin' ? 'Demo Admin' : 'Demo User', email: `${role}@demo.geekcalculus.test`, role, salt, passwordHash: await hash('demo', salt) }) }
  const db = { users, materials: seed.materials.map((row, i) => withClassification('materials', { ...row, id: i + 1 })), section_types: seed.section_types.map((row, i) => withClassification('section_types', { ...row, id: i + 1 })), sections: [], migrations: [DOUBLE_ANGLE_MIGRATION] }
  localStorage.setItem(DB_KEY, JSON.stringify(db)); return db
}
function uniqueSectionTypeCode(rows, requestedCode) {
  const existing = new Set(rows.map(row => row.code))
  if (!existing.has(requestedCode)) return requestedCode
  for (let suffix = 1; suffix < 10000; suffix++) {
    const tail = `_migrated${suffix === 1 ? '' : `_${suffix}`}`
    const candidate = `${requestedCode.slice(0, 64 - tail.length)}${tail}`
    if (!existing.has(candidate)) return candidate
  }
  throw new Error('Could not allocate a unique migrated section type code.')
}
function migrateDoubleAngleType(db) {
  const migrations = Array.isArray(db.migrations) ? [...db.migrations] : []
  if (migrations.includes(DOUBLE_ANGLE_MIGRATION)) return
  if (!db.section_types.some(row => row.shape === 'double_angle')) {
    const template = seed.section_types.find(row => row.shape === 'double_angle')
    if (template) {
      const id = Math.max(0, ...db.section_types.map(row => Number(row.id) || 0)) + 1
      const code = uniqueSectionTypeCode(db.section_types, template.code)
      db.section_types.push(withClassification('section_types', { ...template, id, code }))
    }
  }
  migrations.push(DOUBLE_ANGLE_MIGRATION)
  db.migrations = migrations
  save(db)
}
function withClassification(resource, row) { return { ...row, design_code: row.design_code ?? null, ...(resource === 'section_types' ? { region_type: row.region_type ?? null } : {}) } }
function optionalText(value) { return typeof value === 'string' ? value.trim() || null : value }
function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)) }
function publicUser(user) { if (!user) return null; const { salt, passwordHash, ...data } = user; return data }
function present(resource, row) {
  if (resource === 'materials') return { ...row, computed: { shear_modulus: row.properties.elastic_modulus / (2 * (1 + row.properties.poisson_ratio)) } }
  if (resource === 'sections') {
    if (row.section_properties) {
      const elastic = row.section_properties.properties?.elastic ?? {}
      return { ...row, computed: Object.fromEntries(['rx', 'ry'].filter(key => Number.isFinite(elastic[key])).map(key => [key, elastic[key]])) }
    }
    const properties = row.properties ?? {}, area = Number(properties.area), iy = Number(properties.inertia_y), iz = Number(properties.inertia_z)
    const computed = {}
    if (Number.isFinite(area) && area > 0 && Number.isFinite(iy) && Number.isFinite(iz) && iy >= 0 && iz >= 0) {
      computed.radius_y = Math.sqrt(iy / area)
      computed.radius_z = Math.sqrt(iz / area)
    }
    return { ...row, computed }
  }
  return row
}
function validate(resource, body, db, old) {
  const errors = {}
  const add = (field, message) => { errors[field] = [message] }
  for (const key of ['code', 'name_vi', 'name_en']) if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > (key === 'code' ? 64 : 255)) add(key, 'A non-empty name/code within the length limit is required.')
  if (body.source != null && (typeof body.source !== 'string' || body.source.length > 2000)) add('source', 'Source must be text up to 2000 characters.')
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(body.code)) add('code', 'Use a unique code containing letters, numbers, hyphens or underscores.')
  if (db[resource].some(row => row.code === body.code && row.id !== old?.id)) add('code', 'Code is already in use.')
  if (resource !== 'sections' && Object.hasOwn(body, 'design_code')) {
    const designCode = optionalText(body.design_code)
    if (designCode !== null && !schema.design_codes.some(option => option.code === designCode)) add('design_code', 'Choose EN, AISC/ACI, AS or VN, or leave unclassified.')
  }
  if (resource === 'section_types' && Object.hasOwn(body, 'region_type')) {
    const regionType = optionalText(body.region_type)
    if (regionType !== null && (typeof regionType !== 'string' || regionType.length > 64)) add('region_type', 'Region type must be text up to 64 characters.')
  }
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
    if (!body.properties || typeof body.properties !== 'object' || Array.isArray(body.properties)) fail(422, 'Properties must be an object.', { properties: ['Properties must be an object.'] })
    const readonlyKeys = resource === 'sections' ? new Set(schema.fields.sections.filter(f => f.read_only === true).map(f => f.key)) : new Set()
    const rawProperties = Object.fromEntries(Object.entries(body.properties).filter(([key]) => !readonlyKeys.has(key)))
    const p = Object.fromEntries(Object.entries(rawProperties).map(([key, value]) => [key, Number(value)]))
    const editableDescriptors = resource === 'sections'
      ? descriptors.filter(f => f.read_only !== true && !isCatalogDerivedSectionProperty(f.key))
      : descriptors
    const asymmetricKeys = ['top_flange_width', 'bottom_flange_width', 'top_flange_thickness', 'bottom_flange_thickness']
    const asymmetricI = resource === 'sections' && shape === 'i' && asymmetricKeys.some(key => Object.hasOwn(rawProperties, key))
    for (const f of editableDescriptors) {
      const required = f.required && !(asymmetricI && ['width', 'flange_thickness'].includes(f.key))
        || asymmetricI && asymmetricKeys.includes(f.key)
      if (rawProperties[f.key] === undefined) { if (required) add(`properties.${f.key}`, 'This property is required.'); continue }
      const value = Number(p[f.key]); if (!['number', 'string'].includes(typeof rawProperties[f.key]) || !String(rawProperties[f.key]).trim() || !Number.isFinite(value) || value < f.min || value > (f.max ?? 1e24)) add(`properties.${f.key}`, 'Property is outside the allowed range.')
    }
    for (const key of Object.keys(p)) if (!editableDescriptors.some(f => f.key === key)) add(`properties.${key}`, 'Unsupported property.')
    if (resource === 'materials') {
      if (Object.entries(catalog).some(([kind, rows]) => kind !== 'materials' && rows.some(row => row.code === body.code))) add('code', 'Code is used by another catalog.')
      for (const strength of ['compressive', 'tensile']) if (p[`design_${strength}_strength`] !== undefined && Number(p[`design_${strength}_strength`]) > Number(p[`${strength}_strength`])) add(`properties.design_${strength}_strength`, 'Design strength cannot exceed reference strength.')
      if (p.ultimate_strength < p.yield_strength) add('properties.ultimate_strength', 'Ultimate strength must be at least yield strength.')
      if (old && old.category !== category && db.sections.some(row => row.material_id === old.id)) fail(409, 'A referenced material cannot change category.')
    } else {
      if (shape === 'i') {
        if (!asymmetricI) {
          if (rawProperties.width === undefined) add('properties.width', 'This property is required for a symmetric I-section.')
          if (rawProperties.flange_thickness === undefined) add('properties.flange_thickness', 'This property is required for a symmetric I-section.')
        }
      }
      if (shape === 'rectangular_hollow' && 2 * p.thickness >= Math.min(p.depth, p.width)) add('properties.thickness', 'Wall thickness must be less than half of both outer dimensions.')
      if (shape === 'circular_hollow' && 2 * p.thickness >= p.diameter) add('properties.thickness', 'Wall thickness must be less than half the outside diameter.')
      if (shape === 'angle' && p.thickness >= Math.min(p.depth, p.width)) add('properties.thickness', 'Thickness must be less than both leg dimensions.')
      if (p.concrete_cover !== undefined && 2 * p.concrete_cover >= (shape === 'circle' ? p.diameter : Math.min(p.depth, p.width))) add('properties.concrete_cover', 'Cover is too large.')
    }
  }
  if (Object.keys(errors).length) fail(422, 'Check the entered values.', errors)
}

const libraryResources = ['materials', 'section_types', 'sections']
async function sectionSnapshot(shape, properties) {
  const request = buildCatalogSectionCalculationRequest(shape, properties)
  if (!request) fail(422, 'Complete valid geometry dimensions are required to calculate section properties.', { properties: ['Complete valid geometry dimensions are required.'] })
  try { return await calculateSectionProperties(request) } catch (error) {
    const errors = {}
    for (const item of error?.errors ?? []) {
      const path = String(item.path ?? 'geometry').replace(/^geometry\.dimensions\./, 'properties.')
      errors[path] = [...(errors[path] ?? []), item.message ?? 'Invalid section geometry.']
    }
    if (!Object.keys(errors).length) errors.properties = [error?.message ?? 'Invalid section geometry.']
    fail(422, 'Section geometry could not be calculated.', errors)
  }
}

async function libraryRecord(resource, body, db, old) {
  const record = { id: old?.id || Math.max(0, ...db[resource].map(row => row.id)) + 1, code: body.code, name_vi: body.name_vi, name_en: body.name_en }
  if (resource !== 'sections') record.design_code = Object.hasOwn(body, 'design_code') ? optionalText(body.design_code) : old?.design_code ?? null
  if (resource === 'section_types') Object.assign(record, { category: body.category, shape: body.shape, region_type: Object.hasOwn(body, 'region_type') ? optionalText(body.region_type) : old?.region_type ?? null })
  else if (resource === 'materials') Object.assign(record, { category: body.category, source: body.source || '', properties: Object.fromEntries(Object.entries(body.properties).map(([key, value]) => [key, Number(value)])) })
  else {
    const type = db.section_types.find(row => row.id === Number(body.section_type_id))
    const descriptors = schema.fields.sections.filter(f => (!f.categories || f.categories.includes(type?.category)) && (!f.shapes || f.shapes.includes(type?.shape)))
    const properties = catalogSectionInputProperties(type?.shape, body.properties, descriptors)
    const snapshot = await sectionSnapshot(type?.shape, properties)
    Object.assign(record, {
      material_id: Number(body.material_id), section_type_id: Number(body.section_type_id), source: body.source || '', properties,
      section_properties: snapshot, section_properties_calculated_at: new Date().toISOString(),
    })
  }
  return record
}
function exportLibrary(db) {
  const archive = { format: 'geekcalculus-engineering-library', version: 1, exported_at: new Date().toISOString() }
  for (const resource of libraryResources) archive[resource] = db[resource].map(row => {
    const { id, computed, created_at, updated_at, material_id, section_type_id, ...data } = row
    if (resource === 'sections') {
      const material = db.materials.find(item => item.id === material_id), type = db.section_types.find(item => item.id === section_type_id)
      if (!material || !type) fail(422, 'A section has a missing material/type reference. Repair the library before exporting.')
      Object.assign(data, { material_code: material.code, section_type_code: type.code })
    }
    return data
  }).sort((a, b) => a.code.localeCompare(b.code))
  return archive
}
async function importLibrary(db, body) {
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 10 * 1024 * 1024) fail(413, 'Library file exceeds 10 MB.')
  const a = body.archive
  if (!['skip', 'overwrite'].includes(body.mode) || !a || a.format !== 'geekcalculus-engineering-library' || a.version !== 1 || Object.keys(a).some(key => !['format', 'version', 'exported_at', ...libraryResources].includes(key)) || (a.exported_at !== undefined && (typeof a.exported_at !== 'string' || !Number.isFinite(Date.parse(a.exported_at))))) fail(422, 'Unsupported library format, version or import mode.', { archive: ['Unsupported library format, version or import mode.'] })
  for (const resource of libraryResources) {
    if (!Array.isArray(a[resource]) || a[resource].length > 20000) fail(422, 'Each library collection must be an array of up to 20000 records.', { [`archive.${resource}`]: ['Invalid collection.'] })
    const codes = new Set()
    const allowedKeys = ['code', 'name_vi', 'name_en', ...(resource === 'section_types' ? ['category', 'shape', 'design_code', 'region_type'] : resource === 'materials' ? ['category', 'design_code', 'source', 'properties'] : ['material_code', 'section_type_code', 'source', 'properties', 'section_properties', 'section_properties_calculated_at'])]
    a[resource].forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row) || !/^[A-Za-z0-9_-]{1,64}$/.test(row.code) || typeof row.code !== 'string' || codes.has(row.code) || Object.keys(row).some(key => !allowedKeys.includes(key)) || ['name_vi', 'name_en'].some(key => typeof row[key] !== 'string' || !row[key].trim() || row[key].length > 255)) fail(422, 'Invalid record or duplicate code in archive.', { [`archive.${resource}.${index}`]: ['Invalid record or duplicate code in archive.'] })
      codes.add(row.code)
    })
  }
  a.sections.forEach((row, index) => {
    for (const [key, resource] of [['material_code', 'materials'], ['section_type_code', 'section_types']]) if (typeof row[key] !== 'string' || !a[resource].some(item => item.code === row[key])) fail(422, 'Referenced code must be included in the archive.', { [`archive.sections.${index}.${key}`]: ['Referenced code must be included in the archive.'] })
  })
  const staged = structuredClone(db), counts = { created: 0, updated: 0, skipped: 0 }
  for (const resource of libraryResources) for (const [index, row] of a[resource].entries()) {
    const old = staged[resource].find(item => item.code === row.code)
    if (old && body.mode === 'skip') { counts.skipped++; continue }
    const data = { ...row }
    if (resource === 'sections') {
      data.material_id = staged.materials.find(item => item.code === row.material_code)?.id
      data.section_type_id = staged.section_types.find(item => item.code === row.section_type_code)?.id
      const type = staged.section_types.find(item => item.id === data.section_type_id)
      const descriptors = schema.fields.sections.filter(f => (!f.categories || f.categories.includes(type?.category)) && (!f.shapes || f.shapes.includes(type?.shape)))
      delete data.material_code; delete data.section_type_code
    }
    try { validate(resource, data, staged, old) } catch (error) {
      error.errors = Object.fromEntries(Object.entries(error.errors || {}).map(([key, messages]) => [`archive.${resource}.${index}.${key}`, messages]))
      error.message = `${resource} / ${row.code}: ${error.message}`; throw error
    }
    const record = await libraryRecord(resource, data, staged, old)
    if (old) staged[resource][staged[resource].indexOf(old)] = record; else staged[resource].push(record)
    counts[old ? 'updated' : 'created']++
  }
  // Persist once after all records pass; an error leaves the existing database untouched.
  save(staged)
  return counts
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
  if (url.pathname === '/api/v1/sections/calculate') {
    if (method !== 'POST') fail(405, 'Method not allowed.')
    try { return await calculateSectionProperties(body) } catch (error) { error.status = 422; throw error }
  }
  if (url.pathname === '/api/v1/section-types' && method === 'GET') return { data: ['rectangle', 'circle', 'i_section'].map(type => ({ type, geometry_variant: type === 'i_section' ? 'sharp_corner' : 'solid' })) }
  const locale = url.searchParams.get('locale') || body.locale || 'vi'
  if (!['vi', 'en'].includes(locale)) fail(422, 'Unsupported locale')
  if (url.pathname === '/api/library/schema') return schema
  if (['/api/library/export', '/api/library/import'].includes(url.pathname)) {
    if (user.role !== 'admin') fail(403, 'Administrator access required.')
    if (url.pathname === '/api/library/export' && method === 'GET') return { data: exportLibrary(db) }
    if (url.pathname === '/api/library/import' && method === 'POST') return { data: await importLibrary(db, body) }
    fail(405, 'Method not allowed.')
  }
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
    record = await libraryRecord(resource, body, db, old)
  }
  if (old) db[resource][index] = record; else db[resource].push(record)
  save(db); return { data: resource === 'users' ? publicUser(record) : present(resource, record) }
}
