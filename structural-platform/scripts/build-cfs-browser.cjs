// Serve the pinned Python runtime from our own origin, including offline/local builds.
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const vue = path.resolve(__dirname, '../frontend/vue')
const requireVue = createRequire(path.join(vue, 'package.json'))
const source = path.dirname(requireVue.resolve('pyodide/package.json'))
const target = path.join(vue, 'public/cfs-runtime')
fs.mkdirSync(target, { recursive: true })
for (const file of ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json', 'README.md', 'package.json']) {
  fs.copyFileSync(path.join(source, file), path.join(target, file))
}
console.log('CFS browser runtime prepared: Pyodide ' + requireVue('pyodide/package.json').version)
