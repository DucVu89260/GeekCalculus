<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { request } from '../api'

const props = defineProps({
  locale: { type: String, default: 'vi' },
  demoMode: { type: Boolean, default: false },
})
const frame = ref(null)
const frameHeight = ref(1420)
const ready = ref(false)
const busy = ref(false)
const status = ref('')
const lastSaved = ref('')
let waitingForState = false
let nextRequestId = 1
const labels = {
  vi: {
    save: 'Lưu lên Laravel', restore: 'Tải từ Laravel', saving: 'Đang lưu…',
    empty: 'Chưa có dữ liệu đã lưu trên tài khoản này.',
    saved: 'Đã lưu bảng Combo Generator vào tài khoản Laravel.',
    restored: 'Đã tải dữ liệu đã lưu về bảng.', failed: 'Không thể hoàn tất thao tác.',
    prompt: 'Tải dữ liệu đã lưu sẽ thay thế toàn bộ bảng đang chỉnh sửa. Bạn muốn tiếp tục?',
    demo: 'Bản GitHub Pages: chưa có Laravel Database. Dùng Xuất JSON để sao lưu và Xuất SAP2000 (.s2k) để thử nghiệm.',
    live: 'Dữ liệu chỉ được lưu trên Laravel khi bạn nhấn “Lưu lên Laravel”. Xuất JSON để có thêm bản sao lưu.',
    waiting: 'Đang mở Combo Generator…',
  },
  en: {
    save: 'Save to Laravel', restore: 'Load from Laravel', saving: 'Saving…',
    empty: 'No saved Combo Generator workspace for this account.',
    saved: 'Combo Generator workspace saved to your Laravel account.',
    restored: 'Saved workspace loaded.', failed: 'Unable to complete the operation.',
    prompt: 'Loading the saved workspace replaces your current edits. Continue?',
    demo: 'GitHub Pages demo: Laravel storage is unavailable. Export JSON to back up edits or SAP2000 (.s2k) for a new model.',
    live: 'Changes are saved to Laravel only when you click Save. Export JSON for an additional backup.',
    waiting: 'Loading Combo Generator…',
  },
}
const t = key => labels[props.locale]?.[key] ?? labels.vi[key] ?? key
const source = import.meta.env.BASE_URL + 'combo-generator-v5.html?embed=1'
function toFrame(type, data = {}) {
  if (!ready.value || !frame.value?.contentWindow) return
  frame.value.contentWindow.postMessage({ type, ...data }, window.location.origin)
}
function save() {
  if (props.demoMode || busy.value || !ready.value) return
  status.value = ''
  busy.value = true
  waitingForState = true
  toFrame('gc-combo-request-state', { requestId: nextRequestId++ })
}
async function load() {
  if (props.demoMode || busy.value || !ready.value || !window.confirm(t('prompt'))) return
  busy.value = true
  status.value = ''
  try {
    const response = await request('/api/v1/combo-generator/workspace')
    if (!response?.data) { status.value = t('empty'); return }
    toFrame('gc-combo-import-state', { requestId: nextRequestId++, payload: response.data })
  } catch (error) {
    status.value = t('failed') + ' ' + (error.message || '')
  } finally {
    busy.value = false
  }
}
async function onMessage(event) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  const data = event.data || {}
  if (data.type === 'gc-combo-ready') ready.value = true
  if (data.type === 'gc-combo-height') {
    const height = Number(data.height)
    if (Number.isFinite(height)) frameHeight.value = Math.max(650, Math.min(3200, height + 12))
  }
  if (data.type === 'gc-combo-state' && waitingForState) {
    waitingForState = false
    try {
      await request('/api/v1/combo-generator/workspace', {
        method: 'PUT',
        body: JSON.stringify({ payload: data.payload }),
      })
      lastSaved.value = new Date().toLocaleString(props.locale === 'en' ? 'en-US' : 'vi-VN')
      status.value = t('saved')
    } catch (error) {
      status.value = t('failed') + ' ' + (error.message || '')
    } finally {
      busy.value = false
    }
  }
  if (data.type === 'gc-combo-import-result') {
    status.value = data.success ? t('restored') : t('failed') + ' ' + (data.error || '')
  }
}
onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <section class="combo-generator-view" aria-label="Combo Generator">
    <div class="combo-storage-toolbar">
      <div class="combo-storage-copy">
        <strong>Load Combination Matrix</strong>
        <span>{{ demoMode ? t('demo') : t('live') }}</span>
      </div>
      <div v-if="!demoMode" class="combo-storage-buttons">
        <button class="quiet-button" type="button" :disabled="busy || !ready" @click="load">{{ t('restore') }}</button>
        <button class="primary-button" type="button" :disabled="busy || !ready" @click="save">{{ busy ? t('saving') : t('save') }}</button>
      </div>
    </div>
    <p v-if="status" class="combo-storage-status" role="status">{{ status }} <span v-if="lastSaved">{{ lastSaved }}</span></p>
    <p v-if="!ready" class="combo-storage-status" role="status">{{ t('waiting') }}</p>
    <iframe
      ref="frame"
      class="combo-generator-frame"
      :src="source"
      :style="{ height: frameHeight + 'px' }"
      title="GeekCalculus Load Combination Generator"
      loading="eager"
    ></iframe>
  </section>
</template>

<style scoped>
.combo-generator-view { min-width: 0; }
.combo-storage-toolbar { display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:14px 16px;margin-bottom:12px;background:#f4f8fc;border:1px solid #cfdae7;border-radius:10px; }
.combo-storage-copy { display:flex;flex-direction:column;gap:5px;max-width:790px; }
.combo-storage-copy strong { color:#244669;font-size:17px; }
.combo-storage-copy span { font-size:13px;line-height:1.5;color:#57708c; }
.combo-storage-buttons { display:flex;gap:9px;flex-wrap:wrap; }
.combo-storage-buttons button { padding:8px 13px; }
.combo-storage-status { margin:0 0 10px;padding:8px 12px;font-size:13px;color:#2a5d7f; }
.combo-generator-frame { display:block;width:100%;border:1px solid #d6dfe9;border-radius:9px;background:#fff; }
@media(max-width:650px){.combo-storage-toolbar{padding:10px}.combo-storage-buttons{width:100%}.combo-storage-buttons button{flex:1}}
</style>
