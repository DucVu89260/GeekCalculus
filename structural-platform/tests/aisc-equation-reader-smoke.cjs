// UI contract test with synthetic API/PDF fixtures; backend authorization is tested separately.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STANDARDS_BASE_URL || 'http://127.0.0.1:8773/'
;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--no-proxy-server'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const editions = [{ id: 1, code: 'AISC360-10', title: 'AISC 360-10' }, { id: 2, code: 'AISC360-16', title: 'AISC 360-16' }]
    const docs = [{ id: 11, kind: 'specification' }, { id: 12, kind: 'specification' }]
    const equations = [
      { id: 1, label: 'E3-1', clause_code: 'E3', document_id: 12, pdf_page: 95, verification_status: 'candidate' },
      { id: 2, label: 'B3-1', clause_code: 'B3', document_id: 11, pdf_page: 67, verification_status: 'candidate' },
      { id: 3, label: 'F2-1', clause_code: 'F2', latex: 'stored expression', document_id: 12, pdf_page: 101, verification_status: 'verified' },
      { id: 4, label: 'UNMAPPED', clause_code: 'U', pdf_page: null, verification_status: 'candidate' },
    ]
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/file')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n% synthetic browser fixture\n%%EOF' })
      let data
      if (path === '/api/auth/me') data = { id: 1, name: 'Reader fixture', role: 'user' }
      else if (path === '/api/v1/standards') data = [{ id: 1, code: 'AISC360', name: 'AISC 360', editions }]
      else if (path.endsWith('/equations')) data = equations
      else data = { edition: editions[0], documents: docs, clauses: [{ id: 1, code: 'E3', title: 'Compression', kind: 'normative', document_id: 12, pdf_page: 95 }] }
      await route.fulfill({ json: { data } })
    })
    await page.goto(base + '?standard=AISC360-10#/modules/steel/library/standards')
    await page.getByRole('button', { name: 'Equation Library', exact: true }).click()
    const row = label => page.locator('.std-equation').filter({ has: page.getByRole('button', { name: label, exact: true }) })
    assert.equal(await row('E3-1').locator('code').textContent(), 'Pn = Fcr Ag')
    assert.ok((await row('E3-1').textContent()).includes('candidate'))
    assert.equal(await row('F2-1').locator('code').textContent(), 'stored expression')
    await row('E3-1').locator('button').click()
    await page.waitForFunction(() => document.querySelector('.std-source-selection').getBoundingClientRect().top < 300)
    assert.ok((await page.locator('.std-pdf').getAttribute('src')).endsWith('/documents/12/file#page=95'))
    assert.ok((await page.locator('.std-source-selection a').getAttribute('href')).endsWith('#page=95'))
    await row('B3-1').locator('button').click()
    assert.ok((await page.locator('.std-pdf').getAttribute('src')).endsWith('/documents/11/file#page=67'))
    await row('UNMAPPED').locator('button').click()
    assert.equal(await page.locator('.std-pdf').count(), 0, 'ambiguous document must not be guessed')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.locator('.standards-panel').evaluate(el => el.scrollWidth <= el.clientWidth + 2))
    await page.getByRole('button', { name: 'AISC 360-16', exact: true }).click()
    await page.getByRole('button', { name: 'Equation Library', exact: true }).click()
    assert.ok(!(await row('E3-1').textContent()).includes('Pn = Fcr Ag'), 'do not borrow expressions across editions')
    assert.deepEqual(errors, [])
    console.log('PASS: AISC reference/status, stored math precedence, selected source artifact/page, visible source jump, unmapped state, mobile and edition isolation (synthetic UI fixtures)')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
