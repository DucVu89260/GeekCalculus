var Aisc36010Resistance = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../standards/aisc360-10-resistance.ts
  var aisc360_10_resistance_exports = {};
  __export(aisc360_10_resistance_exports, {
    allFactors: () => allFactors,
    availableStrength: () => availableStrength,
    factorNotation: () => factorNotation,
    getFactor: () => getFactor,
    selectedMethod: () => selectedMethod,
    webShearFactorKey: () => webShearFactorKey
  });

  // ../../standards/aisc360-10-strength-factors.json
  var aisc360_10_strength_factors_default = {
    schema_version: "1.0",
    edition: "AISC360-10",
    kind: "resistance_factors",
    source_note: "ANSI/AISC 360-10 (2010) resistance and safety factors; strength-only registry, NOT a complete clause validation or load combination engine",
    status: "provision_factors_reviewed",
    source_url: "https://design.medeek.com/resources/DOCUMENTS/AISC_360-10.pdf",
    factors: {
      FLEXURE: {
        phi: 0.9,
        omega: 1.67,
        clause: "F1",
        description: "Flexure (F2\u2013F6)"
      },
      COMPRESSION: {
        phi: 0.9,
        omega: 1.67,
        clause: "E1",
        description: "Compression (E3/E7)"
      },
      TENSION_GROSS: {
        phi: 0.9,
        omega: 1.67,
        clause: "D2(a)",
        description: "Gross-section tensile yielding (D2-1)"
      },
      TENSION_RUPTURE: {
        phi: 0.75,
        omega: 2,
        clause: "D2(b)",
        description: "Effective net section fracture (D2-2 / D3-1)"
      },
      SHEAR_GENERAL: {
        phi: 0.9,
        omega: 1.67,
        clause: "G1",
        description: "Shear except G2.1(a)"
      },
      SHEAR_ROLLED_G21A: {
        phi: 1,
        omega: 1.5,
        clause: "G2.1(a)",
        description: "Rolled I-shape web only where h/tw <= 2.24 sqrt(E/Fy); Cv=1"
      }
    },
    selection: {
      web_shear_rolled: "fabrication == ROLLED AND clear_web_slenderness <= 2.24*sqrt(E/Fy)",
      weak_axis_shear: "SHEAR_GENERAL",
      tension: "TENSION_GROSS only, no rupture/connection verification"
    },
    limitations: [
      "The source workbook is labelled AISC 360-05. Only phi/Omega coefficients originate from this edition-specific registry; nominal equations remain legacy and require review.",
      "The rolled I-shape exceptional shear factor is provisional for sharp-corner input; actual rolled fillet dimensions and clear web depth must be verified.",
      "ASD requires service-level ASD load combinations; changing the design method never converts or rescales the supplied forces.",
      "No tension fracture/connection limit state is checked, even though its factor is registered."
    ]
  };

  // ../../standards/aisc360-10-resistance.ts
  function selectedMethod(input) {
    if (input === "LRFD" || input === "ASD") return input;
    throw new RangeError("Only LRFD or ASD design methods are supported.");
  }
  function getFactor(key) {
    const entry = aisc360_10_strength_factors_default.factors[key];
    if (!entry || !Number.isFinite(entry.phi) || !Number.isFinite(entry.omega) || entry.phi <= 0 || entry.omega <= 0) {
      throw new Error("Missing or invalid AISC360-10 phi/Omega factor: " + key);
    }
    return { ...entry, key, edition: aisc360_10_strength_factors_default.edition };
  }
  function availableStrength(nominal, method, key) {
    selectedMethod(method);
    if (!Number.isFinite(nominal) || nominal < 0) throw new RangeError("Nominal resistance must be nonnegative and finite.");
    const record = getFactor(key);
    return method === "LRFD" ? record.phi * nominal : nominal / record.omega;
  }
  function factorNotation(method, key) {
    const f = getFactor(key);
    return method === "LRFD" ? { symbol: "\u03C6", value: f.phi, equation: "\u03C6 \xD7 Rn", ...f } : { symbol: "\u03A9", value: f.omega, equation: "Rn / \u03A9", ...f };
  }
  function webShearFactorKey(input) {
    const { fabrication, h_mm, tf_mm, tw_mm, e_mpa, fy_mpa } = input;
    if (![h_mm, tf_mm, tw_mm, e_mpa, fy_mpa].every((v) => typeof v === "number" && Number.isFinite(v) && v > 0) || h_mm <= 2 * tf_mm) {
      throw new RangeError("Invalid geometry/material for G2.1(a) selection");
    }
    const clearWebSlenderness = (h_mm - 2 * tf_mm) / tw_mm;
    return fabrication === "ROLLED" && clearWebSlenderness <= 2.24 * Math.sqrt(e_mpa / fy_mpa) ? "SHEAR_ROLLED_G21A" : "SHEAR_GENERAL";
  }
  function allFactors() {
    return aisc360_10_strength_factors_default;
  }
  return __toCommonJS(aisc360_10_resistance_exports);
})();
