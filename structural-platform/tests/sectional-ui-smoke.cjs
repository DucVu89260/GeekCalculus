const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')

const demo = process.env.TEST_DEMO === '1'
const base = process.env.AUTH_BASE_URL || (demo ? 'http://127.0.0.1:8765/GeekCalculus/' : 'http://127.0.0.1:5173')
const expectedProfileIds = ['rectangle', 'circle', 'chs', 'shs_rhs', 'symmetric_i', 'asymmetric_i', 'channel', 'angle', 'tee', 'double_angle']
const profilesToCalculate = process.env.SECTION_PROFILE_LIMIT
  ? expectedProfileIds.slice(0, Number(process.env.SECTION_PROFILE_LIMIT))
  : expectedProfileIds
const profileDimensions = {
  rectangle: { width: 200, height: 400 },
  circle: { diameter: 200 },
  chs: { diameter: 200, thickness: 10 },
  shs_rhs: { width: 200, height: 400, thickness: 10 },
  symmetric_i: { depth: 400, width: 200, web_thickness: 8, flange_thickness: 12 },
  asymmetric_i: { depth: 400, top_flange_width: 200, bottom_flange_width: 250, web_thickness: 8, top_flange_thickness: 12, bottom_flange_thickness: 16 },
  channel: { depth: 400, width: 200, web_thickness: 8, flange_thickness: 12 },
  angle: { depth: 400, width: 200, thickness: 8 },
  tee: { depth: 400, width: 200, web_thickness: 8, flange_thickness: 12 },
  double_angle: { depth: 400, width: 200, thickness: 8, distance: 0 },
}

async function setGeometry(panel, profileId) {
  const selector = panel.locator('select').first()
  await selector.selectOption(profileId)
  for (const [key, value] of Object.entries(profileDimensions[profileId])) {
    const input = panel.locator(`input[name="dimension-${key}"]`)
    await input.fill(String(value))
  }
  const result = panel.locator('.section-calculated-properties')
  try { await result.waitFor({ state: 'visible', timeout: 15000 }) } catch (error) {
    console.error(`Calculation failed for ${profileId}:`, await panel.innerText())
    throw error
  }
  await panel.locator('details.section-calculated-formula-report > summary').waitFor({ state: 'visible', timeout: 15000 })
  await panel.page().waitForFunction(expected => {
    const value = document.querySelector('.section-properties-panel .section-calculated-report-meta dd')?.textContent?.trim()
    return value === expected
  }, profileId, { timeout: 15000 })
  return result
}

async function assertProfileOptions(panel) {
  const options = await panel.locator('select').first().locator('option').evaluateAll(items => items.map(item => item.value))
  assert.deepEqual(options, expectedProfileIds)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calculationResponses = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/api/v1/sections/calculate') calculationResponses.push(response.status())
  })

  try {
    await page.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))
    await page.goto(base)
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    await signIn(page, { demo, role: 'user' })

    await page.goto(new URL('#/modules/analysis', base).href)
    const analysis = page.locator('.section-properties-panel')
    await analysis.waitFor()
    await assertProfileOptions(analysis)
    assert.equal(await page.locator('.geometry-workbench').count(), 0, 'The legacy calculator must not remain in the live page.')

    for (const profileId of profilesToCalculate) {
      const result = await setGeometry(analysis, profileId)
      const reportDetails = result.locator('.section-calculated-formula-report')
      if (!await reportDetails.evaluate(element => element.open)) await reportDetails.locator(':scope > summary').click()
      await result.locator('.section-calculated-report-meta dd').first().waitFor()
      assert.equal((await result.locator('.section-calculated-report-meta dd').first().innerText()).trim(), profileId)
    }

    const rectangleResult = await setGeometry(analysis, 'rectangle')
    await rectangleResult.getByLabel('Display unit', { exact: true }).selectOption('cm')
    const areaRow = rectangleResult.getByText('A · Area', { exact: true }).locator('..')
    assert.match(await areaRow.locator('dd').innerText(), /800\s+cm²/)
    await rectangleResult.locator('details.section-calculated-formula-report > summary').click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      rectangleResult.getByRole('button', { name: 'Download formula report JSON', exact: true }).click(),
    ])
    const reportPath = '/tmp/geekcalculus-formula-report.json'
    await download.saveAs(reportPath)
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    fs.unlinkSync(reportPath)
    assert.equal(report.profile_id, 'rectangle')
    assert.equal(report.units, 'mm', 'Formula report values must remain in canonical units when the display unit changes.')
    assert.ok(report.properties.some(property => property.key === 'geometric.area' && property.expression))

    for (const moduleCode of ['steel', 'concrete']) {
      await page.goto(new URL(`#/modules/${moduleCode}`, base).href)
      const tabLabel = 'Section properties'
      await page.getByRole('tab', { name: tabLabel, exact: false }).click()
      const panel = page.locator('.section-properties-panel')
      await panel.waitFor({ state: 'visible' })
      await assertProfileOptions(panel)
      const result = await setGeometry(panel, 'chs')
      await result.getByText('A · Area', { exact: true }).waitFor()
    }

    await page.setViewportSize({ width: 390, height: 844 })
    const overflowDetails = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')].filter(element => element.scrollWidth > element.clientWidth + 2).slice(0, 24).map(element => `${element.tagName}.${String(element.className?.baseVal ?? element.className ?? '').slice(0, 60)}:${element.clientWidth}/${element.scrollWidth}:${element.textContent.trim().slice(0, 36)}`),
    }))
    assert.ok(overflowDetails.width <= await page.evaluate(() => innerWidth), `Shared Section Properties layout overflows on a narrow viewport: ${JSON.stringify(overflowDetails)}`)
    assert.ok(calculationResponses.every(status => status === 200), `Calculation endpoint returned ${calculationResponses.join(', ')}`)
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log(`${demo ? 'Demo' : 'Laravel'} Section Properties smoke passed: ${profilesToCalculate.length}/${expectedProfileIds.length} profiles calculated, Steel and RC expose the same registry profiles, formula report JSON stays in mm, display units convert values, and mobile layout fits.`)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
