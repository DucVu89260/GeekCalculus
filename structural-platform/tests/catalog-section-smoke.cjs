const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')
const schema = require('../database/seeds/engineering-schema.json')

const base = process.env.CATALOG_DEMO_URL || 'http://127.0.0.1:5191/'
const derivedKeys = schema.fields.sections.filter(field => field.read_only === true).map(field => field.key)

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } })
  const page = await context.newPage()
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geek-catalog-section-'))
  const pageErrors = []
  let calculationRequests = 0
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/sections/calculate') calculationRequests++ })
  await context.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))

  try {
    await page.goto(base)
    await signIn(page, { demo: true, role: 'admin' })
    const adminMode = page.getByRole('button', { name: /Admin interface/ })
    if (await adminMode.count()) await adminMode.click()
    await page.getByRole('tab', { name: 'Sections', exact: true }).click()
    await page.getByRole('button', { name: /Add section$/ }).click()

    const dialog = page.getByRole('dialog')
    const code = `catalog_rect_${Date.now()}`
    await dialog.getByLabel(/^Code/).fill(code)
    await dialog.getByLabel(/^Vietnamese name/).fill('Browser catalog rectangle')
    await dialog.getByLabel(/^English name/).fill('Browser catalog rectangle')
    const typeSelect = dialog.getByLabel(/^Section type/)
    const rectangleTypeId = await typeSelect.locator('option').filter({ hasText: 'rectangle' }).getAttribute('value')
    await typeSelect.selectOption(rectangleTypeId)
    const materialSelect = dialog.getByLabel(/^Material/)
    const concreteId = await materialSelect.locator('option').filter({ hasText: 'concrete_b25' }).getAttribute('value')
    await materialSelect.selectOption(concreteId)

    for (const key of derivedKeys) {
      assert.equal(await dialog.locator(`input[name="property-${key}"]`).count(), 0, `Derived ${key} must not be manually editable`)
    }
    const save = dialog.getByRole('button', { name: 'Create record', exact: true })
    assert.equal(await save.isDisabled(), true, 'A section cannot save before geometry has a calculated preview')
    await dialog.locator('input[name="property-depth"]').fill('240')
    await dialog.locator('input[name="property-width"]').fill('120')
    await dialog.locator('.section-calculated-properties').waitFor()
    const previewArea = dialog.locator('.section-calculated-group').filter({ has: page.getByRole('heading', { name: 'Geometric', exact: true }) }).locator('dl > div').filter({ hasText: 'A · Area' }).locator('dd')
    await page.waitForFunction(() => document.querySelector('.section-calculated-group dl > div dd')?.textContent?.trim() !== '')
    assert.match(await previewArea.textContent(), /28[,.\s]?800/)
    assert.equal(await save.isDisabled(), false, 'A successful geometry preview enables saving')
    await save.click()
    await dialog.waitFor({ state: 'detached' })

    const row = page.locator('.library-table tbody tr').filter({ has: page.getByRole('cell', { name: code, exact: true }) })
    await row.waitFor()
    const created = await page.evaluate(code => {
      const db = JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1'))
      return db.sections.find(section => section.code === code)
    }, code)
    assert.deepEqual(created.properties, { depth: 240, width: 120 }, 'Only geometry/auxiliary inputs are stored as section properties')
    assert.ok(created.section_properties?.properties?.geometric?.area > 0)
    assert.ok(created.section_properties?.properties?.elastic?.ix > 0)
    assert.ok(created.section_properties?.geometry_hash)
    assert.ok(Number.isFinite(Date.parse(created.section_properties_calculated_at)))

    await row.locator('.property-details > summary').click()
    await row.locator('.section-calculated-properties').getByText('A · Area', { exact: true }).waitFor()
    const originalAreaDisplay = await row.locator('.section-calculated-properties dl > div').filter({ hasText: 'A · Area' }).locator('dd').textContent()
    const initialHash = created.section_properties.geometry_hash
    calculationRequests = 0
    await page.reload()
    const adminModeAfterReload = page.getByRole('button', { name: /Admin interface/ })
    if (await adminModeAfterReload.count()) await adminModeAfterReload.click()
    await page.getByRole('tab', { name: 'Sections', exact: true }).click()
    const reloadedRow = page.locator('.library-table tbody tr').filter({ has: page.getByRole('cell', { name: code, exact: true }) })
    await reloadedRow.waitFor()
    await reloadedRow.locator('.property-details > summary').click()
    await reloadedRow.locator('.section-calculated-properties').getByText('A · Area', { exact: true }).waitFor()
    assert.equal(calculationRequests, 0, 'Reading a saved section snapshot must not recalculate it')
    const reloaded = await page.evaluate(code => JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1')).sections.find(section => section.code === code), code)
    assert.equal(reloaded.section_properties.geometry_hash, initialHash, 'Reload must show the saved snapshot')

    await reloadedRow.getByRole('button', { name: 'Edit', exact: true }).click()
    const edit = page.getByRole('dialog')
    for (const key of derivedKeys) assert.equal(await edit.locator(`input[name="property-${key}"]`).count(), 0)
    await edit.locator('input[name="property-width"]').fill('130')
    const editedPreviewArea = edit.locator('.section-calculated-properties dl > div').filter({ hasText: 'A · Area' }).locator('dd')
    await page.waitForFunction((previous) => {
      const dialog = document.querySelector('[role="dialog"]')
      const areaRow = [...(dialog?.querySelectorAll('.section-calculated-group dl > div') ?? [])].find(row => row.textContent.includes('A · Area'))
      return areaRow && areaRow.querySelector('dd')?.textContent !== previous && areaRow.querySelector('dd')?.textContent?.trim() !== ''
    }, originalAreaDisplay)
    assert.match(await editedPreviewArea.textContent(), /31[,.\s]?200/)
    await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
    await edit.waitFor({ state: 'detached' })
    const updated = await page.evaluate(code => JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1')).sections.find(section => section.code === code), code)
    assert.equal(updated.properties.width, 130)
    assert.equal(updated.section_properties.properties.geometric.area, 31200)
    assert.notEqual(updated.section_properties.geometry_hash, initialHash, 'Changing geometry must replace the saved calculation')

    await page.getByRole('button', { name: /Add section$/ }).click()
    const asymmetricDialog = page.getByRole('dialog')
    const asymmetricCode = `${code}_asym`
    await asymmetricDialog.getByLabel(/^Code/).fill(asymmetricCode)
    await asymmetricDialog.getByLabel(/^Vietnamese name/).fill('Asymmetric I browser fixture')
    await asymmetricDialog.getByLabel(/^English name/).fill('Asymmetric I browser fixture')
    const iType = asymmetricDialog.getByLabel(/^Section type/)
    const iTypeId = await iType.locator('option').filter({ hasText: /^i ·/ }).getAttribute('value')
    await iType.selectOption(iTypeId)
    const steelMaterial = asymmetricDialog.getByLabel(/^Material/)
    const steelMaterialId = await steelMaterial.locator('option').filter({ hasText: /^steel_s235/ }).getAttribute('value')
    await steelMaterial.selectOption(steelMaterialId)
    await asymmetricDialog.getByRole('button', { name: 'Asymmetric', exact: true }).click()
    assert.equal(await asymmetricDialog.locator('input[name="property-width"]').count(), 0)
    assert.equal(await asymmetricDialog.locator('input[name="property-flange_thickness"]').count(), 0)
    await asymmetricDialog.getByRole('button', { name: 'Symmetric', exact: true }).click()
    assert.equal(await asymmetricDialog.locator('input[name="property-top_flange_width"]').count(), 0)
    await asymmetricDialog.getByRole('button', { name: 'Asymmetric', exact: true }).click()
    for (const [key, value] of Object.entries({ depth: 400, web_thickness: 8, top_flange_width: 180, bottom_flange_width: 160, top_flange_thickness: 14, bottom_flange_thickness: 12 })) {
      await asymmetricDialog.locator(`input[name="property-${key}"]`).fill(String(value))
    }
    await asymmetricDialog.locator('.section-calculated-properties').waitFor()
    await asymmetricDialog.getByRole('button', { name: 'Create record', exact: true }).click()
    await asymmetricDialog.waitFor({ state: 'detached' })
    const asymmetricRecord = await page.evaluate(code => JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1')).sections.find(section => section.code === code), asymmetricCode)
    assert.deepEqual(asymmetricRecord.properties, { depth: 400, web_thickness: 8, top_flange_width: 180, bottom_flange_width: 160, top_flange_thickness: 14, bottom_flange_thickness: 12 })
    assert.deepEqual(asymmetricRecord.section_properties.normalized_input.geometry.dimensions, asymmetricRecord.properties)
    assert.equal(asymmetricRecord.section_properties.advanced.shear_center.status, 'computed')

    await page.waitForTimeout(1100)
    const exportPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
    const exportDownload = await exportPromise
    assert.equal(await exportDownload.failure(), null)
    const exportPath = path.join(temporary, 'library.json')
    await exportDownload.saveAs(exportPath)
    const archive = JSON.parse(fs.readFileSync(exportPath, 'utf8'))
    const importedSection = archive.sections.find(item => item.code === code)
    const importedAsymmetric = archive.sections.find(item => item.code === asymmetricCode)
    importedSection.section_properties = { schema_version: 'forged', geometry_hash: 'forged-snapshot', properties: { geometric: { area: 1 } } }
    importedSection.section_properties_calculated_at = '2000-01-01T00:00:00.000Z'
    importedAsymmetric.section_properties = { schema_version: 'forged', geometry_hash: 'forged-i-snapshot', properties: { geometric: { area: 1 } } }
    importedAsymmetric.section_properties_calculated_at = '2000-01-01T00:00:00.000Z'
    await page.locator('.library-transfer input[type=file]').setInputFiles({ name: 'forged-snapshot.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archive)) })
    await page.locator('.library-transfer-preview').waitFor()
    await page.getByLabel(/^When codes match/).selectOption('overwrite')
    await page.waitForTimeout(1100)
    const backupPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Import library', exact: true }).click()
    const backupDownload = await backupPromise
    assert.equal(await backupDownload.failure(), null, 'The library import requires a successful backup download')
    await page.locator('.library-transfer-result').waitFor()
    await page.locator('.library-transfer-preview').waitFor({ state: 'detached' })
    const forgedImport = await page.evaluate(code => JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1')).sections.find(item => item.code === code), code)
    assert.equal(forgedImport.properties.width, 130)
    assert.equal(forgedImport.section_properties.properties.geometric.area, 31200)
    assert.notEqual(forgedImport.section_properties.geometry_hash, 'forged-snapshot', 'Import must recalculate from geometry and ignore a supplied snapshot')
    assert.notEqual(forgedImport.section_properties_calculated_at, '2000-01-01T00:00:00.000Z')
    const importedI = await page.evaluate(code => JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1')).sections.find(item => item.code === code), asymmetricCode)
    assert.deepEqual(importedI.properties, asymmetricRecord.properties)
    assert.notEqual(importedI.section_properties.geometry_hash, 'forged-i-snapshot', 'Asymmetric I imports must ignore supplied snapshots too')

    const persistedBeforeInvalidImport = await page.evaluate(() => JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1')).sections.map(section => ({
      code: section.code,
      properties: section.properties,
      geometry_hash: section.section_properties?.geometry_hash,
    })))
    for (const [label, mutate] of [
      ['array geometry', row => { row.properties.width = [130] }],
      ['unknown property', row => { row.properties.unrecognized_dimension = 1 }],
    ]) {
      const invalidArchive = structuredClone(archive)
      mutate(invalidArchive.sections.find(item => item.code === code))
      await page.locator('.library-transfer input[type=file]').setInputFiles({ name: `invalid-${label.replaceAll(' ', '-')}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidArchive)) })
      await page.locator('.library-transfer-preview').waitFor()
      await page.getByLabel(/^When codes match/).selectOption('overwrite')
      await page.waitForTimeout(1100)
      const invalidBackupPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Import library', exact: true }).click()
      const invalidBackup = await invalidBackupPromise
      assert.equal(await invalidBackup.failure(), null, 'The invalid archive must be backed up before validation')
      await page.locator('.library-transfer-error').waitFor()
      assert.equal(await page.locator('.library-transfer-result').count(), 0)
      const persistedAfterInvalidImport = await page.evaluate(() => JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1')).sections.map(section => ({
        code: section.code,
        properties: section.properties,
        geometry_hash: section.section_properties?.geometry_hash,
      })))
      assert.deepEqual(persistedAfterInvalidImport, persistedBeforeInvalidImport, `Invalid ${label} must be rejected before normalization and leave stored records unchanged`)
    }
    assert.deepEqual(pageErrors, [], pageErrors.join('\n'))
    console.log('Catalog section browser smoke passed: no manual derived fields, preview-gated saves, snapshots persist and reload without recalculation, edits replace snapshots, forged snapshots are ignored on import, and invalid raw geometry/unknown keys reject atomically.')
  } finally {
    await context.close()
    await browser.close()
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
