#!/usr/bin/env node
// Deterministic report: saved Excel cache is parity evidence, never AISC approval.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const load = require('../tests/helpers/crane-module.cjs')
const { calculateCraneSections } = load('crane-beam-section')
const { calculateCraneDesign, DEFAULT_CRANE_ACTIONS } = load('crane-beam-strength')
const { workbook, workbookCase } = require('../tests/helpers/crane-workbook.cjs')
const checking = process.argv.includes('--check')
const close = (a,b) => Math.abs(a-b) <= 1e-8 * Math.max(1,Math.abs(b))
async function main() {
  const cases = [], examples = []
  for (const method of ['ASD','LRFD']) {
    const f = workbookCase(method), sections = await calculateCraneSections(f.dimensions)
    const actions = { ...DEFAULT_CRANE_ACTIONS, ...f.actions }
    const result = calculateCraneDesign(sections,actions,method)
    const checks = Object.fromEntries(result.groups.flatMap(group => group.checks.map(check => [check.id,check])))
    const rows=[]
    function compare(property,ref,actual,power=0,note='',basis='CANONICAL_GEOMETRY',multiplier=10**power) {
      const raw = f.cells[ref]?.value
      const expected = typeof raw === 'number' ? raw * multiplier : null
      const status = actual === null ? 'BLOCKED' : expected === null ? 'NO_NUMERIC_CELL' : close(actual,expected) ? 'MATCH' : 'DIFF_REQUIRES_REVIEW'
      rows.push({property,cell:`${f.sheet}!${ref}`,formula:f.cells[ref]?.formula??null,excel_saved_value:raw??null,excel_to_canonical_multiplier:multiplier,excel_canonical:expected,code_canonical:actual,relative_difference:expected!==null&&actual!==null?(actual-expected)/Math.max(1,Math.abs(expected)):null,status,basis,note})
    }
    const p=sections.base.properties
    for(const [name,ref,value,power] of [
      ['A','B27',p.geometric.area,2],['Ix','B28',p.elastic.ix,4],['Iy','B29',p.elastic.iy,4],
      ['Sx.top','B30',p.elastic.sx_positive,3],['Sx.bottom','B31',p.elastic.sx_negative,3],
      ['Sy.top-flange','B32',sections.sy_top_flange_mm3,3],['Sy.bottom-flange','B33',sections.sy_bottom_flange_mm3,3],
      ['rx','B34',p.elastic.rx,1],['ry','B35',p.elastic.ry,1],['Zx','B36',p.plastic.zx,3],['Zy','E36',p.plastic.zy,3],
      ['yCG','H36',p.geometric.centroid_y,1],['yPNA','E35',p.plastic.pna_y,1],['hc.top','H34',sections.hc_top_mm,1],['hp.top','H35',sections.hp_top_mm,1],
      ['J','E33',sections.base.advanced.torsion_constant_j.value,4],['Cw','E34',sections.base.advanced.warping_constant_cw.value,6],
    ]) compare(name,ref,value,power)
    for(const [which,refs] of [['top',['AP51','AP52','AP53','AP54','AP55']],['bottom',['AP57','AP58','AP59','AP60','AP61']]]) {
      const t=sections[which].properties
      for(const [i,metric,value] of [[0,'A',t.geometric.area],[1,'yc.outer',sections[which+'_yc_from_outer_face_mm']],[2,'Ix',t.elastic.ix],[3,'Iy',t.elastic.iy],[4,'Sy',t.elastic.sy_positive]]) compare(`${which}T.${metric}`,refs[i],value)
    }
    compare('topT.A.displayed','B38',sections.top.properties.geometric.area,2,'B38 incorrectly references bottom AP57.','WORKBOOK_DEFECT')
    compare('topT.yc.displayed','B39',sections.top_yc_from_outer_face_mm,1,'B39 incorrectly references bottom AP58.','WORKBOOK_DEFECT')
    compare('topT.Zy','B44',sections.top.properties.plastic.zy,3,'Workbook AY45 is not the full top-T plastic integral; use the shared T solver.','WORKBOOK_DEFECT')
    compare('bottomT.Sy.displayed','B52',sections.bottom.properties.elastic.sy_positive,3,'B52 refers to Ix AP59, not Sy AP61.','WORKBOOK_DEFECT')
    for(const [id,ref,note] of [
      ['compression_top_t','D84','Top-T E4/E7, correct units and independent KLx/KLy/KLz differ from flawed worksheet E79/Q/area model.'],
      ['major_governing','D176','Corrected dimensions/λpw, FL, Lr and LTB. Slender LRFD web uses F5 rather than blindly retaining F4.'],
      ['minor_governing','H199','Correct top-T Zy; DG7/F6 applicability remains pending.'],
      ['shear_g2','C257','Valid workbook G2 case; no tension-field credit.'],
      ['shear_g7_top','C270','Top horizontal shear assigned to a full top flange with kv=1.2, not a half-flange shortcut.'],
      ['tension_field_candidate','E298','No credit if geometric/stiffener/end-panel gates fail. Excel uses flange thickness where Cv is required.'],
    ]) compare(id,ref,checks[id].capacity,0,note,'CALCULATION_CANDIDATE_NOT_STANDARD_APPROVAL')
    // Normalize an Excel saved available yielding value using the coefficient
    // explicitly present in its cell. This does NOT add an approved factor key.
    compare('J10.yield.nominal','C213',checks.web_local_yielding.nominal,0,'Saved available Excel value is normalized to nominal using its WORKBOOK-ONLY cell coefficient. Engine ASD/LRFD capacities remain blocked.','WORKBOOK_NORMALIZATION_ONLY',method==='ASD'?1.5:1)
    compare('J10.crippling.interior.nominal','E222',checks.web_crippling.nominal,0,'Same interior point-load assumption; actual end distance must be supplied.','NOMINAL_EQUATION_PARITY_ONLY')
    for(const id of ['web_local_yielding','web_crippling','web_sidesway','fatigue_bottom','stiffener_strength']) {
      rows.push({property:`${id}.approval`,status:'NOT_VERIFIED',reason:checks[id].warnings.join(' '),code_available:checks[id].capacity})
    }
    cases.push({method,sheet:f.sheet,dimensions_mm:f.dimensions,actions,geometry_hashes:Object.fromEntries(['base','top','bottom'].map(key=>[key,sections[key].geometry_hash])),summary_status:result.summary_status,rows,summary:{matching:rows.filter(r=>r.status==='MATCH').length,different:rows.filter(r=>r.status==='DIFF_REQUIRES_REVIEW').length,blocked:rows.filter(r=>r.status==='BLOCKED').length}})
    examples.push({method,dimensions:f.dimensions,actions})
  }
  const assumptions = [
    'Excel cached values were not recalculated and VBA was not run. No Summary sheet exists in this upload.',
    'Workbook D9 is CLEAR web depth; UI H = D9 + F9 + I9. Exact T stems use one third of clear flange-to-CG distance.',
    'Extra KLx/KLy/KLz assumed equal worksheet H12 only to supply a reproducible demonstration; actual top-T bracing lengths require engineer input.',
    'Interior end distance assumed 2H to match J10-2/E222 worksheet assumption; actual end distance is not present in source.',
    'WLmax uses H244 impacted wheel effect directly. SAP actions / longitudinal N use each sheet saved values; method switching does not convert them.',
    'Worksheet does not establish physical bracing, paired stiffener sizes, end-panel anchorage or fatigue category/history. Defaults remain explicit assumptions.',
  ]
  const report={schema_version:'1.0',source_filename:workbook.source_filename,source_sha256:workbook.source_sha256,regression_basis:workbook.basis,assumptions,cases,global_design_status:'NOT VERIFIED'}
  const files = new Map([
    [path.join(root,'docs/CRANE_BEAM_WORKBOOK_COMPARISON.json'),JSON.stringify(report,null,2)+'\n'],
    [path.join(root,'frontend/vue/src/steel-design/crane-beam-workbook-cases.json'),JSON.stringify({source_filename:workbook.source_filename,source_sha256:workbook.source_sha256,verification:'SAVED_EXCEL_CASES_WITH_UNVERIFIED_MODEL_ASSUMPTIONS',assumptions,cases:examples},null,2)+'\n'],
  ])
  const lines=['# Crane Beam — Excel ASD/LRFD comparison','',`Source SHA-256: \`${workbook.source_sha256}\`.`, '', '**NOT VERIFIED for design.** MATCH is numerical parity with saved Excel cache, not AISC approval. Different cells are retained with explanations; no global PASS is inferred.','',...assumptions.map(note=>'- '+note),'']
  for(const c of cases) {
    lines.push(`## ${c.method} — ${c.summary.matching} matching, ${c.summary.different} differences, ${c.summary.blocked} blocked`,'','| Property | Cell | Excel (canonical) | Code | Comparison | Note |','|---|---|---:|---:|---|---|')
    const number = v => v===null||v===undefined?'—':typeof v==='number'?Number(v.toPrecision(10)):String(v)
    for(const r of c.rows.filter(r=>'cell' in r)) lines.push(`| ${r.property} | ${r.cell} | ${number(r.excel_canonical)} | ${number(r.code_canonical)} | ${r.status} | ${(r.note||'').replaceAll('|','/')} |`)
    lines.push('','J10 available resistances, fatigue approval and G3 stiffener strength remain blocked pending source/detail verification.','')
  }
  files.set(path.join(root,'docs/CRANE_BEAM_WORKBOOK_COMPARISON.md'),lines.join('\n').trimEnd()+'\n')
  for(const [file,contents] of files) {
    if(checking) assert.equal(fs.readFileSync(file,'utf8'),contents,`Stale workbook regression output: ${path.relative(root,file)}`)
    else fs.writeFileSync(file,contents)
  }
  console.log(cases.map(c=>`${c.method}: ${c.summary.matching} MATCH, ${c.summary.different} DIFF, ${c.summary.blocked} BLOCKED`).join('\n'))
}
main().catch(error=>{console.error(error);process.exitCode=1})
