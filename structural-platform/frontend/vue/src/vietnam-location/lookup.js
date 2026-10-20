// Source-table selection only: no design factors, administrative remapping or solver.
export function foldLocation(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function searchLocations(data, query, limit = 30) {
  const tokens = foldLocation(query).split(' ').filter(Boolean)
  if (!tokens.length) return []
  const provinces = new Map(data.provinces.map(p => [p.id, p.name]))
  const rows = [...data.seismic.map(row => ({ ...row, kind: 'seismic' })),
    ...data.wind.map(row => ({ ...row, kind: 'wind' }))]
  return rows.filter(row => {
    const text = foldLocation(`${provinces.get(row.province_id)} ${row.location} ${row.spectral_location || ''}`)
    return tokens.every(token => text.includes(token))
  }).slice(0, limit)
}

export function sourcePageUrl(data, page) {
  if (!Number.isInteger(page) || page < 1 || page > data.source.pdf_pages) throw new Error('Invalid source page')
  return `${data.source.url}#page=${page}`
}

export function locationSnapshot(data, { provinceId, windId = '', seismicId = '' }) {
  const province = data.provinces.find(row => row.id === provinceId)
  if (!province) throw new Error('Choose a source province')
  const wind = windId ? data.wind.find(row => row.id === windId) : null
  const seismic = seismicId ? data.seismic.find(row => row.id === seismicId) : null
  if ((windId && !wind) || (seismicId && !seismic) ||
      [wind, seismic].some(row => row && row.province_id !== provinceId)) throw new Error('Selection scope mismatch')
  if (!wind && !seismic) throw new Error('Choose a source record')
  return structuredClone({
    format: 'geekcalculus-vietnam-location-reference', version: 1,
    dataset_version: data.dataset_version, source: data.source, province,
    independent_source_selections: true, wind_scope: wind, seismic_location: seismic,
    units: { w0: 'daN/m2', v3s_50: 'm/s', v10min_50: 'm/s', agr: 'g', ss: 'g', s1: 'g' },
    basis: { w0: '3s/20y/10m/terrain-B', velocities: '50y/10m/terrain-B',
      agr: 'ground-A/500y', ss_s1: 'ground-B/2500y/5%-damping/0.2s-and-1s' },
  })
}
