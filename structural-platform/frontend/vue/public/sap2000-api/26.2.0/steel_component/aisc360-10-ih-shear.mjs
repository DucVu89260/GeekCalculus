/**
 * ANSI/AISC 360-10 Chapter G shear checks for doubly symmetric I/H sections.
 *
 * Source: supplied ANSI/AISC 360-10 PDF, SHA-256
 * f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99.
 * Physical pages 123–128 (printed 16.1-67 through 16.1-72).
 * Inputs use mm, MPa, and kN. Nominal and available strengths are returned in kN.
 * Forces are used as supplied; this module does not build or convert load combinations.
 * It evaluates shear/stiffeners only and never marks a whole member as passing.
 */

export const SOURCE = Object.freeze({
  reference: 'ANSI/AISC 360-10, June 22, 2010',
  artifact_sha256: 'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99',
  physical_pages: '123-128',
  printed_pages: '16.1-67–72',
});

export const FORMULAS = Object.freeze({
  'G1': { clause: 'G1', expression: 'φv=0.90 (LRFD), Ωv=1.67 (ASD), except G2.1(a)', applies: 'Use for 2010 AISC shear resistance calculations by design method; G2.1(a) rolled-I webs have their own factors.', source: 'physical 123 / printed 16.1-67' },
  'G2-1': { clause: 'G2.1', expression: 'Vn=0.6 Fy Aw Cv; Aw=d tw', applies: 'Web shear in covered I/H sections evaluated by §G2.1; nominal strength before LRFD/ASD factors.', source: 'physical 123 / printed 16.1-67' },
  'G2-2': { clause: 'G2.1(a)', expression: 'rolled I: h/tw≤2.24√(E/Fy), Cv=1; φv=1.00, Ωv=1.50', applies: 'Only rolled I-shaped members satisfying the stated clear-web slenderness limit.', source: 'physical 124 / printed 16.1-68' },
  'G2-3': { clause: 'G2.1(b)(i)', expression: 'Cv=1 when h/tw≤1.10√(kv E/Fy)', applies: 'General §G2.1(b) web-shear branch at or below the lower slenderness boundary.', source: 'physical 124 / printed 16.1-68' },
  'G2-4': { clause: 'G2.1(b)(ii)', expression: 'Cv=1.10√(kv E/Fy)/(h/tw)', applies: 'General §G2.1(b) web-shear branch above 1.10√(kvE/Fy) and at or below 1.37√(kvE/Fy).', source: 'physical 124 / printed 16.1-68' },
  'G2-5': { clause: 'G2.1(b)(iii)', expression: 'Cv=1.51 kv E/[Fy(h/tw)²]', applies: 'General §G2.1(b) web-shear branch above 1.37√(kvE/Fy).', source: 'physical 124 / printed 16.1-68' },
  'G2-KV-UNSTIFFENED': { clause: 'G2.1(b)(i)', expression: 'kv=5 for webs without transverse stiffeners where h/tw<260', applies: 'Unstiffened web only, strictly below h/tw=260; at or above 260 this module blocks without verified stiffeners.', source: 'physical 124 / printed 16.1-68' },
  'G2-6': { clause: 'G2.1(b)(ii)', expression: 'kv=5+5/(a/h)²; kv=5 when a/h>3 or a/h>[260/(h/tw)]²', applies: 'General web with verified intermediate transverse stiffeners and clear panel spacing a.', source: 'physical 125 / printed 16.1-69' },
  'G2-7': { clause: 'G2.2', expression: 'Ist≥b tw³ j', applies: 'Intermediate transverse stiffener rigidity check for §G2.2; does not cover bearing/end stiffeners or Chapter J.', source: 'physical 125 / printed 16.1-69' },
  'G2-8': { clause: 'G2.2', expression: 'j=2.5/(a/h)²−2≥0.5; b=min(a,h)', applies: 'Companion geometry factor for the §G2.2 intermediate stiffener rigidity requirement.', source: 'physical 125 / printed 16.1-69' },
  'G3-1': { clause: 'G3.1', expression: 'TFA eligibility: interior panel; a/h≤3 and a/h≤[260/(h/tw)]²; 2Aw/(Afc+Aft)≤2.5; h/bfc,h/bft≤6', applies: 'Only when tension-field action is explicitly requested; requires a non-end panel supported on all four sides and every listed geometry limit to pass.', source: 'physical 126 / printed 16.1-70' },
  'G3-2': { clause: 'G3.2', expression: 'Vn=0.6FyAw when h/tw≤1.10√(kvE/Fy); otherwise 0.6FyAw[Cv+(1−Cv)/(1.15√(1+(a/h)²))]', applies: 'Nominal panel shear strength after every §G3 eligibility and stiffener requirement is verified.', source: 'physical 126 / printed 16.1-70' },
  'G3-3': { clause: 'G3.3', expression: '(b/t)st≤0.56√(E/Fyst)', applies: 'Stiffener slenderness requirement for §G3 tension-field action.', source: 'physical 126 / printed 16.1-70' },
  'G3-4': { clause: 'G3.3', expression: 'Ist≥Ist1+(Ist2−Ist1)[(Vr−Vc1)/(Vc2−Vc1)]', applies: 'Boundary-stiffener rigidity interpolation for the adjacent panels bounding a tension-field panel; requires valid Vc1, Vc2, Vr and positive interpolation range.', source: 'physical 126 / printed 16.1-70' },
  'G3-5': { clause: 'G3.3', expression: 'Ist2=h⁴ρst^1.3/40·(Fyw/E)^1.5; ρst=max(Fyw/Fyst,1)', applies: 'Upper stiffener rigidity value used by the §G3.4 interpolation.', source: 'physical 127 / printed 16.1-71' },
  'G7': { clause: 'G7', expression: 'weak-axis shear without torsion; for each flange Vn=0.6FyAwCv, Aw=bf tf, h/tw=(bf/2)/tf, kv=1.2', applies: 'Weak-axis shear in doubly symmetric I/H sections only when torsion is explicitly zero; torsion and other section types are outside this branch.', source: 'physical 128 / printed 16.1-72' },
});

const status = (id, code, reason, extra = {}) => ({ id, status: code, reason, ...extra });
const hasNumber = value => typeof value === 'number' && Number.isFinite(value);
const positive = (value, name) => {
  if (!hasNumber(value) || value <= 0) throw new RangeError(name + ' must be positive and finite.');
  return value;
};
const finite = (value, name) => {
  if (!hasNumber(value)) throw new RangeError(name + ' must be finite.');
  return value;
};
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function sourceFor(...ids) {
  return ids.map(id => ({
    id,
    reference: SOURCE.reference,
    artifact_sha256: SOURCE.artifact_sha256,
    ...FORMULAS[id],
  }));
}

function factored(nominal, method, key, factorLib) {
  if (!factorLib || typeof factorLib.availableStrength !== 'function') {
    throw new TypeError('AISC360-10 resistance library is required.');
  }
  const available = factorLib.availableStrength(nominal, method, key);
  if (!hasNumber(available) || available < 0) throw new Error('AISC shear factor library returned an invalid strength.');
  const factor = typeof factorLib.getFactor === 'function' ? factorLib.getFactor(key) : { key };
  return { available, factor: { ...factor, key, method } };
}

function designMethod(input) {
  if (input?.method === 'ASD' || input?.method === 'LRFD') return input.method;
  throw new RangeError('Only ASD or LRFD is supported.');
}

function webHeight(section, depth, flangeThickness) {
  const fabrication = section.fabrication;
  const attachment = section.web_attachment ?? section.web_connection;
  if (fabrication === 'ROLLED') {
    if (!hasNumber(section.web_clear_height_mm) || section.web_clear_height_mm <= 0 ||
        section.web_clear_height_verified !== true) {
      return { ok: false, status: 'INPUT_REQUIRED', reason: 'Rolled shapes require verified clear web height h between flange fillets/corners for G2.' };
    }
    const h = positive(section.web_clear_height_mm, 'section.web_clear_height_mm');
    if (h > depth - 2 * flangeThickness) throw new RangeError('Rolled clear web height cannot exceed d−2tf.');
    return { ok: true, h, source: 'VERIFIED_ROLLED_CLEAR_HEIGHT_EXCLUDING_FILLET' };
  }
  if (fabrication !== 'BUILT_UP') {
    return { ok: false, status: 'REVIEW_REQUIRED', reason: 'Chapter G I/H shear implementation supports only ROLLED and BUILT_UP sections.' };
  }
  if (hasNumber(section.web_clear_height_mm) && section.web_clear_height_mm > 0 &&
      section.web_clear_height_verified === true) {
    const h = positive(section.web_clear_height_mm, 'section.web_clear_height_mm');
    if (h > depth - 2 * flangeThickness) throw new RangeError('Built-up clear web height cannot exceed d−2tf.');
    return { ok: true, h, source: 'VERIFIED_BUILT_UP_CLEAR_HEIGHT' };
  }
  if (attachment === 'WELDED' || attachment === 'CONTINUOUS_WELDED_PLATES') {
    const h = depth - 2 * flangeThickness;
    if (h <= 0) throw new RangeError('Built-up welded web clear height d−2tf must be positive.');
    if (hasNumber(section.web_clear_height_mm) && !near(section.web_clear_height_mm, h)) {
      return { ok: false, status: 'REVIEW_REQUIRED', reason: 'Supplied built-up welded web height does not equal d−2tf.' };
    }
    return { ok: true, h, source: 'BUILT_UP_WELDED_D_MINUS_2TF' };
  }
  return { ok: false, status: 'INPUT_REQUIRED', reason: 'Built-up bolted sections require verified h measured between fastener lines; built-up welded sections require explicit WELDED attachment geometry.' };
}

function webCv({ fabrication, h, tw, e, fy, kv }) {
  const ratio = h / tw;
  if (fabrication === 'ROLLED' && ratio <= 2.24 * Math.sqrt(e / fy)) {
    return { cv: 1, branch: 'G2.1(a)', threshold: 2.24 * Math.sqrt(e / fy), lower_threshold: null, upper_threshold: null, ratio };
  }
  const root = Math.sqrt(kv * e / fy);
  const lower = 1.10 * root;
  const upper = 1.37 * root;
  if (ratio <= lower) return { cv: 1, branch: 'G2-3', threshold: lower, lower_threshold: lower, upper_threshold: upper, ratio };
  if (ratio <= upper) {
    return { cv: lower / ratio, branch: 'G2-4', threshold: upper, lower_threshold: lower, upper_threshold: upper, ratio };
  }
  return { cv: 1.51 * kv * e / (fy * ratio ** 2), branch: 'G2-5', threshold: upper, lower_threshold: lower, upper_threshold: upper, ratio };
}

function webKv(h, tw, a, stiffened) {
  const slenderness = h / tw;
  if (!stiffened) {
    if (slenderness >= 260) {
      return { ok: false, reason: 'G2.1 gives kv=5 without transverse stiffeners only for h/tw<260.' };
    }
    return { ok: true, kv: 5, branch: 'UNSTIFFENED_KV_5', aOverH: null };
  }
  const clearSpacing = positive(a, 'stiffeners.spacing_mm');
  const ratio = clearSpacing / h;
  let kv = 5 + 5 / ratio ** 2;
  const upperAspect = (260 / slenderness) ** 2;
  if (ratio > 3 || ratio > upperAspect) kv = 5;
  return { ok: true, kv, branch: 'G2-6', aOverH: ratio, kv5_condition_aspect: upperAspect };
}

function requiredStiffenerInertia(a, h, tw) {
  const ratio = positive(a, 'panel clear spacing a') / positive(h, 'web clear height h');
  const j = Math.max(0.5, 2.5 / ratio ** 2 - 2);
  const b = Math.min(a, h);
  return { required_mm4: b * tw ** 3 * j, b_mm: b, j, aOverH: ratio };
}

function stiffenerInertia(raw, webThickness) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Stiffener geometry is missing.' };
  const layout = raw.layout;
  const orientation = raw.orientation;
  if ((layout === 'PAIRED' || layout === 'SINGLE_PLATE') &&
      orientation === 'PERPENDICULAR_RECTANGULAR_PLATE') {
    const bs = positive(raw.width_mm, 'stiffener.width_mm');
    const ts = positive(raw.thickness_mm, 'stiffener.thickness_mm');
    const inertia = layout === 'PAIRED'
      ? 2 * ts * ((bs + webThickness / 2) ** 3 - (webThickness / 2) ** 3) / 3
      : ts * bs ** 3 / 3;
    return {
      ok: true,
      inertia_mm4: inertia,
      inertia_source: layout === 'PAIRED' ? 'RECTANGLE_INTEGRATION_ABOUT_WEB_CENTER' : 'RECTANGLE_INTEGRATION_ABOUT_WEB_CONTACT_FACE',
      width_mm: bs,
      thickness_mm: ts,
      width_thickness_ratio: bs / ts,
      layout,
      orientation,
    };
  }
  if (hasNumber(raw.inertia_mm4) && raw.inertia_mm4 > 0 && raw.inertia_axis_verified === true) {
    return {
      ok: true,
      inertia_mm4: raw.inertia_mm4,
      inertia_source: 'USER_SUPPLIED_G2_2_AXIS_VERIFIED',
      width_mm: hasNumber(raw.width_mm) ? raw.width_mm : null,
      thickness_mm: hasNumber(raw.thickness_mm) ? raw.thickness_mm : null,
      width_thickness_ratio: hasNumber(raw.width_thickness_ratio)
        ? raw.width_thickness_ratio
        : hasNumber(raw.width_mm) && hasNumber(raw.thickness_mm) && raw.width_mm > 0 && raw.thickness_mm > 0
          ? raw.width_mm / raw.thickness_mm : null,
      layout,
      orientation: orientation ?? null,
    };
  }
  return { ok: false, reason: 'Use a supported perpendicular rectangular plate or supply positive inertia_mm4 with inertia_axis_verified=true for the §G2.2 axis.' };
}

function evaluateStiffener(raw, a, h, tw, e, fy, requireG3 = false) {
  let inertia;
  try {
    inertia = stiffenerInertia(raw, tw);
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, reason: error.message };
    throw error;
  }
  if (!inertia.ok) return { ok: false, reason: inertia.reason };
  const min = requiredStiffenerInertia(a, h, tw);
  const attachmentVerified = raw.attachment_details_verified === true;
  const inertiaPass = inertia.inertia_mm4 + 1e-9 >= min.required_mm4;
  let g3 = null;
  if (requireG3) {
    let fyst;
    try {
      fyst = positive(raw.fy_mpa, 'stiffener.fy_mpa');
    } catch (error) {
      if (error instanceof RangeError) return { ok: false, reason: error.message };
      throw error;
    }
    const ratio = inertia.width_thickness_ratio;
    if (!hasNumber(ratio) || ratio <= 0) return { ok: false, reason: 'G3.3 needs a positive stiffener width-to-thickness ratio.' };
    const limit = 0.56 * Math.sqrt(e / fyst);
    g3 = { ratio, limit, passes: ratio <= limit, fyst_mpa: fyst };
  }
  const g2Pass = attachmentVerified && inertiaPass;
  return {
    ok: g2Pass && (!requireG3 || g3.passes),
    inertia_mm4: inertia.inertia_mm4,
    inertia_source: inertia.inertia_source,
    width_mm: inertia.width_mm,
    thickness_mm: inertia.thickness_mm,
    width_thickness_ratio: inertia.width_thickness_ratio,
    layout: inertia.layout,
    orientation: inertia.orientation,
    attachment_details_verified: attachmentVerified,
    required_inertia_mm4: min.required_mm4,
    required_inertia_trace: min,
    inertia_passes_g2_2: inertiaPass,
    g2_2_passes: g2Pass,
    g3_3: g3,
    reason: !attachmentVerified ? 'Verify all applicable §G2.2 stiffener attachment and connection-spacing details.'
      : !inertiaPass ? 'Actual stiffener inertia is below the §G2.2 minimum.'
        : requireG3 && !g3.passes ? 'Stiffener width-to-thickness ratio exceeds §G3.3.' : null,
  };
}

function panelStrength({ a, web, section, material, method, stiffenerIsValid, factorLib }) {
  const { h, tw, d } = web;
  const { e_mpa: e, fy_mpa: fy } = material;
  const slenderness = h / tw;
  const kvResult = webKv(h, tw, a, stiffenerIsValid);
  if (!kvResult.ok) return { ok: false, reason: kvResult.reason };
  const cvResult = webCv({ fabrication: section.fabrication, h, tw, e, fy, kv: kvResult.kv });
  const aw = d * tw;
  const nominalG2 = 0.6 * fy * aw * cvResult.cv / 1000;
  const rolledException = cvResult.branch === 'G2.1(a)';
  const g2Key = rolledException ? 'SHEAR_ROLLED_G21A' : 'SHEAR_GENERAL';
  const g2Factor = factored(nominalG2, method, g2Key, factorLib);
  const g3Threshold = 1.10 * Math.sqrt(kvResult.kv * e / fy);
  const nominalG3 = slenderness <= g3Threshold
    ? 0.6 * fy * aw / 1000
    : 0.6 * fy * aw * (cvResult.cv + (1 - cvResult.cv) /
        (1.15 * Math.sqrt(1 + (a / h) ** 2))) / 1000;
  const g3Factor = factored(nominalG3, method, 'SHEAR_GENERAL', factorLib);
  return {
    ok: true,
    hOverTw: slenderness,
    aw_mm2: aw,
    a_mm: a,
    aOverH: a / h,
    kv: kvResult.kv,
    kv_branch: kvResult.branch,
    kv5_condition_aspect: kvResult.kv5_condition_aspect ?? null,
    cv: cvResult.cv,
    cv_branch: cvResult.branch,
    cv_threshold: cvResult.threshold,
    nominal_g2_kN: nominalG2,
    available_g2_kN: g2Factor.available,
    g2_factor: g2Factor.factor,
    g2_factor_key: g2Key,
    nominal_g3_kN: nominalG3,
    available_g3_kN: g3Factor.available,
    g3_factor: g3Factor.factor,
    g3_threshold: g3Threshold,
    clauses: ['G2-1', cvResult.branch === 'G2.1(a)' ? 'G2-2' : cvResult.branch, kvResult.branch],
  };
}

function tfaEligibility({ a, h, tw, d, bf, tf, aw, tfaPanel }) {
  if (tfaPanel?.is_end_panel !== false) {
    return { ok: false, status: tfaPanel?.is_end_panel === true ? 'NOT_APPLICABLE' : 'INPUT_REQUIRED', reason: '§G3.1 prohibits tension field action in end panels; identify an interior panel.' };
  }
  if (tfaPanel?.four_sides_supported !== true) {
    return { ok: false, status: tfaPanel?.four_sides_supported === false ? 'NOT_APPLICABLE' : 'INPUT_REQUIRED', reason: 'Confirm the web panel is supported on all four sides by flanges or stiffeners.' };
  }
  const aspect = a / h;
  const hOverTw = h / tw;
  const aspectLimit = (260 / hOverTw) ** 2;
  const flangeAreaRatio = 2 * aw / (2 * bf * tf);
  const hOverBf = h / bf;
  const checks = {
    is_interior_panel: true,
    four_sides_supported: true,
    a_over_h: aspect,
    a_over_h_limit: 3,
    a_over_h_slender_web_limit: aspectLimit,
    a_over_h_passes: aspect <= 3 && aspect <= aspectLimit,
    two_aw_over_flange_areas: flangeAreaRatio,
    flange_area_ratio_limit: 2.5,
    flange_area_ratio_passes: flangeAreaRatio <= 2.5,
    h_over_bf: hOverBf,
    h_over_bf_limit: 6,
    h_over_bf_passes: hOverBf <= 6,
  };
  const failed = [];
  if (!checks.a_over_h_passes) failed.push('panel aspect ratio exceeds §G3.1(b)');
  if (!checks.flange_area_ratio_passes) failed.push('web-to-flange area ratio exceeds §G3.1(c)');
  if (!checks.h_over_bf_passes) failed.push('h/bf exceeds §G3.1(d)');
  return failed.length
    ? { ok: false, status: 'NOT_APPLICABLE', reason: failed.join('; ') + '.', trace: checks }
    : { ok: true, trace: checks };
}

function makeUnavailable(id, code, reason, clause, demand) {
  return status(id, code, reason, { clause, ...(demand !== undefined ? { demand, demand_kN: demand } : {}), source: sourceFor(clause === 'G7' ? 'G7' : 'G2-1') });
}

function evaluateTensionField({ input, section, material, web, webResult, method, factorLib, demand }) {
  const tfa = input.tension_field_action;
  if (!tfa || tfa.enabled !== true) {
    return {
      state: status('TENSION_FIELD_ACTION', 'NOT_APPLICABLE', 'Tension field action was not requested; only §G2 capacity is credited.', {
        clause: 'G3', source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      }),
      webResult,
      stiffeners: null,
    };
  }
  if (!web?.ok) {
    return {
      state: status('TENSION_FIELD_ACTION', 'INPUT_REQUIRED', web?.reason ?? 'Verified clear web height is required for §G3.', {
        clause: 'G3', source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      }), webResult, stiffeners: null,
    };
  }

  const a = input.stiffeners?.spacing_mm;
  if (!hasNumber(a) || a <= 0) {
    return {
      state: status('TENSION_FIELD_ACTION', 'INPUT_REQUIRED', 'TFA requires positive clear panel spacing a in stiffeners.spacing_mm.', {
        clause: 'G3', source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      }), webResult, stiffeners: null,
    };
  }
  if (!hasNumber(demand)) {
    return {
      state: status('TENSION_FIELD_ACTION', 'INPUT_REQUIRED', 'TFA requires the current panel shear demand.', {
        clause: 'G3', source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      }), webResult, stiffeners: null,
    };
  }
  if (!Array.isArray(tfa.adjacent_panels) || tfa.adjacent_panels.length !== 2 ||
      !Array.isArray(tfa.bounding_stiffeners) || tfa.bounding_stiffeners.length !== 2) {
    return {
      state: status('TENSION_FIELD_ACTION', 'INPUT_REQUIRED', 'Supply the left and right adjacent panels and both bounding stiffeners for the G3.4 interpolation.', {
        clause: 'G3-4', source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      }), webResult, stiffeners: null,
    };
  }
  if (tfa.adjacent_panels.some(panel => !panel || !hasNumber(panel.spacing_mm) || !hasNumber(panel.shear_kN))) {
    return {
      state: status('TENSION_FIELD_ACTION', 'INPUT_REQUIRED', 'Both adjacent panels need finite clear spacing and signed shear demand.', {
        clause: 'G3-4', source: sourceFor('G3-4'),
      }), webResult, stiffeners: null,
    };
  }

  const { h } = web;
  const { h_mm: d, tw_mm: tw, bf_mm: bf, tf_mm: tf } = section;
  const panelWeb = { ...web, d, tw };
  const { e_mpa: e, fy_mpa: fy } = material;
  const panels = [
    {
      id: 'left', a: positive(tfa.adjacent_panels[0]?.spacing_mm, 'tension_field_action.adjacent_panels[0].spacing_mm'),
      demand: Math.abs(finite(tfa.adjacent_panels[0]?.shear_kN, 'left adjacent panel shear_kN')),
      panel: tfa.adjacent_panels[0],
    },
    {
      id: 'current', a: positive(a, 'stiffeners.spacing_mm'), demand: Math.abs(demand),
      panel: tfa,
    },
    {
      id: 'right', a: positive(tfa.adjacent_panels[1]?.spacing_mm, 'tension_field_action.adjacent_panels[1].spacing_mm'),
      demand: Math.abs(finite(tfa.adjacent_panels[1]?.shear_kN, 'right adjacent panel shear_kN')),
      panel: tfa.adjacent_panels[1],
    },
  ];
  const adjacentGates = [
    tfa.adjacent_panels[0]?.other_boundary_stiffeners_verified === true,
    tfa.adjacent_panels[1]?.other_boundary_stiffeners_verified === true,
  ];
  if (!adjacentGates.every(Boolean)) {
    return {
      state: status('TENSION_FIELD_ACTION', 'INPUT_REQUIRED', 'Verify the non-shared boundaries of both adjacent panels against §G2.2, §G3.3 and §G3.4.', {
        clause: 'G3-4', source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      }), webResult, stiffeners: null,
    };
  }

  const gates = panels.map(p => ({
    id: p.id,
    ...tfaEligibility({ a: p.a, h, tw, d, bf, tf, aw: d * tw, tfaPanel: p.panel }),
  }));
  const gateFailure = gates.find(x => !x.ok);
  if (gateFailure) {
    return {
      state: status('TENSION_FIELD_ACTION', gateFailure.status, gateFailure.reason, {
        clause: 'G3-1', trace: { panels: gates }, source: sourceFor('G3-1'),
      }), webResult, stiffeners: null,
    };
  }

  const boundaryInfo = tfa.bounding_stiffeners.map((raw, index) => {
    const adjacentPanel = index === 0 ? panels[0] : panels[2];
    const currentPanel = panels[1];
    const adjacentRequired = requiredStiffenerInertia(adjacentPanel.a, h, tw).required_mm4;
    const currentRequired = requiredStiffenerInertia(currentPanel.a, h, tw).required_mm4;
    const requiredA = Math.max(
      adjacentRequired,
      currentRequired,
    );
    const actual = evaluateStiffener(raw, currentPanel.a, h, tw, e, fy, true);
    if (!actual.inertia_mm4) return { ok: false, reason: actual.reason ?? 'Bounding stiffener inertia is unavailable.' };
    const actualI = actual.inertia_mm4;
    const geometryOk = raw.attachment_details_verified === true && actualI >= requiredA && actual.g3_3?.passes === true;
    return {
      ...actual,
      ok: geometryOk,
      g2_2_requirements_mm4: { adjacent_panel: adjacentRequired, current_panel: currentRequired, maximum: requiredA },
      failed_reason: !raw.attachment_details_verified ? 'Verify §G2.2 attachment details.'
        : actualI < requiredA ? 'Bounding stiffener does not meet §G2.2 for both panels.'
          : actual.g3_3?.passes !== true ? 'Bounding stiffener does not meet §G3.3 width-to-thickness limit.' : null,
    };
  });
  const badBoundary = boundaryInfo.find(x => !x.ok);
  if (badBoundary) {
    return {
      state: status('TENSION_FIELD_ACTION', 'REVIEW_REQUIRED', badBoundary.failed_reason ?? badBoundary.reason ?? 'Bounding stiffener fails §G2.2 or §G3.3.', {
        clause: 'G3-3/G3-4', trace: { panels: gates, bounding_stiffeners: boundaryInfo }, source: sourceFor('G2-7', 'G2-8', 'G3-3', 'G3-4'),
      }), webResult, stiffeners: null,
    };
  }

  const panelResults = panels.map((panel, index) => {
    const isCurrent = index === 1;
    const sharedStiffenersValid = isCurrent
      ? boundaryInfo[0].ok && boundaryInfo[1].ok
      : boundaryInfo[index === 0 ? 0 : 1].ok && adjacentGates[index === 0 ? 0 : 1];
    return panelStrength({
      a: panel.a, web: panelWeb, section, material, method,
      stiffenerIsValid: sharedStiffenersValid,
      factorLib,
    });
  });
  if (panelResults.some(x => !x.ok)) {
    const unavailable = panelResults.find(x => !x.ok);
    return {
      state: status('TENSION_FIELD_ACTION', 'INPUT_REQUIRED', unavailable.reason, {
        clause: 'G2-1/G3-2', trace: { panels: gates }, source: sourceFor('G2-1', 'G3-2'),
      }), webResult, stiffeners: null,
    };
  }

  const rhoAndIst2 = boundaryInfo.map((stiffener, i) => {
    const fyst = positive(tfa.bounding_stiffeners[i].fy_mpa, `bounding_stiffeners[${i}].fy_mpa`);
    const rho = Math.max(fy / fyst, 1);
    return {
      rho_st: rho,
      ist2_mm4: h ** 4 * rho ** 1.3 / 40 * (fy / e) ** 1.5,
      fyst_mpa: fyst,
    };
  });
  const boundaryChecks = [0, 1].map(index => {
    const p1 = panelResults[index];
    const p2 = panelResults[index + 1];
    const vc1 = Math.min(p1.available_g2_kN, p2.available_g2_kN);
    const vc2 = Math.min(p1.available_g3_kN, p2.available_g3_kN);
    const vr = Math.max(panels[index].demand, panels[index + 1].demand);
    const ist1 = boundaryInfo[index].g2_2_requirements_mm4.maximum;
    const ist2 = rhoAndIst2[index].ist2_mm4;
    const denominator = vc2 - vc1;
    if (denominator <= 1e-9) {
      return {
        ok: false, reason: '§G3.4 has no positive Vc2−Vc1 interpolation interval; no TFA increase is credited.',
        vr_kN: vr, vc1_kN: vc1, vc2_kN: vc2, ist1_mm4: ist1, ist2_mm4: ist2,
      };
    }
    const ratio = (vr - vc1) / denominator;
    if (ratio > 1 + 1e-9) {
      return {
        ok: false, reason: 'Adjacent-panel required shear exceeds Vc2; §G3.4 stiffness interpolation cannot support it.',
        vr_kN: vr, vc1_kN: vc1, vc2_kN: vc2, ratio, ist1_mm4: ist1, ist2_mm4: ist2,
      };
    }
    const interpolation = Math.max(0, ratio);
    const interpolated = ist1 + (ist2 - ist1) * interpolation;
    const required = Math.max(ist1, interpolated);
    const actual = boundaryInfo[index].inertia_mm4;
    const ok = actual + 1e-9 >= required;
    return {
      ok,
      ...(ok ? {} : { reason: 'Actual Ist is below the greater of the §G2.2 minimum and the §G3.4 interpolation.' }),
      vr_kN: vr,
      vc1_kN: vc1,
      vc2_kN: vc2,
      interpolation_ratio: interpolation,
      ist1_mm4: ist1,
      ist2_mm4: ist2,
      interpolated_inertia_mm4: interpolated,
      required_inertia_mm4: required,
      actual_inertia_mm4: actual,
    };
  });
  const badG34 = boundaryChecks.find(x => !x.ok);
  if (badG34) {
    return {
      state: status('TENSION_FIELD_ACTION', 'REVIEW_REQUIRED', badG34.reason, {
        clause: 'G3-4/G3-5', trace: { panels: gates, bounding_stiffeners: boundaryInfo, g3_4: boundaryChecks }, source: sourceFor('G3-4', 'G3-5'),
      }), webResult, stiffeners: null,
    };
  }

  const current = panelResults[1];
  if (current.nominal_g3_kN <= current.nominal_g2_kN + 1e-9) {
    return {
      state: status('TENSION_FIELD_ACTION', 'NOT_APPLICABLE', '§G3.2 gives no strength increase over §G2 for this panel; §G2 capacity remains selected.', {
        clause: 'G3-2', trace: { panels: gates, bounding_stiffeners: boundaryInfo, g3_4: boundaryChecks, panel_strengths: panelResults },
        source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      }), webResult, stiffeners: null,
    };
  }

  const g3Factor = factored(current.nominal_g3_kN, method, 'SHEAR_GENERAL', factorLib);
  const updatedWeb = {
    ...webResult,
    status: hasNumber(demand) ? (Math.abs(demand) === 0 ? 'NOT_APPLICABLE' : 'CALCULATED') : 'INPUT_REQUIRED',
    clause: 'G3-2',
    nominal_g2_kN: current.nominal_g2_kN,
    available_g2_kN: current.available_g2_kN,
    nominal: current.nominal_g3_kN,
    nominal_kN: current.nominal_g3_kN,
    available: g3Factor.available,
    available_kN: g3Factor.available,
    factor: g3Factor.factor,
    demand: hasNumber(demand) ? Math.abs(demand) : null,
    demand_kN: hasNumber(demand) ? Math.abs(demand) : null,
    passes: hasNumber(demand) ? Math.abs(demand) <= g3Factor.available : null,
    trace: {
      ...webResult.trace,
      selected_capacity: 'TENSION_FIELD_ACTION',
      nominal_g3_kN: current.nominal_g3_kN,
      available_g3_kN: g3Factor.available,
      g3_factor: g3Factor.factor,
      adjacent_panels: panels,
      adjacent_panel_strengths: panelResults,
      tfa_eligibility: gates,
      bounding_stiffeners: boundaryInfo,
      g3_4: boundaryChecks,
    },
    source: sourceFor('G2-1', 'G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
  };
  return {
    state: status('TENSION_FIELD_ACTION', 'CALCULATED', 'All §G3.1, §G2.2, §G3.3 and §G3.4 checks passed for this interior panel.', {
      clause: 'G3-1/G3-2/G3-3/G3-4',
      nominal_kN: current.nominal_g3_kN,
      available_kN: g3Factor.available,
      source: sourceFor('G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5'),
      trace: {
        panels: gates,
        panel_strengths: panelResults,
        bounding_stiffeners: boundaryInfo,
        g3_4: boundaryChecks,
      },
    }),
    webResult: updatedWeb,
    stiffeners: status('STIFFENERS', 'CALCULATED', 'Both bounding stiffeners meet §G2.2 and §G3.3/G3.4 for the checked panel.', {
      clause: 'G2-7/G2-8/G3-3/G3-4', trace: { bounding_stiffeners: boundaryInfo, g3_4: boundaryChecks },
      source: sourceFor('G2-7', 'G2-8', 'G3-3', 'G3-4', 'G3-5'),
    }),
  };
}

function shearEntry({ id, demand, nominal, factor, clause, trace, source }) {
  const code = demand === null ? 'INPUT_REQUIRED' : demand === 0 ? 'NOT_APPLICABLE' : 'CALCULATED';
  const reason = demand === null ? 'Supply the signed shear force in kN; omitted shear is not assumed to be zero.'
    : demand === 0 ? 'No shear demand in this direction.' : null;
  return {
    id,
    status: code,
    ...(reason ? { reason } : {}),
    clause,
    nominal,
    nominal_kN: nominal,
    available: factor.available,
    available_kN: factor.available,
    demand: demand === null ? null : Math.abs(demand),
    demand_kN: demand === null ? null : Math.abs(demand),
    signed_demand_kN: demand,
    passes: demand === null ? null : Math.abs(demand) <= factor.available,
    factor: factor.factor,
    trace,
    source,
  };
}

function evaluateG2({ input, section, material, web, method, factorLib, demand }) {
  if (!web.ok) {
    return {
      shear: makeUnavailable('SHEAR_WEB', web.status, web.reason, 'G2-1', demand === null ? undefined : Math.abs(demand)),
      stiffeners: status('STIFFENERS', web.status, web.reason, { clause: 'G2.2', source: sourceFor('G2-7', 'G2-8') }),
    };
  }
  const { h } = web;
  const { h_mm: d, tw_mm: tw } = section;
  const { fy_mpa: fy, e_mpa: e } = material;
  const hOverTw = h / tw;
  const a = input.stiffeners?.spacing_mm;
  const stiffenerInput = input.stiffeners;
  const special = section.fabrication === 'ROLLED' && hOverTw <= 2.24 * Math.sqrt(e / fy);
  let stiffenerCheck = null;
  let canUseStiffeners = false;
  if (!special && hasNumber(a) && a > 0 && stiffenerInput) {
    stiffenerCheck = evaluateStiffener(stiffenerInput, a, h, tw, e, fy, false);
    canUseStiffeners = stiffenerCheck.g2_2_passes === true;
  }
  const kvResult = special ? { ok: true, kv: null, branch: 'NOT_USED_G2_1A' }
    : webKv(h, tw, a, canUseStiffeners);
  if (!kvResult.ok) {
    return {
      shear: makeUnavailable('SHEAR_WEB', 'INPUT_REQUIRED', kvResult.reason, 'G2-1', demand === null ? undefined : Math.abs(demand)),
      stiffeners: status('STIFFENERS', 'INPUT_REQUIRED', 'G2.1 needs verified transverse stiffeners when h/tw≥260.', { clause: 'G2.2', source: sourceFor('G2-7', 'G2-8') }),
    };
  }
  const cvResult = special ? { cv: 1, branch: 'G2.1(a)', threshold: 2.24 * Math.sqrt(e / fy), ratio: hOverTw }
    : webCv({ fabrication: section.fabrication, h, tw, e, fy, kv: kvResult.kv });
  const aw = d * tw;
  const nominal = 0.6 * fy * aw * cvResult.cv / 1000;
  const key = special ? 'SHEAR_ROLLED_G21A' : 'SHEAR_GENERAL';
  const factor = factored(nominal, method, key, factorLib);
  const shear = shearEntry({
    id: 'SHEAR_WEB', demand, nominal, factor,
    clause: special ? 'G2.1(a)' : 'G2.1',
    trace: {
      overall_depth_mm: d,
      clear_web_height_mm: h,
      clear_web_height_source: web.source,
      web_thickness_mm: tw,
      h_over_tw: hOverTw,
      aw_mm2: aw,
      kv: kvResult.kv,
      kv_branch: kvResult.branch,
      kv_trace: kvResult,
      cv: cvResult.cv,
      cv_branch: cvResult.branch,
      cv_threshold: cvResult.threshold,
      cv_lower_threshold: cvResult.lower_threshold ?? null,
      cv_upper_threshold: cvResult.upper_threshold ?? null,
      rolled_g2_1a: special,
      factor_key: key,
      stiffener_inertia_mm4: stiffenerCheck?.inertia_mm4 ?? null,
      stiffener_inertia_source: stiffenerCheck?.inertia_source ?? null,
      stiffener_required_inertia_mm4: stiffenerCheck?.required_inertia_mm4 ?? null,
      stiffeners_used_for_kv: canUseStiffeners,
    },
    source: sourceFor(
      'G1', 'G2-1', special ? 'G2-2' : cvResult.branch,
      ...(!special ? [kvResult.branch === 'G2-6' ? 'G2-6' : 'G2-KV-UNSTIFFENED'] : []),
      ...(canUseStiffeners ? ['G2-7', 'G2-8'] : []),
    ),
  });
  const unstiffenedAvailable = special ? null : (() => {
    if (hOverTw >= 260) return null;
    const unCv = webCv({ fabrication: 'BUILT_UP', h, tw, e, fy, kv: 5 });
    return factored(0.6 * fy * aw * unCv.cv / 1000, method, 'SHEAR_GENERAL', factorLib).available;
  })();
  let stiffenerState;
  if (special) {
    stiffenerState = status('STIFFENERS', 'NOT_REQUIRED', 'The qualified rolled I branch is within the §G2.2 slenderness exemption.', {
      clause: 'G2.2', source: sourceFor('G2-7', 'G2-8'), trace: { h_over_tw: hOverTw, exemption: 'ROLLED_G2_1A' },
    });
  } else if (stiffenerCheck?.g2_2_passes) {
    stiffenerState = status('STIFFENERS', 'CALCULATED', 'Verified intermediate stiffeners meet §G2.2 and are used in kv.', {
      clause: 'G2-7/G2-8', source: sourceFor('G2-7', 'G2-8'), trace: stiffenerCheck,
    });
  } else {
    const notRequiredByRatio = hOverTw <= 2.46 * Math.sqrt(e / fy);
    const notRequiredByStrength = demand !== null && unstiffenedAvailable !== null && unstiffenedAvailable > Math.abs(demand);
    if (notRequiredByRatio || notRequiredByStrength) {
      stiffenerState = status('STIFFENERS', 'NOT_REQUIRED', '§G2.2 permits omission by web slenderness or by the un-stiffened kv=5 available-strength comparison.', {
        clause: 'G2.2', source: sourceFor('G2-1', 'G2-7', 'G2-8'),
        trace: { h_over_tw: hOverTw, slenderness_limit: 2.46 * Math.sqrt(e / fy), unstiffened_available_kN: unstiffenedAvailable,
          demand_kN: demand === null ? null : Math.abs(demand), not_required_by_ratio: notRequiredByRatio, not_required_by_strength: notRequiredByStrength },
      });
    } else if (stiffenerInput) {
      stiffenerState = status('STIFFENERS', stiffenerCheck ? 'REVIEW_REQUIRED' : 'INPUT_REQUIRED',
        stiffenerCheck?.reason ?? 'Provide verified stiffener geometry and §G2.2 attachment details.', {
          clause: 'G2-7/G2-8', source: sourceFor('G2-7', 'G2-8'), trace: stiffenerCheck,
        });
    } else {
      stiffenerState = status('STIFFENERS', 'INPUT_REQUIRED', '§G2.2 does not exempt stiffeners for this h/tw and un-stiffened shear strength; provide intermediate stiffeners or revise the panel.', {
        clause: 'G2-7/G2-8', source: sourceFor('G2-1', 'G2-7', 'G2-8'),
        trace: { h_over_tw: hOverTw, slenderness_limit: 2.46 * Math.sqrt(e / fy), unstiffened_available_kN: unstiffenedAvailable,
          demand_kN: demand === null ? null : Math.abs(demand) },
      });
    }
  }
  return { shear, stiffeners: stiffenerState };
}

function evaluateWeakAxis({ section, material, method, factorLib, demand, torsion }) {
  if (torsion === null) {
    return makeUnavailable('SHEAR_WEAK_AXIS', 'INPUT_REQUIRED', '§G7 applies to weak-axis shear without torsion; supply explicit torsion_kNm=0 to establish applicability.', 'G7', demand === null ? undefined : Math.abs(demand));
  }
  if (torsion !== 0) {
    return makeUnavailable('SHEAR_WEAK_AXIS', 'REVIEW_REQUIRED', '§G7 is limited to weak-axis shear without torsion; nonzero torsion is outside this check.', 'G7', demand === null ? undefined : Math.abs(demand));
  }
  const { bf_mm: bf, tf_mm: tf } = section;
  const { fy_mpa: fy, e_mpa: e } = material;
  const b = bf / 2;
  const lambda = b / tf;
  const kv = 1.2;
  const cvResult = webCv({ fabrication: 'BUILT_UP', h: b, tw: tf, e, fy, kv });
  const awPerFlange = bf * tf;
  const nominalPerFlange = 0.6 * fy * awPerFlange * cvResult.cv / 1000;
  const nominal = 2 * nominalPerFlange;
  const factor = factored(nominal, method, 'SHEAR_GENERAL', factorLib);
  const result = shearEntry({
    id: 'SHEAR_WEAK_AXIS', demand, nominal, factor,
    clause: 'G7/G2.1(b)',
    trace: {
      bf_mm: bf,
      tf_mm: tf,
      b_mm: b,
      b_over_tf: lambda,
      kv,
      cv: cvResult.cv,
      cv_branch: cvResult.branch,
      cv_threshold: cvResult.threshold,
      aw_per_flange_mm2: awPerFlange,
      flange_resisting_element_count: 2,
      nominal_per_flange_kN: nominalPerFlange,
      demand_per_flange_kN: demand === null ? null : Math.abs(demand) / 2,
      torsion_kNm: torsion,
      factor_key: 'SHEAR_GENERAL',
    },
    source: sourceFor('G1', 'G2-1', cvResult.branch, 'G7'),
  });
  result.trace.available_per_flange_kN = factor.available / 2;
  return result;
}

/**
 * Calculate G2 web shear, G7 weak-axis shear, G2.2 stiffener rigidity and
 * an explicitly requested G3 TFA branch. `canonical` is accepted to match the
 * member-engine contract; Chapter G uses the section dimensions directly.
 */
export function calculateIHShear(input, canonical, factorLib) {
  void canonical;
  const method = designMethod(input);
  const section = input?.section;
  const material = input?.material;
  if (!section || !material) throw new TypeError('Section and material are required.');
  const d = positive(section.h_mm, 'section.h_mm');
  const bf = positive(section.bf_mm, 'section.bf_mm');
  const tf = positive(section.tf_mm, 'section.tf_mm');
  const tw = positive(section.tw_mm, 'section.tw_mm');
  const fy = positive(material.fy_mpa, 'material.fy_mpa');
  const e = positive(material.e_mpa, 'material.e_mpa');
  if (d <= 2 * tf || bf < tw) throw new RangeError('Invalid I/H section geometry.');
  if (!['ROLLED', 'BUILT_UP'].includes(section.fabrication)) throw new RangeError('Fabrication must be ROLLED or BUILT_UP.');

  const forces = input.forces ?? {};
  const shearY = forces.shear_y_kN === undefined ? null : finite(forces.shear_y_kN, 'forces.shear_y_kN');
  const shearX = forces.shear_x_kN === undefined ? null : finite(forces.shear_x_kN, 'forces.shear_x_kN');
  const torsion = forces.torsion_kNm === undefined ? null : finite(forces.torsion_kNm, 'forces.torsion_kNm');
  const resolvedWeb = webHeight(section, d, tf);
  const result = {
    edition: 'AISC360-10',
    method,
    source: SOURCE,
    overall_status: 'REVIEW_REQUIRED',
    limit_states: {},
    warnings: [
      { code: 'PARTIAL_CHAPTER_G_SCOPE', message: 'These checks cover §G2, §G2.2, §G3 and §G7 for doubly symmetric I/H only. Bearing stiffeners, concentrated-force limit states in Chapter J, web openings and whole-member compliance are outside this module.' },
      { code: 'DEMAND_COMBINATIONS_AS_SUPPLIED', message: 'Shear forces and adjacent-panel demands are used as supplied; no ASD/LRFD load-combination conversion is performed.' },
      { code: 'TFA_OPT_IN', message: 'Tension field action is disabled unless the user explicitly supplies and passes every §G3 eligibility and stiffener check.' },
    ],
  };

  const g2 = evaluateG2({ input, section, material: { fy_mpa: fy, e_mpa: e }, web: resolvedWeb, method, factorLib, demand: shearY });
  result.limit_states.shear_web = g2.shear;
  result.limit_states.stiffeners = g2.stiffeners;

  const weakAxis = evaluateWeakAxis({ section, material: { fy_mpa: fy, e_mpa: e }, method, factorLib, demand: shearX, torsion });
  result.limit_states.shear_flange = weakAxis;
  result.limit_states.shear_weak_axis = { ...weakAxis, id: 'SHEAR_WEAK_AXIS' };

  const tfa = evaluateTensionField({ input, section, material: { fy_mpa: fy, e_mpa: e }, web: resolvedWeb,
    webResult: result.limit_states.shear_web, method, factorLib, demand: shearY });
  result.limit_states.tension_field_action = tfa.state;
  result.limit_states.shear_web = tfa.webResult;
  if (tfa.stiffeners) result.limit_states.stiffeners = tfa.stiffeners;

  for (const entry of Object.values(result.limit_states)) {
    if (['INPUT_REQUIRED', 'REVIEW_REQUIRED'].includes(entry.status)) {
      result.warnings.push({ code: entry.id, message: entry.reason });
    }
  }
  return result;
}
