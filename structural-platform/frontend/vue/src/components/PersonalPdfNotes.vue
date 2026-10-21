<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { demoMode } from '../api'
import { moduleHref } from '../modules'
import { listPersonalPdfNotes, uploadPersonalPdfNote, updatePersonalPdfNote, removePersonalPdfNote, personalPdfFile, validateNotePdf } from '../personal-pdf-notes'

const PdfReader = defineAsyncComponent(() => import('./PrivateStandardPdf.vue'))
const props = defineProps({ locale: { type: String, required: true }, user: { type: Object, required: true } })
const words = computed(() => props.locale === 'vi' ? {
  title: 'Ghi chú PDF cá nhân', back: 'Về thư viện Loading', upload: 'Thêm PDF', file: 'Chọn tệp PDF',
  name: 'Tên ghi chú', description: 'Mô tả', save: 'Lưu thay đổi', cancel: 'Hủy', edit: 'Sửa thông tin',
  read: 'Đọc PDF', download: 'Tải bản gốc', remove: 'Xóa', close: 'Đóng tài liệu',
  search: 'Tìm theo tên hoặc mô tả…', empty: 'Chưa có ghi chú PDF. Chọn tệp để thêm tài liệu đầu tiên.',
  noMatches: 'Không tìm thấy ghi chú phù hợp.', loading: 'Đang tải ghi chú…', working: 'Đang xử lý…',
  local: 'Bản web: PDF lưu trong trình duyệt trên thiết bị này, không đồng bộ sang Docker. Hãy tải bản gốc để sao lưu trước khi xóa dữ liệu trình duyệt.',
  server: 'PDF được lưu riêng theo tài khoản trên máy chủ. Người dùng khác không thể mở ghi chú của bạn.',
  limit: 'Dung lượng tối đa mỗi PDF', confirm: 'Xóa ghi chú và tệp PDF này?', retry: 'Thử lại',
  invalid: 'Chọn tệp PDF hợp lệ trong giới hạn dung lượng; kiểm tra tên và mô tả.',
  failed: 'Không thể hoàn tất thao tác. Hãy thử lại.', storageFull: 'Bộ nhớ trình duyệt đã đầy. Hãy tải bản sao và giải phóng dung lượng trước khi thêm PDF.',
  unavailable: 'Không truy cập được bộ nhớ ghi chú. Kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.',
  uploaded: 'Đã lưu ghi chú PDF.', saved: 'Đã lưu thông tin.', deleted: 'Đã xóa ghi chú.',
  missing: 'Ghi chú không còn tồn tại hoặc bạn không có quyền truy cập.',
} : {
  title: 'Personal PDF notes', back: 'Back to Loading Library', upload: 'Add PDF', file: 'Choose PDF file',
  name: 'Note title', description: 'Description', save: 'Save changes', cancel: 'Cancel', edit: 'Edit details',
  read: 'Read PDF', download: 'Download original', remove: 'Delete', close: 'Close document',
  search: 'Search title or description…', empty: 'No PDF notes yet. Choose a file to add your first document.',
  noMatches: 'No matching notes.', loading: 'Loading notes…', working: 'Working…',
  local: 'Web version: PDFs stay in this browser on this device and do not sync to Docker. Download originals as a backup before clearing browser data.',
  server: 'PDFs are stored privately for your account on the server. Other users cannot open your notes.',
  limit: 'Maximum size per PDF', confirm: 'Delete this note and its PDF file?', retry: 'Retry',
  invalid: 'Choose a valid PDF within the size limit and check the title and description.',
  failed: 'Could not complete this action. Please try again.', storageFull: 'Browser storage is full. Download backups and free space before adding a PDF.',
  unavailable: 'Note storage is unavailable. Check browser storage permissions and try again.',
  uploaded: 'PDF note saved.', saved: 'Details saved.', deleted: 'Note deleted.',
  missing: 'This note no longer exists or is not accessible to your account.',
})
const notes = ref([]), loading = ref(true), busy = ref(false), error = ref(''), message = ref('')
const title = ref(''), description = ref(''), file = ref(null), fileInput = ref(null), editing = ref('')
const search = ref(''), uploadLimit = ref(20 * 1024 * 1024), opened = ref(null), reader = ref(null)
let generation = 0, listSequence = 0
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return notes.value.filter(note => `${note.title} ${note.description} ${note.original_name}`.toLocaleLowerCase().includes(query))
})
const bytes = size => `${new Intl.NumberFormat(props.locale, { maximumFractionDigits: 2 }).format(size / 1024 / 1024)} MB`
const timestamp = value => new Intl.DateTimeFormat(props.locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value))
function errorKey(problem) {
  if (problem.name === 'QuotaExceededError') return 'storageFull'
  if (['SecurityError', 'InvalidStateError'].includes(problem.name) || problem.message === 'STORAGE_UNAVAILABLE') return 'unavailable'
  if (problem.status === 404 || problem.message === 'NOTE_NOT_FOUND') return 'missing'
  if ([413, 422].includes(problem.status) || problem.message === 'INVALID_PDF') return 'invalid'
  return 'failed'
}
function resetForm() {
  title.value = ''; description.value = ''; file.value = null; editing.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
function closeDocument() {
  if (opened.value?.revoke) URL.revokeObjectURL(opened.value.url)
  opened.value = null
}
async function load() {
  const token = generation, sequence = ++listSequence
  loading.value = true
  try {
    const result = await listPersonalPdfNotes(props.user.id)
    if (token !== generation || sequence !== listSequence) return
    notes.value = result.data; uploadLimit.value = result.meta.upload_limit_bytes
    if (opened.value) {
      const current = notes.value.find(note => note.id === opened.value.id)
      if (current) opened.value = { ...opened.value, ...current }
      else closeDocument()
    }
    error.value = ''
  } catch (problem) { if (token === generation && sequence === listSequence) error.value = errorKey(problem) }
  finally { if (token === generation && sequence === listSequence) loading.value = false }
}
function chooseFile(event) {
  file.value = event.target.files?.[0] ?? null
  if (file.value && !title.value.trim()) title.value = file.value.name.replace(/\.pdf$/i, '').slice(0, 180)
}
async function save() {
  if (busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  const token = generation
  try {
    const wasEditing = Boolean(editing.value)
    if (wasEditing) await updatePersonalPdfNote(props.user.id, editing.value, title.value, description.value)
    else {
      await validateNotePdf(file.value, uploadLimit.value)
      await uploadPersonalPdfNote(props.user.id, file.value, title.value, description.value)
    }
    if (token !== generation) return
    resetForm(); await load()
    if (token === generation) message.value = wasEditing ? 'saved' : 'uploaded'
  } catch (problem) { if (token === generation) error.value = errorKey(problem) }
  finally { if (token === generation) busy.value = false }
}
function edit(note) {
  resetForm(); editing.value = note.id; title.value = note.title; description.value = note.description
  fileInput.value?.closest('form')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
async function open(note) {
  const token = generation
  busy.value = true; error.value = ''
  try {
    const handle = await personalPdfFile(props.user.id, note)
    if (token !== generation) { if (handle.revoke) URL.revokeObjectURL(handle.url); return }
    closeDocument(); opened.value = { ...note, ...handle }
    await nextTick(); reader.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  } catch (problem) { if (token === generation) error.value = errorKey(problem) }
  finally { if (token === generation) busy.value = false }
}
async function download(note) {
  const token = generation
  busy.value = true; error.value = ''
  try {
    const handle = await personalPdfFile(props.user.id, note)
    if (token === generation) {
      const link = document.createElement('a')
      link.href = handle.revoke ? handle.url : `${handle.url}?download=1`
      link.download = note.original_name; link.click()
    }
    if (handle.revoke) setTimeout(() => URL.revokeObjectURL(handle.url), 1000)
  } catch (problem) { if (token === generation) error.value = errorKey(problem) }
  finally { if (token === generation) busy.value = false }
}
async function remove(note) {
  if (!window.confirm(`${words.value.confirm}\n${note.title}`)) return
  const token = generation
  busy.value = true; error.value = ''; message.value = ''
  try {
    await removePersonalPdfNote(props.user.id, note.id)
    if (token !== generation) return
    if (opened.value?.id === note.id) closeDocument()
    if (editing.value === note.id) resetForm()
    await load()
    if (token === generation) message.value = 'deleted'
  } catch (problem) { if (token === generation) error.value = errorKey(problem) }
  finally { if (token === generation) busy.value = false }
}
watch(() => props.user.id, () => {
  generation++; notes.value = []; closeDocument(); resetForm(); search.value = ''; message.value = ''; busy.value = false
  load()
}, { immediate: true })
onBeforeUnmount(() => { generation++; closeDocument() })
</script>

<template>
  <section class="personal-pdf-notes" :aria-label="words.title">
    <a class="notes-back" :href="moduleHref('loads/library')">← {{ words.back }}</a>
    <p class="notes-storage" role="note">{{ demoMode ? words.local : words.server }}</p>
    <form class="notes-form" @submit.prevent="save">
      <fieldset :disabled="busy || loading">
        <legend>{{ editing ? words.edit : words.upload }}</legend>
        <label v-if="!editing">{{ words.file }}<input ref="fileInput" data-notes="file" type="file" accept="application/pdf,.pdf" required @change="chooseFile" /><small>{{ words.limit }}: {{ bytes(uploadLimit) }}</small></label>
        <label>{{ words.name }}<input v-model="title" data-notes="title" required maxlength="180" :pattern="'.*\\S.*'" /></label>
        <label>{{ words.description }}<textarea v-model="description" data-notes="description" maxlength="2000" rows="2"></textarea></label>
        <div class="notes-actions"><button type="submit" class="quiet-button" data-notes="save">{{ busy ? words.working : editing ? words.save : words.upload }}</button><button v-if="editing" type="button" class="quiet-button" @click="resetForm">{{ words.cancel }}</button></div>
      </fieldset>
    </form>
    <p v-if="error" class="notes-error" role="alert">{{ words[error] }} <button v-if="!busy" type="button" class="quiet-button" @click="load">{{ words.retry }}</button></p>
    <p v-if="message" role="status">{{ words[message] }}</p>
    <label class="notes-search"><span class="sr-only">{{ words.search }}</span><input v-model="search" type="search" :placeholder="words.search" data-notes="search" /></label>
    <p v-if="loading" role="status">{{ words.loading }}</p>
    <p v-else-if="!filtered.length" class="notes-empty">{{ notes.length ? words.noMatches : words.empty }}</p>
    <div v-else class="notes-grid">
      <article v-for="note in filtered" :key="note.id" class="pdf-note-card" :data-note-id="note.id">
        <span class="note-pdf-tag">PDF · {{ bytes(note.size_bytes) }}</span><h2>{{ note.title }}</h2>
        <p v-if="note.description">{{ note.description }}</p><small>{{ note.original_name }} · {{ timestamp(note.created_at) }}</small>
        <div class="notes-actions"><button type="button" class="quiet-button" :disabled="busy" data-note-action="read" @click="open(note)">{{ words.read }}</button><button type="button" class="quiet-button" :disabled="busy" data-note-action="download" @click="download(note)">{{ words.download }}</button><button type="button" class="quiet-button" :disabled="busy" data-note-action="edit" @click="edit(note)">{{ words.edit }}</button><button type="button" class="quiet-button" :disabled="busy" data-note-action="delete" @click="remove(note)">{{ words.remove }}</button></div>
      </article>
    </div>
    <section v-if="opened" ref="reader" class="notes-reader">
      <header><h2>{{ opened.title }}</h2><button type="button" class="quiet-button" @click="closeDocument">{{ words.close }}</button></header>
      <PdfReader :key="opened.id" :file-url="opened.url" :document-id="opened.id" :document-title="opened.title" :file-name="opened.original_name" :locale="locale" />
    </section>
  </section>
</template>

<style scoped>
.personal-pdf-notes { min-width:0; color:#23395d; }
.notes-back { color:#305c80; text-underline-offset:3px; }
.notes-storage { margin:20px 0; padding:14px 16px; border-left:4px solid #648ba6; border-radius:6px; background:#eaf0f3; line-height:1.7; }
.notes-form fieldset { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; min-width:0; margin:0 0 22px; padding:20px; border:1px solid #b7c6d2; border-radius:10px; }
.notes-form legend { padding:0 8px; font-weight:700; }.notes-form label { display:flex; flex-direction:column; gap:8px; min-width:0; line-height:1.6; }.notes-form label:has(textarea),.notes-form .notes-actions { grid-column:1/-1; }
.personal-pdf-notes input,.personal-pdf-notes textarea { width:100%; min-width:0; padding:12px; border:1px solid #23395d; border-radius:8px; background:#fffefa; color:#23395d; font:inherit; }.personal-pdf-notes textarea { resize:vertical; }
.notes-actions { display:flex; gap:8px; flex-wrap:wrap; }.notes-actions button { border:1px solid #23395d; }.notes-actions button:not(:disabled):hover { background:#23395d; color:white; }
.notes-search { display:block; max-width:620px; margin:24px 0; }.notes-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
.pdf-note-card { display:flex; flex-direction:column; gap:12px; min-width:0; padding:20px; border:1px solid #a8bac9; border-radius:12px; background:#fffefa; overflow-wrap:anywhere; }
.pdf-note-card h2 { margin:0; font-size:21px; }.pdf-note-card p { margin:0; line-height:1.7; white-space:pre-wrap; }.pdf-note-card small { color:#53677b; line-height:1.6; }.pdf-note-card .notes-actions { margin-top:auto; }
.note-pdf-tag { align-self:flex-start; padding:4px 10px; border:1px solid #b7c6d2; border-radius:20px; background:#edf1f5; font-size:13px; }.notes-empty { padding:24px; text-align:center; line-height:1.7; }
.notes-error { padding:12px; border:1px solid #c89292; border-radius:8px; background:#fff2ef; line-height:1.7; }
.notes-reader { margin-top:26px; min-width:0; scroll-margin-top:20px; }.notes-reader > header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; }.notes-reader h2 { overflow-wrap:anywhere; font-size:22px; }
@media(max-width:650px) { .notes-grid,.notes-form fieldset { grid-template-columns:1fr; }.notes-form fieldset { padding:14px; }.notes-form label { grid-column:1; }.notes-actions button { flex:1 1 auto; }.pdf-note-card { padding:16px; } }
</style>
