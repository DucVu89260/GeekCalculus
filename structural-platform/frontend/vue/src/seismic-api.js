import { request, demoMode } from './api'

export async function seismicRequest(path, body) {
  if (demoMode) throw new Error('Seismic calculations and private SAP imports require the Laravel application. GitHub Pages has no PHP backend. / Tính động đất và nhập SAP cần ứng dụng Laravel.')
  return (await request(`/api/v1/seismic${path}`, body === undefined ? {} : { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) })).data
}

export { bridgeRequest, bridgeField } from './seismic-bridge.mjs'
