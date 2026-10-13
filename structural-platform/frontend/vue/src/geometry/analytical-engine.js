import { GeometryDefinition } from './definition.js'
import { LENGTH_UNITS } from './schema.js'

function principalAxes(Ix, Iy, Ixy, scale) {
  const mean = Ix / 2 + Iy / 2
  const radius = Math.hypot((Ix - Iy) / 2, Ixy)
  const major = Ixy === 0 ? Math.max(Ix, Iy) : mean + radius
  const minor = Ixy === 0 ? Math.min(Ix, Iy) : mean - radius
  const isotropic = Math.abs(major - minor) <= Number.EPSILON * Math.max(major, Number.MIN_VALUE) * 8
  const majorAngle = isotropic ? null : 0.5 * Math.atan2(-2 * Ixy, Ix - Iy) * 180 / Math.PI
  const normalizeAngle = angle => angle === null ? null : ((angle % 180) + 180) % 180

  return {
    major: major / scale,
    minor: minor / scale,
    majorAxisAngleDeg: normalizeAngle(majorAngle),
    minorAxisAngleDeg: normalizeAngle(majorAngle === null ? null : majorAngle + 90),
    orientationIndeterminate: isotropic,
  }
}

export class GeometryCalculationError extends RangeError {
  constructor(message, code = 'numerical_range') {
    super(message)
    this.name = 'GeometryCalculationError'
    this.code = code
  }
}

function assertFinitePositive(values, message) {
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new GeometryCalculationError(message)
  }
}

function calculateMillimetreProperties(geometry) {
  const factor = LENGTH_UNITS[geometry.unit].millimetres
  const d = Object.fromEntries(Object.entries(geometry.dimensions).map(([key, value]) => [key, value * factor]))
  assertFinitePositive(Object.values(d), 'Geometry dimensions are outside the supported numeric range after unit conversion.')
  let A, perimeter, Ix, Iy, Zx, Zy, width, height

  if (geometry.shape === 'rectangle') {
    ({ b: width, h: height } = d)
    A = width * height
    perimeter = 2 * (width + height)
    Ix = width * height ** 3 / 12
    Iy = height * width ** 3 / 12
    Zx = width * height ** 2 / 4
    Zy = height * width ** 2 / 4
  } else if (geometry.shape === 'circle') {
    const radius = d.D / 2
    width = height = d.D
    A = Math.PI * radius ** 2
    perimeter = Math.PI * d.D
    Ix = Iy = Math.PI * d.D ** 4 / 64
    Zx = Zy = d.D ** 3 / 6
  } else if (geometry.shape === 'circular-tube') {
    const outerDiameter = d.D
    const wallThickness = d.t
    const innerDiameter = outerDiameter - 2 * wallThickness
    assertFinitePositive([innerDiameter], 'Circular-tube inner diameter is outside the supported numeric range.')
    if (innerDiameter >= outerDiameter) {
      throw new GeometryCalculationError('Circular-tube wall thickness is not representable at this diameter.')
    }
    const wallSpan = 2 * wallThickness
    const diameterSum = outerDiameter + innerDiameter
    const diameterSquares = outerDiameter ** 2 + innerDiameter ** 2
    width = height = outerDiameter
    A = Math.PI * wallThickness * (outerDiameter - wallThickness)
    // Total boundary includes both outer and inner circumferences.
    perimeter = Math.PI * diameterSum
    Ix = Iy = Math.PI * wallSpan * diameterSum * diameterSquares / 64
    Zx = Zy = wallSpan * (outerDiameter ** 2 + outerDiameter * innerDiameter + innerDiameter ** 2) / 6
  } else if (geometry.shape === 'rectangular-tube') {
    const { b: outerWidth, h: outerHeight, t: wallThickness } = d
    const innerWidth = outerWidth - 2 * wallThickness
    const innerHeight = outerHeight - 2 * wallThickness
    assertFinitePositive([innerWidth, innerHeight], 'Rectangular-tube inner dimensions are outside the supported numeric range.')
    if (innerWidth >= outerWidth || innerHeight >= outerHeight) {
      throw new GeometryCalculationError('Rectangular-tube wall thickness is not representable at these outer dimensions.')
    }
    width = outerWidth
    height = outerHeight
    A = 2 * wallThickness * (outerWidth + outerHeight - 2 * wallThickness)
    // Include both the outside and inside contour perimeters.
    perimeter = 2 * (outerWidth + outerHeight) + 2 * (innerWidth + innerHeight)
    // Composite plates avoid subtracting nearly equal outer and inner inertias.
    Ix = 2 * (
      outerWidth * wallThickness ** 3 / 12
      + outerWidth * wallThickness * ((outerHeight - wallThickness) / 2) ** 2
    ) + 2 * wallThickness * innerHeight ** 3 / 12
    Iy = 2 * (
      outerHeight * wallThickness ** 3 / 12
      + outerHeight * wallThickness * ((outerWidth - wallThickness) / 2) ** 2
    ) + 2 * wallThickness * innerWidth ** 3 / 12
    Zx = outerWidth * wallThickness * (outerHeight - wallThickness) + wallThickness * innerHeight ** 2 / 2
    Zy = outerHeight * wallThickness * (outerWidth - wallThickness) + wallThickness * innerWidth ** 2 / 2
  } else {
    ({ b: width, h: height } = d)
    const { tw, tf } = d
    const webHeight = height - 2 * tf
    assertFinitePositive([webHeight], 'I/H web depth is outside the supported numeric range after unit conversion.')
    A = 2 * width * tf + tw * webHeight
    perimeter = 4 * width - 2 * tw + 2 * height
    Ix = 2 * (width * tf ** 3 / 12 + width * tf * ((height - tf) / 2) ** 2) + tw * webHeight ** 3 / 12
    Iy = 2 * (tf * width ** 3 / 12) + webHeight * tw ** 3 / 12
    Zx = width * tf * (height - tf) + tw * (height / 2 - tf) ** 2
    Zy = (2 * tf * width ** 2 + webHeight * tw ** 2) / 4
  }

  const cx = width / 2
  const cy = height / 2
  const Ixy = 0
  assertFinitePositive([A, perimeter, Ix, Iy, Zx, Zy, width, height, cx, cy], 'Calculated geometry properties are outside the supported numeric range.')
  return { A, perimeter, Ix, Iy, Ixy, Zx, Zy, width, height, cx, cy }
}

function unitsFor(unit) {
  return {
    length: unit,
    area: `${unit}²`,
    secondMoment: `${unit}⁴`,
    sectionModulus: `${unit}³`,
  }
}

/** Calculate gross, homogeneous properties for solid and hollow rectangles/circles and symmetric sharp-corner I/H sections. */
export function calculateSectionProperties(input) {
  const geometry = input instanceof GeometryDefinition ? input : new GeometryDefinition(input)
  const factor = LENGTH_UNITS[geometry.unit].millimetres
  const raw = calculateMillimetreProperties(geometry)
  const scale = {
    length: factor,
    area: factor ** 2,
    secondMoment: factor ** 4,
    sectionModulus: factor ** 3,
  }
  const { A, perimeter, Ix, Iy, Ixy, Zx, Zy, width, height, cx, cy } = raw
  const sxPositive = Ix / (height - cy)
  const sxNegative = Ix / cy
  const syPositive = Iy / (width - cx)
  const syNegative = Iy / cx
  const unit = geometry.unit
  const output = {
    A: A / scale.area,
    perimeter: perimeter / scale.length,
    centroid: { x: cx / factor, y: cy / factor },
    Ix: Ix / scale.secondMoment,
    Iy: Iy / scale.secondMoment,
    Sx: { positive: sxPositive / scale.sectionModulus, negative: sxNegative / scale.sectionModulus },
    Sy: { positive: syPositive / scale.sectionModulus, negative: syNegative / scale.sectionModulus },
    Zx: { positive: Zx / scale.sectionModulus, negative: Zx / scale.sectionModulus },
    Zy: { positive: Zy / scale.sectionModulus, negative: Zy / scale.sectionModulus },
    rx: Math.sqrt(Ix / A) / factor,
    ry: Math.sqrt(Iy / A) / factor,
    pna: { aboutX: cy / factor, aboutY: cx / factor },
    principalInertia: principalAxes(Ix, Iy, Ixy, scale.secondMoment),
  }
  assertFinitePositive([
    output.A, output.perimeter, output.centroid.x, output.centroid.y, output.Ix, output.Iy,
    output.Sx.positive, output.Sx.negative, output.Sy.positive, output.Sy.negative,
    output.Zx.positive, output.Zx.negative, output.Zy.positive, output.Zy.negative,
    output.rx, output.ry, output.pna.aboutX, output.pna.aboutY,
    output.principalInertia.major, output.principalInertia.minor,
  ], 'Calculated results are outside the supported numeric range for the selected unit.')

  return {
    schemaVersion: 1,
    shape: geometry.shape,
    unit,
    units: unitsFor(unit),
    A: output.A,
    perimeter: output.perimeter,
    centroid: output.centroid,
    Ix: output.Ix,
    Iy: output.Iy,
    Ixy: Ixy / scale.secondMoment,
    Sx: output.Sx,
    Sy: output.Sy,
    Zx: output.Zx,
    Zy: output.Zy,
    rx: output.rx,
    ry: output.ry,
    pna: {
      aboutX: { orientation: 'horizontal', coordinate: 'y', value: output.pna.aboutX },
      aboutY: { orientation: 'vertical', coordinate: 'x', value: output.pna.aboutY },
    },
    principalInertia: output.principalInertia,
  }
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
