// Browser I/O only; CFSA processing stays in the original Python modules.
const worker = new Worker(new URL('./python-worker.js', import.meta.url), { type: 'module' })
const requests = new Map()
let nextId = 1
let sourceFile = null
let importedFile = null
let sectionFiles = []
let busy = false
const scope = new URL(location.href).searchParams.get('scope') || 'browser'
const draftKey = 'geekcalculus-cfs-draft-v3:' + scope
const element = id => document.getElementById(id)

function call(payload) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    requests.set(id, { resolve, reject })
    worker.postMessage({ id, payload })
  })
}
worker.onmessage = ({ data }) => {
  const pending = requests.get(data.id)
  if (!pending) return
  requests.delete(data.id)
  if (data.ok) pending.resolve(data.result)
  else pending.reject(new Error(data.error))
}
worker.onerror = () => {
  for (const pending of requests.values()) pending.reject(new Error('Python worker không khả dụng. Tải lại trang để thử lại.'))
  requests.clear()
}
function base64(bytes) {
  let text = ''
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return btoa(text)
}
async function encoded(file) { return { name: file.name, data: base64(new Uint8Array(await file.arrayBuffer())) } }
function choose(id) {
  const input = element(id)
  input.value = ''
  return new Promise(resolve => {
    input.onchange = () => resolve([...input.files])
    input.oncancel = () => resolve([])
    input.click()
  })
}
function download(data, name) {
  const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function setBusy(value) {
  busy = value
  element('cfs-busy').hidden = !value
  element('cfs-workspace').inert = value
}
function announceHeight() {
  // Use intrinsic content height so a tall mobile viewport can shrink on desktop.
  if (parent !== window) parent.postMessage({ type: 'gc-cfs-height', height: Math.ceil(document.body.getBoundingClientRect().height) + 24 }, location.origin)
}
new ResizeObserver(announceHeight).observe(document.body)

export async function request(url, method = 'GET', body) {
  if (busy) throw new Error('Đang xử lý, vui lòng chờ.')
  if (url === '/api/choose-cfsa') {
    const files = await choose('cfsa-picker')
    if (!files.length) return { cancelled: true }
    if (!files[0].name.toLowerCase().endsWith('.cfsa') || files[0].size > 10_000_000) throw new Error('Chọn file .cfsa tối đa 10 MB.')
    sourceFile = files[0]
    return { path: sourceFile.name, cancelled: false }
  }
  setBusy(true)
  try {
    if (url === '/api/import-cfsa') {
      if (!sourceFile) throw new Error('Chọn lại file CFSA gốc trước khi Import.')
      const result = await call({ op: 'import', ...await encoded(sourceFile), sections: await Promise.all(sectionFiles.map(encoded)) })
      importedFile = sourceFile
      return result
    }
    if (url === '/api/export-cfsa-test') {
      if (!sourceFile || sourceFile !== importedFile) throw new Error('Import lại CFSA gốc và SECTIONS trước khi xuất bản sao.')
      const result = await call({ op: 'export', draft: body.draft, acknowledge: body.acknowledge })
      download(result.data, result.output)
      delete result.data
      return result
    }
    if (url === '/api/draft') {
      if (method === 'PUT') {
        const result = await call({ op: 'validate-draft', draft: body })
        localStorage.setItem(draftKey, JSON.stringify(result))
        return { ok: true, cfs_unchanged: true }
      }
      const text = localStorage.getItem(draftKey)
      if (!text) throw new Error('Chưa có bản nháp được lưu trong trình duyệt này.')
      return await call({ op: 'validate-draft', draft: JSON.parse(text) })
    }
    throw new Error('Thao tác không được hỗ trợ.')
  } finally { setBusy(false); announceHeight() }
}

element('chooseSections').onclick = async () => {
  try {
    const files = await choose('sections-picker')
    if (!files.length) return
    const sections = files.filter(file => file.name.toLowerCase().endsWith('.cfss'))
    if (!sections.length) throw new Error('Thư mục không có file .cfss.')
    if (sections.length > 2000 || sections.reduce((size, file) => size + file.size, 0) > 50_000_000) throw new Error('Tối đa 2000 file .cfss, tổng 50 MB.')
    const names = sections.map(file => file.name.toLowerCase())
    if (new Set(names).size !== names.length) throw new Error('Có tên file Section bị trùng; chọn đúng thư mục SECTIONS của mô hình.')
    sectionFiles = sections
    element('section-selection').textContent = `${sections.length} file .cfss đã chọn. Nhấn Import .cfsa để nạp cùng mô hình (thay thế bản nháp đang chỉnh).`
  } catch (error) { element('section-selection').textContent = error.message }
}

// Draft JSON backup restore is explicit; never execute or trust it as Python.
element('importJson').onclick = async () => {
  const files = await choose('draft-picker')
  if (!files.length) return
  try {
    if (files[0].size > 2_000_000) throw new Error('JSON tối đa 2 MB.')
    const draft = JSON.parse(await files[0].text())
    await request('/api/draft', 'PUT', draft)
    element('loadDraft').click()
  } catch (error) { element('status').textContent = error.message }
}

setBusy(true)
call({ op: 'ready' }).then(() => {
  element('runtime-status').textContent = 'Python sẵn sàng · Xử lý file hoàn toàn trong trình duyệt'
}).catch(error => {
  element('runtime-status').textContent = error.message
}).finally(() => setBusy(false))
