/**
 * ANSI/AISC 360-10 F4 reference calculation for a doubly symmetric, sharp-corner,
 * built-up I/H section with a noncompact web and rectangular flanges.
 *
 * Nominal resistance is returned in kN.m. Canonical section properties are in
 * mm-based units, with E and Fy in MPa. Cb is supplied with its existing F1-1
 * provenance; this module does not derive a moment diagram or apply phi/Omega.
 */
export const F4_SOURCE = Object.freeze({
  edition: 'ANSI/AISC 360-10, June 22, 2010',
  artifact_sha256: 'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99',
  physical_pages: [106, 107, 108, 109],
  printed_pages: ['16.1-50', '16.1-51', '16.1-52', '16.1-53'],
  scope_page: { physical: 105, printed: '16.1-49' },
  geometry: 'Doubly symmetric sharp-corner built-up I/H with rectangular flanges and welded web attachment at the inside flange faces.',
});

export const F4_FORMULAS = Object.freeze({
  'F4-1': { clause: 'F4.1', expression: 'Mn = Rpc Myc = Rpc Fy Sxc', applies: 'compression flange yielding' },
  'F4-2': { clause: 'F4.2(b)', expression: 'Mn = Cb[Rpc Myc - (Rpc Myc - FL Sxc)(Lb-Lp)/(Lr-Lp)] <= Rpc Myc', applies: 'inelastic lateral-torsional buckling, Lp < Lb <= Lr' },
  'F4-3': { clause: 'F4.2(c)', expression: 'Mn = Fcr Sxc <= Rpc Myc', applies: 'elastic lateral-torsional buckling, Lb > Lr' },
  'F4-5': { clause: 'F4.2', expression: 'Fcr = Cb pi^2 E/(Lb/rt)^2 sqrt(1 + 0.078 J/(Sxc ho)(Lb/rt)^2); use J=0 when Iyc/Iy <= 0.23', applies: 'elastic lateral-torsional buckling' },
  'F4-6a/F4-6b': { clause: 'F4.2', expression: 'FL = 0.7 Fy when Sxt/Sxc >= 0.7; otherwise FL = Fy Sxt/Sxc >= 0.5 Fy', applies: 'limiting flexural stress; this symmetric-section branch has Sxt/Sxc=1' },
  'F4-7': { clause: 'F4.2', expression: 'Lp = 1.1 rt sqrt(E/Fy)', applies: 'yielding limit for unbraced length' },
  'F4-8': { clause: 'F4.2', expression: 'Lr = 1.95 rt(E/FL)sqrt(q + sqrt(q^2 + 6.76(FL/E)^2)); q=J/(Sxc ho)', applies: 'inelastic LTB limit for the symmetric section, with J=0 when Iyc/Iy <= 0.23' },
  'F4-9a/F4-9b/F4-10': { clause: 'F4.2', expression: 'Rpc=Mp/Myc for lambda<=lambda_p; otherwise Rpc=min(Mp/Myc-(Mp/Myc-1)(lambda-lambda_pw)/(lambda_rw-lambda_pw), Mp/Myc) when Iyc/Iy>0.23; Rpc=1 when Iyc/Iy<=0.23', applies: 'web plastification factor' },
  'F4-11': { clause: 'F4.2', expression: 'rt = bfc/sqrt(12[ho/d + (aw/6)h^2/(ho d)]), with h=clear web distance and d=overall depth', applies: 'rectangular compression flange; source equation visually checked' },
  'F4-12': { clause: 'F4.2', expression: 'aw = hc tw/(bfc tfc)', applies: 'web-to-compression-flange area ratio' },
  'F4-13': { clause: 'F4.3(b)', expression: 'Mn = Rpc Myc - (Rpc Myc - FL Sxc)(lambda_f-lambda_pf)/(lambda_rf-lambda_pf)', applies: 'noncompact compression flange' },
  'F4-14': { clause: 'F4.3(c)', expression: 'Mn = 0.9 E kc Sxc/lambda_f^2', applies: 'slender compression flange' },
  'F4-15/F4-16a/F4-16b': { clause: 'F4.4', expression: 'Tension flange yielding applies only when Sxt<Sxc; it does not apply to this doubly symmetric gross section.', applies: 'tension flange yielding' },
});

const status = (code, reason, trace = {}) => ({
  id: 'MAJOR_FLEXURE',
  status: code,
  reason,
  clause: 'F4',
  source: F4_SOURCE,
  trace,
});

const positive = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite.`);
  }
  return value;
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/**
 * Calculate one source-traceable nominal F4 branch. `options.cb` must be an
 * object like `{value: 1, source: 'CONSERVATIVE', clause: 'F1-1'}` when Lb > Lp.
 * A missing Cb is immaterial when Lb <= Lp because F4 says LTB does not apply.
 */
export function calculateF4NoncompactWeb(input, canonical, options = {}) {
  if (!input || typeof input !== 'object' || !canonical || typeof canonical !== 'object') {
    return status('INPUT_REQUIRED', 'Input and canonical Section Properties are required.');
  }

  const section = input.section ?? {};
  const material = input.material ?? {};
  const member = input.member ?? {};
  if (section.fabrication === 'ROLLED') {
    return status('REVIEW_REQUIRED', 'Rolled-section fillet geometry is not represented by the sharp-corner model; verify the effective clear web and flange geometry from the profile source.');
  }
  if (section.fabrication !== 'BUILT_UP') {
    return status('INPUT_REQUIRED', 'F4 geometry must identify BUILT_UP fabrication.');
  }

  let d, bf, tw, tf, e, fy, sx, zx, iy, lb;
  try {
    d = positive(section.h_mm, 'd (overall section depth h_mm)');
    bf = positive(section.bf_mm, 'bf');
    tw = positive(section.tw_mm, 'tw');
    tf = positive(section.tf_mm, 'tf');
    e = positive(material.e_mpa, 'E');
    fy = positive(material.fy_mpa, 'Fy');
    sx = positive(canonical.sx_mm3, 'Sx');
    zx = positive(canonical.zx_mm3, 'Zx');
    iy = positive(canonical.iy_mm4, 'Iy');
    lb = positive(member.lb_mm, 'Lb');
  } catch (error) {
    return status('INPUT_REQUIRED', error instanceof Error ? error.message : 'Required F4 input is invalid.');
  }

  if (d <= 2 * tf || bf < tw) {
    return status('REVIEW_REQUIRED', 'Invalid sharp-corner built-up I/H geometry: require h > 2tf and bf >= tw.');
  }

  const hc = d - 2 * tf;
  const ho = d - tf;
  const lambdaWeb = hc / tw;
  const rootEFy = Math.sqrt(e / fy);
  const lambdaPw = 3.76 * rootEFy;
  const lambdaRw = 5.70 * rootEFy;
  if (lambdaWeb <= lambdaPw || lambdaWeb > lambdaRw) {
    return status('REVIEW_REQUIRED', 'This F4 branch requires a noncompact web: lambda_pw < hc/tw <= lambda_rw.', {
      lambda_web: lambdaWeb,
      lambda_pw: lambdaPw,
      lambda_rw: lambdaRw,
    });
  }

  // Iyc is the F4-specific compression-flange term; Sx, Zx and Iy remain
  // canonical properties from the shared geometry core.
  const iyc = tf * bf ** 3 / 12;
  const iycOverIy = iyc / iy;
  if (!(Number.isFinite(iycOverIy) && iycOverIy > 0 && iycOverIy < 1)) {
    return status('REVIEW_REQUIRED', 'F4 requires a physically possible Iyc/Iy ratio strictly between zero and one.', {
      i_yc_mm4: iyc,
      i_y_mm4: iy,
      i_yc_over_i_y: iycOverIy,
    });
  }
  const mp = Math.min(fy * zx, 1.6 * fy * sx);
  const myc = fy * sx;
  const rpcBase = mp / myc;
  const rpc = iycOverIy <= 0.23
    ? 1
    : Math.min(rpcBase - (rpcBase - 1) * (lambdaWeb - lambdaPw) / (lambdaRw - lambdaPw), rpcBase);
  const mnCompressionYielding = rpc * myc;

  // This section model has equal top/bottom flanges, so Sxt/Sxc = 1 and F4-6a
  // gives FL = 0.7Fy. The nearest web line is the inside face of each flange.
  const fl = 0.7 * fy;
  const lambdaFlange = bf / (2 * tf);
  const lambdaPf = 0.38 * rootEFy;
  const kc = clamp(4 / Math.sqrt(lambdaWeb), 0.35, 0.76);
  const lambdaRf = 0.95 * Math.sqrt(kc * e / fl);
  const aw = hc * tw / (bf * tf);
  const rt = bf / Math.sqrt(12 * (ho / d + aw * hc ** 2 / (6 * ho * d)));
  const lp = 1.1 * rt * rootEFy;

  let cbValue = null;
  let cbSource = 'NOT_REQUIRED_LB_LE_LP';
  let cbClause = 'F1-1';
  let j = null;
  let q = null;
  let lr = null;
  let fcr = null;
  let mnLtb = null;
  let ltbClause = 'NOT_APPLICABLE_LB_LE_LP';

  if (lb > lp) {
    const cb = options.cb;
    if (!cb || typeof cb !== 'object' || typeof cb.source !== 'string' || !cb.source.trim()) {
      return status('INPUT_REQUIRED', 'A source-traceable Cb from F1-1 is required when Lb > Lp.', {
        lambda_web: lambdaWeb,
        lambda_pw: lambdaPw,
        lambda_rw: lambdaRw,
        rt_mm: rt,
        lp_mm: lp,
        lb_mm: lb,
      });
    }
    try {
      cbValue = positive(cb.value, 'Cb');
    } catch (error) {
      return status('INPUT_REQUIRED', error instanceof Error ? error.message : 'Cb is invalid.');
    }
    if (cbValue < 1) {
      return status('REVIEW_REQUIRED', 'AISC 360-10 F1 requires Cb to be at least 1.0.', { cb: cbValue, cb_source: cb.source });
    }
    cbSource = cb.source;
    cbClause = typeof cb.clause === 'string' && cb.clause.trim() ? cb.clause : 'F1-1';

    if (iycOverIy <= 0.23) {
      j = 0;
    } else {
      try {
        j = positive(canonical.torsion_constant_j_mm4, 'J');
      } catch (error) {
        return status('INPUT_REQUIRED', error instanceof Error ? error.message : 'J is invalid.');
      }
    }
    q = j / (sx * ho);
    lr = 1.95 * rt * e / fl * Math.sqrt(q + Math.sqrt(q ** 2 + 6.76 * (fl / e) ** 2));
    if (!Number.isFinite(lr) || lr <= lp) {
      return status('REVIEW_REQUIRED', 'F4 produced invalid Lp/Lr limits for the supplied section.', { lp_mm: lp, lr_mm: lr, rt_mm: rt, q });
    }

    if (lb <= lr) {
      mnLtb = Math.min(mnCompressionYielding,
        cbValue * (mnCompressionYielding - (mnCompressionYielding - fl * sx) * (lb - lp) / (lr - lp)));
      ltbClause = 'F4-2';
    } else {
      const lbOverRtSquared = (lb / rt) ** 2;
      fcr = cbValue * Math.PI ** 2 * e / lbOverRtSquared * Math.sqrt(1 + 0.078 * q * lbOverRtSquared);
      mnLtb = Math.min(fcr * sx, mnCompressionYielding);
      ltbClause = 'F4-3/F4-5';
    }
  }

  let mnFlb = null;
  let flbClause = 'NOT_APPLICABLE_COMPACT_FLANGE';
  if (lambdaFlange > lambdaPf && lambdaFlange <= lambdaRf) {
    mnFlb = mnCompressionYielding - (mnCompressionYielding - fl * sx) *
      (lambdaFlange - lambdaPf) / (lambdaRf - lambdaPf);
    flbClause = 'F4-13';
  } else if (lambdaFlange > lambdaRf) {
    mnFlb = 0.9 * e * kc * sx / lambdaFlange ** 2;
    flbClause = 'F4-14';
  }

  const candidates = [
    { limit_state: 'COMPRESSION_FLANGE_YIELDING', clause: 'F4-1', nominal: mnCompressionYielding },
    ...(mnLtb === null ? [] : [{ limit_state: 'LATERAL_TORSIONAL_BUCKLING', clause: ltbClause, nominal: mnLtb }]),
    ...(mnFlb === null ? [] : [{ limit_state: 'COMPRESSION_FLANGE_LOCAL_BUCKLING', clause: flbClause, nominal: mnFlb }]),
  ];
  const governing = candidates.reduce((minimum, candidate) => candidate.nominal < minimum.nominal ? candidate : minimum);
  const trace = {
    geometry_model: 'SHARP_CORNER_BUILT_UP_RECTANGULAR_PLATES',
    clear_web_assumption: 'AISC h=hc=d-2tf for a welded section; d is overall depth and ho=d-tf',
    overall_depth_d_mm: d,
    h_clear_mm: hc,
    hc_mm: hc,
    ho_mm: ho,
    bfc_mm: bf,
    tfc_mm: tf,
    lambda_web: lambdaWeb,
    lambda_pw: lambdaPw,
    lambda_rw: lambdaRw,
    lambda_flange: lambdaFlange,
    lambda_pf: lambdaPf,
    lambda_rf: lambdaRf,
    kc,
    i_yc_mm4: iyc,
    i_y_mm4: iy,
    i_yc_over_i_y: iycOverIy,
    j_mm4: j,
    q_j_over_sxho: q,
    aw,
    rt_mm: rt,
    lp_mm: lp,
    lr_mm: lr,
    lb_mm: lb,
    cb: cbValue,
    cb_source: cbSource,
    cb_clause: cbClause,
    fl_mpa: fl,
    mp_kNm: mp / 1e6,
    myc_kNm: myc / 1e6,
    rpc,
    mn_compression_flange_yielding_kNm: mnCompressionYielding / 1e6,
    mn_ltb_kNm: mnLtb === null ? null : mnLtb / 1e6,
    fcr_mpa: fcr,
    ltb_clause: ltbClause,
    mn_compression_flange_local_buckling_kNm: mnFlb === null ? null : mnFlb / 1e6,
    flb_clause: flbClause,
    tension_flange_yielding: { status: 'NOT_APPLICABLE', clause: 'F4-15/F4-16', reason: 'Sxt equals Sxc for a doubly symmetric gross section.' },
    candidates: candidates.map(({ nominal, ...candidate }) => ({ ...candidate, nominal_kNm: nominal / 1e6 })),
    governing_limit_state: governing.limit_state,
    governing_clause: governing.clause,
  };
  return {
    id: 'MAJOR_FLEXURE',
    status: 'CALCULATED',
    nominal: governing.nominal / 1e6,
    clause: 'F4',
    source: F4_SOURCE,
    trace,
  };
}
