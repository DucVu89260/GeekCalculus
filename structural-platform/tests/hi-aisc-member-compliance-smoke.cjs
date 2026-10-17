const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/geekcalculus-browser-tools/node_modules/playwright')

const base = process.env.HI_BASE_URL || 'http://127.0.0.1:5173/hi-doubly-symmetric-aisc360-10.html'

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 950 } })
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))
    await page.goto(base)
    await page.waitForFunction(() => typeof verifiedResult !== 'undefined' && verifiedResult?.limit_states)

    assert.equal(await page.locator('#calculation-mode').inputValue(), 'AISC36010')
    assert.equal(await page.locator('#legacy-warning').isVisible(), false)
    assert.equal(await page.locator('#legacy-moment-stations').isVisible(), false)
    assert.equal(await page.locator('#sap-import').isDisabled(), true)
    for (const id of ['aisc-kx', 'aisc-ky', 'aisc-kz', 'aisc-e', 'aisc-g']) {
      assert.equal(await page.locator(`#${id}`).isEditable(), false, `${id} is fixed for the supported Direct Analysis path`)
    }
    assert.equal(await page.locator('#aisc-e').inputValue(), '200000')
    assert.equal(await page.locator('#aisc-g').inputValue(), '77200')
    const initial = await page.evaluate(() => structuredClone(latest.input))
    assert.equal(initial.forces.torsion_kNm, 0)
    assert.ok(Object.values(initial.analysis).filter(value => typeof value === 'boolean').every(value => value === false))
    assert.deepEqual(initial.compliance, { scope_confirmed: false, envelope_confirmed: false, other_limit_states_confirmed: false })
    assert.equal(initial.holes.critical_path_confirmed, false)
    assert.equal(initial.stiffeners.attachment_details_verified, false)
    assert.equal(initial.tension_field_action.enabled, false)
    assert.match(await page.locator('#member-compliance-status').innerText(), /REVIEW_REQUIRED/)
    assert.doesNotMatch(await page.locator('#warnings').innerText(), /LEGACY_EDITION|LEGACY_CB|LEGACY_WEAK_AXIS_FE|STIFFENER_PARITY_ONLY/)

    // The geometry UI exposes verified rolled clear height only for rolled profiles.
    assert.equal(await page.locator('#web-clear-height-fields').isVisible(), false)
    await page.locator('#aisc-fabrication').selectOption('ROLLED')
    assert.equal(await page.locator('#web-clear-height-fields').isVisible(), true)
    assert.equal(await page.locator('#web-attachment-field').isVisible(), false)
    await page.locator('#aisc-fabrication').selectOption('BUILT_UP')

    // Advanced G inputs stay opt-in and expose the extra angle and TFA gates.
    await page.locator('[data-tab="shear"]').click()
    await page.locator('#stiffener-layout').selectOption('SINGLE_ANGLE')
    assert.equal(await page.locator('#angle-inertia-field').isVisible(), true)
    assert.equal(await page.locator('#angle-axis-check').isVisible(), true)
    await page.locator('#stiffener-layout').selectOption('PAIRED')
    await page.locator('#tfa-enabled').check()
    assert.equal(await page.locator('#tfa-inputs').isVisible(), true)
    assert.equal(await page.locator('[data-same-boundaries]').isChecked(), false)
    await page.locator('#tfa-enabled').uncheck()

    // Hole-path declaration unlocks the net-section branch without asserting a numerical result.
    await page.locator('[data-tab="tension"]').click()
    await page.locator('[data-key="critical_path_confirmed"]').check()
    await page.locator('#run').click()
    await page.waitForFunction(() => verifiedResult?.limit_states.net_section?.status === 'CALCULATED')
    assert.ok(await page.locator('#aisc-review-table a').count() > 0, 'limit states link back to the source library')
    const sourceHref = await page.locator('#aisc-review-table a').first().getAttribute('href')
    assert.match(sourceHref, /source_sha256=[a-f0-9]{64}/i)
    assert.match(sourceHref, /pdf_page=[1-9]\d*/)
    assert.doesNotMatch(sourceHref, /\.pdf(?:$|[?#])/i, 'the local app links to the source-library view, not a published PDF')
    assert.match(await page.locator('#member-compliance-status').innerText(), /MemberCompliance REVIEW_REQUIRED|MemberCompliance FAIL|MemberCompliance PASS/)

    const downloadEvent = page.waitForEvent('download')
    await page.locator('#export').click()
    const download = await downloadEvent
    const exported = JSON.parse(require('node:fs').readFileSync(await download.path(), 'utf8'))
    assert.equal(exported.meta.mode, 'AISC36010_REFERENCE')
    assert.ok(exported.input.analysis && exported.input.compliance && exported.input.holes)
    assert.ok(exported.input.tension_connection && exported.input.tension_field_action && exported.input.stiffeners)
    assert.equal(Object.hasOwn(exported, 'legacy_comparison'), false, 'primary export contains no legacy capacities')
    assert.ok(exported.result.member_compliance)

    // Even an export carrying every confirmation is imported as unconfirmed.
    const untrusted = await page.evaluate(() => {
      const input = structuredClone(latest.input)
      for (const key of ['second_order_global_confirmed', 'member_p_delta_confirmed', 'imperfections_confirmed', 'reduced_stiffness_confirmed', 'all_loads_confirmed', 'asd_scaling_confirmed', 'bracing_confirmed']) input.analysis[key] = true
      input.compliance = { scope_confirmed: true, envelope_confirmed: true, other_limit_states_confirmed: true }
      input.holes.critical_path_confirmed = true
      input.section.web_clear_height_verified = true
      input.stiffeners.inertia_axis_verified = true
      input.stiffeners.attachment_details_verified = true
      input.tension_field_action.enabled = true
      input.tension_field_action.panel_position = 'END'
      input.tension_field_action.panel_position_confirmed = true
      input.tension_field_action.four_sides_supported = true
      input.tension_field_action.four_sides_supported_confirmed = true
      input.tension_field_action.same_boundaries_confirmed = true
      input.tension_field_action.adjacent_panels.forEach(panel => {
        panel.is_end_panel = true
        panel.four_sides_supported = true
        panel.panel_position_confirmed = true
        panel.four_sides_supported_confirmed = true
        panel.other_boundary_stiffeners_verified = true
      })
      return { meta: { mode: 'AISC36010_REFERENCE', design_method: 'LRFD' }, input }
    })
    await page.locator('#file').setInputFiles({
      name: 'untrusted-acknowledgments.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(untrusted)),
    })
    await page.waitForFunction(() => verifiedResult?.limit_states)
    const imported = await page.evaluate(() => structuredClone(latest.input))
    assert.ok(Object.values(imported.analysis).filter(value => typeof value === 'boolean').every(value => value === false))
    assert.deepEqual(imported.compliance, { scope_confirmed: false, envelope_confirmed: false, other_limit_states_confirmed: false })
    assert.equal(imported.holes.critical_path_confirmed, false)
    assert.equal(imported.section.web_clear_height_verified, false)
    assert.equal(imported.stiffeners.inertia_axis_verified, false)
    assert.equal(imported.stiffeners.attachment_details_verified, false)
    assert.equal(imported.tension_field_action.panel_position, '')
    assert.equal(imported.tension_field_action.four_sides_supported, null)
    assert.equal(imported.tension_field_action.same_boundaries_confirmed, false)
    assert.equal(imported.tension_field_action.adjacent_panels[0].other_boundary_stiffeners_verified, false)
    assert.equal(await page.locator('#ack-reset-note').isVisible(), true)

    // The ASD/LRFD selector never rescales the entered demand and mismatched combinations block confirmation.
    await page.locator('#analysis-forces-method').selectOption('LRFD')
    await page.locator('#run').click()
    await page.waitForFunction(() => verifiedResult?.mode === 'LRFD')
    const forcesBefore = await page.evaluate(() => structuredClone(latest.input.forces))
    await page.locator('input[name="design-method"][value="ASD"]').check()
    await page.waitForFunction(() => verifiedResult?.mode === 'ASD')
    assert.deepEqual(await page.evaluate(() => latest.input.forces), forcesBefore)
    assert.equal((await page.evaluate(() => verifiedResult.limit_states.load_basis.status)), 'INPUT_REQUIRED')
    assert.match(await page.locator('#load-basis-message').innerText(), /Mismatch/)
    assert.equal((await page.evaluate(() => latest.input.analysis.asd_scaling_confirmed)), false)
    await page.locator('#analysis-forces-method').selectOption('ASD')
    await page.locator('#run').click()
    await page.waitForFunction(() => verifiedResult?.mode === 'ASD')
    assert.deepEqual(await page.evaluate(() => latest.input.forces), forcesBefore)

    // A confirmation can be checked, but changing member geometry clears the whole acknowledgment set.
    await page.locator('[data-tab="analysis"]').click()
    await page.locator('[data-key="second_order_global_confirmed"]').check()
    assert.equal(await page.locator('[data-key="second_order_global_confirmed"]').isChecked(), true)
    await page.locator('[data-tab="geometry"]').click()
    await page.locator('[data-key="h_mm"]').fill('960')
    assert.equal(await page.locator('[data-key="second_order_global_confirmed"]').isChecked(), false)
    assert.equal(await page.locator('[data-key="scope_confirmed"]').isChecked(), false)
    assert.equal(await page.locator('#h1').innerText(), '—', 'editing inputs clears stale displayed strengths')

    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
    console.log('AISC 360-10 member-compliance UI smoke passed: explicit scope inputs, Chapter C gates, hole/tension/shear details, no ASD/LRFD autoscaling, safe JSON acknowledgments, stale-result clearing and mobile layout.')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
