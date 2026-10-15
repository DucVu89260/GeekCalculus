import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateHISectionProperties } from '../../public/hi-section-properties-core.mjs'

const sample = {h_mm:940,bf_mm:250,tw_mm:6,tf_mm:12}
const legacy = {area_mm2:11496,ix_mm4:1676135648}

test('symmetric I/H shares the canonical Section Properties solver and versioned formula report', async () => {
  const r = await calculateHISectionProperties(sample,legacy)
  assert.equal(r.source,'Section Properties shared numerical core')
  assert.equal(r.geometry_type,'i_section')
  assert.equal(r.verification,'GEOMETRY_ONLY_NOT_AISC_CAPACITY_CERTIFICATION')
  assert.equal(r.canonical.area_mm2,11496)
  assert.ok(Math.abs(r.canonical.ix_mm4-1676135648)<1e-4)
  assert.ok(r.canonical.iy_mm4>0)
  assert.ok(r.canonical.zx_mm3>0)
  assert.ok(r.canonical.zy_mm3>0)
  assert.ok(r.canonical.torsion_constant_j_mm4>0)
  assert.ok(r.canonical.warping_constant_cw_mm6>0)
  assert.ok(r.canonical.effective_shear_area_x_mm2>0)
  assert.ok(r.canonical.effective_shear_area_y_mm2>0)
  assert.ok(r.entries.length>=70, 'all formula registry entries must be forwarded')
  assert.ok(r.entries.some(row=>row.key==='advanced.warping_constant_cw'))
  assert.ok(r.entries.some(row=>row.key==='mechanics.advanced.torsion.modulus_mm3'))
  assert.ok(r.entries.some(row=>row.key==='mechanics.advanced.shear.modulus_x_mm2'))
  assert.ok(r.entries.some(row=>row.key==='mechanics.geometry.third_moments.m30_mm5'))
  assert.ok(r.entries.some(row=>row.key==='geometric.area' && row.formula && row.substitution))
  assert.match(r.formula_manifest_hash,/^[a-f0-9]{64}$/)
  assert.ok(r.comparisons.some(row=>row.key==='area_mm2' && row.matching))
  assert.ok(r.comparisons.some(row=>row.key==='ix_mm4' && row.matching))
})

test('changing dimensions recalculates shared geometry rather than retaining fixture values', async () => {
  const r=await calculateHISectionProperties({h_mm:600,bf_mm:200,tw_mm:8,tf_mm:14})
  assert.equal(r.canonical.area_mm2,2*200*14+(600-28)*8)
  assert.ok(r.canonical.rx_mm>0)
  assert.ok(r.canonical.ry_mm>0)
  assert.equal(r.comparisons.length,0)
})

test('invalid I/H dimensions do not produce artificial geometry', async () => {
  await assert.rejects(()=>calculateHISectionProperties({h_mm:20,bf_mm:250,tw_mm:6,tf_mm:12}),/Invalid doubly symmetric/)
  await assert.rejects(()=>calculateHISectionProperties({h_mm:940,bf_mm:250,tw_mm:-6,tf_mm:12}),/Invalid H\/I geometry/)
  await assert.rejects(()=>calculateHISectionProperties({h_mm:940,bf_mm:250,tw_mm:350,tf_mm:12}),/Invalid doubly symmetric/)
})
