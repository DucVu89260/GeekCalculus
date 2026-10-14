import Decimal from 'decimal.js'
import type { CalculationRequest, CalculationResult, GeometryDefinition } from './types'

const SOLVER_VERSION = '1.3.0'
const GEOMETRY_MODEL_VERSION = '1.0.0'
const Decimal80 = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_EVEN })
const REQUIRED_PROPERTIES = new Set([
  'torsion_constant_j',
  'warping_constant_cw',
  'shear_center',
  'effective_shear_area',
])
const DIMENSIONS: Record<GeometryDefinition['type'], string[]> = {
  rectangle: ['width', 'height'],
  circle: ['diameter'],
  i_section: ['depth', 'top_flange_width', 'bottom_flange_width', 'web_thickness', 'top_flange_thickness', 'bottom_flange_thickness'],
  rectangular_hollow: ['width', 'height', 'thickness'],
  circular_hollow: ['diameter', 'thickness'],
  channel: ['depth', 'width', 'web_thickness', 'flange_thickness'],
  tee: ['depth', 'width', 'web_thickness', 'flange_thickness'],
  angle: ['depth', 'width', 'thickness'],
  double_angle: ['depth', 'width', 'thickness', 'distance'],
}

type ErrorItem = { path: string; type: string; message: string }
type CalculationErrorCode = 'INVALID_DIMENSION' | 'INVALID_GEOMETRY' | 'UNSUPPORTED_VARIANT' | 'UNSUPPORTED_UNITS' | 'UNSUPPORTED_PROPERTY' | 'CALCULATION_ERROR'

/** A domain error with the same stable code/details carried by the Python CLI. */
export class DemoCalculationError extends Error {
  readonly code: CalculationErrorCode
  readonly details: Record<string, unknown>
  readonly errors?: ErrorItem[]

  constructor(code: CalculationErrorCode, message: string, details: Record<string, unknown> = {}, errors?: ErrorItem[]) {
    super(message)
    this.name = 'DemoCalculationError'
    this.code = code
    this.details = details
    this.errors = errors
  }
}

type Component = { width: number; height: number; x: number; y: number; area: number }
type RectangleTorsion = {
  value: number | null
  converged: boolean
  reason: string | null
  diagnostics: Record<string, unknown>
}
type WallSegment = { x0: number; y0: number; x1: number; y1: number; thickness: number; label: string }
type FlowPolynomial = { segment: WallSegment; q0: number; a: number; b: number }
type LineProperties = { area: number; cx: number; cy: number; ix: number; iy: number; ixy: number }
type FlowResponse = { force_x: number; force_y: number; torque: number; energy: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function keysOutside(value: Record<string, unknown>, allowed: string[]): string[] {
  const accepted = new Set(allowed)
  return Object.keys(value).filter((key) => !accepted.has(key))
}

function inputError(errors: ErrorItem[]): never {
  const hasVariant = errors.some((item) => item.path.includes('geometry_variant'))
  const invalidGeometry = errors.some((item) => ['invalid_geometry', 'union_tag_invalid', 'union_tag_not_found', 'extra_forbidden'].includes(item.type))
  const badUnits = errors.some((item) => item.path === 'units')
  const badRequiredProperty = errors.some((item) => item.path.includes('required_properties'))
  const code: CalculationErrorCode = hasVariant
    ? 'UNSUPPORTED_VARIANT'
    : invalidGeometry
      ? 'INVALID_GEOMETRY'
      : badUnits
        ? 'UNSUPPORTED_UNITS'
        : badRequiredProperty
          ? 'UNSUPPORTED_PROPERTY'
          : 'INVALID_DIMENSION'
  throw new DemoCalculationError(code, 'Input validation failed.', { errors }, errors)
}

function requireRecord(value: unknown, path: string, errors: ErrorItem[]): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    errors.push({ path, type: 'model_type', message: 'Input should be a valid dictionary or object.' })
    return undefined
  }
  return value
}

function finiteStrictNumber(value: unknown, path: string, errors: ErrorItem[], positive = false): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ path, type: typeof value === 'number' ? 'finite_number' : 'float_type', message: typeof value === 'number' ? 'Input should be a finite number' : 'Input should be a valid number' })
    return undefined
  }
  if (positive && value <= 0) {
    errors.push({ path, type: 'greater_than', message: 'Input should be greater than 0' })
    return undefined
  }
  return value
}

function validateRequest(request: unknown): { geometry: GeometryDefinition; options: NormalizedOptions } {
  const errors: ErrorItem[] = []
  const raw = requireRecord(request, '', errors)
  if (!raw) inputError(errors)
  const outerUnknown = keysOutside(raw, ['geometry', 'units', 'options'])
  for (const key of outerUnknown) errors.push({ path: key, type: 'extra_forbidden', message: 'Extra inputs are not permitted' })

  if (raw.units !== undefined && raw.units !== 'mm') {
    errors.push({ path: 'units', type: 'literal_error', message: "Input should be 'mm'" })
  }
  if (raw.geometry === undefined) errors.push({ path: 'geometry', type: 'missing', message: 'Field required' })
  const inputGeometry = requireRecord(raw.geometry, 'geometry', errors)
  let geometry: GeometryDefinition | undefined
  if (inputGeometry) {
    const geometryUnknown = keysOutside(inputGeometry, ['type', 'geometry_variant', 'geometry_model_version', 'dimensions'])
    for (const key of geometryUnknown) errors.push({ path: `geometry.${key}`, type: 'extra_forbidden', message: 'Extra inputs are not permitted' })
    const type = inputGeometry.type
    if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(DIMENSIONS, type)) {
      errors.push({ path: 'geometry.type', type: typeof type === 'string' ? 'union_tag_invalid' : 'union_tag_not_found', message: 'Input tag does not match any expected tag' })
    }
    const variant = inputGeometry.geometry_variant
    if (typeof variant !== 'string' || !['solid', 'sharp_corner', 'uniform_wall', 'back_to_back'].includes(variant)) {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: 'Input should be a supported geometry variant' })
    } else if ((type === 'rectangle' || type === 'circle') && variant !== 'solid') {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: "Input should be 'solid'" })
    } else if (type === 'i_section' && variant !== 'sharp_corner') {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: "Input should be 'sharp_corner'" })
    } else if (type === 'circular_hollow' && variant !== 'uniform_wall') {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: "Input should be 'uniform_wall'" })
    } else if (type === 'double_angle' && variant !== 'back_to_back') {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: "Input should be 'back_to_back'" })
      } else if (typeof type === 'string' && ['rectangular_hollow', 'channel', 'tee', 'angle'].includes(type) && variant !== 'sharp_corner') {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: "Input should be 'sharp_corner'" })
    }
    const modelVersion = inputGeometry.geometry_model_version === undefined ? GEOMETRY_MODEL_VERSION : inputGeometry.geometry_model_version
    if (modelVersion !== GEOMETRY_MODEL_VERSION) errors.push({ path: 'geometry.geometry_model_version', type: 'literal_error', message: "Input should be '1.0.0'" })
    const dimensionsRaw = requireRecord(inputGeometry.dimensions, 'geometry.dimensions', errors)
    const dimensions: Record<string, number> = {}
    if (dimensionsRaw && typeof type === 'string' && Object.prototype.hasOwnProperty.call(DIMENSIONS, type)) {
      const names = DIMENSIONS[type as GeometryDefinition['type']]
      for (const key of keysOutside(dimensionsRaw, names)) errors.push({ path: `geometry.dimensions.${key}`, type: 'extra_forbidden', message: 'Extra inputs are not permitted' })
      for (const name of names) {
        if (!Object.prototype.hasOwnProperty.call(dimensionsRaw, name)) {
          errors.push({ path: `geometry.dimensions.${name}`, type: 'missing', message: 'Field required' })
        } else {
          const value = finiteStrictNumber(dimensionsRaw[name], `geometry.dimensions.${name}`, errors, !(type === 'double_angle' && name === 'distance'))
          if (type === 'double_angle' && name === 'distance' && value !== undefined && value < 0) {
            errors.push({ path: 'geometry.dimensions.distance', type: 'greater_than_equal', message: 'Input should be greater than or equal to 0' })
          }
          if (value !== undefined) dimensions[name] = value
        }
      }
      if (type === 'i_section' && names.every((key) => dimensions[key] !== undefined)) {
        const { depth, top_flange_width, bottom_flange_width, web_thickness, top_flange_thickness, bottom_flange_thickness } = dimensions
        if (depth <= top_flange_thickness + bottom_flange_thickness) {
          errors.push({ path: 'geometry', type: 'invalid_geometry', message: 'depth must exceed the sum of flange thicknesses' })
        }
        if (web_thickness > Math.min(top_flange_width, bottom_flange_width)) {
          errors.push({ path: 'geometry', type: 'invalid_geometry', message: 'web_thickness must not exceed either flange width' })
        }
      }
      if (type === 'rectangular_hollow' && names.every((key) => dimensions[key] !== undefined)) {
        const { width, height, thickness } = dimensions
        if (!(width - 2 * thickness > 0 && width - 2 * thickness < width && height - 2 * thickness > 0 && height - 2 * thickness < height)) {
          errors.push({ path: 'geometry', type: 'invalid_geometry', message: '2 * thickness must be representably less than width and height' })
        }
      }
      if (type === 'circular_hollow' && names.every((key) => dimensions[key] !== undefined)) {
        const { diameter, thickness } = dimensions
        if (!(diameter - 2 * thickness > 0 && diameter - 2 * thickness < diameter)) {
          errors.push({ path: 'geometry', type: 'invalid_geometry', message: '2 * thickness must be representably less than diameter' })
        }
      }
      if ((type === 'channel' || type === 'tee') && names.every((key) => dimensions[key] !== undefined)) {
        const { depth, width, web_thickness, flange_thickness } = dimensions
        const clearDepth = type === 'channel' ? depth - 2 * flange_thickness : depth - flange_thickness
        if (!(clearDepth > 0 && clearDepth < depth && width - web_thickness > 0 && width - web_thickness < width)) {
          errors.push({ path: 'geometry', type: 'invalid_geometry', message: `${type} needs representable clear web depth and flange projection` })
        }
      }
      if (type === 'angle' && names.every((key) => dimensions[key] !== undefined)) {
        const { depth, width, thickness } = dimensions
        if (!(depth - thickness > 0 && depth - thickness < depth && width - thickness > 0 && width - thickness < width)) {
          errors.push({ path: 'geometry', type: 'invalid_geometry', message: 'angle thickness must be representably less than width and depth' })
        }
      }
      if (type === 'double_angle' && names.every((key) => dimensions[key] !== undefined)) {
        const { depth, width, thickness, distance } = dimensions
        const clearDepth = depth - thickness
        const clearWidth = width - thickness
        const overallWidth = 2 * width + distance
        if (distance >= 0 && !(clearDepth > 0 && clearDepth < depth && clearWidth > 0 && clearWidth < width
          && Number.isFinite(overallWidth) && overallWidth > width
          && (distance === 0 || overallWidth > 2 * width))) {
          errors.push({ path: 'geometry', type: 'invalid_geometry', message: 'double-angle dimensions must leave representable legs and overall width' })
        }
      }
      if (errors.length === 0) {
        geometry = {
          type: type as GeometryDefinition['type'],
          geometry_variant: variant as GeometryDefinition['geometry_variant'],
          geometry_model_version: GEOMETRY_MODEL_VERSION,
          dimensions,
        }
      }
    }
  }

  const rawOptions = raw.options === undefined ? {} : requireRecord(raw.options, 'options', errors)
  let options: NormalizedOptions | undefined
  if (rawOptions) {
    for (const key of keysOutside(rawOptions, ['solver', 'include_plastic', 'include_advanced', 'rectangle_j_relative_tolerance', 'rectangle_j_max_terms', 'required_properties'])) {
      errors.push({ path: `options.${key}`, type: 'extra_forbidden', message: 'Extra inputs are not permitted' })
    }
    const solver = rawOptions.solver ?? 'analytical'
    if (solver !== 'analytical') errors.push({ path: 'options.solver', type: 'literal_error', message: "Input should be 'analytical'" })
    const includePlastic = rawOptions.include_plastic ?? true
    const includeAdvanced = rawOptions.include_advanced ?? false
    if (typeof includePlastic !== 'boolean') errors.push({ path: 'options.include_plastic', type: 'bool_type', message: 'Input should be a valid boolean' })
    if (typeof includeAdvanced !== 'boolean') errors.push({ path: 'options.include_advanced', type: 'bool_type', message: 'Input should be a valid boolean' })
    const tolerance = rawOptions.rectangle_j_relative_tolerance === undefined
      ? 1e-10
      : finiteStrictNumber(rawOptions.rectangle_j_relative_tolerance, 'options.rectangle_j_relative_tolerance', errors, true)
    if (tolerance !== undefined && tolerance > 1e-2) errors.push({ path: 'options.rectangle_j_relative_tolerance', type: 'less_than_equal', message: 'Input should be less than or equal to 0.01' })
    let maxTerms = 10000
    if (rawOptions.rectangle_j_max_terms !== undefined) {
      const value = rawOptions.rectangle_j_max_terms
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100000) {
        errors.push({ path: 'options.rectangle_j_max_terms', type: typeof value === 'number' && Number.isInteger(value) ? (value < 1 ? 'greater_than_equal' : 'less_than_equal') : 'int_type', message: 'Input should be a valid bounded integer' })
      } else maxTerms = value
    }
    let requiredProperties: string[] = []
    if (rawOptions.required_properties !== undefined) {
      if (!Array.isArray(rawOptions.required_properties)) {
        errors.push({ path: 'options.required_properties', type: 'tuple_type', message: 'Input should be a valid array' })
      } else {
        requiredProperties = rawOptions.required_properties.map((value, index) => {
          if (typeof value !== 'string' || !REQUIRED_PROPERTIES.has(value)) {
            errors.push({ path: `options.required_properties.${index}`, type: 'literal_error', message: 'Input should be a supported property' })
          }
          return String(value)
        })
      }
    }
    if (typeof includePlastic === 'boolean' && typeof includeAdvanced === 'boolean' && tolerance !== undefined && tolerance <= 1e-2 && Number.isFinite(tolerance)) {
      options = {
        solver: 'analytical',
        include_plastic: includePlastic,
        include_advanced: includeAdvanced,
        rectangle_j_relative_tolerance: tolerance,
        rectangle_j_max_terms: maxTerms,
        required_properties: requiredProperties,
      }
    }
  }
  if (errors.length) inputError(errors)
  return { geometry: geometry!, options: options! }
}

type NormalizedOptions = {
  solver: 'analytical'
  include_plastic: boolean
  include_advanced: boolean
  rectangle_j_relative_tolerance: number
  rectangle_j_max_terms: number
  required_properties: string[]
}

function pyFloat(value: number): string {
  if (!Number.isFinite(value)) throw calculationError('Calculation cannot produce finite, positive properties at this numerical scale.', { reason: 'floating_point_range' })
  if (Object.is(value, -0)) return '-0.0'
  const source = String(value).toLowerCase()
  const [mantissa, sourceExponent] = source.split('e')
  const exponentPart = sourceExponent === undefined ? 0 : Number(sourceExponent)
  const unsigned = mantissa.startsWith('-') ? mantissa.slice(1) : mantissa
  const dot = unsigned.indexOf('.')
  const decimalPosition = dot < 0 ? unsigned.length : dot
  let digits = unsigned.replace('.', '')
  let first = 0
  while (first < digits.length && digits[first] === '0') first++
  if (first === digits.length) return '0.0'
  let significant = digits.slice(first).replace(/0+$/, '')
  const decimalExponent = decimalPosition + exponentPart - first - 1
  const sign = mantissa.startsWith('-') ? '-' : ''
  if (decimalExponent < -4 || decimalExponent >= 16) {
    const fraction = significant.length > 1 ? `.${significant.slice(1)}` : ''
    const exponent = `${decimalExponent >= 0 ? '+' : '-'}${String(Math.abs(decimalExponent)).padStart(2, '0')}`
    return `${sign}${significant[0]}${fraction}e${exponent}`
  }
  const point = decimalExponent + 1
  let fixed: string
  if (point <= 0) fixed = `0.${'0'.repeat(-point)}${significant}`
  else if (point >= significant.length) fixed = `${significant}${'0'.repeat(point - significant.length)}.0`
  else fixed = `${significant.slice(0, point)}.${significant.slice(point)}`
  return sign + fixed
}

function quote(value: string): string { return JSON.stringify(value) }

function geometryHash(geometry: GeometryDefinition): string {
  const dimensions = Object.keys(geometry.dimensions).sort().map((key) => `${quote(key)}:${pyFloat(geometry.dimensions[key])}`).join(',')
  const canonical = `{"dimensions":{${dimensions}},"geometry_model_version":${quote(GEOMETRY_MODEL_VERSION)},"geometry_variant":${quote(geometry.geometry_variant)},"type":${quote(geometry.type)},"units":"mm"}`
  return sha256(canonical)
}

function configHash(options: NormalizedOptions): string {
  const canonical = `{"include_advanced":${options.include_advanced},"include_plastic":${options.include_plastic},"rectangle_j_max_terms":${options.rectangle_j_max_terms},"rectangle_j_relative_tolerance":${pyFloat(options.rectangle_j_relative_tolerance)},"required_properties":[${options.required_properties.map(quote).join(',')}],"solver":"analytical"}`
  return sha256(canonical)
}

// SHA-256 is synchronous and local so static hosting never needs a service or
// a server-only crypto module. The input is always a tiny canonical JSON string.
function sha256(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)
  const k = SHA256_K
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const rotate = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2]
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + s1 + ch + k[i] + w[i]) >>> 0
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + maj) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0
  }
  return Array.from(h, (part) => part.toString(16).padStart(8, '0')).join('')
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function calculationError(message: string, details: Record<string, unknown>): DemoCalculationError {
  return new DemoCalculationError('CALCULATION_ERROR', message, details)
}

function fsum(values: number[]): number {
  // CPython's partials technique preserves low-order bits in sums of areas and
  // component moments, which matters for asymmetric sections.
  const partials: number[] = []
  for (let x of values) {
    let j = 0
    for (let i = 0; i < partials.length; i++) {
      let y = partials[i]
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x]
      const hi = x + y
      const lo = y - (hi - x)
      if (lo !== 0) partials[j++] = lo
      x = hi
    }
    partials.length = j
    partials.push(x)
  }
  let n = partials.length
  let hi = 0
  let lo = 0
  while (n) {
    n--
    const x = hi
    const y = partials[n]
    hi = x + y
    const yr = hi - x
    lo = y - yr
    if (lo !== 0) break
  }
  if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
    const y = lo * 2
    const x = hi + y
    const yr = x - hi
    if (y === yr) hi = x
  }
  return hi
}

function components(g: GeometryDefinition): Component[] {
  const d = g.dimensions
  if (g.type === 'i_section') {
    const { depth, top_flange_width: top, bottom_flange_width: bottom, web_thickness: web, top_flange_thickness: topT, bottom_flange_thickness: bottomT } = d
    const width = Math.max(top, bottom)
    const webHeight = depth - topT - bottomT
    return [
      { width: bottom, height: bottomT, x: (width - bottom) / 2, y: 0, area: bottom * bottomT },
      { width: web, height: webHeight, x: (width - web) / 2, y: bottomT, area: web * webHeight },
      { width: top, height: topT, x: (width - top) / 2, y: depth - topT, area: top * topT },
    ]
  }
  if (g.type === 'rectangular_hollow') {
    const { width, height, thickness } = d
    const innerHeight = height - 2 * thickness
    return [
      { width, height: thickness, x: 0, y: 0, area: width * thickness },
      { width, height: thickness, x: 0, y: height - thickness, area: width * thickness },
      { width: thickness, height: innerHeight, x: 0, y: thickness, area: thickness * innerHeight },
      { width: thickness, height: innerHeight, x: width - thickness, y: thickness, area: thickness * innerHeight },
    ]
  }
  if (g.type === 'channel') {
    const { depth, width, web_thickness: web, flange_thickness: flange } = d
    const clearDepth = depth - 2 * flange
    return [
      { width, height: flange, x: 0, y: 0, area: width * flange },
      { width: web, height: clearDepth, x: 0, y: flange, area: web * clearDepth },
      { width, height: flange, x: 0, y: depth - flange, area: width * flange },
    ]
  }
  if (g.type === 'tee') {
    const { depth, width, web_thickness: web, flange_thickness: flange } = d
    const clearDepth = depth - flange
    return [
      { width: web, height: clearDepth, x: (width - web) / 2, y: 0, area: web * clearDepth },
      { width, height: flange, x: 0, y: depth - flange, area: width * flange },
    ]
  }
  if (g.type === 'angle') {
    const { depth, width, thickness } = d
    const clearDepth = depth - thickness
    return [
      { width, height: thickness, x: 0, y: 0, area: width * thickness },
      { width: thickness, height: clearDepth, x: 0, y: thickness, area: thickness * clearDepth },
    ]
  }
  if (g.type === 'double_angle') {
    const { depth, width, thickness, distance } = d
    const clearDepth = depth - thickness
    return [
      { width, height: thickness, x: 0, y: 0, area: width * thickness },
      { width: thickness, height: clearDepth, x: width - thickness, y: thickness, area: thickness * clearDepth },
      { width, height: thickness, x: width + distance, y: 0, area: width * thickness },
      { width: thickness, height: clearDepth, x: width + distance, y: thickness, area: thickness * clearDepth },
    ]
  }
  throw calculationError('Composite components are not defined for this geometry.', { geometry_type: g.type })
}

function decimalPlasticAxisForComponents(parts: Component[], axis: 'x' | 'y'): { pna: number; z: number; diagnostics: Record<string, unknown> } {
  const blocks: Array<[Decimal, Decimal, Decimal]> = parts.map((part) => axis === 'y'
    ? [new Decimal80(String(part.width)), new Decimal80(String(part.y)), new Decimal80(String(part.y + part.height))]
    : [new Decimal80(String(part.height)), new Decimal80(String(part.x)), new Decimal80(String(part.x + part.width))])
  const area = blocks.reduce((sum, [span, start, end]) => sum.plus(span.times(end.minus(start))), new Decimal80(0))
  if (!area.gt(0)) throw new ArithmeticError()
  const target = area.div(2)
  const below = (cut: Decimal) => blocks.reduce((sum, [span, start, end]) => {
    const interval = end.minus(start)
    const length = Decimal80.max(new Decimal80(0), Decimal80.min(interval, cut.minus(start)))
    return sum.plus(span.times(length))
  }, new Decimal80(0))
  let low = Decimal80.min(...blocks.map(([, start]) => start))
  let high = Decimal80.max(...blocks.map(([, , end]) => end))
  let cut = new Decimal80(0), iteration = 0
  for (iteration = 1; iteration <= 256; iteration++) {
    cut = low.plus(high).div(2)
    const currentArea = below(cut)
    if (currentArea.times(2).minus(area).abs().div(area).lte('1e-24')) break
    if (currentArea.lt(target)) {
      if (low.eq(cut)) break
      low = cut
    } else {
      if (high.eq(cut)) break
      high = cut
    }
  }
  const slope = blocks.reduce((sum, [span, start, end]) => start.lte(cut) && cut.lt(end) ? sum.plus(span) : sum, new Decimal80(0))
  if (!slope.isZero()) cut = cut.plus(target.minus(below(cut)).div(slope))
  const pna = cut.toNumber()
  const actualCut = new Decimal80(String(pna))
  const actualBelow = below(actualCut)
  const balance = actualBelow.times(2).minus(area).abs().div(area)
  const min = Decimal80.min(...blocks.map(([, start]) => start)).toNumber()
  const max = Decimal80.max(...blocks.map(([, , end]) => end)).toNumber()
  if (!Number.isFinite(pna) || !(pna > min && pna < max) || balance.gt('1e-10')) {
    throw calculationError('Plastic neutral axis did not meet the area-balance tolerance.', { axis, relative_area_imbalance: balance.toNumber() })
  }
  const moments = blocks.map(([span, start, end]) => {
    const interval = end.minus(start)
    if (actualCut.lte(start)) return span.times(interval).times(start.plus(end).div(2).minus(actualCut))
    if (actualCut.gte(end)) return span.times(interval).times(actualCut.minus(start.plus(end).div(2)))
    return span.times(actualCut.minus(start).pow(2).plus(end.minus(actualCut).pow(2))).div(2)
  })
  return {
    pna,
    z: Decimal80.sum(...moments).toNumber(),
    diagnostics: {
      method: 'component_area_bisection_with_piecewise_linear_refinement',
      arithmetic: 'decimal_80_then_float64',
      iterations: Math.min(iteration, 256),
      relative_area_imbalance: balance.toNumber(),
    },
  }
}

function principalProperties(ix: number, iy: number, ixy: number): CalculationResult['properties']['principal'] {
  if (ix === iy && ixy === 0) {
    return { i_major: ix, i_minor: iy, major_axis_angle_degrees: null, orientation_status: 'indeterminate' }
  }
  const scale = Math.max(Math.abs(ix), Math.abs(iy), Math.abs(ixy))
  const mean = (ix / scale + iy / scale) / 2
  const radius = Math.hypot((ix / scale - iy / scale) / 2, ixy / scale)
  const major = scale * (mean + radius)
  const determinant = new Decimal80(String(ix)).times(String(iy)).minus(new Decimal80(String(ixy)).pow(2))
  const minor = determinant.div(String(major)).toNumber()
  if (![major, minor].every(Number.isFinite) || major <= 0 || minor <= 0) throw new ArithmeticError()
  let angle = ((0.5 * Math.atan2(-2 * ixy, ix - iy) * 180 / Math.PI) % 180 + 180) % 180
  if (angle >= 180 - 1e-12) angle = 0
  return { i_major: major, i_minor: minor, major_axis_angle_degrees: angle, orientation_status: 'determinate' }
}

function decimalPlasticAxis(g: GeometryDefinition): { pna: number; zx: number; diagnostics: Record<string, unknown> } {
  const d = Object.fromEntries(Object.entries(g.dimensions).map(([key, value]) => [key, new Decimal80(String(value))])) as Record<string, Decimal>
  const h = d.depth, bt = d.top_flange_width, bb = d.bottom_flange_width, tw = d.web_thickness, tt = d.top_flange_thickness, tb = d.bottom_flange_thickness
  const blocks: Array<[Decimal, Decimal, Decimal]> = [[bb, new Decimal80(0), tb], [tw, tb, h.minus(tt)], [bt, h.minus(tt), h]]
  const area = blocks.reduce((sum, [width, start, end]) => sum.plus(width.times(end.minus(start))), new Decimal80(0))
  const target = area.div(2)
  const below = (cut: Decimal) => blocks.reduce((sum, [width, start, end]) => {
    const band = end.minus(start)
    const height = Decimal80.max(new Decimal80(0), Decimal80.min(band, cut.minus(start)))
    return sum.plus(width.times(height))
  }, new Decimal80(0))
  let low = new Decimal80(0), high = h, cut = new Decimal80(0), iteration = 0
  for (iteration = 1; iteration <= 256; iteration++) {
    cut = low.plus(high).div(2)
    const currentArea = below(cut)
    if (currentArea.times(2).minus(area).abs().div(area).lte('1e-24')) break
    if (currentArea.lt(target)) {
      if (low.eq(cut)) break
      low = cut
    } else {
      if (high.eq(cut)) break
      high = cut
    }
  }
  const slope = blocks.reduce((sum, [width, start, end]) => start.lte(cut) && cut.lt(end) ? sum.plus(width) : sum, new Decimal80(0))
  if (!slope.isZero()) cut = cut.plus(target.minus(below(cut)).div(slope))
  const pna = cut.toNumber()
  const actualCut = new Decimal80(String(pna))
  const actualBelow = below(actualCut)
  const balance = actualBelow.times(2).minus(area).abs().div(area)
  if (!actualCut.gt(0) || !actualCut.lt(h) || balance.gt('1e-10') || !Number.isFinite(pna)) {
    throw calculationError('Plastic neutral axis did not meet the area-balance tolerance.', { relative_area_imbalance: balance.toNumber() })
  }
  const moments = blocks.map(([width, start, end]) => {
    const blockHeight = end.minus(start)
    if (actualCut.lte(start)) return width.times(blockHeight).times(start.plus(end).div(2).minus(actualCut))
    if (actualCut.gte(end)) return width.times(blockHeight).times(actualCut.minus(start.plus(end).div(2)))
    return width.times(actualCut.minus(start).pow(2).plus(end.minus(actualCut).pow(2))).div(2)
  })
  const zx = Decimal80.sum(...moments).toNumber()
  return {
    pna,
    zx,
    diagnostics: {
      method: 'area_bisection_with_piecewise_linear_refinement',
      arithmetic: 'decimal_80_then_float64',
      iterations: Math.min(iteration, 256),
      area_below: actualBelow.toNumber(),
      area_above: area.minus(actualBelow).toNumber(),
      relative_area_imbalance: balance.toNumber(),
    },
  }
}

function nextUp(value: number): number {
  if (Number.isNaN(value) || value === Infinity) return value
  if (value === 0) return Number.MIN_VALUE
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setFloat64(0, value, false)
  let high = view.getUint32(0, false)
  let low = view.getUint32(4, false)
  if (value > 0) {
    if (low === 0xffffffff) { high = (high + 1) >>> 0; low = 0 }
    else low++
  } else {
    if (low === 0) { high = (high - 1) >>> 0; low = 0xffffffff }
    else low--
  }
  view.setUint32(0, high, false)
  view.setUint32(4, low, false)
  return view.getFloat64(0, false)
}

function ulp(value: number): number { return nextUp(Math.abs(value)) - Math.abs(value) }

function rectangleTorsion(width: number, height: number, tolerance: number, maxTerms: number): RectangleTorsion {
  const a = Math.max(width, height), b = Math.min(width, height)
  const base = a * b ** 3 / 3
  const coefficient = 192 * b / (Math.PI ** 5 * a)
  if (!Number.isFinite(base) || base <= 0) throw new ArithmeticError()
  let total = 0, compensation = 0
  let diagnostics: Record<string, unknown> = {}
  for (let count = 1; count <= maxTerms; count++) {
    const n = 2 * count - 1
    const term = Math.tanh(n * Math.PI * (a / b) / 2) / n ** 5
    const corrected = term - compensation
    const updated = total + corrected
    compensation = (updated - total) - corrected
    total = updated
    const scaledValue = 1 - coefficient * total
    const estimate = base * scaledValue
    const scaledTailBound = coefficient / (8 * n ** 4)
    const scaledRoundoffEstimate = 32 * Number.EPSILON * (1 + Math.abs(coefficient * total)) + 2 * ulp(base) / base
    const lower = scaledValue - scaledTailBound - scaledRoundoffEstimate
    const relativeBound = lower > 0 ? (scaledTailBound + scaledRoundoffEstimate) / lower : null
    const truncationBound = nextUp(base * scaledTailBound)
    const roundingEstimate = nextUp(base * scaledRoundoffEstimate)
    const converged = relativeBound !== null && relativeBound <= tolerance
    diagnostics = {
      method: 'saint_venant_odd_series',
      terms: count,
      requested_relative_tolerance: tolerance,
      truncation_abs_error_bound: truncationBound,
      floating_point_abs_error_estimate: roundingEstimate,
      relative_error_bound_with_roundoff_estimate: relativeBound,
      scaled_tail_bound: scaledTailBound,
      scaled_roundoff_estimate: scaledRoundoffEstimate,
      converged,
    }
    if (converged) return { value: estimate, converged: true, reason: null, diagnostics }
    if (scaledValue > 0 && scaledRoundoffEstimate / scaledValue >= tolerance) {
      return { value: null, converged: false, reason: 'numerical_precision_limit', diagnostics }
    }
  }
  return { value: null, converged: false, reason: 'convergence_not_achieved', diagnostics }
}

function rescaleDimensionless(value: number, scale: number, power: number, allowZero = false): number | null {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) return null
  const converted = new Decimal80(String(value)).times(new Decimal80(String(scale)).pow(power)).toNumber()
  if (!Number.isFinite(converted) || (value !== 0 && converted === 0)) return null
  return converted
}

function wallSegments(g: GeometryDefinition, scale: number): WallSegment[] {
  const d = g.dimensions
  const n = (value: number) => value / scale
  if (g.type === 'i_section') {
    const h = n(d.depth), bt = n(d.top_flange_width), bb = n(d.bottom_flange_width)
    const tt = n(d.top_flange_thickness), tb = n(d.bottom_flange_thickness), tw = n(d.web_thickness)
    const width = Math.max(bt, bb), xc = width / 2, yb = tb / 2, yt = h - tt / 2
    return [
      { x0: xc - bb / 2, y0: yb, x1: xc, y1: yb, thickness: tb, label: 'bottom_flange_left' },
      { x0: xc, y0: yb, x1: xc, y1: yt, thickness: tw, label: 'web' },
      { x0: xc, y0: yb, x1: xc + bb / 2, y1: yb, thickness: tb, label: 'bottom_flange_right' },
      { x0: xc - bt / 2, y0: yt, x1: xc, y1: yt, thickness: tt, label: 'top_flange_left' },
      { x0: xc, y0: yt, x1: xc + bt / 2, y1: yt, thickness: tt, label: 'top_flange_right' },
    ]
  }
  if (g.type === 'channel') {
    const h = n(d.depth), w = n(d.width), tw = n(d.web_thickness), tf = n(d.flange_thickness)
    const xw = tw / 2, yb = tf / 2, yt = h - tf / 2
    return [
      { x0: xw, y0: yb, x1: w, y1: yb, thickness: tf, label: 'bottom_flange' },
      { x0: xw, y0: yb, x1: xw, y1: yt, thickness: tw, label: 'web' },
      { x0: xw, y0: yt, x1: w, y1: yt, thickness: tf, label: 'top_flange' },
    ]
  }
  if (g.type === 'tee') {
    const h = n(d.depth), w = n(d.width), tw = n(d.web_thickness), tf = n(d.flange_thickness)
    const xw = w / 2, yf = h - tf / 2
    return [
      { x0: xw, y0: 0, x1: xw, y1: yf, thickness: tw, label: 'web' },
      { x0: 0, y0: yf, x1: xw, y1: yf, thickness: tf, label: 'flange_left' },
      { x0: xw, y0: yf, x1: w, y1: yf, thickness: tf, label: 'flange_right' },
    ]
  }
  if (g.type === 'angle') {
    const h = n(d.depth), w = n(d.width), t = n(d.thickness), hx = t / 2, hy = t / 2
    return [
      { x0: hx, y0: hy, x1: hx, y1: h, thickness: t, label: 'vertical_leg' },
      { x0: hx, y0: hy, x1: w, y1: hy, thickness: t, label: 'horizontal_leg' },
    ]
  }
  if (g.type === 'double_angle') {
    const h = n(d.depth), b = n(d.width), t = n(d.thickness), gap = n(d.distance)
    const leftHeel = b - t / 2, rightHeel = b + gap + t / 2, overallWidth = 2 * b + gap, yheel = t / 2
    return [
      { x0: 0, y0: yheel, x1: leftHeel, y1: yheel, thickness: t, label: 'left_toe' },
      { x0: leftHeel, y0: yheel, x1: leftHeel, y1: h, thickness: t, label: 'left_web' },
      { x0: leftHeel, y0: yheel, x1: rightHeel, y1: yheel, thickness: 0, label: 'ideal_rigid_heel_link' },
      { x0: rightHeel, y0: yheel, x1: rightHeel, y1: h, thickness: t, label: 'right_web' },
      { x0: rightHeel, y0: yheel, x1: overallWidth, y1: yheel, thickness: t, label: 'right_toe' },
    ]
  }
  throw calculationError('Open thin-wall model does not apply to this geometry.', { geometry_type: g.type })
}

function rhsSegments(g: GeometryDefinition, scale: number): WallSegment[] {
  const d = g.dimensions, w = d.width / scale, h = d.height / scale, t = d.thickness / scale
  const left = t / 2, right = w - t / 2, bottom = t / 2, top = h - t / 2
  return [
    { x0: left, y0: bottom, x1: right, y1: bottom, thickness: t, label: 'bottom_wall' },
    { x0: right, y0: bottom, x1: right, y1: top, thickness: t, label: 'right_wall' },
    { x0: right, y0: top, x1: left, y1: top, thickness: t, label: 'top_wall' },
    { x0: left, y0: top, x1: left, y1: bottom, thickness: t, label: 'left_wall' },
  ]
}

function segmentLength(segment: WallSegment): number { return Math.hypot(segment.x1 - segment.x0, segment.y1 - segment.y0) }
function pointKey(x: number, y: number): string { return `${x},${y}` }

function lineProperties(segments: WallSegment[]): LineProperties {
  const material = segments.filter((segment) => segment.thickness > 0)
  const area = fsum(material.map((segment) => segment.thickness * segmentLength(segment)))
  if (!Number.isFinite(area) || area <= 0) throw new ArithmeticError()
  const cx = fsum(material.map((s) => s.thickness * segmentLength(s) * (s.x0 + s.x1) / 2)) / area
  const cy = fsum(material.map((s) => s.thickness * segmentLength(s) * (s.y0 + s.y1) / 2)) / area
  const ix = fsum(material.map((s) => s.thickness * segmentLength(s) * (((s.y0 + s.y1) / 2 - cy) ** 2 + (s.y1 - s.y0) ** 2 / 12)))
  const iy = fsum(material.map((s) => s.thickness * segmentLength(s) * (((s.x0 + s.x1) / 2 - cx) ** 2 + (s.x1 - s.x0) ** 2 / 12)))
  const ixy = fsum(material.map((s) => s.thickness * segmentLength(s) * (((s.x0 + s.x1) / 2 - cx) * ((s.y0 + s.y1) / 2 - cy) + (s.x1 - s.x0) * (s.y1 - s.y0) / 12)))
  return { area, cx, cy, ix, iy, ixy }
}

function orientedTree(segments: WallSegment[]): WallSegment[] {
  const adjacency = new Map<string, Array<{ index: number; x: number; y: number }>>()
  segments.forEach((segment, index) => {
    const start = pointKey(segment.x0, segment.y0), end = pointKey(segment.x1, segment.y1)
    const fromStart = adjacency.get(start) || []
    fromStart.push({ index, x: segment.x1, y: segment.y1 }); adjacency.set(start, fromStart)
    const fromEnd = adjacency.get(end) || []
    fromEnd.push({ index, x: segment.x0, y: segment.y0 }); adjacency.set(end, fromEnd)
  })
  const roots = Array.from(adjacency.entries()).filter(([, edges]) => edges.length === 1)
  if (roots.length < 2) throw new ArithmeticError()
  const visitedNodes = new Set<string>([roots[0][0]])
  const todo = [roots[0][0]]
  const result: WallSegment[] = []
  while (todo.length) {
    const key = todo.pop()!
    const [x, y] = key.split(',').map(Number)
    for (const edge of adjacency.get(key) || []) {
      const child = pointKey(edge.x, edge.y)
      if (visitedNodes.has(child)) continue
      const original = segments[edge.index]
      result.push(pointKey(original.x0, original.y0) === key ? original : {
        ...original, x0: original.x1, y0: original.y1, x1: original.x0, y1: original.y0,
      })
      visitedNodes.add(child)
      todo.push(child)
    }
  }
  if (result.length !== segments.length) throw new ArithmeticError()
  return result
}

function flowCoefficients(segment: WallSegment, centroidX: number, centroidY: number, ix: number, iy: number, ixy: number, determinant: number, axis: 'x' | 'y'): [number, number, number] {
  const length = segmentLength(segment), ux = (segment.x1 - segment.x0) / length, uy = (segment.y1 - segment.y0) / length
  const derivative = (s: number) => {
    const x = segment.x0 + ux * s - centroidX, y = segment.y0 + uy * s - centroidY
    return axis === 'x'
      ? -segment.thickness * (ix * x - ixy * y) / determinant
      : -segment.thickness * (iy * y - ixy * x) / determinant
  }
  const start = derivative(0), end = derivative(length)
  return [start, (end - start) / length, length]
}

function flowPolynomials(segments: WallSegment[], centroidX: number, centroidY: number, ix: number, iy: number, ixy: number, axis: 'x' | 'y', closed = false): FlowPolynomial[] {
  const determinant = ix * iy - ixy ** 2
  if (!Number.isFinite(determinant) || determinant <= 0) throw new ArithmeticError()
  const ordered = closed ? segments : orientedTree(segments)
  const coefficients = ordered.map((segment) => flowCoefficients(segment, centroidX, centroidY, ix, iy, ixy, determinant, axis))
  const sources = coefficients.map(([start, slope, length]) => start * length + slope * length ** 2 / 2)
  const starts = Array(ordered.length).fill(0) as number[]
  if (!closed) {
    const startChildren = new Map<string, number[]>()
    ordered.forEach((segment, index) => {
      const key = pointKey(segment.x0, segment.y0), list = startChildren.get(key) || []
      list.push(index); startChildren.set(key, list)
    })
    for (let i = ordered.length - 1; i >= 0; i--) {
      const endKey = pointKey(ordered[i].x1, ordered[i].y1)
      const children = (startChildren.get(endKey) || []).filter((child) => child > i)
      starts[i] = fsum(children.map((child) => starts[child])) - sources[i]
    }
    const endNodes = new Set(ordered.map((s) => pointKey(s.x1, s.y1)))
    const startRoots = new Set(ordered.map((s) => pointKey(s.x0, s.y0)).filter((key) => !endNodes.has(key)))
    if (startRoots.size !== 1) throw new ArithmeticError()
    const root = Array.from(startRoots)[0]
    const rootFlow = fsum(ordered.map((segment, index) => pointKey(segment.x0, segment.y0) === root ? starts[index] : 0))
    const balanceScale = Math.max(1, fsum(sources.map(Math.abs)))
    if (Math.abs(rootFlow) > 2e-10 * balanceScale) throw new ArithmeticError()
    return ordered.map((segment, index) => ({ segment, q0: starts[index], a: coefficients[index][0], b: coefficients[index][1] }))
  }
  for (let i = 1; i < ordered.length; i++) starts[i] = starts[i - 1] + sources[i - 1]
  if (Math.abs(starts[starts.length - 1] + sources[sources.length - 1]) > 2e-10) throw new ArithmeticError()
  const compatibility = fsum(ordered.map((segment, i) => {
    const [qDerivative, slope, length] = coefficients[i]
    return (starts[i] * length + qDerivative * length ** 2 / 2 + slope * length ** 3 / 6) / segment.thickness
  }))
  const compliance = fsum(ordered.map((segment, i) => coefficients[i][2] / segment.thickness))
  const constant = -compatibility / compliance
  return ordered.map((segment, index) => ({ segment, q0: starts[index] + constant, a: coefficients[index][0], b: coefficients[index][1] }))
}

function polynomialIntegrals(q0: number, a: number, b: number, length: number): [number, number] {
  const qIntegral = q0 * length + a * length ** 2 / 2 + b * length ** 3 / 6
  const coefficients = [q0, a, b / 2]
  const terms: number[] = []
  coefficients.forEach((left, i) => coefficients.forEach((right, j) => terms.push(left * right * length ** (i + j + 1) / (i + j + 1))))
  return [qIntegral, fsum(terms)]
}

function flowResponse(flow: FlowPolynomial[], centroidX: number, centroidY: number): FlowResponse {
  const forceX: number[] = [], forceY: number[] = [], torque: number[] = [], energy: number[] = []
  for (const item of flow) {
    const s = item.segment, length = segmentLength(s), ux = (s.x1 - s.x0) / length, uy = (s.y1 - s.y0) / length
    const [qIntegral, q2Integral] = polynomialIntegrals(item.q0, item.a, item.b, length)
    forceX.push(qIntegral * ux); forceY.push(qIntegral * uy)
    torque.push(((s.x0 - centroidX) * uy - (s.y0 - centroidY) * ux) * qIntegral)
    if (s.thickness > 0) energy.push(q2Integral / s.thickness)
  }
  return { force_x: fsum(forceX), force_y: fsum(forceY), torque: fsum(torque), energy: fsum(energy) }
}

function sectorialProperties(segments: WallSegment[], centroidX: number, centroidY: number, shearCenterX: number, shearCenterY: number, ix: number, iy: number, closed = false): { value: number; diagnostics: Record<string, number | null> } {
  if (closed) {
    const length = fsum(segments.map(segmentLength))
    const twiceArea = Math.abs(fsum(segments.map((s) => s.x0 * s.y1 - s.x1 * s.y0)))
    const closureSlope = twiceArea / length
    let cumulative = 0
    const raw = segments.map((segment) => {
      const l = segmentLength(segment), ux = (segment.x1 - segment.x0) / l, uy = (segment.y1 - segment.y0) / l
      const derivative = (segment.x0 - shearCenterX) * uy - (segment.y0 - shearCenterY) * ux - closureSlope
      const item = { segment, start: cumulative, derivative, length: l }
      cumulative += derivative * l
      return item
    })
    const area = fsum(segments.map((s) => s.thickness * segmentLength(s)))
    const mean = fsum(raw.map((item) => item.segment.thickness * (item.start * item.length + item.derivative * item.length ** 2 / 2))) / area
    const cw = fsum(raw.map((item) => {
      const base = item.start - mean, l = item.length, slope = item.derivative
      return item.segment.thickness * l * ((base + slope * l / 2) ** 2 + (slope * l) ** 2 / 12)
    }))
    return { value: cw, diagnostics: { closure_slope: closureSlope, mean_sectorial_coordinate: mean, orthogonality_x: 0, orthogonality_y: 0 } }
  }
  const ordered = orientedTree(segments), starts: number[] = [], derivatives: number[] = []
  const nodeOmega = new Map<string, number>()
  for (const segment of ordered) {
    const startKey = pointKey(segment.x0, segment.y0), endKey = pointKey(segment.x1, segment.y1), l = segmentLength(segment)
    const ux = (segment.x1 - segment.x0) / l, uy = (segment.y1 - segment.y0) / l
    const omegaStart = nodeOmega.get(startKey) || 0
    const derivative = (segment.x0 - shearCenterX) * uy - (segment.y0 - shearCenterY) * ux
    starts.push(omegaStart); derivatives.push(derivative); nodeOmega.set(endKey, omegaStart + derivative * l)
  }
  const lineArea = fsum(ordered.map((s) => s.thickness * segmentLength(s)))
  const mean = fsum(ordered.map((s, i) => s.thickness * (starts[i] * segmentLength(s) + derivatives[i] * segmentLength(s) ** 2 / 2))) / lineArea
  const cwTerms: number[] = [], orthX: number[] = [], orthY: number[] = []
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i], l = segmentLength(s), ux = (s.x1 - s.x0) / l, uy = (s.y1 - s.y0) / l
    const base = starts[i] - mean, derivative = derivatives[i]
    cwTerms.push(s.thickness * l * ((base + derivative * l / 2) ** 2 + (derivative * l) ** 2 / 12))
    const xbase = s.x0 - centroidX, ybase = s.y0 - centroidY
    orthX.push(s.thickness * (base * xbase * l + (base * ux + derivative * xbase) * l ** 2 / 2 + derivative * ux * l ** 3 / 3))
    orthY.push(s.thickness * (base * ybase * l + (base * uy + derivative * ybase) * l ** 2 / 2 + derivative * uy * l ** 3 / 3))
  }
  const cw = fsum(cwTerms)
  const omegaX = fsum(orthX), omegaY = fsum(orthY)
  if (cw === 0) return { value: cw, diagnostics: { mean_sectorial_coordinate: mean, orthogonality_x: null, orthogonality_y: null } }
  return {
    value: cw,
    diagnostics: {
      mean_sectorial_coordinate: mean,
      orthogonality_x: omegaX / Math.max(Math.sqrt(Math.abs(cw * iy)), 1e-300),
      orthogonality_y: omegaY / Math.max(Math.sqrt(Math.abs(cw * ix)), 1e-300),
    },
  }
}

function rectangleWarpingConstant(width: number, height: number): { value: number | null; diagnostics: Record<string, unknown> } {
  const a = Math.max(width, height) / 2, b = Math.min(width, height) / 2
  const method = 'solid_rectangle_fourier_warping_norm'
  const stableFactor = (z: number) => {
    if (z < 1e-3) {
      const z2 = z * z
      return z * z2 * (2 / 3 + z2 * (-8 / 15 + z2 * (34 / 105)))
    }
    if (z > 350) return 1
    const c = Math.cosh(z)
    return Math.tanh(z) - z / (c * c)
  }
  let value = 0, absoluteTailBound = Infinity, roundoffEstimate = Infinity, used = 0
  for (const terms of [16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536]) {
    try {
      const ks = Array.from({ length: terms }, (_, n) => (n + 0.5) * Math.PI / b)
      const ls = Array.from({ length: terms }, (_, m) => (m + 0.5) * Math.PI / a)
      if (ks.some((k) => !Number.isFinite(k ** 7)) || ls.some((l) => !Number.isFinite(l ** 7))) {
        return { value: null, diagnostics: { method, terms, status: 'numerical_range' } }
      }
      const u = 4 / b * fsum(ks.map((k) => stableFactor(k * a) / k ** 7))
      const v = 4 / a * fsum(ls.map((l) => stableFactor(l * b) / l ** 7))
      const cross = -32 / (a * b) * fsum(ks.map((k) => {
        const z = a * k, sech2 = z > 350 ? 0 : 1 / Math.cosh(z) ** 2
        return a * a / (4 * k ** 6) * (2 + sech2) - 3 * a * Math.tanh(z) / (4 * k ** 7)
      }))
      value = fsum([u, v, cross])
      const denominator = Math.max(terms - 0.5, 0.5)
      const uTail = 4 * b ** 6 / (6 * Math.PI ** 7 * denominator ** 6)
      const vTail = 4 * a ** 6 / (6 * Math.PI ** 7 * denominator ** 6)
      const crossTail = 16 * a / b * (b / Math.PI) ** 6 / (5 * denominator ** 5)
      absoluteTailBound = fsum([uTail, vTail, crossTail])
      roundoffEstimate = 64 * Number.EPSILON * fsum([Math.abs(u), Math.abs(v), Math.abs(cross)])
    } catch {
      return { value: null, diagnostics: { method, terms_per_axis: terms, status: 'numerical_range' } }
    }
    used = terms
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(absoluteTailBound)) {
      return { value: null, diagnostics: { method, terms_per_axis: terms, status: 'numerical_range' } }
    }
    const relativeBound = (absoluteTailBound + roundoffEstimate) / value
    if (relativeBound <= 1e-10) {
      return { value, diagnostics: { method, terms_per_axis: terms, absolute_tail_bound: absoluteTailBound, floating_point_abs_error_estimate: roundoffEstimate, relative_error_bound_with_roundoff_estimate: relativeBound, relative_tolerance: 1e-10, converged: true } }
    }
  }
  const relativeBound = value > 0 ? (absoluteTailBound + roundoffEstimate) / value : Infinity
  return { value: null, diagnostics: { method, terms_per_axis: used, absolute_tail_bound: absoluteTailBound, floating_point_abs_error_estimate: roundoffEstimate, relative_error_bound_with_roundoff_estimate: relativeBound, relative_tolerance: 1e-10, converged: false } }
}

type AdvancedOutput = CalculationResult['advanced']
type AdvancedModelOutput = { properties: AdvancedOutput; diagnostics: Record<string, unknown> }

function centerProperty(x: number, y: number, centroidX: number, centroidY: number, method: string): AdvancedOutput['shear_center'] {
  const values = [x, y, x - centroidX, y - centroidY]
  if (!values.every(Number.isFinite)) return unavailable('numerical_range')
  return { status: 'computed', value: { x, y, offset_x: x - centroidX, offset_y: y - centroidY }, reason: null, method }
}

function centerPropertyWithOffsets(x: number, y: number, offsetX: number, offsetY: number, method: string): AdvancedOutput['shear_center'] {
  if (![x, y, offsetX, offsetY].every(Number.isFinite)) return unavailable('numerical_range')
  return { status: 'computed', value: { x, y, offset_x: offsetX, offset_y: offsetY }, reason: null, method }
}

function iSectionCenter(d: Record<string, number>): [number, number, number] {
  const dec = (value: number) => new Decimal80(String(value))
  const h = dec(d.depth), bt = dec(d.top_flange_width), bb = dec(d.bottom_flange_width)
  const tw = dec(d.web_thickness), tt = dec(d.top_flange_thickness), tb = dec(d.bottom_flange_thickness)
  const webHeight = h.minus(tt).minus(tb), yb = tb.div(2), yt = h.minus(tt.div(2))
  const bottomArea = bb.times(tb), webArea = tw.times(webHeight), topArea = bt.times(tt)
  const grossArea = bottomArea.plus(webArea).plus(topArea)
  const grossY = bottomArea.times(yb).plus(webArea.times(tb.plus(webHeight.div(2)))).plus(topArea.times(yt)).div(grossArea)
  const iyBottom = tb.times(bb.pow(3)).div(12), iyTop = tt.times(bt.pow(3)).div(12)
  const centerY = iyBottom.times(yb).plus(iyTop.times(yt)).div(iyBottom.plus(iyTop))
  return [Decimal80.max(bt, bb).div(2).toNumber(), centerY.toNumber(), centerY.minus(grossY).toNumber()]
}

function scalarProperty(value: number | null, method: string): AdvancedOutput['torsion_constant_j'] {
  if (value === null) return unavailable('numerical_range')
  return { status: 'computed', value, reason: null, method }
}

function shearAreaProperty(x: number | null, y: number | null, method: string): AdvancedOutput['effective_shear_area'] {
  if (x === null || y === null) return unavailable('numerical_range')
  return { status: 'computed', value: { x, y }, reason: null, method }
}

function advancedModel(
  geometry: GeometryDefinition,
  width: number,
  height: number,
  centroidX: number,
  centroidY: number,
  options: NormalizedOptions,
): AdvancedModelOutput {
  const scale = Math.max(width, height), wn = width / scale, hn = height / scale
  const needed = new Set(options.required_properties)
  if (options.include_advanced) for (const property of REQUIRED_PROPERTIES) needed.add(property)
  const properties: AdvancedOutput = {
    torsion_constant_j: unavailable('not_requested'),
    warping_constant_cw: unavailable('not_requested'),
    shear_center: unavailable('not_requested'),
    effective_shear_area: unavailable('not_requested'),
  }
  if (!needed.size) return { properties, diagnostics: { status: 'not_requested', model: 'advanced_properties_not_requested', assumptions: [] } }
  const rangeFailures: string[] = []
  let diag: Record<string, unknown>
  let assumptions: string[]

  if (geometry.type === 'rectangle') {
    const d = geometry.dimensions, scx = wn / 2, scy = hn / 2
    let torsion: RectangleTorsion | null = null
    let torsionDiagnostics: Record<string, unknown>
    if (needed.has('torsion_constant_j')) {
      torsion = rectangleTorsion(wn, hn, options.rectangle_j_relative_tolerance, options.rectangle_j_max_terms)
      torsionDiagnostics = { ...torsion.diagnostics }
      for (const key of ['truncation_abs_error_bound', 'floating_point_abs_error_estimate']) {
        const value = torsionDiagnostics[key]
        if (typeof value === 'number') torsionDiagnostics[key] = rescaleDimensionless(value, scale, 4)
      }
      if (!torsion.converged && options.required_properties.includes('torsion_constant_j')) {
        throw calculationError('Required rectangle torsion did not meet the requested tolerance.', {
          property: 'torsion_constant_j', reason: torsion.reason, ...torsionDiagnostics,
        })
      }
      const value = torsion.value === null ? null : rescaleDimensionless(torsion.value, scale, 4)
      properties.torsion_constant_j = value === null
        ? unavailable(torsion.reason || 'numerical_range')
        : { status: 'computed', value, reason: null, method: 'solid_rectangle_saint_venant_odd_series' }
      if (properties.torsion_constant_j.status !== 'computed') rangeFailures.push('torsion_constant_j')
    } else {
      torsionDiagnostics = { method: 'solid_rectangle_saint_venant_odd_series', status: 'not_requested' }
    }
    let warpingDiagnostics: Record<string, unknown> | null = null
    if (needed.has('warping_constant_cw')) {
      const cw = rectangleWarpingConstant(wn, hn)
      warpingDiagnostics = cw.diagnostics
      const value = cw.value === null ? null : rescaleDimensionless(cw.value, scale, 6)
      properties.warping_constant_cw = value === null
        ? unavailable(cw.diagnostics.converged === false ? 'convergence_not_achieved' : 'numerical_range')
        : { status: 'computed', value, reason: null, method: 'solid_rectangle_saint_venant_fourier' }
      if (properties.warping_constant_cw.status !== 'computed') rangeFailures.push('warping_constant_cw')
    } else {
      // Kept in a local so diagnostics are conditional exactly as in Python.
    }
    if (needed.has('shear_center')) properties.shear_center = centerProperty(scx * scale, scy * scale, centroidX, centroidY, 'geometric_symmetry')
    if (needed.has('effective_shear_area')) {
      const area = rescaleDimensionless(wn * hn * 5 / 6, scale, 2)
      properties.effective_shear_area = shearAreaProperty(area, area, 'jourawski_rectangle_five_sixths_area')
      if (properties.effective_shear_area.status !== 'computed') rangeFailures.push('effective_shear_area')
    }
    diag = { model: 'solid_rectangle', torsion: torsionDiagnostics }
    if (warpingDiagnostics) diag.warping = warpingDiagnostics
    assumptions = ['homogeneous_isotropic_geometry_only', 'rectangle_shear_area_uses_jourawski_five_sixths_convention']
  } else if (geometry.type === 'circle') {
    const diameter = geometry.dimensions.diameter / scale
    if (needed.has('torsion_constant_j')) properties.torsion_constant_j = scalarProperty(rescaleDimensionless(Math.PI * diameter ** 4 / 32, scale, 4), 'solid_circle_closed_form')
    if (needed.has('warping_constant_cw')) properties.warping_constant_cw = { status: 'computed', value: 0, reason: null, method: 'axisymmetric_zero_warping' }
    if (needed.has('shear_center')) properties.shear_center = centerProperty(width / 2, height / 2, centroidX, centroidY, 'axisymmetric_centroid')
    if (needed.has('effective_shear_area')) {
      const area = rescaleDimensionless(Math.PI * diameter ** 2 / 4 * 0.9, scale, 2)
      properties.effective_shear_area = shearAreaProperty(area, area, 'solid_circle_geometric_nine_tenths_area')
      if (properties.effective_shear_area.status !== 'computed') rangeFailures.push('effective_shear_area')
    }
    diag = { model: 'solid_circle', warping: { method: 'axisymmetric_zero_warping' } }
    assumptions = ['homogeneous_isotropic_geometry_only', 'solid_circle_effective_shear_area_uses_geometric_nine_tenths_area_convention']
  } else if (geometry.type === 'circular_hollow') {
    const d = geometry.dimensions.diameter / scale, t = geometry.dimensions.thickness / scale
    if (needed.has('torsion_constant_j')) {
      const j = rescaleDimensionless(Math.PI * t * (d - t) * (d ** 2 + (d - 2 * t) ** 2) / 8, scale, 4)
      properties.torsion_constant_j = scalarProperty(j, 'circular_hollow_exact_polar_moment')
      if (properties.torsion_constant_j.status !== 'computed') rangeFailures.push('torsion_constant_j')
    }
    if (needed.has('warping_constant_cw')) properties.warping_constant_cw = { status: 'computed', value: 0, reason: null, method: 'axisymmetric_zero_warping' }
    if (needed.has('shear_center')) properties.shear_center = centerProperty(width / 2, height / 2, centroidX, centroidY, 'axisymmetric_centroid')
    if (needed.has('effective_shear_area')) {
      const area = rescaleDimensionless(Math.PI * (d - t) / 2 * t, scale, 2)
      properties.effective_shear_area = shearAreaProperty(area, area, 'circular_hollow_thin_wall_shear_flow')
      if (properties.effective_shear_area.status !== 'computed') rangeFailures.push('effective_shear_area')
    }
    diag = { model: 'uniform_wall_circular', warping: { method: 'axisymmetric_zero_warping' }, effective_shear_area: { formula: 'pi*R_m*t' } }
    assumptions = ['circular_closed_form_geometry', 'thin_wall_shear_energy_uses_median_radius']
  } else if (geometry.type === 'rectangular_hollow') {
    const t = geometry.dimensions.thickness / scale, segments = rhsSegments(geometry, scale)
    const bw = wn - t, bh = hn - t, medianArea = bw * bh, medianPerimeter = 2 * (bw + bh)
    const line = lineProperties(segments), jdim = 4 * medianArea ** 2 / (medianPerimeter / t)
    if (needed.has('torsion_constant_j')) {
      properties.torsion_constant_j = scalarProperty(rescaleDimensionless(jdim, scale, 4), 'single_cell_bredt_thin_wall')
      if (properties.torsion_constant_j.status !== 'computed') rangeFailures.push('torsion_constant_j')
    }
    if (needed.has('shear_center')) properties.shear_center = centerProperty(width / 2, height / 2, centroidX, centroidY, 'closed_cell_shear_flow_symmetry')
    let sectorial: { value: number; diagnostics: Record<string, number | null> } | null = null
    if (needed.has('warping_constant_cw')) {
      sectorial = sectorialProperties(segments, wn / 2, hn / 2, wn / 2, hn / 2, 1, 1, true)
      const cwDimensionless = geometry.dimensions.width === geometry.dimensions.height ? 0 : sectorial.value
      const cw = rescaleDimensionless(Math.max(cwDimensionless, 0), scale, 6, true)
      properties.warping_constant_cw = scalarProperty(cw, 'closed_section_sectorial_thin_wall')
      if (properties.warping_constant_cw.status !== 'computed') rangeFailures.push('warping_constant_cw')
    }
    let flowResponses: Record<string, FlowResponse> | null = null
    if (needed.has('effective_shear_area')) {
      const fx = flowResponse(flowPolynomials(segments, line.cx, line.cy, line.ix, line.iy, line.ixy, 'x', true), line.cx, line.cy)
      const fy = flowResponse(flowPolynomials(segments, line.cx, line.cy, line.ix, line.iy, line.ixy, 'y', true), line.cx, line.cy)
      flowResponses = { x: fx, y: fy }
      const ax = rescaleDimensionless(1 / fx.energy, scale, 2), ay = rescaleDimensionless(1 / fy.energy, scale, 2)
      properties.effective_shear_area = shearAreaProperty(ax, ay, 'closed_cell_thin_wall_shear_energy')
      if (properties.effective_shear_area.status !== 'computed') rangeFailures.push('effective_shear_area')
    }
    diag = {
      model: 'sharp_corner_closed_cell_centerline_thin_wall', median_cell_area: medianArea, median_perimeter: medianPerimeter,
      line_area: line.area, line_centroid: { x: line.cx, y: line.cy }, line_inertias: { ix: line.ix, iy: line.iy, ixy: line.ixy },
      sectorial: sectorial?.diagnostics || {},
    }
    if (flowResponses) diag.unit_shear_responses = flowResponses
    assumptions = ['sharp_corner_uniform_thickness_median_line', 'single_cell_bredt_torsion', 'closed_cell_shear_flow_uses_zero_twist_compatibility', 'no_corner_radii_or_thick_wall_elasticity']
  } else {
    const segments = wallSegments(geometry, scale), ordered = orientedTree(segments), line = lineProperties(ordered)
    if (![line.area, line.ix, line.iy].every((value) => Number.isFinite(value) && value > 0)) throw new ArithmeticError()
    const needsFlow = ['warping_constant_cw', 'shear_center', 'effective_shear_area'].some((key) => needed.has(key))
    let responseX: FlowResponse | null = null, responseY: FlowResponse | null = null
    let flowScx = line.cx, flowScy = line.cy
    if (needsFlow) {
      responseX = flowResponse(flowPolynomials(ordered, line.cx, line.cy, line.ix, line.iy, line.ixy, 'x'), line.cx, line.cy)
      responseY = flowResponse(flowPolynomials(ordered, line.cx, line.cy, line.ix, line.iy, line.ixy, 'y'), line.cx, line.cy)
      flowScx = line.cx + responseY.torque
      flowScy = line.cy - responseX.torque
    }
    if (needed.has('torsion_constant_j')) {
      const jdim = fsum(ordered.filter((s) => s.thickness > 0).map((s) => segmentLength(s) * s.thickness ** 3 / 3))
      properties.torsion_constant_j = scalarProperty(rescaleDimensionless(jdim, scale, 4), 'open_section_thin_wall_j')
      if (properties.torsion_constant_j.status !== 'computed') rangeFailures.push('torsion_constant_j')
    }
    if (needed.has('shear_center')) {
      if (geometry.type === 'i_section') {
        const [x, y, offsetY] = iSectionCenter(geometry.dimensions)
        properties.shear_center = centerPropertyWithOffsets(x, y, 0, offsetY, 'open_section_shear_flow')
      } else if (geometry.type === 'channel') {
        const x = flowScx * scale
        properties.shear_center = centerPropertyWithOffsets(x, height / 2, x - centroidX, 0, 'open_section_shear_flow')
      } else if (geometry.type === 'tee' || geometry.type === 'double_angle') {
        const y = flowScy * scale
        properties.shear_center = centerPropertyWithOffsets(width / 2, y, 0, y - centroidY, 'open_section_shear_flow')
      } else {
        properties.shear_center = centerProperty(flowScx * scale, flowScy * scale, centroidX, centroidY, 'open_section_shear_flow')
      }
    }
    if (needed.has('effective_shear_area')) {
      const ax = rescaleDimensionless(1 / responseX!.energy, scale, 2), ay = rescaleDimensionless(1 / responseY!.energy, scale, 2)
      properties.effective_shear_area = shearAreaProperty(ax, ay, 'open_section_thin_wall_shear_energy')
      if (properties.effective_shear_area.status !== 'computed') rangeFailures.push('effective_shear_area')
    }
    let orthogonality: Record<string, number | null> = {}
    if (needed.has('warping_constant_cw')) {
      let sectorial = sectorialProperties(ordered, line.cx, line.cy, flowScx, flowScy, line.ix, line.iy)
      if (geometry.type === 'tee' || geometry.type === 'angle') {
        sectorial = { value: 0, diagnostics: { mean_sectorial_coordinate: sectorial.diagnostics.mean_sectorial_coordinate, orthogonality_x: null, orthogonality_y: null } }
      }
      orthogonality = sectorial.diagnostics
      const cw = rescaleDimensionless(sectorial.value, scale, 6, true)
      properties.warping_constant_cw = scalarProperty(cw, 'open_section_sectorial_thin_wall')
      if (properties.warping_constant_cw.status !== 'computed') rangeFailures.push('warping_constant_cw')
    }
    diag = {
      model: 'centerline_open_thin_wall', line_area: line.area, line_centroid: { x: line.cx, y: line.cy },
      line_inertias: { ix: line.ix, iy: line.iy, ixy: line.ixy },
    }
    if (needsFlow) diag.unit_shear_responses = { x: responseX, y: responseY }
    if (needed.has('warping_constant_cw')) diag.sectorial_orthogonality = orthogonality
    assumptions = geometry.type === 'double_angle'
      ? ['open_section_centerline_thin_wall', 'uniform_thickness_on_each_wall', 'ideal_rigid_link_has_no_area_j_or_shear_energy', 'two_mirrored_angles_share_equal_twist', 'rigid_heel_link_transfers_reaction_flow_without_area_or_energy', 'zero_clear_gap_does_not_create_a_continuous_welded_web']
      : ['open_section_centerline_thin_wall', 'uniform_thickness_on_each_wall', 'no_fillet_or_finite_wall_elasticity']
  }

  for (const name of options.required_properties) {
    const property = properties[name as keyof AdvancedOutput]
    if (property.status !== 'computed') throw calculationError('A required advanced property is outside the numerical range.', { property: name, reason: property.reason || 'numerical_range' })
  }
  const diagnostics: Record<string, unknown> = {
    status: rangeFailures.length ? 'partial' : 'computed', model: diag.model, assumptions, range_failures: rangeFailures,
    normalization_length_mm: scale, normalized_geometry_diagnostics: true,
    ...Object.fromEntries(Object.entries(diag).filter(([key]) => key !== 'model')),
  }
  if (properties.torsion_constant_j.status !== 'not_computed' || properties.torsion_constant_j.reason !== 'not_requested') diagnostics.torsion_method = properties.torsion_constant_j.method
  if (properties.warping_constant_cw.status !== 'not_computed' || properties.warping_constant_cw.reason !== 'not_requested') diagnostics.warping_method = properties.warping_constant_cw.method
  if (properties.shear_center.status !== 'not_computed' || properties.shear_center.reason !== 'not_requested') diagnostics.shear_center_method = properties.shear_center.method
  if (properties.effective_shear_area.status !== 'not_computed' || properties.effective_shear_area.reason !== 'not_requested') diagnostics.effective_shear_area_method = properties.effective_shear_area.method
  return { properties, diagnostics }
}

// JavaScript has no named ArithmeticError; use this private marker to follow
// the Python engine's floating-point-range error boundary.
class ArithmeticError extends Error {}

function unavailable(reason: string) { return { status: 'not_computed' as const, value: null, reason, method: null } }

function assertFiniteTree(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(assertFiniteTree)
  if (isRecord(value)) return Object.values(value).every(assertFiniteTree)
  return true
}

/** Calculate a sectional-properties result entirely in the browser. */
export function calculateCoreValues(request: CalculationRequest): CalculationResult {
  const { geometry, options } = validateRequest(request)
  try {
    let width: number, height: number, area: number, perimeter: number, centroidX: number, centroidY: number, ix: number, iy: number, ixy = 0
    let plastic: { pna_x: number; pna_y: number; zx: number; zy: number } | null = null
    const intermediates: Record<string, number> = {}
    const diagnostics: { plastic: Record<string, unknown> } & Record<string, unknown> = { plastic: { status: 'not_computed', reason: 'not_requested' } }
    let geometryComponents: Component[] | null = null
    const d = geometry.dimensions
    if (geometry.type === 'rectangle') {
      width = d.width; height = d.height
      area = width * height
      centroidX = width / 2; centroidY = height / 2
      perimeter = 2 * (width + height)
      ix = width * height ** 3 / 12; iy = height * width ** 3 / 12
      if (options.include_plastic) {
        plastic = { pna_x: centroidX, pna_y: centroidY, zx: width * height ** 2 / 4, zy: height * width ** 2 / 4 }
        diagnostics.plastic = { status: 'computed', method: 'symmetric_closed_form', relative_area_imbalance: 0 }
      }
    } else if (geometry.type === 'circle') {
      width = d.diameter; height = d.diameter
      area = Math.PI * width ** 2 / 4
      centroidX = width / 2; centroidY = height / 2
      perimeter = Math.PI * width
      ix = Math.PI * width ** 4 / 64; iy = ix
      if (options.include_plastic) {
        plastic = { pna_x: centroidX, pna_y: centroidY, zx: width ** 3 / 6, zy: width ** 3 / 6 }
        diagnostics.plastic = { status: 'computed', method: 'symmetric_closed_form', relative_area_imbalance: 0 }
      }
    } else if (geometry.type === 'circular_hollow') {
      width = d.diameter; height = d.diameter
      const innerDiameter = width - 2 * d.thickness
      area = Math.PI * d.thickness * (width - d.thickness)
      centroidX = width / 2; centroidY = height / 2
      perimeter = Math.PI * (width + innerDiameter)
      ix = area * (width ** 2 + innerDiameter ** 2) / 16; iy = ix
      if (options.include_plastic) {
        const plasticZ = 2 * d.thickness * (width ** 2 + width * innerDiameter + innerDiameter ** 2) / 6
        plastic = { pna_x: centroidX, pna_y: centroidY, zx: plasticZ, zy: plasticZ }
        diagnostics.plastic = { status: 'computed', method: 'annulus_symmetric_closed_form', relative_area_imbalance: 0 }
      }
    } else {
      const parts = components(geometry)
      geometryComponents = parts
      if (geometry.type === 'i_section') width = Math.max(d.top_flange_width, d.bottom_flange_width)
      else if (geometry.type === 'rectangular_hollow') width = d.width
      else if (geometry.type === 'double_angle') width = 2 * d.width + d.distance
      else width = d.width
      height = geometry.type === 'rectangular_hollow' ? d.height : d.depth
      area = fsum(parts.map((part) => part.area))
      if (!Number.isFinite(area) || area <= 0) throw new ArithmeticError()
      centroidX = geometry.type === 'i_section' ? width / 2 : fsum(parts.map((part) => part.area * (part.x + part.width / 2))) / area
      centroidY = fsum(parts.map((part) => part.area * (part.y + part.height / 2))) / area
      ix = fsum(parts.map((part) => part.width * part.height ** 3 / 12 + part.area * (part.y + part.height / 2 - centroidY) ** 2))
      iy = fsum(parts.map((part) => part.height * part.width ** 3 / 12 + part.area * (part.x + part.width / 2 - centroidX) ** 2))
      ixy = fsum(parts.map((part) => part.area * (part.x + part.width / 2 - centroidX) * (part.y + part.height / 2 - centroidY)))
      if (geometry.type !== 'angle') ixy = 0
      if (geometry.type === 'i_section') {
        perimeter = 2 * (d.top_flange_width + d.bottom_flange_width + height - d.web_thickness)
        intermediates.web_clear_depth = parts[1].height
        intermediates.bottom_flange_area = parts[0].area
        intermediates.web_area = parts[1].area
        intermediates.top_flange_area = parts[2].area
      } else if (geometry.type === 'rectangular_hollow') {
        const innerWidth = width - 2 * d.thickness
        const innerHeight = height - 2 * d.thickness
        perimeter = 2 * (width + height) + 2 * (innerWidth + innerHeight)
        intermediates.inner_width = innerWidth
        intermediates.inner_height = innerHeight
        intermediates.wall_thickness = d.thickness
      } else if (geometry.type === 'channel') {
        perimeter = 2 * height + 4 * width - 2 * d.web_thickness
        intermediates.clear_web_depth = parts[1].height
        intermediates.web_area = parts[1].area
        intermediates.flange_area_each = parts[0].area
      } else if (geometry.type === 'tee') {
        perimeter = 2 * (width + height)
        intermediates.clear_web_depth = parts[0].height
        intermediates.web_area = parts[0].area
        intermediates.flange_area = parts[1].area
      } else if (geometry.type === 'double_angle') {
        perimeter = 4 * (d.width + d.depth) - (d.distance === 0 ? 2 * d.depth : 0)
        intermediates.overall_width = width
        intermediates.clear_distance = d.distance
        intermediates.clear_vertical_leg_depth = parts[1].height
        intermediates.horizontal_leg_area_each = parts[0].area
        intermediates.vertical_leg_area_each = parts[1].area
      } else {
        perimeter = 2 * (width + height)
        intermediates.clear_vertical_leg_depth = parts[1].height
        intermediates.horizontal_leg_area = parts[0].area
        intermediates.vertical_leg_area = parts[1].area
      }
      if (options.include_plastic) {
        if (geometry.type === 'i_section') {
          const axis = decimalPlasticAxis(geometry)
          const pnaX = width / 2
          const zy = fsum(parts.map((part) => part.height * part.width ** 2 / 4))
          plastic = { pna_x: pnaX, pna_y: axis.pna, zx: axis.zx, zy }
          intermediates.pna_x = pnaX
          intermediates.pna_y = axis.pna
          diagnostics.plastic = { status: 'computed', ...axis.diagnostics }
        } else {
          const xAxis = decimalPlasticAxisForComponents(parts, 'x')
          const yAxis = decimalPlasticAxisForComponents(parts, 'y')
          plastic = { pna_x: xAxis.pna, pna_y: yAxis.pna, zx: yAxis.z, zy: xAxis.z }
          intermediates.pna_x = xAxis.pna
          intermediates.pna_y = yAxis.pna
          diagnostics.plastic = {
            status: 'computed',
            method: 'component_area_bisection_with_piecewise_linear_refinement',
            x_axis: xAxis.diagnostics,
            y_axis: yAxis.diagnostics,
          }
        }
      }
    }

    if (![area, ix, iy].every((value) => Number.isFinite(value) && value > 0)) throw new ArithmeticError()
    if (!Number.isFinite(perimeter) || perimeter <= 0 || !Number.isFinite(ixy)) throw new ArithmeticError()
    if (!(centroidX > 0 && centroidX < width && centroidY > 0 && centroidY < height)) throw new ArithmeticError()
    const elastic = {
      ix,
      iy,
      ixy,
      sx_positive: ix / (height - centroidY),
      sx_negative: ix / centroidY,
      sy_positive: iy / (width - centroidX),
      sy_negative: iy / centroidX,
      rx: Math.sqrt(ix / area),
      ry: Math.sqrt(iy / area),
    }
    const principal = principalProperties(ix, iy, ixy)
    const advancedModelResult = advancedModel(geometry, width, height, centroidX, centroidY, options)
    diagnostics.advanced_model = advancedModelResult.diagnostics
    if (geometryComponents) diagnostics.components = geometryComponents
    const advancedTorsion = advancedModelResult.diagnostics.torsion
    if (isRecord(advancedTorsion) && advancedTorsion.status !== 'not_requested') diagnostics.torsion = advancedTorsion
    const result: CalculationResult = {
      schema_version: '1.0',
      geometry_model_version: GEOMETRY_MODEL_VERSION,
      geometry_type: geometry.type,
      geometry_hash: geometryHash(geometry),
      solver: { method: 'analytical', version: SOLVER_VERSION, config_hash: configHash(options) },
      units: { length: 'mm', area: 'mm2', section_modulus: 'mm3', second_moment: 'mm4', torsion_constant: 'mm4', warping_constant: 'mm6', shear_center: 'mm', effective_shear_area: 'mm2', angle: 'deg' },
      normalized_input: { geometry, units: 'mm', options },
      properties: {
        geometric: { area, perimeter, centroid_x: centroidX, centroid_y: centroidY },
        elastic,
        plastic,
        principal,
      },
      advanced: advancedModelResult.properties,
      diagnostics: {
        ...diagnostics,
        intermediate: intermediates,
        bounding_box: { x_min: 0, y_min: 0, x_max: width, y_max: height },
        assumptions: ['dimensions_in_mm', 'xy_plane_x_right_y_up', 'bbox_origin_bottom_left', 'centroidal_unrotated_inertias', 'positive_coordinate_product_ixy', 'sharp_corners', 'homogeneous_geometric_plastic_properties'],
      },
      status: 'success',
    }
    if (!assertFiniteTree(result)) throw new ArithmeticError()
    return result
  } catch (error) {
    if (error instanceof DemoCalculationError) throw error
    if (error instanceof ArithmeticError || error instanceof RangeError || (error instanceof Error && error.message.startsWith('[DecimalError]'))) {
      throw calculationError('Calculation cannot produce finite, positive properties at this numerical scale.', { reason: 'floating_point_range' })
    }
    throw error
  }
}

/** Compatibility entry point; all numerical work remains synchronous in this single core. */
export async function calculateDemoSection(request: CalculationRequest): Promise<CalculationResult> {
  return calculateCoreValues(request)
}
