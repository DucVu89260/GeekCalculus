const path = require('node:path')
const { createRequire } = require('node:module')
const { mkdirSync, copyFileSync } = require('node:fs')

const root = path.resolve(__dirname, '..')
const frontendRequire = createRequire(path.join(root, 'frontend/vue/package.json'))
const esbuild = frontendRequire('esbuild')
const nodePaths = [path.join(root, 'frontend/vue/node_modules')]

function parseTarget(args) {
  let target = 'all'
  let targetWasSet = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    let value
    if (argument === '--target') {
      value = args[index + 1]
      index += 1
    } else if (argument.startsWith('--target=')) {
      value = argument.slice('--target='.length)
    } else if (argument === '--help' || argument === '-h') {
      process.stdout.write('Usage: node scripts/build-section-properties-core.cjs [--target=all|engine|browser|library]\n')
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }

    if (targetWasSet) throw new Error('Specify --target only once.')
    if (!['all', 'engine', 'browser', 'library'].includes(value)) {
      throw new Error(`Unknown Section Properties build target: ${value}`)
    }
    target = value
    targetWasSet = true
  }
  return target
}

function buildEngine() {
  const out = path.join(root, 'engineering/structural_engine/sectional_properties/data')
  mkdirSync(out, { recursive: true })
  copyFileSync(path.join(root, 'section-properties/section-registry.json'), path.join(out, 'section-registry.json'))
  esbuild.buildSync({
    entryPoints: [path.join(root, 'section-properties/node-cli.ts')],
    outfile: path.join(out, 'section-core.mjs'), bundle: true,
    platform: 'node', format: 'esm', target: 'node24',
    nodePaths, logLevel: 'info',
  })
}

function buildBrowser() {
  const dist = path.join(root, 'section-properties/dist')
  const publicDir = path.join(root, 'frontend/vue/public')
  mkdirSync(dist, { recursive: true })
  mkdirSync(publicDir, { recursive: true })

  // Legacy geometry facade delegates to the canonical TypeScript package.
  esbuild.buildSync({
    entryPoints: [path.join(root, 'section-properties/core/calculator.ts')],
    outfile: path.join(dist, 'calculator.mjs'), bundle: true,
    platform: 'neutral', format: 'esm', target: 'es2022',
    nodePaths, logLevel: 'info',
  })

  // Steel Design browser adapter uses the same core formulas and mechanics.
  esbuild.buildSync({
    entryPoints: [path.join(root, 'frontend/vue/src/steel-design/hi-section-properties.ts')],
    outfile: path.join(publicDir, 'hi-section-properties-core.mjs'),
    bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
    nodePaths, logLevel: 'info',
  })

  // AISC resistance factors have one source in the versioned standards data.
  esbuild.buildSync({
    entryPoints: [path.join(root, 'standards/aisc360-10-resistance.ts')],
    outfile: path.join(publicDir, 'aisc360-10-resistance.js'),
    bundle: true, platform: 'browser', format: 'iife', globalName: 'Aisc36010Resistance',
    target: 'es2022', logLevel: 'info',
  })

  // The report adapter is copied as native ESM for the standalone viewer.
  for (const module of ['aisc360-10-verified-hi.mjs', 'aisc360-10-ih-flexure.mjs', 'aisc360-10-ih-tension.mjs', 'aisc360-10-ih-shear.mjs', 'aisc360-10-ih-compliance.mjs', 'aisc360-10-ih-source.mjs']) {
    copyFileSync(path.join(root, 'standards', module), path.join(publicDir, module))
  }
}

function buildLibrary() {
  const dist = path.join(root, 'section-properties/dist')
  mkdirSync(dist, { recursive: true })
  // Public API bundle, including mechanics and stress response helpers.
  esbuild.buildSync({
    entryPoints: [path.join(root, 'section-properties/index.ts')],
    outfile: path.join(dist, 'index.mjs'), bundle: true,
    platform: 'neutral', format: 'esm', target: 'es2022',
    nodePaths, logLevel: 'info',
  })
}

function main() {
  const target = parseTarget(process.argv.slice(2))
  if (target === 'engine' || target === 'all') buildEngine()
  if (target === 'browser' || target === 'all') buildBrowser()
  if (target === 'library' || target === 'all') buildLibrary()
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
