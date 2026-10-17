const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

const adminReview = process.env.STANDARDS_ADMIN_SMOKE === '1'
const base = process.env.STANDARDS_EXPLORER_BASE_URL || 'http://127.0.0.1:5192/'

function makePdf(pageCount = 4) {
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pageCount} >> endobj`,
  ]
  for (let index = 0; index < pageCount; index++) {
    const pageId = 3 + index * 2
    const contentId = pageId + 1
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents ${contentId} 0 R >> endobj`)
    objects.push(`${contentId} 0 obj << /Length 0 >> stream\n\nendstream endobj`)
  }
  let output = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output, 'ascii'))
    output += `${object}\n`
  }
  const xrefOffset = Buffer.byteLength(output, 'ascii')
  output += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`
  output += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(output, 'ascii')
}

const clauses = [
  { id: 1, code: 'A', title: 'General Provisions', parent_id: null, kind: 'normative', pdf_page: 1, printed_page: 1, document_id: 9, verification_status: 'index_only' },
  { id: 2, code: 'B', title: 'Design Requirements', parent_id: null, kind: 'normative', pdf_page: 2, printed_page: 32, document_id: 9, verification_status: 'index_only' },
  { id: 3, code: 'B4', title: 'Member Properties', parent_id: 2, kind: 'normative', pdf_page: 3, printed_page: 33, document_id: 9, summary: 'Section classification and member properties.', source_anchor: 'B4', extraction_method: 'bookmark', verification_status: 'index_only' },
  { id: 5, code: 'E3', title: 'Inelastic Analysis', parent_id: 2, kind: 'normative', pdf_page: 3, printed_page: 33, document_id: 9, verification_status: 'index_only' },
  { id: 4, code: 'Cmt-B4', title: 'Commentary note', parent_id: null, kind: 'commentary', pdf_page: 5, printed_page: 302, document_id: 9, verification_status: 'index_only' },
]
const equations = [
  { id: 10, clause_id: 3, clause_code: 'B4', label: 'B4-1a', document_id: 9, kind: 'normative', pdf_page: 3, printed_page: 33, latex: '\\lambda_r = 0.56\\sqrt{E/F_y}', variables: '[{"symbol":"F_y","definition":"Yield stress","unit":"MPa"}]', conditions: '["Rolled flange under uniform compression"]', design_methods: '["ASD","LRFD"]', verification_status: 'candidate', source_anchor: 'B4.1a case 1', extraction_method: 'text identifier scan' },
  { id: 11, clause_id: 3, clause_code: 'B4', label: 'B4-1b', document_id: 9, kind: 'normative', pdf_page: 3, printed_page: 33, latex: 'b/t_f', variables: { b: { definition: 'Flange width', unit: 'mm' } }, conditions: ['Source expression requires manual review'], verification_status: 'needs_review' },
  { id: 12, clause_id: 5, clause_code: 'E3', label: 'E3-1', document_id: 9, kind: 'normative', pdf_page: 4, printed_page: 33, latex: 'P_n = F_{cr} A_g', variables: [{ symbol: 'P_n', definition: 'Nominal compressive strength' }], verification_status: 'needs_review', source_anchor: 'E3.1', extraction_method: 'reviewed transcription' },
  { id: 13, clause_id: 5, clause_code: 'E3', label: 'E3-4', document_id: 9, kind: 'normative', pdf_page: 4, printed_page: 33, latex: 'F_e=\\frac{\\pi^2E}{(KL/r)^2}', variables: [{ symbol: 'F_e', definition: 'Elastic buckling stress' }], verification_status: 'needs_review', source_anchor: 'E3.4', extraction_method: 'reviewed transcription' },
]
for (const equation of equations) { equation.record_version = 1; equation.source_sha256 = 'a'.repeat(64) }
const reviewRequests = []
const uploadRequests = []
let uploadReply = 'success'
const uploadedDocument = { id: 10, kind: 'combined', original_name: 'uploaded-source.pdf', sha256: 'b'.repeat(64), page_count: null, processing_status: 'pending', verification_status: 'candidate' }
const tableRecords = [{
  id: 30,
  table_code: 'B4.1b',
  title: 'Width-to-Thickness Ratios: Compression Elements — Flexure',
  clause_code: 'B4.1b',
  document_id: 9,
  kind: 'normative',
  pdf_page: 3,
  printed_page_label: '33',
  source_anchor: { source_type: 'table', clause_code: 'B4.1b', table_id: 'B4.1b', pdf_page: 3, printed_page_label: '33' },
  columns: ['case', 'description_of_element', 'width_to_thickness_ratio', 'lambda_p', 'lambda_r', 'examples'],
  rows: [
    { id: 'B4.1b-case-10', label: 'Case 10', case_number: 10, kind: 'normative', pdf_page: 3, printed_page_label: '33', document_id: 9, clause_code: 'B4.1b', source_anchor: { clause_code: 'B4.1b', pdf_page: 3, printed_page_label: '33' }, description: 'Flanges of rolled I-shaped sections, channels, and tees', width_to_thickness_ratio: 'b/t', lambda_p_latex: '0.38\\sqrt{E/F_y}', lambda_r_latex: '1.0\\sqrt{E/F_y}', conditions: ['Flexure; unstiffened element.'], footnote_refs: [], verification_status: 'needs_review' },
    { id: 'B4.1b-case-11', label: 'Case 11', case_number: 11, kind: 'normative', pdf_page: 3, printed_page_label: '33', document_id: 9, clause_code: 'B4.1b', source_anchor: { clause_code: 'B4.1b', pdf_page: 3, printed_page_label: '33' }, description: 'Flanges of built-up I-shaped sections', width_to_thickness_ratio: 'b/t', lambda_p_latex: '0.38\\sqrt{E/F_y}', lambda_r_latex: '0.95\\sqrt{k_cE/F_L}', conditions: ['Flexure; unstiffened element.', 'For the specified symmetric section case, F_L=0.7F_y.'], footnote_refs: ['[a]', '[b]'], verification_status: 'needs_review' },
  ],
  footnotes: [{ marker: '[a]', text: 'Source footnote association requires review.' }],
  coverage_type: 'partial',
  complete_table: false,
  coverage: { included_case_ids: ['B4.1b-case-10', 'B4.1b-case-11'], omitted_case_ids: ['B4.1b-case-12', 'B4.1b-case-14'] },
  source_example_diagrams_included: false,
  applicability: { description: 'Flexural element classification.' },
  source_notes: 'Selected cases only; full table coverage remains under review.',
  verification_status: 'needs_review',
}, {
  id: 31,
  table_code: 'A5.1',
  title: 'General Stability Requirements',
  clause_code: 'A5.1',
  document_id: 9,
  kind: 'normative',
  pdf_page: 40,
  printed_page_label: '70',
  source_anchor: { source_type: 'table', clause_code: 'A5.1', table_id: 'A5.1', pdf_page: 40, printed_page_label: '70' },
  columns: ['case', 'description_of_element', 'lambda_p', 'lambda_r'],
  rows: [],
  verification_status: 'candidate',
}]
const privatePdf = makePdf(5)
let savedNotes = []
const notePosts = []
const requestedPageSizes = []

async function respondJson(route, payload, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
}

async function enforcePageLimit(route, url) {
  const perPage = Number(url.searchParams.get('per_page') || 50)
  requestedPageSizes.push(perPage)
  if (perPage > 100) {
    await respondJson(route, { message: 'The per_page value may not be greater than 100.' }, 422)
    return false
  }
  return true
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  const errors = []
  page.on('console', message => { if (message.type() === 'error') console.error('browser console:', message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('geekcalculus-locale', 'en'))
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    if (path === '/api/auth/me') return respondJson(route, { data: { id: 1, name: 'Standards reader', role: adminReview ? 'admin' : 'user' } })
    if (path === '/api/auth/csrf') return respondJson(route, { csrf_token: 'smoke-token' })
    if (path === '/api/v1/standards' && method === 'GET') return respondJson(route, { data: [
      { id: 1, code: 'AISC360', name: 'AISC 360', publisher: 'AISC', editions: [
        { id: 1, code: 'AISC360-10', year: 2010, title: 'AISC 360-10', status: 'in_development' },
        { id: 2, code: 'AISC360-16', year: 2016, title: 'AISC 360-16', status: 'coming_soon' },
        { id: 3, code: 'AISC360-22', year: 2022, title: 'AISC 360-22', status: 'coming_soon' },
      ] },
    ] })
    if (path === '/api/v1/standards/AISC360-10' && method === 'GET') return respondJson(route, { data: {
      edition: { code: 'AISC360-10', title: 'AISC 360-10', status: 'in_development' },
      clauses: [],
      documents: [{ id: 9, kind: 'specification', original_name: 'private-source.pdf', page_count: 5, processing_status: 'indexed', verification_status: 'needs_review', revision: 'June 22, 2010', sha256: 'a'.repeat(64), imported_at: '2026-10-16T00:00:00Z', import_report: { pages: [
        { pdf_page: 1, printed_page_label: '1', kind: 'front_matter' },
        { pdf_page: 2, printed_page_label: '32', kind: 'normative' },
        { pdf_page: 3, printed_page_label: '33', kind: 'normative' },
        { pdf_page: 4, printed_page_label: '34', kind: 'normative' },
        { pdf_page: 5, printed_page_label: '302', kind: 'commentary' },
      ] } }],
      coverage: { indexed_clauses: 4, verified_equations: 0 },
      upload: { max_bytes: 2048, document_types: ['specification', 'commentary', 'combined', 'errata', 'manual'] },
    } })
    if (path === '/api/v1/standards/AISC360-10/clauses' && method === 'GET') {
      if (!await enforcePageLimit(route, url)) return
      const pageNumber = Number(url.searchParams.get('page') || 1)
      const pageRows = pageNumber === 1 ? clauses.slice(0, 2) : clauses.slice(2)
      return respondJson(route, { data: pageRows, meta: { current_page: pageNumber, per_page: 2, total: clauses.length, last_page: 2 } })
    }
    if (path === '/api/v1/standards/AISC360-10/equations' && method === 'GET') {
      if (!await enforcePageLimit(route, url)) return
      const pageNumber = Number(url.searchParams.get('page') || 1)
      const pageRows = pageNumber === 1 ? equations.slice(0, 1) : equations.slice(1)
      return respondJson(route, { data: pageRows, meta: { current_page: pageNumber, per_page: 1, total: equations.length, last_page: 2 } })
    }
    if ((path === '/api/v1/standards/AISC360-10/parameters' || path === '/api/v1/standards/AISC360-10/tables') && method === 'GET') {
      if (!await enforcePageLimit(route, url)) return
      const data = path.endsWith('/tables') ? tableRecords : []
      return respondJson(route, { data, meta: { current_page: 1, per_page: 100, total: data.length, last_page: 1 } })
    }
    if (path === '/api/v1/admin/standards/AISC360-10/equations/12' && method === 'PATCH') {
      const body = request.postDataJSON(), equation = equations.find(e => e.id === 12)
      assert.equal(body.expected_version, equation.record_version)
      Object.assign(equation, body.data, { record_version: equation.record_version + 1 })
      reviewRequests.push(body)
      return respondJson(route, { data: equation })
    }
    if (path === '/api/v1/admin/standards/AISC360-10/equations/12/review' && method === 'POST') {
      const body = request.postDataJSON(), equation = equations.find(e => e.id === 12)
      assert.equal(body.expected_version, equation.record_version)
      assert.equal(body.source_comparison.compared, true)
      assert.equal(body.source_comparison.pdf_page, 4)
      assert.equal(body.source_comparison.source_sha256, 'a'.repeat(64))
      assert.equal(body.source_comparison.latex_sha256, require('node:crypto').createHash('sha256').update(equation.latex.trim()).digest('hex'))
      equation.verification_status = body.status; equation.record_version++
      reviewRequests.push(body)
      return respondJson(route, { data: equation })
    }
    if (path === '/api/v1/standards/AISC360-10/notes' && method === 'GET') return respondJson(route, { data: savedNotes.filter(note => Number(note.clause_id) === Number(url.searchParams.get('clause_id'))) })
    if (path === '/api/v1/standards/AISC360-10/notes' && method === 'POST') {
      const body = request.postDataJSON()
      notePosts.push(body)
      const note = { id: notePosts.length, ...body, created_at: '2026-10-16T12:00:00Z' }
      savedNotes = [...savedNotes, note]
      return respondJson(route, { data: note }, 201)
    }
    if (path === '/api/v1/standards/AISC360-10/documents' && method === 'POST') {
      assert.match(request.headers()['content-type'], /^multipart\/form-data; boundary=/)
      assert.equal(request.headers()['x-csrf-token'], 'smoke-token')
      const body = request.postDataBuffer().toString()
      assert.match(body, /name="file"; filename="uploaded-source.pdf"/)
      assert.match(body, /name="kind"\r\n\r\ncombined/)
      assert.match(body, /name="revision"\r\n\r\nTest revision/)
      uploadRequests.push(body)
      if (uploadReply === 'validation') return respondJson(route, { message: 'Invalid source.', errors: { file: ['Synthetic server validation error.'] } }, 422)
      if (uploadReply === 'duplicate') return respondJson(route, { message: 'This source document is already registered.', data: uploadedDocument }, 409)
      return respondJson(route, { data: uploadedDocument }, 201)
    }
    if (/\/documents\/(9|10)\/file$/.test(path)) return route.fulfill({ status: 200, contentType: 'application/pdf', body: privatePdf })
    return respondJson(route, { message: `Unhandled smoke API route: ${method} ${path}` }, 404)
  })

  try {
    await page.goto(`${base}?standard=AISC360-10#/modules/steel/library/standards`)
    await page.getByRole('heading', { name: /Standards Explorer/ }).waitFor()
    const expandB = page.getByRole('button', { name: 'Collapse B' })
    await expandB.click()
    await page.getByText('Member Properties', { exact: true }).waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Expand B' }).click()
    const memberClause = page.getByRole('button', { name: /B4 Member Properties/ })
    await memberClause.waitFor()
    await memberClause.click()
    await page.getByRole('heading', { name: /B4 Member Properties/ }).waitFor()
    await page.getByText('B4-1a', { exact: true }).waitFor()
    await page.getByText('Candidate', { exact: true }).waitFor()
    await page.locator('.std-equation .katex-display').first().waitFor()
    assert.match(await page.locator('.std-equation').first().innerText(), /Yield stress/)
    assert.match(await page.locator('.std-equation').first().innerText(), /Rolled flange under uniform compression/)

    const filter = page.getByLabel('Filter document section')
    await filter.selectOption('commentary')
    await page.getByRole('button', { name: /Cmt-B4 Commentary note/ }).waitFor()
    assert.equal(await page.getByRole('button', { name: /B4 Member Properties/ }).count(), 0)
    await filter.selectOption('all')
    await page.getByPlaceholder('Search clause number or title…').fill('B4')
    await page.getByRole('button', { name: /B4 Member Properties/ }).waitFor()
    await page.getByPlaceholder('Search clause number or title…').fill('')

    await page.getByRole('tab', { name: 'Tables' }).click()
    const table = page.locator('.std-table-card').filter({ hasText: 'B4.1b' })
    await table.waitFor()
    assert.equal(await table.locator('tbody tr').count(), 4, 'partial table should render two data rows and their source conditions')
    assert.match(await table.innerText(), /B4\.1b-case-12/)
    assert.match(await table.innerText(), /Source footnote association requires review/)
    assert.match(await table.innerText(), /Source examples and diagrams are not included/)
    assert.ok(await table.locator('.std-table-math .katex').count() > 0, 'table threshold formulas should render as KaTeX math')
    const emptyTable = page.locator('.std-table-card').filter({ hasText: 'A5.1' })
    await emptyTable.waitFor()
    assert.equal(await emptyTable.locator('table').count(), 0, 'table candidates without rows should show source metadata only')
    await emptyTable.getByRole('button', { name: 'Open source A5.1' }).waitFor()
    await table.getByRole('button', { name: 'Open source Case 10' }).click()
    assert.match(await page.locator('.std-pdf-toolbar').innerText(), /PDF page 3 of 5/)
    assert.match(await page.locator('.std-pdf-toolbar').innerText(), /Printed page 33/)

    await page.getByRole('tab', { name: 'Document outline' }).click()

    const e3Clause = page.getByRole('button', { name: /E3 Inelastic Analysis/ })
    await e3Clause.waitFor()
    assert.match(await e3Clause.innerText(), /PDF p\. 3 · Printed page 33/)
    await e3Clause.click()
    await page.getByRole('heading', { name: /E3 Inelastic Analysis/ }).waitFor()
    await page.getByText('E3-1', { exact: true }).waitFor()
    const e3Equation = page.locator('.std-equation').filter({ hasText: 'E3-4' })
    await e3Equation.waitFor()
    assert.ok(await e3Equation.locator('.katex .mfrac').count() > 0, 'E3-4 must render its fraction as KaTeX math')
    assert.match(await page.locator('.std-equation-source').filter({ hasText: 'E3-1' }).innerText(), /PDF p\. 4 · Printed page 34/)
    await page.getByRole('button', { name: /Open source E3-1/ }).click()
    await page.locator('.std-pdf-controls input').waitFor()
    try {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.std-pdf-canvas')
        return canvas && canvas.width > 0 && canvas.height > 0
      }, null, { timeout: 10000 })
    } catch (error) {
      console.error('PDF viewer state:', await page.locator('.std-pdf-viewer').innerText())
      console.error('Browser errors:', errors)
      throw error
    }
    assert.equal(await page.locator('.std-pdf-controls input').inputValue(), '4')
    assert.match(await page.locator('.std-pdf-toolbar').innerText(), /PDF page 4 of 5/)
    assert.match(await page.locator('.std-pdf-toolbar').innerText(), /Printed page 34/)

    await page.locator('.std-pdf-controls input').fill('5')
    await page.locator('.std-pdf-controls input').press('Tab')
    await page.locator('.std-source-section > header span').filter({ hasText: 'Cmt-B4' }).waitFor()
    assert.equal(await page.locator('.std-pdf-controls input').inputValue(), '5')
    assert.match(await page.locator('.std-pdf-toolbar').innerText(), /Printed page 302/)
    assert.equal(await page.getByRole('button', { name: /Cmt-B4 Commentary note/ }).getAttribute('aria-current'), 'location')

    await page.getByPlaceholder('Add a private note to this clause…').fill('Check the source anchor against the printed copy.')
    await page.getByRole('button', { name: 'Save note' }).click()
    await page.getByText('Check the source anchor against the printed copy.', { exact: true }).waitFor()
    assert.deepEqual(notePosts, [{ clause_id: 4, body: 'Check the source anchor against the printed copy.' }])

    if (adminReview) {
      await page.getByRole('tab', { name: 'Equation library' }).click()
      await page.locator('.std-equation').filter({ hasText: 'E3-1' }).getByRole('button', { name: 'Edit / Review source' }).click()
      const editor = page.locator('.formula-review')
      await editor.waitFor()
      assert.match(await editor.getByRole('link').getAttribute('href'), /documents\/9\/file#page=4$/)
      assert.equal(await editor.getByRole('button', { name: 'Verify against source' }).isDisabled(), true)
      await editor.getByLabel('LaTeX', { exact: true }).fill('P_n=F_{cr}A_g')
      await editor.getByLabel('Review reason / evidence').fill('Synthetic UI transcription test; not an authoritative source approval.')
      await editor.getByRole('button', { name: 'Save draft' }).click()
      await page.waitForFunction(() => document.querySelector('.formula-review h3')?.textContent.includes('v2'))
      await editor.getByLabel('Review reason / evidence').fill('Synthetic UI comparison test; not an authoritative source approval.')
      await editor.getByRole('checkbox').check()
      await editor.getByRole('button', { name: 'Verify against source' }).click()
      await page.waitForFunction(() => document.querySelector('.formula-review h3')?.textContent.includes('v3'))
      assert.equal(reviewRequests.length, 2)
      assert.equal(await editor.getByRole('button', { name: 'Publish', exact: true }).isDisabled(), true, 'a transition clears the prior comparison confirmation')
      await editor.getByRole('button', { name: 'Close', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Hide Review' }).click()
    await page.getByRole('heading', { name: 'Source & review' }).waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Show Review' }).click()
    await page.getByRole('heading', { name: 'Source & review' }).waitFor()
    await page.getByText('a'.repeat(64), { exact: true }).waitFor()

    assert.equal(await page.locator('input[type="file"]').count(), adminReview ? 1 : 0, 'only the native administrator can see private PDF upload controls')
    assert.equal(await page.getByRole('button', { name: 'AISC 360-16' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'AISC 360-22' }).isDisabled(), true)
    assert.ok(requestedPageSizes.length >= 6, `Expected paginated clauses, equations, parameters, and tables; got ${requestedPageSizes.length} requests`)
    assert.ok(requestedPageSizes.every(size => size === 100), `Expected each pagination request to use per_page=100; got ${requestedPageSizes.join(', ')}`)
    if (adminReview) {
      const uploader = page.locator('.std-source-upload')
      await uploader.locator('summary').click()
      const file = uploader.locator('input[type=file]')
      const submit = uploader.getByRole('button', { name: 'Save private PDF' })
      await file.setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a real PDF') })
      await submit.click()
      await uploader.getByRole('alert').filter({ hasText: 'valid PDF signature' }).waitFor()
      assert.equal(uploadRequests.length, 0, 'invalid file must not leave the browser')
      await file.setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2049) })
      await submit.click()
      await uploader.getByRole('alert').filter({ hasText: 'exceeds the server limit' }).waitFor()
      assert.equal(uploadRequests.length, 0)
      await uploader.getByLabel('Document type').selectOption('combined')
      await uploader.getByLabel('Publisher revision (optional)').fill('Test revision')
      const payload = { name: 'uploaded-source.pdf', mimeType: 'application/pdf', buffer: privatePdf }
      await file.setInputFiles(payload)
      uploadReply = 'validation'
      await submit.click()
      await uploader.getByRole('alert').filter({ hasText: 'Synthetic server validation error.' }).waitFor()
      uploadReply = 'success'
      await submit.click()
      await uploader.getByRole('status').filter({ hasText: 'Private PDF saved' }).waitFor()
      const picker = page.locator('.std-document-picker select')
      assert.equal(await picker.inputValue(), '10')
      await page.waitForFunction(() => document.querySelector('.std-pdf-canvas')?.width > 0)
      assert.equal(await page.locator('.std-source-section > header span').count(), 0, 'new unindexed source must not inherit an old clause')
      await page.locator('.std-pdf-controls input').fill('4')
      await page.locator('.std-pdf-controls input').press('Tab')
      assert.equal(await picker.inputValue(), '10')
      assert.equal(await page.locator('.std-source-section > header span').count(), 0, 'paging the new artifact must not select a clause from document 9')
      await page.getByText('PDF saved; edition inspection and indexing are pending. Existing equation labels are not mapped to this document.', { exact: true }).waitFor()
      uploadReply = 'duplicate'
      await file.setInputFiles(payload)
      await submit.click()
      await uploader.getByRole('status').filter({ hasText: 'already registered' }).waitFor()
      assert.equal(await picker.locator('option[value="10"]').count(), 1, 'duplicate source must not create another option')
      assert.equal(uploadRequests.length, 3)
      await picker.selectOption('9')
      assert.equal(await picker.inputValue(), '9')
      await page.setViewportSize({ width: 390, height: 844 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'upload controls must fit on mobile')
    }
    assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`)
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
