const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.HI_BASE_URL || 'http://127.0.0.1:5173/hi-doubly-symmetric-aisc360-10.html'
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2e-5, `${actual} ≈ ${expected}`)

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))
    await page.goto(base)
    await page.waitForFunction(() => typeof verifiedResult !== 'undefined' && verifiedResult?.classification)
    assert.equal(await page.locator('#calculation-mode').inputValue(), 'AISC36010')
    assert.match(await page.locator('#calc-info').innerText(), /AISC 360-10/)
    assert.doesNotMatch(await page.locator('#warnings').innerText(), /LEGACY_EDITION|LEGACY_CB|LEGACY_WEAK_AXIS_FE|STIFFENER_PARITY_ONLY/)
    assert.equal(await page.locator('#calculation-notebook').isVisible(), false)
    const contents = await page.locator('.outline-tree a').allTextContents()
    assert.deepEqual(contents.map(text => text.replace(/\s+/g, ' ').trim()), [
      '01 Input Parameters', '02 Calculation Results', '03 Design Calculation',
      '04 AISC 360-10 Verified Branches', '05 Shared Section Properties',
    ])
    const sections = ['input-card', 'calculation-results', 'design-calculation', 'aisc-review', 'shared-section', 'engineering-warnings']
    for (let index = 1; index < sections.length; index++) {
      const previous = await page.locator(`#${sections[index - 1]}`).boundingBox()
      const current = await page.locator(`#${sections[index]}`).boundingBox()
      assert.ok(current.y >= previous.y + previous.height - 1, `${sections[index]} must follow the previous section in one column`)
      close(current.x, previous.x)
      close(current.width, previous.width)
    }
    assert.ok(await page.locator('#design-calculation #aisc-review-formulas tbody tr').count() > 0)
    assert.equal(await page.locator('#calculation-results #member-compliance').count(), 1)
    assert.equal(await page.locator('#calculation-results #warnings').count(), 0)
    assert.equal(await page.locator('.page > section:last-of-type').getAttribute('id'), 'engineering-warnings')
    assert.equal(await page.locator('#sidebar-step-slot').isVisible(), false)
    assert.ok(await page.locator('.field input').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= 17)
    assert.ok(await page.locator('#checkrows').evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= 14)
    await page.locator('.outline-tree [href="#design-calculation"]').click()
    await page.waitForFunction(() => document.querySelector('[href="#design-calculation"]').getAttribute('aria-current') === 'location')
    assert.equal(await page.locator('#sap-import').isDisabled(), true)
    assert.equal(await page.evaluate(() => verifiedResult.overall_status), 'REVIEW_REQUIRED')

    // Independent hand fixture: d300/b150/tf12/tw8, Fu450, 2 nominal Ø22
    // holes in each flange and web. AISC B4.3b adds 2 mm per hole.
    // Ag5808, An4272, Sx591394.56, Zx670752; source PDF74/82/120/135.
    const payload = await page.evaluate(() => {
      const input = structuredClone(latest.input)
      Object.assign(input.section, { h_mm: 300, bf_mm: 150, tf_mm: 12, tw_mm: 8, fabrication: 'BUILT_UP', web_attachment: 'WELDED' })
      Object.assign(input.material, { fy_mpa: 345, fu_mpa: 450, e_mpa: 200000 })
      Object.assign(input.member, { kx: 1, ky: 1, kz: 1, lx_mm: 3000, ly_mm: 2000, lz_mm: 2000, lb_mm: 500, g_mpa: 77200 })
      Object.assign(input.forces, { axial_kN: 200, moment_x_kNm: 100, moment_y_kNm: 0, shear_x_kN: 0, shear_y_kN: 0, torsion_kNm: 0 })
      Object.assign(input.holes, { pattern: 'STRAIGHT', top_flange_count: 2, bottom_flange_count: 2, web_count: 2, flange_hole_diameter_mm: 22, web_hole_diameter_mm: 22 })
      input.tension_connection.load_transfer = 'ALL_ELEMENTS'
      input.stiffeners.spacing_mm = 0
      input.tension_field_action.enabled = false
      Object.assign(input.analysis, { method: 'DIRECT', forces_method: 'LRFD', evidence: 'Independent simultaneous manual combination, source-checked hand fixture' })
      return { meta: { mode: 'AISC36010_REFERENCE', design_method: 'LRFD' }, input }
    })
    await page.locator('#file').setInputFiles({ name: 'independent-source-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) })
    await page.waitForFunction(() => verifiedResult?.classification && latest.input.section.h_mm === 300)
    assert.equal(await page.evaluate(() => verifiedResult.overall_status), 'REVIEW_REQUIRED', 'import cannot supply engineering approvals')
    async function confirmCurrentInputs() {
      await page.locator('[data-tab="analysis"]').click()
      for (const key of ['second_order_global_confirmed', 'member_p_delta_confirmed', 'imperfections_confirmed', 'reduced_stiffness_confirmed', 'all_loads_confirmed', 'bracing_confirmed']) {
        await page.locator(`[data-key="${key}"]`).check()
      }
      if (await page.locator('input[name="design-method"][value="ASD"]').isChecked()) await page.locator('[data-key="asd_scaling_confirmed"]').check()
      await page.locator('[data-tab="tension"]').click()
      await page.locator('[data-key="critical_path_confirmed"]').check()
      for (const key of ['scope_confirmed', 'envelope_confirmed', 'other_limit_states_confirmed']) await page.locator(`[data-key="${key}"]`).check()
      await page.locator('#run').click()
      await page.waitForFunction(() => verifiedResult?.member_compliance)
    }
    await confirmCurrentInputs()
    const lrfd = await page.evaluate(() => structuredClone(verifiedResult))
    assert.equal(lrfd.overall_status, 'PASS')
    assert.equal(lrfd.member_compliance.scope, 'MEMBER_STRENGTH_WITHIN_DECLARED_SCOPE')
    close(lrfd.limit_states.tension.available, 1441.8)
    close(lrfd.limit_states.major_flexure.nominal, 180.96673536)
    close(lrfd.limit_states.interaction.nominal, .683344011145367)
    close(lrfd.limit_states.flange_hole_interaction.nominal, .752701763937641)
    assert.notEqual(lrfd.limit_states.compression.trace.fex_mpa, lrfd.limit_states.compression.trace.fey_mpa)
    assert.equal(lrfd.limit_states.major_flexure.trace.cb, 1)
    const outputEvent = page.waitForEvent('download')
    await page.locator('#export').click()
    const output = JSON.parse(fs.readFileSync(await (await outputEvent).path(), 'utf8'))
    assert.equal(output.meta.mode, 'AISC36010_REFERENCE')
    assert.equal(output.result.overall_status, 'PASS')
    assert.equal(Object.hasOwn(output, 'legacy_comparison'), false)
    assert.equal(output.result.source.sha256, 'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99')

    const before = await page.evaluate(() => structuredClone(latest.input.forces))
    await page.locator('input[name="design-method"][value="ASD"]').check()
    await page.waitForFunction(() => verifiedResult?.mode === 'ASD')
    assert.deepEqual(await page.evaluate(() => latest.input.forces), before, 'method selection never scales demand')
    assert.equal(await page.evaluate(() => verifiedResult.overall_status), 'REVIEW_REQUIRED')
    await page.locator('[data-tab="forces"]').click()
    await page.locator('[data-key="axial_kN"]').fill('130')
    await page.locator('[data-key="moment_x_kNm"]').fill('70')
    await page.locator('[data-tab="analysis"]').click()
    await page.locator('#analysis-forces-method').selectOption('ASD')
    await confirmCurrentInputs()
    const asd = await page.evaluate(() => structuredClone(verifiedResult))
    assert.equal(asd.overall_status, 'PASS')
    close(asd.limit_states.tension.available, 961.2)
    close(asd.limit_states.interaction.nominal, .713599287282567)
    close(asd.limit_states.flange_hole_interaction.nominal, .781223131429049)
    assert.equal(asd.limit_states.major_flexure.nominal, lrfd.limit_states.major_flexure.nominal)

    await page.locator('[data-tab="geometry"]').click()
    await page.locator('[data-key="h_mm"]').fill('')
    await page.locator('#run').click()
    assert.equal(await page.locator('#h1').innerText(), '—', 'invalid geometry cannot restore a stale result')
    assert.equal(await page.evaluate(() => verifiedResult), null)
    await page.locator('#preset').click()
    await page.locator('#calculation-mode').selectOption('LEGACY')
    await page.waitForFunction(() => document.getElementById('warnings').textContent.includes('LEGACY_WEAK_AXIS_FE'))
    assert.equal(await page.locator('#calculation-notebook').isVisible(), true)
    assert.equal(await page.locator('#h1').innerText(), '82.41%')
    await page.locator('#calculation-mode').selectOption('AISC36010')
    await page.waitForFunction(() => verifiedResult?.mode === 'LRFD')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
    console.log('Source-backed symmetric I/H browser fixtures passed: D2/F13/H4 LRFD and ASD, scoped compliance PASS, unconfirmed import barriers, separate Euler axes, Cb=1, explicit manual forces, export, stale rejection, legacy isolation and mobile layout.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
