// Requires an isolated backend, private AUTH_FIXTURES, and the source SHA-256.
// The licensed source PDF is never embedded in the test or committed.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright')
const { signIn } = require('./browser-auth.cjs')
const base = process.env.STANDARDS_PRIVATE_BASE_URL || 'http://127.0.0.1:5186/'
const sourceHash = process.env.STANDARDS_SOURCE_SHA256
assert.match(sourceHash || '', /^[a-f0-9]{64}$/)

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'], headless: true })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)))
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => {
    if (['http:', 'https:'].includes(location.protocol)) localStorage.setItem('geekcalculus-locale', 'en')
  })
  try {
    await page.goto(base)
    await signIn(page, { demo: false, role: 'user' })
    await page.goto(new URL('#/modules/steel/library', base).href)
    await page.locator('.std-nav summary').click()
    const link = page.locator('.std-nav a').filter({ hasText: 'AISC 360-10' })
    assert.equal(await link.getAttribute('target'), '_blank')
    const opened = context.waitForEvent('page')
    await link.click()
    const reader = await opened
    await reader.locator('.std-three').waitFor()
    assert.equal(await reader.locator('input[type=file]').count(), 0)
    try {
      await reader.waitForFunction(() => document.querySelector('.std-pdf-viewer canvas')?.width > 0)
    } catch (error) {
      console.error('Private PDF state:', await reader.locator('.std-source-section').innerText())
      throw error
    }
    const api = path => reader.request.get(new URL('/api/v1/standards/AISC360-10' + path, base).href)
    const detail = await (await api('')).json()
    assert.ok(detail.data.clauses.length >= 700)
    const doc = detail.data.documents.find(item => item.sha256 === sourceHash)
    assert.ok(doc)
    assert.equal(doc.page_count, 612)
    const file = await api(`/documents/${doc.id}/file`)
    assert.equal(file.status(), 200)
    assert.match(file.headers()['content-type'], /application\/pdf/)
    assert.match(file.headers()['cache-control'], /private/)
    assert.equal(crypto.createHash('sha256').update(await file.body()).digest('hex'), sourceHash)
    const anonymous = await browser.newContext()
    assert.equal((await anonymous.request.get(new URL(`/api/v1/standards/AISC360-10/documents/${doc.id}/file`, base).href)).status(), 401)
    await anonymous.close()
    const rules = await api('/rules?implementation_key=E3-1&method=LRFD')
    assert.equal(rules.status(), 200)
    assert.deepEqual((await rules.json()).data, [])
    const search = reader.locator('.std-toc-search input')
    async function selectClause(code) {
      await search.fill(code)
      await reader.locator('.std-clause').filter({ has: reader.locator('strong', { hasText: new RegExp('^' + code + '$') }) }).click()
    }
    await selectClause('E3')
    await reader.waitForFunction(() => document.querySelector('.std-pdf-controls input')?.value === '89')
    await reader.locator('.std-equation .katex').first().waitFor()
    await reader.locator('.std-equation .katex .mfrac').first().waitFor()
    assert.ok(await reader.locator('.std-equation').count() >= 4)
    assert.equal(await reader.locator('.std-equation-approved').count(), 0)
    const e3Record = reader.locator('.std-equation').filter({ hasText: 'E3-1' }).first()
    assert.match(await e3Record.innerText(), /ASD · LRFD/)
    if (process.env.STANDARDS_SCREENSHOT_PATH) await reader.screenshot({ path: process.env.STANDARDS_SCREENSHOT_PATH })
    await reader.getByRole('button', { name: 'Hide Review', exact: true }).click()
    assert.equal(await reader.locator('.std-review').count(), 0)
    await reader.getByRole('button', { name: 'Show Review', exact: true }).click()
    await reader.locator('.std-review').waitFor()
    await selectClause('F4')
    await reader.locator('.std-equation-source').filter({ hasText: 'F4-11' }).click()
    await reader.waitForFunction(() => document.querySelector('.std-pdf-controls input')?.value === '108')
    await reader.locator('.std-pdf-printed').filter({ hasText: '16.1-52' }).waitFor()
    for (const [name, minimum] of [['Parameters', 9], ['Tables', 2]]) {
      await reader.getByRole('tab', { name, exact: true }).click()
      const cards = reader.locator(name === 'Tables' ? '.std-table-card' : '.std-registry-record')
      await cards.first().waitFor()
      assert.ok(await cards.count() >= minimum)
    }
    for (const width of [390, 320]) {
      await reader.setViewportSize({ width, height: 844 })
      assert.ok(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Reader overflows ${width}px`)
    }
    assert.deepEqual(errors, [])
    console.log('PASS: native PostgreSQL explorer; actual PDF/hash, E3 math, F4-11 source/printed page, private PDF denial, no draft execution, readonly UI, mobile.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
