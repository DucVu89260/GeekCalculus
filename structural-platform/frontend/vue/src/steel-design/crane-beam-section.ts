import { buildSectionCalculationRequest } from '../sectional-properties/catalog.js'
import { calculateSectionProperties } from '../../../../section-properties/index'
import type { CalculationRequest } from '../../../../section-properties/core/types'

export type CraneDimensions = {
  depth: number; top_flange_width: number; bottom_flange_width: number
  top_flange_thickness: number; bottom_flange_thickness: number; web_thickness: number
}

/** Composition only: all A, I, S, Z, r, CG/PNA, J/Cw come from Section Properties. */
export async function calculateCraneSections(dimensions: CraneDimensions) {
  async function solve(profile: string, values: Record<string, number>) {
    const request = buildSectionCalculationRequest(profile, values)
    if (!request) throw new RangeError('Invalid Crane Beam section dimensions')
    return calculateSectionProperties(request as unknown as CalculationRequest)
  }
  const base = await solve('asymmetric_i', dimensions)
  const d = base.normalized_input.geometry.dimensions as CraneDimensions
  const y = base.properties.geometric.centroid_y
  const topWeb = (d.depth - y - d.top_flange_thickness) / 3
  const bottomWeb = (y - d.bottom_flange_thickness) / 3
  if (!(topWeb > 0 && bottomWeb > 0)) throw new RangeError('Centroid must lie within the web for the workbook one-third-to-neutral-axis T model')
  const [top, bottom] = await Promise.all([
    solve('tee', { depth: d.top_flange_thickness + topWeb, width: d.top_flange_width, web_thickness: d.web_thickness, flange_thickness: d.top_flange_thickness }),
    solve('tee', { depth: d.bottom_flange_thickness + bottomWeb, width: d.bottom_flange_width, web_thickness: d.web_thickness, flange_thickness: d.bottom_flange_thickness }),
  ])
  if (!base.properties.plastic || !top.properties.plastic || !bottom.properties.plastic) throw new Error('Plastic properties are required')
  return {
    base, top, bottom,
    convention: 'TOP_AND_BOTTOM_FLANGE_PLUS_ONE_THIRD_CLEAR_DISTANCE_TO_GROSS_CENTROID',
    top_web_depth_mm: topWeb, bottom_web_depth_mm: bottomWeb,
    // Core T flange is uppermost. Reflect its local y coordinates for the bottom T.
    top_yc_from_outer_face_mm: top.normalized_input.geometry.dimensions.depth - top.properties.geometric.centroid_y,
    bottom_yc_from_outer_face_mm: bottom.normalized_input.geometry.dimensions.depth - bottom.properties.geometric.centroid_y,
    top_centroid_global_y_mm: d.depth - (top.normalized_input.geometry.dimensions.depth - top.properties.geometric.centroid_y),
    bottom_centroid_global_y_mm: bottom.normalized_input.geometry.dimensions.depth - bottom.properties.geometric.centroid_y,
    hc_top_mm: 2 * (d.depth - y - d.top_flange_thickness),
    hc_bottom_mm: 2 * (y - d.bottom_flange_thickness),
    hp_top_mm: 2 * (d.depth - base.properties.plastic.pna_y - d.top_flange_thickness),
    hp_bottom_mm: 2 * (base.properties.plastic.pna_y - d.bottom_flange_thickness),
    sy_top_flange_mm3: base.properties.elastic.iy / (d.top_flange_width / 2),
    sy_bottom_flange_mm3: base.properties.elastic.iy / (d.bottom_flange_width / 2),
    worksheet_references: { top: 'AS44:AS45, AP51:AP56', bottom: 'AS47:AS48, AP57:AP62', base: 'B27:H36' },
    verification: 'GEOMETRY_ONLY_NOT_AISC_CAPACITY_CERTIFICATION',
  }
}

export type CraneSections = Awaited<ReturnType<typeof calculateCraneSections>>
