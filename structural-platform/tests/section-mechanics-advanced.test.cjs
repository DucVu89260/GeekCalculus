const assert = require('node:assert/strict')
const { test } = require('node:test')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const registry = require('../section-properties/section-registry.json')
const cli = path.resolve(__dirname, '../engineering/structural_engine/sectional_properties/data/section-core.mjs')
const cache = new Map()
function calculate(profile, overrides = {}) {
  const p = registry.profiles.find(p => p.id === profile)
  const input = { profile_id: profile, units: 'mm', geometry: { type: p.geometry_type, geometry_variant: p.geometry_variant, dimensions: Object.fromEntries(Object.entries(p.engine_dimensions).map(([key, source]) => [key, p.default_dimensions[source]])) }, options: { include_advanced: true }, ...overrides }
  const key = JSON.stringify(input)
  if (!cache.has(key)) {
    const run = spawnSync(process.execPath, [cli], { input: key, encoding: 'utf8' })
    assert.equal(run.status, 0, run.stdout + run.stderr)
    cache.set(key, JSON.parse(run.stdout))
  }
  return cache.get(key)
}
function close(actual, expected, rel = 1e-10, abs = 1e-10) { assert.ok(Math.abs(actual - expected) <= Math.max(abs, rel * Math.max(Math.abs(actual), Math.abs(expected))), `${actual} vs ${expected}`) }
function integrate(polynomial, length) { return polynomial.reduce((s, c, i) => s + c * length ** (i + 1) / (i + 1), 0) }
function productIntegral(a, b, length) { let value = 0; a.forEach((x, i) => b.forEach((y, j) => { value += x * y * length ** (i + j + 1) / (i + j + 1) })); return value }

for (const profile of registry.profiles.filter(p => !['rectangle', 'circle', 'chs'].includes(p.id))) {
  test(`${profile.label}: stored physical wall fields reconstruct unit forces, shear energy and Cw`, () => {
    const result = calculate(profile.id), mechanics = result.mechanics.advanced
    assert.equal(mechanics.status, 'computed')
    const field = mechanics.fields.wall_model, byLabel = new Map(field.walls.map(w => [w.label, w]))
    const forces = [], energies = []
    for (const flow of [field.unit_shear_x, field.unit_shear_y]) {
      let fx = 0, fy = 0, energy = 0
      for (const wall of flow) {
        const dx = wall.end_mm.x - wall.start_mm.x, dy = wall.end_mm.y - wall.start_mm.y, length = Math.hypot(dx, dy)
        const coefficients = [wall.q0_mm_inverse, wall.q1_mm2_inverse, wall.q2_mm3_inverse]
        const q = integrate(coefficients, length)
        fx += q * dx / length; fy += q * dy / length
        const t = byLabel.get(wall.label).thickness_mm
        if (t > 0) energy += productIntegral(coefficients, coefficients, length) / t
      }
      forces.push([fx, fy]); energies.push(energy)
    }
    close(forces[0][0], 1); close(forces[0][1], 0); close(forces[1][0], 0); close(forces[1][1], 1)
    close(energies[0], 1 / result.advanced.effective_shear_area.value.x, 1e-10, 1e-16)
    close(energies[1], 1 / result.advanced.effective_shear_area.value.y, 1e-10, 1e-16)
    close(mechanics.shear.compliance.xx_mm2_inverse, energies[0], 1e-10, 1e-16)
    close(mechanics.shear.compliance.yy_mm2_inverse, energies[1], 1e-10, 1e-16)
    assert.ok(mechanics.shear.compliance.xx_mm2_inverse * mechanics.shear.compliance.yy_mm2_inverse > mechanics.shear.compliance.xy_mm2_inverse ** 2)
    let omegaMean = 0, cw = 0
    for (const wall of field.warping) {
      const length = Math.hypot(wall.end_mm.x - wall.start_mm.x, wall.end_mm.y - wall.start_mm.y), t = byLabel.get(wall.label).thickness_mm
      omegaMean += t * integrate([wall.omega0_mm2, wall.omega1_mm], length)
      cw += t * productIntegral([wall.omega0_mm2, wall.omega1_mm], [wall.omega0_mm2, wall.omega1_mm], length)
    }
    close(omegaMean, 0, 1e-10, 1e-5)
    close(cw, result.advanced.warping_constant_cw.value, 1e-10, 1e-7)
    if (cw === 0) { assert.equal(mechanics.warping.status, 'not_applicable'); assert.equal(mechanics.warping.modulus_positive_mm4, null) }
  })
}

test('circular and thin-wall torsional/shear moduli follow independent section formulas', () => {
  const circle = calculate('circle'), chs = calculate('chs'), angle = calculate('angle'), rhs = calculate('shs_rhs')
  const dc = circle.normalized_input.geometry.dimensions.diameter
  close(circle.mechanics.advanced.torsion.modulus_mm3, Math.PI * dc ** 3 / 16)
  close(circle.mechanics.advanced.shear.modulus_x_mm2, 3 * circle.properties.geometric.area / 4)
  close(chs.mechanics.advanced.torsion.modulus_mm3, chs.advanced.torsion_constant_j.value / (chs.normalized_input.geometry.dimensions.diameter / 2))
  const a = angle.normalized_input.geometry.dimensions
  close(angle.mechanics.advanced.torsion.modulus_mm3, a.thickness ** 2 * (a.depth + a.width - a.thickness) / 3)
  const h = rhs.normalized_input.geometry.dimensions
  close(rhs.mechanics.advanced.torsion.modulus_mm3, 2 * (h.width - h.thickness) * (h.height - h.thickness) * h.thickness)
})

test('solid unit square torsion modulus agrees with the independent classical coefficient', () => {
  const r = calculate('rectangle', { geometry: { type: 'rectangle', geometry_variant: 'solid', dimensions: { width: 1, height: 1 } } })
  assert.ok(r.mechanics.advanced.torsion.modulus_mm3 > .207 && r.mechanics.advanced.torsion.modulus_mm3 < .209)
  const w = r.mechanics.advanced.warping
  assert.ok(w.omega_positive_mm2 > 0 && w.omega_negative_mm2 < 0)
  assert.ok(w.extrema_enclosure_mm2.absolute_lower <= w.omega_positive_mm2)
  assert.ok(w.extrema_enclosure_mm2.absolute_upper >= w.omega_positive_mm2)
  close(w.modulus_positive_mm4, r.advanced.warping_constant_cw.value / w.extrema_enclosure_mm2.absolute_upper)
})

test('mechanical fields and higher moments scale with their physical powers', () => {
  const base = calculate('angle'), input = structuredClone(base.normalized_input)
  for (const key of Object.keys(input.geometry.dimensions)) input.geometry.dimensions[key] *= 3
  const large = calculate('angle', input)
  close(large.mechanics.advanced.torsion.modulus_mm3, 27 * base.mechanics.advanced.torsion.modulus_mm3)
  close(large.mechanics.advanced.shear.modulus_x_mm2, 9 * base.mechanics.advanced.shear.modulus_x_mm2)
  close(large.mechanics.geometry.third_moments.m21_mm5, 243 * base.mechanics.geometry.third_moments.m21_mm5)
  close(large.mechanics.advanced.wagner.beta_major_mm, 3 * base.mechanics.advanced.wagner.beta_major_mm)
})

test('plastic/advanced opt-outs preserve explicit unavailable metadata without deleting gross geometry', () => {
  const r = calculate('angle', { options: { include_plastic: false, include_advanced: false } })
  assert.equal(r.properties.plastic, null)
  assert.equal(r.mechanics.geometry.principal.major.plastic_status, 'not_requested')
  assert.equal(r.mechanics.geometry.principal.major.plastic_modulus_mm3, null)
  assert.equal(r.mechanics.advanced.status, 'not_requested')
  assert.equal(r.formula_report.properties.find(p => p.key === 'mechanics.geometry.principal.major.plastic_modulus_mm3').status, 'not_computed')
})

test('normal stress response honors coupled bending and stored principal/coupled moduli', async () => {
  const { sectionNormalStress } = await import('../section-properties/dist/index.mjs')
  const result = calculate('angle'), g = result.properties.geometric
  close(sectionNormalStress(result, { n: 100 }, { x: g.centroid_x, y: g.centroid_y }), 100 / g.area)
  const points = result.mechanics.geometry.representation.integration_primitives.flatMap(r => [
    { x: r.x_min_mm, y: r.y_min_mm }, { x: r.x_min_mm + r.width_mm, y: r.y_min_mm },
    { x: r.x_min_mm, y: r.y_min_mm + r.height_mm }, { x: r.x_min_mm + r.width_mm, y: r.y_min_mm + r.height_mm },
  ])
  for (const axis of ['mx', 'my']) {
    const values = points.map(point => sectionNormalStress(result, { [axis]: 1 }, point))
    close(1 / Math.max(...values), result.mechanics.geometry.coupled_bending[axis].elastic_modulus_positive_mm3)
    close(-1 / Math.min(...values), result.mechanics.geometry.coupled_bending[axis].elastic_modulus_negative_mm3)
  }
  assert.throws(() => sectionNormalStress(calculate('circle'), { bimoment: 1 }, { x: 100, y: 100, omega: 0 }), RangeError)
})

test('rectangle extrema enclosure contains an independent two-Neumann-series boundary maximum', () => {
  const ratio = (z, bound) => Math.exp(z - bound) * -Math.expm1(-2 * z) / (1 + Math.exp(-2 * bound))
  for (const [width, height] of [[1, 1], [1, 2]]) {
    const r = calculate('rectangle', { geometry: { type: 'rectangle', geometry_variant: 'solid', dimensions: { width, height } } })
    const a = Math.max(width, height) / 2, b = Math.min(width, height) / 2
    function reference(x, y) {
      let u = 0, v = 0
      for (let i = 0; i < 1024; i++) {
        const k = (i + .5) * Math.PI / b, l = (i + .5) * Math.PI / a, sign = i % 2 ? -1 : 1
        u += sign * ratio(k * x, k * a) * Math.sin(k * y) / k ** 3
        v += sign * Math.sin(l * x) * ratio(l * y, l * b) / l ** 3
      }
      return Math.abs(2 * u / b - 2 * v / a)
    }
    let peak = 0
    for (const edge of [0, 1]) {
      const end = edge === 0 ? a : b, value = t => edge === 0 ? reference(t, b) : reference(a, t)
      for (let band = 0; band < 12; band++) {
        let lo = band * end / 12, hi = (band + 1) * end / 12
        peak = Math.max(peak, value(lo), value(hi))
        for (let iteration = 0; iteration < 28; iteration++) {
          const left = lo + (hi - lo) * .3819660112501051, right = lo + (hi - lo) * .6180339887498949
          if (value(left) < value(right)) lo = left; else hi = right
        }
        peak = Math.max(peak, value((lo + hi) / 2))
      }
    }
    const tail = (a * a + b * b) / (Math.PI ** 3 * 1023 ** 2), bounds = r.mechanics.advanced.warping.extrema_enclosure_mm2
    assert.ok(bounds.absolute_lower <= peak + tail, `lower ${bounds.absolute_lower}, reference ${peak}`)
    assert.ok(bounds.absolute_upper >= peak - tail, `upper ${bounds.absolute_upper}, reference ${peak}`)
  }
})
