/**
 * Geometry-only strength-of-materials primitives derived from a canonical
 * section result.  This module deliberately contains no design-code rules.
 *
 * The reported principal major-axis angle is the direction of the axis about
 * which the larger second moment acts.  Its perpendicular coordinate is v;
 * the minor axis is v and its perpendicular coordinate is u.  Extreme
 * negative coordinates are signed (and therefore negative), while the
 * section moduli use their absolute distances from the centroid.
 */

type Point = { x: number; y: number }
type Rectangle = { x: number; y: number; width: number; height: number }
type PolygonPoint = { q: number; p: number }
type PolygonStats = { area: number; firstMoment: number }
type MomentKey = `${number},${number}`

export type PrincipalMechanicsAxis = {
  axis_angle_degrees: number
  bending_coordinate: 'u' | 'v'
  inertia_mm4: number
  extreme_positive_mm: number
  extreme_negative_mm: number
  elastic_modulus_positive_mm3: number
  elastic_modulus_negative_mm3: number
  radius_mm: number
  plastic_neutral_coordinate_mm: number | null
  plastic_modulus_mm3: number | null
  plastic_status: 'computed' | 'not_requested'
}

export type ThirdMoments = {
  m30_mm5: number
  m21_mm5: number
  m12_mm5: number
  m03_mm5: number
}

export type MechanicsGeometry = {
  representation: {
    kind: 'rectangle' | 'circle' | 'annulus' | 'rectangular_components'
    geometry_type: string
    units: 'mm'
    coordinate_system: { origin: 'bounding_box_lower_left'; x: 'right'; y: 'up' }
    bounding_box_mm: { width: number; height: number }
    centroid_mm: { x: number; y: number }
    area_mm2: number
    integration_primitives:
      | Array<{ kind: 'rectangle'; x_min_mm: number; y_min_mm: number; width_mm: number; height_mm: number }>
      | { kind: 'circle'; center_x_mm: number; center_y_mm: number; radius_mm: number }
      | { kind: 'annulus'; center_x_mm: number; center_y_mm: number; outer_radius_mm: number; inner_radius_mm: number }
  }
  polar_centroidal: { inertia_mm4: number; radius_mm: number }
  coupled_bending: {
    mx: { elastic_modulus_positive_mm3: number; elastic_modulus_negative_mm3: number }
    my: { elastic_modulus_positive_mm3: number; elastic_modulus_negative_mm3: number }
  }
  principal: {
    basis_angle_degrees: number
    basis_unique: boolean
    major: PrincipalMechanicsAxis
    minor: PrincipalMechanicsAxis
  }
  third_moments: ThirdMoments
  third_moments_principal: ThirdMoments
}

export class MechanicsGeometryError extends RangeError {
  constructor(message: string) {
    super(message)
    this.name = 'MechanicsGeometryError'
  }
}

function record(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Mechanics geometry requires a finite ${label}.`)
  }
  return value
}

function positive(value: unknown, label: string): number {
  const result = finite(value, label)
  if (result <= 0) throw new TypeError(`Mechanics geometry requires a positive ${label}.`)
  return result
}

function safeValue(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`)
  return value
}

function scaled(value: number, scale: number, power: number, label: string): number {
  if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} is not finite before unit scaling.`)
  if (value === 0) return 0
  let output = value
  for (let i = 0; i < power; i++) {
    output *= scale
    if (!Number.isFinite(output)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`)
    if (output === 0) throw new MechanicsGeometryError(`${label} underflows the finite numeric range.`)
  }
  return output
}

function unscaled(value: number, scale: number, power: number, label: string): number {
  if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} is not finite before normalization.`)
  if (value === 0) return 0
  let output = value
  for (let i = 0; i < power; i++) {
    output /= scale
    if (!Number.isFinite(output)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`)
    if (output === 0) throw new MechanicsGeometryError(`${label} underflows the finite numeric range.`)
  }
  return output
}

function closeEnough(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new MechanicsGeometryError(`${label} cannot be checked because a normalized value is nonfinite.`)
  }
  if (actual === expected) return
  const magnitude = Math.max(Math.abs(actual), Math.abs(expected))
  if (magnitude === 0 || Math.abs(actual - expected) > 2048 * Number.EPSILON * magnitude) {
    throw new MechanicsGeometryError(`${label} does not match the canonical gross property.`)
  }
}

function canonicalGross(result: Record<string, any>): {
  area: number; centroidX: number; centroidY: number; ix: number; iy: number; ixy: number;
  iMajor: number; iMinor: number; basisAngle: number; basisUnique: boolean
} {
  const properties = result.properties
  if (!record(properties?.geometric) || !record(properties?.elastic) || !record(properties?.principal)) {
    throw new TypeError('Canonical geometric, elastic, and principal properties are required.')
  }
  const geometric = properties.geometric
  const elastic = properties.elastic
  const principal = properties.principal
  const area = positive(geometric.area, 'canonical area')
  const centroidX = finite(geometric.centroid_x, 'canonical x centroid')
  const centroidY = finite(geometric.centroid_y, 'canonical y centroid')
  const ix = positive(elastic.ix, 'canonical Ix')
  const iy = positive(elastic.iy, 'canonical Iy')
  const ixy = finite(elastic.ixy, 'canonical Ixy')
  const iMajor = positive(principal.i_major, 'canonical major principal inertia')
  const iMinor = positive(principal.i_minor, 'canonical minor principal inertia')
  const orientation = principal.orientation_status
  if (orientation !== 'determinate' && orientation !== 'indeterminate') {
    throw new TypeError('Canonical principal orientation status must be determinate or indeterminate.')
  }
  const angle = orientation === 'determinate'
    ? finite(principal.major_axis_angle_degrees, 'canonical principal angle')
    : 0
  if (orientation === 'determinate' && (angle < 0 || angle >= 180)) {
    throw new TypeError('Canonical principal angle must be in [0, 180) degrees.')
  }
  return { area, centroidX, centroidY, ix, iy, ixy, iMajor, iMinor, basisAngle: angle, basisUnique: orientation === 'determinate' }
}

function compensatedSum(values: number[], label: string): number {
  let sum = 0
  let correction = 0
  for (const value of values) {
    if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} contains a nonfinite integration term.`)
    const updated = sum + value
    correction += Math.abs(sum) >= Math.abs(value) ? (sum - updated) + value : (value - updated) + sum
    sum = updated
    if (!Number.isFinite(sum) || !Number.isFinite(correction)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`)
  }
  return safeValue(sum + correction, label)
}

function normalizedDimension(value: number, scale: number, label: string): number {
  const result = value / scale
  if (!Number.isFinite(result) || result <= 0) {
    throw new MechanicsGeometryError(`${label} is not representable after geometry normalization.`)
  }
  return result
}

function rectangleIntegral1D(offset: number, span: number, power: number): number {
  let value: number
  if (power === 0) value = span
  else if (power === 1) value = span * offset
  else if (power === 2) value = span * (offset * offset + span * span / 12)
  else if (power === 3) value = span * (offset * offset * offset + offset * span * span / 4)
  else throw new RangeError('Only moments through total order three are supported.')
  const mathematicallyNonzero = power === 0 || (power === 1 || power === 3) && offset !== 0 || power === 2 && span !== 0
  if (value === 0 && mathematicallyNonzero) throw new MechanicsGeometryError('A normalized rectangle moment underflows the finite numeric range.')
  return safeValue(value, 'normalized rectangle moment')
}

function rectMoment(rectangles: Rectangle[], cx: number, cy: number, scale: number, px: number, py: number): number {
  return compensatedSum(rectangles.map((rectangle) => {
    const width = normalizedDimension(rectangle.width, scale, 'component width')
    const height = normalizedDimension(rectangle.height, scale, 'component height')
    const dx = (rectangle.x + rectangle.width / 2) / scale - cx
    const dy = (rectangle.y + rectangle.height / 2) / scale - cy
    const xMoment = rectangleIntegral1D(dx, width, px)
    const yMoment = rectangleIntegral1D(dy, height, py)
    const term = xMoment * yMoment
    if (term === 0 && xMoment !== 0 && yMoment !== 0) throw new MechanicsGeometryError('A normalized component moment underflows the finite numeric range.')
    return safeValue(term, `component moment M${px}${py}`)
  }), `centroidal moment M${px}${py}`)
}

function momentKey(px: number, py: number): MomentKey { return `${px},${py}` }

function transformedMoment(moments: Map<MomentKey, number>, px: number, py: number, cosine: number, sine: number): number {
  let terms = new Map<MomentKey, number>([[momentKey(0, 0), 1]])
  const multiply = (xCoefficient: number, yCoefficient: number) => {
    const next = new Map<MomentKey, number>()
    for (const [key, coefficient] of terms) {
      const [xPower, yPower] = key.split(',').map(Number)
      const xKey = momentKey(xPower + 1, yPower)
      const yKey = momentKey(xPower, yPower + 1)
      next.set(xKey, (next.get(xKey) ?? 0) + coefficient * xCoefficient)
      next.set(yKey, (next.get(yKey) ?? 0) + coefficient * yCoefficient)
    }
    terms = next
  }
  for (let i = 0; i < px; i++) multiply(cosine, sine)       // u = c x + s y
  for (let i = 0; i < py; i++) multiply(-sine, cosine)      // v = -s x + c y
  return compensatedSum(Array.from(terms, ([key, coefficient]) => coefficient * (moments.get(key) ?? 0)), `principal moment M${px}${py}`)
}

function rectanglePolygons(rectangles: Rectangle[], cx: number, cy: number, scale: number, cosine: number, sine: number, axis: 'major' | 'minor'): PolygonPoint[][] {
  return rectangles.map((rectangle) => {
    const x0 = rectangle.x / scale - cx, x1 = (rectangle.x + rectangle.width) / scale - cx
    const y0 = rectangle.y / scale - cy, y1 = (rectangle.y + rectangle.height) / scale - cy
    const points: Point[] = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
    return points.map(({ x, y }) => axis === 'major'
      ? { q: -sine * x + cosine * y, p: cosine * x + sine * y }
      : { q: cosine * x + sine * y, p: -sine * x + cosine * y })
  })
}

function polygonStats(polygon: PolygonPoint[]): PolygonStats {
  if (polygon.length < 3) return { area: 0, firstMoment: 0 }
  const crosses = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return point.q * next.p - next.q * point.p
  })
  const twiceArea = compensatedSum(crosses, 'clipped polygon area')
  if (twiceArea === 0) return { area: 0, firstMoment: 0 }
  const signedArea = twiceArea / 2
  const centroidNumerator = compensatedSum(polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return (point.q + next.q) * crosses[index]
  }), 'clipped polygon first moment')
  const centroidQ = centroidNumerator / (6 * signedArea)
  return { area: Math.abs(signedArea), firstMoment: Math.abs(signedArea) * centroidQ }
}

function clipPolygon(polygon: PolygonPoint[], cut: number, keepBelow: boolean): PolygonPoint[] {
  if (polygon.length === 0) return []
  const output: PolygonPoint[] = []
  const inside = (point: PolygonPoint) => keepBelow ? point.q <= cut : point.q >= cut
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i]
    const previous = polygon[(i + polygon.length - 1) % polygon.length]
    const currentInside = inside(current), previousInside = inside(previous)
    if (currentInside !== previousInside) {
      const denominator = current.q - previous.q
      const fraction = (cut - previous.q) / denominator
      output.push({ q: cut, p: previous.p + fraction * (current.p - previous.p) })
    }
    if (currentInside) output.push(current)
  }
  return output
}

function clippedStats(polygons: PolygonPoint[][], cut: number, keepBelow: boolean): PolygonStats {
  const stats = polygons.map((polygon) => polygonStats(clipPolygon(polygon, cut, keepBelow)))
  return {
    area: compensatedSum(stats.map((item) => item.area), 'clipped section area'),
    firstMoment: compensatedSum(stats.map((item) => item.firstMoment), 'clipped section first moment'),
  }
}

function polygonExtremes(polygons: PolygonPoint[][]): { minimum: number; maximum: number } {
  const values = polygons.flatMap((polygon) => polygon.map((point) => point.q))
  if (values.length === 0 || !values.every(Number.isFinite)) throw new MechanicsGeometryError('Principal-axis boundary coordinates are not finite.')
  return { minimum: Math.min(...values), maximum: Math.max(...values) }
}

function coupledBending(
  ix: number,
  iy: number,
  ixy: number,
  scale: number,
  points: Point[] | null,
  circularRadius: number | null,
): MechanicsGeometry['coupled_bending'] {
  const determinant = ix * iy - ixy * ixy
  if (!Number.isFinite(determinant) || determinant <= 0) {
    throw new MechanicsGeometryError('Normalized inertia determinant is not positive and finite.')
  }
  const mxGradient = { x: -ixy / determinant, y: iy / determinant }
  const myGradient = { x: ix / determinant, y: -ixy / determinant }
  const values = (gradient: Point) => {
    if (circularRadius !== null) {
      const maximum = circularRadius * Math.hypot(gradient.x, gradient.y)
      return { minimum: -maximum, maximum }
    }
    if (!points || points.length === 0) throw new MechanicsGeometryError('Material boundary points are required for coupled bending.')
    const responses = points.map((point) => gradient.x * point.x + gradient.y * point.y)
    if (!responses.every(Number.isFinite)) throw new MechanicsGeometryError('Coupled-bending response exceeds the finite numeric range.')
    return { minimum: Math.min(...responses), maximum: Math.max(...responses) }
  }
  const modulus = (gradient: Point, label: string) => {
    const extremes = values(gradient)
    if (extremes.maximum <= 0 || extremes.minimum >= 0) {
      throw new MechanicsGeometryError(`${label} centroid does not lie inside its material boundary.`)
    }
    return {
      elastic_modulus_positive_mm3: scaled(1 / extremes.maximum, scale, 3, `${label} positive elastic modulus`),
      elastic_modulus_negative_mm3: scaled(1 / -extremes.minimum, scale, 3, `${label} negative elastic modulus`),
    }
  }
  return { mx: modulus(mxGradient, 'Mx coupled bending'), my: modulus(myGradient, 'My coupled bending') }
}

function polygonPlasticProperties(polygons: PolygonPoint[][], area: number, label: string): { pna: number; modulus: number; minimum: number; maximum: number } {
  const { minimum, maximum } = polygonExtremes(polygons)
  let lower = minimum, upper = maximum
  for (let iteration = 0; iteration < 128; iteration++) {
    const middle = lower + (upper - lower) / 2
    if (middle === lower || middle === upper) break
    const below = clippedStats(polygons, middle, true).area
    if (below < area / 2) lower = middle
    else upper = middle
  }
  const pna = lower + (upper - lower) / 2
  if (!Number.isFinite(pna)) throw new MechanicsGeometryError(`${label} plastic neutral coordinate is not finite.`)
  return polygonPlasticPropertiesAt(polygons, pna, label)
}

function polygonPlasticPropertiesAt(polygons: PolygonPoint[][], pna: number, label: string): { pna: number; modulus: number; minimum: number; maximum: number } {
  const { minimum, maximum } = polygonExtremes(polygons)
  const below = clippedStats(polygons, pna, true)
  const above = clippedStats(polygons, pna, false)
  const modulus = compensatedSum([
    pna * below.area - below.firstMoment,
    above.firstMoment - pna * above.area,
  ], `${label} plastic modulus`)
  if (!Number.isFinite(modulus) || modulus <= 0) throw new MechanicsGeometryError(`${label} plastic modulus is not positive and finite.`)
  return { pna, modulus, minimum, maximum }
}

function axisResult(
  axis: 'major' | 'minor',
  polygons: PolygonPoint[][],
  scale: number,
  canonicalArea: number,
  canonicalInertia: number,
  angle: number,
  label: string,
  includePlastic: boolean,
  areaNormalized: number,
  exactPnaAtCentroid = false,
): PrincipalMechanicsAxis {
  const { minimum, maximum } = polygonExtremes(polygons)
  const plastic = includePlastic
    ? exactPnaAtCentroid
      ? polygonPlasticPropertiesAt(polygons, 0, label)
      : polygonPlasticProperties(polygons, areaNormalized, label)
    : null
  const positiveExtreme = maximum
  const negativeExtreme = minimum
  if (positiveExtreme <= 0 || negativeExtreme >= 0) throw new MechanicsGeometryError(`${label} centroid does not lie inside its section boundary.`)
  const positiveDistance = scaled(positiveExtreme, scale, 1, `${label} positive extreme`)
  const negativeDistance = scaled(-negativeExtreme, scale, 1, `${label} negative extreme`)
  const elasticPositive = canonicalInertia / positiveDistance
  const elasticNegative = canonicalInertia / negativeDistance
  if (![elasticPositive, elasticNegative].every((value) => Number.isFinite(value) && value > 0)) {
    throw new MechanicsGeometryError(`${label} elastic section modulus is outside the finite numeric range.`)
  }
  return {
    axis_angle_degrees: angle,
    bending_coordinate: axis === 'major' ? 'v' : 'u',
    inertia_mm4: canonicalInertia,
    extreme_positive_mm: positiveDistance,
    extreme_negative_mm: -negativeDistance,
    elastic_modulus_positive_mm3: elasticPositive,
    elastic_modulus_negative_mm3: elasticNegative,
    radius_mm: safeValue(Math.sqrt(canonicalInertia / canonicalArea), `${label} radius of gyration`),
    plastic_neutral_coordinate_mm: plastic === null ? null : scaled(plastic.pna, scale, 1, `${label} plastic neutral coordinate`),
    plastic_modulus_mm3: plastic === null ? null : scaled(plastic.modulus, scale, 3, `${label} plastic modulus`),
    plastic_status: plastic === null ? 'not_requested' : 'computed',
  }
}

function normalizedAngle(degrees: number): number {
  const angle = ((degrees % 180) + 180) % 180
  return angle === 180 ? 0 : angle
}

/** Exact reflection symmetries; these are algebraic identities, not tolerances. */
function reflectionSymmetries(type: string, dimensions: Record<string, number>): { x: boolean; y: boolean } {
  if (type === 'rectangle' || type === 'rectangular_hollow') return { x: true, y: true }
  if (type === 'i_section') {
    return {
      x: true,
      y: dimensions.top_flange_width === dimensions.bottom_flange_width
        && dimensions.top_flange_thickness === dimensions.bottom_flange_thickness,
    }
  }
  if (type === 'channel') return { x: false, y: true }
  if (type === 'tee' || type === 'double_angle') return { x: true, y: false }
  return { x: false, y: false }
}

function pnaIsExactlyCentroid(type: string, dimensions: Record<string, number>, axis: 'major' | 'minor', angle: number): boolean {
  const symmetry = reflectionSymmetries(type, dimensions)
  if (symmetry.x && symmetry.y) return true
  if (angle === 0) return axis === 'major' ? symmetry.y : symmetry.x
  if (angle === 90) return axis === 'major' ? symmetry.x : symmetry.y
  return false
}

function geometryBox(type: string, dimensions: Record<string, number>, componentRects?: Rectangle[]): { width: number; height: number } {
  if (type === 'rectangle') return { width: positive(dimensions.width, 'width'), height: positive(dimensions.height, 'height') }
  if (type === 'circle' || type === 'circular_hollow') {
    const diameter = positive(dimensions.diameter, 'diameter')
    return { width: diameter, height: diameter }
  }
  const height = positive(type === 'rectangular_hollow' ? dimensions.height : dimensions.depth, 'section height')
  const width = type === 'i_section'
    ? Math.max(positive(dimensions.top_flange_width, 'top flange width'), positive(dimensions.bottom_flange_width, 'bottom flange width'))
    : type === 'double_angle'
      ? 2 * positive(dimensions.width, 'angle width') + (() => {
        const gap = finite(dimensions.distance, 'clear angle distance')
        if (gap < 0) throw new TypeError('Double-angle clear distance cannot be negative.')
        return gap
      })()
      : positive(dimensions.width, 'section width')
  if (componentRects?.length) return { width, height }
  throw new TypeError(`Rectangular material components are required for ${type}.`)
}

function readRectangles(result: Record<string, any>, type: string, dimensions: Record<string, number>): Rectangle[] {
  if (type === 'rectangle') {
    return [{ x: 0, y: 0, width: positive(dimensions.width, 'width'), height: positive(dimensions.height, 'height') }]
  }
  const source = result.diagnostics?.components
  if (!Array.isArray(source) || source.length === 0) throw new TypeError(`Calculation result has no rectangular material components for ${type}.`)
  return source.map((part: unknown, index: number) => {
    if (!record(part)) throw new TypeError(`Component ${index} is not a rectangle record.`)
    const x = finite(part.x, `component ${index} x coordinate`)
    const y = finite(part.y, `component ${index} y coordinate`)
    if (x < 0 || y < 0) throw new TypeError(`Component ${index} must be inside the lower-left bounding box.`)
    return {
      x,
      y,
      width: positive(part.width, `component ${index} width`),
      height: positive(part.height, `component ${index} height`),
    }
  })
}

/** Calculate centroidal polar, principal, elastic, plastic and third moments. */
export function calculateGeometryMechanics(result: any): MechanicsGeometry {
  if (!record(result) || !record(result.normalized_input) || !record(result.normalized_input.geometry)) {
    throw new TypeError('A canonical section result with normalized geometry is required.')
  }
  const geometry = result.normalized_input.geometry as Record<string, any>
  const type = geometry.type
  if (typeof type !== 'string' || !record(geometry.dimensions)) throw new TypeError('Canonical geometry type and dimensions are required.')
  if (result.normalized_input.units !== 'mm') throw new TypeError('Mechanics geometry requires canonical millimetre inputs.')
  const dimensions = geometry.dimensions as Record<string, number>
  const gross = canonicalGross(result)
  const includePlastic = result.normalized_input.options?.include_plastic !== false

  if (type === 'circle' || type === 'circular_hollow') {
    const diameter = positive(dimensions.diameter, 'diameter')
    const scale = diameter
    const outerRadius = 0.5
    const innerRadius = type === 'circle' ? 0 : 0.5 - positive(dimensions.thickness, 'wall thickness') / scale
    if (innerRadius < 0 || (type === 'circular_hollow' && !(innerRadius > 0 && innerRadius < outerRadius))) {
      throw new TypeError('Circular hollow geometry requires a representable positive inner radius.')
    }
    const area = Math.PI * (outerRadius - innerRadius) * (outerRadius + innerRadius)
    const inertia = area * (outerRadius * outerRadius + innerRadius * innerRadius) / 4
    if (![area, inertia].every((value) => Number.isFinite(value) && value > 0)) {
      throw new MechanicsGeometryError('Circular integration properties are outside the finite numeric range.')
    }
    closeEnough(unscaled(gross.area, scale, 2, 'canonical area'), area, 'Circular analytic area')
    closeEnough(unscaled(gross.centroidX, scale, 1, 'canonical x centroid'), 0.5, 'Circular x centroid')
    closeEnough(unscaled(gross.centroidY, scale, 1, 'canonical y centroid'), 0.5, 'Circular y centroid')
    closeEnough(unscaled(gross.ix, scale, 4, 'canonical Ix'), inertia, 'Circular analytic Ix')
    closeEnough(unscaled(gross.iy, scale, 4, 'canonical Iy'), inertia, 'Circular analytic Iy')
    closeEnough(unscaled(gross.ixy, scale, 4, 'canonical Ixy'), 0, 'Circular analytic Ixy')
    closeEnough(unscaled(gross.iMajor, scale, 4, 'canonical major inertia'), inertia, 'Circular analytic major inertia')
    closeEnough(unscaled(gross.iMinor, scale, 4, 'canonical minor inertia'), inertia, 'Circular analytic minor inertia')
    if (gross.basisUnique) throw new MechanicsGeometryError('Circular sections must have an indeterminate principal orientation.')
    const centerX = gross.centroidX, centerY = gross.centroidY
    const plasticModulus = 4 / 3 * (outerRadius ** 3 - innerRadius ** 3)
    const axis = (axisName: 'major' | 'minor'): PrincipalMechanicsAxis => {
      const inertiaMm4 = axisName === 'major' ? gross.iMajor : gross.iMinor
      const extentMm = scaled(outerRadius, scale, 1, `${axisName} extreme`)
      return {
        axis_angle_degrees: axisName === 'major' ? 0 : 90,
        bending_coordinate: axisName === 'major' ? 'v' : 'u',
        inertia_mm4: inertiaMm4,
        extreme_positive_mm: extentMm,
        extreme_negative_mm: -extentMm,
        elastic_modulus_positive_mm3: safeValue(inertiaMm4 / extentMm, `${axisName} positive elastic modulus`),
        elastic_modulus_negative_mm3: safeValue(inertiaMm4 / extentMm, `${axisName} negative elastic modulus`),
        radius_mm: safeValue(Math.sqrt(inertiaMm4 / gross.area), `${axisName} radius of gyration`),
        plastic_neutral_coordinate_mm: includePlastic ? 0 : null,
        plastic_modulus_mm3: includePlastic ? scaled(plasticModulus, scale, 3, `${axisName} plastic modulus`) : null,
        plastic_status: includePlastic ? 'computed' : 'not_requested',
      }
    }
    const representation = type === 'circle'
      ? { kind: 'circle' as const, geometry_type: type, units: 'mm' as const, coordinate_system: { origin: 'bounding_box_lower_left' as const, x: 'right' as const, y: 'up' as const }, bounding_box_mm: { width: diameter, height: diameter }, centroid_mm: { x: centerX, y: centerY }, area_mm2: gross.area, integration_primitives: { kind: 'circle' as const, center_x_mm: centerX, center_y_mm: centerY, radius_mm: centerX } }
      : { kind: 'annulus' as const, geometry_type: type, units: 'mm' as const, coordinate_system: { origin: 'bounding_box_lower_left' as const, x: 'right' as const, y: 'up' as const }, bounding_box_mm: { width: diameter, height: diameter }, centroid_mm: { x: centerX, y: centerY }, area_mm2: gross.area, integration_primitives: { kind: 'annulus' as const, center_x_mm: centerX, center_y_mm: centerY, outer_radius_mm: centerX, inner_radius_mm: scaled(innerRadius, scale, 1, 'inner radius') } }
    return {
      representation,
      polar_centroidal: {
        inertia_mm4: safeValue(gross.ix + gross.iy, 'polar inertia'),
        radius_mm: safeValue(Math.sqrt((gross.ix + gross.iy) / gross.area), 'polar radius of gyration'),
      },
      coupled_bending: coupledBending(
        unscaled(gross.ix, scale, 4, 'canonical Ix'),
        unscaled(gross.iy, scale, 4, 'canonical Iy'),
        unscaled(gross.ixy, scale, 4, 'canonical Ixy'),
        scale,
        null,
        outerRadius,
      ),
      principal: { basis_angle_degrees: 0, basis_unique: false, major: axis('major'), minor: axis('minor') },
      third_moments: { m30_mm5: 0, m21_mm5: 0, m12_mm5: 0, m03_mm5: 0 },
      third_moments_principal: { m30_mm5: 0, m21_mm5: 0, m12_mm5: 0, m03_mm5: 0 },
    }
  }

  const rectangles = readRectangles(result, type, dimensions)
  const box = geometryBox(type, dimensions, rectangles)
  const scale = Math.max(box.width, box.height)
  positive(scale, 'normalization length')
  const canonicalArea = unscaled(gross.area, scale, 2, 'canonical area')
  const cx = unscaled(gross.centroidX, scale, 1, 'canonical x centroid')
  const cy = unscaled(gross.centroidY, scale, 1, 'canonical y centroid')
  const centroidX = compensatedSum(rectangles.map((rectangle) => {
    const width = normalizedDimension(rectangle.width, scale, 'component width')
    const height = normalizedDimension(rectangle.height, scale, 'component height')
    const areaTerm = width * height
    if (areaTerm === 0) throw new MechanicsGeometryError('A normalized component area underflows the finite numeric range.')
    const term = areaTerm * ((rectangle.x + rectangle.width / 2) / scale)
    if (term === 0 && rectangle.x + rectangle.width / 2 !== 0) throw new MechanicsGeometryError('A normalized first area moment underflows the finite numeric range.')
    return safeValue(term, 'normalized first area moment x')
  }), 'first area moment x')
  const centroidY = compensatedSum(rectangles.map((rectangle) => {
    const width = normalizedDimension(rectangle.width, scale, 'component width')
    const height = normalizedDimension(rectangle.height, scale, 'component height')
    const areaTerm = width * height
    if (areaTerm === 0) throw new MechanicsGeometryError('A normalized component area underflows the finite numeric range.')
    const term = areaTerm * ((rectangle.y + rectangle.height / 2) / scale)
    if (term === 0 && rectangle.y + rectangle.height / 2 !== 0) throw new MechanicsGeometryError('A normalized first area moment underflows the finite numeric range.')
    return safeValue(term, 'normalized first area moment y')
  }), 'first area moment y')
  const area = compensatedSum(rectangles.map((rectangle) => {
    const width = normalizedDimension(rectangle.width, scale, 'component width')
    const height = normalizedDimension(rectangle.height, scale, 'component height')
    const value = width * height
    if (value === 0) throw new MechanicsGeometryError('A normalized component area underflows the finite numeric range.')
    return safeValue(value, 'normalized component area')
  }),
  'section area')
  if (!Number.isFinite(area) || area <= 0) throw new MechanicsGeometryError('Normalized material area is not positive and finite.')
  closeEnough(area, canonicalArea, 'Component area')
  closeEnough(centroidX / area, cx, 'Component x centroid')
  closeEnough(centroidY / area, cy, 'Component y centroid')
  const moments = new Map<MomentKey, number>()
  for (let totalPower = 0; totalPower <= 3; totalPower++) {
    for (let px = 0; px <= totalPower; px++) {
      const py = totalPower - px
      moments.set(momentKey(px, py), rectMoment(rectangles, cx, cy, scale, px, py))
    }
  }
  const symmetry = reflectionSymmetries(type, dimensions)
  if (symmetry.x || symmetry.y) moments.set(momentKey(1, 1), 0)
  if (symmetry.x) {
    moments.set(momentKey(3, 0), 0)
    moments.set(momentKey(1, 2), 0)
  }
  if (symmetry.y) {
    moments.set(momentKey(2, 1), 0)
    moments.set(momentKey(0, 3), 0)
  }
  const ix = moments.get(momentKey(0, 2))!
  const iy = moments.get(momentKey(2, 0))!
  const ixy = moments.get(momentKey(1, 1))!
  if (![ix, iy].every((value) => Number.isFinite(value) && value > 0) || !Number.isFinite(ixy)) {
    throw new MechanicsGeometryError('Normalized centroidal inertias are not finite and positive.')
  }
  const canonicalIx = unscaled(gross.ix, scale, 4, 'canonical Ix')
  const canonicalIy = unscaled(gross.iy, scale, 4, 'canonical Iy')
  const canonicalIxy = unscaled(gross.ixy, scale, 4, 'canonical Ixy')
  closeEnough(ix, canonicalIx, 'Component Ix')
  closeEnough(iy, canonicalIy, 'Component Iy')
  closeEnough(ixy, canonicalIxy, 'Component Ixy')
  const mean = ix / 2 + iy / 2
  const radius = Math.hypot(ix / 2 - iy / 2, ixy)
  const majorInertia = mean + radius
  const determinant = ix * iy - ixy * ixy
  const minorInertia = determinant / majorInertia
  if (![majorInertia, minorInertia].every((value) => Number.isFinite(value) && value > 0)) {
    throw new MechanicsGeometryError('Normalized principal inertias are outside the finite numeric range.')
  }
  const canonicalMajor = unscaled(gross.iMajor, scale, 4, 'canonical major inertia')
  const canonicalMinor = unscaled(gross.iMinor, scale, 4, 'canonical minor inertia')
  closeEnough(majorInertia, canonicalMajor, 'Component major principal inertia')
  closeEnough(minorInertia, canonicalMinor, 'Component minor principal inertia')
  const basisUnique = gross.basisUnique
  const basisAngle = gross.basisAngle
  const radians = basisAngle * Math.PI / 180
  const cosine = Math.cos(radians), sine = Math.sin(radians)
  const majorPolygons = rectanglePolygons(rectangles, cx, cy, scale, cosine, sine, 'major')
  const minorPolygons = rectanglePolygons(rectangles, cx, cy, scale, cosine, sine, 'minor')
  const major = axisResult('major', majorPolygons, scale, gross.area, gross.iMajor, basisAngle, 'Principal major axis', includePlastic, canonicalArea, pnaIsExactlyCentroid(type, dimensions, 'major', basisAngle))
  const minorAngle = normalizedAngle(basisAngle + 90)
  const minor = axisResult('minor', minorPolygons, scale, gross.area, gross.iMinor, minorAngle, 'Principal minor axis', includePlastic, canonicalArea, pnaIsExactlyCentroid(type, dimensions, 'minor', basisAngle))
  const polarInertia = gross.ix + gross.iy
  if (!Number.isFinite(polarInertia) || polarInertia <= 0) throw new MechanicsGeometryError('Canonical polar inertia is not positive and finite.')

  const third = {
    m30_mm5: scaled(moments.get(momentKey(3, 0))!, scale, 5, 'M30'),
    m21_mm5: scaled(moments.get(momentKey(2, 1))!, scale, 5, 'M21'),
    m12_mm5: scaled(moments.get(momentKey(1, 2))!, scale, 5, 'M12'),
    m03_mm5: scaled(moments.get(momentKey(0, 3))!, scale, 5, 'M03'),
  }
  const principalThird = {
    m30_mm5: scaled(transformedMoment(moments, 3, 0, cosine, sine), scale, 5, 'principal M30'),
    m21_mm5: scaled(transformedMoment(moments, 2, 1, cosine, sine), scale, 5, 'principal M21'),
    m12_mm5: scaled(transformedMoment(moments, 1, 2, cosine, sine), scale, 5, 'principal M12'),
    m03_mm5: scaled(transformedMoment(moments, 0, 3, cosine, sine), scale, 5, 'principal M03'),
  }
  const integrationPrimitives = rectangles.map((rectangle) => ({
    kind: 'rectangle' as const,
    x_min_mm: rectangle.x,
    y_min_mm: rectangle.y,
    width_mm: rectangle.width,
    height_mm: rectangle.height,
  }))
  const boundaryPoints = rectangles.flatMap((rectangle) => {
    const x0 = rectangle.x / scale - cx, x1 = (rectangle.x + rectangle.width) / scale - cx
    const y0 = rectangle.y / scale - cy, y1 = (rectangle.y + rectangle.height) / scale - cy
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
  })
  const kind = type === 'rectangle' ? 'rectangle' as const : 'rectangular_components' as const
  return {
    representation: {
      kind,
      geometry_type: type,
      units: 'mm',
      coordinate_system: { origin: 'bounding_box_lower_left', x: 'right', y: 'up' },
      bounding_box_mm: box,
      centroid_mm: { x: gross.centroidX, y: gross.centroidY },
      area_mm2: gross.area,
      integration_primitives: integrationPrimitives,
    },
    polar_centroidal: {
      inertia_mm4: polarInertia,
      radius_mm: safeValue(Math.sqrt(polarInertia / gross.area), 'polar radius of gyration'),
    },
    coupled_bending: coupledBending(canonicalIx, canonicalIy, canonicalIxy, scale, boundaryPoints, null),
    principal: { basis_angle_degrees: basisAngle, basis_unique: basisUnique, major, minor },
    third_moments: third,
    third_moments_principal: principalThird,
  }
}
