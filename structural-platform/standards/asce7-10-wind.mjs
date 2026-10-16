/** ASCE/SEI 7-10, Chapter 27 Part 1. SI: m, m/s, kPa. */
export const SOURCE = Object.freeze({
  edition: 'ASCE7-10', version: '0.1.0', document: 'User-supplied ASCE 7-10.pdf',
  sha256: 'ae2997f7a31975965b33065ba54acbf4da441f4f821b2a97372d67c2bd1ca248',
});
export const FORMULAS = Object.freeze({
  kz: { clause: 'Table 27.3-1 note 1; Table 26.9-1', page: 261, pdf_page: 308, expression: 'Kz = 2.01 (max(z, 15 ft)/zg)^(2/alpha)' },
  q: { clause: '27.3-1', page: 260, pdf_page: 307, expression: 'q = 0.000613 Kz Kzt Kd V² [kPa]' },
  g: { clause: '26.9.1', page: 253, pdf_page: 300, expression: 'G = 0.85 (rigid buildings)' },
  internal: { clause: 'Table 26.11-1', page: 258, pdf_page: 305, expression: 'GCpi = ±0.18 enclosed; ±0.55 partially enclosed' },
  cp: { clause: 'Figure 27.4-1', page: 264, pdf_page: 311, expression: 'Cp: windward 0.8; side -0.7; leeward interpolated by L/B' },
  p: { clause: '27.4-1', page: 260, pdf_page: 307, expression: 'p = q G Cp - qi GCpi' },
  minimum: { clause: '27.4.7', page: 262, pdf_page: 309, expression: 'Fmin = 0.77 Awall + 0.38 Aroof,vertical [kN], simultaneous' },
});
const EXPOSURES = Object.freeze({ B: [7, 365.76], C: [9.5, 274.32], D: [11.5, 213.36] });
function number(v, name, min = 0, inclusive = false) {
  if (typeof v !== 'number' || !Number.isFinite(v) || (inclusive ? v < min : v <= min))
    throw new RangeError(`${name}: expected finite number ${inclusive ? '>=' : '>'} ${min}`);
  return v;
}
function choice(v, values, name) {
  if (!values.includes(v)) throw new RangeError(`${name}: expected ${values.join(', ')}`);
  return v;
}
export function exposureCoefficient(exposure, z_m) {
  choice(exposure, Object.keys(EXPOSURES), 'exposure');
  number(z_m, 'z_m', 0, true);
  const [alpha, zg_m] = EXPOSURES[exposure];
  if (z_m > zg_m) throw new RangeError('Height above gradient height is outside Table 27.3-1 formula scope');
  const effective_z_m = Math.max(15 * 0.3048, z_m);
  return { value: 2.01 * (effective_z_m / zg_m) ** (2 / alpha), effective_z_m, alpha, zg_m, formula: 'kz' };
}
export function velocityPressure({ v_mps, kz, kzt, kd }) {
  for (const [name, value] of Object.entries({ v_mps, kz, kzt, kd })) number(value, name);
  if (kzt < 1 || kd > 1) throw new RangeError('Require Kzt >= 1 and Kd <= 1');
  const q = 0.000613 * kz * kzt * kd * v_mps ** 2;
  if (!Number.isFinite(q)) throw new RangeError('Velocity pressure overflow');
  return q;
}
export function wallCoefficients(length_m, width_m) {
  const ratio = number(length_m, 'length_m') / number(width_m, 'width_m');
  const leeward = ratio <= 1 ? -0.5 : ratio < 2 ? -0.5 + 0.2 * (ratio - 1)
    : ratio < 4 ? -0.3 + 0.05 * (ratio - 2) : -0.2;
  return { windward: 0.8, leeward, side: -0.7, length_width_ratio: ratio, formula: 'cp' };
}
/** Low-slope roof, normal to ridge, Figure 27.4-1. No area reduction. */
export function lowSlopeRoofZones(h_m, length_m, slope_deg) {
  number(h_m, 'h_m'); number(length_m, 'length_m'); number(slope_deg, 'slope_deg', 0, true);
  if (slope_deg >= 10) return { status: 'NOT_IMPLEMENTED', reason: 'Roof slope >= 10° requires the pitched-roof coefficient branches.' };
  const t = Math.max(0, Math.min(1, (h_m / length_m - 0.5) / 0.5));
  const edges = [...new Set([0, h_m / 2, h_m, 2 * h_m, length_m].filter(x => x <= length_m))].sort((a, b) => a - b);
  const zones = edges.slice(0, -1).map((from_m, i) => {
    const to_m = edges[i + 1], x = (from_m + to_m) / 2;
    const low = x < h_m ? -0.9 : x < 2 * h_m ? -0.5 : -0.3;
    const high = x < h_m / 2 ? -1.3 : -0.7;
    return { from_m, to_m, cp_cases: [low + t * (high - low), -0.18] };
  });
  return { status: 'CALCULATED', formula: 'cp', zones, area_reduction: 'NONE', h_length_ratio: h_m / length_m };
}
/** Surface pressures only. No whole-building PASS or SAP load-case certification. */
export function calculateWind710(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Wind input required');
  choice(input.edition, ['ASCE7-10'], 'edition');
  const result = { source: SOURCE, units: { length: 'm', velocity: 'm/s', pressure: 'kPa' },
    overall_status: 'REVIEW_REQUIRED', status: 'INPUT_REQUIRED', formulas: FORMULAS,
    outstanding: ['Figure 27.4-8 simultaneous/torsional load cases', 'Orthogonal wind directions',
      'Independent worked-example review', 'C&C Chapter 30, parapets and overhangs are outside this kernel'] };
  if (input.rigid !== true || input.regular_shape !== true || input.chapter2_combinations !== true) {
    result.reason = 'Confirm rigid, regular building and use of Chapter 2 load combinations before applying G=0.85 and Kd=0.85.';
    return result;
  }
  const { building: b, wind: w } = input;
  if (!b || !w) throw new TypeError('building and wind required');
  choice(b.enclosure, ['ENCLOSED', 'PARTIALLY_ENCLOSED'], 'enclosure');
  choice(b.roof_type, ['GABLE', 'MONOSLOPE', 'FLAT'], 'roof_type');
  if (input.wind_normal_to_ridge !== true && b.roof_type !== 'FLAT') {
    result.reason = 'This kernel requires wind normal to ridge for gable/monoslope roofs.'; return result;
  }
  number(b.h_m, 'h_m'); number(b.z_m, 'z_m', 0, true);
  if (b.z_m > b.h_m) throw new RangeError('Wall evaluation height cannot exceed roof reference height');
  number(b.slope_deg, 'slope_deg', 0, true);
  if (b.slope_deg > 90 || (b.roof_type === 'FLAT' && b.slope_deg !== 0)) throw new RangeError('Inconsistent roof slope');
  const cp = wallCoefficients(b.length_m, b.width_m);
  const kz = exposureCoefficient(w.exposure, b.z_m), kh = exposureCoefficient(w.exposure, b.h_m);
  const q = k => velocityPressure({ v_mps: w.v_mps, kz: k, kzt: w.kzt, kd: 0.85 });
  const qz = q(kz.value), qh = q(kh.value), G = 0.85;
  let qiPositive = qh;
  if (b.enclosure === 'PARTIALLY_ENCLOSED') {
    choice(input.positive_internal_basis, ['QH_CONSERVATIVE', 'HIGHEST_OPENING'], 'positive_internal_basis');
    if (input.positive_internal_basis === 'HIGHEST_OPENING') {
      number(b.highest_opening_m, 'highest_opening_m', 0, true);
      if (b.highest_opening_m > b.h_m) throw new RangeError('Opening height exceeds roof reference height');
      qiPositive = q(exposureCoefficient(w.exposure, b.highest_opening_m).value);
    }
  }
  const magnitude = b.enclosure === 'ENCLOSED' ? 0.18 : 0.55;
  const surface = (coefficient, externalQ, gcpi, qi) => ({ cp: coefficient, external_kpa: externalQ * G * coefficient,
    internal_kpa: qi * gcpi, net_kpa: externalQ * G * coefficient - qi * gcpi, formula: 'p' });
  const roof = lowSlopeRoofZones(b.h_m, b.length_m, b.slope_deg);
  const cases = [-magnitude, magnitude].map(gcpi => {
    const qi = gcpi > 0 ? qiPositive : qh;
    return { id: gcpi > 0 ? 'INTERNAL_POSITIVE' : 'INTERNAL_NEGATIVE', gcpi, qi_kpa: qi,
      walls: { windward: surface(cp.windward, qz, gcpi, qi), leeward: surface(cp.leeward, qh, gcpi, qi),
        side_left: surface(cp.side, qh, gcpi, qi), side_right: surface(cp.side, qh, gcpi, qi) },
      roof: roof.status === 'CALCULATED' ? roof.zones.map(zone => ({ ...zone,
        alternatives: zone.cp_cases.map(c => surface(c, qh, gcpi, qi)) })) : null };
  });
  return { ...result, status: 'CALCULATED', inputs: structuredClone(input), trace: { kz, kh, qz_kpa: qz, qh_kpa: qh, kd: 0.85, G, cp },
    cases, roof, minimum: { status: 'REVIEW_REQUIRED', formula: 'minimum', wall_kpa: 0.77, roof_vertical_projection_kpa: 0.38,
      note: 'Apply simultaneously to projected areas and compare load effects; never clamp individual surface pressures.' } };
}
