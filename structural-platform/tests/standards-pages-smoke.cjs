const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STANDARDS_BASE_URL || 'http://127.0.0.1:5174/GeekCalculus/'
;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = [], failedApi = []
  page.on('pageerror', e => errors.push(e.message))
  context.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) failedApi.push(response.status()) })
  try {
    await context.addInitScript(() => {
      if (!['http:', 'https:'].includes(location.protocol)) return
      // Chromium's isolated PDF viewer frames do not expose normal web storage.
      try { window.localStorage?.setItem('geekcalculus-locale', 'en') } catch {}
    })
    await page.goto(base)
    await page.locator('input[name="email"]').fill('user@demo.geekcalculus.test')
    await page.locator('input[name="password"]').fill('demo')
    await page.locator('.login-form button[type="submit"]').click()
    await page.getByRole('heading', { name: 'GeekCalculus', exact: true }).waitFor()
    await page.goto(base + '#/modules/steel/library')
    await page.locator('.std-nav summary').click()
    const link = page.locator('.std-nav-links a').filter({ hasText: 'ASCE 7-10' })
    assert.ok((await link.getAttribute('href')).includes('?standard=ASCE7-10'))
    const pending = context.waitForEvent('page'); await link.click(); const standards = await pending
    standards.on('pageerror', e => errors.push(e.message))
    await standards.locator('.std-context').filter({ hasText: '875 indexed clauses' }).waitFor()
    assert.ok(await standards.locator('.std-outline').textContent().then(t => t.includes('WIND LOADS')))
    assert.equal(await standards.getByRole('tab', { name: 'Equation library', exact: true }).count(), 0)
    assert.equal(await standards.locator('.std-kernel').count(), 0)
    await standards.getByPlaceholder('Search clause number or title…').fill('27.3.2')
    const clause = standards.locator('.std-clause').filter({ has: standards.locator('strong').filter({ hasText: /^27\.3\.2$/ }) })
    await clause.click()
    const sourcePage = (await clause.locator('small').textContent()).match(/PDF p\. (\d+)/)[1]
    assert.ok((await standards.locator('.std-pdf-open').getAttribute('href')).endsWith('standards/asce7-10.pdf#page=' + sourcePage))
    assert.ok((await standards.locator('.std-pdf-open').getAttribute('href')).endsWith('#page=' + sourcePage))
    await standards.getByRole('tab', { name: 'PDF source', exact: true }).click()
    const pdf = await context.request.get(base + 'standards/asce7-10.pdf')
    assert.equal(pdf.status(), 200); assert.equal(crypto.createHash('sha256').update(await pdf.body()).digest('hex'), 'ae2997f7a31975965b33065ba54acbf4da441f4f821b2a97372d67c2bd1ca248')
    await standards.reload()
    await standards.locator('.std-context').filter({ hasText: '875 indexed clauses' }).waitFor()
    if (process.env.STANDARDS_SCREENSHOT) await standards.screenshot({ path: process.env.STANDARDS_SCREENSHOT, fullPage: true })
    await standards.setViewportSize({ width: 390, height: 844 })
    assert.ok(await standards.locator('.standards-panel').evaluate(el => el.scrollWidth <= el.clientWidth + 2), 'Standards fits mobile width')
    assert.deepEqual(errors, []); assert.deepEqual(failedApi, [])
    console.log('PASS: GitHub Pages build, Steel Library ASCE link, 875 clauses, PDF-only reader, outline/page link, exact PDF bytes, reload and mobile')
  } finally { await browser.close() }
})().catch(e => { console.error(e.message); process.exit(1) })
