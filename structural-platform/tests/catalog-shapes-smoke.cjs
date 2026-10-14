const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')
const registry = require('../section-properties/section-registry.json')

const demo = process.env.TEST_DEMO === '1'
const base = process.env.AUTH_BASE_URL || 'http://127.0.0.1:5173'
const cases = [
  { shape: 'rectangle', profile: 'rectangle', dimensions: { width: 300, height: 500 }, area: 150000 },
  { shape: 'circle', profile: 'circle', dimensions: { diameter: 200 }, area: Math.PI * 10000 },
  { shape: 'circular_hollow', profile: 'chs', dimensions: { diameter: 100, thickness: 5 }, area: Math.PI * (10000 - 8100) / 4 },
  { shape: 'rectangular_hollow', profile: 'shs_rhs', dimensions: { width: 100, height: 200, thickness: 5 }, area: 2900 },
  { shape: 'i', profile: 'symmetric_i', dimensions: { depth: 400, width: 200, web_thickness: 8, flange_thickness: 12 }, area: 7808 },
  { shape: 'i', profile: 'asymmetric_i', dimensions: { depth: 400, top_flange_width: 200, bottom_flange_width: 250, web_thickness: 8, top_flange_thickness: 12, bottom_flange_thickness: 16 }, area: 9376 },
  { shape: 'channel', profile: 'channel', dimensions: { depth: 200, width: 100, web_thickness: 8, flange_thickness: 10 }, area: 3440 },
  { shape: 'angle', profile: 'angle', dimensions: { depth: 200, width: 100, thickness: 10 }, area: 2900 },
  { shape: 'tee', profile: 'tee', dimensions: { depth: 200, width: 100, web_thickness: 8, flange_thickness: 10 }, area: 2520 },
  { shape: 'double_angle', profile: 'double_angle', dimensions: { depth: 200, width: 100, thickness: 10, distance: 20 }, area: 5800 },
]
const advancedKeys = ['torsion_constant_j', 'warping_constant_cw', 'shear_center', 'effective_shear_area']
const read = (value, path) => path.split('.').reduce((current, key) => current?.[key], value)

function assertCanonicalSnapshot(snapshot, profile, caseDimensions) {
  const profileDefinition = registry.profiles.find(item => item.id === profile)
  assert.ok(profileDefinition, `Registry must define ${profile}`)
  assert.equal(snapshot.formula_report.profile_id, profile)
  assert.equal(snapshot.formula_report.units, 'mm')
  assert.equal(snapshot.formula_report.properties.length, registry.properties.length)
  assert.deepEqual(snapshot.formula_report.properties.map(item => item.key), registry.properties.map(item => item.key), 'Formula report includes the manifest property set in canonical order')
  assert.ok(snapshot.formula_report.manifest_hash)
  assert.equal(snapshot.formula_report.geometry_hash, snapshot.geometry_hash)
  assert.deepEqual(snapshot.formula_report.solver, snapshot.solver)
  assert.equal(snapshot.normalized_input.units, 'mm')
  assert.equal(snapshot.normalized_input.geometry.geometry_model_version, '1.0.0')
  const expectedEngineDimensions = Object.fromEntries(Object.entries(profileDefinition.engine_dimensions).map(([key, source]) => [key, caseDimensions[source]]))
  assert.deepEqual(snapshot.normalized_input.geometry.dimensions, expectedEngineDimensions, `${profile} canonical input dimensions`)
  for (const dimension of snapshot.formula_report.dimensions) {
    assert.equal(dimension.unit, 'mm')
    assert.ok(Number.isFinite(dimension.value), `${profile}.${dimension.key} should be finite`)
  }
  for (const descriptor of registry.properties) {
    const formulaProperty = snapshot.formula_report.properties.find(item => item.key === descriptor.key)
    assert.ok(formulaProperty, `${profile}: formula report has ${descriptor.key}`)
    const advanced = descriptor.key.startsWith('advanced.')
    const resultProperty = advanced ? read(snapshot, descriptor.key) : read(snapshot.properties, descriptor.key)
    const expectedStatus = advanced
      ? resultProperty?.status ?? 'not_computed'
      : resultProperty === undefined || (resultProperty === null && descriptor.key !== 'principal.major_axis_angle_degrees') ? 'not_computed' : 'computed'
    const expectedValue = advanced ? resultProperty?.value ?? null : resultProperty ?? null
    assert.equal(formulaProperty.status, expectedStatus, `${profile}: ${descriptor.key} status matches the result`)
    assert.deepEqual(formulaProperty.value, expectedValue, `${profile}: ${descriptor.key} value matches the result`)
  }
  for (const key of advancedKeys) {
    assert.equal(snapshot.advanced[key].status, 'computed', `${profile}: ${key} must be computed`)
    assert.ok(snapshot.advanced[key].method, `${profile}: ${key} identifies its method`)
  }
  assert.ok(snapshot.advanced.torsion_constant_j.value > 0, `${profile}: J is positive`)
  assert.ok(Number.isFinite(snapshot.advanced.warping_constant_cw.value) && snapshot.advanced.warping_constant_cw.value >= 0, `${profile}: Cw is finite and nonnegative`)
  for (const key of ['x', 'y', 'offset_x', 'offset_y']) assert.ok(Number.isFinite(snapshot.advanced.shear_center.value[key]), `${profile}: shear center ${key} is signed and finite`)
  for (const key of ['x', 'y']) assert.ok(snapshot.advanced.effective_shear_area.value[key] > 0, `${profile}: effective shear area ${key} is positive`)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = [], created = [], nonce = Date.now()
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))

  async function rows(resource) {
    return page.evaluate(async ({ resource, demo }) => {
      if (demo) return JSON.parse(localStorage.getItem('geekcalculus-demo-library-v1'))[resource]
      const response = await fetch(`/api/${resource.replace('_', '-')}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('Cannot read saved catalog')
      return (await response.json()).data
    }, { resource, demo })
  }

  try {
    await page.goto(base)
    await signIn(page, { demo, role: 'admin' })
    await page.getByRole('button', { name: /Admin interface/ }).click()
    await page.getByRole('tab', { name: 'Sections', exact: true }).click()
    const types = await rows('section_types'), materials = await rows('materials')
    for (const [index, item] of cases.entries()) {
      const code = `browser_profiles_${nonce}_${item.profile}`
      const type = types.find(row => row.shape === item.shape)
      assert.ok(type, `Seeded section types include ${item.shape}`)
      const material = materials.find(row => row.category === (type.category === 'rc' ? 'concrete' : 'steel'))
      assert.ok(material, `A compatible material exists for ${item.shape}`)
      await page.getByRole('button', { name: /Add section$/ }).click()
      const dialog = page.getByRole('dialog')
      const save = dialog.getByRole('button', { name: 'Create record', exact: true })
      await dialog.getByLabel(/^Code/).fill(code)
      await dialog.getByLabel(/^Vietnamese name/).fill(`Profile ${item.profile}`)
      await dialog.getByLabel(/^English name/).fill(`Profile ${item.profile}`)
      await dialog.getByLabel(/^Section type/).selectOption(String(type.id))
      await dialog.getByLabel(/^Material/).selectOption(String(material.id))

      const profileSelect = dialog.locator('.section-properties-panel-inputs select')
      if (await profileSelect.count()) await profileSelect.selectOption(item.profile)
      assert.equal(await dialog.locator('input[name="property-area"]').count(), 0, 'Derived area is never manually editable')
      for (const [key, value] of Object.entries(item.dimensions)) await dialog.locator(`input[name="dimension-${key}"]`).fill(String(value))

      if (item.profile === 'double_angle') {
        await dialog.locator('input[name="dimension-distance"]').fill('-1')
        await dialog.locator('.section-calculated-properties').waitFor({ state: 'detached' })
        assert.equal(await save.isDisabled(), true, 'Negative double-angle distance must block calculation and saving')
        await dialog.locator('input[name="dimension-distance"]').fill('0')
        await dialog.locator('.section-calculated-properties').waitFor({ state: 'visible' })
        await page.waitForFunction(() => {
          const button = document.querySelector('[role="dialog"] button[type="submit"]')
          return button && !button.disabled
        })
        const zeroGapReport = dialog.locator('.section-calculated-formula-report')
        await zeroGapReport.locator(':scope > summary').click()
        const zeroDistance = zeroGapReport.locator('section').first().locator('dl > div').filter({ hasText: 'distance' })
        assert.match(await zeroDistance.innerText(), /0\s*mm/, 'A zero double-angle clear gap is valid canonical input')
        await dialog.locator('input[name="dimension-distance"]').fill(String(item.dimensions.distance))
      }

      await dialog.locator('.section-calculated-properties').waitFor({ state: 'visible' })
      await page.waitForFunction(() => {
        const button = document.querySelector('[role="dialog"] button[type="submit"]')
        return button && !button.disabled
      })
      const preview = await page.evaluate(() => document.querySelector('[role="dialog"] .section-calculated-report-meta dd')?.textContent?.trim())
      assert.equal(preview, item.profile, 'Preview uses the chosen registry profile')
      await save.click()
      await dialog.waitFor({ state: 'detached' })

      const saved = (await rows('sections')).find(row => row.code === code)
      assert.ok(saved, `${item.profile}: section was saved`)
      created.push(saved.id)
      assert.ok(Math.abs(saved.section_properties.properties.geometric.area - item.area) < Math.max(1e-8, item.area * 1e-12), `${item.profile}: independent area benchmark`)
      assert.equal(saved.section_properties.solver.version, '1.3.0')
      assert.equal(saved.section_properties.geometry_hash.length, 64)
      assert.ok(Number.isFinite(Date.parse(saved.section_properties_calculated_at)))
      assertCanonicalSnapshot(saved.section_properties, item.profile, item.dimensions)
      assert.ok(!Object.hasOwn(saved.properties, 'area'))
      assert.deepEqual(saved.properties, Object.fromEntries(Object.entries(item.dimensions).map(([key, value]) => [registry.dimensions[key]?.catalog_key ?? key, value])))
      if (item.profile === 'double_angle') {
        assert.equal(saved.properties.distance, item.dimensions.distance, 'A positive clear gap is preserved as a stored input')
        assert.ok(item.dimensions.distance >= 0)
      }
    }
    assert.deepEqual(errors, [])
    console.log(`${demo ? 'Demo' : 'Native'} catalog editor passed: all ten registry profiles saved with canonical reports and advanced values; asymmetric/symmetric I modes and double-angle zero/positive/negative spacing are covered.`)
  } finally {
    if (!demo) for (const id of created) {
      const status = await page.evaluate(async id => {
        const csrf = await (await fetch('/api/auth/csrf', { headers: { Accept: 'application/json' } })).json()
        return (await fetch(`/api/sections/${id}`, { method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf.csrf_token } })).status
      }, id)
      assert.equal(status, 200)
    }
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
