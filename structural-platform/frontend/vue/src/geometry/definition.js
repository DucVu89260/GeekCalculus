import { GEOMETRY_SCHEMA_VERSION, LENGTH_UNITS, SHAPE_DEFINITIONS } from './schema.js'

const shapeNames = Object.keys(SHAPE_DEFINITIONS)
const unitNames = Object.keys(LENGTH_UNITS)

function issue(path, code, message) {
  return Object.freeze({ path, code, message })
}

export function validateGeometryDefinition(input) {
  const errors = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: [issue('$', 'object_required', 'Geometry definition must be an object.')] }
  }

  for (const key of Object.keys(input)) {
    if (!['schemaVersion', 'shape', 'unit', 'dimensions'].includes(key)) errors.push(issue(key, 'unknown_property', `Unknown property: ${key}.`))
  }

  if (input.schemaVersion !== undefined && input.schemaVersion !== GEOMETRY_SCHEMA_VERSION) {
    errors.push(issue('schemaVersion', 'unsupported_schema_version', `Schema version must be ${GEOMETRY_SCHEMA_VERSION}.`))
  }
  const supportedShape = typeof input.shape === 'string' && Object.hasOwn(SHAPE_DEFINITIONS, input.shape)
  if (!supportedShape || !shapeNames.includes(input.shape)) {
    errors.push(issue('shape', 'unsupported_shape', `Shape must be one of: ${shapeNames.join(', ')}.`))
  }
  if (!unitNames.includes(input.unit)) {
    errors.push(issue('unit', 'unsupported_unit', `Unit must be one of: ${unitNames.join(', ')}.`))
  }
  if (!input.dimensions || typeof input.dimensions !== 'object' || Array.isArray(input.dimensions)) {
    errors.push(issue('dimensions', 'object_required', 'Dimensions must be an object.'))
    return { valid: errors.length === 0, errors }
  }

  if (!supportedShape) return { valid: false, errors }
  const definition = SHAPE_DEFINITIONS[input.shape]

  const required = definition.dimensions.map(({ key }) => key)
  for (const key of Object.keys(input.dimensions)) {
    if (!required.includes(key)) errors.push(issue(`dimensions.${key}`, 'unknown_dimension', `Dimension ${key} does not apply to ${input.shape}.`))
  }
  for (const key of required) {
    const value = input.dimensions[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(issue(`dimensions.${key}`, 'finite_number_required', `${key} must be a finite number.`))
    } else if (value <= 0) {
      errors.push(issue(`dimensions.${key}`, 'positive_number_required', `${key} must be greater than zero.`))
    }
  }

  const { b, h, tw, tf } = input.dimensions
  if (input.shape === 'i-h' && [b, h, tw, tf].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    if (b <= tw) errors.push(issue('dimensions.tw', 'web_too_wide', 'I/H web thickness tw must be less than flange width b.'))
    if (h <= 2 * tf) errors.push(issue('dimensions.tf', 'flanges_overlap', 'I/H depth h must be greater than twice flange thickness tf.'))
  }

  return { valid: errors.length === 0, errors }
}

export class GeometryValidationError extends TypeError {
  constructor(errors) {
    super(errors.map(({ message }) => message).join(' '))
    this.name = 'GeometryValidationError'
    this.errors = errors
  }
}

/** Immutable, validated geometry input using one explicit length unit for all dimensions. */
export class GeometryDefinition {
  constructor(input) {
    const result = validateGeometryDefinition(input)
    if (!result.valid) throw new GeometryValidationError(result.errors)

    this.schemaVersion = GEOMETRY_SCHEMA_VERSION
    this.shape = input.shape
    this.unit = input.unit
    this.dimensions = Object.freeze({ ...input.dimensions })
    this.boundingBox = Object.freeze(this.shape === 'circle'
      ? { width: input.dimensions.D, height: input.dimensions.D }
      : { width: input.dimensions.b, height: input.dimensions.h })
    Object.freeze(this)
  }

  toJSON() {
    return { schemaVersion: this.schemaVersion, shape: this.shape, unit: this.unit, dimensions: { ...this.dimensions } }
  }
}

export function createGeometryDefinition(input) {
  return new GeometryDefinition(input)
}
