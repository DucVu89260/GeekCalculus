import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalogSectionCalculationRequest, catalogSectionInputProperties } from '../../src/sectional-properties/catalog-payload.js'

test('catalog geometry names map to canonical solver request names for all supported shapes', () => {
  const cases = [
    ['rectangle', { depth: 200, width: 100 }, 'rectangle', 'solid', { width: 100, height: 200 }],
    ['circle', { diameter: 100 }, 'circle', 'solid', { diameter: 100 }],
    ['rectangular_hollow', { depth: 200, width: 100, thickness: 5 }, 'rectangular_hollow', 'sharp_corner', { width: 100, height: 200, thickness: 5 }],
    ['circular_hollow', { diameter: 100, thickness: 5 }, 'circular_hollow', 'uniform_wall', { diameter: 100, thickness: 5 }],
    ['channel', { depth: 200, width: 75, web_thickness: 6, flange_thickness: 8 }, 'channel', 'sharp_corner', { depth: 200, width: 75, web_thickness: 6, flange_thickness: 8 }],
    ['tee', { depth: 200, width: 75, web_thickness: 6, flange_thickness: 8 }, 'tee', 'sharp_corner', { depth: 200, width: 75, web_thickness: 6, flange_thickness: 8 }],
    ['angle', { depth: 200, width: 100, thickness: 8 }, 'angle', 'sharp_corner', { depth: 200, width: 100, thickness: 8 }],
  ]
  for (const [shape, properties, type, geometryVariant, dimensions] of cases) {
    const request = buildCatalogSectionCalculationRequest(shape, properties)
    assert.deepEqual(request, {
      geometry: { type, geometry_variant: geometryVariant, geometry_model_version: '1.0.0', dimensions },
      units: 'mm', options: { include_plastic: true, include_advanced: true },
    }, shape)
  }
})

test('symmetric and asymmetric I-sections use mutually exclusive catalog dimensions', () => {
  const symmetric = buildCatalogSectionCalculationRequest('i', { depth: 300, width: 150, web_thickness: 8, flange_thickness: 12 })
  assert.deepEqual(symmetric.geometry.dimensions, {
    depth: 300, top_flange_width: 150, bottom_flange_width: 150, web_thickness: 8,
    top_flange_thickness: 12, bottom_flange_thickness: 12,
  })
  const asymmetric = buildCatalogSectionCalculationRequest('i', {
    depth: 300, web_thickness: 8, top_flange_width: 160, bottom_flange_width: 140,
    top_flange_thickness: 14, bottom_flange_thickness: 10,
  })
  assert.deepEqual(asymmetric.geometry.dimensions, {
    depth: 300, web_thickness: 8, top_flange_width: 160, bottom_flange_width: 140,
    top_flange_thickness: 14, bottom_flange_thickness: 10,
  })
  const mixedInput = {
    depth: 300, width: 150, web_thickness: 8, flange_thickness: 12,
    top_flange_width: 160, bottom_flange_width: 140, top_flange_thickness: 14, bottom_flange_thickness: 10,
  }
  assert.deepEqual(buildCatalogSectionCalculationRequest('i', mixedInput).geometry.dimensions, {
    depth: 300, web_thickness: 8, top_flange_width: 160, bottom_flange_width: 140,
    top_flange_thickness: 14, bottom_flange_thickness: 10,
  }, 'Asymmetric dimensions take precedence over optional symmetric legacy fields')
  assert.equal(buildCatalogSectionCalculationRequest('i', {
    depth: 300, width: 150, web_thickness: 8, flange_thickness: 12, top_flange_width: 160,
  }), null, 'A partial asymmetric set remains invalid')
  assert.deepEqual(catalogSectionInputProperties('i', mixedInput), {
    depth: 300, web_thickness: 8, top_flange_width: 160, bottom_flange_width: 140,
    top_flange_thickness: 14, bottom_flange_thickness: 10,
  }, 'Saved asymmetric records discard stale symmetric dimensions')
})

test('section input payload keeps geometry and auxiliary inputs while dropping derived legacy properties', () => {
  const properties = catalogSectionInputProperties('rectangle', {
    depth: 200, width: 100, area: 20000, inertia_y: 1e7, elastic_modulus_y: 1e5,
    concrete_cover: 25, area_modifier: 0.8,
  }, [
    { key: 'depth' }, { key: 'width' }, { key: 'area' }, { key: 'inertia_y' },
    { key: 'elastic_modulus_y' }, { key: 'concrete_cover' }, { key: 'area_modifier' },
  ])
  assert.deepEqual(properties, { depth: 200, width: 100, concrete_cover: 25, area_modifier: 0.8 })
})
