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
  const iDimensions = {
    depth: 400, top_flange_width: 200, bottom_flange_width: 250, web_thickness: 8,
    top_flange_thickness: 12, bottom_flange_thickness: 16,
  }
  const scaledIDimensions = (scale) => Object.fromEntries(Object.entries(iDimensions).map(([key, value]) => [key, value * scale]))
  return [
    ...fixtures,
    ['I/H mirrored advanced properties', request('i_section', 'sharp_corner', {
      depth: 400, top_flange_width: 250, bottom_flange_width: 200, web_thickness: 8,
      top_flange_thickness: 16, bottom_flange_thickness: 12,
    }, { include_advanced: true })],
    ['I/H advanced scale base', request('i_section', 'sharp_corner', iDimensions, { include_advanced: true })],
    ['I/H advanced scale triple', request('i_section', 'sharp_corner', scaledIDimensions(3), { include_advanced: true })],
    ['I/H optional Cw overflow', request('i_section', 'sharp_corner', scaledIDimensions(1e52), { include_advanced: true })],
    ['I/H optional Cw underflow', request('i_section', 'sharp_corner', scaledIDimensions(1e-60), { include_advanced: true })],
    ['required warping constant only', request('i_section', 'sharp_corner', iDimensions, { required_properties: ['warping_constant_cw'] })],
    ['required shear center only', request('i_section', 'sharp_corner', iDimensions, { required_properties: ['shear_center'] })],
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
    ['rectangular hollow section', request('rectangular_hollow', 'sharp_corner', { width: 100, height: 200, thickness: 5 }, { include_advanced: true })],
    ['thin rectangular hollow section', request('rectangular_hollow', 'sharp_corner', { width: 100, height: 200, thickness: 1e-9 })],
    ['circular hollow section with exact polar moment', request('circular_hollow', 'uniform_wall', { diameter: 100, thickness: 5 }, { include_advanced: true })],
    ['thin circular hollow section', request('circular_hollow', 'uniform_wall', { diameter: 100, thickness: 1e-12 }, { include_advanced: true })],
    ['channel with left web', request('channel', 'sharp_corner', { depth: 200, width: 75, web_thickness: 8, flange_thickness: 10 }, { include_advanced: true })],
    ['tee with centered web', request('tee', 'sharp_corner', { depth: 200, width: 100, web_thickness: 8, flange_thickness: 12 }, { include_advanced: true })],
    ['angle with signed product inertia', request('angle', 'sharp_corner', { depth: 200, width: 100, thickness: 10 }, { include_advanced: true })],
    ['scaled angle', request('angle', 'sharp_corner', { depth: 600, width: 300, thickness: 30 })],
    ['back-to-back double angle with ideal heel link', request('double_angle', 'back_to_back', { depth: 200, width: 100, thickness: 10, distance: 40 }, { include_advanced: true })],
    ['double angle zero-gap perimeter union', request('double_angle', 'back_to_back', { depth: 200, width: 100, thickness: 10, distance: 0 }, { include_advanced: true })],
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
    ['impossible rectangular hollow proportions', request('rectangular_hollow', 'sharp_corner', { width: 100, height: 200, thickness: 50 }), 'INVALID_GEOMETRY'],
    ['impossible channel proportions', request('channel', 'sharp_corner', { depth: 100, width: 40, web_thickness: 40, flange_thickness: 10 }), 'INVALID_GEOMETRY'],
    ['wrong circular hollow variant', request('circular_hollow', 'sharp_corner', { diameter: 100, thickness: 5 }), 'UNSUPPORTED_VARIANT'],
    ['unknown required property', request('rectangle', 'solid', { width: 20, height: 10 }, { required_properties: ['not_a_property'] }), 'UNSUPPORTED_PROPERTY'],
    ['negative double-angle clear gap', request('double_angle', 'back_to_back', { depth: 200, width: 100, thickness: 10, distance: -1 }), 'INVALID_DIMENSION'],
    ['wrong double-angle variant', request('double_angle', 'sharp_corner', { depth: 200, width: 100, thickness: 10, distance: 40 }), 'UNSUPPORTED_VARIANT'],
    ['I/H required Cw numerical range', request('i_section', 'sharp_corner', {
      depth: 400e52, top_flange_width: 200e52, bottom_flange_width: 250e52, web_thickness: 8e52,
      top_flange_thickness: 12e52, bottom_flange_thickness: 16e52,
    }, { required_properties: ['warping_constant_cw'] }), 'CALCULATION_ERROR'],
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

function assertIAdvancedScale(base, triple) {
  const ratio = (property) => {
    const allowed = absoluteTolerance + relativeTolerance * Math.max(Math.abs(property.actual), Math.abs(property.expected))
    assert.ok(Math.abs(property.actual - property.expected) <= allowed, `${property.name} scaling: expected ${property.expected}, got ${property.actual}`)
  }
  ratio({ name: 'I/H warping constant', actual: triple.advanced.warping_constant_cw.value / base.advanced.warping_constant_cw.value, expected: 3 ** 6 })
  ratio({ name: 'I/H shear center x', actual: triple.advanced.shear_center.value.x / base.advanced.shear_center.value.x, expected: 3 })
  ratio({ name: 'I/H shear center y', actual: triple.advanced.shear_center.value.y / base.advanced.shear_center.value.y, expected: 3 })
  ratio({ name: 'I/H shear center y offset', actual: triple.advanced.shear_center.value.offset_y / base.advanced.shear_center.value.offset_y, expected: 3 })
  ratio({ name: 'I/H effective area x', actual: triple.advanced.effective_shear_area.value.x / base.advanced.effective_shear_area.value.x, expected: 3 ** 2 })
  ratio({ name: 'I/H effective area y', actual: triple.advanced.effective_shear_area.value.y / base.advanced.effective_shear_area.value.y, expected: 3 ** 2 })
}

async function main() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'geekcalculus-demo-engine-'))
  const bundlePath = path.join(tempDirectory, 'demo-calculator.cjs')
  try {
    esbuild.buildSync({
      entryPoints: [path.join(root, 'section-properties/core/calculator.ts')],
      nodePaths: [path.join(root, 'frontend/vue/node_modules')],
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
    assertIAdvancedScale(outputs.get('I/H advanced scale base'), outputs.get('I/H advanced scale triple'))
    assert.equal(outputs.get('square rectangle torsion').advanced.torsion_constant_j.status, 'computed')
    const squareJ = outputs.get('square rectangle torsion')
    const squareJError = Math.abs(squareJ.advanced.torsion_constant_j.value - 0.1405770149551536)
    const squareJBudget = squareJ.diagnostics.torsion.truncation_abs_error_bound + squareJ.diagnostics.torsion.floating_point_abs_error_estimate
    assert.ok(squareJError <= squareJBudget, `square rectangle torsion reference error ${squareJError} exceeds reported bound ${squareJBudget}`)
    assert.equal(outputs.get('explicit optional torsion non-convergence').advanced.torsion_constant_j.reason, 'convergence_not_achieved')
    assert.equal(outputs.get('bottom-flange PNA').properties.plastic.pna_y, 21.92)
    assert.equal(outputs.get('top-flange PNA').properties.plastic.pna_y, 78.08)
    assert.ok(outputs.get('thin web with nearly balanced flange areas').diagnostics.plastic.relative_area_imbalance <= 1e-10)
    assert.equal(outputs.get('required warping constant only').advanced.warping_constant_cw.status, 'computed')
    assert.equal(outputs.get('required warping constant only').advanced.shear_center.reason, 'not_requested')
    assert.equal(outputs.get('required shear center only').advanced.warping_constant_cw.reason, 'not_requested')
    for (const name of ['I/H optional Cw overflow', 'I/H optional Cw underflow']) {
      const ranged = outputs.get(name)
      assert.equal(ranged.advanced.warping_constant_cw.reason, 'numerical_range')
      assert.equal(ranged.advanced.shear_center.status, 'computed')
      assert.equal(ranged.advanced.effective_shear_area.status, 'computed')
      assert.ok(ranged.properties.elastic.ix > 0 && ranged.properties.elastic.iy > 0)
    }

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
    console.log('Demo sectional calculator parity passed: all nine geometry types, polygonal PNA cases, advanced-property availability, scaling, torsion status, normalized results, and validation codes.')
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
