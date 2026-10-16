import test from 'node:test'
import assert from 'node:assert/strict'
import { aisc36010Equations, equationDocument } from '../../src/aisc-equation-library.mjs'

test('exact AISC reference enriches missing math without approving or mutating rows', () => {
  const original = { id: 1, label: 'E3-1', pdf_page: 95, verification_status: 'candidate', latex: null }
  const [row] = aisc36010Equations([original])
  assert.equal(row.reference_expression, 'Pn = Fcr Ag')
  assert.equal(row.verification_status, 'candidate')
  assert.equal(row.latex, null)
  assert.equal(row.pdf_page, 95)
  assert.equal(original.reference_expression, undefined)
  assert.ok(row.reference_conditions)
})
test('stored expressions win and unknown/composite labels are not inferred', () => {
  const rows = [{label:'E3-1',latex:'reviewed expression',verification_status:'verified'}, {label:'E7-4'}, {label:'B3-1'}]
  assert.deepEqual(aisc36010Equations(rows), rows)
})
test('source selects the linked artifact and rejects ambiguous or missing links', () => {
  const docs = [{id:1,kind:'specification'}, {id:2,kind:'specification'}, {id:3,kind:'commentary'}]
  assert.equal(equationDocument(docs, 2), docs[1])
  assert.equal(equationDocument(docs, '3'), docs[2])
  assert.equal(equationDocument(docs, 99), null)
  assert.equal(equationDocument(docs, null), null)
  assert.equal(equationDocument([docs[0]], null), docs[0])
})
