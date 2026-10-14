import registry from '../section-registry.json'

type Result = Record<string, any>

const get = (object: any, path: string): any => path.split('.').reduce((value, key) => value?.[key], object)
const printable = (value: any): string => typeof value === 'number' ? String(value) : JSON.stringify(value)

function substitute(expression: string, symbols: Record<string, number>, outputSymbol: string): string {
  const equals = expression.indexOf('=')
  const prefix = equals < 0 ? '' : expression.slice(0, equals + 1)
  let right = equals < 0 ? expression : expression.slice(equals + 1)
  right = right.replace(/π(?=[A-Za-z])/g, 'π × ').replace(/(\d)(?=[A-Za-z])/g, '$1 × ')
  const keys = Object.keys(symbols).filter(key => key !== outputSymbol).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    right = right.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu'), `(${symbols[key]})`)
  }
  return prefix + right
}

/** Reports use canonical mm values. Display conversion must never rewrite this persisted record. */
export async function buildFormulaReport(result: Result, selectedProfileId?: string) {
  const geometry = result.normalized_input.geometry
  const dimensions: Record<string, number> = geometry.dimensions
  const symmetricI = geometry.type === 'i_section'
    && dimensions.top_flange_width === dimensions.bottom_flange_width
    && dimensions.top_flange_thickness === dimensions.bottom_flange_thickness
  const profile = registry.profiles.find(profile => profile.id === (selectedProfileId ?? (geometry.type === 'i_section'
    ? (symmetricI ? 'symmetric_i' : 'asymmetric_i')
    : registry.aliases[geometry.type as keyof typeof registry.aliases] ?? geometry.type)))!
  const symbolDimensions = Object.entries(dimensions).map(([key, value]) => {
    const descriptor = registry.dimensions[key as keyof typeof registry.dimensions]
    return { key, symbol: descriptor?.symbol ?? key, value, unit: 'mm' }
  })
  if (symmetricI) {
    symbolDimensions.push({ key: 'width', symbol: 'b', value: dimensions.top_flange_width, unit: 'mm' })
    symbolDimensions.push({ key: 'flange_thickness', symbol: 'tf', value: dimensions.top_flange_thickness, unit: 'mm' })
  }
  const assumptions = [...new Set([
    ...(result.diagnostics.assumptions ?? []),
    ...(result.diagnostics.i_section_advanced?.assumptions ?? []),
    ...(result.diagnostics.advanced?.assumptions ?? []),
    ...(result.diagnostics.advanced_model?.assumptions ?? []),
    ...(geometry.type === 'double_angle' ? registry.double_angle.assumptions : []),
  ])]
  const dimensionSymbols = Object.fromEntries(symbolDimensions.map(dimension => [dimension.symbol, dimension.value]))
  const numericSymbols = { ...dimensionSymbols }
  for (const descriptor of registry.properties) {
    const advanced = descriptor.key.startsWith('advanced.')
    const value = get(result, advanced ? `${descriptor.key}.value` : `properties.${descriptor.key}`)
    if (typeof value === 'number') numericSymbols[descriptor.symbol] = value
  }
  const properties = registry.properties.map(descriptor => {
    const advanced = descriptor.key.startsWith('advanced.')
    const property = get(result, advanced ? descriptor.key : `properties.${descriptor.key}`)
    const status = advanced ? property?.status ?? 'not_computed'
      : property === undefined || (property === null && descriptor.key !== 'principal.major_axis_angle_degrees') ? 'not_computed' : 'computed'
    const value = advanced ? property?.value ?? null : property ?? null
    const method = advanced ? property?.method ?? null : 'gross_geometry_integrals'
    const overrides = registry.geometry_expressions[geometry.type as keyof typeof registry.geometry_expressions] as Record<string, string> | undefined
    const methodExpressions = registry.method_expressions as Record<string, string | Record<string, string>>
    const methodExpression = method ? methodExpressions[method] : undefined
    const expression = (typeof methodExpression === 'string' ? methodExpression : methodExpression?.[descriptor.key])
      ?? overrides?.[descriptor.key] ?? descriptor.expression
    return {
      key: descriptor.key, symbol: descriptor.symbol, unit: descriptor.unit,
      status, value, method, expression,
      substitution: {
        expression: substitute(expression, numericSymbols, descriptor.symbol),
        dimensions: dimensionSymbols,
        context_ref: 'inputs',
        result: `${descriptor.symbol} = ${printable(value)} ${descriptor.unit}`,
      },
      reason: advanced ? property?.reason ?? null : status === 'not_computed' ? 'not_requested' : null,
      reference_ids: descriptor.reference_ids,
    }
  })
  const bytes = new TextEncoder().encode(JSON.stringify(registry))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const manifestHash = Array.from(new Uint8Array(hash)).map(value => value.toString(16).padStart(2, '0')).join('')
  return {
    schema_version: registry.schema_version, library_version: registry.library_version,
    manifest_hash: manifestHash, core: 'section-properties/shared-typescript',
    core_version: result.solver.version, profile_id: profile.id, geometry_type: geometry.type,
    profile_label: profile.label, geometry_model_version: registry.geometry_model_version,
    normalized_geometry: geometry,
    geometry_hash: result.geometry_hash, solver: result.solver,
    coordinate_system: registry.coordinate_system, units: 'mm',
    dimensions: symbolDimensions,
    components: result.diagnostics.components ?? result.diagnostics.intermediate?.components ?? [],
    inputs: {
      dimensions: dimensionSymbols, symbols: numericSymbols,
      bounding_box: result.diagnostics.bounding_box,
      geometric: result.properties.geometric, elastic: result.properties.elastic,
      plastic: result.properties.plastic, intermediate: result.diagnostics.intermediate,
      advanced_model: result.diagnostics.advanced_model,
      options: result.normalized_input.options,
    },
    properties, assumptions, references: registry.references,
    reference_ids: registry.references.map(reference => reference.id),
    ...(geometry.type === 'double_angle' ? { connection_model: registry.double_angle } : {}),
  }
}
