const { createRequire } = require('node:module')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const frontend = path.resolve(__dirname, '../../frontend/vue')
const esbuild = createRequire(path.join(frontend, 'package.json'))('esbuild')
module.exports = function loadCraneModule(name) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'crane-test-'))
  try {
    const outfile = path.join(temporary, 'module.cjs')
    esbuild.buildSync({ entryPoints: [path.join(frontend, 'src/steel-design', name + '.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node24', nodePaths: [path.join(frontend, 'node_modules')], logLevel: 'silent' })
    return require(outfile)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}
