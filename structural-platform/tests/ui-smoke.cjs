const assert = require('node:assert/strict')
const { signIn } = require('./browser-auth.cjs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5173'
  try {
    await page.goto(base)
    await signIn(page)
    await page.getByText('API đang hoạt động').first().waitFor()
    assert.equal(await page.locator('.module-card').count(), 6)
    await page.getByRole('button', { name: /Thiết kế kết cấu thép|Steel design/i }).click()
    await page.getByRole('button', { name: 'Tạo dự án mới', exact: true }).first().click()
    assert.equal(await page.locator('select').count(), 5)
    assert.equal(await page.locator('select').nth(1).inputValue(), 'steel')
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await page.getByRole('heading', { name: 'GeekCalculus', exact: true }).waitFor()
    await page.locator('select').nth(1).locator('option').filter({ hasText: /^RC beam$/ }).waitFor({ state: 'attached' })
    await page.getByText('Main brand / Engineering Platform', { exact: true }).waitFor()
    const name = `UI smoke ${Date.now()}`
    await page.locator('input[name="name"]').fill(name)
    await page.getByRole('button', { name: /Create project/ }).click()
    await page.getByText(name, { exact: true }).waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Projects', exact: true }).click()
    await page.getByText(name, { exact: true }).waitFor()
    assert.equal(await page.locator('html').getAttribute('lang'), 'en')
    await page.getByRole('button', { name: 'VI', exact: true }).click()
    await page.getByRole('heading', { name: 'GeekCalculus', exact: true }).waitFor()
    await page.locator('select').nth(1).locator('option').filter({ hasText: /^Dầm bê tông cốt thép$/ }).waitFor({ state: 'attached' })
    await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Vui lòng nhập tên dự án.' }).waitFor()
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Enter a project name.' }).waitFor()
    await page.screenshot({ path: process.env.UI_SCREENSHOT || '/tmp/geekcalculus-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/geekcalculus-mobile.png', fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile viewport overflows horizontally')
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.route('**/api/**', route => route.abort())
    await page.getByRole('button', { name: 'Refresh list', exact: true }).click()
    await page.getByText('API unavailable').first().waitFor()
    await page.getByRole('button', { name: 'Projects', exact: true }).click()
    await page.getByText('Could not load projects. Please try again.').waitFor()
    await page.locator('input[name="name"]').fill('Must not save offline')
    await page.getByRole('button', { name: /Create project/ }).click()
    await page.getByRole('alert').filter({ hasText: /Could not create the project/ }).waitFor()
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log(JSON.stringify({ passed: true, created_project: name, checks: ['dropdowns', 'VI/EN', 'project creation', 'reload persistence', 'locale persistence', 'validation translation', 'mobile layout', 'offline errors', 'no browser exceptions'] }))
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
