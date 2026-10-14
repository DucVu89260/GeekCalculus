// All production callers use this package: browser, admin CRUD and the native API.
import { calculateDemoSection as calculateCore, DemoCalculationError } from './core/calculator'
import { buildFormulaReport } from './core/formula-report'
import type { CalculationRequest, CalculationResult } from './core/types'
import registry from './section-registry.json'

export { DemoCalculationError } from './core/calculator'
export type * from './core/types'
export { default as sectionRegistry } from './section-registry.json'

export async function calculateSectionProperties(input: CalculationRequest & { profile_id?: string }): Promise<CalculationResult & { formula_report: Awaited<ReturnType<typeof buildFormulaReport>> }> {
  const { profile_id: profileId, ...calculation } = input
  const profile = profileId === undefined ? undefined : registry.profiles.find(profile => profile.id === profileId)
  if (profileId !== undefined && (!profile || profile.geometry_type !== calculation.geometry?.type)) {
    throw new DemoCalculationError('INVALID_GEOMETRY', 'The selected section profile is incompatible with the geometry.')
  }
  const result = await calculateCore(calculation)
  if (profile?.id === 'symmetric_i') {
    const dimensions = result.normalized_input.geometry.dimensions
    if (dimensions.top_flange_width !== dimensions.bottom_flange_width || dimensions.top_flange_thickness !== dimensions.bottom_flange_thickness) {
      throw new DemoCalculationError('INVALID_GEOMETRY', 'A symmetric I/H profile must have equal flange widths and thicknesses.')
    }
  }
  const report = await buildFormulaReport(result, profileId)
  return { ...result, formula_report: report }
}

// Compatibility alias; the implementation is shared with the native service.
export const calculateDemoSection = calculateSectionProperties
