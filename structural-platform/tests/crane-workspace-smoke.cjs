const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')
const base = process.env.CRANE_BASE_URL || 'http://127.0.0.1:5173/'
const demo = process.env.TEST_DEMO === '1'

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => {
    if (location.protocol.startsWith('http')) localStorage.setItem('geekcalculus-locale', 'en')
  })
  try {
    await page.goto(base)
    await signIn(page, { demo, role: 'user' })
    await page.goto(new URL('#/modules/steel', base).href)
    await page.getByRole('button', { name: 'Crane Beam', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const opened = context.waitForEvent('page')
    await dialog.getByRole('button', { name: /AISC 360-10/ }).click()
    const crane = await opened
    crane.on('pageerror', error => errors.push(error.message))
    await crane.locator('#crane-member-workspace').waitFor()
    assert.ok(crane.url().endsWith('#/modules/steel/crane-beam'))
    assert.equal(await crane.evaluate(() => window.opener), null)
    const nav = crane.locator('.member-navigation')
    assert.equal(await nav.getByRole('link', { name: 'Crane Beam', exact: true }).getAttribute('aria-current'), 'page')
    let [menu, main] = await Promise.all([nav.boundingBox(), crane.locator('.member-main').boundingBox()])
    assert.ok(menu.x + menu.width <= main.x + 1, 'Crane navigation must be on the left')
    await nav.getByRole('button', { name: /Input Parameters/ }).click()
    assert.ok(crane.url().endsWith('#/modules/steel/crane-beam'), 'contents must not destroy the SPA route')
    const values = { depth: 400, top_flange_width: 200, bottom_flange_width: 250, web_thickness: 8, top_flange_thickness: 12, bottom_flange_thickness: 16 }
    for (const [key, value] of Object.entries(values)) await crane.locator(`[name="dimension-${key}"]`).fill(String(value))
    await crane.locator('[name="action-k_mm"]').fill('16')
    await crane.getByRole('button', { name: 'Calculate section properties', exact: true }).click()
    const area = crane.locator('#crane-properties tr').filter({ hasText: 'Area A (mm²)' })
    await area.waitFor()
    // Independent rectangle areas: 200*12 + 250*16 + 8*(400-12-16).
    assert.equal(await area.locator('td').innerText(), '9376.000')
    assert.match(await crane.locator('#crane-checks').innerText(), /496\.800/)
    assert.match(await crane.locator('#crane-checks').innerText(), /PRELIMINARY/)
    assert.match(await crane.locator('#crane-verification').innerText(), /NOT VERIFIED/)
    await crane.getByRole('button', { name: 'VI', exact: true }).click()
    await crane.getByRole('heading', { name: 'Dầm cầu trục · Crane Beam', exact: true }).waitFor()
    for (const width of [390, 320]) {
      await crane.setViewportSize({ width, height: 844 })
      assert.ok(await crane.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Crane overflow at ${width}px`)
    }
    await crane.setViewportSize({ width: 1440, height: 1100 })
    await crane.getByRole('button', { name: 'EN', exact: true }).click()
    await crane.evaluate(() => window.scrollTo(0, 0))
    assert.ok((await nav.boundingBox()).y < 1, 'Desktop navigation must start at the viewport top')
    if (process.env.CRANE_SCREENSHOT_PATH) await crane.screenshot({ path: process.env.CRANE_SCREENSHOT_PATH, fullPage: true })
    await nav.getByRole('link', { name: 'H/I Doubly Symmetric', exact: true }).click()
    await crane.locator('.global-nav').waitFor()
    const hiNav = crane.locator('.sidenav')
    ;[menu, main] = await Promise.all([hiNav.boundingBox(), crane.locator('.shell > .main').boundingBox()])
    assert.ok(menu.x + menu.width <= main.x + 1, 'H/I navigation must be on the left')
    assert.equal(await hiNav.getByRole('link', { name: /H\/I Doubly Symmetric/ }).getAttribute('aria-current'), 'page')
    await hiNav.getByRole('link', { name: /Crane Beam/ }).click()
    await crane.locator('#crane-member-workspace').waitFor()
    await crane.reload()
    await crane.locator('#crane-member-workspace').waitFor()
    const legacy = new URL(base)
    legacy.search = '?component=crane-beam&standard=aisc360-10'
    legacy.hash = '#/modules/steel'
    await crane.goto(legacy.href)
    await crane.locator('#crane-member-workspace').waitFor()
    assert.deepEqual(errors, [])
    console.log('PASS: Crane entry/new tab, dedicated and legacy routes, left navigation both ways, contents, shared geometry, review gates, EN/VI and mobile')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
