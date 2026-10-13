import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GEOMETRY_SCHEMA_VERSION,
  GeometryDefinition,
  GeometryValidationError,
  geometryInputSchema,
  validateGeometryDefinition,
} from '../../src/geometry-models.js'

test('geometry schema declares the supported shapes, units, and dimension variants', () => {
  assert.equal(GEOMETRY_SCHEMA_VERSION, 1)
  assert.deepEqual(geometryInputSchema.required, ['shape', 'unit', 'dimensions'])
  assert.deepEqual(geometryInputSchema.properties.schemaVersion, { const: 1 })
  assert.deepEqual(geometryInputSchema.properties.shape.enum, ['rectangle', 'circle', 'circular-tube', 'rectangular-tube', 'i-h'])
  assert.deepEqual(geometryInputSchema.properties.unit.enum, ['mm', 'cm', 'm', 'in'])
  assert.equal(geometryInputSchema.allOf.length, 5)
})

test('GeometryDefinition freezes a valid input and reports a serializable bounding box', () => {
  const geometry = new GeometryDefinition({ shape: 'i-h', unit: 'mm', dimensions: { b: 200, h: 300, tw: 10, tf: 20 } })
  assert.equal(geometry.schemaVersion, 1)
  assert.deepEqual(geometry.boundingBox, { width: 200, height: 300 })
  assert.deepEqual(geometry.toJSON(), { schemaVersion: 1, shape: 'i-h', unit: 'mm', dimensions: { b: 200, h: 300, tw: 10, tf: 20 } })
  assert.equal(Object.isFrozen(geometry), true)
  assert.equal(Object.isFrozen(geometry.dimensions), true)
  assert.deepEqual(new GeometryDefinition(geometry.toJSON()).toJSON(), geometry.toJSON())
  const chs = new GeometryDefinition({ shape: 'circular-tube', unit: 'mm', dimensions: { D: 100, t: 5 } })
  assert.deepEqual(chs.boundingBox, { width: 100, height: 100 })
  const rhs = new GeometryDefinition({ shape: 'rectangular-tube', unit: 'mm', dimensions: { b: 100, h: 200, t: 5 } })
  assert.deepEqual(rhs.boundingBox, { width: 100, height: 200 })
})

test('validation rejects missing, unknown, nonfinite, and geometrically impossible dimensions', () => {
  const result = validateGeometryDefinition({
    shape: 'i-h', unit: 'mm', extra: 1,
    dimensions: { b: 10, h: 20, tw: 10, tf: 11, radius: 4 },
  })
  assert.equal(result.valid, false)
  assert.deepEqual(new Set(result.errors.map(({ code }) => code)), new Set([
    'unknown_property', 'unknown_dimension', 'web_too_wide', 'flanges_overlap',
  ]))
  assert.throws(
    () => new GeometryDefinition({ shape: 'rectangle', unit: 'mm', dimensions: { b: 12, h: Number.NaN } }),
    GeometryValidationError,
  )
  assert.throws(
    () => new GeometryDefinition({ shape: 'circle', unit: 'ft', dimensions: { D: 20 } }),
    /Unit must be one of/,
  )
  for (const shape of ['toString', 'constructor', '__proto__']) {
    const hostile = validateGeometryDefinition({ shape, unit: 'mm', dimensions: {} })
    assert.equal(hostile.valid, false)
    assert.ok(hostile.errors.some(({ code }) => code === 'unsupported_shape'))
  }
  const hostileUnit = validateGeometryDefinition({ shape: 'rectangle', unit: 'constructor', dimensions: { b: 10, h: 20 } })
  assert.equal(hostileUnit.valid, false)
  assert.ok(hostileUnit.errors.some(({ code }) => code === 'unsupported_unit'))
  assert.throws(
    () => new GeometryDefinition({ schemaVersion: 2, shape: 'circle', unit: 'mm', dimensions: { D: 20 } }),
    /Schema version must be 1/,
  )
})

test('hollow-section validation requires a positive inner opening and representable wall thickness', () => {
  const impossibleCircle = validateGeometryDefinition({ shape: 'circular-tube', unit: 'mm', dimensions: { D: 100, t: 50 } })
  assert.ok(impossibleCircle.errors.some(({ code }) => code === 'wall_too_thick'))
  const impossibleBox = validateGeometryDefinition({ shape: 'rectangular-tube', unit: 'mm', dimensions: { b: 100, h: 200, t: 50 } })
  assert.ok(impossibleBox.errors.some(({ code }) => code === 'wall_too_thick'))

  for (const [shape, dimensions] of [
    ['circular-tube', { D: 1e16, t: 0.1 }],
    ['rectangular-tube', { b: 1e16, h: 1e16, t: 0.1 }],
  ]) {
    const result = validateGeometryDefinition({ shape, unit: 'mm', dimensions })
    assert.ok(result.errors.some(({ code }) => code === 'thickness_not_representable'))
  }
})
