// Private PDF fixtures stay outside Git. Native mode requires a disposable server/database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright')
const { signIn } = require('./browser-auth.cjs')
const demo = process.env.TEST_DEMO !== '0'
const base = process.env.NOTES_BASE_URL || 'http://127.0.0.1:8821/GeekCalculus/'
const fixtures = JSON.parse(fs.readFileSync(process.env.PDF_NOTE_FIXTURES, 'utf8'))
const route = `${base}#/modules/loads/library/notes`
const sha = value => crypto.createHash('sha256').update(value).digest('hex')

;(async () => {
  assert.equal(fixtures.length, 2)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'geek-pdf-notes-test-'))
  const launch = () => chromium.launchPersistentContext(profile, { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'], viewport: { width: 1440, height: 1080 }, acceptDownloads: true })
  let context = await launch()
  const errors = []
  let page = context.pages()[0]
  const observe = () => page.on('pageerror', error => errors.push(error.message))
  const card = title => page.locator('.pdf-note-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  try {
    observe()
    await page.goto(base)
    await signIn(page, { demo, role: 'user' })
    await page.goto(`${base}#/modules/loads/library`)
    await page.locator('.personal-notes-entry').click()
    await page.locator('.personal-pdf-notes').waitFor()
    await page.locator('.module-topbar .language-switch').getByRole('button', { name: 'EN', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('.notes-form fieldset').disabled)
    assert.match(await page.locator('.notes-storage').innerText(), demo ? /this browser/ : /privately.*server/)
    assert.equal(await page.locator('.module-navigation a[aria-current="page"]').innerText(), 'Library')
    assert.equal(await page.locator('.pdf-note-card').count(), 0)
    for (const fixture of fixtures) {
      await page.locator('[data-notes="file"]').setInputFiles(fixture.path)
      await page.locator('[data-notes="title"]').fill(fixture.title)
      await page.locator('[data-notes="description"]').fill('Personal PDF reading note')
      await page.locator('[data-notes="save"]').click()
      await card(fixture.title).waitFor()
    }
    assert.equal(await page.locator('.pdf-note-card').count(), 2)
    for (const fixture of fixtures) {
      await card(fixture.title).locator('[data-note-action="read"]').click()
      await page.waitForFunction(pages => document.querySelector('.std-pdf-controls')?.textContent.includes(`of ${pages}`), fixture.pages)
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.std-pdf-canvas')
        if (!canvas?.width || !canvas.height) return false
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        for (let i = 0; i < pixels.length; i += 400) if (pixels[i] < 180 && pixels[i + 3] === 255) return true
        return false
      })
      await page.getByRole('button', { name: 'Next page', exact: true }).click()
      assert.equal(await page.locator('.std-pdf-controls input').inputValue(), '2')
      const downloadEvent = page.waitForEvent('download')
      await card(fixture.title).locator('[data-note-action="download"]').click()
      const download = await downloadEvent
      assert.equal(download.suggestedFilename(), path.basename(fixture.path))
      assert.equal(sha(fs.readFileSync(await download.path())), sha(fs.readFileSync(fixture.path)))
    }
    await page.screenshot({ path: `/tmp/personal-pdf-notes-${demo ? 'demo' : 'native'}-desktop.png`, fullPage: true, animations: 'disabled' })
    await card(fixtures[0].title).locator('[data-note-action="edit"]').click()
    await page.locator('[data-notes="title"]').fill('Updated wind reading note')
    await page.locator('[data-notes="save"]').click()
    await card('Updated wind reading note').waitFor()
    await page.locator('[data-notes="search"]').fill('Updated wind')
    assert.equal(await page.locator('.pdf-note-card').count(), 1)
    await page.locator('[data-notes="search"]').fill('')
    await page.reload()
    await card('Updated wind reading note').waitFor()
    assert.equal(await page.locator('.pdf-note-card').count(), 2)

    if (!demo) {
      const rows = (await (await context.request.get(new URL('/api/v1/personal-pdf-notes', base).href)).json()).data
      const response = await context.request.get(new URL(rows[0].file_url, base).href)
      assert.equal(response.status(), 200)
      assert.match(response.headers()['cache-control'], /private/)
      assert.match(response.headers()['cache-control'], /no-store/)
      const rejected = await context.request.patch(new URL(`/api/v1/personal-pdf-notes/${rows[0].id}`, base).href, { data: { title: 'No CSRF' } })
      assert.equal(rejected.status(), 419)
      if (process.env.NOTES_RESTART_CONTAINER) {
        execFileSync('docker', ['restart', process.env.NOTES_RESTART_CONTAINER], { stdio: 'ignore' })
        await page.reload()
        await card('Updated wind reading note').waitFor()
        assert.equal(await page.locator('.pdf-note-card').count(), 2)
        await card('Updated wind reading note').locator('[data-note-action="read"]').click()
        await page.waitForFunction(pages => document.querySelector('.std-pdf-controls')?.textContent.includes(`of ${pages}`), fixtures[0].pages)
      }
    } else {
      // A real browser restart, using the same disposable profile: not just a component remount.
      await context.close()
      context = await launch(); page = context.pages()[0]; observe()
      await page.goto(route)
      await card('Updated wind reading note').waitFor()
      assert.equal(await page.locator('.pdf-note-card').count(), 2)
      await card('Updated wind reading note').locator('[data-note-action="read"]').click()
      await page.waitForFunction(pages => document.querySelector('.std-pdf-controls')?.textContent.includes(`of ${pages}`), fixtures[0].pages)
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await signIn(page, { demo: true, role: 'admin' })
      await page.goto(route)
      await page.locator('.personal-pdf-notes').waitFor()
      await page.waitForFunction(() => !document.querySelector('.notes-form fieldset').disabled)
      assert.equal(await page.locator('.pdf-note-card').count(), 0, 'Other demo account has a separate shelf')
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.goto(base)
      await signIn(page, { demo: true, role: 'user' })
      await page.goto(route)
      await card('Updated wind reading note').waitFor()
    }
    await card(fixtures[1].title).locator('[data-note-action="read"]').click()
    await page.locator('.module-topbar .language-switch').getByRole('button', { name: 'VI', exact: true }).click()
    await page.getByRole('button', { name: 'Trang sau', exact: true }).waitFor()
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 880 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `PDF notes overflow ${width}`)
    }
    await page.screenshot({ path: `/tmp/personal-pdf-notes-${demo ? 'demo' : 'native'}-mobile.png`, fullPage: true, animations: 'disabled' })
    page.once('dialog', dialog => dialog.dismiss())
    await card(fixtures[1].title).locator('[data-note-action="delete"]').click()
    assert.equal(await page.locator('.pdf-note-card').count(), 2)
    page.once('dialog', dialog => dialog.accept())
    await card(fixtures[1].title).locator('[data-note-action="delete"]').click()
    await page.waitForFunction(() => document.querySelectorAll('.pdf-note-card').length === 1)
    assert.equal(await page.locator('.notes-reader').count(), 0)
    await page.locator('.notes-back').click()
    await page.locator('.loading-library').waitFor()
    assert.deepEqual(errors, [])
    console.log(`PASS ${demo ? 'demo/IndexedDB restart and account isolation' : 'native/server restart and real CSRF'}: two private PDFs, page counts/rendering/navigation, byte-identical originals, edit/search/reload/delete, VI/EN and mobile`)
  } finally {
    await context.close()
    fs.rmSync(profile, { recursive: true, force: true })
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
