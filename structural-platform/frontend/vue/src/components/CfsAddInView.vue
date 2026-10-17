<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({ locale: { type: String, required: true }, user: { type: Object, required: true } })
const frame = ref(null)
const height = ref(1100)
const source = import.meta.env.BASE_URL + 'cfs-lapping-node/index.html?scope=' + encodeURIComponent(props.user.id)
function onMessage(event) {
  if (event.origin !== location.origin || event.source !== frame.value?.contentWindow || event.data?.type !== 'gc-cfs-height') return
  const value = Number(event.data.height)
  if (Number.isFinite(value)) height.value = Math.min(6000, Math.max(800, value + 10))
}
onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <section class="cfs-add-in-view" aria-label="CFS Lapping and Node Add-in">
    <p class="cfs-browser-notice" role="note">{{ locale === 'vi' ? 'Chọn .cfsa và thư mục SECTIONS trên máy. File được xử lý trong trình duyệt; chỉ xuất bản sao TEST COPY. Định dạng CFS, mã gối và đơn vị native còn cần kiểm chứng trong CFS 11.0.2. Lần đầu tải Python khoảng 12 MB.' : 'Select a local .cfsa and its SECTIONS folder. Files are processed in your browser; export creates a TEST COPY only. CFS format, support codes and native units still require verification in CFS 11.0.2. The initial Python runtime download is about 12 MB.' }}</p>
    <iframe ref="frame" :src="source" title="CFS Lapping and Node Add-in" :style="{ height: height + 'px' }" sandbox="allow-scripts allow-same-origin allow-downloads allow-modals" />
  </section>
</template>

<style scoped>
.cfs-browser-notice{padding:12px 14px;border:1px solid #e0c58f;border-radius:8px;background:#fff7e9;color:#785520;font-size:15px;line-height:1.7}
iframe{display:block;width:100%;margin-top:16px;border:1px solid var(--surface-border);border-radius:12px;background:#f5f3ef}
</style>
