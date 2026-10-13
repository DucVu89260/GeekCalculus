const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')

const demo = process.env.TEST_DEMO === '1'
const base = process.env.AUTH_BASE_URL || (demo ? 'http://127.0.0.1:8765/GeekCalculus/' : 'http://127.0.0.1:5173')
const numberFromText = value => Number(value.replace(/[^0-9,.-]/g, '').replaceAll(',', ''))

function close(actual, expected, label, relativeTolerance = 1e-9) {
  const tolerance = Math.max(1e-7, Math.abs(expected) * relativeTolerance)
  assert.ok(Number.isFinite(actual), `${label}: expected a finite number, got ${actual}`)
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual} (tolerance ${tolerance})`)
}

function expectedISection() {
  const depth = 400, topWidth = 200, bottomWidth = 250, web = 8, topThickness = 12, bottomThickness = 16
  const bottomArea = bottomWidth * bottomThickness
  const webHeight = depth - topThickness - bottomThickness
  const webArea = web * webHeight
  const topArea = topWidth * topThickness
  const area = bottomArea + webArea + topArea
  const centroidY = (bottomArea * bottomThickness / 2
    + webArea * (bottomThickness + webHeight / 2)
    + topArea * (depth - topThickness / 2)) / area
  const ix = bottomWidth * bottomThickness ** 3 / 12 + bottomArea * (bottomThickness / 2 - centroidY) ** 2
    + web * webHeight ** 3 / 12 + webArea * (bottomThickness + webHeight / 2 - centroidY) ** 2
    + topWidth * topThickness ** 3 / 12 + topArea * (depth - topThickness / 2 - centroidY) ** 2
  // Half the section area is 4,688 mm². The lower flange contains 4,000 mm²;
  // the remaining 688 mm² reaches 86 mm into the 8 mm web.
  return { area, ix, pnaX: bottomWidth / 2, pnaY: bottomThickness + (area / 2 - bottomArea) / web }
}

function expectedFor(type) {
  if (type === 'rectangle') return { area: 80000, ix: 200 * 400 ** 3 / 12, pnaX: 100, pnaY: 200 }
  if (type === 'circle') return { area: Math.PI * 200 ** 2 / 4, ix: Math.PI * 200 ** 4 / 64, pnaX: 100, pnaY: 100 }
  return expectedISection()
}

async function assertDisplayNumber(result, label, expected, unit) {
  const term = result.getByText(label, { exact: true })
  await term.waitFor()
  const value = await term.locator('xpath=..').locator('dd').innerText()
  close(numberFromText(value), expected, `displayed ${label}`, 1e-6)
  if (unit) assert.ok(value.includes(unit), `${label} should display ${unit}; got ${value}`)
}

async function exportResult(page, section, name) {
  const path = `/tmp/geekcalculus-sectional-${name}.json`
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    section.getByRole('button', { name: 'Download result JSON', exact: true }).click(),
  ])
  await download.saveAs(path)
  const payload = JSON.parse(fs.readFileSync(path, 'utf8'))
  fs.unlinkSync(path)
  return payload
}

async function verifyPreset(page, section, name, buttonName, type, extra = {}) {
  await section.getByRole('button', { name: buttonName, exact: true }).click()
  assert.equal(await section.locator('#section-geometry-type').inputValue(), type)
  await section.getByRole('button', { name: 'Calculate', exact: true }).click()
  const output = section.locator('.section-properties-result')
  await output.waitFor()

  const payload = await exportResult(page, section, name)
  const result = payload.result
  const expected = expectedFor(type)
  assert.equal(result.geometry_type, type)
  assert.equal(result.units.length, 'mm')
  assert.equal(result.units.area, 'mm2')
  assert.equal(result.units.second_moment, 'mm4')
  close(result.properties.geometric.area, expected.area, `${name} area`)
  close(result.properties.elastic.ix, expected.ix, `${name} Ix`)
  close(result.properties.plastic.pna_x, expected.pnaX, `${name} PNA x`)
  close(result.properties.plastic.pna_y, expected.pnaY, `${name} PNA y`)
  assert.equal(result.normalized_input.units, 'mm')
  assert.equal(result.normalized_input.options.include_advanced, true)
  for (const [key, value] of Object.entries(extra)) close(result.properties.elastic[key], value, `${name} ${key}`)

  await section.getByRole('img', { name: /Section diagram to scale/ }).waitFor()
  await assertDisplayNumber(output, 'Area A', expected.area, 'mm²')
  await assertDisplayNumber(output, 'Ix', expected.ix, 'mm⁴')
  await assertDisplayNumber(output, 'PNA coordinate x', expected.pnaX, 'mm')
  await assertDisplayNumber(output, 'PNA coordinate y', expected.pnaY, 'mm')
  await assertDisplayNumber(output, 'Elastic section moduli Sx+', result.properties.elastic.sx_positive, 'mm³')
  await assertDisplayNumber(output, 'Elastic section moduli Sx−', result.properties.elastic.sx_negative, 'mm³')
  assert.ok(await output.locator('.section-properties-advanced-card').isVisible())
  assert.equal(result.advanced.warping_constant_cw.status, 'not_computed')
  assert.equal(result.advanced.warping_constant_cw.value, null)
  assert.equal(result.advanced.shear_center.status, 'not_computed')
  assert.equal(result.advanced.effective_shear_area.value, null)
  return { output, result }
}

async function fillCatalogProperties(dialog, shape) {
  const values = {
    depth: 400, width: 200, diameter: 200, web_thickness: 8, flange_thickness: 13,
    area: 9999, inertia_y: 12345678, inertia_z: 2345678, torsion_constant: 350000,
    elastic_modulus_y: 1000000, elastic_modulus_z: 200000, shear_area_y: 5000, shear_area_z: 4500,
  }
  const keys = shape === 'i' || shape === 'channel' ? ['depth', 'width', 'web_thickness', 'flange_thickness']
    : shape === 'rectangle' ? ['depth', 'width'] : ['diameter']
  for (const key of [...keys, 'area', 'inertia_y', 'inertia_z', 'torsion_constant', 'elastic_modulus_y', 'elastic_modulus_z', 'shear_area_y', 'shear_area_z']) {
    const input = dialog.locator(`input[name="property-${key}"]`)
    if (await input.count()) await input.fill(String(values[key]))
  }
  return Object.fromEntries(await Promise.all(
    (await dialog.locator('input[name^="property-"]').evaluateAll(inputs => inputs.map(input => input.name))).map(async name => [name, await dialog.locator(`input[name="${name}"]`).inputValue()]),
  ))
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calculationRequests = []
  const catalogWrites = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/sections/calculate') calculationRequests.push(request.method())
    if (/^\/api\/(sections|section-types|materials)(\/[^/]+)?$/.test(url.pathname) && !['GET', 'HEAD'].includes(request.method())) catalogWrites.push(`${request.method()} ${url.pathname}`)
  })

  try {
    await page.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))
    await page.goto(base)
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    await signIn(page, { demo, role: 'user' })

    const steelUrl = new URL('#/modules/steel', base).href
    await page.goto(steelUrl)
    await page.getByRole('tab', { name: /^Component/ }).waitFor()
    await page.getByLabel(/^Member type/).waitFor()
    await page.getByRole('tab', { name: /^Connection/ }).click()
    await page.getByLabel(/^Connection type/).waitFor()
    await page.getByRole('tab', { name: /^Component/ }).click()
    const steelSection = page.locator('.section-properties').last()
    await page.getByRole('tab', { name: /^Section properties/ }).click()
    await page.getByText('Asymmetric I/H and advanced properties', { exact: true }).click()
    await steelSection.getByRole('heading', { name: 'Section properties', exact: true }).waitFor()

    const rectangle = await verifyPreset(page, steelSection, 'rectangle', 'TC-001 · Rectangle 200 × 400', 'rectangle')
    const width = steelSection.locator('.section-properties-input-grid input').nth(0)
    await width.fill('201')
    await rectangle.output.waitFor({ state: 'detached' })
    await steelSection.getByRole('button', { name: 'TC-001 · Rectangle 200 × 400', exact: true }).click()
    await steelSection.getByRole('button', { name: 'Calculate', exact: true }).click()
    await steelSection.locator('.section-properties-result').waitFor()
    const repeatedRectangle = await exportResult(page, steelSection, 'rectangle-repeat')
    assert.equal(repeatedRectangle.result.advanced.torsion_constant_j.status, 'computed')
    assert.ok(repeatedRectangle.result.advanced.torsion_constant_j.value > 0)
    await page.screenshot({ path: '/tmp/geekcalculus-section-properties-rectangle.png', fullPage: true })

    const circle = await verifyPreset(page, steelSection, 'circle', 'TC-002 · Circle D200', 'circle')
    assert.equal(circle.result.advanced.torsion_constant_j.status, 'computed')
    close(circle.result.advanced.torsion_constant_j.value, Math.PI * 200 ** 4 / 32, 'circle torsion J')

    const iSection = await verifyPreset(page, steelSection, 'i-section', 'TC-003 · Asymmetric I/H', 'i_section')
    for (const [name, property] of Object.entries(iSection.result.advanced)) {
      assert.equal(property.status, 'not_computed', `${name} should be marked not computed for an I-section`)
      assert.equal(property.value, null, `${name} should not report a numeric I-section value`)
    }
    assert.match(await iSection.output.innerText(), /Warping constant Cw[\s\S]*Not implemented/)
    await page.screenshot({ path: '/tmp/geekcalculus-section-properties-i.png', fullPage: true })

    await page.locator('.module-navigation a[href$="/modules/concrete"]').click()
    const concreteSection = page.locator('.concrete-section-properties .section-properties')
    await page.getByRole('tab', { name: 'Section properties', exact: true }).click()
    await page.getByText('Asymmetric I/H and advanced properties', { exact: true }).click()
    await concreteSection.getByRole('heading', { name: 'Section properties', exact: true }).waitFor()
    const concreteRectangle = await verifyPreset(page, concreteSection, 'concrete-rectangle', 'TC-001 · Rectangle 200 × 400', 'rectangle')
    close(concreteRectangle.result.properties.geometric.area, 80000, 'concrete section rectangle parity')
    await page.screenshot({ path: '/tmp/geekcalculus-concrete-section-properties.png', fullPage: true })

    await page.getByRole('button', { name: 'VI', exact: true }).click()
    await page.getByRole('heading', { name: 'Đặc trưng tiết diện', exact: true }).waitFor()
    assert.equal(await page.locator('html').getAttribute('lang'), 'vi')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Vietnamese sectional UI overflows the 390px viewport')
    await page.screenshot({ path: '/tmp/geekcalculus-section-properties-mobile-vi.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.getByRole('button', { name: 'EN', exact: true }).click()

    await page.getByRole('button', { name: /Sign out/ }).click()
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    await page.goto(base)
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    await signIn(page, { demo, role: 'admin' })
    await page.getByRole('heading', { name: 'Which workspace do you want to open?', exact: true }).waitFor()
    await page.getByRole('button', { name: /Admin interface/ }).click()
    await page.getByRole('tab', { name: 'Sections', exact: true }).click()
    const addSection = page.getByRole('button', { name: /Add section$/ })
    await addSection.waitFor({ state: 'visible' })
    await addSection.waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('.library-add-button')].find(item => item.textContent.includes('Add section'))
      return button && !button.disabled
    })
    await addSection.click()
    const editor = page.getByRole('dialog')
    await editor.waitFor()
    const typeSelect = editor.getByLabel(/^Section type/)
    const materialSelect = editor.getByLabel(/^Material/)
    async function chooseSectionType(code) {
      const option = typeSelect.locator('option').filter({ hasText: new RegExp(`^${code}\\s·`) }).first()
      const value = await option.getAttribute('value')
      assert.ok(value, `Missing seeded section type ${code}`)
      await typeSelect.selectOption(value)
      await editor.getByRole('img', { name: 'Section sketch', exact: true }).waitFor()
    }
    await chooseSectionType('i')
    const steelMaterial = materialSelect.locator('option').filter({ hasText: /^steel_s235\s·/ }).first()
    await materialSelect.selectOption(await steelMaterial.getAttribute('value'))
    assert.equal(await editor.locator('input[name="property-depth"]').count(), 1)
    assert.equal(await editor.locator('input[name="property-width"]').count(), 1)
    const original = await fillCatalogProperties(editor, 'i')
    await editor.getByRole('button', { name: 'Calculate XY properties', exact: true }).click()
    const engineResult = editor.getByRole('region', { name: 'Calculated properties' })
    await engineResult.waitFor()
    await assertDisplayNumber(engineResult, 'Area A', 8192, 'mm²')
    assert.equal(await editor.locator('input[name="property-area"]').inputValue(), original['property-area'], 'Calculating must not overwrite catalog area')
    assert.equal(await editor.locator('input[name="property-inertia_y"]').inputValue(), original['property-inertia_y'], 'Calculating must not overwrite catalog inertia')
    const editorProperties = await editor.locator('input[name^="property-"]').evaluateAll(inputs => Object.fromEntries(inputs.map(input => [input.name, input.value])))
    assert.deepEqual(editorProperties, original, 'Calculated XY properties must leave all manually entered catalog properties untouched')
    await page.screenshot({ path: '/tmp/geekcalculus-section-editor-i-result.png', fullPage: true })

    await editor.locator('input[name="property-depth"]').fill('410')
    await engineResult.waitFor({ state: 'detached' })

    await chooseSectionType('rectangle')
    assert.equal(await editor.locator('input[name="property-depth"]').count(), 1)
    assert.equal(await editor.locator('input[name="property-width"]').count(), 1)
    await editor.locator('input[name="property-depth"]').fill('400')
    await editor.locator('input[name="property-width"]').fill('200')
    await editor.getByRole('button', { name: 'Calculate XY properties', exact: true }).click()
    await editor.getByRole('region', { name: 'Calculated properties' }).waitFor()

    await chooseSectionType('circle')
    assert.equal(await editor.locator('input[name="property-diameter"]').count(), 1)
    await editor.locator('input[name="property-diameter"]').fill('200')
    await editor.getByRole('button', { name: 'Calculate XY properties', exact: true }).click()
    const circleEditorResult = editor.getByRole('region', { name: 'Calculated properties' })
    await circleEditorResult.waitFor()
    await assertDisplayNumber(circleEditorResult, 'Area A', Math.PI * 200 ** 2 / 4, 'mm²')

    await chooseSectionType('channel')
    await editor.locator('input[name="property-depth"]').fill('400')
    await editor.locator('input[name="property-width"]').fill('200')
    await editor.locator('input[name="property-web_thickness"]').fill('8')
    await editor.locator('input[name="property-flange_thickness"]').fill('13')
    await editor.getByRole('img', { name: 'Section sketch', exact: true }).waitFor()
    await editor.getByText('V1 calculations support solid rectangles, solid circles, and I-sections.', { exact: false }).waitFor()
    assert.equal(await editor.getByRole('button', { name: 'Calculate XY properties', exact: true }).count(), 0, 'Unsupported shapes must not expose the calculator button')
    await page.screenshot({ path: '/tmp/geekcalculus-section-editor-unsupported.png', fullPage: true })
    await editor.locator('.editor-actions').getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(catalogWrites.length, 0, `Admin preview unexpectedly wrote catalog records: ${catalogWrites.join(', ')}`)

    if (demo) assert.equal(calculationRequests.length, 0, 'Browser demo should calculate locally without network requests')
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log(`${demo ? 'Demo' : 'Laravel'} sectional UI checks passed: three numeric fixtures, exported engine values, SVG and formatted units, plastic/advanced states, rectangle J rerun, editor read-only properties, supported/unsupported catalog sketches, VI mobile layout, and no catalog writes.`)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
