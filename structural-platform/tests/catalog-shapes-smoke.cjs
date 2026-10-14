const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')
const demo = process.env.TEST_DEMO === '1'
const base = process.env.AUTH_BASE_URL || 'http://127.0.0.1:5173'

// Independent area benchmarks; exercise the real editor and save path for every catalog shape.
const cases = [
  ['rectangle', { depth: 500, width: 300 }, 150000],
  ['circle', { diameter: 200 }, Math.PI * 10000],
  ['i', { depth: 400, web_thickness: 8, top_flange_width: 200, bottom_flange_width: 250, top_flange_thickness: 12, bottom_flange_thickness: 16 }, 9376],
  ['channel', { depth: 200, width: 100, web_thickness: 8, flange_thickness: 10 }, 3440],
  ['tee', { depth: 200, width: 100, web_thickness: 8, flange_thickness: 10 }, 2520],
  ['angle', { depth: 200, width: 100, thickness: 10 }, 2900],
  ['rectangular_hollow', { depth: 200, width: 100, thickness: 5 }, 2900],
  ['circular_hollow', { diameter: 100, thickness: 5 }, Math.PI * (10000 - 8100) / 4],
]

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
    for (const [shape, dimensions, expectedArea] of cases) {
      const code = `browser_shapes_${nonce}_${shape}`
      const type = types.find(item => item.shape === shape)
      const material = materials.find(item => item.category === (type.category === 'rc' ? 'concrete' : 'steel'))
      await page.getByRole('button', { name: /Add section$/ }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/^Code/).fill(code)
      await dialog.getByLabel(/^Vietnamese name/).fill('Catalog shape benchmark')
      await dialog.getByLabel(/^English name/).fill('Catalog shape benchmark')
      await dialog.getByLabel(/^Section type/).selectOption(String(type.id))
      await dialog.getByLabel(/^Material/).selectOption(String(material.id))
      if (shape === 'i') await dialog.getByRole('button', { name: 'Asymmetric', exact: true }).click()
      assert.equal(await dialog.locator('input[name="property-area"]').count(), 0)
      for (const [key, value] of Object.entries(dimensions)) await dialog.locator(`input[name="property-${key}"]`).fill(String(value))
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role="dialog"]')
        return dialog?.querySelector('.section-calculated-properties') && !dialog.querySelector('button[type="submit"]').disabled
      })
      await dialog.getByRole('button', { name: 'Create record', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
      const saved = (await rows('sections')).find(item => item.code === code)
      assert.ok(saved, `${shape}: section was saved`)
      created.push(saved.id)
      assert.ok(Math.abs(saved.section_properties.properties.geometric.area - expectedArea) < 1e-8, `${shape}: area benchmark`)
      assert.equal(saved.section_properties.solver.version, '1.2.0')
      assert.equal(saved.section_properties.units.length, 'mm')
      assert.ok(Number.isFinite(Date.parse(saved.section_properties_calculated_at)))
      assert.ok(!Object.hasOwn(saved.properties, 'area'))
      if (shape === 'i') {
        for (const key of ['warping_constant_cw', 'shear_center', 'effective_shear_area']) assert.equal(saved.section_properties.advanced[key].status, 'computed')
        assert.ok(!Object.hasOwn(saved.properties, 'width'))
      }
      if (shape === 'angle') assert.notEqual(saved.section_properties.properties.elastic.ixy, 0)
    }
    assert.deepEqual(errors, [])
    console.log(`${demo ? 'Demo' : 'Native'} catalog editor passed: create/save all 8 shapes, asymmetric I advanced properties, angle Ixy, canonical units and stored snapshots.`)
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
