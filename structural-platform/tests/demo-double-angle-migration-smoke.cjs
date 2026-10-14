const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { signIn } = require('./browser-auth.cjs')
const seed = require('../database/seeds/engineering-data.json')

const base = process.env.DEMO_MIGRATION_URL || 'http://127.0.0.1:5191/'
const dbKey = 'geekcalculus-demo-library-v1'
const sessionKey = 'geekcalculus-demo-session-v1'
const migration = 'section-properties-double-angle-v1'
const digest = (salt, password) => crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex')

const legacyTypes = seed.section_types
  .filter(row => row.shape !== 'double_angle')
  .map((row, index) => ({ ...row, id: index + 1 }))
const customRectangle = legacyTypes.find(row => row.shape === 'rectangle')
customRectangle.name_en = 'User edited rectangle type'
const codeCollision = legacyTypes.find(row => row.shape === 'circle')
codeCollision.code = 'double_angle'
codeCollision.name_en = 'User type keeping colliding code'

const legacyDb = {
  users: ['admin', 'user'].map(role => {
    const salt = `migration-${role}`
    return { id: role, name: `Demo ${role}`, email: `${role}@demo.geekcalculus.test`, role, salt, passwordHash: digest(salt, 'demo') }
  }),
  materials: seed.materials.map((row, index) => ({ ...row, id: index + 1 })),
  section_types: legacyTypes,
  sections: [],
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await context.addInitScript(({ databaseKey, database }) => {
    if (!sessionStorage.getItem('test-double-angle-legacy-seeded')) {
      localStorage.setItem('geekcalculus-locale', 'en')
      localStorage.setItem(databaseKey, JSON.stringify(database))
      sessionStorage.setItem('test-double-angle-legacy-seeded', '1')
    }
  }, { databaseKey: dbKey, database: legacyDb })

  try {
    await page.goto(base)
    await signIn(page, { demo: true, role: 'admin' })
    const afterMigration = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), dbKey)
    assert.ok(afterMigration.migrations.includes(migration), 'The one-time migration flag is persisted')
    const addedTypes = afterMigration.section_types.filter(row => row.shape === 'double_angle')
    assert.equal(addedTypes.length, 1, 'An old eight-type demo library gains exactly one double-angle type')
    assert.equal(addedTypes[0].id, 9, 'The migrated type receives the next stable ID')
    assert.equal(addedTypes[0].code, 'double_angle_migrated', 'A conflicting code is resolved without replacing the existing record')
    assert.equal(afterMigration.section_types.find(row => row.shape === 'rectangle').name_en, 'User edited rectangle type')
    assert.equal(afterMigration.section_types.find(row => row.id === codeCollision.id).code, 'double_angle')
    assert.equal(afterMigration.section_types.find(row => row.id === codeCollision.id).name_en, 'User type keeping colliding code')

    const adminMode = page.getByRole('button', { name: /Admin interface/ })
    if (await adminMode.count()) await adminMode.click()
    await page.getByRole('tab', { name: 'Section types', exact: true }).click()
    const migratedRow = page.locator('.library-table tbody tr').filter({ has: page.getByRole('cell', { name: addedTypes[0].code, exact: true }) })
    await migratedRow.waitFor()
    page.once('dialog', dialog => dialog.accept())
    await migratedRow.getByRole('button', { name: 'Delete', exact: true }).click()
    await migratedRow.waitFor({ state: 'detached' })
    const immediatelyAfterDelete = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), dbKey)
    assert.equal(immediatelyAfterDelete.section_types.filter(row => row.shape === 'double_angle').length, 0, 'Delete removes the migrated type from browser storage')
    assert.ok(immediatelyAfterDelete.migrations.includes(migration), 'Deleting the new type preserves its completed migration flag')

    await page.reload()
    const reloadedAdminMode = page.getByRole('button', { name: /Admin interface/ })
    if (await reloadedAdminMode.count()) await reloadedAdminMode.click()
    await page.getByRole('tab', { name: 'Section types', exact: true }).click()
    const afterDeleteReload = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), dbKey)
    assert.ok(afterDeleteReload.migrations.includes(migration))
    assert.equal(afterDeleteReload.section_types.filter(row => row.shape === 'double_angle').length, 0, 'A user-deleted migrated type does not reappear after reload')
    assert.equal(afterDeleteReload.section_types.find(row => row.shape === 'rectangle').name_en, 'User edited rectangle type')

    await page.evaluate(({ databaseKey, storageKey }) => {
      localStorage.removeItem(databaseKey)
      localStorage.removeItem(storageKey)
    }, { databaseKey: dbKey, storageKey: sessionKey })
    await page.reload()
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    const freshDb = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), dbKey)
    assert.ok(freshDb.migrations.includes(migration), 'Fresh demo databases start with the migration marked complete')
    assert.equal(freshDb.section_types.filter(row => row.shape === 'double_angle').length, 1, 'Fresh seeded libraries contain exactly one double-angle type')
    assert.deepEqual(pageErrors, [], pageErrors.join('\n'))
    console.log('Demo local-library migration smoke passed: old libraries gain one collision-safe double-angle type, preserve edited rows, and do not restore a user-deleted type; fresh libraries start migrated.')
  } finally {
    await context.close()
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
