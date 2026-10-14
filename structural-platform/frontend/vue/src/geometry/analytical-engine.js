// Deprecated result-shape facade. Numerical calculations delegate to the shared package.
import { GeometryDefinition } from './definition.js'
import { LENGTH_UNITS } from './schema.js'
import registry from '../../../../section-properties/section-registry.json' with { type: 'json' }
import { calculateCoreValues } from '../../../../section-properties/dist/calculator.mjs'

export class GeometryCalculationError extends RangeError {
  constructor(message, code = 'numerical_range') {
    super(message)
    this.name = 'GeometryCalculationError'
    this.code = code
  }
}

function unitsFor(unit) {
  return {
    length: unit,
    area: `${unit}²`,
    secondMoment: `${unit}⁴`,
    sectionModulus: `${unit}³`,
  }
}

/** Preserve the original synchronous API while using the one canonical numerical core. */
export function calculateSectionProperties(input) {
  const geometry = input instanceof GeometryDefinition ? input : new GeometryDefinition(input)
  const factor = LENGTH_UNITS[geometry.unit].millimetres
  const id = registry.aliases[geometry.shape] ?? geometry.shape
  const profile = registry.profiles.find(profile => profile.id === id)
  const dimensions = Object.fromEntries(Object.entries(profile.engine_dimensions).map(([engineKey, inputKey]) => {
    const symbol = registry.dimensions[inputKey].symbol
    return [engineKey, geometry.dimensions[symbol] * factor]
  }))
  let result
  try {
    result = calculateCoreValues({
      geometry: { type: profile.geometry_type, geometry_variant: profile.geometry_variant, dimensions },
      units: 'mm', options: { include_plastic: true, include_advanced: false },
    })
  } catch (error) {
    throw new GeometryCalculationError(error.message)
  }
  const { geometric: g, elastic: e, plastic: p, principal: i } = result.properties
  const majorAngle = i.major_axis_angle_degrees
  return convertSectionProperties({
    schemaVersion: 1, shape: geometry.shape, unit: 'mm', units: unitsFor('mm'),
    A: g.area, perimeter: g.perimeter, centroid: { x: g.centroid_x, y: g.centroid_y },
    Ix: e.ix, Iy: e.iy, Ixy: e.ixy,
    Sx: { positive: e.sx_positive, negative: e.sx_negative },
    Sy: { positive: e.sy_positive, negative: e.sy_negative },
    Zx: { positive: p.zx, negative: p.zx }, Zy: { positive: p.zy, negative: p.zy },
    rx: e.rx, ry: e.ry,
    pna: {
      aboutX: { orientation: 'horizontal', coordinate: 'y', value: p.pna_y },
      aboutY: { orientation: 'vertical', coordinate: 'x', value: p.pna_x },
    },
    principalInertia: {
      major: i.i_major, minor: i.i_minor,
      majorAxisAngleDeg: majorAngle,
      minorAxisAngleDeg: majorAngle === null ? null : (majorAngle + 90) % 180,
      orientationIndeterminate: i.orientation_status === 'indeterminate',
    },
  }, geometry.unit)
}

function scaleResultValue(value, scale, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Section property ${label} must be a finite number.`)
  }
  const converted = value * scale
  if (!Number.isFinite(converted) || (value !== 0 && converted === 0)) {
    throw new GeometryCalculationError(`Section property ${label} is outside the supported numeric range in the target unit.`)
  }
  return converted
}

function scalePair(pair, scale, label) {
  return {
    positive: scaleResultValue(pair.positive, scale, `${label}.positive`),
    negative: scaleResultValue(pair.negative, scale, `${label}.negative`),
  }
}

/** Return a unit-converted copy of section properties without changing the source object. */
export function convertSectionProperties(properties, targetUnit) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new TypeError('Section properties must be an object.')
  }
  if (typeof targetUnit !== 'string' || !Object.hasOwn(LENGTH_UNITS, targetUnit)) {
    throw new TypeError(`Target unit must be one of: ${Object.keys(LENGTH_UNITS).join(', ')}.`)
  }
  if (typeof properties.unit !== 'string' || !Object.hasOwn(LENGTH_UNITS, properties.unit)) {
    throw new TypeError('Section properties have an unsupported source unit.')
  }

  const ratio = LENGTH_UNITS[properties.unit].millimetres / LENGTH_UNITS[targetUnit].millimetres
  const converted = {
    ...properties,
    unit: targetUnit,
    units: unitsFor(targetUnit),
    A: scaleResultValue(properties.A, ratio ** 2, 'A'),
    perimeter: scaleResultValue(properties.perimeter, ratio, 'perimeter'),
    centroid: {
      x: scaleResultValue(properties.centroid?.x, ratio, 'centroid.x'),
      y: scaleResultValue(properties.centroid?.y, ratio, 'centroid.y'),
    },
    Ix: scaleResultValue(properties.Ix, ratio ** 4, 'Ix'),
    Iy: scaleResultValue(properties.Iy, ratio ** 4, 'Iy'),
    Ixy: scaleResultValue(properties.Ixy, ratio ** 4, 'Ixy'),
    Sx: scalePair(properties.Sx, ratio ** 3, 'Sx'),
    Sy: scalePair(properties.Sy, ratio ** 3, 'Sy'),
    Zx: scalePair(properties.Zx, ratio ** 3, 'Zx'),
    Zy: scalePair(properties.Zy, ratio ** 3, 'Zy'),
    rx: scaleResultValue(properties.rx, ratio, 'rx'),
    ry: scaleResultValue(properties.ry, ratio, 'ry'),
    pna: {
      aboutX: {
        ...properties.pna?.aboutX,
        value: scaleResultValue(properties.pna?.aboutX?.value, ratio, 'pna.aboutX.value'),
      },
      aboutY: {
        ...properties.pna?.aboutY,
        value: scaleResultValue(properties.pna?.aboutY?.value, ratio, 'pna.aboutY.value'),
      },
    },
    principalInertia: {
      ...properties.principalInertia,
      major: scaleResultValue(properties.principalInertia?.major, ratio ** 4, 'principalInertia.major'),
      minor: scaleResultValue(properties.principalInertia?.minor, ratio ** 4, 'principalInertia.minor'),
    },
  }
  return converted
}
