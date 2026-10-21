import { demoMode, request } from './api'

const MAX_BYTES = 20 * 1024 * 1024
const endpoint = '/api/v1/personal-pdf-notes'
let database
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const opening = indexedDB.open('geekcalculus-personal-pdf-notes', 1)
    opening.onupgradeneeded = () => {
      const store = opening.result.createObjectStore('notes', { keyPath: 'key' })
      store.createIndex('owner', 'owner')
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => { database = null; reject(opening.error) }
    opening.onblocked = () => { database = null; reject(new Error('STORAGE_UNAVAILABLE')) }
  })
  return database
}
async function transaction(mode, operation) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', mode)
    const result = operation(tx.objectStore('notes'))
    tx.oncomplete = () => resolve(result.result)
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('STORAGE_UNAVAILABLE'))
  })
}
function ownerKey(owner) {
  if (owner === null || owner === undefined || !String(owner)) throw new Error('SESSION_REQUIRED')
  return String(owner)
}
const metadata = ({ file, key, owner, ...note }) => note
async function localNote(owner, id) {
  const note = await transaction('readonly', store => store.get(`${ownerKey(owner)}:${id}`))
  if (!note) throw new Error('NOTE_NOT_FOUND')
  return note
}
export async function validateNotePdf(file, limit = MAX_BYTES) {
  if (!file || !/\.pdf$/i.test(file.name) || !file.size || file.size > limit || await file.slice(0, 5).text() !== '%PDF-') {
    throw new Error('INVALID_PDF')
  }
}
export async function listPersonalPdfNotes(owner) {
  if (!demoMode) return request(endpoint)
  const rows = await transaction('readonly', store => store.index('owner').getAll(ownerKey(owner)))
  return { data: rows.map(metadata).sort((a, b) => b.created_at.localeCompare(a.created_at)), meta: { upload_limit_bytes: MAX_BYTES } }
}
export async function uploadPersonalPdfNote(owner, file, title, description) {
  if (!demoMode) {
    const body = new FormData()
    body.append('file', file); body.append('title', title); body.append('description', description)
    return request(endpoint, { method: 'POST', body })
  }
  await validateNotePdf(file)
  const id = crypto.randomUUID(), now = new Date().toISOString()
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const row = { key: `${ownerKey(owner)}:${id}`, owner: ownerKey(owner), id, title: title.trim(), description: description.trim(),
    original_name: file.name, size_bytes: file.size, sha256, created_at: now, updated_at: now, file }
  await transaction('readwrite', store => store.add(row))
  return { data: metadata(row) }
}
export async function updatePersonalPdfNote(owner, id, title, description) {
  if (!demoMode) return request(`${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title, description }) })
  const row = { ...await localNote(owner, id), title: title.trim(), description: description.trim(), updated_at: new Date().toISOString() }
  await transaction('readwrite', store => store.put(row))
  return { data: metadata(row) }
}
export async function removePersonalPdfNote(owner, id) {
  if (!demoMode) return request(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  const row = await localNote(owner, id)
  await transaction('readwrite', store => store.delete(row.key))
}
export async function personalPdfFile(owner, note) {
  if (!demoMode) return { url: `${endpoint}/${encodeURIComponent(note.id)}/file`, revoke: false }
  const row = await localNote(owner, note.id)
  return { url: URL.createObjectURL(row.file), revoke: true }
}
