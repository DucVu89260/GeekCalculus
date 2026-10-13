export const GEOMETRY_SCHEMA_VERSION = 1

export const LENGTH_UNITS = Object.freeze({
  mm: Object.freeze({ millimetres: 1, symbol: 'mm' }),
  cm: Object.freeze({ millimetres: 10, symbol: 'cm' }),
  m: Object.freeze({ millimetres: 1000, symbol: 'm' }),
  in: Object.freeze({ millimetres: 25.4, symbol: 'in' }),
})

export const SHAPE_DEFINITIONS = Object.freeze({
  rectangle: Object.freeze({
    label: 'Rectangle',
    dimensions: Object.freeze([
      Object.freeze({ key: 'b', symbol: 'b', label: 'Width' }),
      Object.freeze({ key: 'h', symbol: 'h', label: 'Height' }),
    ]),
  }),
  circle: Object.freeze({
    label: 'Circle',
    dimensions: Object.freeze([
      Object.freeze({ key: 'D', symbol: 'D', label: 'Diameter' }),
    ]),
  }),
  'circular-tube': Object.freeze({
    label: 'Circular hollow section (CHS)',
    dimensions: Object.freeze([
      Object.freeze({ key: 'D', symbol: 'D', label: 'Outer diameter' }),
      Object.freeze({ key: 't', symbol: 't', label: 'Wall thickness' }),
    ]),
    constraints: Object.freeze(['D > 2 * t']),
  }),
  'rectangular-tube': Object.freeze({
    label: 'Rectangular hollow section (SHS/RHS)',
    dimensions: Object.freeze([
      Object.freeze({ key: 'b', symbol: 'b', label: 'Outer width' }),
      Object.freeze({ key: 'h', symbol: 'h', label: 'Outer height' }),
      Object.freeze({ key: 't', symbol: 't', label: 'Uniform wall thickness' }),
    ]),
    constraints: Object.freeze(['b > 2 * t', 'h > 2 * t']),
  }),
  'i-h': Object.freeze({
    label: 'Symmetric I/H section',
    dimensions: Object.freeze([
      Object.freeze({ key: 'b', symbol: 'b', label: 'Flange width' }),
      Object.freeze({ key: 'h', symbol: 'h', label: 'Overall depth' }),
      Object.freeze({ key: 'tw', symbol: 'tw', label: 'Web thickness' }),
      Object.freeze({ key: 'tf', symbol: 'tf', label: 'Flange thickness' }),
    ]),
    constraints: Object.freeze(['b > tw', 'h > 2 * tf']),
  }),
})

const dimensionSchema = required => ({
  type: 'object',
  required,
  additionalProperties: false,
  properties: Object.fromEntries(required.map((key) => [key, { type: 'number', exclusiveMinimum: 0 }])) ,
})

/** JSON Schema for GeometryDefinition input, version 1. Lengths in each input share one unit. */
export const geometryInputSchema = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://geekcalculus.local/schemas/geometry-definition-v1.json',
  title: 'GeometryDefinition',
  type: 'object',
  required: ['shape', 'unit', 'dimensions'],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: GEOMETRY_SCHEMA_VERSION },
    shape: { type: 'string', enum: Object.keys(SHAPE_DEFINITIONS) },
    unit: { type: 'string', enum: Object.keys(LENGTH_UNITS) },
    dimensions: { type: 'object' },
  },
  allOf: [
    { if: { properties: { shape: { const: 'rectangle' } }, required: ['shape'] }, then: { properties: { dimensions: dimensionSchema(['b', 'h']) } } },
    { if: { properties: { shape: { const: 'circle' } }, required: ['shape'] }, then: { properties: { dimensions: dimensionSchema(['D']) } } },
    { if: { properties: { shape: { const: 'circular-tube' } }, required: ['shape'] }, then: { properties: { dimensions: dimensionSchema(['D', 't']) } } },
    { if: { properties: { shape: { const: 'rectangular-tube' } }, required: ['shape'] }, then: { properties: { dimensions: dimensionSchema(['b', 'h', 't']) } } },
    { if: { properties: { shape: { const: 'i-h' } }, required: ['shape'] }, then: { properties: { dimensions: dimensionSchema(['b', 'h', 'tw', 'tf']) } } },
  ],
})

export const geometryCoordinateConvention = Object.freeze({
  origin: 'lower-left corner of the bounding box',
  positiveX: 'right, across width',
  positiveY: 'up, across depth',
  ix: 'second moment about the horizontal x axis: integral((y - centroidY)^2 dA)',
  iy: 'second moment about the vertical y axis: integral((x - centroidX)^2 dA)',
  ixy: 'product of inertia about centroidal x/y axes: integral((x - centroidX)(y - centroidY) dA)',
  angle: 'principal-axis angle is measured counter-clockwise from +x and reported modulo 180 degrees',
})
