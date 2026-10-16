const assert = require('node:assert/strict')
const http = require('node:http')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright')
const port = Number(process.env.LOCAL_WEB_PORT || 80)
function request(host, path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path, headers: { Host: host, Accept: path === '/' ? 'text/html' : 'application/json' } }, response => {
      let body = ''
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }))
    }).on('error', reject)
  })
}
async function main() {
  for (const [host, cookie] of [['geekcalculus.com', 'geekcalculus_main_session'], ['geekcalculus.test', 'geekcalculus_test_session']]) {
    const health = await request(host, '/api/health')
    assert.equal(health.status, 200)
    assert.equal(JSON.parse(health.body).status, 'ok')
    const csrf = await request(host, '/api/auth/csrf')
    assert.equal(csrf.status, 200)
    assert.ok(JSON.parse(csrf.body).csrf_token)
    assert.ok(csrf.headers['set-cookie'].some(value => value.startsWith(cookie + '=')))
    const guest = await request(host, '/api/auth/me')
    assert.equal(guest.status, 200)
    assert.equal(JSON.parse(guest.body).data, null)
    assert.equal((await request(host, '/api/projects')).status, 401)
    const index = await request(host, '/')
    assert.equal(index.status, 200)
    assert.ok(index.body.includes('<div id="app">'))
    assert.equal(index.body.includes('/@vite/client'), host.endsWith('.test'))
  }
  assert.equal((await request('unknown.invalid', '/')).status, 404)
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-proxy-server', '--host-resolver-rules=MAP geekcalculus.com 127.0.0.1, MAP geekcalculus.test 127.0.0.1'],
  })
  try {
    for (const host of ['geekcalculus.com', 'geekcalculus.test']) {
      const page = await browser.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const websocket = host.endsWith('.test') ? page.waitForEvent('websocket', { timeout: 10000 }) : null
      await page.goto(`http://${host}${port === 80 ? '' : ':' + port}/`)
      await page.locator('.login-form').waitFor()
      if (websocket) assert.equal(new URL((await websocket).url()).hostname, host)
      assert.equal(await page.locator('.demo-login-note').count(), 0, 'Both apps must use native Laravel authentication')
      const marker = page.locator('#geek-test-indicator');
      if (host.endsWith('.test')) {
        await marker.waitFor();
        assert.equal(await marker.locator('span').innerText(), 'Test');
        assert.equal(await marker.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
        await page.setViewportSize({ width: 390, height: 844 });
        const box = await marker.boundingBox();
        assert.ok(box.x >= 0 && box.x < 40 && box.y + box.height <= 844);
      } else assert.equal(await marker.count(), 0);
      await page.goto(`http://${host}${port === 80 ? '' : ':' + port}/hi-doubly-symmetric-aisc360-10.html`);
      if (host.endsWith('.test')) await page.locator('#geek-test-indicator').waitFor();
      else assert.equal(await page.locator('#geek-test-indicator').count(), 0);
      assert.deepEqual(errors, [])
      await page.close()
    }
  } finally { await browser.close() }
  console.log('Local domains passed: main built app, test Vite app, native health/CSRF/guest authentication, separate cookies, browser rendering, test-only fixed badge (app/standalone/mobile) and unknown-host rejection.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
