// Native UI contract fixtures; real import/access is covered by ImportAsce710PdfTest.
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const index = require('../standards/asce7-10-library.json')
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--no-proxy-server'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], unexpected = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()).pathname
      if (url.endsWith('/file')) return route.fulfill({ contentType:'application/pdf', body:fs.readFileSync(path.join(__dirname,'../frontend/vue/public/standards/asce7-10.pdf')) })
      let data
      if (url === '/api/auth/me') data = { id:1, name:'Reader fixture', role:'user' }
      else if (url === '/api/v1/standards') data = [{id:1,code:'ASCE7',name:'ASCE 7',editions:[{id:1,code:'ASCE7-10',title:'ASCE 7-10'}]}]
      else if (url === '/api/v1/standards/ASCE7-10') data = {
        clauses:index.clauses.map(row => ({...row,document_id:42})),
        documents:[{id:42,kind:'specification',sha256:index.source_sha256,page_count:658}],
        library:{source_sha256:index.source_sha256},
      }
      else { unexpected.push(url); return route.fulfill({status:404,json:{message:'Unexpected API request'}}) }
      await route.fulfill({json:{data}})
    })
    await page.goto((process.env.STANDARDS_BASE_URL || 'http://127.0.0.1:8775/')+'?standard=ASCE7-10#/modules/steel/library/standards')
    await page.locator('.std-context').filter({hasText:'875 indexed clauses'}).waitFor()
    assert.equal(await page.locator('.std-reader-tabs button').count(),2)
    assert.equal(await page.locator('.std-equation,.std-kernel').count(),0)
    await page.getByPlaceholder('Search clauses or equations…').fill('27.3.2')
    const clause = page.locator('.std-clause').filter({has:page.locator('b').filter({hasText:/^27\.3\.2$/})})
    await clause.click()
    const sourcePage = index.clauses.find(row=>row.code==='27.3.2' && row.kind==='normative').pdf_page
    assert.ok((await page.locator('.std-pdf').getAttribute('src')).endsWith('/documents/42/file#page='+sourcePage))
    await page.getByRole('button',{name:'PDF Source',exact:true}).click()
    assert.ok((await page.locator('.std-source-selection a').first().getAttribute('href')).endsWith('#page='+sourcePage))
    await page.setViewportSize({width:390,height:844})
    assert.ok(await page.locator('.standards-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+2))
    assert.deepEqual(unexpected,[], 'no equation or corpus fetch needed')
    assert.deepEqual(errors,[])
    console.log('PASS: native ASCE PDF/outline reader, 875 clauses, exact private PDF page, two tabs, no equation/corpus requests, mobile (API fixtures)')
  } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exit(1)})
