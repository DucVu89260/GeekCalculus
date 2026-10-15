import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { runInNewContext } from 'node:vm'

const location=dirname(fileURLToPath(import.meta.url))
const pub=join(location,'../../public')
const factorsJS=readFileSync(join(pub,'aisc360-10-resistance.js'),'utf8')
const standard=runInNewContext(factorsJS+'\nAisc36010Resistance',{})
const html=readFileSync(join(pub,'hi-doubly-symmetric-aisc360-10.html'),'utf8')
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1])
assert.equal(scripts.length,2)
scripts.forEach(source => assert.doesNotThrow(()=>new Function(source),'Inline browser script must parse'))

const a=scripts[0].indexOf('const fixture = {'),b=scripts[0].indexOf('const latest =')
assert.ok(a>=0&&b>a,'calculator must be extractable without rendering the UI')
const runtime=runInNewContext(scripts[0].slice(a,b)+'\n({fixture,calculate})',{
 window:{ Aisc36010Resistance: standard },
})
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`Expected ${a} ≈ ${b}`)

test('AISC360-10 resistance registry contains per-limit-state factors',()=>{
 const f=standard.allFactors()
 assert.equal(f.edition,'AISC360-10')
 assert.deepEqual(Object.keys(f.factors).sort(),[
  'COMPRESSION','FLEXURE','SHEAR_GENERAL','SHEAR_ROLLED_G21A','TENSION_GROSS','TENSION_RUPTURE'
 ].sort())
 near(standard.getFactor('FLEXURE').phi,0.90)
 near(standard.getFactor('FLEXURE').omega,1.67)
 near(standard.getFactor('SHEAR_ROLLED_G21A').phi,1)
 near(standard.getFactor('SHEAR_ROLLED_G21A').omega,1.50)
 near(standard.getFactor('TENSION_RUPTURE').phi,.75)
 near(standard.getFactor('TENSION_RUPTURE').omega,2.00)
 assert.throws(()=>standard.selectedMethod('LRFD/ASD'),/Only LRFD or ASD/)
})

test('LRFD retains legacy Excel parity regression values',()=>{
 const r=runtime.calculate(runtime.fixture,'LRFD')
 assert.equal(r.design_method,'LRFD')
 assert.equal(r.overall_status,'REVIEW_REQUIRED')
 near(r.strengths.available_mnx_kNm,1020.0379893494273)
 near(r.strengths.available_mny_kNm,112.55655515838045)
 near(r.strengths.available_pn_compression_kN,2113.423353366748)
 near(r.interaction.percent,82.40656143563768)
 near(r.factors.shear_web.value,.90)
 near(r.factors.shear_flange.value,.90)
})

test('ASD divides the same nominal strengths by the proper Omega values',()=>{
 const lrfd=runtime.calculate(runtime.fixture,'LRFD')
 const asd=runtime.calculate(runtime.fixture,'ASD')
 const nom=lrfd.nominal_strengths
 near(asd.strengths.available_mnx_kNm,nom.mn_x_kNm/1.67)
 near(asd.strengths.available_mny_kNm,nom.mn_y_kNm/1.67)
 near(asd.strengths.available_pn_compression_kN,nom.pn_compression_kN/1.67)
 near(asd.strengths.available_pn_tension_gross_kN,nom.pn_tension_gross_kN/1.67)
 near(asd.strengths.available_vn_web_kN,nom.vn_web_kN/1.67)
 near(asd.strengths.available_vn_flange_kN,nom.vn_flange_kN/1.67)
 near(asd.interaction.percent,asd.interaction.utilization*100)
 assert.notEqual(asd.interaction.percent,lrfd.interaction.percent)
 assert.equal(asd.factors.flexure.symbol,'Ω')
 assert.equal(asd.factors.tension_rupture_not_checked.value,2)
 assert.equal(asd.overall_status,'REVIEW_REQUIRED')
 assert.ok(asd.warnings.some(x=>x.code==='LOAD_COMBINATION_METHOD'&&x.message.includes('ASD')))
})

test('rolled I web gets special G2.1a coefficients only when qualified',()=>{
 const eligible={fabrication:'ROLLED',h_mm:450,tf_mm:20,tw_mm:10,e_mpa:200000,fy_mpa:345}
 assert.equal(standard.webShearFactorKey(eligible),'SHEAR_ROLLED_G21A')
 const key=standard.webShearFactorKey(eligible)
 near(standard.availableStrength(200,'LRFD',key),200)
 near(standard.availableStrength(200,'ASD',key),200/1.5)
 assert.equal(standard.webShearFactorKey({...eligible,fabrication:'BUILT_UP'}),'SHEAR_GENERAL')
 assert.equal(standard.webShearFactorKey({...eligible,tw_mm:2}),'SHEAR_GENERAL')
 assert.throws(()=>standard.webShearFactorKey({...eligible,tw_mm:0}),/Invalid geometry/)
})

test('mode does not change demand inputs or silently certify legacy strength checks',()=>{
 const a=runtime.calculate(runtime.fixture,'ASD'),b=runtime.calculate(runtime.fixture,'LRFD')
 for(const [i,check] of a.limit_states.entries()){
  if(check.id==='axial_flexure_interaction'){
   // H1 is a derived utilization and must be recalculated from ASD/LRFD capacities.
   assert.notEqual(check.demand,b.limit_states[i].demand)
  }else{
   assert.equal(check.demand,b.limit_states[i].demand)
  }
 }
 assert.equal(a.target_standard,'AISC360-10_NOT_VALIDATED')
 assert.ok(a.warnings.some(w=>w.code==='LEGACY_WEAK_AXIS_FE'))
 assert.ok(a.warnings.some(w=>w.code==='INCOMPLETE_TENSION'))
 assert.throws(()=>runtime.calculate(runtime.fixture,'BOTH'),/Only LRFD or ASD/)
})

test('step-by-step formulas dynamically show phi for LRFD and Omega for ASD',()=>{
 const start=scripts[0].indexOf('function buildCalculationSteps(i, r)'),
       end=scripts[0].indexOf('function renderCalculationNotebook()')
 assert.ok(start>=0&&end>start)
 const reportRuntime=runInNewContext(scripts[0].slice(a,b) +
  '\nconst format=(v,d=3)=>Number.isFinite(v)?Number(v).toFixed(d):String(v);\n' +
  scripts[0].slice(start,end) +
  '\n({fixture,calculate,buildCalculationSteps})',{window:{Aisc36010Resistance:standard}})
 const make=(mode)=>reportRuntime.buildCalculationSteps(reportRuntime.fixture,reportRuntime.calculate(reportRuntime.fixture,mode))
 const lrfd=make('LRFD'),asd=make('ASD')
 const select=(steps)=>steps.flatMap(s=>s.rows).filter(r=>r.label.includes('Sức kháng'))
 const phi=select(lrfd),omega=select(asd)
 assert.ok(phi.some(r=>r.formula.includes('φ ×')))
 assert.ok(omega.filter(r=>r.label.includes('M<sub>n')).every(r=>r.formula.includes('Ω')))
 assert.ok(omega.some(r=>r.formula.includes('/ Ω')))
 assert.ok(omega.some(r=>r.subst.includes(' / 1.67')))
 assert.ok(asd.some(step=>step.subtitle.includes('ASD interaction')))
 assert.ok(lrfd.some(step=>step.subtitle.includes('LRFD interaction')))
})
