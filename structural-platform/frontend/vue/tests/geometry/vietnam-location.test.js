import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { foldLocation, locationDropdownOptions, locationSnapshot, searchLocations, sourcePageUrl } from '../../src/vietnam-location/lookup.js'

const data = JSON.parse(readFileSync(new URL('../../../../standards/qcvn02-2022-locations.json', import.meta.url)))
const find = (province, name) => data.seismic.find(r => r.province_id === province && r.location === name)

test('QCVN source identity, complete coverage and non-colliding administrative paths', () => {
  assert.equal(data.source.sha256, '12cce9e43ce7c4f5e143e62239d038f5499cd6c713ab832b2e15b4a962962bce')
  assert.equal(data.source.pdf_pages, 619)
  assert.equal(data.provinces.length, 63)
  assert.equal(data.wind.length, 334)
  assert.equal(data.seismic.length, 705)
  assert.equal(new Set([...data.wind, ...data.seismic].map(r => r.id)).size, 1039)
  for (const province of data.provinces) {
    assert.ok(data.wind.some(r => r.province_id === province.id))
    assert.ok(data.seismic.some(r => r.province_id === province.id))
  }
  assert.ok(data.seismic.filter(r => r.location === 'Huyện Châu Thành').length > 5)
  for (const row of data.seismic) for (const field of ['agr', 'ss', 's1']) {
    const p = row[field]
    assert.equal(p.source.printed_page, p.source.pdf_page - 1)
    assert.ok(field === 'agr' ? p.source.pdf_page >= 71 && p.source.pdf_page <= 87 : p.source.pdf_page >= 88 && p.source.pdf_page <= 104)
    assert.equal(p.source.table, field === 'agr' ? '6.1' : '6.2')
    if (p.status === 'provided') assert.equal(p.value_g, Number(p.raw.replace('×g', '').replace(',', '.')))
    else assert.equal(p.value_g, null)
  }
})

test('independently transcribed source rows: Hanoi, Cu Chi, Hai Phong and final table page', () => {
  // Read directly from rendered physical pages 43,44,71,72,88,89,103,104.
  const baDinh = find('p01', 'Quận Ba Đình')
  assert.deepEqual([baDinh.agr.value_g, baDinh.ss.value_g, baDinh.s1.value_g], [0.10, 0.36, 0.14])
  const myDuc = find('p01', 'Huyện Mỹ Đức')
  assert.deepEqual([myDuc.agr.value_g, myDuc.ss.value_g, myDuc.s1.value_g], [0.10, 0.37, 0.15])
  assert.equal(baDinh.agr.source.pdf_page, 71)
  assert.equal(baDinh.ss.source.pdf_page, 88)
  const cuChi = find('p02', 'Huyện Củ Chi')
  assert.deepEqual([cuChi.agr.value_g, cuChi.ss.value_g, cuChi.s1.value_g], [0.06, 0.23, 0.08])
  const island = find('p03', 'Huyện Bạch Long Vĩ')
  assert.deepEqual([island.agr.value_g, island.ss.value_g, island.s1.value_g], [0.04, 0.15, 0.06])
  const islandWind = data.wind.find(r => r.province_id === 'p03' && r.location === 'Huyện Bạch Long Vĩ')
  assert.deepEqual([islandWind.zone, islandWind.w0_daN_m2, islandWind.v3s_50_m_s, islandWind.v10min_50_m_s], ['V',185,61,43])
  const vinhLoc = find('p56', 'Huyện Vĩnh Lộc')
  assert.deepEqual([vinhLoc.ss.value_g, vinhLoc.s1.value_g], [0.83,0.32])
  const final = find('p63', 'Huyện Yên Bình')
  assert.deepEqual([final.agr.value_g, final.ss.value_g, final.s1.value_g], [0.14,0.53,0.20])
  assert.equal(final.ss.source.pdf_page, 104)
})

test('split wind scopes preserve communes, exceptions, different return periods and all five zones', () => {
  const rows = data.wind.filter(r => r.province_id === 'p01' && r.location.startsWith('Huyện Mỹ Đức'))
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(r => [r.zone,r.w0_daN_m2,r.v3s_50_m_s,r.v10min_50_m_s]), [['III',125,50,36],['II',95,44,31]])
  assert.match(rows[0].location, /xã Hương Sơn/)
  assert.match(rows[1].location, /còn lại/)
  assert.deepEqual([...new Set(data.wind.map(r => r.zone))].sort(), ['I','II','III','IV','V'])
  assert.equal(data.wind.find(r => r.province_id === 'p63' && r.location === 'Huyện Văn Yên').w0_daN_m2, 65)
})

test('source ambiguities and reviewed shared scopes never become fabricated numeric values', () => {
  const vinh = find('p41', 'Thành phố Vinh')
  assert.deepEqual([vinh.ss.value_g, vinh.ss.raw, vinh.ss.status], [null, '0,38', 'source_unit_missing'])
  assert.equal(vinh.s1.value_g, 0.17)
  assert.equal(data.seismic.filter(r => r.ss.value_g === null).length, 1)
  const town = find('p59', 'Thị xã Duyên Hải'), district = find('p59', 'Huyện Duyên Hải')
  assert.equal(town.ss.value_g, 0.15)
  assert.equal(district.s1.value_g, 0.06)
  assert.deepEqual(town.ss.source, district.ss.source)
  assert.ok(town.notes.includes('duyen_hai_shared_spectral_scope'))
  const tuSon = find('p11', 'Thành phố Từ Sơn')
  assert.equal(tuSon.spectral_location, 'Thị xã Từ Sơn')
  assert.ok(tuSon.notes.includes('tu_son_labels_differ'))
})

test('accent-insensitive search keeps scope and no new-name or geographic fallback', () => {
  assert.equal(foldLocation('Đà Nẵng'), 'da nang')
  assert.ok(searchLocations(data, 'ha noi huong son').some(r => r.kind === 'wind' && r.province_id === 'p01'))
  assert.ok(searchLocations(data, 'Cu Chi').some(r => r.location === 'Huyện Củ Chi' && r.province_id === 'p02'))
  assert.equal(searchLocations(data, '').length, 0)
  assert.equal(searchLocations(data, 'khong co dia danh xyz').length, 0)
  assert.equal(searchLocations(data, 'huyen', 4).length, 4)
  assert.equal(sourcePageUrl(data, 43), data.source.url + '#page=43')
  for (const page of [0,620,43.2,'43']) assert.throws(() => sourcePageUrl(data, page))
})

test('export is a source snapshot, preserves null/status and rejects cross-province mixtures', () => {
  const before = JSON.stringify(data)
  const wind = data.wind.find(r => r.province_id === 'p01'), seismic = find('p01','Quận Ba Đình')
  const snapshot = locationSnapshot(data, { provinceId:'p01', windId:wind.id, seismicId:seismic.id })
  assert.equal(snapshot.independent_source_selections, true)
  assert.equal(snapshot.units.agr, 'g')
  assert.equal(snapshot.basis.agr,'ground-A/500y')
  assert.equal(snapshot.basis.w0,'3s/20y/10m/terrain-B')
  snapshot.wind_scope.zone = 'changed by consumer'
  snapshot.source.title = 'changed by consumer'
  assert.notEqual(wind.zone, snapshot.wind_scope.zone)
  assert.equal(data.source.title, 'QCVN 02:2022/BXD')
  assert.throws(() => locationSnapshot(data, { provinceId:'p02', seismicId:seismic.id }))
  assert.throws(() => locationSnapshot(data, { provinceId:'p01', windId:'unknown' }))
  assert.throws(() => locationSnapshot(data, { provinceId:'p01' }))
  const vinh = find('p41','Thành phố Vinh')
  assert.equal(locationSnapshot(data, { provinceId:'p41',seismicId:vinh.id }).seismic_location.ss.value_g,null)
  assert.equal(JSON.stringify(data),before)
})

test('dropdown filters narrow provinces and source rows without truncating or remapping results', () => {
  const before = JSON.stringify(data)
  const full = locationDropdownOptions(data, 'p04', '')
  assert.equal(full.provinces.length, 63)
  assert.equal(full.wind.length, 4)
  assert.equal(full.seismic.length, 8)
  const narrowed = locationDropdownOptions(data, 'p04', 'cam le')
  assert.equal(narrowed.seismic.length, 1)
  assert.equal(narrowed.seismic[0].location, 'Quận Cẩm Lệ')
  assert.equal(narrowed.wind.length, 0) // Do not infer a wind scope from district coverage.
  assert.deepEqual(narrowed.provinces.map(p => p.id), ['p04'])
  const global = locationDropdownOptions(data, '', 'Cu Chi')
  assert.deepEqual(global.provinces.map(p => p.id), ['p02'])
  assert.deepEqual(global.counts, { wind: 2, seismic: 1 })
  const empty = locationDropdownOptions(data, 'p04', 'unknownxyz')
  assert.deepEqual(empty.provinces.map(p => p.id), ['p04']) // Keep current search context.
  assert.deepEqual(empty.counts, { wind: 0, seismic: 0 })
  assert.ok(locationDropdownOptions(data, '', 'huyen').counts.seismic > 30)
  assert.deepEqual(locationDropdownOptions(data, 'p04', '  '), full)
  assert.equal(JSON.stringify(data), before)
})
