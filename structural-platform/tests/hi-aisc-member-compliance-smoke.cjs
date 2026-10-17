const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.HI_BASE_URL || 'http://127.0.0.1:5173/hi-doubly-symmetric-aisc360-10.html'
;(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try {
  const page=await browser.newPage({viewport:{width:1365,height:950}});page.setDefaultTimeout(15000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>localStorage.setItem('geekcalculus-locale','en'))
  await page.goto(base);await page.waitForFunction(()=>typeof verifiedResult!=='undefined'&&verifiedResult?.limit_states)
  assert.equal(await page.locator('.tab[data-tab="analysis"],.tab[data-tab="tension"],#analysis,#tension').count(),0)
  assert.equal(await page.locator('[data-key="scope_confirmed"],[data-key="envelope_confirmed"],[data-key="other_limit_states_confirmed"]').count(),0)
  for(const id of ['aisc-kx','aisc-ky','aisc-kz','aisc-e','aisc-g'])assert.equal(await page.locator('#'+id).isEditable(),false)
  assert.equal(await page.locator('#sap-import').isDisabled(),true)
  assert.match(await page.locator('#sap-import').getAttribute('title'),/geometry.*Cb/)
  assert.equal(await page.locator('#aisc-fabrication option[value="ROLLED"]').evaluate(node=>node.disabled),true)
  assert.equal(await page.evaluate(()=>verifiedResult.analysis_basis.analysis.status),'ASSUMED')
  assert.equal(await page.evaluate(()=>verifiedResult.analysis_basis.analysis.trace.model_verified),false)
  assert.ok(await page.evaluate(()=>verifiedResult.limit_states.major_flexure.available>0&&verifiedResult.limit_states.minor_flexure.available>0))
  assert.match(await page.locator('#member-design-summary').innerText(),/Interaction N–Mx–My/)
  assert.doesNotMatch(await page.locator('#warnings').innerText(),/INCOMPLETE_TENSION|critical.*path|Confirm all critical|scope_confirmed|C2.1: second-order/)
  assert.match(await page.locator('#calculation-notes').innerText(),/Hybrid steel.*cover plates/)
  assert.match(await page.locator('#calculation-notes').innerText(),/Web openings.*later/)
  assert.match(await page.locator('#calculation-notes').innerText(),/C3, K = 1/)
  assert.match(await page.locator('#calculation-notes a').getAttribute('href'),/pdf_page=81/)
  const forces=await page.evaluate(()=>structuredClone(latest.input.forces))
  await page.locator('input[name="design-method"][value="ASD"]').check();await page.waitForFunction(()=>verifiedResult?.mode==='ASD')
  assert.deepEqual(await page.evaluate(()=>latest.input.forces),forces)
  assert.equal(await page.evaluate(()=>verifiedResult.analysis_basis.load_basis.status),'CONFIRMED')
  await page.locator('[data-tab="shear"]').click();await page.locator('#stiffener-layout').selectOption('SINGLE_ANGLE')
  assert.equal(await page.locator('#angle-inertia-field').isVisible(),true)
  const payload=await page.evaluate(()=>{
   const input=structuredClone(latest.input);input.stiffeners.attachment_details_verified=true;input.stiffeners.inertia_axis_verified=true
   input.tension_field_action.same_boundaries_confirmed=true
   input.holes={pattern:'STAGGERED',top_flange_count:2};input.compliance={scope_confirmed:true,envelope_confirmed:true}
   input.analysis={method:'USER_K',second_order_global_confirmed:true}
   return {meta:{mode:'AISC36010_REFERENCE',design_method:'ASD'},input}
  })
  await page.locator('#file').setInputFiles({name:'older-connection-input.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))})
  await page.waitForFunction(()=>verifiedResult?.mode==='ASD')
  const restored=await page.evaluate(()=>structuredClone(latest.input))
  assert.equal(restored.assessment.scope,'GROSS_MEMBER');assert.equal(restored.analysis.method,'DIRECT')
  assert.equal(restored.holes,undefined);assert.equal(restored.compliance,undefined)
  assert.equal(restored.stiffeners.attachment_details_verified,false);assert.equal(restored.stiffeners.inertia_axis_verified,false)
  assert.equal(restored.tension_field_action.same_boundaries_confirmed,false)
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click()
  const exported=JSON.parse(fs.readFileSync(await(await downloadEvent).path(),'utf8'))
  assert.equal(exported.result.assessment_scope,'GROSS_MEMBER');assert.equal(exported.result.member_compliance.scope,'GROSS_SECTION_MEMBER_STRENGTH')
  assert.equal(exported.result.analysis_basis.analysis.trace.model_verified,false)
  await page.locator('[data-tab="geometry"]').click();await page.locator('[data-key="h_mm"]').fill('960')
  assert.equal(await page.evaluate(()=>verifiedResult),null)
  assert.equal(await page.locator('#member-design-summary').innerText(),'')
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844})
   for(const tab of ['geometry','member','forces','shear']){
    await page.locator(`[data-tab="${tab}"]`).click()
    assert.equal(await page.locator('#aisc-fabrication').isVisible(),true)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${tab} must fit ${width}px`)
   }
  }
  assert.deepEqual(errors,[])
  console.log('Gross-member UI passed: simplified inputs, capacities/interaction summary, manual ASD/LRFD, source C3 notes, pending SAP API, safe old-JSON import and G confirmations, export and mobile.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
