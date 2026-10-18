const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright')
const { signIn } = require('./browser-auth.cjs')

const base = process.env.STRUCTURE_BASE_URL || 'http://127.0.0.1:8768/GeekCalculus/'
const groupRoutes = ['loads', 'steel', 'concrete']
const loadRoutes = ['combo', 'wind', 'dead', 'seismic', 'snow', 'temperature']
const loadLabels = ['Combo Generator', 'Wind load', 'Dead load', 'Seismic load', 'Snow load', 'Temperature load']
const cardLabels = ['Loading', 'Steel Structure', 'RC Structure']
const expectedHash = routes => routes.map(route => `#/modules/${route}`)
const moduleUrl = route => new URL(`#/modules/${route}`, base).href

async function navHashes(nav) {
  return nav.locator('a').evaluateAll(links => links.map(link => new URL(link.href).hash))
}

async function verifySharedCalculator(page, route) {
  await page.goto(moduleUrl(route))
  const panel = page.locator('.section-properties-panel')
  await panel.waitFor({ state: 'visible' })
  const profile = panel.locator('select').first()
  await profile.selectOption('circle')
  const diameter = panel.locator('input[name="dimension-diameter"]')
  const areas = []
  for (const value of ['100', '200']) {
    await diameter.fill(value)
    const result = panel.locator('.section-calculated-properties')
    await result.waitFor({ state: 'visible' })
    const expectedArea = Math.PI * (Number(value) / 2) ** 2
    await page.waitForFunction(expected => {
      const row = [...document.querySelectorAll('.section-calculated-properties dt')]
        .find(item => item.textContent.trim() === 'A · Area')
      const displayed = row?.parentElement?.querySelector('dd')?.textContent ?? ''
      const area = Number(displayed.replace(/[^\d.-]/g, ''))
      return Number.isFinite(area) && Math.abs(area - expected) <= expected * 0.01
    }, expectedArea)
    const area = result.getByText('A · Area', { exact: true }).locator('..').locator('dd')
    await area.waitFor({ state: 'visible' })
    const displayed = await area.innerText()
    const numeric = Number(displayed.replace(/[^\d.-]/g, ''))
    assert.ok(Number.isFinite(numeric) && numeric > 0, `${route} should show a positive calculated area, got ${displayed}`)
    areas.push(numeric)
  }
  assert.ok(areas[1] > areas[0] * 3.9 && areas[1] < areas[0] * 4.1, `${route} area should update when the circle diameter doubles: ${areas.join(', ')}`)
  assert.equal(await page.locator('.geometry-workbench').count(), 0, `${route} should use the shared Section Properties calculator`)
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  context.on('page', opened => opened.on('pageerror', error => errors.push(error.message)))
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => {
    if (!['http:', 'https:'].includes(location.protocol)) return
    if (!localStorage.getItem('geekcalculus-locale')) localStorage.setItem('geekcalculus-locale', 'en')
  })

  try {
    await page.goto(base)
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    await signIn(page, { demo: true })
    await page.getByRole('heading', { name: 'GeekCalculus', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)

    const cards = page.locator('.structure-card')
    assert.equal(await cards.count(), 3, 'Home should show Steel Structure, RC Structure, and Loading')
    const cardRoutes = ['loads', 'steel', 'concrete']
    for (let index = 0; index < cardRoutes.length; index += 1) {
      const card = cards.nth(index)
      assert.ok((await card.getAttribute('href')).endsWith(`#/modules/${cardRoutes[index]}`))
      assert.ok((await card.innerText()).includes(cardLabels[index]), `Home card should be labelled ${cardLabels[index]}`)
      assert.equal(await card.getAttribute('target'), '_blank', 'Home structure links keep their new-tab behavior')
      const image = card.locator('svg[role="img"]')
      assert.equal(await image.count(), 1, `${cardRoutes[index]} card should contain one illustration`)
      const accessibleName = await image.evaluate(svg => {
        const label = svg.getAttribute('aria-label')
        if (label?.trim()) return label.trim()
        const labelledBy = svg.getAttribute('aria-labelledby')
        if (labelledBy) return labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim()
        return svg.querySelector('title')?.textContent?.trim() ?? ''
      })
      assert.ok(accessibleName, `${cardRoutes[index]} illustration should have an accessible name`)
    }

    const steelCard = cards.nth(1)
    const tabPromise = context.waitForEvent('page')
    await steelCard.click()
    const modulePage = await tabPromise
    const steelHeading = modulePage.locator('.steel-design-heading h2')
    await steelHeading.waitFor()
    assert.equal(await steelHeading.innerText(), 'Steel design')
    assert.equal(await modulePage.evaluate(() => window.opener), null)
    assert.deepEqual(await navHashes(modulePage.locator('.workspace-group-navigation')), expectedHash(groupRoutes))
    assert.equal(await modulePage.locator('.module-navigation a').nth(2).textContent(),'SAP2000-API')
    assert.equal(await modulePage.locator('.module-navigation a').nth(2).getAttribute('href'),'geekcalculus-sap2000://launch/26.2.0/?lang=en')
    assert.deepEqual((await navHashes(modulePage.locator('.module-navigation'))).filter(Boolean), expectedHash([
      'steel', 'steel/cfs', 'steel/section-properties', 'steel/library', 'steel/future',
    ]))

    await modulePage.getByRole('button', { name: 'VI', exact: true }).click()
    await modulePage.waitForFunction(() => document.documentElement.lang === 'vi')
    await modulePage.getByRole('button', { name: 'Trang chính', exact: true }).click()
    await modulePage.getByRole('heading', { name: 'GeekCalculus', exact: true }).waitFor()
    assert.equal(await modulePage.locator('.structure-card').count(), 3, 'Home remains available after switching locale')
    assert.match(await modulePage.locator('.platform-heading p').innerText(), /Ba không gian/i)
    for (const width of [390, 320]) {
      await modulePage.setViewportSize({ width, height: 844 })
      assert.ok(await modulePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Home overflows at ${width}px`)
    }
    await modulePage.setViewportSize({ width: 1440, height: 1100 })
    await modulePage.getByRole('button', { name: 'EN', exact: true }).click()
    await modulePage.waitForFunction(() => document.documentElement.lang === 'en')

    await verifySharedCalculator(modulePage, 'steel/section-properties')
    await verifySharedCalculator(modulePage, 'concrete/section-properties')

    for (const route of ['steel/library', 'concrete/library']) {
      await modulePage.goto(moduleUrl(route))
      const library = modulePage.locator('.library-browser')
      await library.getByText('Read only', { exact: true }).waitFor()
      assert.equal(await library.locator('.library-add-button').count(), 0, `${route} should remain read only`)
      assert.equal(await library.locator('.library-transfer').count(), 0, `${route} should not expose library import/export controls`)
    }

    for (const route of ['steel/future', 'concrete/future']) {
      await modulePage.goto(moduleUrl(route))
      assert.match(await modulePage.locator('.module-page').innerText(), /awaiting implementation/i, `${route} should remain pending`)
      assert.equal(await modulePage.locator('.section-calculated-properties').count(), 0)
    }

    await modulePage.goto(moduleUrl('concrete'))
    await modulePage.locator('.workspace-group-navigation a[href$="#/modules/concrete"]').waitFor()
    assert.equal(await modulePage.locator('.module-navigation a').filter({hasText:'SAP2000-API'}).count(),0)
    assert.deepEqual(await navHashes(modulePage.locator('.module-navigation')), expectedHash([
      'concrete', 'concrete/section-properties', 'concrete/library', 'concrete/future',
    ]))
    await modulePage.locator('.concrete-design-setup').waitFor({ state: 'visible' })
    assert.ok((await modulePage.locator('.concrete-design-setup').innerText()).includes('awaiting implementation'))

    await modulePage.locator('.workspace-group-navigation a[href$="#/modules/loads"]').click()
    await modulePage.locator('.module-heading').getByRole('heading', { name: 'Combo Generator', exact: true }).waitFor()
    assert.equal(await modulePage.locator('.module-heading h1').innerText(), 'Combo Generator', 'Loading opens its default Combo Generator page')
    assert.deepEqual(await navHashes(modulePage.locator('.module-navigation')), expectedHash(loadRoutes.map(route => `loads/${route}`)))
    for (let index = 0; index < loadRoutes.length; index += 1) {
      const route = `loads/${loadRoutes[index]}`
      const link = modulePage.locator(`.module-navigation a[href$="#/modules/${route}"]`)
      await link.click()
      await modulePage.waitForFunction(expected => location.hash === expected, `#/modules/${route}`)
      await modulePage.waitForFunction(expected => {
        const active = document.querySelector('.module-navigation a[aria-current="page"]')
        return active && new URL(active.href).hash === expected
      }, `#/modules/${route}`)
      const pageText = await modulePage.locator('.module-page').innerText()
      assert.ok(pageText.includes(loadLabels[index]), `${route} should identify its load tool`)
      assert.match(pageText, /in development/i, `${route} should state that the tool is pending`)
      assert.equal(await modulePage.locator('.section-calculated-properties').count(), 0, `${route} must not show fabricated results`)
      assert.equal(await modulePage.getByRole('button', { name: /calculate/i }).count(), 0, `${route} must not offer a calculate action`)
      if (route === 'loads/dead') {
        assert.match(pageText, /layers/i, 'Dead load description should mention layers')
        assert.match(pageText, /deck/i, 'Dead load description should mention the deck')
      }
    }

    await modulePage.reload()
    await modulePage.waitForFunction(() => location.hash === '#/modules/loads/temperature')
    await modulePage.waitForFunction(() => {
      const active = document.querySelector('.module-navigation a[aria-current="page"]')
      return active && new URL(active.href).hash === '#/modules/loads/temperature'
    })
    assert.match(await modulePage.locator('.module-page').innerText(), /in development/i)
    await modulePage.goBack()
    await modulePage.waitForFunction(() => location.hash === '#/modules/loads/snow')

    for (const route of ['analysis', 'library', 'future']) {
      await modulePage.goto(moduleUrl(route))
      if (route === 'analysis') await modulePage.locator('.section-properties-panel').waitFor({ state: 'visible' })
      if (route === 'library') await modulePage.locator('.library-browser').getByText('Read only', { exact: true }).waitFor()
      if (route === 'future') assert.match(await modulePage.locator('.module-page').innerText(), /awaiting implementation/i)
    }

    for (const width of [390, 320]) {
      await modulePage.setViewportSize({ width, height: 844 })
      assert.ok(await modulePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Legacy future view overflows at ${width}px`)
    }
    await modulePage.goto(moduleUrl('steel/section-properties'))
    for (const width of [390, 320]) {
      await modulePage.setViewportSize({ width, height: 844 })
      assert.ok(await modulePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Steel Section Properties overflows at ${width}px`)
    }

    assert.equal(errors.length, 0, errors.join('\n'))
    console.log('Structure group smoke passed: illustrated home links, group and tool routes, shared Steel/RC calculations, read-only libraries, pending load tools and legacy bookmarks, reduced motion, history/reload, and narrow layouts.')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
