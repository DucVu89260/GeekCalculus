const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')

const demo = process.env.TEST_DEMO === '1'
const base = process.env.MECHANICS_BASE_URL || 'http://127.0.0.1:5191/'
const dbKey = 'geekcalculus-demo-library-v1'
const codes = ['browser_mechanics_viewer', 'browser_mechanics_legacy']

const storedResult = (includeMechanics) => ({
  geometry_hash: 'a'.repeat(64),
  solver: { method: 'test-fixture', version: '1.0.0' },
  properties: {
    geometric: { area: 10000, perimeter: 400, centroid_x: 50, centroid_y: 50 },
    elastic: { ix: 1000000, iy: 900000, ixy: 0, sx_positive: 10000, sx_negative: 9000, sy_positive: 10000, sy_negative: 9000, rx: 10, ry: 9.5 },
    plastic: { pna_x: 50, pna_y: 50, zx: 15000, zy: 14000 },
    principal: { i_major: 1000000, i_minor: 900000, major_axis_angle_degrees: 30, orientation_status: 'determinate' },
  },
  advanced: {},
  ...(includeMechanics ? {
    mechanics: {
      schema_version: '1.0',
      geometry: {
        representation: {
          kind: 'rectangular_components', geometry_type: 'rectangle', units: 'mm',
          coordinate_system: { origin: 'bounding_box_lower_left', x: 'right', y: 'up' },
          bounding_box_mm: { width: 100, height: 100 }, centroid_mm: { x: 50, y: 50 }, area_mm2: 10000,
          integration_primitives: [{ kind: 'rectangle', x_min_mm: 0, y_min_mm: 0, width_mm: 100, height_mm: 100 }],
        },
        polar_centroidal: { inertia_mm4: 1000000000000, radius_mm: 1000 },
        principal: {
          basis_angle_degrees: 30,
          basis_unique: true,
          major: {
            extreme_positive_mm: 150, extreme_negative_mm: -100,
            elastic_modulus_positive_mm3: 1000000, elastic_modulus_negative_mm3: 900000,
            radius_mm: 80, plastic_neutral_coordinate_mm: 25, plastic_modulus_mm3: 1500000,
          },
          minor: {
            extreme_positive_mm: 120, extreme_negative_mm: -110,
            elastic_modulus_positive_mm3: 800000, elastic_modulus_negative_mm3: 700000,
            radius_mm: 70, plastic_neutral_coordinate_mm: -10, plastic_modulus_mm3: 1200000,
          },
        },
        third_moments: { m30_mm5: 1e15, m21_mm5: 2e15, m12_mm5: 3e15, m03_mm5: 4e15 },
        third_moments_principal: { m30_mm5: 5e15, m21_mm5: 6e15, m12_mm5: 7e15, m03_mm5: 8e15 },
        coupled_bending: {
          mx: { elastic_modulus_positive_mm3: 111000, elastic_modulus_negative_mm3: 112000 },
          my: { elastic_modulus_positive_mm3: 121000, elastic_modulus_negative_mm3: 122000 },
        },
      },
      advanced: {
        status: 'computed',
        shear_center_geometry: { polar_inertia_mm4: 1e12, polar_radius_mm: 1000, coupling_factor: 0.25, offset_x_mm: 12, offset_y_mm: -8 },
        wagner: { beta_x_mm: 5, beta_y_mm: -5, beta_major_mm: 1.5, beta_minor_mm: -1.5 },
        torsion: { modulus_mm3: 300000, unit_max_shear_per_torque_mm3_inverse: 0.001, method: 'elastic_torsion' },
        shear: { modulus_x_mm2: 200, modulus_y_mm2: 150, compliance: { xx_mm2_inverse: 0.01, xy_mm2_inverse: -0.002, yy_mm2_inverse: 0.02 }, method: 'energy_integral' },
        warping: { omega_positive_mm2: 0, omega_negative_mm2: 0, modulus_positive_mm4: null, modulus_negative_mm4: null, absolute_error_bound_mm2: 0, method: 'zero_warping_constant', status: 'not_applicable' },
        fields: { raw_node_coordinates_mm: [[0, 0], [100, 0], [100, 100]], source: 'test fixture' },
      },
    },
    formula_report: {
      profile_id: 'rectangle', library_version: '1.3.0', manifest_hash: 'fixture',
      properties: [
        { key: 'mechanics.geometry.third_moments.m30', symbol: 'M30', status: 'computed', value: 3, unit: 'mm5' },
        { key: 'mechanics.advanced.shear.compliance.xx', symbol: 'Cxx', status: 'computed', value: 4, unit: 'mm-2' },
        { key: 'mechanics.advanced.torsion.unit_shear', symbol: 'q', status: 'computed', value: 5, unit: 'mm-3' },
        { key: 'mechanics.advanced.warping.modulus_positive', symbol: 'B+', status: 'not_applicable', value: null, unit: 'mm4' },
      ],
    },
  } : {}),
})

;(async () => {
  assert.equal(demo, true, 'This focused fixture smoke expects the isolated browser demo API.')
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))

  try {
    await page.goto(base)
    await signIn(page, { demo, role: 'admin' })
    await page.evaluate(({ dbKey, codes, withMechanics, legacy }) => {
      const db = JSON.parse(localStorage.getItem(dbKey))
      const type = db.section_types.find(item => item.shape === 'rectangle')
      const material = db.materials[0]
      if (!type || !material) throw new Error('Demo seed needs a section type and material')
      db.sections = db.sections.filter(item => !codes.includes(item.code))
      const makeSection = (code, snapshot, index) => ({
        id: 900000 + index,
        code,
        name_vi: code,
        name_en: code,
        category: type.category,
        shape: type.shape,
        source: 'isolated mechanics viewer test',
        material_id: material.id,
        section_type_id: type.id,
        properties: { depth: 100, width: 100 },
        section_properties: snapshot,
        section_properties_calculated_at: '2026-10-14T00:00:00.000Z',
      })
      db.sections.push(makeSection(codes[0], withMechanics, 0), makeSection(codes[1], legacy, 1))
      localStorage.setItem(dbKey, JSON.stringify(db))
    }, { dbKey, codes, withMechanics: storedResult(true), legacy: storedResult(false) })

    const adminMode = page.getByRole('button', { name: /Admin interface/ })
    if (await adminMode.count()) await adminMode.click()
    await page.getByRole('tab', { name: 'Sections', exact: true }).click()
    const sectionRow = code => page.locator('.library-table tbody tr').filter({ has: page.getByRole('cell', { name: code, exact: true }) })
    for (const code of codes) await sectionRow(code).locator('.property-details > summary').click()

    const mechanicsCard = sectionRow(codes[0]).locator('.section-calculated-properties')
    await mechanicsCard.getByRole('heading', { name: 'Strength of materials', exact: true }).waitFor()
    const group = (card, heading) => card.locator('.section-calculated-group').filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
    const value = async (card, heading, symbol) => {
      const row = group(card, heading).locator('dl > div').filter({ has: page.getByText(symbol, { exact: true }) })
      return row.locator('dd').innerText()
    }

    assert.equal(await value(mechanicsCard, 'Strength of materials', 'Geometric representation'), 'Rectangle')
    assert.match(await value(mechanicsCard, 'Polar centroidal', 'Ip · Polar moment'), /1,000,000,000,000 mm⁴/)
    assert.match(await value(mechanicsCard, 'Major principal axis', 'S+ · Elastic modulus'), /1,000,000 mm³/)
    assert.match(await value(mechanicsCard, 'Major principal axis', 'PNA · Plastic neutral coordinate'), /25 mm/)
    assert.match(await value(mechanicsCard, 'Coupled elastic modulus · Mx/My ±', 'Mx S+'), /111,000 mm³/)
    assert.match(await value(mechanicsCard, 'Coupled elastic modulus · Mx/My ±', 'Mx S−'), /112,000 mm³/)
    assert.match(await value(mechanicsCard, 'Coupled elastic modulus · Mx/My ±', 'My S+'), /121,000 mm³/)
    assert.match(await value(mechanicsCard, 'Coupled elastic modulus · Mx/My ±', 'My S−'), /122,000 mm³/)
    const legacyCard = sectionRow(codes[1]).locator('.section-calculated-properties')
    await legacyCard.getByText('A · Area', { exact: true }).waitFor()
    assert.equal(await legacyCard.getByRole('heading', { name: 'Strength of materials', exact: true }).count(), 0, 'Older snapshots without mechanics remain readable.')

    await mechanicsCard.getByLabel('Display unit', { exact: true }).selectOption('cm')
    assert.match(await value(mechanicsCard, 'Polar centroidal', 'Ip · Polar moment'), /100,000,000 cm⁴/)
    assert.match(await value(mechanicsCard, 'Major principal axis', 'PNA · Plastic neutral coordinate'), /2\.5 cm/)
    assert.match(await value(mechanicsCard, 'Centroidal third moments', 'm30'), /10,000,000,000 cm⁵/)
    await mechanicsCard.getByLabel('Display unit', { exact: true }).selectOption('m')
    assert.match(await value(mechanicsCard, 'Centroidal third moments', 'm30'), /1 m⁵/)

    const advanced = mechanicsCard.locator('details.section-calculated-mechanics-advanced')
    await advanced.locator(':scope > summary').click()
    assert.match(await advanced.locator(':scope > summary').innerText(), /Computed/)
    assert.match(await value(advanced, 'Torsion', 'Torsion modulus'), /0\.0003 m³/)
    await mechanicsCard.getByLabel('Display unit', { exact: true }).selectOption('cm')
    assert.match(await value(advanced, 'Torsion', 'Unit maximum shear per torque'), /1 cm⁻³/)
    assert.match(await value(advanced, 'Shear stiffness', 'Compliance xx'), /1 cm⁻²/)
    assert.match(await value(advanced, 'Shear-center geometry', 'Coupling factor'), /0\.25/)
    const warping = group(advanced, 'Warping')
    assert.ok(await warping.getByText(/Not applicable/).count() > 0)
    assert.match(await value(advanced, 'Warping', 'ω positive'), /0 cm²/)
    assert.match(await value(advanced, 'Warping', 'ω negative'), /0 cm²/)
    assert.equal((await value(advanced, 'Warping', 'Warping modulus positive')).trim(), '—')

    const formulaReport = mechanicsCard.locator('details.section-calculated-formula-report')
    await formulaReport.locator(':scope > summary').click()
    const formulaProperty = key => formulaReport.locator('.section-calculated-report-property').filter({ hasText: key })
    assert.match(await formulaProperty('mechanics.geometry.third_moments.m30').locator('header').innerText(), /Computed · 3 mm⁵/)
    assert.match(await formulaProperty('mechanics.advanced.shear.compliance.xx').locator('header').innerText(), /Computed · 4 mm⁻²/)
    assert.match(await formulaProperty('mechanics.advanced.torsion.unit_shear').locator('header').innerText(), /Computed · 5 mm⁻³/)
    const notApplicableHeader = await formulaProperty('mechanics.advanced.warping.modulus_positive').locator('header').innerText()
    assert.match(notApplicableHeader, /Not applicable/)
    assert.doesNotMatch(notApplicableHeader, /Not computed|mm⁴/)
    await page.getByRole('button', { name: 'VI', exact: true }).click()
    const localizedNotApplicable = await formulaProperty('mechanics.advanced.warping.modulus_positive').locator('header').innerText()
    assert.match(localizedNotApplicable, /Không áp dụng/)
    assert.doesNotMatch(localizedNotApplicable, /Chưa tính/)
    await page.getByRole('button', { name: 'EN', exact: true }).click()

    const fields = mechanicsCard.locator('.section-calculated-mechanics-fields')
    assert.equal(await fields.locator('pre').isVisible(), false, 'Raw model fields stay collapsed by default.')
    await fields.locator(':scope > summary').click()
    await fields.getByText('raw_node_coordinates_mm').waitFor()
    await fields.getByText('integration_primitives').waitFor()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      fields.getByRole('button', { name: 'Download raw mechanics fields JSON', exact: true }).click(),
    ])
    assert.equal(download.suggestedFilename(), 'section-mechanics-fields-rectangle.json')
    assert.deepEqual(JSON.parse(fs.readFileSync(await download.path(), 'utf8')), {
      geometry_representation: {
        kind: 'rectangular_components', geometry_type: 'rectangle', units: 'mm',
        coordinate_system: { origin: 'bounding_box_lower_left', x: 'right', y: 'up' },
        bounding_box_mm: { width: 100, height: 100 }, centroid_mm: { x: 50, y: 50 }, area_mm2: 10000,
        integration_primitives: [{ kind: 'rectangle', x_min_mm: 0, y_min_mm: 0, width_mm: 100, height_mm: 100 }],
      },
      advanced_fields: { raw_node_coordinates_mm: [[0, 0], [100, 0], [100, 100]], source: 'test fixture' },
    })
    assert.deepEqual(errors, [])
    console.log('Section mechanics viewer passed: concise localized representation, coupled bending moduli, principal S/Z/r/PNA, polar inertia/radius, third moments, advanced shear/torsion/warping values, formula NA and mm powers, collapsed downloadable raw data, and legacy snapshots.')
  } finally {
    await context.close()
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
