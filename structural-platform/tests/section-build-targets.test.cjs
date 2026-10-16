const assert = require('node:assert/strict')
const { test } = require('node:test')
const { spawnSync } = require('node:child_process')
const { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const builder = 'scripts/build-section-properties-core.cjs'
const packaged = 'engineering/structural_engine/sectional_properties/data'

function workspace(t, browser = false) {
  const dir = mkdtempSync(path.join(tmpdir(), 'geek-section-build-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  for (const source of [builder, 'frontend/vue/package.json']) {
    mkdirSync(path.dirname(path.join(dir, source)), { recursive: true })
    cpSync(path.join(root, source), path.join(dir, source))
  }
  cpSync(path.join(root, 'section-properties'), path.join(dir, 'section-properties'), {
    recursive: true, filter: source => path.basename(source) !== 'dist',
  })
  // Installed tooling is shared; deliberately omit all Vue/Steel/AISC sources.
  // A junction also works without symbolic-link privileges on Windows.
  symlinkSync(path.join(root, 'frontend/vue/node_modules'), path.join(dir, 'frontend/vue/node_modules'), 'junction')
  if (browser) {
    const adapter = 'frontend/vue/src/steel-design/hi-section-properties.ts'
    mkdirSync(path.dirname(path.join(dir, adapter)), { recursive: true })
    cpSync(path.join(root, adapter), path.join(dir, adapter))
    cpSync(path.join(root, 'standards'), path.join(dir, 'standards'), { recursive: true })
  }
  return dir
}

function build(dir, target) {
  const run = spawnSync(process.execPath, [path.join(dir, builder), `--target=${target}`], {
    cwd: dir, encoding: 'utf8', timeout: 30_000,
  })
  assert.ifError(run.error)
  assert.equal(run.status, 0, run.stdout + run.stderr)
}

test('engine target builds in the sparse Docker context without Steel/AISC sources', t => {
  const dir = workspace(t)
  build(dir, 'engine')
  assert.ok(existsSync(path.join(dir, packaged, 'section-core.mjs')))
  assert.deepEqual(JSON.parse(readFileSync(path.join(dir, packaged, 'section-registry.json'))),
    JSON.parse(readFileSync(path.join(root, 'section-properties/section-registry.json'))))
  assert.equal(existsSync(path.join(dir, 'frontend/vue/public')), false)
  assert.equal(existsSync(path.join(dir, 'section-properties/dist')), false)
  const input = { geometry: { type: 'rectangle', geometry_variant: 'solid', dimensions: { width: 200, height: 400 } }, units: 'mm' }
  const run = spawnSync(process.execPath, [path.join(dir, packaged, 'section-core.mjs')], { input: JSON.stringify(input), encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr + run.stdout)
  assert.equal(JSON.parse(run.stdout).properties.geometric.area, 80_000)
})

test('browser target builds UI adapters without generating Python or reusable-library artifacts', t => {
  const dir = workspace(t, true)
  build(dir, 'browser')
  for (const output of ['section-properties/dist/calculator.mjs', 'frontend/vue/public/hi-section-properties-core.mjs',
    'frontend/vue/public/aisc360-10-resistance.js', 'frontend/vue/public/aisc360-10-verified-hi.mjs']) {
    assert.ok(existsSync(path.join(dir, output)), output)
  }
  assert.equal(existsSync(path.join(dir, 'engineering')), false)
  assert.equal(existsSync(path.join(dir, 'section-properties/dist/index.mjs')), false)
})

test('library target needs only shared sources and does not generate engine or browser assets', t => {
  const dir = workspace(t)
  build(dir, 'library')
  assert.ok(existsSync(path.join(dir, 'section-properties/dist/index.mjs')))
  assert.equal(existsSync(path.join(dir, 'engineering')), false)
  assert.equal(existsSync(path.join(dir, 'frontend/vue/public')), false)
  assert.equal(existsSync(path.join(dir, 'section-properties/dist/calculator.mjs')), false)
})

test('unknown build target fails before creating output', t => {
  const dir = workspace(t)
  const run = spawnSync(process.execPath, [path.join(dir, builder), '--target=typo'], { encoding: 'utf8' })
  assert.notEqual(run.status, 0)
  assert.match(run.stdout + run.stderr, /target/i)
  assert.equal(existsSync(path.join(dir, 'engineering')), false)
  assert.equal(existsSync(path.join(dir, 'section-properties/dist')), false)
})
