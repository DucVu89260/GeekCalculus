import { sectionWallMechanics } from './calculator'

const inverseUnits = { torque: 'mm-3', force: 'mm-2', bimoment: 'mm-4' }
const notComputed = (reason: string) => ({ status: 'not_computed', reason })

/** Harmonic rectangle warping, centered coordinates with the longer side along x. */
function rectangleOmega(x: number, y: number, a: number, b: number, terms: number): number {
  let sum = 0
  for (let i = 0; i < terms; i++) {
    const n = 2 * i + 1, k = n * Math.PI / (2 * b)
    const ratio = Math.sign(x) * Math.exp(-k * (a - Math.abs(x))) * -Math.expm1(-2 * k * Math.abs(x)) / (1 + Math.exp(-2 * k * a))
    sum += (i % 2 ? -1 : 1) * ratio * Math.sin(k * y) / n ** 3
  }
  return -x * y + 32 * b * b / Math.PI ** 3 * sum
}

/** Maximum principle + a Lipschitz boundary enclosure; no assumed corner maximum for square rectangles. */
function rectangleWarpingBounds(a: number, b: number) {
  const terms = 1024
  const truncationTail = 8 * b * b / (Math.PI ** 3 * (2 * terms - 1) ** 2)
  const roundoffEstimate = 64 * terms * Number.EPSILON * (a * b + 2 * b * b)
  const seriesTail = truncationTail + roundoffEstimate
  type Node = { lo: number; hi: number; edge: number; upper: number }
  const heap: Node[] = []
  const evaluate = (edge: number, coordinate: number) => edge === 0 ? Math.abs(rectangleOmega(coordinate, b, a, b, terms)) : Math.abs(rectangleOmega(a, coordinate, a, b, terms))
  let best = 0
  const push = (node: Node) => {
    heap.push(node); let i = heap.length - 1
    while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent].upper >= node.upper) break; heap[i] = heap[parent]; i = parent }
    heap[i] = node
  }
  const pop = () => {
    const first = heap[0], last = heap.pop()!
    if (heap.length) { let i = 0; while (2 * i + 1 < heap.length) { let child = 2 * i + 1; if (child + 1 < heap.length && heap[child + 1].upper > heap[child].upper) child++; if (last.upper >= heap[child].upper) break; heap[i] = heap[child]; i = child } heap[i] = last }
    return first
  }
  const add = (lo: number, hi: number, edge: number) => {
    const sample = evaluate(edge, (lo + hi) / 2)
    best = Math.max(best, sample)
    const lipschitz = edge === 0 ? 3 * b : a + 2 * b
    push({ lo, hi, edge, upper: sample + seriesTail + lipschitz * (hi - lo) / 2 })
  }
  best = Math.max(evaluate(0, 0), evaluate(0, a), evaluate(1, 0), evaluate(1, b))
  add(0, a, 0); add(0, b, 1)
  let iterations = 0
  while (heap.length && iterations < 8192) {
    const lower = Math.max(0, best - seriesTail)
    if (heap[0].upper - lower <= Math.max(best * 1e-4, seriesTail * 4)) break
    const node = pop(), mid = (node.lo + node.hi) / 2
    add(node.lo, mid, node.edge); add(mid, node.hi, node.edge); iterations++
  }
  const lower = Math.max(0, best - seriesTail), upper = Math.max(best + seriesTail, heap[0]?.upper ?? best + seriesTail)
  return { lower, upper, estimate: (lower + upper) / 2, error: (upper - lower) / 2, truncation_tail_bound: truncationTail, floating_point_error_estimate: roundoffEstimate, terms, iterations, relative_enclosure_width: lower > 0 ? (upper - lower) / lower : null }
}

function polynomialMax(q0: number, a: number, b: number, length: number) {
  const evaluate = (s: number) => q0 + a * s + b * s * s / 2
  const points = [0, length]
  if (b !== 0 && -a / b > 0 && -a / b < length) points.push(-a / b)
  return Math.max(...points.map(s => Math.abs(evaluate(s))))
}

function crossEnergy(x: any[], y: any[]) {
  let energy = 0
  for (let i = 0; i < x.length; i++) {
    const sx = x[i], sy = y[i], wall = sx.segment
    if (wall.thickness <= 0) continue
    const length = Math.hypot(wall.x1 - wall.x0, wall.y1 - wall.y0)
    const cx = [sx.q0, sx.a, sx.b / 2], cy = [sy.q0, sy.a, sy.b / 2]
    for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) energy += cx[p] * cy[q] * length ** (p + q + 1) / ((p + q + 1) * wall.thickness)
  }
  return energy
}

/** Code-independent stress, warping and shear fields. The existing advanced core owns every wall/model calculation. */
export function calculateAdvancedMechanics(result: any, geometryMechanics: any): any {
  const advanced = result.advanced
  if (!result.normalized_input.options.include_advanced) return { status: 'not_requested', reason: 'advanced_not_requested' }
  if (Object.values(advanced).some((p: any) => p.status !== 'computed')) return notComputed('advanced_property_unavailable')
  const geometry = result.normalized_input.geometry, dims = geometry.dimensions
  const gross = result.properties.geometric, elastic = result.properties.elastic, sc = advanced.shear_center.value
  const scale = Math.max(result.diagnostics.bounding_box.x_max, result.diagnostics.bounding_box.y_max)
  const j = advanced.torsion_constant_j.value, cw = advanced.warping_constant_cw.value
  const ip = elastic.ix + elastic.iy, ex = sc.offset_x, ey = sc.offset_y
  const r0square = ip / gross.area + ex * ex + ey * ey
  const angle = (geometryMechanics.principal.basis_angle_degrees ?? 0) * Math.PI / 180
  const eu = ex * Math.cos(angle) + ey * Math.sin(angle), ev = -ex * Math.sin(angle) + ey * Math.cos(angle)
  const m = geometryMechanics.third_moments, p = geometryMechanics.third_moments_principal
  const output: any = {
    status: 'computed', reason: null,
    shear_center_geometry: { polar_inertia_mm4: ip + gross.area * (ex * ex + ey * ey), polar_radius_mm: Math.sqrt(r0square), coupling_factor: (ip / gross.area) / r0square, offset_x_mm: ex, offset_y_mm: ey },
    wagner: { beta_x_mm: (m.m21_mm5 + m.m03_mm5) / elastic.ix - 2 * ey, beta_y_mm: (m.m30_mm5 + m.m12_mm5) / elastic.iy - 2 * ex,
      beta_major_mm: (p.m21_mm5 + p.m03_mm5) / result.properties.principal.i_major - 2 * ev, beta_minor_mm: (p.m30_mm5 + p.m12_mm5) / result.properties.principal.i_minor - 2 * eu },
    fields: { units: inverseUnits, normal_stress: { coordinate_origin: 'gross_centroid', moment_convention: 'Mx=integral(Y*sigma)dA; My=integral(X*sigma)dA; tension-positive N', expression: 'sigma=N/A + [(My*Ix-Mx*Ixy)*X+(Mx*Iy-My*Ixy)*Y]/(Ix*Iy-Ixy^2) + B*omega/Cw', bimoment_unit: 'N mm2' } },
  }
  if (geometry.type === 'rectangle') {
    const a = Math.max(dims.width, dims.height) / (2 * scale), b = Math.min(dims.width, dims.height) / (2 * scale)
    let sum = 0
    for (let i = 0; i < 64; i++) { const n = 2 * i + 1, z = n * Math.PI * a / (2 * b); sum += 2 * Math.exp(-z) / (1 + Math.exp(-2 * z)) / n ** 2 }
    const maxGradient = (2 * b - 16 * b / Math.PI ** 2 * sum) * scale
    output.torsion = { status: 'computed', method: 'solid_rectangle_saint_venant_boundary_gradient', modulus_mm3: j / maxGradient, unit_max_shear_per_torque_mm3_inverse: maxGradient / j }
    output.shear = { method: 'jourawski_rectangle', modulus_x_mm2: 2 * gross.area / 3, modulus_y_mm2: 2 * gross.area / 3, compliance: { xx_mm2_inverse: 1 / advanced.effective_shear_area.value.x, xy_mm2_inverse: 0, yy_mm2_inverse: 1 / advanced.effective_shear_area.value.y } }
    const bounds = rectangleWarpingBounds(a, b)
    output.warping = { status: 'computed', method: 'harmonic_fourier_boundary_enclosure', omega_positive_mm2: bounds.estimate * scale ** 2, omega_negative_mm2: -bounds.estimate * scale ** 2,
      modulus_positive_mm4: cw / (bounds.upper * scale ** 2), modulus_negative_mm4: cw / (bounds.upper * scale ** 2), absolute_error_bound_mm2: bounds.error * scale ** 2,
      extrema_enclosure_mm2: { absolute_lower: bounds.lower * scale ** 2, absolute_upper: bounds.upper * scale ** 2 }, modulus_convention: 'lower_bound_using_upper_omega_enclosure', convergence: bounds }
    output.fields.rectangle = { model: 'saint_venant_harmonic_fourier', long_axis: dims.width >= dims.height ? 'x' : 'y', half_long_mm: a * scale, half_short_mm: b * scale, terms: bounds.terms,
      warping_expression: 'psi=-xy+32b^2/pi^3 sum_odd((-1)^((n-1)/2)/n^3 * sinh(n*pi*x/(2b))/cosh(n*pi*a/(2b))*sin(n*pi*y/(2b)))',
      coordinate_convention: 'centered x along longer side, y shorter; physical omega=psi when long_axis=x, omega=-psi when long_axis=y',
      stress_function_expression: 'phi=b^2-y^2-32b^2/pi^3 sum_odd((-1)^((n-1)/2)/n^3*cosh(n*pi*x/(2b))/cosh(n*pi*a/(2b))*cos(n*pi*y/(2b)))',
      torsion_shear_expression: 'phi_phys(X,Y)=phi(X,Y) when long_axis=x, else phi(Y,X); (tau_x,tau_y)=T/J*(d_phi_phys/dY,-d_phi_phys/dX)',
      shear_expression: 'tau_x/Vx=3/(2A)*(1-4X^2/width^2); tau_y/Vy=3/(2A)*(1-4Y^2/height^2)',
    }
  } else if (geometry.type === 'circle' || geometry.type === 'circular_hollow') {
    const radius = dims.diameter / 2
    output.torsion = { status: 'computed', method: 'axisymmetric_exact_saint_venant', modulus_mm3: j / radius, unit_max_shear_per_torque_mm3_inverse: radius / j }
    const shearModulus = geometry.type === 'circle' ? 3 * gross.area / 4 : Math.PI * (radius - dims.thickness / 2) * dims.thickness
    output.shear = { method: geometry.type === 'circle' ? 'jourawski_circle' : 'median_ring_thin_wall_shear_flow', modulus_x_mm2: shearModulus, modulus_y_mm2: shearModulus,
      compliance: { xx_mm2_inverse: 1 / advanced.effective_shear_area.value.x, xy_mm2_inverse: 0, yy_mm2_inverse: 1 / advanced.effective_shear_area.value.y } }
    output.warping = { status: 'not_applicable', method: 'axisymmetric_zero_warping', omega_positive_mm2: 0, omega_negative_mm2: 0, modulus_positive_mm4: null, modulus_negative_mm4: null, reason: 'zero_warping' }
    output.fields.circular = { model: geometry.type === 'circle' ? 'solid_circle_jourawski' : 'median_ring', outer_radius_mm: radius, median_radius_mm: geometry.type === 'circle' ? null : radius - dims.thickness / 2,
      thickness_mm: geometry.type === 'circle' ? null : dims.thickness, torsion_shear_expression: '(tau_x,tau_y)=T/J*(-Y,X)',
      shear_expression: geometry.type === 'circle' ? 'tau_x/Vx=4/(3A)*(1-X^2/R^2); tau_y/Vy=4/(3A)*(1-Y^2/R^2)' : 'qx/Vx=-sin(theta)/(pi*Rm); qy/Vy=cos(theta)/(pi*Rm); tau=q/t', warping_expression: 'omega=0' }
  } else {
    const wall = sectionWallMechanics(geometry, scale)
    const materialWalls = wall.walls.filter(w => w.thickness > 0)
    const maxThickness = Math.max(...materialWalls.map(w => w.thickness)) * scale
    const medianArea = geometry.type === 'rectangular_hollow' ? (dims.width - dims.thickness) * (dims.height - dims.thickness) : null
    const torsionModulus = medianArea === null ? j / maxThickness : 2 * medianArea * dims.thickness
    output.torsion = { status: 'computed', method: wall.closed ? 'single_cell_bredt_thin_wall' : 'open_wall_surface_shear_thin_wall', modulus_mm3: torsionModulus, unit_max_shear_per_torque_mm3_inverse: 1 / torsionModulus }
    const flowMax = (flow: any[]) => Math.max(...flow.filter(s => s.segment.thickness > 0).map(s => polynomialMax(s.q0, s.a, s.b, Math.hypot(s.segment.x1 - s.segment.x0, s.segment.y1 - s.segment.y0)) / s.segment.thickness))
    output.shear = { method: wall.closed ? 'closed_cell_thin_wall_shear_energy' : 'open_section_thin_wall_shear_energy', modulus_x_mm2: scale ** 2 / flowMax(wall.flowX), modulus_y_mm2: scale ** 2 / flowMax(wall.flowY),
      compliance: { xx_mm2_inverse: wall.responseX.energy / scale ** 2, xy_mm2_inverse: crossEnergy(wall.flowX, wall.flowY) / scale ** 2, yy_mm2_inverse: wall.responseY.energy / scale ** 2 } }
    const omegaEnds = wall.warping.filter(s => s.wall.thickness > 0).flatMap(s => [s.start, s.start + s.derivative * s.length])
    const positive = Math.max(...omegaEnds) * scale ** 2, negative = Math.min(...omegaEnds) * scale ** 2
    output.warping = { status: cw === 0 ? 'not_applicable' : 'computed', method: wall.closed ? 'closed_wall_sectorial_linear' : 'open_wall_sectorial_linear', omega_positive_mm2: positive, omega_negative_mm2: negative,
      modulus_positive_mm4: cw === 0 ? null : cw / positive, modulus_negative_mm4: cw === 0 ? null : cw / Math.abs(negative), reason: cw === 0 ? 'zero_warping' : null }
    output.fields.wall_model = { coordinate_origin: 'bounding_box_bottom_left', shear_coordinate: 's increases from wall start to end', warping_normalization: 'zero material-weighted mean',
      virtual_links: 'zero-thickness walls transfer reactions but carry no material stress/energy',
      centroid_mm: { x: wall.line.cx * scale, y: wall.line.cy * scale }, shear_center_mm: { x: wall.pole.x * scale, y: wall.pole.y * scale },
      walls: wall.walls.map(w => ({ label: w.label, start_mm: { x: w.x0 * scale, y: w.y0 * scale }, end_mm: { x: w.x1 * scale, y: w.y1 * scale }, thickness_mm: w.thickness * scale, material: w.thickness > 0 })),
      unit_shear_x: wall.flowX.map(s => ({ label: s.segment.label, start_mm: { x: s.segment.x0 * scale, y: s.segment.y0 * scale }, end_mm: { x: s.segment.x1 * scale, y: s.segment.y1 * scale }, q0_mm_inverse: s.q0 / scale, q1_mm2_inverse: s.a / scale ** 2, q2_mm3_inverse: s.b / (2 * scale ** 3) })),
      unit_shear_y: wall.flowY.map(s => ({ label: s.segment.label, start_mm: { x: s.segment.x0 * scale, y: s.segment.y0 * scale }, end_mm: { x: s.segment.x1 * scale, y: s.segment.y1 * scale }, q0_mm_inverse: s.q0 / scale, q1_mm2_inverse: s.a / scale ** 2, q2_mm3_inverse: s.b / (2 * scale ** 3) })),
      warping: wall.warping.map(s => ({ label: s.wall.label, start_mm: { x: s.wall.x0 * scale, y: s.wall.y0 * scale }, end_mm: { x: s.wall.x1 * scale, y: s.wall.y1 * scale }, omega0_mm2: s.start * scale ** 2, omega1_mm: s.derivative * scale })),
      torsion_shear_expression: wall.closed ? 'tau/T=1/(2*Am*t)' : 'tau_s/T=-2*n/J; n is signed across wall thickness, q0=0 for Saint-Venant plate torsion', median_cell_area_mm2: medianArea,
    }
  }
  return output
}

/** Material-independent axial/biaxial normal-stress response; omega may be supplied from the stored warping field. */
export function sectionNormalStress(result: any, actions: { n?: number; mx?: number; my?: number; bimoment?: number }, point: { x: number; y: number; omega?: number }): number {
  const { area, centroid_x: cx, centroid_y: cy } = result.properties.geometric
  const { ix, iy, ixy } = result.properties.elastic, x = point.x - cx, y = point.y - cy
  const determinant = ix * iy - ixy * ixy
  const bending = ((actions.my ?? 0) * ix - (actions.mx ?? 0) * ixy) * x / determinant + ((actions.mx ?? 0) * iy - (actions.my ?? 0) * ixy) * y / determinant
  const bimoment = actions.bimoment ?? 0, cw = result.advanced.warping_constant_cw.value
  if (bimoment !== 0 && (!(cw > 0) || point.omega === undefined)) throw new RangeError('A nonzero bimoment needs a positive Cw and the point warping coordinate.')
  const value = (actions.n ?? 0) / area + bending + (bimoment === 0 ? 0 : bimoment * point.omega! / cw)
  if (!Number.isFinite(value)) throw new RangeError('Stress response is outside the numerical range.')
  return value
}
