import Decimal from 'decimal.js'
import type { CalculationRequest, CalculationResult, GeometryDefinition } from './types'

const SOLVER_VERSION = '1.0.0'
const GEOMETRY_MODEL_VERSION = '1.0.0'
const Decimal80 = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_EVEN })
const REQUIRED_PROPERTIES = new Set([
  'torsion_constant_j',
  'warping_constant_cw',
  'shear_center',
  'effective_shear_area',
])
const DIMENSIONS: Record<string, string[]> = {
  rectangle: ['width', 'height'],
  circle: ['diameter'],
  i_section: ['depth', 'top_flange_width', 'bottom_flange_width', 'web_thickness', 'top_flange_thickness', 'bottom_flange_thickness'],
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
  const code: CalculationErrorCode = hasVariant
    ? 'UNSUPPORTED_VARIANT'
    : invalidGeometry
      ? 'INVALID_GEOMETRY'
      : badUnits
        ? 'UNSUPPORTED_UNITS'
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
    if (typeof variant !== 'string' || !['solid', 'sharp_corner'].includes(variant)) {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: 'Input should be a supported geometry variant' })
    } else if ((type === 'rectangle' || type === 'circle') && variant !== 'solid') {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: "Input should be 'solid'" })
    } else if (type === 'i_section' && variant !== 'sharp_corner') {
      errors.push({ path: 'geometry.geometry_variant', type: 'literal_error', message: "Input should be 'sharp_corner'" })
    }
    const modelVersion = inputGeometry.geometry_model_version === undefined ? GEOMETRY_MODEL_VERSION : inputGeometry.geometry_model_version
    if (modelVersion !== GEOMETRY_MODEL_VERSION) errors.push({ path: 'geometry.geometry_model_version', type: 'literal_error', message: "Input should be '1.0.0'" })
    const dimensionsRaw = requireRecord(inputGeometry.dimensions, 'geometry.dimensions', errors)
    const dimensions: Record<string, number> = {}
    if (dimensionsRaw && typeof type === 'string' && Object.prototype.hasOwnProperty.call(DIMENSIONS, type)) {
      const names = DIMENSIONS[type]
      for (const key of keysOutside(dimensionsRaw, names)) errors.push({ path: `geometry.dimensions.${key}`, type: 'extra_forbidden', message: 'Extra inputs are not permitted' })
      for (const name of names) {
        if (!Object.prototype.hasOwnProperty.call(dimensionsRaw, name)) {
          errors.push({ path: `geometry.dimensions.${name}`, type: 'missing', message: 'Field required' })
        } else {
          const value = finiteStrictNumber(dimensionsRaw[name], `geometry.dimensions.${name}`, errors, true)
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
  const { depth, top_flange_width: top, bottom_flange_width: bottom, web_thickness: web, top_flange_thickness: topT, bottom_flange_thickness: bottomT } = g.dimensions
  const width = Math.max(top, bottom)
  const webHeight = depth - topT - bottomT
  return [
    { width: bottom, height: bottomT, x: (width - bottom) / 2, y: 0, area: bottom * bottomT },
    { width: web, height: webHeight, x: (width - web) / 2, y: bottomT, area: web * webHeight },
    { width: top, height: topT, x: (width - top) / 2, y: depth - topT, area: top * topT },
  ]
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

// JavaScript has no named ArithmeticError; use this private marker to follow
// the Python engine's floating-point-range error boundary.
class ArithmeticError extends Error {}

function unavailable(reason: string) { return { status: 'not_computed' as const, value: null, reason } }

function assertFiniteTree(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(assertFiniteTree)
  if (isRecord(value)) return Object.values(value).every(assertFiniteTree)
  return true
}

/** Calculate a sectional-properties result entirely in the browser. */
export async function calculateDemoSection(request: CalculationRequest): Promise<CalculationResult> {
  const { geometry, options } = validateRequest(request)
  const unsupported = Array.from(new Set(options.required_properties.filter((name) => name !== 'torsion_constant_j'))).sort()
  if (geometry.type === 'i_section' && options.required_properties.includes('torsion_constant_j') && !unsupported.includes('torsion_constant_j')) unsupported.push('torsion_constant_j')
  if (unsupported.length) {
    throw new DemoCalculationError('UNSUPPORTED_PROPERTY', 'A required advanced property has no v1 solver.', { properties: unsupported.sort(), reason: 'solver_not_implemented' })
  }

  try {
    let width: number, height: number, area: number, perimeter: number, centroidX: number, centroidY: number, ix: number, iy: number
    let plastic: { pna_x: number; pna_y: number; zx: number; zy: number } | null = null
    const intermediates: Record<string, number> = {}
    const diagnostics: { plastic: Record<string, unknown> } & Record<string, unknown> = { plastic: { status: 'not_computed', reason: 'not_requested' } }
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
    } else {
      const parts = components(geometry)
      width = Math.max(d.top_flange_width, d.bottom_flange_width); height = d.depth
      area = fsum(parts.map((part) => part.area))
      if (!Number.isFinite(area) || area <= 0) throw new ArithmeticError()
      centroidX = width / 2
      centroidY = fsum(parts.map((part) => part.area * (part.y + part.height / 2))) / area
      ix = fsum(parts.map((part) => part.width * part.height ** 3 / 12 + part.area * (part.y + part.height / 2 - centroidY) ** 2))
      iy = fsum(parts.map((part) => part.height * part.width ** 3 / 12))
      perimeter = 2 * (d.top_flange_width + d.bottom_flange_width + height - d.web_thickness)
      intermediates.web_clear_depth = parts[1].height
      intermediates.bottom_flange_area = parts[0].area
      intermediates.web_area = parts[1].area
      intermediates.top_flange_area = parts[2].area
      if (options.include_plastic) {
        const axis = decimalPlasticAxis(geometry)
        const zy = fsum(parts.map((part) => part.height * part.width ** 2 / 4))
        plastic = { pna_x: centroidX, pna_y: axis.pna, zx: axis.zx, zy }
        intermediates.pna_x = centroidX
        intermediates.pna_y = axis.pna
        diagnostics.plastic = { status: 'computed', ...axis.diagnostics }
      }
    }

    if (![area, ix, iy].every((value) => Number.isFinite(value) && value > 0)) throw new ArithmeticError()
    if (!(centroidX > 0 && centroidX < width && centroidY > 0 && centroidY < height)) throw new ArithmeticError()
    const elastic = {
      ix,
      iy,
      ixy: 0,
      sx_positive: ix / (height - centroidY),
      sx_negative: ix / centroidY,
      sy_positive: iy / (width - centroidX),
      sy_negative: iy / centroidX,
      rx: Math.sqrt(ix / area),
      ry: Math.sqrt(iy / area),
    }
    const principal = {
      i_major: Math.max(ix, iy),
      i_minor: Math.min(ix, iy),
      major_axis_angle_degrees: ix === iy ? null : ix > iy ? 0 : 90,
      orientation_status: ix === iy ? 'indeterminate' as const : 'determinate' as const,
    }
    const wantJ = options.include_advanced || options.required_properties.includes('torsion_constant_j')
    let torsionConstantJ: CalculationResult['advanced']['torsion_constant_j'] = unavailable('not_requested')
    if (geometry.type === 'i_section') {
      torsionConstantJ = unavailable('solver_not_implemented')
    } else if (wantJ && geometry.type === 'circle') {
      torsionConstantJ = { status: 'computed', value: Math.PI * geometry.dimensions.diameter ** 4 / 32, reason: null }
      diagnostics.torsion = { method: 'solid_circle_closed_form' }
    } else if (wantJ) {
      const torsion = rectangleTorsion(width, height, options.rectangle_j_relative_tolerance, options.rectangle_j_max_terms)
      diagnostics.torsion = torsion.diagnostics
      if (torsion.converged) {
        torsionConstantJ = { status: 'computed', value: torsion.value, reason: null }
      } else if (options.required_properties.includes('torsion_constant_j')) {
        throw calculationError('Required rectangle torsion did not meet the requested tolerance.', { property: 'torsion_constant_j', reason: torsion.reason, ...torsion.diagnostics })
      } else {
        torsionConstantJ = unavailable(torsion.reason || 'convergence_not_achieved')
      }
    }
    const result: CalculationResult = {
      schema_version: '1.0',
      geometry_model_version: GEOMETRY_MODEL_VERSION,
      geometry_type: geometry.type,
      geometry_hash: geometryHash(geometry),
      solver: { method: 'analytical', version: SOLVER_VERSION, config_hash: configHash(options) },
      units: { length: 'mm', area: 'mm2', section_modulus: 'mm3', second_moment: 'mm4', torsion_constant: 'mm4', warping_constant: 'mm6', angle: 'deg' },
      normalized_input: { geometry, units: 'mm', options },
      properties: {
        geometric: { area, perimeter, centroid_x: centroidX, centroid_y: centroidY },
        elastic,
        plastic,
        principal,
      },
      advanced: {
        torsion_constant_j: torsionConstantJ,
        warping_constant_cw: unavailable('solver_not_implemented'),
        shear_center: unavailable('solver_not_implemented'),
        effective_shear_area: unavailable('solver_not_implemented'),
      },
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
