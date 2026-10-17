const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STANDARDS_BASE_URL || 'http://127.0.0.1:5173'

;(async () => {
  const account = JSON.parse(fs.readFileSync(process.env.AUTH_FIXTURES || '/tmp/geek-browser-fixtures.json', 'utf8')).find(a => a.role === 'user')
  if (!account) throw new Error('A private user fixture is required')
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  let csrf
  try {
    csrf = (await (await context.request.get(base + '/api/auth/csrf')).json()).csrf_token
    const login = await context.request.post(base + '/api/auth/login', { headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf }, data: { email: account.email, password: account.password } })
    assert.equal(login.status(), 200, 'Private fixture login failed')
    csrf = (await login.json()).csrf_token
    await page.goto(base + '/?standard=ASCE7-10#/modules/steel/library/standards')
    await page.getByRole('button', { name: 'Source Corpus · Toàn văn / Bảng / Công thức', exact: true }).click()
    await page.locator('.source-summary').filter({ hasText: '658 pages' }).waitFor()
    await page.locator('.source-page img').waitFor()
    assert.ok(await page.locator('.source-page img').evaluate(img => img.complete && img.naturalWidth > 0))
    await page.locator('.source-page input').fill('308')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    await page.locator('.source-page p').filter({ hasText: 'PDF 308' }).waitFor()
    await page.locator('.source-page summary').filter({ hasText: 'OCR text' }).click()
    await page.locator('.source-page pre').filter({ hasText: '27.3-1' }).waitFor()
    await page.locator('.source-filters select').first().selectOption('items')
    await page.locator('.source-filters input').first().fill('27.3-1')
    await page.getByRole('button', { name: 'Tìm / Search', exact: true }).click()
    await page.locator('.source-results article').filter({ hasText: '27.3-1' }).first().waitFor()
    const itemResponse = await context.request.get(base + '/api/v1/standards/ASCE7-10/source-items?kind=equation&q=27.3-1')
    const items = await itemResponse.json(); assert.ok(items.meta.total > 0)
    const docId = items.data[0].document_id
    const source = await context.request.get(`${base}/api/v1/standards/ASCE7-10/documents/${docId}/pages/308`)
    const sourcePage = (await source.json()).data
    assert.equal(sourcePage.pdf_page, 308); assert.ok(sourcePage.numeric_tokens.length > 0)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.locator('.corpus').evaluate(el => el.scrollWidth <= el.clientWidth + 2), 'Corpus must fit mobile viewport')
    assert.deepEqual(errors, [])
    console.log('PASS: private ASCE corpus navigation, page image/OCR, equation search, numeric tokens and mobile layout')
  } finally {
    if (csrf) await context.request.post(base + '/api/auth/logout', { headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf } }).catch(() => {})
    await browser.close()
  }
})().catch(error => { console.error(error.message); process.exit(1) })
