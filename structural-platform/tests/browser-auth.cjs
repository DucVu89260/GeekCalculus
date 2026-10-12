const fs = require('node:fs')
async function signIn(page, { demo = false, role = 'user' } = {}) {
  const account = demo ? { email: `${role}@demo.geekcalculus.test`, password: 'demo' } : JSON.parse(fs.readFileSync(process.env.AUTH_FIXTURES || '/tmp/geek-browser-fixtures.json', 'utf8')).find(item => item.role === role)
  if (!account) throw new Error('Provide a private AUTH_FIXTURES JSON file with test accounts.')
  await page.locator('input[name="email"]').fill(account.email)
  await page.locator('input[name="password"]').fill(account.password)
  await page.locator('.login-form button[type="submit"]').click()
  if (role === 'user') await page.getByRole('heading', { name: 'GeekCalculus', exact: true }).waitFor()
}
module.exports = { signIn }
