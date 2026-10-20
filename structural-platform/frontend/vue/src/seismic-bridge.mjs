export function bridgeField(block, name) {
  const data = block?.data || {}
  const key = Object.keys(data).find(k => k.toLowerCase() === name.toLowerCase())
  const value = data[key]
  // Runtime reflection may supply {value: …} field wrappers.
  return value && typeof value === 'object' && 'value' in value ? value.value : value
}

export async function bridgeRequest(base, token, path, body) {
  const url = new URL(base)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Use the local SAP2000 V2 connector URL (http://127.0.0.1:8010).')
  if (!token || token.length < 32) throw new Error('Enter the V2 connector bearer token. It stays in memory for this page only.')
  const response = await fetch(`${url.origin}/API_IF_SAP26.2.0_V2${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.detail || `SAP bridge HTTP ${response.status}`)
  return result
}
