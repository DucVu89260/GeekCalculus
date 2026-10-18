import { SOURCE, exposureCoefficient, velocityPressure } from './asce7-10-wind.mjs';

export const ENVELOPE_SOURCE = Object.freeze({ ...SOURCE, version: 'envelope-0.1.0',
  procedure: 'Chapter 28 Part 1', pdf_pages: [284, 285, 303, 305, 344, 345, 346, 347, 348],
  clauses: ['26.2', '26.10.3', 'Table 26.11-1', 'Table 28.3-1', '28.3-1', '28.4-1', 'Figure 28.4-1 notes 1–9'] });
const zonesA = ['1','2','3','4','1E','2E','3E','4E'];
const zonesB = ['1','2','3','4','5','6','1E','2E','3E','4E','5E','6E'];
// Visually transcribed from exact source PDF p.348 / printed p.301.
const anchors = [
  [0, [.40,-.69,-.37,-.29,.61,-1.07,-.53,-.43]],
  [5, [.40,-.69,-.37,-.29,.61,-1.07,-.53,-.43]],
  [20,[.53,-.69,-.48,-.43,.80,-1.07,-.69,-.64]],
  [30,[.56,.21,-.43,-.37,.69,.27,-.53,-.48]],
  [45,[.56,.21,-.43,-.37,.69,.27,-.53,-.48]],
];
const coefficientsB = [-.45,-.69,-.37,-.45,.40,-.29,-.48,-1.07,-.53,-.48,.61,-.43];
const positive = (v, name, zero = false) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || (zero ? v < 0 : v <= 0)) throw new RangeError(`${name}: ${zero ? '≥' : '>'} 0`);
  return v;
};
export function envelopeCoefficients(theta) {
  positive(theta, 'θ', true);
  if (theta > 45) throw new RangeError('Gable roof θ > 45° is outside this workspace');
  const upper = anchors.findIndex(([angle]) => angle >= theta);
  const lo = anchors[Math.max(0, upper - 1)], hi = anchors[upper];
  const ratio = hi[0] === lo[0] ? 0 : (theta - lo[0]) / (hi[0] - lo[0]);
  return { transverse: zonesA.map((zone,i) => ({zone, gcpf: theta === hi[0] ? hi[1][i] : lo[1][i] + ratio * (hi[1][i] - lo[1][i])})),
    longitudinal: zonesB.map((zone,i) => ({zone, gcpf: coefficientsB[i]})) };
}
export function calculateEnvelope710(input) {
  const { windSpeed, speedUnit, exposure, ridgeHeight: hr, eaveHeight: he, width: B, length: L,
    roofType, enclosure, kzt, kd } = input;
  for (const [name,value] of Object.entries({windSpeed,hr,he,B,L,kzt,kd})) positive(value,name);
  if (hr < he) throw new RangeError('hr ≥ he');
  if (!['GABLE','MONOSLOPE'].includes(roofType)) throw new RangeError('GABLE / MONOSLOPE');
  if (!['ENCLOSED','PARTIALLY_ENCLOSED'].includes(enclosure)) throw new RangeError('ENCLOSED / PARTIALLY_ENCLOSED');
  if (!['km/h','m/s'].includes(speedUnit)) throw new RangeError('km/h / m/s');
  if (kd !== .85) throw new RangeError('Building MWFRS Kd = 0.85, Table 26.6-1');
  const theta = Math.atan2(hr-he, roofType === 'GABLE' ? B/2 : B)*180/Math.PI;
  const h = theta <= 10 ? he : (hr+he)/2;
  const v_mps = speedUnit === 'km/h' ? windSpeed/3.6 : windSpeed;
  // Ch28 Table 28.3-1 adds the 30 ft floor for B, unlike Chapter 27.
  const kh = exposureCoefficient(exposure, Math.max(h, exposure === 'B' ? 30*.3048 : 15*.3048));
  const qh = velocityPressure({v_mps,kz:kh.value,kzt,kd});
  const gcpi = enclosure === 'ENCLOSED' ? .18 : .55;
  const a = Math.max(Math.min(.1*Math.min(B,L),.4*h),.04*Math.min(B,L),.9);
  const checks = { height: h <= 18, plan: h <= Math.min(B,L), slope: theta <= 45,
    roof: roofType === 'GABLE' };
  const eligible = Object.values(checks).every(Boolean);
  const messages = [];
  if (!checks.height) messages.push('LOW_RISE_HEIGHT');
  if (!checks.plan) messages.push('LOW_RISE_PLAN');
  if (!checks.slope) messages.push('ROOF_SLOPE');
  if (!checks.roof) messages.push('MONOSLOPE_REVIEW');
  if (input.hurricane) messages.push('OPENING_PROTECTION_REVIEW');
  const pressureRows = rows => rows.map(row => ({...row, positive: qh*(row.gcpf-gcpi), negative: qh*(row.gcpf+gcpi)}));
  const result = { source: ENVELOPE_SOURCE, input: structuredClone(input), status: eligible ? 'CALCULATED_PRELIMINARY' : 'OUTSIDE_SCOPE',
    overall_status:'REVIEW_REQUIRED', messages, checks,
    derived:{theta,h,v_mps,kh:kh.value,alpha:kh.alpha,zg_m:kh.zg_m,zg_ft:kh.zg_m/.3048,effective_height:kh.effective_z_m,qh,gcpi,a,two_a:2*a},
    transverse:[],longitudinal:[],torsionA:[],torsionB:[],
    zone2:{ transverse:Math.min(.5*B,2.5*he),longitudinal:Math.min(.5*L,2.5*he) },
    minimum:{wall_kpa:.77,roof_projected_kpa:.38,status:'REVIEW_REQUIRED',clause:'28.4.4'},
    conditions_confirmed: input.conditionsConfirmed === true,
  };
  if (eligible) {
    const coeff = envelopeCoefficients(theta);
    result.transverse = pressureRows(coeff.transverse); result.longitudinal = pressureRows(coeff.longitudinal);
    // Note 5 reduces FULL NET design pressure, including internal pressure, to 25%.
    const torsion = row => ({zone:row.zone+'T',gcpf:null,positive:.25*row.positive,negative:.25*row.negative});
    result.torsionA = result.transverse.filter(row=>['1','2','3','4'].includes(row.zone)).map(torsion);
    result.torsionB = result.longitudinal.filter(row=>['5','6'].includes(row.zone)).map(torsion);
  }
  return result;
}
