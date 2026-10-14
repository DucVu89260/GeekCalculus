const ASYMMETRIC_I_DIMENSIONS = [
  'top_flange_width',
  'bottom_flange_width',
  'top_flange_thickness',
  'bottom_flange_thickness',
]
const DERIVED_LEGACY_PROPERTIES = new Set([
  'area', 'inertia_x', 'inertia_y', 'inertia_z', 'torsion_constant',
  'elastic_modulus_x', 'elastic_modulus_y', 'elastic_modulus_z',
  'shear_area_x', 'shear_area_y', 'shear_area_z', 'warping_constant',
  'plastic_modulus_x', 'plastic_modulus_y', 'plastic_modulus_z',
  'shear_center_x', 'shear_center_y', 'shear_center_z',
  'section_modulus_x', 'section_modulus_y', 'section_modulus_z',
  'radius_gyration_x', 'radius_gyration_y', 'radius_gyration_z',
])

export function isCatalogDerivedSectionProperty(key) {
  return DERIVED_LEGACY_PROPERTIES.has(key)
}

export const CATALOG_GEOMETRY_KEYS = Object.freeze({
  rectangle: ['depth', 'width'],
  circle: ['diameter'],
  i: ['depth', 'width', 'web_thickness', 'flange_thickness', ...ASYMMETRIC_I_DIMENSIONS],
  rectangular_hollow: ['depth', 'width', 'thickness'],
  circular_hollow: ['diameter', 'thickness'],
  channel: ['depth', 'width', 'web_thickness', 'flange_thickness'],
  tee: ['depth', 'width', 'web_thickness', 'flange_thickness'],
  angle: ['depth', 'width', 'thickness'],
})

function numericProperty(properties, key) {
  const raw = properties?.[key]
  if (raw === '' || raw === null || raw === undefined) return null
  const number = Number(raw)
  return Number.isFinite(number) && number > 0 ? number : null
}

function hasValue(properties, key) {
  const raw = properties?.[key]
  return raw !== '' && raw !== null && raw !== undefined
}

function dimensionsFrom(properties, keys) {
  const result = {}
  for (const key of keys) {
    const value = numericProperty(properties, key)
    if (value === null) return null
    result[key] = value
  }
  return result
}

export function catalogGeometryMode(shape, properties = {}) {
  if (shape !== 'i') return null
  return ASYMMETRIC_I_DIMENSIONS.some((key) => hasValue(properties, key)) ? 'asymmetric' : 'symmetric'
}

/** Convert the engineering-library dimension names into the solver's canonical request. */
export function buildCatalogSectionCalculationRequest(shape, properties = {}) {
  let type
  let geometryVariant = 'sharp_corner'
  let dimensions

  if (shape === 'rectangle') {
    const mapped = dimensionsFrom(properties, ['depth', 'width'])
    if (!mapped) return null
    type = 'rectangle'
    geometryVariant = 'solid'
    dimensions = { width: mapped.width, height: mapped.depth }
  } else if (shape === 'circle') {
    const mapped = dimensionsFrom(properties, ['diameter'])
    if (!mapped) return null
    type = 'circle'
    geometryVariant = 'solid'
    dimensions = mapped
  } else if (shape === 'i') {
    const fullSetPresent = ASYMMETRIC_I_DIMENSIONS.some((key) => hasValue(properties, key))
    const depth = numericProperty(properties, 'depth')
    const webThickness = numericProperty(properties, 'web_thickness')
    if (depth === null || webThickness === null) return null
    if (fullSetPresent) {
      const mapped = dimensionsFrom(properties, ASYMMETRIC_I_DIMENSIONS)
      if (!mapped) return null
      type = 'i_section'
      dimensions = { depth, web_thickness: webThickness, ...mapped }
    } else {
      const width = numericProperty(properties, 'width')
      const flangeThickness = numericProperty(properties, 'flange_thickness')
      if (width === null || flangeThickness === null) return null
      type = 'i_section'
      dimensions = {
        depth,
        top_flange_width: width,
        bottom_flange_width: width,
        web_thickness: webThickness,
        top_flange_thickness: flangeThickness,
        bottom_flange_thickness: flangeThickness,
      }
    }
  } else if (shape === 'channel' || shape === 'tee') {
    const mapped = dimensionsFrom(properties, ['depth', 'width', 'web_thickness', 'flange_thickness'])
    if (!mapped) return null
    type = shape
    dimensions = mapped
  } else if (shape === 'angle' || shape === 'rectangular_hollow') {
    const mapped = dimensionsFrom(properties, ['depth', 'width', 'thickness'])
    if (!mapped) return null
    type = shape === 'angle' ? 'angle' : 'rectangular_hollow'
    dimensions = shape === 'rectangular_hollow'
      ? { width: mapped.width, height: mapped.depth, thickness: mapped.thickness }
      : mapped
  } else if (shape === 'circular_hollow') {
    const mapped = dimensionsFrom(properties, ['diameter', 'thickness'])
    if (!mapped) return null
    type = 'circular_hollow'
    geometryVariant = 'uniform_wall'
    dimensions = mapped
  } else {
    return null
  }

  return {
    geometry: { type, geometry_variant: geometryVariant, geometry_model_version: '1.0.0', dimensions },
    units: 'mm',
    options: { include_plastic: true, include_advanced: true },
  }
}

/** Keep only geometry and user-controlled auxiliary values in new catalog section records. */
export function catalogSectionInputProperties(shape, properties = {}, descriptors = []) {
  const geometryKeys = new Set(CATALOG_GEOMETRY_KEYS[shape] ?? [])
  const asymmetricI = shape === 'i' && ASYMMETRIC_I_DIMENSIONS.some((key) => hasValue(properties, key))
  const symmetricIKeys = new Set(['width', 'flange_thickness'])
  const allowed = new Set([
    ...geometryKeys,
    ...descriptors.filter((field) => field.read_only !== true && !geometryKeys.has(field.key) && !DERIVED_LEGACY_PROPERTIES.has(field.key)).map((field) => field.key),
  ])
  return Object.fromEntries(Object.entries(properties)
    .filter(([key, value]) => allowed.has(key) && !(asymmetricI && symmetricIKeys.has(key)) && value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => [key, Number(value)]))
}

