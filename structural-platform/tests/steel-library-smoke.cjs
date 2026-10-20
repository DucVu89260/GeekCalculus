const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright')
const { signIn } = require('./browser-auth.cjs')
const base = process.env.STEEL_LIBRARY_BASE_URL || 'http://127.0.0.1:8821/GeekCalculus/'

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
    const page = await context.newPage()
    const errors = []
    context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)))
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base)
    await signIn(page, { demo: true, role: 'user' })
    await page.goto(`${base}#/modules/steel/library`)
    await page.locator('.steel-library-menu').waitFor()
    await page.locator('.module-topbar .language-switch').getByRole('button', { name: 'EN', exact: true }).click()
    const category = code => page.locator(`[data-library-category="${code}"]`)
    assert.deepEqual(await page.locator('.steel-library-menu button').allTextContents(), ['Material', 'Section types', 'Sections', 'Design standard'])
    assert.equal(await page.locator('.library-browser, .design-standards-library').count(), 0, 'No content mounted before choosing a category')
    await page.screenshot({ path: '/tmp/steel-library-menu.png', fullPage: true })

    await category('materials').click()
    await page.locator('.library-table tbody tr').first().waitFor()
    assert.match(await page.locator('.library-table').innerText(), /S235/)
    assert.equal(await page.locator('.library-tabs, .std-nav, .design-standards-library, .library-add-button, .library-transfer').count(), 0)
    await page.locator('.library-search input').fill('S235')
    assert.equal(await page.locator('.library-table tbody tr').count(), 1)

    await category('section_types').click()
    await page.locator('.library-table thead').getByRole('columnheader', { name: 'Region type', exact: true }).waitFor()
    assert.equal(await page.locator('.library-search input').inputValue(), '')
    assert.equal(await page.locator('.design-standards-library').count(), 0)
    await category('sections').click()
    await page.getByText('Read only', { exact: true }).waitFor()
    await page.waitForFunction(() => !document.querySelector('.library-empty[role="status"]'))
    assert.equal(await page.locator('.library-add-button, .library-transfer').count(), 0)
    assert.equal(await category('sections').getAttribute('aria-pressed'), 'true')

    await category('standards').click()
    await page.locator('[data-edition="AISC360-10"]').waitFor()
    assert.equal(await page.locator('.library-browser, .library-table, .library-filters').count(), 0, 'Catalog unmounted while standards are shown')
    assert.deepEqual(await page.locator('.standard-family > h2').allTextContents(), ['AISC 360', 'ASCE 7', 'MBMA'])
    assert.equal(await page.locator('.standard-edition-card').count(), 9)
    assert.equal(await page.locator('a.standard-edition-card').count(), 2)
    for (const family of ['AISC360', 'ASCE7']) {
      for (const year of ['10', '16', '22']) {
        const card = page.locator(`[data-edition="${family}-${year}"]`)
        assert.equal(await card.count(), 1)
        if (year === '10') {
          const href = await card.getAttribute('href')
          assert.match(href, new RegExp(`standard=${family}-${year}`))
          assert.ok(href.endsWith('#/modules/steel/library/standards'))
          assert.equal(await card.getAttribute('rel'), 'noopener noreferrer')
          assert.match(await card.innerText(), /In development/)
        } else {
          assert.equal(await card.getAttribute('href'), null)
          assert.match(await card.innerText(), /Coming soon/)
        }
      }
    }
    assert.deepEqual(await page.locator('[data-mbma-reference]').evaluateAll(cards => cards.map(card => card.dataset.mbmaReference)), ['ASCE 7-10', 'ASCE 7-16', 'ASCE 7-22'])
    assert.equal(await page.locator('[data-mbma-reference] a, [data-mbma-reference] button').count(), 0)
    await page.locator('[data-edition="AISC360-10"]').hover()
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-edition="AISC360-10"] h3')).color === 'rgb(255, 255, 255)')
    await category('standards').hover()
    await page.screenshot({ path: '/tmp/steel-library-standards-desktop.png', fullPage: true })

    // Real edition links preserve the selected edition and existing reader in a new tab.
    for (const code of ['AISC360-10', 'ASCE7-10']) {
      const opened = context.waitForEvent('page')
      await page.locator(`[data-edition="${code}"]`).click()
      const tab = await opened
      await tab.locator('.standards-header h2').filter({ hasText: code.replace('AISC360', 'AISC 360').replace('ASCE7', 'ASCE 7') }).waitFor()
      assert.equal(await tab.evaluate(() => window.opener), null)
      await tab.close()
    }

    await page.locator('.module-topbar .language-switch').getByRole('button', { name: 'VI', exact: true }).click()
    assert.equal(await category('standards').innerText(), 'Tiêu chuẩn thiết kế')
    assert.match(await page.locator('[data-mbma-reference]').first().innerText(), /Đang phát triển/)
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 880 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `standards overflow ${width}`)
    }
    await page.screenshot({ path: '/tmp/steel-library-standards-mobile.png', fullPage: true })
    await category('materials').click()
    await page.locator('.library-table tbody tr').first().waitFor()
    assert.equal(await page.locator('.standard-family').count(), 0)
    await page.reload()
    await page.locator('.steel-library-menu').waitFor()
    assert.equal(await page.locator('.library-browser, .design-standards-library').count(), 0)
    // RC retains its existing catalog entry point and admin keeps its default props.
    await page.goto(`${base}#/modules/concrete/library`)
    await page.locator('.library-table tbody tr').first().waitFor()
    assert.equal(await page.locator('.library-tabs [role="tab"]').count(), 3)
    assert.deepEqual(errors, [])
    console.log('PASS Steel Library: four on-demand categories, catalog search/read-only, nine grouped edition cards, existing reader links, MBMA placeholders, VI/EN, navy hover, reload and mobile')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
