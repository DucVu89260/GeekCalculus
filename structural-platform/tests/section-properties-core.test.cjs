const assert = require('node:assert/strict')
const { test } = require('node:test')
const { spawnSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { createHash } = require('node:crypto')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const registry = JSON.parse(readFileSync(path.join(root, 'section-properties/section-registry.json')))
const cli = path.join(root, 'engineering/structural_engine/sectional_properties/data/section-core.mjs')

function request(profile, overrides = {}) {
  return {
    profile_id: profile.id,
    geometry: {
      type: profile.geometry_type, geometry_variant: profile.geometry_variant,
      dimensions: Object.fromEntries(Object.entries(profile.engine_dimensions).map(([key, input]) => [key, profile.default_dimensions[input]])),
    },
    units: 'mm', options: { include_plastic: true, include_advanced: true },
    ...overrides,
  }
}
function run(input, expectedExit = 0) {
  const command = spawnSync(process.execPath, [cli], { input: JSON.stringify(input), encoding: 'utf8' })
  assert.equal(command.status, expectedExit, command.stderr + command.stdout)
  return JSON.parse(command.stdout)
}
function doubleAngle(distance) {
  const input = request(registry.profiles.find(p => p.id === 'double_angle'))
  input.geometry.dimensions = { depth: 200, width: 100, thickness: 8, distance }
  return run(input)
}

for (const profile of registry.profiles) {
  test(`${profile.label}: production CLI attaches a complete reproducible canonical formula snapshot`, () => {
    const input = request(profile)
    const result = run(input)
    assert.equal(result.status, 'success')
    assert.equal(result.formula_report.profile_id, profile.id)
    assert.equal(result.formula_report.manifest_hash, createHash('sha256').update(JSON.stringify(registry)).digest('hex'))
    assert.equal(result.formula_report.properties.length, registry.properties.length)
    for (const item of result.formula_report.properties) {
      assert.ok(item.status === 'computed' || (item.status === 'not_applicable' && item.value === null && item.reason === 'zero_warping'), item.key)
      assert.ok(item.expression.length && item.substitution.expression.length, item.key)
      assert.equal(item.substitution.context_ref, 'inputs')
      assert.ok(item.reference_ids.length, item.key)
    }
    for (const key of ['torsion_constant_j', 'warping_constant_cw', 'shear_center', 'effective_shear_area']) {
      assert.equal(result.advanced[key].status, 'computed', key)
    }
    for (const [key, value] of Object.entries(input.geometry.dimensions)) {
      assert.equal(result.formula_report.dimensions.find(d => d.key === key).value, value)
    }
  })
}

test('Double Angle gap changes Iy and Zy by the independent parallel-axis relation, including zero gap', () => {
  const near = doubleAngle(0), far = doubleAngle(40)
  const h = 200, b = 100, t = 8
  const areaL = t * (b + h - t)
  const centroidL = (b * b + t * (h - t)) / (2 * (b + h - t))
  const expectedIyDelta = 2 * areaL * ((20 + centroidL) ** 2 - centroidL ** 2)
  assert.ok(Math.abs((far.properties.elastic.iy - near.properties.elastic.iy) / expectedIyDelta - 1) < 1e-12)
  assert.ok(Math.abs((far.properties.plastic.zy - near.properties.plastic.zy) / (2 * areaL * 20) - 1) < 1e-12)
  assert.equal(far.properties.geometric.perimeter - near.properties.geometric.perimeter, 2 * h)
  assert.ok(Math.abs(far.advanced.torsion_constant_j.value / near.advanced.torsion_constant_j.value - 1) < 1e-14)
  assert.ok(far.formula_report.connection_model)
})

test('explicit asymmetric I/H profile remains preserved for equal flanges; symmetric profile rejects unequal flanges', () => {
  const symmetric = request(registry.profiles.find(p => p.id === 'symmetric_i'))
  const explicitAsymmetric = run({ ...symmetric, profile_id: 'asymmetric_i' })
  assert.equal(explicitAsymmetric.formula_report.profile_id, 'asymmetric_i')
  symmetric.geometry.dimensions.bottom_flange_width += 10
  assert.equal(run(symmetric, 2).code, 'INVALID_GEOMETRY')
})

test('channel shear center outside the bounding box is a computed signed coordinate', () => {
  const result = run(request(registry.profiles.find(p => p.id === 'channel')))
  assert.ok(result.advanced.shear_center.value.x < 0)
  assert.equal(result.formula_report.properties.find(p => p.key === 'advanced.shear_center').value.x, result.advanced.shear_center.value.x)
})
