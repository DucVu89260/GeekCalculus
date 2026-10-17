import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateIHShear, FORMULAS, SOURCE } from '../../../../standards/aisc360-10-ih-shear.mjs';

const standardsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../standards');
const registry = JSON.parse(readFileSync(join(standardsDir, 'aisc360-10-strength-factors.json'), 'utf8'));
const factorLib = {
  availableStrength(nominal, method, key) {
    const factor = registry.factors[key];
    assert.ok(factor, `Missing AISC factor ${key}`);
    return method === 'LRFD' ? factor.phi * nominal : nominal / factor.omega;
  },
  getFactor(key) {
    const factor = registry.factors[key];
    assert.ok(factor, `Missing AISC factor ${key}`);
    return { ...factor, key, edition: registry.edition };
  },
};

const baseInput = () => ({
  method: 'LRFD',
  section: {
    h_mm: 1000,
    bf_mm: 300,
    tf_mm: 20,
    tw_mm: 8,
    fabrication: 'BUILT_UP',
    web_attachment: 'WELDED',
  },
  material: { fy_mpa: 345, e_mpa: 200000 },
  forces: { shear_y_kN: 1000, shear_x_kN: -400, torsion_kNm: 0 },
});
const plateStiffener = ({ width_mm = 50, thickness_mm = 8 } = {}) => ({
  layout: 'PAIRED',
  orientation: 'PERPENDICULAR_RECTANGULAR_PLATE',
  width_mm,
  thickness_mm,
  fy_mpa: 345,
  attachment_details_verified: true,
});
const near = (actual, expected, tolerance = 1e-9) => assert.ok(
  Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
  `Expected ${actual} near ${expected}`,
);

test('Chapter G trace identifies the supplied 2010 artifact and each source page', () => {
  assert.equal(SOURCE.reference, 'ANSI/AISC 360-10, June 22, 2010');
  assert.equal(SOURCE.artifact_sha256, 'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99');
  for (const [id, formula] of Object.entries(FORMULAS)) {
    assert.ok(formula.source, `Missing source page for ${id}`);
    assert.ok(formula.applies, `Missing applicability for ${id}`);
  }
  const webSources = calculateIHShear(baseInput(), null, factorLib).limit_states.shear_web.source;
  assert.ok(webSources.length > 0);
  for (const source of webSources) {
    assert.equal(source.artifact_sha256, SOURCE.artifact_sha256);
    assert.match(source.source, /physical \d+/);
  }
});

test('G2 unstiffened web uses G2-5 and keeps required stiffeners visible when demand exceeds kv=5', () => {
  // Hand calculation from G2-1/G2-5, physical 123–124: d=1000, h=960,
  // tw=8, Aw=8000 mm², h/tw=120, kv=5, Cv=1.51(5)(200000)/(345·120²).
  const input = baseInput();
  const result = calculateIHShear(input, null, factorLib);
  const web = result.limit_states.shear_web;
  near(web.trace.cv, 0.30394524959742353);
  near(web.nominal_kN, 503.33333333333337);
  near(web.available_kN, 453.00000000000006);
  assert.equal(web.trace.cv_branch, 'G2-5');
  assert.equal(web.trace.kv, 5);
  assert.equal(result.limit_states.stiffeners.status, 'INPUT_REQUIRED');
  assert.equal(web.passes, false);

  const asd = structuredClone(input);
  asd.method = 'ASD';
  const asdWeb = calculateIHShear(asd, null, factorLib).limit_states.shear_web;
  near(asdWeb.nominal_kN, 503.33333333333337);
  near(asdWeb.available_kN, 301.3972055888227);
});

test('G2-4 and G2-3 branch boundaries use clear web h and the correct panel kv', () => {
  // h/tw=70 lies in G2-4. Constants are independently obtained from
  // 1.10√(5·200000/345)/70 and Vn=0.6Fy(d·tw)Cv.
  const intermediate = baseInput();
  intermediate.section.h_mm = 600;
  intermediate.section.tf_mm = 20;
  intermediate.section.tw_mm = 8;
  intermediate.forces.shear_y_kN = 0;
  const g2_4 = calculateIHShear(intermediate, null, factorLib).limit_states.shear_web;
  assert.equal(g2_4.trace.cv_branch, 'G2-4');
  near(g2_4.trace.cv, 0.8460287032342602);
  near(g2_4.nominal_kN, 840.6141195335609);

  // A verified paired plate at a/h=500/960 gives kv=23.432 and the G2-3 Cv=1 branch.
  const stiffened = baseInput();
  stiffened.stiffeners = { spacing_mm: 500, ...plateStiffener({ width_mm: 80, thickness_mm: 10 }) };
  stiffened.forces.shear_y_kN = 0;
  const g2_3 = calculateIHShear(stiffened, null, factorLib).limit_states.shear_web;
  assert.equal(g2_3.trace.cv_branch, 'G2-3');
  near(g2_3.trace.kv, 23.432);
  near(g2_3.trace.cv, 1);
});

test('G2-4 upper limit is 1.37√(kvE/Fy), and the interval up to 1.507√ uses G2-5', () => {
  const root = Math.sqrt(5 * 200000 / 345);
  const makeAtRatio = ratio => {
    const input = baseInput();
    input.section.tf_mm = 20;
    input.section.tw_mm = 10;
    input.section.h_mm = ratio * input.section.tw_mm + 2 * input.section.tf_mm;
    input.forces.shear_y_kN = 0;
    return calculateIHShear(input, null, factorLib).limit_states.shear_web;
  };

  const atUpperLimit = makeAtRatio(1.37 * root);
  assert.equal(atUpperLimit.trace.cv_branch, 'G2-4');
  near(atUpperLimit.trace.cv_upper_threshold, 1.37 * root);
  near(atUpperLimit.trace.cv, 1.10 / 1.37);

  // This is above 1.37√(kvE/Fy) but below the erroneous 1.37·1.10√(...)
  // cutoff; the standard therefore requires G2-5 here.
  const betweenBoundaries = makeAtRatio(1.44 * root);
  assert.equal(betweenBoundaries.trace.cv_branch, 'G2-5');
  near(betweenBoundaries.trace.h_over_tw, 1.44 * root);
  near(betweenBoundaries.trace.cv, 1.51 / 1.44 ** 2);
});

test('G2-6 keeps the formula at a/h=3 and at the slenderness cutoff, then sets kv=5 above', () => {
  const atThree = baseInput();
  atThree.stiffeners = { spacing_mm: 2880, ...plateStiffener() };
  atThree.forces.shear_y_kN = 0;
  const kvAtThree = calculateIHShear(atThree, null, factorLib).limit_states.shear_web.trace.kv;
  near(kvAtThree, 5 + 5 / 3 ** 2);

  const aboveThree = structuredClone(atThree);
  aboveThree.stiffeners.spacing_mm = 2880.01;
  assert.equal(calculateIHShear(aboveThree, null, factorLib).limit_states.shear_web.trace.kv, 5);

  const atSlendernessCutoff = baseInput();
  atSlendernessCutoff.section.h_mm = 1640;
  atSlendernessCutoff.section.tw_mm = 8;
  atSlendernessCutoff.stiffeners = { spacing_mm: 2704, ...plateStiffener() };
  atSlendernessCutoff.forces.shear_y_kN = 0;
  const exactLimit = calculateIHShear(atSlendernessCutoff, null, factorLib).limit_states.shear_web;
  near(exactLimit.trace.kv_trace.kv5_condition_aspect, 1.69);
  near(exactLimit.trace.kv, 5 + 5 / 1.69 ** 2);

  const aboveSlendernessCutoff = structuredClone(atSlendernessCutoff);
  aboveSlendernessCutoff.stiffeners.spacing_mm = 2704.01;
  assert.equal(calculateIHShear(aboveSlendernessCutoff, null, factorLib).limit_states.shear_web.trace.kv, 5);
});

test('G2.2 uses rectangle integration about the proper pair axis and rejects unverified attachment', () => {
  const input = baseInput();
  input.stiffeners = { spacing_mm: 900, ...plateStiffener() };
  const result = calculateIHShear(input, null, factorLib);
  const stiffeners = result.limit_states.stiffeners;
  assert.equal(stiffeners.status, 'CALCULATED');
  near(stiffeners.trace.inertia_mm4, 839466.6666666666);
  near(stiffeners.trace.required_inertia_mm4, 389120);
  assert.equal(stiffeners.trace.inertia_source, 'RECTANGLE_INTEGRATION_ABOUT_WEB_CENTER');
  near(result.limit_states.shear_web.trace.kv, 10.68888888888889);
  near(result.limit_states.shear_web.trace.cv, 0.6497674002504922);
  near(result.limit_states.shear_web.nominal_kN, 1076.014814814815);
  near(result.limit_states.shear_web.available_kN, 968.4133333333335);

  const unverified = baseInput();
  unverified.stiffeners = { spacing_mm: 900, ...plateStiffener(), attachment_details_verified: false };
  const baseline = calculateIHShear(unverified, null, factorLib);
  assert.equal(baseline.limit_states.stiffeners.status, 'REVIEW_REQUIRED');
  assert.equal(baseline.limit_states.shear_web.trace.stiffeners_used_for_kv, false);
  near(baseline.limit_states.shear_web.nominal_kN, 503.33333333333337);
});

test('G2.2 single rectangular plate uses the face-contact axis and G2.7 minimum', () => {
  const input = baseInput();
  input.forces.shear_y_kN = 1000;
  input.stiffeners = {
    spacing_mm: 900,
    layout: 'SINGLE_PLATE',
    orientation: 'PERPENDICULAR_RECTANGULAR_PLATE',
    width_mm: 50,
    thickness_mm: 8,
    fy_mpa: 345,
    attachment_details_verified: true,
  };
  const result = calculateIHShear(input, null, factorLib);
  near(result.limit_states.stiffeners.trace.inertia_mm4, 333333.3333333333);
  assert.equal(result.limit_states.stiffeners.trace.inertia_source, 'RECTANGLE_INTEGRATION_ABOUT_WEB_CONTACT_FACE');
  assert.equal(result.limit_states.stiffeners.status, 'REVIEW_REQUIRED');
  assert.equal(result.limit_states.shear_web.trace.stiffeners_used_for_kv, false);
});

test('missing optional stiffener dimensions fail closed without interrupting a safe G2 check', () => {
  const input = baseInput();
  input.forces.shear_y_kN = 100;
  input.stiffeners = {
    spacing_mm: 900,
    layout: 'PAIRED',
    orientation: 'PERPENDICULAR_RECTANGULAR_PLATE',
    width_mm: '',
    thickness_mm: 8,
    fy_mpa: 345,
    attachment_details_verified: true,
  };

  const result = calculateIHShear(input, null, factorLib);
  assert.equal(result.limit_states.stiffeners.status, 'NOT_REQUIRED');
  assert.equal(result.limit_states.shear_web.trace.stiffeners_used_for_kv, false);
  assert.equal(result.limit_states.shear_web.trace.kv, 5);
  near(result.limit_states.shear_web.available_kN, 453);
});

test('G2.1(a) rolled exception is isolated to qualified rolled webs and uses 1.00/1.50', () => {
  const input = baseInput();
  input.section = { h_mm: 500, bf_mm: 200, tf_mm: 20, tw_mm: 10, fabrication: 'ROLLED',
    web_clear_height_mm: 450, web_clear_height_verified: true };
  input.method = 'LRFD';
  input.forces.shear_y_kN = 100;
  const lrfd = calculateIHShear(input, null, factorLib).limit_states.shear_web;
  assert.equal(lrfd.trace.cv_branch, 'G2.1(a)');
  assert.equal(lrfd.factor.key, 'SHEAR_ROLLED_G21A');
  near(lrfd.nominal_kN, 1035);
  near(lrfd.available_kN, 1035);

  const asdInput = structuredClone(input);
  asdInput.method = 'ASD';
  const asd = calculateIHShear(asdInput, null, factorLib).limit_states.shear_web;
  near(asd.nominal_kN, lrfd.nominal_kN);
  near(asd.available_kN, 690);

  const justOutside = structuredClone(input);
  justOutside.section.tw_mm = 450 / (2.24 * Math.sqrt(200000 / 345) * (1 + 1e-9));
  const general = calculateIHShear(justOutside, null, factorLib).limit_states.shear_web;
  assert.notEqual(general.factor.key, 'SHEAR_ROLLED_G21A');
});

test('G2 blocks h/tw at 260 without valid stiffeners and rolled clear h must be verified', () => {
  const at260 = baseInput();
  at260.section.h_mm = 2630;
  at260.section.tf_mm = 15;
  at260.section.tw_mm = 10;
  at260.forces.shear_y_kN = 1;
  assert.equal(calculateIHShear(at260, null, factorLib).limit_states.shear_web.status, 'INPUT_REQUIRED');

  const rolled = baseInput();
  rolled.section = { h_mm: 500, bf_mm: 200, tf_mm: 20, tw_mm: 10, fabrication: 'ROLLED', web_clear_height_mm: 450 };
  assert.equal(calculateIHShear(rolled, null, factorLib).limit_states.shear_web.status, 'INPUT_REQUIRED');

  const bolted = baseInput();
  bolted.section.web_attachment = 'BOLTED';
  assert.equal(calculateIHShear(bolted, null, factorLib).limit_states.shear_web.status, 'INPUT_REQUIRED');
});

test('G2.2 omits stiffeners only by its slenderness exemption or kv=5 capacity comparison', () => {
  const slim = baseInput();
  slim.section.h_mm = 600;
  slim.section.tf_mm = 20;
  slim.section.tw_mm = 10;
  slim.forces.shear_y_kN = 100;
  const byRatio = calculateIHShear(slim, null, factorLib).limit_states.stiffeners;
  assert.equal(byRatio.status, 'NOT_REQUIRED');
  assert.equal(byRatio.trace.not_required_by_ratio, true);

  const strongEnough = baseInput();
  strongEnough.forces.shear_y_kN = 100;
  const byCapacity = calculateIHShear(strongEnough, null, factorLib).limit_states.stiffeners;
  assert.equal(byCapacity.status, 'NOT_REQUIRED');
  assert.equal(byCapacity.trace.not_required_by_strength, true);
});

test('G7 weak-axis capacity sums the two flange elements and requires zero torsion', () => {
  const input = baseInput();
  const result = calculateIHShear(input, null, factorLib);
  const weak = result.limit_states.shear_weak_axis;
  const alias = result.limit_states.shear_flange;
  assert.equal(weak.clause, 'G7/G2.1(b)');
  near(weak.trace.b_mm, 150);
  near(weak.trace.b_over_tf, 7.5);
  near(weak.trace.nominal_per_flange_kN, 1242);
  near(weak.nominal_kN, 2484);
  near(weak.available_kN, 2235.6);
  near(weak.trace.demand_per_flange_kN, 200);
  assert.equal(alias.nominal_kN, weak.nominal_kN);
  assert.equal(alias.available_kN, weak.available_kN);

  const asdInput = structuredClone(input);
  asdInput.method = 'ASD';
  const asd = calculateIHShear(asdInput, null, factorLib).limit_states.shear_weak_axis;
  near(asd.nominal_kN, weak.nominal_kN);
  near(asd.available_kN, 2484 / 1.67);

  const noTorsionInput = structuredClone(input);
  delete noTorsionInput.forces.torsion_kNm;
  assert.equal(calculateIHShear(noTorsionInput, null, factorLib).limit_states.shear_flange.status, 'INPUT_REQUIRED');
  noTorsionInput.forces.torsion_kNm = 12;
  assert.equal(calculateIHShear(noTorsionInput, null, factorLib).limit_states.shear_flange.status, 'REVIEW_REQUIRED');
});

test('G3 TFA adds strength only after source eligibility and both bounding-stiffener checks pass', () => {
  const input = baseInput();
  input.stiffeners = { spacing_mm: 900, ...plateStiffener() };
  input.forces.shear_y_kN = 1000;
  input.tension_field_action = {
    enabled: true,
    is_end_panel: false,
    four_sides_supported: true,
    adjacent_panels: [
      { spacing_mm: 900, shear_kN: 800, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
      { spacing_mm: 900, shear_kN: 900, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
    ],
    bounding_stiffeners: [plateStiffener(), plateStiffener()],
  };
  const result = calculateIHShear(input, null, factorLib);
  const tfa = result.limit_states.tension_field_action;
  const web = result.limit_states.shear_web;
  assert.equal(tfa.status, 'CALCULATED');
  assert.equal(web.clause, 'G3-2');
  near(web.nominal_g2_kN, 1076.014814814815);
  near(web.nominal_kN, 1443.945919547571);
  near(web.available_kN, 1299.551327592814);
  near(tfa.trace.g3_4[0].ist1_mm4, 389120);
  near(tfa.trace.g3_4[0].ist2_mm4, 1521278.018186416);
  near(tfa.trace.g3_4[0].required_inertia_mm4, 497114.547754691);
  assert.equal(result.limit_states.stiffeners.status, 'CALCULATED');
  assert.equal(result.overall_status, 'REVIEW_REQUIRED');
});

test('G3.4 trace labels right-boundary current and adjacent panel minima correctly', () => {
  const input = baseInput();
  input.stiffeners = { spacing_mm: 900, ...plateStiffener() };
  input.forces.shear_y_kN = 100;
  input.tension_field_action = {
    enabled: true,
    is_end_panel: false,
    four_sides_supported: true,
    adjacent_panels: [
      { spacing_mm: 800, shear_kN: 80, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
      { spacing_mm: 1200, shear_kN: 90, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
    ],
    bounding_stiffeners: [plateStiffener({ width_mm: 100, thickness_mm: 10 }), plateStiffener({ width_mm: 100, thickness_mm: 10 })],
  };

  const tfa = calculateIHShear(input, null, factorLib).limit_states.tension_field_action;
  assert.equal(tfa.status, 'CALCULATED');
  near(tfa.trace.bounding_stiffeners[0].g2_2_requirements_mm4.adjacent_panel, 655360);
  near(tfa.trace.bounding_stiffeners[0].g2_2_requirements_mm4.current_panel, 389120);
  near(tfa.trace.bounding_stiffeners[1].g2_2_requirements_mm4.adjacent_panel, 245760);
  near(tfa.trace.bounding_stiffeners[1].g2_2_requirements_mm4.current_panel, 389120);
});

test('G3.4 uses the greater of G2.2 Ist1 and interpolation when Ist2 is lower', () => {
  const input = baseInput();
  input.section = { h_mm: 140, bf_mm: 100, tf_mm: 20, tw_mm: 1.5625, fabrication: 'BUILT_UP', web_attachment: 'WELDED' };
  input.forces.shear_y_kN = 39.8;
  input.forces.shear_x_kN = 0;
  input.stiffeners = { spacing_mm: 300, ...plateStiffener({ width_mm: 20, thickness_mm: 5 }) };
  input.tension_field_action = {
    enabled: true,
    is_end_panel: false,
    four_sides_supported: true,
    adjacent_panels: [
      { spacing_mm: 300, shear_kN: 39.8, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
      { spacing_mm: 300, shear_kN: 39.8, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
    ],
    bounding_stiffeners: [plateStiffener({ width_mm: 20, thickness_mm: 5 }), plateStiffener({ width_mm: 20, thickness_mm: 5 })],
  };

  const result = calculateIHShear(input, null, factorLib);
  const g34 = result.limit_states.tension_field_action.trace.g3_4[0];
  assert.equal(result.limit_states.tension_field_action.status, 'CALCULATED');
  assert.ok(g34.ist2_mm4 < g34.ist1_mm4);
  assert.ok(g34.interpolated_inertia_mm4 < g34.ist1_mm4);
  near(g34.required_inertia_mm4, g34.ist1_mm4);
});

test('G3 end panels and incomplete adjacent support never receive increased capacity', () => {
  const input = baseInput();
  input.stiffeners = { spacing_mm: 900, ...plateStiffener() };
  input.tension_field_action = {
    enabled: true,
    is_end_panel: true,
    four_sides_supported: true,
    adjacent_panels: [
      { spacing_mm: 900, shear_kN: 800, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
      { spacing_mm: 900, shear_kN: 900, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
    ],
    bounding_stiffeners: [plateStiffener(), plateStiffener()],
  };
  const endPanel = calculateIHShear(input, null, factorLib);
  assert.equal(endPanel.limit_states.tension_field_action.status, 'NOT_APPLICABLE');
  near(endPanel.limit_states.shear_web.nominal_kN, 1076.014814814815);

  const unverified = structuredClone(input);
  unverified.tension_field_action.is_end_panel = false;
  unverified.tension_field_action.adjacent_panels[0].other_boundary_stiffeners_verified = false;
  const incomplete = calculateIHShear(unverified, null, factorLib);
  assert.equal(incomplete.limit_states.tension_field_action.status, 'INPUT_REQUIRED');
  near(incomplete.limit_states.shear_web.nominal_kN, 1076.014814814815);
});

test('G3.3 slender stiffeners, missing panel inputs and over-capacity demands block TFA', () => {
  const base = baseInput();
  base.stiffeners = { spacing_mm: 900, ...plateStiffener() };
  base.tension_field_action = {
    enabled: true,
    is_end_panel: false,
    four_sides_supported: true,
    adjacent_panels: [
      { spacing_mm: 900, shear_kN: 800, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
      { spacing_mm: 900, shear_kN: 900, is_end_panel: false, four_sides_supported: true, other_boundary_stiffeners_verified: true },
    ],
    bounding_stiffeners: [plateStiffener({ width_mm: 200 }), plateStiffener()],
  };
  const slender = calculateIHShear(base, null, factorLib);
  assert.equal(slender.limit_states.tension_field_action.status, 'REVIEW_REQUIRED');
  near(slender.limit_states.shear_web.nominal_kN, 1076.014814814815);

  const incomplete = baseInput();
  incomplete.stiffeners = { spacing_mm: 900, ...plateStiffener() };
  incomplete.tension_field_action = { enabled: true, is_end_panel: false, four_sides_supported: true };
  assert.equal(calculateIHShear(incomplete, null, factorLib).limit_states.tension_field_action.status, 'INPUT_REQUIRED');

  const missingStiffenerSize = structuredClone(base);
  missingStiffenerSize.tension_field_action.bounding_stiffeners[0].width_mm = '';
  const blocked = calculateIHShear(missingStiffenerSize, null, factorLib);
  assert.equal(blocked.limit_states.tension_field_action.status, 'REVIEW_REQUIRED');
  near(blocked.limit_states.shear_web.nominal_kN, 1076.014814814815);

  const missingStiffenerYield = structuredClone(base);
  delete missingStiffenerYield.tension_field_action.bounding_stiffeners[0].fy_mpa;
  const noYield = calculateIHShear(missingStiffenerYield, null, factorLib);
  assert.equal(noYield.limit_states.tension_field_action.status, 'REVIEW_REQUIRED');
  near(noYield.limit_states.shear_web.nominal_kN, 1076.014814814815);

  const tooMuch = baseInput();
  tooMuch.stiffeners = { spacing_mm: 900, ...plateStiffener() };
  tooMuch.forces.shear_y_kN = 1400;
  tooMuch.tension_field_action = structuredClone(base.tension_field_action);
  tooMuch.tension_field_action.bounding_stiffeners = [plateStiffener(), plateStiffener()];
  assert.equal(calculateIHShear(tooMuch, null, factorLib).limit_states.tension_field_action.status, 'REVIEW_REQUIRED');
  near(calculateIHShear(tooMuch, null, factorLib).limit_states.shear_web.nominal_kN, 1076.014814814815);
});

test('missing forces remain INPUT_REQUIRED, signed forces use magnitudes, and invalid geometry fails closed', () => {
  const input = baseInput();
  delete input.forces.shear_y_kN;
  delete input.forces.shear_x_kN;
  const missing = calculateIHShear(input, null, factorLib);
  assert.equal(missing.limit_states.shear_web.status, 'INPUT_REQUIRED');
  assert.equal(missing.limit_states.shear_flange.status, 'INPUT_REQUIRED');

  const negative = baseInput();
  negative.forces.shear_y_kN = -100;
  const result = calculateIHShear(negative, null, factorLib);
  assert.equal(result.limit_states.shear_web.signed_demand_kN, -100);
  assert.equal(result.limit_states.shear_web.demand_kN, 100);
  assert.throws(() => calculateIHShear({ ...negative, section: { ...negative.section, tw_mm: -8 } }, null, factorLib), /positive and finite/);
  assert.throws(() => calculateIHShear({ ...negative, method: 'BOTH' }, null, factorLib), /Only ASD or LRFD/);
});

