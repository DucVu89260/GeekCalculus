import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSectionProperties } from '../../src/geometry/index.js'

// Independent boundary integration: no section-specific engine formulas.
function integrate(vertices) {
  let area = 0, mx = 0, my = 0, ix = 0, iy = 0, perimeter = 0
  for (let i = 0; i < vertices.length; i++) {
    const [x, y] = vertices[i]
    const [u, v] = vertices[(i + 1) % vertices.length]
    const cross = x * v - u * y
    area += cross / 2
    mx += (x + u) * cross / 6
    my += (y + v) * cross / 6
    ix += (y * y + y * v + v * v) * cross / 12
    iy += (x * x + x * u + u * u) * cross / 12
    perimeter += Math.hypot(u - x, v - y)
  }
  return { area, mx, my, ix, iy, perimeter }
}

function upperHalf(vertices, axis, cut) {
  const clipped = []
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length]
    const insideA = a[axis] >= cut, insideB = b[axis] >= cut
    if (insideA) clipped.push(a)
    if (insideA !== insideB) {
      const t = (cut - a[axis]) / (b[axis] - a[axis])
      clipped.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
  }
  return integrate(clipped)
}

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.abs(expected), `${actual} != ${expected}`)
}

function compare(input, polygon, tolerance) {
  const actual = calculateSectionProperties(input)
  const ref = integrate(polygon)
  const cx = ref.mx / ref.area, cy = ref.my / ref.area
  const ix = ref.ix - ref.area * cy ** 2, iy = ref.iy - ref.area * cx ** 2
  const top = upperHalf(polygon, 1, cy), right = upperHalf(polygon, 0, cx)
  close(actual.A, ref.area, tolerance)
  close(actual.perimeter, ref.perimeter, tolerance)
  close(actual.centroid.x, cx, tolerance)
  close(actual.centroid.y, cy, tolerance)
  close(actual.Ix, ix, tolerance)
  close(actual.Iy, iy, tolerance)
  close(top.area, ref.area / 2, tolerance)
  close(right.area, ref.area / 2, tolerance)
  close(actual.pna.aboutX.value, cy, tolerance)
  close(actual.pna.aboutY.value, cx, tolerance)
  close(actual.Zx.positive, 2 * (top.my - cy * top.area), tolerance)
  close(actual.Zy.positive, 2 * (right.mx - cx * right.area), tolerance)
  close(actual.Sx.positive, ix / cy, tolerance)
  close(actual.Sy.positive, iy / cx, tolerance)
  close(actual.rx, Math.sqrt(ix / ref.area), tolerance)
  close(actual.ry, Math.sqrt(iy / ref.area), tolerance)
  close(actual.principalInertia.major, Math.max(ix, iy), tolerance)
  close(actual.principalInertia.minor, Math.min(ix, iy), tolerance)
}

test('rectangle properties agree with independent boundary integrals across aspect ratios', () => {
  for (const [b, h] of [[120, 240], [320, 40], [0.2, 0.7]]) {
    compare({ shape: 'rectangle', unit: 'mm', dimensions: { b, h } }, [[0, 0], [b, 0], [b, h], [0, h]])
  }
})

test('I/H properties and plastic moduli agree with clipped polygon integrals', () => {
  for (const [b, h, tw, tf] of [[200, 300, 10, 20], [400, 100, 15, 12], [80, 600, 5, 7]]) {
    const left = (b - tw) / 2, right = (b + tw) / 2
    const polygon = [[0, 0], [b, 0], [b, tf], [right, tf], [right, h - tf], [b, h - tf], [b, h], [0, h], [0, h - tf], [left, h - tf], [left, tf], [0, tf]]
    compare({ shape: 'i-h', unit: 'mm', dimensions: { b, h, tw, tf } }, polygon)
  }
})

test('circle properties agree with converged 8192-edge boundary integration', () => {
  const radius = 50
  const polygon = Array.from({ length: 8192 }, (_, i) => {
    const theta = 2 * Math.PI * i / 8192
    return [radius + radius * Math.cos(theta), radius + radius * Math.sin(theta)]
  })
  compare({ shape: 'circle', unit: 'mm', dimensions: { D: 100 } }, polygon, 3e-7)
})
