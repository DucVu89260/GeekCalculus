const assert = require('node:assert/strict')
const { test } = require('node:test')
const { calculateCraneSections } = require('./helpers/crane-module.cjs')('crane-beam-section')
const { workbook, workbookCase } = require('./helpers/crane-workbook.cjs')
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)), `${label}: ${actual} vs ${expected}`)

for (const method of ['ASD', 'LRFD']) test(`${method}: base and BOTH T sections reproduce valid Excel helper cells in canonical mm powers`, async () => {
  const fixture = workbookCase(method), c = fixture.cells
  const r = await calculateCraneSections(fixture.dimensions)
  const cell = (value, ref, scale = 1) => near(value, c[ref].value * scale, `${fixture.sheet}!${ref}`)
  const p = r.base.properties
  cell(p.geometric.area, 'B27', 100); cell(p.elastic.ix, 'B28', 1e4); cell(p.elastic.iy, 'B29', 1e4)
  cell(p.elastic.sx_positive, 'B30', 1000); cell(p.elastic.sx_negative, 'B31', 1000)
  cell(r.sy_top_flange_mm3, 'B32', 1000); cell(r.sy_bottom_flange_mm3, 'B33', 1000)
  cell(p.elastic.rx, 'B34', 10); cell(p.elastic.ry, 'B35', 10)
  cell(p.plastic.zx, 'B36', 1000); cell(p.plastic.zy, 'E36', 1000)
  cell(p.geometric.centroid_y, 'H36', 10); cell(p.plastic.pna_y, 'E35', 10)
  cell(r.hc_top_mm, 'H34', 10); cell(r.hp_top_mm, 'H35', 10)
  for (const [which, refs] of [['top', ['AP51', 'AP52', 'AP53', 'AP54', 'AP55', 'AP56']], ['bottom', ['AP57', 'AP58', 'AP59', 'AP60', 'AP61', 'AP62']]]) {
    const t = r[which].properties
    cell(t.geometric.area, refs[0]); cell(r[which + '_yc_from_outer_face_mm'], refs[1])
    cell(t.elastic.ix, refs[2]); cell(t.elastic.iy, refs[3]); cell(t.elastic.sy_positive, refs[4])
    cell(which === 'top' ? t.elastic.ry : t.elastic.rx, refs[5])
    near(t.plastic.zy, fixture.dimensions[which + '_flange_thickness'] * fixture.dimensions[which + '_flange_width'] ** 2 / 4 + r[which + '_web_depth_mm'] * fixture.dimensions.web_thickness ** 2 / 4, which + ' independent plastic integral')
    assert.equal(r[which].geometry_type, 'tee')
    assert.ok(r[which].formula_report.manifest_hash)
  }
  assert.equal(r.base.geometry_type, 'i_section')
  assert.equal(r.verification, 'GEOMETRY_ONLY_NOT_AISC_CAPACITY_CERTIFICATION')
})

test('asymmetric LRFD fixture exposes displayed top-T/bottom-T cross-reference and Zy defects rather than baking them into the core', async () => {
  const f = workbookCase('LRFD'), r = await calculateCraneSections(f.dimensions)
  assert.notEqual(r.top.properties.geometric.area, f.cells.B38.value * 100, 'B38 wrongly points to AP57 bottom T')
  assert.notEqual(r.top_yc_from_outer_face_mm, f.cells.B39.value * 10, 'B39 wrongly points to AP58 bottom T')
  assert.notEqual(r.bottom.properties.elastic.sy_positive, f.cells.B52.value * 1000, 'B52 wrongly points to AP59 Ix rather than AP61 Sy')
  assert.notEqual(r.top.properties.plastic.zy, f.cells.B44.value * 1000, 'AY45 includes unrelated full-web/bottom-flange terms')
  assert.ok(Math.abs(r.top_web_depth_mm - 2000 / 3) > 100, 'participation is NOT full web / 3')
})

test('reflection, scaling and independent T parallel-axis properties remain valid beyond the two fixtures', async () => {
  const f = workbookCase('LRFD'), d = f.dimensions
  const r = await calculateCraneSections(d)
  const reflected = await calculateCraneSections({ ...d, top_flange_width: d.bottom_flange_width, bottom_flange_width: d.top_flange_width, top_flange_thickness: d.bottom_flange_thickness, bottom_flange_thickness: d.top_flange_thickness })
  near(reflected.top.properties.geometric.area, r.bottom.properties.geometric.area, 'flange reflection')
  const scaled = await calculateCraneSections(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v * 2])))
  near(scaled.top.properties.elastic.iy, 16 * r.top.properties.elastic.iy, 'I scales L4')
  near(scaled.top.properties.plastic.zy, 8 * r.top.properties.plastic.zy, 'Z scales L3')
  const b = d.top_flange_width, tf = d.top_flange_thickness, w = r.top_web_depth_mm, tw = d.web_thickness
  const area = b * tf + tw * w, yc = (b * tf * tf / 2 + tw * w * (tf + w / 2)) / area
  near(r.top.properties.elastic.ix, b * tf ** 3 / 12 + b * tf * (yc - tf / 2) ** 2 + tw * w ** 3 / 12 + tw * w * (tf + w / 2 - yc) ** 2, 'independent parallel-axis Ix')
})

test('invalid geometry or a centroid outside the web cannot generate a fictional effective T', async () => {
  const d = workbookCase('ASD').dimensions
  await assert.rejects(() => calculateCraneSections({ ...d, depth: 10 }), /Invalid|depth|validation/i)
  await assert.rejects(() => calculateCraneSections({ ...d, top_flange_width: 1000000 }), /Centroid/)
  assert.deepEqual(workbook.sheet_names, ['AISC360-LRFD', 'AISC360-ASD'])
  assert.equal(workbook.macros_executed, false)
})
