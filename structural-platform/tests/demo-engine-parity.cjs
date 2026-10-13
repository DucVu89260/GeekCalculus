const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const frontendRequire = createRequire(path.join(root, 'frontend/vue/package.json'))
const esbuild = frontendRequire('esbuild')
const engineering = path.join(root, 'engineering')
const fixtureDirectory = path.join(engineering, 'examples')
const relativeTolerance = 5e-12
const absoluteTolerance = Number.MIN_VALUE * 4

function request(type, variant, dimensions, options) {
  return { geometry: { type, geometry_variant: variant, dimensions }, units: 'mm', ...(options === undefined ? {} : { options }) }
}

function successfulCases() {
  const fixtures = ['rectangle', 'circle', 'i-asymmetric'].map((name) => [
    `fixture ${name}`,
    JSON.parse(fs.readFileSync(path.join(fixtureDirectory, `${name}.json`), 'utf8')),
  ])
  return [
    ...fixtures,
    ['bottom-flange PNA', request('i_section', 'sharp_corner', {
      depth: 100, top_flange_width: 40, bottom_flange_width: 100, web_thickness: 4,
      top_flange_thickness: 4, bottom_flange_thickness: 40,
    })],
    ['top-flange PNA', request('i_section', 'sharp_corner', {
      depth: 100, top_flange_width: 100, bottom_flange_width: 40, web_thickness: 4,
      top_flange_thickness: 40, bottom_flange_thickness: 4,
    })],
    ['thin web with nearly balanced flange areas', request('i_section', 'sharp_corner', {
      depth: 1000, top_flange_width: 100, bottom_flange_width: 100, web_thickness: 1e-10,
      top_flange_thickness: 9.999999999020002, bottom_flange_thickness: 10,
    })],
    ['square rectangle torsion', request('rectangle', 'solid', { width: 1, height: 1 }, { include_advanced: true })],
    ['explicit optional torsion non-convergence', request('rectangle', 'solid', { width: 10, height: 10 }, { include_advanced: true, rectangle_j_max_terms: 1 })],
    ['tiny rectangle torsion precision limit', request('rectangle', 'solid', { width: 1, height: 1e-103 }, { include_advanced: true, rectangle_j_relative_tolerance: 1e-300 })],
    ['plastic properties omitted', request('circle', 'solid', { diameter: 20 }, { include_plastic: false })],
    ['symmetric scale base', request('rectangle', 'solid', { width: 10, height: 10 }, { include_advanced: true })],
    ['symmetric scale triple', request('rectangle', 'solid', { width: 30, height: 30 }, { include_advanced: true })],
  ]
}

function errorCases() {
  return [
    ['boolean dimension', request('rectangle', 'solid', { width: true, height: 20 }), 'INVALID_DIMENSION'],
    ['non-positive dimension', request('circle', 'solid', { diameter: 0 }), 'INVALID_DIMENSION'],
    ['unsupported variant', request('rectangle', 'hollow', { width: 20, height: 10 }), 'UNSUPPORTED_VARIANT'],
    ['extra geometry dimension', request('circle', 'solid', { diameter: 10, radius: 5 }), 'INVALID_GEOMETRY'],
    ['unsupported units', { ...request('rectangle', 'solid', { width: 20, height: 10 }), units: 'm' }, 'UNSUPPORTED_UNITS'],
    ['impossible I-section proportions', request('i_section', 'sharp_corner', {
      depth: 20, top_flange_width: 30, bottom_flange_width: 30, web_thickness: 5,
      top_flange_thickness: 12, bottom_flange_thickness: 12,
    }), 'INVALID_GEOMETRY'],
    ['unsupported required property', request('rectangle', 'solid', { width: 20, height: 10 }, { required_properties: ['shear_center'] }), 'UNSUPPORTED_PROPERTY'],
    ['required torsion non-convergence', request('rectangle', 'solid', { width: 10, height: 10 }, { required_properties: ['torsion_constant_j'], rectangle_j_max_terms: 1 }), 'CALCULATION_ERROR'],
  ]
}

function runPython(requestValue) {
  const python = process.env.ENGINE_PYTHON || 'python3'
  const existingPythonPath = process.env.PYTHONPATH
  const env = {
    ...process.env,
    PYTHONPATH: existingPythonPath ? `${engineering}${path.delimiter}${existingPythonPath}` : engineering,
  }
  const run = spawnSync(python, ['-m', 'structural_engine.sectional_properties'], {
    cwd: root,
    env,
    input: JSON.stringify(requestValue),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
  assert.ifError(run.error)
  assert.ok(run.stdout, `Python engine returned no JSON. stderr: ${run.stderr}`)
  let payload
  try {
    payload = JSON.parse(run.stdout)
  } catch (error) {
    assert.fail(`Python engine returned invalid JSON: ${error.message}\n${run.stdout}\n${run.stderr}`)
  }
  return { exitCode: run.status, payload, stderr: run.stderr }
}

function compareTree(pathname, expected, actual) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    assert.ok(Number.isFinite(expected) && Number.isFinite(actual), `${pathname}: expected finite numeric values; got ${expected} and ${actual}`)
    const difference = Math.abs(expected - actual)
    const allowed = absoluteTolerance + relativeTolerance * Math.max(Math.abs(expected), Math.abs(actual))
    assert.ok(difference <= allowed, `${pathname}: Python=${expected}, browser=${actual}, difference=${difference}, allowed=${allowed}`)
    return
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${pathname}: expected an array`)
    assert.equal(actual.length, expected.length, `${pathname}: array length`)
    expected.forEach((value, index) => compareTree(`${pathname}[${index}]`, value, actual[index]))
    return
  }
  if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object' && !Array.isArray(actual), `${pathname}: expected an object`)
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${pathname}: object keys`)
    for (const key of Object.keys(expected)) compareTree(`${pathname}.${key}`, expected[key], actual[key])
    return
  }
  assert.equal(actual, expected, `${pathname}: value`)
}

function assertScale(base, triple) {
  const baseProperties = base.properties
  const tripleProperties = triple.properties
  const ratios = [
    ['area', tripleProperties.geometric.area / baseProperties.geometric.area, 3 ** 2],
    ['perimeter', tripleProperties.geometric.perimeter / baseProperties.geometric.perimeter, 3],
    ['ix', tripleProperties.elastic.ix / baseProperties.elastic.ix, 3 ** 4],
    ['iy', tripleProperties.elastic.iy / baseProperties.elastic.iy, 3 ** 4],
    ['zx', tripleProperties.plastic.zx / baseProperties.plastic.zx, 3 ** 3],
    ['zy', tripleProperties.plastic.zy / baseProperties.plastic.zy, 3 ** 3],
    ['rx', tripleProperties.elastic.rx / baseProperties.elastic.rx, 3],
    ['ry', tripleProperties.elastic.ry / baseProperties.elastic.ry, 3],
    ['torsion J', triple.advanced.torsion_constant_j.value / base.advanced.torsion_constant_j.value, 3 ** 4],
  ]
  for (const [property, actual, expected] of ratios) {
    const allowed = absoluteTolerance + relativeTolerance * Math.max(Math.abs(expected), Math.abs(actual))
    assert.ok(Math.abs(actual - expected) <= allowed, `${property} scale ratio: expected ${expected}, got ${actual}`)
  }
}

async function main() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'geekcalculus-demo-engine-'))
  const bundlePath = path.join(tempDirectory, 'demo-calculator.cjs')
  try {
    esbuild.buildSync({
      entryPoints: [path.join(root, 'frontend/vue/src/sectional-properties/demo-calculator.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: bundlePath,
      logLevel: 'silent',
    })
    const { calculateDemoSection } = require(bundlePath)
    const outputs = new Map()
    for (const [name, input] of successfulCases()) {
      const python = runPython(input)
      assert.equal(python.exitCode, 0, `${name}: Python engine error: ${JSON.stringify(python.payload)}`)
      assert.equal(python.payload.status, 'success', `${name}: Python result status`)
      const browser = await calculateDemoSection(input)
      compareTree(name, python.payload, browser)
      outputs.set(name, browser)
    }
    assertScale(outputs.get('symmetric scale base'), outputs.get('symmetric scale triple'))
    assert.equal(outputs.get('square rectangle torsion').advanced.torsion_constant_j.status, 'computed')
    const squareJ = outputs.get('square rectangle torsion')
    const squareJError = Math.abs(squareJ.advanced.torsion_constant_j.value - 0.1405770149551536)
    const squareJBudget = squareJ.diagnostics.torsion.truncation_abs_error_bound + squareJ.diagnostics.torsion.floating_point_abs_error_estimate
    assert.ok(squareJError <= squareJBudget, `square rectangle torsion reference error ${squareJError} exceeds reported bound ${squareJBudget}`)
    assert.equal(outputs.get('explicit optional torsion non-convergence').advanced.torsion_constant_j.reason, 'convergence_not_achieved')
    assert.equal(outputs.get('bottom-flange PNA').properties.plastic.pna_y, 21.92)
    assert.equal(outputs.get('top-flange PNA').properties.plastic.pna_y, 78.08)
    assert.ok(outputs.get('thin web with nearly balanced flange areas').diagnostics.plastic.relative_area_imbalance <= 1e-10)

    for (const [name, input, expectedCode] of errorCases()) {
      const python = runPython(input)
      assert.equal(python.exitCode, 2, `${name}: expected Python CLI validation failure`)
      assert.equal(python.payload.status, 'error', `${name}: Python error status`)
      assert.equal(python.payload.code, expectedCode, `${name}: Python error code`)
      await assert.rejects(
        calculateDemoSection(input),
        (error) => error && error.code === expectedCode,
        `${name}: browser error code`,
      )
    }
    console.log('Demo sectional calculator parity passed: Python CLI fixtures, I-section PNA edge cases, scaling, torsion convergence/status, normalized result fields, and validation codes.')
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
