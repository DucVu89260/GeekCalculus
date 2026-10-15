/**
 * Shared geometry bridge for Steel Design / Symmetric I/H.
 *
 * All numerical section properties and their explanations are produced by
 * Section Properties' single canonical engine. This module is not an AISC
 * member strength calculator and does not alter legacy LRFD capacities.
 */
import { calculateSectionProperties } from '../../../../section-properties/index'
import type { CalculationResult } from '../../../../section-properties/core/types'

export type HISectionInput = { h_mm: number; bf_mm: number; tw_mm: number; tf_mm: number }
type LegacyProperties = Partial<{
  area_mm2: number; ix_mm4: number; iy_mm4: number
  sx_mm3: number; sy_mm3: number; zx_mm3: number; zy_mm3: number
  rx_mm: number; ry_mm: number; j_legacy_mm4: number
}>
export type SharedProperty = {
  key: string; symbol: string; unit: string; value: unknown
  status: string; method: string | null; formula: string
  substitution: string; reference_ids: string[]; reason: string | null
}
export type HISectionBridgeResult = {
  source: 'Section Properties shared numerical core'
  geometry_type: 'i_section'
  units: 'mm'
  geometry_hash: string
  solver_version: string
  formula_library_version: string
  formula_manifest_hash: string
  canonical: {
    area_mm2: number; ix_mm4: number; iy_mm4: number
    sx_mm3: number; sy_mm3: number; zx_mm3: number; zy_mm3: number
    rx_mm: number; ry_mm: number
    torsion_constant_j_mm4: number | null
    warping_constant_cw_mm6: number | null
    shear_center_x_mm: number | null
    shear_center_y_mm: number | null
    effective_shear_area_x_mm2: number | null
    effective_shear_area_y_mm2: number | null
  }
  entries: SharedProperty[]
  comparisons: { key: string; canonical: number; legacy: number; relative_difference: number; matching: boolean; design_use: string }[]
  assumptions: string[]
  verification: 'GEOMETRY_ONLY_NOT_AISC_CAPACITY_CERTIFICATION'
}
function finitePositive(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Invalid H/I geometry: ${label} must be finite and positive`)
  }
  return value
}
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
function finiteTree(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(finiteTree)
  if (value !== null && typeof value === 'object') return Object.values(value).every(finiteTree)
  return true
}
export async function calculateHISectionProperties(
  input: HISectionInput,
  legacy: LegacyProperties = {},
): Promise<HISectionBridgeResult> {
  const h = finitePositive(input.h_mm, 'h'), bf = finitePositive(input.bf_mm, 'bf')
  const tw = finitePositive(input.tw_mm, 'tw'), tf = finitePositive(input.tf_mm, 'tf')
  if (h <= 2 * tf || tw > bf) throw new RangeError('Invalid doubly symmetric I/H geometry')

  const result = await calculateSectionProperties({
    profile_id: 'symmetric_i',
    geometry: {
      type: 'i_section', geometry_variant: 'sharp_corner',
      dimensions: {
        depth: h,
        top_flange_width: bf, bottom_flange_width: bf,
        top_flange_thickness: tf, bottom_flange_thickness: tf,
        web_thickness: tw,
      },
    },
    units: 'mm',
    options: { include_plastic: true, include_advanced: true },
  })
  if (result.geometry_type !== 'i_section' || result.geometry_hash.length !== 64) throw new Error('Unexpected section engine response')
  if (result.normalized_input.geometry.dimensions.top_flange_width !== bf
      || result.normalized_input.geometry.dimensions.bottom_flange_width !== bf) {
    throw new Error('Shared engine input mismatch')
  }
  const elastic = result.properties.elastic, plastic = result.properties.plastic
  if (!plastic) throw new Error('Plastic section properties unavailable')
  const adv = result.advanced
  const canonical = {
    area_mm2: result.properties.geometric.area,
    ix_mm4: elastic.ix, iy_mm4: elastic.iy,
    sx_mm3: Math.min(elastic.sx_positive, elastic.sx_negative),
    sy_mm3: Math.min(elastic.sy_positive, elastic.sy_negative),
    zx_mm3: plastic.zx, zy_mm3: plastic.zy,
    rx_mm: elastic.rx, ry_mm: elastic.ry,
    torsion_constant_j_mm4: numberOrNull(adv.torsion_constant_j.value),
    warping_constant_cw_mm6: numberOrNull(adv.warping_constant_cw.value),
    shear_center_x_mm: numberOrNull(adv.shear_center.value?.x),
    shear_center_y_mm: numberOrNull(adv.shear_center.value?.y),
    effective_shear_area_x_mm2: numberOrNull(adv.effective_shear_area.value?.x),
    effective_shear_area_y_mm2: numberOrNull(adv.effective_shear_area.value?.y),
  }
  for (const value of Object.values(canonical)) {
    if (value !== null && !Number.isFinite(value)) throw new Error('Non-finite shared section property')
  }
  const formulaReport = result.formula_report
  const entries: SharedProperty[] = formulaReport.properties.map(row => ({
    key: row.key, symbol: row.symbol, unit: row.unit, value: row.value,
    status: row.status, method: row.method, formula: row.expression,
    substitution: row.substitution?.expression ?? '',
    reference_ids: row.reference_ids ?? [], reason: row.reason,
  }))
  if (!finiteTree(entries.map(row => row.value))) {
    throw new Error('Shared formulas returned a non-finite property')
  }
  const comparisons = Object.entries({
    area_mm2: canonical.area_mm2, ix_mm4: canonical.ix_mm4,
    iy_mm4: canonical.iy_mm4, sx_mm3: canonical.sx_mm3,
    sy_mm3: canonical.sy_mm3, zx_mm3: canonical.zx_mm3,
    zy_mm3: canonical.zy_mm3, rx_mm: canonical.rx_mm,
    ry_mm: canonical.ry_mm,
    // Torsion J intentionally kept as a separate comparison.
    // Median-wall and workbook geometric conventions may differ.
    j_legacy_mm4: canonical.torsion_constant_j_mm4,
  }).flatMap(([key, current]) => {
    const older = legacy[key as keyof LegacyProperties]
    if (typeof older !== 'number' || typeof current !== 'number' || !Number.isFinite(older) || !Number.isFinite(current)) return []
    const diff = Math.abs(current - older) / Math.max(1, Math.abs(older), Math.abs(current))
    return [{ key, canonical: current, legacy: older,
      relative_difference: diff, matching: diff <= 1e-6,
      design_use: key === 'j_legacy_mm4' ? 'REVIEW_DIFFERENT_TORSION_CONVENTIONS' : 'GEOMETRY_PARITY_ONLY',
    }]
  })
  return {
    source: 'Section Properties shared numerical core',
    geometry_type: 'i_section', units: 'mm', geometry_hash: result.geometry_hash,
    solver_version: result.solver.version,
    formula_library_version: formulaReport.library_version,
    formula_manifest_hash: formulaReport.manifest_hash,
    canonical, entries, comparisons,
    assumptions: formulaReport.assumptions,
    verification: 'GEOMETRY_ONLY_NOT_AISC_CAPACITY_CERTIFICATION',
  }
}
