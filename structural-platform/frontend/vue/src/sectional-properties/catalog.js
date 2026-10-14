import sectionRegistry from '../../../../section-properties/section-registry.json' with { type: 'json' }

export const SECTION_REGISTRY = sectionRegistry
export const SECTION_PROFILES = Object.freeze(sectionRegistry.profiles)
const PROFILES_BY_ID = new Map(SECTION_PROFILES.map((profile) => [profile.id, profile]))
const DERIVED_LEGACY_PROPERTIES = new Set([
  'area', 'inertia_x', 'inertia_y', 'inertia_z', 'torsion_constant',
  'elastic_modulus_x', 'elastic_modulus_y', 'elastic_modulus_z',
  'shear_area_x', 'shear_area_y', 'shear_area_z', 'warping_constant',
  'plastic_modulus_x', 'plastic_modulus_y', 'plastic_modulus_z',
  'shear_center_x', 'shear_center_y', 'shear_center_z',
  'section_modulus_x', 'section_modulus_y', 'section_modulus_z',
  'radius_gyration_x', 'radius_gyration_y', 'radius_gyration_z',
])
const ASYMMETRIC_I_DIMENSIONS = new Set([
  'top_flange_width', 'bottom_flange_width', 'top_flange_thickness', 'bottom_flange_thickness',
])

function dimensionCatalogKey(key) {
  return sectionRegistry.dimensions[key]?.catalog_key ?? key
}

function catalogShapeKeys() {
  const result = Object.create(null)
  for (const profile of SECTION_PROFILES) {
    const keys = result[profile.catalog_shape] ?? new Set()
    for (const key of profile.dimensions) keys.add(dimensionCatalogKey(key))
    result[profile.catalog_shape] = keys
    result[profile.id] = keys
  }
  for (const [alias, profileId] of Object.entries(sectionRegistry.aliases)) {
    const profile = PROFILES_BY_ID.get(profileId)
    if (!profile) continue
    result[alias] = result[profile.catalog_shape] ?? new Set()
  }
  return Object.freeze(Object.fromEntries(Object.entries(result).map(([key, keys]) => [key, Object.freeze([...keys])])))
}

export const CATALOG_GEOMETRY_KEYS = catalogShapeKeys()

function hasValue(value) {
  return value !== '' && value !== null && value !== undefined
}

function hasAsymmetricFlangeInput(properties = {}) {
  return [...ASYMMETRIC_I_DIMENSIONS].some((key) => hasValue(properties[key]))
}

export function resolveSectionProfile(profileOrAlias, properties = {}) {
  const supplied = String(profileOrAlias ?? '')
  const aliased = sectionRegistry.aliases[supplied] ?? supplied
  if (supplied === 'i' && hasAsymmetricFlangeInput(properties)) return PROFILES_BY_ID.get('asymmetric_i') ?? null
  return PROFILES_BY_ID.get(aliased) ?? null
}

export function sectionProfilesForCatalogShape(shape) {
  const value = String(shape ?? '')
  const directProfile = PROFILES_BY_ID.get(value)
  const catalogShape = directProfile?.catalog_shape ?? value
  const aliased = sectionRegistry.aliases[catalogShape]
  const resolved = PROFILES_BY_ID.get(aliased ?? catalogShape)
  const normalizedCatalogShape = resolved?.catalog_shape ?? catalogShape
  return SECTION_PROFILES.filter((profile) => profile.catalog_shape === normalizedCatalogShape)
}

export function profileForCatalogShape(shape, properties = {}) {
  const profiles = sectionProfilesForCatalogShape(shape)
  if (profiles.length > 1 && hasAsymmetricFlangeInput(properties)) {
    return profiles.find((profile) => profile.id === 'asymmetric_i') ?? profiles[0]
  }
  const selected = resolveSectionProfile(shape, properties)
  return selected && profiles.some((profile) => profile.id === selected.id)
    ? selected
    : profiles[0] ?? null
}

export function sectionProfileDimensions(profileOrAlias, values = {}, { includeDefaults = true } = {}) {
  const profile = typeof profileOrAlias === 'string'
    ? resolveSectionProfile(profileOrAlias, values)
    : profileOrAlias
  if (!profile) return {}
  return Object.fromEntries(profile.dimensions.map((key) => {
    const catalogKey = dimensionCatalogKey(key)
    const fallback = includeDefaults ? profile.default_dimensions?.[key] : ''
    return [key, hasValue(values[key]) ? values[key] : values[catalogKey] ?? fallback ?? '']
  }))
}

export function catalogPropertiesForProfile(profileOrAlias, dimensions = {}, baseProperties = {}) {
  const profile = typeof profileOrAlias === 'string'
    ? resolveSectionProfile(profileOrAlias, dimensions)
    : profileOrAlias
  if (!profile) return { ...baseProperties }
  const result = { ...baseProperties }
  for (const key of profile.dimensions) {
    const catalogKey = dimensionCatalogKey(key)
    const value = dimensions[key]
    if (hasValue(value)) result[catalogKey] = value
    else delete result[catalogKey]
  }
  return result
}

export function buildSectionCalculationRequest(profileOrAlias, values = {}, options = {}) {
  const profile = typeof profileOrAlias === 'string'
    ? resolveSectionProfile(profileOrAlias, values)
    : profileOrAlias
  if (!profile) return null

  const dimensions = {}
  for (const key of profile.dimensions) {
    const raw = values[key]
    if (!hasValue(raw)) return null
    const value = Number(raw)
    const definition = sectionRegistry.dimensions[key]
    const minimum = definition?.minimum ?? 0
    if (!Number.isFinite(value) || value < minimum || (!definition?.allow_zero && value === 0)) return null
    dimensions[key] = value
  }

  const engineDimensions = {}
  for (const [engineKey, sourceKey] of Object.entries(profile.engine_dimensions)) {
    const value = dimensions[sourceKey]
    if (!Number.isFinite(value)) return null
    engineDimensions[engineKey] = value
  }

  return {
    profile_id: profile.id,
    geometry: {
      type: profile.geometry_type,
      geometry_variant: profile.geometry_variant,
      geometry_model_version: sectionRegistry.geometry_model_version,
      dimensions: engineDimensions,
    },
    units: sectionRegistry.canonical_units,
    options: { include_plastic: true, include_advanced: true, ...options },
  }
}

export function sectionInputFingerprint(profileOrAlias, values = {}) {
  const profile = typeof profileOrAlias === 'string'
    ? resolveSectionProfile(profileOrAlias, values)
    : profileOrAlias
  if (!profile) return ''
  return JSON.stringify({ profile: profile.id, dimensions: profile.dimensions.map((key) => [key, values[key] ?? '']) })
}

/** Convert legacy catalog property names into the registry profile's input names. */
export function buildCatalogSectionCalculationRequest(shapeOrProfile, properties = {}, options = {}) {
  const profile = profileForCatalogShape(shapeOrProfile, properties)
  if (!profile) return null
  const dimensions = sectionProfileDimensions(profile, properties, { includeDefaults: false })
  return buildSectionCalculationRequest(profile, dimensions, options)
}

/** Keep only profile geometry and editable auxiliary values for new catalog rows. */
export function catalogSectionInputProperties(shapeOrProfile, properties = {}, descriptors = []) {
  const profile = profileForCatalogShape(shapeOrProfile, properties)
  const allGeometryKeys = new Set(CATALOG_GEOMETRY_KEYS[shapeOrProfile] ?? profile?.dimensions.map(dimensionCatalogKey) ?? [])
  const activeGeometryKeys = new Set(profile?.dimensions.map(dimensionCatalogKey) ?? [])
  const allowedAuxiliaryKeys = new Set(descriptors
    .filter((field) => field.read_only !== true && !allGeometryKeys.has(field.key) && !DERIVED_LEGACY_PROPERTIES.has(field.key))
    .map((field) => field.key))
  const result = {}

  for (const [key, rawValue] of Object.entries(properties)) {
    if (rawValue === '' || rawValue === null || rawValue === undefined) continue
    if (activeGeometryKeys.has(key)) {
      const value = Number(rawValue)
      if (Number.isFinite(value)) result[key] = value
    } else if (!allGeometryKeys.has(key) && allowedAuxiliaryKeys.has(key)) {
      const value = Number(rawValue)
      if (Number.isFinite(value)) result[key] = value
    }
  }

  return result
}

export function isCatalogDerivedSectionProperty(key) {
  return DERIVED_LEGACY_PROPERTIES.has(key)
}

export function catalogGeometryMode(shape, properties = {}) {
  if (profileForCatalogShape(shape, properties)?.id === 'asymmetric_i') return 'asymmetric'
  if (profileForCatalogShape(shape, properties)?.id === 'symmetric_i') return 'symmetric'
  return null
}

export function profileForCalculationResult(result) {
  const geometry = result?.normalized_input?.geometry ?? result?.geometry
  if (!geometry) return null
  const type = result.geometry_type ?? geometry.type
  const profiles = SECTION_PROFILES.filter((profile) => profile.geometry_type === type)
  if (!profiles.length) return null
  if (type === 'i_section') {
    const dimensions = geometry.dimensions ?? {}
    const symmetric = Number(dimensions.top_flange_width ?? dimensions.width) === Number(dimensions.bottom_flange_width ?? dimensions.width)
      && Number(dimensions.top_flange_thickness ?? dimensions.flange_thickness) === Number(dimensions.bottom_flange_thickness ?? dimensions.flange_thickness)
    return profiles.find((profile) => profile.id === (symmetric ? 'symmetric_i' : 'asymmetric_i')) ?? profiles[0]
  }
  return profiles.find((profile) => profile.geometry_variant === geometry.geometry_variant) ?? profiles[0]
}

export function profileDimensionsFromCalculationResult(result) {
  const profile = profileForCalculationResult(result)
  const geometry = result?.normalized_input?.geometry ?? result?.geometry
  if (!profile || !geometry?.dimensions) return { profile, dimensions: {} }
  const engineDimensions = geometry.dimensions
  const dimensions = Object.fromEntries(profile.dimensions.map((key) => {
    const engineKey = Object.keys(profile.engine_dimensions).find((candidate) => profile.engine_dimensions[candidate] === key)
    const value = engineKey ? engineDimensions[engineKey] : undefined
    return [key, value ?? profile.default_dimensions?.[key] ?? '']
  }))
  return { profile, dimensions }
}
