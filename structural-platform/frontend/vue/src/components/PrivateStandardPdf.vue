<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const props = defineProps({
  editionCode: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  documentId: { type: [Number, String], default: null },
  page: { type: Number, default: 1 },
  pageCount: { type: Number, default: null },
  printedPage: { type: [Number, String], default: null },
  locale: { type: String, default: 'en' },
})
const emit = defineEmits(['pagechange'])

const canvas = ref(null)
const viewport = ref(null)
const pdfDocument = shallowRef(null)
const loading = ref(false)
const loadError = ref('')
const actualPageCount = ref(0)
const currentPage = ref(Number(props.page) || 1)
const words = computed(() => props.locale === 'vi' ? {
  title: 'Tài liệu nguồn riêng tư', previous: 'Trang trước', next: 'Trang sau', go: 'Đi đến trang PDF',
  of: 'trên', physical: 'Trang PDF', printed: 'Trang in', loading: 'Đang tải PDF riêng tư…',
  missing: 'Chưa có tài liệu nguồn riêng tư cho phiên bản này.', failed: 'Không thể tải tài liệu nguồn. Hãy kiểm tra quyền truy cập hoặc trạng thái nhập tài liệu.',
  retry: 'Tải lại', pageInput: 'Số trang PDF',
} : {
  title: 'Private source document', previous: 'Previous page', next: 'Next page', go: 'Go to PDF page',
  of: 'of', physical: 'PDF page', printed: 'Printed page', loading: 'Loading private PDF…',
  missing: 'No private source document is registered for this edition.', failed: 'Could not load the source document. Check access or document import status.',
  retry: 'Retry', pageInput: 'PDF page number',
})

const documentUrl = computed(() => props.fileUrl || (props.editionCode && props.documentId
  ? `/api/v1/standards/${encodeURIComponent(props.editionCode)}/documents/${encodeURIComponent(props.documentId)}/file`
  : ''))
const shownPageCount = computed(() => actualPageCount.value || Number(props.pageCount) || 0)
const pageLabel = computed(() => `${words.value.physical} ${currentPage.value}${shownPageCount.value ? ` ${words.value.of} ${shownPageCount.value}` : ''}`)

let loadTask = null
let renderTask = null
let resizeObserver = null
let loadSequence = 0
let renderSequence = 0
let isUnmounted = false

function boundedPage(page) {
  const requested = Number(page)
  const safe = Number.isFinite(requested) ? Math.trunc(requested) : 1
  const maximum = shownPageCount.value || Number.MAX_SAFE_INTEGER
  return Math.max(1, Math.min(maximum, safe))
}

function cancelRender() {
  if (!renderTask) return
  try { renderTask.cancel() } catch { /* a finished render cannot be cancelled */ }
  renderTask = null
}

function clearCanvas() {
  if (!canvas.value) return
  const context = canvas.value.getContext('2d')
  context?.clearRect(0, 0, canvas.value.width, canvas.value.height)
  canvas.value.width = 0
  canvas.value.height = 0
}

async function renderCurrentPage() {
  const drawing = ++renderSequence
  cancelRender()
  if (!pdfDocument.value || !canvas.value || !viewport.value || loading.value || loadError.value) return
  const targetPage = boundedPage(currentPage.value)
  if (targetPage !== currentPage.value) currentPage.value = targetPage
  try {
    const page = await pdfDocument.value.getPage(targetPage)
    if (drawing !== renderSequence || isUnmounted) return
    const base = page.getViewport({ scale: 1 })
    const availableWidth = Math.max(260, viewport.value.clientWidth - 24)
    const scale = Math.min(1.6, availableWidth / base.width)
    const view = page.getViewport({ scale })
    const outputScale = Math.min(window.devicePixelRatio || 1, 2.5)
    const context = canvas.value.getContext('2d', { alpha: false })
    canvas.value.width = Math.ceil(view.width * outputScale)
    canvas.value.height = Math.ceil(view.height * outputScale)
    canvas.value.style.width = `${Math.ceil(view.width)}px`
    canvas.value.style.height = `${Math.ceil(view.height)}px`
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0)
    const task = page.render({ canvasContext: context, viewport: view })
    renderTask = task
    await task.promise
    if (drawing === renderSequence) renderTask = null
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException' && drawing === renderSequence) {
      clearCanvas()
      loadError.value = `${words.value.failed}${error?.message ? ` (${error.message})` : ''}`
    }
  }
}

async function loadDocument() {
  const sequence = ++loadSequence
  renderSequence++
  cancelRender()
  const previousTask = loadTask
  const previousDocument = pdfDocument.value
  loadTask = null
  pdfDocument.value = null
  actualPageCount.value = 0
  loading.value = false
  loadError.value = ''
  clearCanvas()
  if (previousTask) {
    try { await previousTask.destroy() } catch { /* release stale loading task */ }
  }
  if (previousDocument) {
    try { await previousDocument.destroy() } catch { /* release stale document */ }
  }
  if (sequence !== loadSequence || isUnmounted || !documentUrl.value) return

  loading.value = true
  try {
    const task = pdfjs.getDocument({ url: documentUrl.value, withCredentials: true })
    loadTask = task
    const loaded = await task.promise
    if (sequence !== loadSequence || isUnmounted) {
      await loaded.destroy()
      return
    }
    pdfDocument.value = loaded
    actualPageCount.value = loaded.numPages
    const nextPage = boundedPage(props.page)
    currentPage.value = nextPage
    loading.value = false
    await nextTick()
    await renderCurrentPage()
  } catch (error) {
    if (sequence === loadSequence && !isUnmounted) {
      loading.value = false
      loadError.value = `${words.value.failed}${error?.message ? ` (${error.message})` : ''}`
      clearCanvas()
    }
  }
}

function navigate(target) {
  if (!pdfDocument.value) return
  const next = boundedPage(target)
  if (next === currentPage.value) return
  currentPage.value = next
  emit('pagechange', next)
  renderCurrentPage()
}

watch(documentUrl, loadDocument)
watch(() => props.page, page => {
  const next = boundedPage(page)
  if (next !== currentPage.value) {
    currentPage.value = next
    if (pdfDocument.value) renderCurrentPage()
  }
})
watch(() => props.pageCount, () => {
  const next = boundedPage(currentPage.value)
  if (next !== currentPage.value) navigate(next)
})
watch(() => props.locale, () => {
  if (loadError.value) loadError.value = words.value.failed
})
watch(viewport, element => {
  resizeObserver?.disconnect()
  if (element && resizeObserver) resizeObserver.observe(element)
  if (element && pdfDocument.value) renderCurrentPage()
}, { flush: 'post' })

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => renderCurrentPage())
    if (viewport.value) resizeObserver.observe(viewport.value)
  }
  if (documentUrl.value) loadDocument()
})

onUnmounted(async () => {
  isUnmounted = true
  loadSequence++
  renderSequence++
  resizeObserver?.disconnect()
  cancelRender()
  const task = loadTask
  const document = pdfDocument.value
  loadTask = null
  pdfDocument.value = null
  try { await task?.destroy() } catch { /* component teardown */ }
  try { await document?.destroy() } catch { /* component teardown */ }
})
</script>

<template>
  <section class="std-pdf-viewer" :aria-label="words.title">
    <header class="std-pdf-toolbar">
      <strong>{{ words.title }}</strong>
      <a v-if="documentUrl" class="std-pdf-open" :href="`${documentUrl}#page=${currentPage}`" target="_blank" rel="noopener">{{ locale === 'vi' ? 'Mở trang PDF' : 'Open PDF page' }}</a>
      <a v-if="documentUrl" :href="documentUrl" download>{{ locale === 'vi' ? 'Tải PDF' : 'Download PDF' }}</a>
      <span v-if="printedPage != null" class="std-pdf-printed">{{ words.printed }} {{ printedPage }}</span>
      <div class="std-pdf-controls">
        <button type="button" :aria-label="words.previous" :disabled="loading || !pdfDocument || currentPage <= 1" @click="navigate(currentPage - 1)">‹</button>
        <label><span class="sr-only">{{ words.pageInput }}</span><input :value="currentPage" type="number" inputmode="numeric" min="1" :max="shownPageCount || undefined" :disabled="loading || !pdfDocument" @change="navigate($event.target.value)" /></label>
        <span>{{ pageLabel }}</span>
        <button type="button" :aria-label="words.next" :disabled="loading || !pdfDocument || (shownPageCount > 0 && currentPage >= shownPageCount)" @click="navigate(currentPage + 1)">›</button>
      </div>
    </header>
    <p v-if="loading" class="std-pdf-state" role="status">{{ words.loading }}</p>
    <div v-else-if="loadError" class="std-pdf-state std-pdf-error" role="alert">
      <span>{{ loadError }}</span><button type="button" @click="loadDocument">{{ words.retry }}</button>
    </div>
    <p v-else-if="!documentId" class="std-pdf-state">{{ words.missing }}</p>
    <div v-else ref="viewport" class="std-pdf-canvas-viewport">
      <canvas ref="canvas" class="std-pdf-canvas" :aria-label="pageLabel"></canvas>
    </div>
  </section>
</template>

<style scoped>
.std-pdf-viewer{min-width:0;overflow:hidden;border:1px solid #d4dce6;border-radius:8px;background:#f2f0eb;color:#243a58}.std-pdf-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:9px 11px;border-bottom:1px solid #d6dfe7;background:#fff}.std-pdf-printed{color:#6c7890;font-size:13px}.std-pdf-controls{display:flex;align-items:center;gap:6px;margin-left:auto}.std-pdf-controls button,.std-pdf-error button{min-width:32px;padding:5px 8px;border:1px solid #b8c5d5;border-radius:5px;background:#eef2f6;color:#243a58;cursor:pointer}.std-pdf-controls button:disabled{opacity:.45;cursor:default}.std-pdf-controls input{width:66px;padding:5px;border:1px solid #bdc9d7;border-radius:4px;color:#243a58}.std-pdf-controls span{font-size:12px;color:#63718a}.std-pdf-canvas-viewport{display:flex;justify-content:center;max-height:72vh;min-height:250px;overflow:auto;padding:12px}.std-pdf-canvas{display:block;max-width:100%;height:auto;align-self:flex-start;background:white;box-shadow:0 2px 8px #26384d30}.std-pdf-state{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;min-height:230px;margin:0;padding:16px;color:#667790;text-align:center}.std-pdf-error{color:#9a3636}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style>
