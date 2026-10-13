import { demoRequest } from './demo-api'
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
let csrfToken = null
export function clearSessionToken() { csrfToken = null }
export async function request(path, options = {}) {
  if (demoMode) {
    try { return await demoRequest(path, options) } catch (error) {
      if (error.status === 401) window.dispatchEvent(new Event('geekcalculus-session-expired'))
      throw error
    }
  }
  const method = options.method || 'GET'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !csrfToken) {
    const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Cannot initialize session')
    csrfToken = (await response.json()).csrf_token
  }
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-CSRF-TOKEN': csrfToken } : {}), ...options.headers }
  const response = await fetch(path, { ...options, credentials: 'same-origin', headers })
  const payload = await response.json().catch(() => ({}))
  if (payload.csrf_token) csrfToken = payload.csrf_token
  if (!response.ok) {
    if ([419, 401].includes(response.status)) csrfToken = null
    const error = new Error(payload.message || `HTTP ${response.status}`)
    error.status = response.status; error.errors = payload.errors || {}
    if (response.status === 401) window.dispatchEvent(new Event('geekcalculus-session-expired'))
    throw error
  }
  return payload
}
