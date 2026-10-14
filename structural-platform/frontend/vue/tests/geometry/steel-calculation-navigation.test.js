import test from 'node:test'
import assert from 'node:assert/strict'
import { parseModuleRoute } from '../../src/modules.js'

test('Steel Design parent route remains available', () => {
  assert.deepEqual(parseModuleRoute('#/modules/steel'), { module:'steel', detail:null })
})

test('AISC 360-10 symmetric I/H opens as a dedicated module page', () => {
  assert.deepEqual(parseModuleRoute('#/modules/steel/components/symmetric-i/aisc-360-10'),
    { module:'steel', detail:'symmetric-i/aisc-360-10' })
})

test('unimplemented standards cannot be opened by URL', () => {
  for (const code of ['aisc-360-16', 'aisc-360-22', 'en-1993']) {
    assert.deepEqual(parseModuleRoute('#/modules/steel/components/symmetric-i/' + code),
      { module:null, detail:null })
  }
})

test('unsupported or malformed deep links do not resolve', () => {
  for (const hash of ['#/modules/concrete/components/symmetric-i/aisc-360-10', '#/modules/steel/components/symmetric-i/unknown', '#/modules/steel/anything-else', '#/modules/unknown']) {
    assert.deepEqual(parseModuleRoute(hash), { module:null, detail:null })
  }
})

test('unrelated module URLs stay valid', () => {
  for (const code of ['concrete','loads','library','future','analysis']) {
    assert.deepEqual(parseModuleRoute('#/modules/' + code), { module:code, detail:null })
  }
})
