import { loadPyodide } from '../cfs-runtime/pyodide.mjs'

let loading
async function runtime() {
  if (!loading) loading = (async () => {
    const python = await loadPyodide({ indexURL: new URL('../cfs-runtime/', import.meta.url).href })
    python.FS.mkdirTree('/cfs-python')
    for (const file of ['cfsa_reader.py', 'adapter.py', 'cfsa_patch.py', 'cfsa_insert.py', 'browser_api.py']) {
      const response = await fetch(new URL('python/' + file, import.meta.url))
      if (!response.ok) throw new Error('Không tải được CFS Python: ' + file)
      python.FS.writeFile('/cfs-python/' + file, await response.text())
    }
    python.runPython("import sys; sys.path.insert(0, '/cfs-python'); from browser_api import dispatch")
    return python
  })().catch(error => { loading = null; throw error })
  return loading
}

// Serialize commands because the interpreter and virtual project are shared.
let queue = Promise.resolve()
self.onmessage = event => {
  const { id, payload } = event.data
  queue = queue.then(async () => {
    try {
      const python = await runtime()
      if (payload.op === 'ready') { self.postMessage({ id, ok: true, result: { ready: true } }); return }
      python.globals.set('cfs_request_json', JSON.stringify(payload))
      try {
        const result = JSON.parse(python.runPython('dispatch(cfs_request_json)'))
        self.postMessage({ id, ...result })
      } finally { python.globals.delete('cfs_request_json') }
    } catch {
      self.postMessage({ id, ok: false, error: 'Không khởi chạy được Python trong trình duyệt. Kiểm tra tải runtime và thử tải lại trang.' })
    }
  })
}
