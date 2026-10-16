<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { request } from '../api'
const props = defineProps({ code: { type: String, required: true }, documents: { type: Array, default: () => [] }, initialMode: { type: String, default: 'pages' } })
const documentId = ref('')
const mode = ref(props.initialMode)
const query = ref('')
const chapter = ref('')
const kind = ref('equation')
const rows = ref([])
const meta = ref({ total: 0, current_page: 1, last_page: 1 })
const active = ref(null)
const pageNumber = ref(1)
const error = ref('')
const busy = ref(false)
const doc = computed(() => props.documents.find(d => String(d.id) === String(documentId.value)))
const base = computed(() => `/api/v1/standards/${encodeURIComponent(props.code)}`)
const docBase = computed(() => `${base.value}/documents/${documentId.value}`)
let generation = 0
async function load(page = 1) {
  const token = ++generation
  busy.value = true; error.value = ''
  try {
    const params = new URLSearchParams({ page: String(page), q: query.value, chapter: chapter.value })
    if (documentId.value) params.set('document_id', String(documentId.value))
    if (mode.value === 'items') params.set('kind', kind.value)
    const response = await request(`${base.value}/source-${mode.value}?${params}`)
    if (token !== generation) return
    rows.value = response.data; meta.value = response.meta
  } catch (e) { if (token === generation) error.value = e.message }
  finally { if (token === generation) busy.value = false }
}
let pageGeneration = 0
async function openPage(page) {
  const n = Number(page), token = ++pageGeneration
  if (!Number.isInteger(n) || n < 1 || n > (doc.value?.page_count || 0)) return
  pageNumber.value = n; active.value = null
  try {
    const response = await request(`${docBase.value}/pages/${n}`)
    if (token === pageGeneration) active.value = response.data
  } catch (e) { if (token === pageGeneration) error.value = e.message }
}
function selectDocument() {
  active.value = null; ++pageGeneration
  load(); if (doc.value) openPage(1)
}
watch(() => props.code, () => { documentId.value = String(props.documents.find(d => d.extraction_summary)?.id || ''); selectDocument() })
watch([mode, kind], () => load())
onMounted(() => { documentId.value = String(props.documents.find(d => d.extraction_summary)?.id || ''); selectDocument() })
</script>

<template>
  <section class="corpus" aria-label="Standards source archive">
    <h3>Kho nguồn ASCE 7-10 / Source corpus</h3>
    <p>Văn bản, số liệu và công thức trích xuất chưa được xác nhận kỹ thuật. Tham chiếu có thể chỉ là lời dẫn đến công thức/bảng, không phải định nghĩa. Đối chiếu ảnh trang và PDF trước khi dùng vào bảng tính.</p>
    <label>Tài liệu / Document <select v-model="documentId" @change="selectDocument"><option v-for="d in documents.filter(d => d.extraction_summary)" :key="d.id" :value="String(d.id)">{{ d.original_name }}</option></select></label>
    <div v-if="doc" class="source-summary">
      <p>{{ doc.page_count }} pages · {{ doc.extraction_summary.ocr_pages }} OCR pages · {{ doc.extraction_summary.numeric_tokens }} raw number tokens · {{ doc.extraction_summary.source_occurrences }} source occurrences</p>
      <p class="hash">SHA-256: {{ doc.sha256 }}</p>
      <a :href="`${docBase}/corpus`">Tải kho JSON / Download source JSON</a> · <a :href="`${docBase}/file`" target="_blank" rel="noopener">PDF gốc / Original PDF</a>
    </div>
    <form class="source-filters" @submit.prevent="load()">
      <label>Tra cứu / Browse <select v-model="mode"><option value="pages">Toàn văn / Full text pages</option><option value="items">Công thức, bảng, hình / References</option></select></label>
      <label v-if="mode === 'items'">Loại / Type <select v-model="kind"><option value="equation">Equation candidates</option><option value="table">Table references</option><option value="figure">Figure references</option></select></label>
      <label>Tìm kiếm / Search <input v-model="query" maxlength="200" placeholder="27.3-1, Kzt, velocity…" /></label>
      <label>Chương / Chapter <input v-model="chapter" maxlength="30" placeholder="26, 27, C27…" /></label>
      <button type="submit" :disabled="busy">Tìm / Search</button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <p role="status">{{ busy ? 'Loading…' : `${meta.total} results · page ${meta.current_page}/${meta.last_page}` }}</p>
    <div class="source-grid">
      <section class="source-results">
        <article v-for="row in rows" :key="row.id || `${row.document_id}-${row.pdf_page}`">
          <button type="button" @click="openPage(row.pdf_page)">{{ row.label || `PDF p. ${row.pdf_page}` }} · {{ row.kind }} · {{ row.chapter || 'Front matter' }}</button>
          <small>PDF {{ row.pdf_page }} · {{ row.channel || row.extraction_method }} · {{ row.verification_status || row.coverage_status }}</small>
          <pre v-if="row.context">{{ row.context }}</pre>
        </article>
        <p v-if="!busy && !rows.length">Không có kết quả / No results.</p>
        <nav aria-label="Source search pages"><button type="button" :disabled="busy || meta.current_page <= 1" @click="load(meta.current_page - 1)">Previous</button> <button type="button" :disabled="busy || meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Next</button></nav>
      </section>
      <section v-if="doc" class="source-page">
        <form @submit.prevent="openPage(pageNumber)"><label>PDF page <input v-model.number="pageNumber" type="number" min="1" :max="doc.page_count" /></label> <button type="submit">Open</button></form>
        <template v-if="active">
          <p>PDF {{ active.pdf_page }} · printed {{ active.printed_label || 'unmapped' }} · {{ active.coverage_status }}</p>
          <a :href="`${docBase}/file#page=${active.pdf_page}`" target="_blank" rel="noopener">Mở trang PDF / Open PDF page</a>
          <img :src="`${docBase}/pages/${active.pdf_page}/image`" :alt="`ASCE 7-10 source page ${active.pdf_page}`" loading="lazy" />
          <details><summary>Native text · {{ active.native_text.length }} characters</summary><pre>{{ active.native_text || '(No text layer)' }}</pre></details>
          <details v-if="active.extraction_method === 'native+ocr'"><summary>OCR text · chưa kiểm chứng / unverified</summary><pre>{{ active.ocr_text || '(No recognized text)' }}</pre></details>
          <details><summary>Raw numeric tokens · {{ active.numeric_tokens.length }}</summary><p>Token chưa có ý nghĩa biến/đơn vị được xác nhận; vị trí ký tự được lưu trong JSON.</p><pre>{{ active.numeric_tokens.map(t => `${t.channel}@${t.offset}: ${t.raw}`).join('\n') }}</pre></details>
        </template>
      </section>
    </div>
  </section>
</template>

<style scoped>
.corpus{margin-top:16px;padding:16px;background:#fffdf8;border:1px solid #d6dfe7;border-radius:9px}.corpus p{line-height:1.6}.source-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-top:16px}.corpus label{display:inline-flex;flex-direction:column;gap:5px}.corpus input,.corpus select,.corpus button{padding:8px;border:1px solid #bac9dc;border-radius:5px;color:#24395d;background:white}.corpus button{cursor:pointer}.corpus button:disabled{opacity:.5;cursor:default}.source-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(280px,1.6fr);gap:18px}.source-results{max-height:1000px;overflow:auto}.source-results article{border-bottom:1px solid #d6dfe7;padding:12px 0}.source-results small{display:block;margin-top:6px}.source-page img{max-width:100%;display:block;margin-top:12px;border:1px solid #d6dfe7}.source-page input{max-width:100px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:450px;overflow:auto;font-size:13px;line-height:1.5}.hash{overflow-wrap:anywhere;font-size:12px}details{padding:10px 0}a{color:#274c7e}@media(max-width:1000px){.source-grid{grid-template-columns:1fr}.source-results{max-height:400px}}
</style>
