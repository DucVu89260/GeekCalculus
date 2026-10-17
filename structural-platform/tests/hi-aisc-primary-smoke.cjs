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
    assert.equal(await page.evaluate(() => verifiedResult.overall_status), 'FAIL', 'the sample now exposes its computed failing gross-member checks')

    // Gross-member fixture: d300/b150/tf12/tw8; Ag5808, Zx670752, Zy139416.
    // Fy345: nominal Mnx231.40944, Mny48.09852, tensile yield2003.76.
    const payload = await page.evaluate(() => {
      const input = structuredClone(latest.input)
      Object.assign(input.section, { h_mm: 300, bf_mm: 150, tf_mm: 12, tw_mm: 8, fabrication: 'BUILT_UP', web_attachment: 'WELDED' })
      Object.assign(input.material, { fy_mpa: 345, fu_mpa: 450, e_mpa: 200000 })
      Object.assign(input.member, { kx: 1, ky: 1, kz: 1, lx_mm: 3000, ly_mm: 2000, lz_mm: 2000, lb_mm: 500, g_mpa: 77200 })
      Object.assign(input.forces, { axial_kN: 200, moment_x_kNm: 100, moment_y_kNm: 10, shear_x_kN: 0, shear_y_kN: 0, torsion_kNm: 0 })
      input.stiffeners.spacing_mm = 0
      input.tension_field_action.enabled = false
      input.assessment = { scope: 'GROSS_MEMBER', force_source: 'MANUAL' }
      return { meta: { mode: 'AISC36010_REFERENCE', design_method: 'LRFD' }, input }
    })
    await page.locator('#file').setInputFiles({ name: 'independent-source-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) })
    await page.waitForFunction(() => verifiedResult?.classification && latest.input.section.h_mm === 300)
    assert.equal(await page.locator('.tab[data-tab="analysis"]').count(), 0)
    assert.equal(await page.locator('.tab[data-tab="tension"]').count(), 0)
    const lrfd = await page.evaluate(() => structuredClone(verifiedResult))
    assert.equal(lrfd.overall_status, 'PASS')
    assert.equal(lrfd.member_compliance.scope, 'GROSS_SECTION_MEMBER_STRENGTH')
    close(lrfd.limit_states.tension.available, 1803.384)
    close(lrfd.limit_states.major_flexure.nominal, 231.40944)
    close(lrfd.limit_states.interaction.nominal, .7666080777385834)
    close(lrfd.limit_states.minor_flexure.available, 43.288668)
    assert.match(await page.locator('[data-summary="interaction"]').innerText(), /76\.66%/)
    assert.equal(lrfd.analysis_basis.analysis.trace.model_verified, false)
    assert.ok(!lrfd.limit_states.net_section && !lrfd.limit_states.flange_hole_interaction)
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
    assert.equal(await page.evaluate(() => verifiedResult.analysis_basis.load_basis.status), 'CONFIRMED')
    await page.locator('[data-tab="forces"]').click()
    await page.locator('[data-key="axial_kN"]').fill('130')
    await page.locator('[data-key="moment_x_kNm"]').fill('70')
    await page.locator('[data-key="moment_y_kNm"]').fill('5')
    await page.locator('#run').click()
    await page.waitForFunction(() => verifiedResult?.mode === 'ASD')
    const asd = await page.evaluate(() => structuredClone(verifiedResult))
    assert.equal(asd.overall_status, 'PASS')
    close(asd.limit_states.tension.available, 2003.76 / 1.67)
    close(asd.limit_states.interaction.nominal, 130 / (2003.76 / 1.67) / 2 + 70 / (231.40944 / 1.67) + 5 / (48.09852 / 1.67))

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
    console.log('Gross-member I/H browser passed: major/minor/tension/H1 hand fixtures, one-column summary, external-analysis assumption, manual ASD/LRFD, import/export, no connection tabs, stale rejection, legacy isolation and mobile.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
