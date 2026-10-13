import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSectionProperties, GeometryCalculationError } from '../../src/analytical-engine.js'

function closeTo(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} is not close to ${expected}`)
}

test('rectangle benchmark matches exact area, perimeter, centroid, inertias, section moduli, and gyration radii', () => {
  const result = calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: 120, h: 240 } })
  closeTo(result.A, 28800)
  closeTo(result.perimeter, 720)
  assert.deepEqual(result.centroid, { x: 60, y: 120 })
  closeTo(result.Ix, 138240000)
  closeTo(result.Iy, 34560000)
  closeTo(result.Ixy, 0)
  closeTo(result.Sx.positive, 1152000)
  closeTo(result.Sx.negative, 1152000)
  closeTo(result.Sy.positive, 576000)
  closeTo(result.Sy.negative, 576000)
  closeTo(result.Zx.positive, 1728000)
  closeTo(result.Zy.negative, 864000)
  closeTo(result.rx, Math.sqrt(4800))
  closeTo(result.ry, Math.sqrt(1200))
  assert.deepEqual(result.pna, {
    aboutX: { orientation: 'horizontal', coordinate: 'y', value: 120 },
    aboutY: { orientation: 'vertical', coordinate: 'x', value: 60 },
  })
  closeTo(result.principalInertia.major, result.Ix)
  closeTo(result.principalInertia.minor, result.Iy)
  closeTo(result.principalInertia.majorAxisAngleDeg, 0)
})

test('solid circle benchmark has equal centroidal inertias and an indeterminate principal direction', () => {
  const result = calculateSectionProperties({ shape: 'circle', unit: 'mm', dimensions: { D: 100 } })
  closeTo(result.A, 2500 * Math.PI)
  closeTo(result.perimeter, 100 * Math.PI)
  assert.deepEqual(result.centroid, { x: 50, y: 50 })
  closeTo(result.Ix, Math.PI * 100 ** 4 / 64)
  closeTo(result.Iy, result.Ix)
  closeTo(result.Sx.positive, Math.PI * 100 ** 3 / 32)
  closeTo(result.Zx.positive, 100 ** 3 / 6)
  closeTo(result.rx, 25)
  closeTo(result.ry, 25)
  assert.equal(result.principalInertia.orientationIndeterminate, true)
  assert.equal(result.principalInertia.majorAxisAngleDeg, null)
})

test('symmetric I/H benchmark uses flange and web composite formulas', () => {
  const result = calculateSectionProperties({ shape: 'i-h', unit: 'mm', dimensions: { b: 200, h: 300, tw: 10, tf: 20 } })
  closeTo(result.A, 10600)
  closeTo(result.perimeter, 1380)
  assert.deepEqual(result.centroid, { x: 100, y: 150 })
  closeTo(result.Ix, 171713333.33333334)
  closeTo(result.Iy, 26688333.333333332)
  closeTo(result.Sx.positive, 1144755.5555555555)
  closeTo(result.Sy.negative, 266883.3333333333)
  closeTo(result.Zx.positive, 1289000)
  closeTo(result.Zy.negative, 406500)
  closeTo(result.rx, Math.sqrt(result.Ix / result.A))
  closeTo(result.ry, Math.sqrt(result.Iy / result.A))
})

test('equivalent dimensions in different input units produce unit-scaled equivalent properties', () => {
  const mm = calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: 120, h: 240 } })
  const cm = calculateSectionProperties({ shape: 'rectangle', unit: 'cm', dimensions: { b: 12, h: 24 } })
  const inches = calculateSectionProperties({ shape: 'rectangle', unit: 'in', dimensions: { b: 120 / 25.4, h: 240 / 25.4 } })
  closeTo(cm.A, mm.A / 100)
  closeTo(cm.perimeter, mm.perimeter / 10)
  closeTo(cm.Ix, mm.Ix / 10000)
  closeTo(cm.Sx.positive, mm.Sx.positive / 1000)
  closeTo(cm.rx, mm.rx / 10)
  closeTo(inches.Iy, mm.Iy / 25.4 ** 4)
  assert.equal(inches.units.secondMoment, 'in⁴')
})

test('square sections have no unique principal direction', () => {
  const result = calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: 10, h: 10 } })
  closeTo(result.principalInertia.major, result.principalInertia.minor)
  assert.equal(result.principalInertia.orientationIndeterminate, true)
  assert.equal(result.principalInertia.majorAxisAngleDeg, null)
})

test('principal-axis degeneracy check scales to small geometry units', () => {
  const result = calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: 1e-5, h: 2e-5 } })
  assert.equal(result.principalInertia.orientationIndeterminate, false)
  closeTo(result.principalInertia.major, result.Ix)
  closeTo(result.principalInertia.majorAxisAngleDeg, 0)
})

test('principal minor inertia remains positive for a numerically slender but representable rectangle', () => {
  const result = calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: 1e-100, h: 1e50 } })
  closeTo(result.principalInertia.major, result.Ix)
  closeTo(result.principalInertia.minor, result.Iy)
  assert.ok(result.principalInertia.minor > 0)
  assert.ok(result.A > 0)
})

test('calculation reports numeric underflow and overflow instead of returning invalid results', () => {
  assert.throws(
    () => calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: Number.MIN_VALUE, h: 1 } }),
    error => error instanceof GeometryCalculationError && error.code === 'numerical_range',
  )
  assert.throws(
    () => calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: Number.MAX_VALUE, h: 1 } }),
    GeometryCalculationError,
  )
  assert.throws(
    () => calculateSectionProperties({ shape: 'rectangle', unit: 'mm', dimensions: { b: 1, h: 1e308 } }),
    GeometryCalculationError,
  )
})
