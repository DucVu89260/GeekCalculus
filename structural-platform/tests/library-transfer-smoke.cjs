const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')
const seed = require('../database/seeds/engineering-data.json')
const demoBase = process.env.TRANSFER_DEMO_URL || 'http://127.0.0.1:8765/GeekCalculus/'
const localBase = process.env.TRANSFER_LOCAL_URL || 'http://127.0.0.1:5173'

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geek-library-transfer-'))
  const contexts = [], errors = []
  const nonce = Date.now().toString(), materialCode = `browser_transfer_m_${nonce}`, typeCode = `browser_transfer_t_${nonce}`, sectionCode = `browser_transfer_s_${nonce}`, driftCode = `browser_transfer_drift_${nonce}`, rejectedCode = `browser_transfer_bad_${nonce}`
  const fixture = {
    format: 'geekcalculus-engineering-library', version: 1, exported_at: new Date().toISOString(),
    materials: [{ ...seed.materials[0], code: materialCode, design_code: 'VN', name_vi: 'Thép thư viện đã xác minh', name_en: 'Verified library steel', source: 'Browser test fixture; not design values' }],
    section_types: [{ ...seed.section_types[0], code: typeCode, design_code: 'VN', region_type: 'IPE', name_vi: 'Tiết diện I thử', name_en: 'Test I type' }],
    sections: [{ code: sectionCode, name_vi: 'I400 thử', name_en: 'Test I400', source: 'Test fixture', material_code: materialCode, section_type_code: typeCode, properties: { depth: 400, width: 200, web_thickness: 8, flange_thickness: 13, area: 9000, inertia_y: 2e8, inertia_z: 2e7, torsion_constant: 350000, elastic_modulus_y: 1e6, elastic_modulus_z: 2e5, shear_area_y: 5000, shear_area_z: 4500, warping_constant: 1e12 }, section_properties: { geometry_hash: 'forged-snapshot', properties: { geometric: { area: 1 } } }, section_properties_calculated_at: '2000-01-01T00:00:00.000Z' }],
  }
  let localPage
  async function open(base, demo, role = 'admin') {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } }); contexts.push(context)
    await context.addInitScript(() => { if (['http:', 'https:'].includes(location.protocol)) localStorage.setItem('geekcalculus-locale', 'en') })
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message))
    await page.goto(base)
    await signIn(page, { demo, role })
    if (role === 'admin') { await page.getByRole('button', { name: /Admin interface/ }).click(); await page.locator('.library-transfer').waitFor() }
    return page
  }
  async function exportArchive(page) {
    // Chromium throttles rapid downloads; pace clicks like a real backup workflow.
    await page.waitForTimeout(1100)
    const promise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
    const download = await promise
    assert.equal(await download.failure(), null)
    const filename = path.join(temporary, `${Date.now()}-${download.suggestedFilename()}`)
    await download.saveAs(filename)
    return JSON.parse(fs.readFileSync(filename, 'utf8'))
  }
  async function preview(page, archive) {
    await page.locator('.library-transfer input[type=file]').setInputFiles({ name: 'library.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archive)) })
    await page.locator('.library-transfer-preview').waitFor()
  }
  async function importArchive(page, archive, { mode = 'skip', expected, failure = false } = {}) {
    await preview(page, archive)
    const before = await exportArchive(page)
    await page.getByLabel(/^When codes match/).selectOption(mode)
    await page.waitForTimeout(1100)
    const promise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Import library', exact: true }).click()
    const backup = await promise
    assert.equal(await backup.failure(), null)
    assert.ok(backup.suggestedFilename().includes('backup'))
    const backupPath = path.join(temporary, `backup-${Date.now()}.json`)
    await backup.saveAs(backupPath)
    const savedBackup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    assert.deepEqual(withoutTime(savedBackup), withoutTime(before), 'Backup must contain the library before import')
    if (failure) await page.locator('.library-transfer-error').waitFor()
    else {
      await page.locator('.library-transfer-result').waitFor()
      await page.locator('.library-transfer-preview').waitFor({ state: 'detached' })
      if (expected) assert.deepEqual(await page.locator('.library-transfer-result dd').allTextContents(), expected.map(String))
    }
    return before
  }
  function withoutTime(archive) { const clone = structuredClone(archive); delete clone.exported_at; return clone }
  function customRecords(archive) {
    const derived = ['area', 'inertia_x', 'inertia_y', 'inertia_z', 'torsion_constant', 'elastic_modulus_x', 'elastic_modulus_y', 'elastic_modulus_z', 'shear_area_x', 'shear_area_y', 'shear_area_z', 'warping_constant', 'plastic_modulus_x', 'plastic_modulus_y', 'plastic_modulus_z', 'shear_center_x', 'shear_center_y', 'shear_center_z', 'section_modulus_x', 'section_modulus_y', 'section_modulus_z', 'radius_gyration_x', 'radius_gyration_y', 'radius_gyration_z']
    return Object.fromEntries(['materials', 'section_types', 'sections'].map(resource => [resource, archive[resource].filter(row => [materialCode, typeCode, sectionCode].includes(row.code)).map(row => {
      const copy = structuredClone(row)
      if (resource === 'sections') {
        delete copy.section_properties; delete copy.section_properties_calculated_at
        for (const key of derived) delete copy.properties[key]
      }
      return copy
    })]))
  }
  function savedSection(archive) { return archive.sections.find(row => row.code === sectionCode) }
  async function realApi(page, endpoint, method = 'GET', body) {
    return page.evaluate(async ({ endpoint, method, body }) => {
      const token = method === 'GET' ? null : (await (await fetch('/api/auth/csrf', { headers: { Accept: 'application/json' } })).json()).csrf_token
      const response = await fetch(endpoint, { method, headers: { Accept: 'application/json', ...(token ? { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
      return { status: response.status, payload: await response.json() }
    }, { endpoint, method, body })
  }
  try {
    const source = await open(demoBase, true)
    const legacyRecords = await source.evaluate(() => {
      const key = 'geekcalculus-demo-library-v1', db = JSON.parse(localStorage.getItem(key))
      for (const resource of ['materials', 'section_types']) for (const row of db[resource]) { delete row.design_code; delete row.region_type }
      db.materials[0].name_en = 'User edit before classification migration'
      localStorage.setItem(key, JSON.stringify(db))
      return { materials: db.materials, section_types: db.section_types, sections: db.sections }
    })
    const upgraded = await exportArchive(source)
    assert.equal(upgraded.materials.find(row => row.code === legacyRecords.materials[0].code).name_en, 'User edit before classification migration')
    assert.ok(upgraded.materials.every(row => row.design_code === null))
    assert.ok(upgraded.section_types.every(row => row.design_code === null && row.region_type === null))
    assert.deepEqual(await source.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1'))
      return { materials: db.materials, section_types: db.section_types, sections: db.sections }
    }), legacyRecords, 'Reading legacy data must not overwrite the stored library')
    assert.equal(await source.getByLabel(/^When codes match/).inputValue(), 'skip')
    await preview(source, fixture)
    assert.equal((await exportArchive(source)).materials.some(row => row.code === materialCode), false, 'File selection must not mutate data')
    await importArchive(source, fixture, { expected: [3, 0, 0] })
    const exported = await exportArchive(source)
    assert.deepEqual(customRecords(exported), customRecords(fixture))
    const saved = savedSection(exported)
    assert.ok(saved.section_properties?.geometry_hash)
    assert.notEqual(saved.section_properties.geometry_hash, 'forged-snapshot', 'Imports must recalculate rather than trust the uploaded result')
    assert.notEqual(saved.section_properties_calculated_at, fixture.sections[0].section_properties_calculated_at)
    assert.deepEqual(saved.properties, { depth: 400, width: 200, web_thickness: 8, flange_thickness: 13 }, 'New section records must keep geometry inputs only')
    for (const key of ['users', 'projects', 'password']) assert.equal(key in exported, false)
    for (const resource of ['materials', 'section_types', 'sections']) for (const row of exported[resource]) for (const key of ['id', 'computed', 'material_id', 'section_type_id']) assert.equal(key in row, false)
    await source.reload(); await source.getByRole('button', { name: /Admin interface/ }).click()
    assert.deepEqual(customRecords(await exportArchive(source)), customRecords(exported), 'Demo reload must preserve edits')
    await source.getByRole('button', { name: 'VI', exact: true }).click()
    await source.getByRole('button', { name: 'Xuất JSON', exact: true }).waitFor()
    await source.getByLabel(/^Khi trùng mã/).selectOption('overwrite')
    await source.getByRole('button', { name: 'EN', exact: true }).click()
    assert.equal(await source.getByLabel(/^When codes match/).inputValue(), 'overwrite')
    await source.setViewportSize({ width: 390, height: 844 })
    assert.ok(await source.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Library transfer mobile overflow')
    await source.screenshot({ path: '/tmp/geek-library-transfer-mobile.png', fullPage: true })
    await source.setViewportSize({ width: 1440, height: 1100 })
    const restored = await open(demoBase, true)
    await importArchive(restored, exported, { expected: [3, 0, 12] })
    assert.deepEqual(customRecords(await exportArchive(restored)), customRecords(exported), 'Another browser must recover all engineering values')
    const changed = structuredClone(fixture); changed.materials[0].name_en = 'Updated verified steel'; changed.materials[0].properties.elastic_modulus = 205000
    await importArchive(restored, changed, { expected: [0, 0, 3] })
    assert.deepEqual(customRecords(await exportArchive(restored)), customRecords(exported), 'Skip must preserve matching records')
    await importArchive(restored, changed, { mode: 'overwrite', expected: [0, 3, 0] })
    assert.deepEqual(customRecords(await exportArchive(restored)), customRecords(changed))
    const legacyArchive = structuredClone(changed)
    for (const row of legacyArchive.materials) delete row.design_code
    for (const row of legacyArchive.section_types) { delete row.design_code; delete row.region_type }
    await importArchive(restored, legacyArchive, { mode: 'overwrite', expected: [0, 3, 0] })
    assert.deepEqual(customRecords(await exportArchive(restored)), customRecords(changed), 'Old archives must preserve newer classification when omitted')
    const bad = structuredClone(changed); bad.materials[0].name_en = 'Must roll back'; bad.materials.push({ ...bad.materials[0], code: rejectedCode }); bad.sections[0].properties.depth = 0
    const beforeFailure = await importArchive(restored, bad, { mode: 'overwrite', failure: true })
    await restored.getByText('archive.sections.0.properties.depth', { exact: true }).waitFor()
    assert.deepEqual(withoutTime(await exportArchive(restored)), withoutTime(beforeFailure), 'Demo batch failure must roll back')
    await restored.locator('.library-transfer input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
    await restored.getByText('The file is not valid JSON.', { exact: true }).waitFor()
    assert.equal(await restored.getByRole('button', { name: 'Import library', exact: true }).isDisabled(), true)

    localPage = await open(localBase, false)
    const unrelated = { ...fixture.materials[0], code: driftCode }
    assert.equal((await realApi(localPage, '/api/materials', 'POST', unrelated)).status, 201)
    const localBefore = await exportArchive(localPage)
    const skipped = exported.materials.filter(row => localBefore.materials.some(item => item.code === row.code)).length + exported.section_types.filter(row => localBefore.section_types.some(item => item.code === row.code)).length
    await importArchive(localPage, exported, { expected: [3, 0, skipped] })
    const localExport = await exportArchive(localPage)
    assert.deepEqual(customRecords(localExport), customRecords(exported), 'Demo → Laravel must preserve numeric values, labels, sources and reference codes')
    assert.ok(localExport.materials.some(row => row.code === driftCode), 'Unrelated existing records must remain')
    const sections = (await realApi(localPage, '/api/sections')).payload.data
    const materials = (await realApi(localPage, '/api/materials')).payload.data
    const types = (await realApi(localPage, '/api/section-types')).payload.data
    const section = sections.find(row => row.code === sectionCode)
    assert.equal(materials.find(row => row.id === section.material_id).code, materialCode)
    assert.equal(types.find(row => row.id === section.section_type_id).code, typeCode)
    await localPage.getByRole('tab', { name: 'Sections', exact: true }).click()
    await localPage.locator('.library-table tbody tr').filter({ hasText: sectionCode }).waitFor()
    await importArchive(localPage, changed, { expected: [0, 0, 3] })
    await importArchive(localPage, changed, { mode: 'overwrite', expected: [0, 3, 0] })
    const localFailureBefore = await importArchive(localPage, bad, { mode: 'overwrite', failure: true })
    await localPage.getByText('archive.sections.0.properties.depth', { exact: true }).waitFor()
    assert.deepEqual(withoutTime(await exportArchive(localPage)), withoutTime(localFailureBefore), 'Laravel batch failure must roll back')
    await preview(localPage, fixture)
    await localPage.route('**/api/library/export', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
    let importPosts = 0
    const countImports = req => { if (req.method() === 'POST' && req.url().endsWith('/api/library/import')) importPosts++ }
    localPage.on('request', countImports)
    await localPage.getByRole('button', { name: 'Import library', exact: true }).click()
    await localPage.getByText('The current backup could not be downloaded, so the import was stopped.', { exact: true }).waitFor()
    assert.equal(importPosts, 0, 'Backup failure must prevent import')
    await localPage.unroute('**/api/library/export')
    localPage.off('request', countImports)
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log('Library transfer passed: demo → another browser → Laravel, JSON classification/values/references, legacy browser/archive preservation, backup downloads before import, skip/overwrite, unrelated records, atomic rollback, invalid JSON, backup failure blocks import, VI/EN, reload, mobile.')
  } finally {
    if (localPage) {
      await localPage.unroute('**/api/library/export').catch(() => {})
      for (const resource of ['sections', 'section-types', 'materials']) {
        const result = await realApi(localPage, `/api/${resource}`)
        if (result.status !== 200) throw new Error('Cannot list fixtures for cleanup')
        for (const row of result.payload.data.filter(row => [materialCode, typeCode, sectionCode, driftCode, rejectedCode].includes(row.code))) assert.equal((await realApi(localPage, `/api/${resource}/${row.id}`, 'DELETE')).status, 200)
      }
    }
    await browser.close()
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
