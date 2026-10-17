import test from 'node:test';
import assert from 'node:assert/strict';
import { F4_FORMULAS, F4_SOURCE, calculateF4NoncompactWeb } from '../../../../standards/aisc360-10-ih-flexure.mjs';

const baseSection = Object.freeze({ h_mm: 800, bf_mm: 320, tw_mm: 7, tf_mm: 16, fabrication: 'BUILT_UP' });
const baseInput = Object.freeze({
  section: baseSection,
  material: Object.freeze({ fy_mpa: 345, e_mpa: 200000 }),
  member: Object.freeze({ lb_mm: 2000 }),
});

// Independent sharp-corner plate properties for fixture dimensions. These are
// only geometry inputs; the F4 expected strengths below are fixed hand-checks.
function plateProperties(section) {
  const { h_mm: h, bf_mm: bf, tw_mm: tw, tf_mm: tf } = section;
  const hc = h - 2 * tf;
  const ho = h - tf;
  const ix = 2 * (bf * tf ** 3 / 12 + bf * tf * (h / 2 - tf / 2) ** 2) + tw * hc ** 3 / 12;
  return {
    sx_mm3: ix / (h / 2),
    zx_mm3: bf * tf * (h - tf) + tw * hc ** 2 / 4,
    iy_mm4: 2 * (tf * bf ** 3 / 12) + hc * tw ** 3 / 12,
    // Existing sharp-corner geometry core's open thin-wall Saint-Venant sum.
    torsion_constant_j_mm4: (2 * bf * tf ** 3 + ho * tw ** 3) / 3,
  };
}

const canonical = Object.freeze({
  sx_mm3: 4594947.413333333,
  zx_mm3: 5046272,
  iy_mm4: 87403285.33333333,
  torsion_constant_j_mm4: 963450.6666666666,
});
const conservativeCb = Object.freeze({ value: 1, source: 'CONSERVATIVE', clause: 'F1-1 (Cb=1 conservative)' });
const run = (input = baseInput, props = canonical, options = { cb: conservativeCb }) =>
  calculateF4NoncompactWeb(input, props, options);
const near = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Number.isFinite(actual), `Expected finite value, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `Expected ${actual} near ${expected}`);
};

test('F4 source metadata records the supplied 2010 artifact and the verified F4-11 expression', () => {
  assert.equal(F4_SOURCE.artifact_sha256, 'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99');
  assert.deepEqual(F4_SOURCE.physical_pages, [106, 107, 108, 109]);
  assert.deepEqual(F4_SOURCE.printed_pages, ['16.1-50', '16.1-51', '16.1-52', '16.1-53']);
  assert.match(F4_FORMULAS['F4-11'].expression, /sqrt\(12\[/);
  for (const id of ['F4-1', 'F4-2', 'F4-3', 'F4-7', 'F4-8', 'F4-9a/F4-9b/F4-10', 'F4-11', 'F4-12', 'F4-13', 'F4-14', 'F4-15/F4-16a/F4-16b']) {
    assert.ok(F4_FORMULAS[id], `Missing F4 formula metadata ${id}`);
  }
});

test('F4-1 and F4-13 hand fixture govern with LTB inapplicable at short Lb', () => {
  const result = run();
  assert.equal(result.id, 'MAJOR_FLEXURE');
  assert.equal(result.status, 'CALCULATED');
  assert.equal(result.clause, 'F4');
  assert.deepEqual(result.source, F4_SOURCE);
  near(result.nominal, 1614.7012359645685);
  near(result.trace.lambda_web, 109.71428571428571);
  near(result.trace.lambda_pw, 90.530161520515);
  near(result.trace.lambda_rw, 137.239872518292);
  near(result.trace.i_yc_over_i_y, 0.499874421196);
  near(result.trace.aw, 1.05);
  near(result.trace.rt_mm, 86.345141389104285);
  near(result.trace.lp_mm, 2286.8413713065092);
  near(result.trace.rpc, 1.057881243612);
  near(result.trace.mn_compression_flange_yielding_kNm, 1677.0134959617872);
  near(result.trace.mn_compression_flange_local_buckling_kNm, 1614.7012359645685);
  assert.equal(result.trace.ltb_clause, 'NOT_APPLICABLE_LB_LE_LP');
  assert.equal(result.trace.flb_clause, 'F4-13');
  assert.equal(result.trace.governing_clause, 'F4-13');
  assert.equal(result.trace.tension_flange_yielding.status, 'NOT_APPLICABLE');
  assert.equal(result.trace.cb_source, 'NOT_REQUIRED_LB_LE_LP');
  assert.equal(result.available, undefined);
});

test('F4-2 and F4-3 use the source-defined inelastic and elastic LTB branches', () => {
  const inelasticInput = structuredClone(baseInput);
  inelasticInput.member.lb_mm = 5000;
  const inelastic = run(inelasticInput);
  assert.equal(inelastic.status, 'CALCULATED');
  assert.equal(inelastic.trace.ltb_clause, 'F4-2');
  near(inelastic.trace.j_mm4, 963450.6666666666);
  near(inelastic.trace.q_j_over_sxho, 0.000267444009);
  near(inelastic.trace.lr_mm, 8152.511172249191);
  near(inelastic.trace.mn_ltb_kNm, 1414.5939660674);
  near(inelastic.nominal, 1414.5939660674);
  assert.equal(inelastic.trace.cb, 1);
  assert.equal(inelastic.trace.cb_source, 'CONSERVATIVE');
  assert.equal(inelastic.trace.cb_clause, 'F1-1 (Cb=1 conservative)');

  const elasticInput = structuredClone(baseInput);
  elasticInput.member.lb_mm = 10000;
  const elastic = run(elasticInput);
  assert.equal(elastic.status, 'CALCULATED');
  assert.equal(elastic.trace.ltb_clause, 'F4-3/F4-5');
  near(elastic.trace.fcr_mpa, 166.48573830517225);
  near(elastic.nominal, 764.9932125822414);
});

test('F4 length boundaries use no LTB at Lp, F4-2 through Lr, and F4-3 above Lr', () => {
  const d = 800;
  const hc = d - 2 * 16;
  const ho = 800 - 16;
  const aw = hc * 7 / (320 * 16);
  const rt = 320 / Math.sqrt(12 * (ho / d + aw * hc ** 2 / (6 * ho * d)));
  const lp = 1.1 * rt * Math.sqrt(200000 / 345);
  const j = canonical.torsion_constant_j_mm4;
  const q = j / (canonical.sx_mm3 * ho);
  const fl = 0.7 * 345;
  const lr = 1.95 * rt * 200000 / fl * Math.sqrt(q + Math.sqrt(q ** 2 + 6.76 * (fl / 200000) ** 2));

  const atLp = structuredClone(baseInput);
  atLp.member.lb_mm = lp;
  assert.equal(run(atLp).trace.ltb_clause, 'NOT_APPLICABLE_LB_LE_LP');

  const aboveLp = structuredClone(baseInput);
  aboveLp.member.lb_mm = lp + 1e-7;
  assert.equal(run(aboveLp).trace.ltb_clause, 'F4-2');

  const atLr = structuredClone(baseInput);
  atLr.member.lb_mm = lr;
  assert.equal(run(atLr).trace.ltb_clause, 'F4-2');

  const aboveLr = structuredClone(baseInput);
  aboveLr.member.lb_mm = lr + 1e-3;
  assert.equal(run(aboveLr).trace.ltb_clause, 'F4-3/F4-5');
});

test('F4-13 is skipped for compact flanges and F4-14 covers slender flanges', () => {
  const compactFlangeInput = structuredClone(baseInput);
  compactFlangeInput.section.bf_mm = 280;
  const compact = run(compactFlangeInput, plateProperties(compactFlangeInput.section));
  assert.equal(compact.status, 'CALCULATED');
  assert.equal(compact.trace.flb_clause, 'NOT_APPLICABLE_COMPACT_FLANGE');
  assert.equal(compact.trace.mn_compression_flange_local_buckling_kNm, null);

  const slenderFlangeInput = structuredClone(baseInput);
  slenderFlangeInput.section.bf_mm = 600;
  const slender = run(slenderFlangeInput, plateProperties(slenderFlangeInput.section));
  assert.equal(slender.status, 'CALCULATED');
  assert.equal(slender.trace.flb_clause, 'F4-14');
  near(slender.trace.mn_compression_flange_local_buckling_kNm, 1571.5177393375056);
  near(slender.nominal, 1571.5177393375056);
});

test('F4 web classification boundaries block compact/slender webs and admit noncompact webs', () => {
  const h = baseSection.h_mm;
  const tf = baseSection.tf_mm;
  const hc = h - 2 * tf;
  const root = Math.sqrt(200000 / 345);
  const lambdaPw = 3.76 * root;
  const lambdaRw = 5.70 * root;

  const belowCompactBoundary = structuredClone(baseInput);
  belowCompactBoundary.section.tw_mm = hc / (lambdaPw - 1e-7);
  assert.equal(run(belowCompactBoundary, plateProperties(belowCompactBoundary.section)).status, 'REVIEW_REQUIRED');

  const withinNoncompactRange = structuredClone(baseInput);
  withinNoncompactRange.section.tw_mm = hc / (lambdaRw - 1e-7);
  assert.equal(run(withinNoncompactRange, plateProperties(withinNoncompactRange.section)).status, 'CALCULATED');

  const aboveSlenderBoundary = structuredClone(baseInput);
  aboveSlenderBoundary.section.tw_mm = hc / (lambdaRw + 1e-7);
  assert.equal(run(aboveSlenderBoundary, plateProperties(aboveSlenderBoundary.section)).status, 'REVIEW_REQUIRED');
});

test('missing required inputs fail closed; Cw is not an F4 input', () => {
  const missingLength = structuredClone(baseInput);
  delete missingLength.member.lb_mm;
  assert.equal(run(missingLength).status, 'INPUT_REQUIRED');

  const longLb = structuredClone(baseInput);
  longLb.member.lb_mm = 5000;
  const missingJ = { ...canonical };
  delete missingJ.torsion_constant_j_mm4;
  assert.equal(run(longLb, missingJ).status, 'INPUT_REQUIRED');

  const missingIy = { ...canonical };
  delete missingIy.iy_mm4;
  assert.equal(run(longLb, missingIy).status, 'INPUT_REQUIRED');
  assert.equal(run(longLb, { ...canonical, warping_constant_cw_mm6: undefined }).status, 'CALCULATED');

  assert.equal(calculateF4NoncompactWeb(longLb, canonical).status, 'INPUT_REQUIRED');
  assert.equal(run(longLb, canonical, { cb: { value: 0.95, source: 'BAD_INPUT' } }).status, 'REVIEW_REQUIRED');
});

test('rolled fillets, malformed dimensions and impossible canonical Iyc/Iy stay blocked', () => {
  const rolled = structuredClone(baseInput);
  rolled.section.fabrication = 'ROLLED';
  const rolledResult = run(rolled);
  assert.equal(rolledResult.status, 'REVIEW_REQUIRED');
  assert.deepEqual(rolledResult.source, F4_SOURCE);

  const invalidGeometry = structuredClone(baseInput);
  invalidGeometry.section.h_mm = 32;
  assert.equal(run(invalidGeometry, plateProperties(invalidGeometry.section)).status, 'REVIEW_REQUIRED');

  const impossibleWeakAxisInertia = { ...canonical, iy_mm4: 40000000 };
  assert.equal(run(baseInput, impossibleWeakAxisInertia).status, 'REVIEW_REQUIRED');
});
