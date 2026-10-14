export type GeometryType = 'rectangle' | 'circle' | 'i_section' | 'rectangular_hollow' | 'circular_hollow' | 'channel' | 'tee' | 'angle' | 'double_angle'
export interface GeometryDefinition {
  type: GeometryType
  geometry_variant: 'solid' | 'sharp_corner' | 'uniform_wall' | 'back_to_back'
  geometry_model_version?: '1.0.0'
  dimensions: Record<string, number>
}
export interface CalculationOptions {
  solver?: 'analytical'
  include_plastic?: boolean
  include_advanced?: boolean
  rectangle_j_relative_tolerance?: number
  rectangle_j_max_terms?: number
  required_properties?: string[]
}
export interface CalculationRequest { geometry: GeometryDefinition; units: 'mm'; options?: CalculationOptions }
export interface AdvancedProperty<T = number> { status: 'computed' | 'not_computed'; value: T | null; reason: string | null; method: string | null }
export interface ShearCenterValue { x: number; y: number; offset_x: number; offset_y: number }
export interface EffectiveShearAreaValue { x: number; y: number }
export interface AdvancedProperties {
  torsion_constant_j: AdvancedProperty
  warping_constant_cw: AdvancedProperty
  shear_center: AdvancedProperty<ShearCenterValue>
  effective_shear_area: AdvancedProperty<EffectiveShearAreaValue>
}
export interface CalculationResult {
  status: 'success'
  schema_version: '1.0'
  geometry_model_version: '1.0.0'
  geometry_type: GeometryType
  geometry_hash: string
  solver: { method: 'analytical'; version: string; config_hash: string }
  units: Record<string, string>
  normalized_input: { geometry: GeometryDefinition; units: 'mm'; options: CalculationOptions }
  properties: {
    geometric: { area: number; perimeter: number; centroid_x: number; centroid_y: number }
    elastic: { ix: number; iy: number; ixy: number; sx_positive: number; sx_negative: number; sy_positive: number; sy_negative: number; rx: number; ry: number }
    plastic: { pna_x: number; pna_y: number; zx: number; zy: number } | null
    principal: { i_major: number; i_minor: number; major_axis_angle_degrees: number | null; orientation_status: 'determinate' | 'indeterminate' }
  }
  advanced: AdvancedProperties
  diagnostics: { bounding_box: { x_min: number; y_min: number; x_max: number; y_max: number }; intermediate: Record<string, number>; plastic: Record<string, unknown>; torsion?: Record<string, unknown>; i_section_advanced?: Record<string, unknown>; assumptions: string[] }
}
