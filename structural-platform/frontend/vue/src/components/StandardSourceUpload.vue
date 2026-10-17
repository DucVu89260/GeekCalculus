<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { request } from '../api'

const props = defineProps({ code: String, limits: Object, locale: { type: String, default: 'vi' } })
const emit = defineEmits(['uploaded'])
const fileInput = ref(null)
const file = ref(null)
const kind = ref('specification')
const revision = ref('')
const busy = ref(false)
const error = ref('')
const message = ref('')
let controller
let disposed = false
onUnmounted(() => { disposed = true; controller?.abort() })
const vi = computed(() => props.locale === 'vi')
const maxBytes = computed(() => props.limits?.max_bytes ?? 100 * 1024 * 1024)
const sizeLimit = computed(() => `${(maxBytes.value / 1024 / 1024).toLocaleString(vi.value ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2 })} MiB`)
const kinds = computed(() => props.limits?.document_types || ['specification', 'commentary', 'errata', 'manual'])
const labels = computed(() => vi.value ? {
  specification: 'Specification', commentary: 'Commentary', combined: 'Specification và Commentary', errata: 'Đính chính', manual: 'Sổ tay',
} : { specification: 'Specification', commentary: 'Commentary', combined: 'Specification and Commentary', errata: 'Errata', manual: 'Manual' })
function selectFile(event) {
  file.value = event.target.files?.[0] || null
  error.value = ''; message.value = ''
}
async function upload() {
  if (busy.value || !file.value) return
  error.value = ''; message.value = ''
  const selected = file.value
  if (!/\.pdf$/i.test(selected.name) || selected.size === 0) {
    error.value = vi.value ? 'Chọn tệp PDF có nội dung.' : 'Choose a nonempty PDF file.'
    return
  }
  if (selected.size > maxBytes.value) {
    error.value = vi.value ? `Tệp vượt giới hạn ${sizeLimit.value} của máy chủ.` : `The file exceeds the server limit of ${sizeLimit.value}.`
    return
  }
  busy.value = true
  const code = props.code
  controller = new AbortController()
  try {
    if (await selected.slice(0, 5).text() !== '%PDF-') {
      error.value = vi.value ? 'Tệp không có chữ ký PDF hợp lệ.' : 'The file has no valid PDF signature.'
      return
    }
    if (disposed) return
    const body = new FormData()
    body.append('file', selected)
    body.append('kind', kind.value)
    if (revision.value.trim()) body.append('revision', revision.value.trim())
    let document, duplicate = false
    try {
      const response = await request(`/api/v1/standards/${encodeURIComponent(code)}/documents`, { method: 'POST', body, signal: controller.signal })
      document = response.data
    } catch (failure) {
      if (failure.status !== 409 || !failure.data?.id) throw failure
      document = failure.data; duplicate = true
    }
    if (disposed) return
    emit('uploaded', { code, document })
    message.value = duplicate
      ? (vi.value ? 'Tệp đã tồn tại. Đã chọn tài liệu đã đăng ký; không tạo bản trùng.' : 'This file is already registered. Selected the existing document without creating a duplicate.')
      : (vi.value ? 'Đã lưu PDF riêng tư. Tài liệu đang chờ kiểm tra phiên bản và lập chỉ mục; chưa có công thức nào được duyệt.' : 'Private PDF saved. Edition inspection and indexing are pending; no formulas have been approved.')
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
  } catch (failure) {
    if (disposed || failure.name === 'AbortError') return
    const validation = Object.values(failure.errors || {}).flat().join(' ')
    error.value = failure.status === 413
      ? (vi.value ? 'Máy chủ từ chối kích thước tệp. Kiểm tra giới hạn upload của PHP và proxy.' : 'The server rejected the file size. Check PHP and proxy upload limits.')
      : validation || failure.message
  } finally { busy.value = false }
}
</script>

<template>
  <details class="std-source-upload">
    <summary>{{ vi ? 'Tải PDF nguồn riêng tư' : 'Upload private source PDF' }} · {{ code }}</summary>
    <form @submit.prevent="upload" :aria-busy="busy">
      <p>{{ vi ? 'Tệp chỉ lưu trên máy chủ Laravel hiện tại. Tải lên không xác minh phiên bản, công thức hoặc kết quả tính toán.' : 'The file is stored on this Laravel server. Uploading does not verify its edition, formulas or calculation results.' }}</p>
      <fieldset :disabled="busy">
        <label>{{ vi ? 'Tệp PDF' : 'PDF file' }} · {{ sizeLimit }}
          <input ref="fileInput" type="file" accept="application/pdf,.pdf" required @change="selectFile" />
        </label>
        <label>{{ vi ? 'Loại tài liệu' : 'Document type' }}
          <select v-model="kind"><option v-for="value in kinds" :key="value" :value="value">{{ labels[value] || value }}</option></select>
        </label>
        <label>{{ vi ? 'Bản sửa đổi (nếu có)' : 'Publisher revision (optional)' }}
          <input v-model="revision" type="text" maxlength="100" />
        </label>
        <button type="submit" :disabled="!file || busy">{{ busy ? (vi ? 'Đang tải…' : 'Uploading…') : (vi ? 'Lưu PDF riêng tư' : 'Save private PDF') }}</button>
      </fieldset>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
    </form>
  </details>
</template>

<style scoped>
.std-source-upload{margin:12px 0;padding:12px;border:1px solid #c4cfdb;border-radius:8px;background:#f4f7fa;overflow-wrap:anywhere}.std-source-upload summary{cursor:pointer;font-weight:700}.std-source-upload p{font-size:13px;line-height:1.5}.std-source-upload fieldset{display:grid;gap:10px;border:0;padding:0;min-width:0}.std-source-upload label{display:grid;gap:5px;font-size:13px}.std-source-upload input,.std-source-upload select,.std-source-upload button{box-sizing:border-box;width:100%;max-width:100%;min-width:0;font:inherit;padding:8px;border:1px solid #aabbcc;border-radius:5px;background:white;color:#243a58}.std-source-upload button{width:auto;justify-self:start;background:#243a58;color:white;cursor:pointer}.std-source-upload button:disabled{opacity:.5;cursor:default}[role=alert]{color:#9b3326}[role=status]{color:#24503c}
</style>
