const path = require('node:path')
const { createRequire } = require('node:module')
const { mkdirSync, copyFileSync } = require('node:fs')
const root = path.resolve(__dirname, '..')
const frontendRequire = createRequire(path.join(root, 'frontend/vue/package.json'))
const esbuild = frontendRequire('esbuild')
const out = path.join(root, 'engineering/structural_engine/sectional_properties/data')
mkdirSync(out, { recursive: true })
copyFileSync(path.join(root, 'section-properties/section-registry.json'), path.join(out, 'section-registry.json'))
esbuild.buildSync({
  entryPoints: [path.join(root, 'section-properties/node-cli.ts')],
  outfile: path.join(out, 'section-core.mjs'), bundle: true,
  platform: 'node', format: 'esm', target: 'node24',
  nodePaths: [path.join(root, 'frontend/vue/node_modules')],
  logLevel: 'info',
})
// Preserve the old synchronous public facade without keeping another set of formulas.
esbuild.buildSync({
  entryPoints: [path.join(root, 'section-properties/core/calculator.ts')],
  outfile: path.join(root, 'section-properties/dist/calculator.mjs'), bundle: true,
  platform: 'neutral', format: 'esm', target: 'es2022',
  nodePaths: [path.join(root, 'frontend/vue/node_modules')],
  logLevel: 'info',
})
// Public reusable library, including mechanics and stress response helpers.
esbuild.buildSync({
  entryPoints: [path.join(root, 'section-properties/index.ts')],
  outfile: path.join(root, 'section-properties/dist/index.mjs'), bundle: true,
  platform: 'neutral', format: 'esm', target: 'es2022',
  nodePaths: [path.join(root, 'frontend/vue/node_modules')], logLevel: 'info',
})

// Browser ESM adapter: Steel Design consumes the same canonical core, including
// advanced mechanics and the versioned formula report. Vite copies this asset
// from public/ into docs/ during the published demo build.
esbuild.buildSync({
  entryPoints: [path.join(root, 'frontend/vue/src/steel-design/hi-section-properties.ts')],
  outfile: path.join(root, 'frontend/vue/public/hi-section-properties-core.mjs'),
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
  nodePaths: [path.join(root, 'frontend/vue/node_modules')],
  logLevel: 'info',
})

// Browser resistance-factor adapter. AISC360-10 coefficients are defined once in
// standards/aisc360-10-strength-factors.json; do not hardcode them in calculators.
esbuild.buildSync({
  entryPoints: [path.join(root, 'standards/aisc360-10-resistance.ts')],
  outfile: path.join(root, 'frontend/vue/public/aisc360-10-resistance.js'),
  bundle: true, platform: 'browser', format: 'iife', globalName: 'Aisc36010Resistance',
  target: 'es2022', logLevel: 'info',
})

 // Publish the edition-specific calculation core without copying formulas into HTML.
 // This native ESM file is imported by the standalone H/I report and by Node tests.
copyFileSync(
 path.join(root,'standards/aisc360-10-verified-hi.mjs'),
 path.join(root,'frontend/vue/public/aisc360-10-verified-hi.mjs')
)
