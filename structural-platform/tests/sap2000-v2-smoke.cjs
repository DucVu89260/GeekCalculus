const assert=require('node:assert/strict'),fs=require('node:fs/promises')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
;(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[],origins=new Set()
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>origins.add(new URL(r.url()).origin))
  await page.goto('http://127.0.0.1:8012/?lang=vi#token=v2-browser-test-token-000000000000000000')
  await page.waitForFunction(()=>document.querySelectorAll('#instance option').length===3&&!document.querySelector('#controls').disabled)
  assert.equal(new URL(page.url()).hash,'');assert.equal(await page.locator('#sap-title').textContent(),'SAP2000-API V2')
  await page.selectOption('#instance','20948');await page.click('#connect')
  await page.waitForFunction(()=>document.querySelector('#filename').textContent==='V2-steel.sdb'&&!document.querySelector('#controls').disabled)
  assert.equal(await page.locator('#profile-groups input').count(),9)
  assert.equal(await page.evaluate(()=>document.querySelector('#selected-panel').contains(document.querySelector('#profile-panel'))),true)
  assert.equal(await page.locator('#profile-member-groups input').count(),6)
  assert.equal(await page.locator('#profile-design-groups input').count(),3)
  assert.equal(await page.locator('#forces-panel #selection').count(),1)
  assert.equal(await page.locator('#forces-panel #extract').count(),1)
  assert.equal(await page.locator('#selected-panel #selection,#selected-panel #extract').count(),0)
  assert.equal(await page.locator('#forces-panel #extreme-panel').count(),1)
  assert.equal(await page.locator('#forces-panel #section-summary-panel').count(),1)
  assert.deepEqual(await page.locator('#force-filter-title,#extreme-title,#section-summary-title').allTextContents(),['4.1. Lọc nội lực','4.2. Cực trị nội lực','4.3. Tổng hợp cực trị theo Tiết diện'])

  const checkPanelOrder=()=>page.evaluate(()=>{const ids=['selected-panel','profile-panel','forces-panel'];return ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom}})})
  let order=await checkPanelOrder();assert.ok(order[0].top<=order[1].top&&order[1].bottom<=order[0].bottom&&order[0].bottom<=order[2].top)

  assert.equal(await page.locator('#profile-groups input:checked').count(),5)
  await page.click('#profile-read')
  await page.waitForFunction(()=>document.querySelector('#profile-status').textContent.includes('2 frame')&&!document.querySelector('#controls').disabled)
  assert.equal(await page.locator('#profile-section-body tr').count(),1)
  assert.match(await page.locator('#profile-section-body tr td').nth(2).textContent(),/I \/ Wide Flange Section.*i_wide_flange/)
  assert.match(await page.locator('#profile-section-body').textContent(),/300.00.*150.00.*12.00.*8.00.*SteelA.*345.00.*510.00/)
  await page.selectOption('#profile-target','frame:F2')
  assert.equal(await page.locator('#profile-section-body tr').count(),4)
  assert.match(await page.locator('#profile-section-body tr').nth(0).textContent(),/1 · I.*I300.*SteelB.*355.00.*510.00/)
  assert.match(await page.locator('#profile-section-body tr').nth(1).textContent(),/1 · J.*I500.*500.00/)
  await page.selectOption('#profile-target','frame:F1')
  await page.selectOption('#profile-category','geometry')
  assert.match(await page.locator('#profile-detail').textContent(),/length_m\s*5/)
  await page.selectOption('#profile-target','@materials')
  await page.selectOption('#profile-category','SteelA')
  await page.locator('#profile-detail summary').filter({hasText:/^normalized$/}).click()
  await page.waitForFunction(()=>/Fy_MPa\s*345/.test(document.querySelector('#profile-detail').textContent))
  const downloadJson=async(button)=>{const pending=page.waitForEvent('download');await page.click(button);return JSON.parse(await fs.readFile(await (await pending).path(),'utf8'))}
  const basic=await downloadJson('#profile-json')
  assert.equal(basic.sections.NP1.components[0].section_type.key,'i_wide_flange')
  assert.equal(basic.sections.NP1.section_type.key,'nonprismatic')
  assert.equal(basic.units.system,'kN_m_C');assert.equal(basic.original_units_code,9)
  assert.equal(basic.members[1].data.materials.effective_material,'SteelB')
  assert.equal(basic.sections.I300.properties_mm.I33_mm4,150000000)
  assert.equal(basic.sections.NP1.properties.status,'unavailable')
  await page.locator('#cases label').filter({hasText:'DEAD'}).locator('input').check()
  await page.locator('#cases label').filter({hasText:'ULS'}).locator('input').check()
  assert.equal(await page.locator('#profile-groups input[value=loads],#profile-groups input[value=forces],#profile-groups input[value=displacements]').count(),0)
  await page.click('#profile-all');await page.click('#profile-read')
  await page.waitForFunction(()=>document.querySelector('#profile-status').textContent.includes('2 frame')&&!document.querySelector('#controls').disabled)
  assert.equal(await page.locator('#results tr').count(),0)

  await page.selectOption('#profile-target','frame:F1');await page.selectOption('#profile-category','assignments')
  assert.equal(await page.locator('#profile-release-i thead th').count(),5)
  assert.equal(await page.locator('#profile-release-i tbody tr').count(),6)
  assert.equal(await page.locator('#profile-release-j tbody tr').count(),6)
  assert.deepEqual(await page.locator('#profile-release-i tbody tr').nth(5).locator('td').allTextContents(),['5','M3','R3','true','Có giải phóng (true)'])
  assert.deepEqual(await page.locator('#profile-release-j tbody tr').nth(4).locator('td').allTextContents(),['4','M2','R2','false','Không giải phóng (false)'])
  assert.equal(await page.locator('#profile-partial-fixity tbody tr').count(),6)
  await page.selectOption('#profile-target','@model');await page.selectOption('#profile-category','steel_design')
  assert.match(await page.locator('#profile-preferences-scope').textContent(),/Không thuộc riêng member/)
  await page.selectOption('#profile-target','frame:F1');await page.selectOption('#profile-category','design_overwrites')
  await page.waitForFunction(()=>document.querySelectorAll('#profile-detail tbody tr').length===43)
  assert.match(await page.locator('#profile-detail tbody tr').nth(27).textContent(),/28.*Cb.*0.*true/)
  assert.match(await page.locator('#profile-design-fy').textContent(),/400.00 MPa.*ProgDet=false/)
  const full=await downloadJson('#profile-json')
  assert.equal(full.model_data.steel_design.design_method,'ASD')
  assert.equal(full.force_dataset,null)
  assert.deepEqual(full.requested_groups.filter(g=>['loads','forces','displacements'].includes(g)),[])
  assert.equal(full.members[0].data.assignments.releases.dof_order[5],'R3')
  assert.equal(full.members[0].data.assignments.springs.status,'empty')
  assert.equal(full.members[0].data.design_results.status,'ok')
  await page.selectOption('#profile-target','frame:F2');await page.selectOption('#profile-category','design_results')
  assert.equal(await page.locator('#profile-design-message').textContent(),'Members have not been designed')
  await page.click('#extract');await page.waitForFunction(()=>document.querySelectorAll('#results tr').length===8&&!document.querySelector('#controls').disabled)

  const sectionColors=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#results tr')].map(tr=>[tr.dataset.section,getComputedStyle(tr).backgroundColor])));
  assert.equal(Object.keys(sectionColors).length,2);assert.equal(new Set(Object.values(sectionColors)).size,2);
  for(const section of Object.keys(sectionColors)){await page.selectOption('#filter-section',section);assert.ok((await page.locator('#results tr').evaluateAll(rows=>rows.map(tr=>getComputedStyle(tr).backgroundColor))).every(color=>color===sectionColors[section]))}
  await page.selectOption('#filter-section','');
  for(const value of await page.locator('#results td:nth-child(n+9):nth-child(-n+14)').allTextContents())assert.match(value,/^-?\d+\.\d{2}$/)
  for(const position of ['release_start','release_end']){
   await page.selectOption('#filter-position',position)
   assert.equal(await page.locator('#results tr').count(),4)
   assert.equal(await page.locator('#results tr.interpolated').count(),0)
   assert.match(await page.locator('#position-notice').textContent(),/không nội suy/)
  }
  const boundaryCheck=await page.evaluate(()=>{
   const original=dataset;const row=dataset.rows[0];
   dataset={...dataset,rows:[]};
   for(const [i,step] of ['', 'Max'].entries())for(const [j,x] of [0.4+i,2.8+i].entries()){
    const r={...row,record_id:i+'-'+j,step_type:step,station:x,element_station:0,M3:-123.456};dataset.rows.push(r)
    if(j===0)dataset.rows.push({...r,record_id:r.record_id+'-tie',element:'other'})
   }
   try{
    const result={};for(const pos of ['release_start','release_end']){
     document.querySelector('#filter-position').value=pos;
     result[pos]=filteredRows().map(r=>[r.record_id,r.station,r.M3]);
    }return result;
   }finally{dataset=original}
  })
  assert.deepEqual(boundaryCheck.release_start,[['0-0',.4,-123.456],['0-0-tie',.4,-123.456],['1-0',1.4,-123.456],['1-0-tie',1.4,-123.456]])
  assert.deepEqual(boundaryCheck.release_end,[['0-1',2.8,-123.456],['1-1',3.8,-123.456]])
  await page.selectOption('#filter-position','')
  await page.click('#extremes');await page.waitForFunction(()=>document.querySelectorAll('#extreme-results tr').length===36&&!document.querySelector('#controls').disabled)
  assert.equal(await page.locator('#extreme-position option[value="end_i"]').textContent(),'start')
  assert.equal(await page.locator('#extreme-position option[value="end_j"]').textContent(),'end')
  for(const position of ['release_start','release_end']){
   await page.selectOption('#extreme-position',position)
   await page.click('#extremes')
   await page.waitForFunction(()=>document.querySelectorAll('#extreme-results tr').length===36&&!document.querySelector('#controls').disabled)
   assert.ok((await page.locator('#extreme-results').textContent()).includes(position.replace('_','-')))
  }
  await page.selectOption('#extreme-position','all')
  await page.click('#section-summary');await page.waitForFunction(()=>document.querySelectorAll('#section-summary-results tr').length===12&&!document.querySelector('#controls').disabled)
  await page.click('#design-members');await page.locator('#steel-review').waitFor({state:'visible'})
  assert.match(await page.locator('#steel-review-title').textContent(),/AISC 360-10/)
  assert.equal(await page.locator('#steel-map-confirmed').isVisible(),false)
  assert.equal(await page.locator('#steel-unstiffened-confirmed').isChecked(),true)
  assert.match(await page.locator('.report-basis').textContent(),/DAM/)
  assert.equal(await page.locator('#steel-length-source').inputValue(),'hybrid');
  assert.equal(await page.locator('#steel-report-footnote').evaluate(e=>!e.closest('table,.table-wrap')),true);
  assert.match(await page.locator('#steel-report-footnote').textContent(),/không phải D\/C do SAP xuất/);
  await page.selectOption('#steel-method','LRFD');await page.selectOption('#steel-cb-mode','CONSERVATIVE');await page.click('#steel-run-report');
  await page.waitForFunction(()=>document.querySelector('#steel-report-missing').textContent.includes('Lz'));
  const partial=page.locator('#steel-report-results tbody tr').filter({hasText:'F1 · I300'}).filter({hasText:'DEAD'});assert.equal(await partial.locator('td').nth(6).textContent(),'1.00');assert.equal(await partial.locator('td').nth(7).textContent(),'—');
  assert.match(await page.locator('#steel-report-missing').textContent(),/H1.*Lz/);
  await page.selectOption('#steel-cb-mode','COMBO');

  await page.click('#steel-read-lengths');await page.waitForFunction(()=>document.querySelector('#steel-length-status').textContent.startsWith('Đã đọc.'));
  assert.match(await page.locator('#steel-report-inputs').textContent(),/SAP ratio 1 ×/);
  assert.equal(await page.getByRole('spinbutton',{name:'F1 major m',exact:true}).count(),1);
  assert.equal(await page.getByRole('spinbutton',{name:'F1 minor m',exact:true}).count(),0);
  await page.selectOption('[aria-label="F1 Lz source"]','lb');
  assert.equal(await page.getByRole('spinbutton',{name:'F1 Lz m',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('spinbutton',{name:'F1 Lz m',exact:true}).inputValue(),'5');
  await page.selectOption('#steel-length-source','manual');const temporaryLb=page.getByRole('spinbutton',{name:'F1 ltb m',exact:true});await temporaryLb.fill('3');await temporaryLb.press('Tab');assert.equal(await page.getByRole('spinbutton',{name:'F1 Lz m',exact:true}).inputValue(),'3');
  await page.selectOption('[aria-label="F1 Lz source"]','manual');

  await page.selectOption('#steel-length-source','manual');await page.selectOption('#steel-method','LRFD')
  for(const [key,value] of [['major','2'],['minor','2'],['ltb','4']]){const input=page.getByRole('spinbutton',{name:'F1 '+key+' m',exact:true});await input.fill(value);await input.press('Tab')}
  for(const [name,value] of [['F1 Lz m','2.2'],['F1 LTB start m','0'],['F1 LTB end m','4']]){const input=page.getByRole('spinbutton',{name,exact:true});await input.fill(value);await input.press('Tab')}
  await page.click('#steel-run-report');await page.waitForFunction(()=>document.querySelector('#steel-report-status').textContent.includes('nhóm Frame/Combo'))
  assert.equal(await page.locator('#steel-report-results tbody tr').count(),4)
  const reportRow=page.locator('#steel-report-results tbody tr').filter({hasText:'F1 · I300'}).filter({hasText:'DEAD'})
  await reportRow.getByRole('button',{name:'Các station đã kiểm tra'}).click();assert.ok(await page.locator('#steel-station-results tbody tr').count()>2);assert.match(await page.locator('#steel-station-scope').textContent(),/Mốc thiếu/);await page.click('#steel-station-close');
  await reportRow.getByRole('button',{name:'Xem chi tiết',exact:true}).click()
  const component=page.frameLocator('#steel-component-frame');await component.locator('#sap-component-origin').filter({hasText:'Frame F1'}).waitFor()
  assert.equal(await component.locator('[data-key="fy_mpa"]').first().inputValue(),'345')
  assert.equal(await component.locator('#aisc-lz').inputValue(),'2200')
  assert.match(await component.locator('#cb1-note').textContent(),/Mmax=10/)
  await component.locator('#aisc-review-status').filter({hasText:/Gross member strength/}).waitFor()
  const resultDownload=page.waitForEvent('download');await component.locator('#export').click()
  const resultFile=await resultDownload,componentExport=JSON.parse(await fs.readFile(await resultFile.path(),'utf8'))
  assert.equal(componentExport.meta.design_method,'LRFD');assert.equal(componentExport.sap_source.case,'DEAD')
  assert.equal(componentExport.input.forces.moment_x_kNm,componentExport.sap_source.forces.M3)
  assert.ok(Math.abs(componentExport.result.assumptions.cb-125/120)<1e-10)
  assert.equal(componentExport.sap_source.moment_diagram.source.case,'DEAD')
  await page.locator('#steel-component-dialog').screenshot({path:'/tmp/sap-symmetric-component-result.png'})
  await page.click('#steel-component-close');await page.locator('#steel-review').evaluate(e=>{e.scrollTop=0});await page.locator('#steel-review').screenshot({path:'/tmp/sap-steel-report.png'})
  await page.keyboard.press('Escape');await page.click('#design-summary');await page.locator('#steel-review').waitFor({state:'visible'})
  assert.equal(await page.locator('#steel-mode').inputValue(),'summary')
  await page.click('#steel-run-report');await page.waitForFunction(()=>document.querySelector('#steel-report-status').textContent.includes('nhóm Frame/Combo'))
  assert.ok(await page.locator('#steel-report-results tbody tr').count()>0)
  await page.click('#steel-review-close')
  // Synthetic full-property one-segment NP exercises the reference UI without claiming a live CSI verification.
  await page.evaluate(()=>{v2Snapshot.sections.NP1.segments=[{...v2Snapshot.sections.NP1.segments[0]}]});
  await page.click('#design-members');await page.selectOption('#steel-length-source','manual');await page.selectOption('#steel-method','LRFD');await page.selectOption('#steel-cb-mode','CONSERVATIVE');
  for(const [key,value] of [['major','2'],['minor','2'],['ltb','4']]){const input=page.getByRole('spinbutton',{name:'F2 '+key+' m',exact:true});await input.fill(value);await input.press('Tab')}
  await page.getByRole('spinbutton',{name:'F2 Lz m',exact:true}).fill('2.2');await page.getByRole('spinbutton',{name:'F2 Lz m',exact:true}).press('Tab');
  await page.click('#steel-run-report');await page.waitForFunction(()=>document.querySelector('#steel-report-status').textContent.includes('nhóm Frame/Combo'));
  const npRow=page.locator('#steel-report-results tbody tr').filter({hasText:'F2 · NP1'}).filter({hasText:'DEAD'});
  assert.match(await npRow.textContent(),/D\/C tham khảo/);assert.match(await npRow.locator('td').nth(8).textContent(),/^\d+\.\d{2}$/);
  assert.equal(await npRow.getByRole('button',{name:'Xem chi tiết',exact:true}).count(),0);
  await npRow.getByRole('button',{name:'Các station đã kiểm tra'}).click();assert.match(await page.locator('#steel-station-scope').textContent(),/chưa kiểm tra ổn định/);
  const stationHeights=await page.locator('#steel-station-results tbody td:nth-child(3)').allTextContents();assert.ok(stationHeights.some(v=>v.startsWith('300.00')));assert.ok(stationHeights.some(v=>!v.startsWith('300.00')));
  await page.click('#steel-station-close');await page.click('#steel-review-close');
  await page.evaluate(()=>{delete v2Snapshot.members.find(m=>m.frame==='F1').data.design_overwrites});await page.click('#design-members');await page.waitForFunction(()=>document.querySelector('#steel-length-status').textContent.startsWith('Đã đọc.')&&v2Snapshot.members.every(m=>Array.isArray(m.data.design_overwrites)));await page.selectOption('#steel-length-source','hybrid');assert.match(await page.locator('#steel-report-inputs').textContent(),/SAP ratio 1 ×/);await page.click('#steel-review-close');
  await page.click('#profile-capabilities');await page.waitForFunction(()=>document.querySelector('#profile-target').value==='@capabilities'&&!document.querySelector('#controls').disabled)
  const caps=await downloadJson('#profile-capabilities-json');assert.ok(caps.data.length>60)
  await page.locator('#profile-panel > details > summary').click();await page.click('#profile-tables')
  await page.waitForFunction(()=>document.querySelectorAll('#profile-table option').length===1&&!document.querySelector('#controls').disabled)
  await page.fill('#profile-table-limit','1');await page.click('#profile-table-read')
  await page.waitForFunction(()=>document.querySelectorAll('#profile-table-body tr').length===1&&!document.querySelector('#controls').disabled)
  const table=await downloadJson('#profile-table-json');assert.equal(table.total_records,2);assert.equal(table.truncated,true)
  assert.deepEqual(table.rows,[['F1','I300','0.01']]);assert.equal(table.raw.data.TableData,undefined)
  const snapshot=await page.evaluate(()=>JSON.stringify(v2Snapshot))
  await page.click('#lang-en');assert.match(await page.locator('#steel-report-footnote').textContent(),/not a D\/C exported by SAP/);assert.equal(await page.locator('#selected-panel > h2').textContent(),'3. Selected members');assert.match(await page.locator('#profile-member-groups h3').textContent(),/^3.1. Materials/);assert.equal(await page.locator('#profile-design-groups h3').textContent(),'3.2. Design parameters');assert.equal(await page.locator('#extreme-title').textContent(),'4.2. Internal force extremes')
  assert.equal(await page.locator('#profile-groups input:checked').count(),9)
  await page.selectOption('#profile-target','frame:F1');await page.selectOption('#profile-category','assignments')
  assert.equal(await page.locator('#profile-release-i tbody tr').nth(5).locator('td').nth(4).textContent(),'Released (true)')
  await page.click('#lang-vi');assert.equal(await page.evaluate(()=>JSON.stringify(v2Snapshot)),snapshot)
  assert.equal(await page.locator('#profile-release-i tbody tr').nth(5).locator('td').nth(4).textContent(),'Có giải phóng (true)')
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  order=await checkPanelOrder();assert.ok(order[0].top<=order[1].top&&order[1].bottom<=order[0].bottom&&order[0].bottom<=order[2].top)
  await page.screenshot({path:'/tmp/sap-v2-local-mobile.png',fullPage:true})
  await page.setViewportSize({width:1440,height:1000});await page.selectOption('#profile-target','frame:F1');await page.selectOption('#profile-category','design_overwrites')
  await page.locator('#profile-panel').screenshot({path:'/tmp/sap-v2-steel-data.png'})
  await page.click('#profile-none');await page.locator('#profile-groups input[value=design_setup]').check();await page.click('#profile-read')
  await page.waitForFunction(()=>v2Snapshot?.members.length===0&&!document.querySelector('#controls').disabled)
  assert.equal(await page.locator('#profile-target').inputValue(),'@model')
  assert.match(await page.locator('#profile-preferences-scope').textContent(),/Không thuộc riêng member/)
  assert.equal((await downloadJson('#profile-json')).model_data.steel_design.scope,'model_design_code')
  await page.selectOption('#instance','34567');assert.equal(await page.locator('#profile-json').isDisabled(),true)
  assert.equal(await page.locator('#profile-detail').textContent(),'');assert.equal(await page.locator('#results tr').count(),0)
  assert.deepEqual(errors,[]);assert.deepEqual([...origins],['http://127.0.0.1:8012'])
  console.log('V2 local browser passed: model/PID pinning, snapshots, units/material/sections/nonprismatic,43 overwrites, force/extreme/summary reuse, DLL catalog, bounded tables, JSON, VI/EN, mobile and model-reset isolation.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
