import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { calculateGeometryMechanics } from '../../../../section-properties/core/mechanics-geometry.ts'

const platformRoot = new URL('../../../../', import.meta.url)
const registry = JSON.parse(readFileSync(new URL('section-properties/section-registry.json', platformRoot), 'utf8'))
const canonicalCli = fileURLToPath(new URL('engineering/structural_engine/sectional_properties/data/section-core.mjs', platformRoot))

function near(actual, expected, relative = 2e-12, label = 'value') {
  const scale = Math.max(Math.abs(expected), Number.MIN_VALUE)
  assert.ok(Math.abs(actual - expected) <= relative * scale, `${label}: expected ${expected}, got ${actual}`)
}

function grossProperties({ area, centroidX, centroidY, ix, iy, ixy = 0, angle = 0, orientation = null }) {
  const mean = ix / 2 + iy / 2
  const radius = Math.hypot(ix / 2 - iy / 2, ixy)
  return {
    geometric: { area, centroid_x: centroidX, centroid_y: centroidY },
    elastic: { ix, iy, ixy },
    principal: {
      i_major: mean + radius,
      i_minor: mean - radius,
      major_axis_angle_degrees: angle,
      orientation_status: orientation ?? (ix === iy && ixy === 0 ? 'indeterminate' : 'determinate'),
    },
  }
}

function rectangleResult(width, height, includePlastic = true) {
  const area = width * height
  const ix = width * height ** 3 / 12, iy = height * width ** 3 / 12
  return {
    normalized_input: { units: 'mm', options: { include_plastic: includePlastic }, geometry: { type: 'rectangle', geometry_variant: 'solid', dimensions: { width, height } } },
    diagnostics: {},
    properties: grossProperties({ area, centroidX: width / 2, centroidY: height / 2, ix, iy }),
  }
}

function angleResult(width, height, thickness) {
  const clearDepth = height - thickness
  return {
    normalized_input: {
      units: 'mm', options: { include_plastic: true }, geometry: { type: 'angle', geometry_variant: 'sharp_corner', dimensions: { width, depth: height, thickness } },
    },
    diagnostics: {
      components: [
        { x: 0, y: 0, width, height: thickness, area: width * thickness },
        { x: 0, y: thickness, width: thickness, height: clearDepth, area: thickness * clearDepth },
      ],
    },
    properties: (() => {
      const { area, centroidX, centroidY, ix, iy, ixy, angle } = angleBenchmarks(width, height, thickness)
      return grossProperties({ area, centroidX, centroidY, ix, iy, ixy, angle })
    })(),
  }
}

function angleBenchmarks(width, height, thickness) {
  const pieces = [
    { x: 0, y: 0, width, height: thickness },
    { x: 0, y: thickness, width: thickness, height: height - thickness },
  ]
  const area = thickness * (width + height - thickness)
  const centroidX = (width * width + thickness * (height - thickness)) / (2 * (width + height - thickness))
  const centroidY = (height * height + width * thickness - thickness * thickness) / (2 * (width + height - thickness))
  const piecesWithMoments = pieces.map((piece) => {
    const pieceArea = piece.width * piece.height
    const dx = piece.x + piece.width / 2 - centroidX
    const dy = piece.y + piece.height / 2 - centroidY
    return {
      area: pieceArea,
      dx,
      dy,
      ix: piece.width * piece.height ** 3 / 12 + pieceArea * dy ** 2,
      iy: piece.height * piece.width ** 3 / 12 + pieceArea * dx ** 2,
      ixy: pieceArea * dx * dy,
      m30: pieceArea * (dx ** 3 + dx * piece.width ** 2 / 4),
      m21: pieceArea * (dx ** 2 + piece.width ** 2 / 12) * dy,
      m12: pieceArea * dx * (dy ** 2 + piece.height ** 2 / 12),
      m03: pieceArea * (dy ** 3 + dy * piece.height ** 2 / 4),
    }
  })
  const sum = key => piecesWithMoments.reduce((total, piece) => total + piece[key], 0)
  const ix = sum('ix'), iy = sum('iy'), ixy = sum('ixy')
  const angle = ((0.5 * Math.atan2(-2 * ixy, ix - iy) * 180 / Math.PI) % 180 + 180) % 180
  const cosine = Math.cos(angle * Math.PI / 180), sine = Math.sin(angle * Math.PI / 180)
  const third = { m30_mm5: sum('m30'), m21_mm5: sum('m21'), m12_mm5: sum('m12'), m03_mm5: sum('m03') }
  const principalThird = {
    m30_mm5: cosine ** 3 * third.m30_mm5 + 3 * cosine ** 2 * sine * third.m21_mm5 + 3 * cosine * sine ** 2 * third.m12_mm5 + sine ** 3 * third.m03_mm5,
    m21_mm5: -(cosine ** 2) * sine * third.m30_mm5 + (cosine ** 3 - 2 * cosine * sine ** 2) * third.m21_mm5 + (2 * cosine ** 2 * sine - sine ** 3) * third.m12_mm5 + cosine * sine ** 2 * third.m03_mm5,
    m12_mm5: cosine * sine ** 2 * third.m30_mm5 + (sine ** 3 - 2 * cosine ** 2 * sine) * third.m21_mm5 + (cosine ** 3 - 2 * cosine * sine ** 2) * third.m12_mm5 + sine * cosine ** 2 * third.m03_mm5,
    m03_mm5: -(sine ** 3) * third.m30_mm5 + 3 * sine ** 2 * cosine * third.m21_mm5 - 3 * sine * cosine ** 2 * third.m12_mm5 + cosine ** 3 * third.m03_mm5,
  }
  return { area, centroidX, centroidY, ix, iy, ixy, angle, third, principalThird }
}

function clippedArea(rect, cut, basis, keepBelow) {
  const { cosine, sine, axis } = basis
  const x0 = rect.x - basis.cx, x1 = rect.x + rect.width - basis.cx
  const y0 = rect.y - basis.cy, y1 = rect.y + rect.height - basis.cy
  const points = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => axis === 'v'
    ? { q: -sine * x + cosine * y, p: cosine * x + sine * y }
    : { q: cosine * x + sine * y, p: -sine * x + cosine * y })
  const output = []
  const inside = p => keepBelow ? p.q <= cut : p.q >= cut
  for (let i = 0; i < points.length; i++) {
    const current = points[i], previous = points[(i + points.length - 1) % points.length]
    if (inside(current) !== inside(previous)) {
      const f = (cut - previous.q) / (current.q - previous.q)
      output.push({ q: cut, p: previous.p + f * (current.p - previous.p) })
    }
    if (inside(current)) output.push(current)
  }
  if (output.length < 3) return { area: 0, firstMoment: 0 }
  let twiceArea = 0, centroidNumerator = 0
  for (let i = 0; i < output.length; i++) {
    const a = output[i], b = output[(i + 1) % output.length]
    const cross = a.q * b.p - b.q * a.p
    twiceArea += cross
    centroidNumerator += (a.q + b.q) * cross
  }
  if (twiceArea === 0) return { area: 0, firstMoment: 0 }
  const signedArea = twiceArea / 2
  const firstMoment = Math.abs(signedArea) * centroidNumerator / (6 * signedArea)
  return { area: Math.abs(signedArea), firstMoment }
}

test('rectangle benchmark returns exact polar and principal elastic/plastic mechanics', () => {
  const b = 80, h = 120
  const result = calculateGeometryMechanics(rectangleResult(b, h))
  const ix = b * h ** 3 / 12, iy = h * b ** 3 / 12
  assert.deepEqual(result.representation.centroid_mm, { x: b / 2, y: h / 2 })
  assert.equal(result.principal.major.inertia_mm4, ix)
  assert.equal(result.principal.basis_angle_degrees, 0)
  assert.deepEqual(result.representation.integration_primitives, [{ kind: 'rectangle', x_min_mm: 0, y_min_mm: 0, width_mm: b, height_mm: h }])
  near(result.polar_centroidal.inertia_mm4, ix + iy, 2e-14, 'polar inertia')
  near(result.polar_centroidal.radius_mm, Math.sqrt((ix + iy) / (b * h)), 2e-14, 'polar radius')
  assert.equal(result.principal.basis_angle_degrees, 0)
  assert.equal(result.principal.basis_unique, true)
  near(result.principal.major.inertia_mm4, ix, 2e-14, 'major inertia')
  near(result.principal.major.extreme_positive_mm, h / 2, 2e-14, 'major positive extreme')
  near(result.principal.major.extreme_negative_mm, -h / 2, 2e-14, 'major negative extreme')
  near(result.principal.major.elastic_modulus_positive_mm3, ix / (h / 2), 2e-14, 'major elastic modulus')
  near(result.principal.major.plastic_neutral_coordinate_mm, 0, 2e-14, 'major PNA')
  near(result.principal.major.plastic_modulus_mm3, b * h ** 2 / 4, 2e-14, 'major plastic modulus')
  near(result.principal.minor.inertia_mm4, iy, 2e-14, 'minor inertia')
  near(result.principal.minor.plastic_modulus_mm3, h * b ** 2 / 4, 2e-14, 'minor plastic modulus')
  near(result.coupled_bending.mx.elastic_modulus_positive_mm3, ix / (h / 2), 2e-14, 'rectangle Mx modulus')
  near(result.coupled_bending.my.elastic_modulus_positive_mm3, iy / (b / 2), 2e-14, 'rectangle My modulus')
  assert.deepEqual(result.third_moments, { m30_mm5: 0, m21_mm5: 0, m12_mm5: 0, m03_mm5: 0 })
  assert.deepEqual(result.third_moments_principal, { m30_mm5: 0, m21_mm5: 0, m12_mm5: 0, m03_mm5: 0 })
})

test('angle benchmark matches independent parallel-axis and third-moment formulas', () => {
  const b = 80, h = 120, t = 10
  const result = calculateGeometryMechanics(angleResult(b, h, t))
  const expected = angleBenchmarks(b, h, t)
  near(result.representation.centroid_mm.x, expected.centroidX, 2e-14, 'angle centroid x')
  near(result.representation.centroid_mm.y, expected.centroidY, 2e-14, 'angle centroid y')
  near(result.principal.basis_angle_degrees, expected.angle, 2e-13, 'angle principal basis')
  assert.equal(result.principal.basis_angle_degrees, angleResult(b, h, t).properties.principal.major_axis_angle_degrees)
  near(result.principal.major.inertia_mm4, (expected.ix + expected.iy) / 2 + Math.hypot((expected.ix - expected.iy) / 2, expected.ixy), 2e-13, 'angle major inertia')
  for (const key of Object.keys(expected.third)) near(result.third_moments[key], expected.third[key], 2e-13, `angle ${key}`)
  for (const key of Object.keys(expected.principalThird)) near(result.third_moments_principal[key], expected.principalThird[key], 3e-13, `angle principal ${key}`)

  const radians = expected.angle * Math.PI / 180
  const basis = { cx: expected.centroidX, cy: expected.centroidY, cosine: Math.cos(radians), sine: Math.sin(radians), axis: 'v' }
  const parts = [{ x: 0, y: 0, width: b, height: t }, { x: 0, y: t, width: t, height: h - t }]
  const cut = result.principal.major.plastic_neutral_coordinate_mm
  const below = parts.map(part => clippedArea(part, cut, basis, true))
  const above = parts.map(part => clippedArea(part, cut, basis, false))
  const belowArea = below.reduce((sum, item) => sum + item.area, 0)
  near(belowArea, expected.area / 2, 2e-12, 'angle principal PNA area balance')
  const expectedPlasticModulus = below.reduce((sum, item) => sum + cut * item.area - item.firstMoment, 0)
    + above.reduce((sum, item) => sum + item.firstMoment - cut * item.area, 0)
  near(result.principal.major.plastic_modulus_mm3, expectedPlasticModulus, 2e-12, 'angle principal plastic modulus')

  const determinant = expected.ix * expected.iy - expected.ixy ** 2
  const responses = { mx: [], my: [] }
  for (const part of parts) for (const [x, y] of [[part.x, part.y], [part.x + part.width, part.y], [part.x + part.width, part.y + part.height], [part.x, part.y + part.height]]) {
    const X = x - expected.centroidX, Y = y - expected.centroidY
    responses.mx.push((-expected.ixy * X + expected.iy * Y) / determinant)
    responses.my.push((expected.ix * X - expected.ixy * Y) / determinant)
  }
  for (const key of ['mx', 'my']) {
    const expectedPositive = 1 / Math.max(...responses[key])
    const expectedNegative = 1 / -Math.min(...responses[key])
    near(result.coupled_bending[key].elastic_modulus_positive_mm3, expectedPositive, 3e-12, `angle ${key} positive coupled modulus`)
    near(result.coupled_bending[key].elastic_modulus_negative_mm3, expectedNegative, 3e-12, `angle ${key} negative coupled modulus`)
  }
})

test('circle and CHS use analytic central-symmetry mechanics', () => {
  for (const [type, thickness] of [['circle', undefined], ['circular_hollow', 10]]) {
    const diameter = 100, outer = diameter / 2, inner = thickness === undefined ? 0 : outer - thickness
    const area = Math.PI * (outer ** 2 - inner ** 2)
    const inertia = Math.PI * (outer ** 4 - inner ** 4) / 4
    const result = calculateGeometryMechanics({
      normalized_input: { units: 'mm', options: { include_plastic: true }, geometry: { type, geometry_variant: thickness === undefined ? 'solid' : 'uniform_wall', dimensions: { diameter, ...(thickness === undefined ? {} : { thickness }) } } },
      diagnostics: {},
      properties: grossProperties({ area, centroidX: outer, centroidY: outer, ix: inertia, iy: inertia, orientation: 'indeterminate' }),
    })
    near(result.polar_centroidal.inertia_mm4, 2 * inertia, 2e-14, `${type} polar inertia`)
    near(result.principal.major.inertia_mm4, inertia, 2e-14, `${type} principal inertia`)
    near(result.principal.major.elastic_modulus_positive_mm3, inertia / outer, 2e-14, `${type} elastic modulus`)
    near(result.principal.major.plastic_modulus_mm3, 4 * (outer ** 3 - inner ** 3) / 3, 2e-14, `${type} plastic modulus`)
    near(result.principal.major.radius_mm, Math.sqrt(inertia / area), 2e-14, `${type} radius of gyration`)
    near(result.coupled_bending.mx.elastic_modulus_positive_mm3, inertia / outer, 2e-14, `${type} coupled Mx modulus`)
    assert.equal(result.principal.basis_unique, false)
    assert.deepEqual(result.third_moments, { m30_mm5: 0, m21_mm5: 0, m12_mm5: 0, m03_mm5: 0 })
  }
})

test('mechanics scale with the dimensional powers and retain the principal direction', () => {
  const base = calculateGeometryMechanics(angleResult(80, 120, 10))
  for (const factor of [0.001, 10, 1000]) {
    const scaledResult = calculateGeometryMechanics(angleResult(80 * factor, 120 * factor, 10 * factor))
    near(scaledResult.principal.basis_angle_degrees, base.principal.basis_angle_degrees, 2e-13, 'scaled principal angle')
    near(scaledResult.polar_centroidal.inertia_mm4 / base.polar_centroidal.inertia_mm4, factor ** 4, 4e-12, 'polar inertia scale')
    near(scaledResult.principal.major.plastic_modulus_mm3 / base.principal.major.plastic_modulus_mm3, factor ** 3, 4e-12, 'plastic modulus scale')
    near(scaledResult.third_moments.m30_mm5 / base.third_moments.m30_mm5, factor ** 5, 4e-12, 'third moment scale')
  }
})

test('include_plastic=false leaves elastic geometry available and marks plastic values not requested', () => {
  const result = calculateGeometryMechanics(rectangleResult(80, 120, false))
  assert.equal(result.principal.major.plastic_neutral_coordinate_mm, null)
  assert.equal(result.principal.major.plastic_modulus_mm3, null)
  assert.equal(result.principal.minor.plastic_neutral_coordinate_mm, null)
  assert.equal(result.principal.minor.plastic_modulus_mm3, null)
  assert.equal(result.principal.major.plastic_status, 'not_requested')
  assert.ok(Number.isFinite(result.polar_centroidal.inertia_mm4))
  assert.ok(Number.isFinite(result.coupled_bending.mx.elastic_modulus_positive_mm3))
})

test('unrepresentable third moments raise a numerical-range error instead of becoming nonfinite', () => {
  assert.throws(() => calculateGeometryMechanics(angleResult(8e69, 12e69, 1e69)), /finite numeric range/)
})

test('composite geometries require the material rectangle decomposition', () => {
  assert.throws(() => calculateGeometryMechanics({
    normalized_input: { units: 'mm', geometry: { type: 'channel', geometry_variant: 'sharp_corner', dimensions: { width: 50, depth: 100, web_thickness: 5, flange_thickness: 8 } } },
    diagnostics: {},
    properties: grossProperties({ area: 1, centroidX: 0, centroidY: 0, ix: 1, iy: 1, orientation: 'indeterminate' }),
  }), /rectangular material components/)
})

test('canonical result decompositions cover every registered section geometry', () => {
  const geometryTypes = new Set()
  for (const profile of registry.profiles) {
    const dimensions = Object.fromEntries(Object.entries(profile.engine_dimensions)
      .map(([engineKey, catalogKey]) => [engineKey, profile.default_dimensions[catalogKey]]))
    const request = {
      profile_id: profile.id,
      geometry: { type: profile.geometry_type, geometry_variant: profile.geometry_variant, dimensions },
      units: 'mm', options: { include_plastic: true, include_advanced: true },
    }
    const cliResult = spawnSync(process.execPath, [canonicalCli], { input: JSON.stringify(request), encoding: 'utf8' })
    assert.equal(cliResult.status, 0, `${profile.id}: ${cliResult.stderr}${cliResult.stdout}`)
    const mechanics = calculateGeometryMechanics(JSON.parse(cliResult.stdout))
    geometryTypes.add(profile.geometry_type)
    assert.ok(Number.isFinite(mechanics.polar_centroidal.inertia_mm4), profile.id)
    assert.ok(Number.isFinite(mechanics.principal.major.plastic_modulus_mm3), profile.id)
    assert.ok(Object.values(mechanics.third_moments).every(Number.isFinite), profile.id)
    assert.ok(Object.values(mechanics.third_moments_principal).every(Number.isFinite), profile.id)
    const exactZeros = {
      rectangle: ['m30_mm5', 'm21_mm5', 'm12_mm5', 'm03_mm5'],
      circle: ['m30_mm5', 'm21_mm5', 'm12_mm5', 'm03_mm5'],
      circular_hollow: ['m30_mm5', 'm21_mm5', 'm12_mm5', 'm03_mm5'],
      rectangular_hollow: ['m30_mm5', 'm21_mm5', 'm12_mm5', 'm03_mm5'],
      channel: ['m21_mm5', 'm03_mm5'],
      tee: ['m30_mm5', 'm12_mm5'],
      double_angle: ['m30_mm5', 'm12_mm5'],
    }[profile.geometry_type]
      ?? (profile.geometry_type === 'i_section'
        ? profile.id === 'symmetric_i' ? ['m30_mm5', 'm21_mm5', 'm12_mm5', 'm03_mm5'] : ['m30_mm5', 'm12_mm5']
        : [])
    for (const key of exactZeros) assert.equal(mechanics.third_moments[key], 0, `${profile.id} exact symmetry ${key}`)
  }
  assert.equal(geometryTypes.size, 9)
})
