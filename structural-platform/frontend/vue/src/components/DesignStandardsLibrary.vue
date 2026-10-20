<script setup>
import { computed, onMounted, ref } from 'vue'
import { request } from '../api'

const props = defineProps({ locale: { type: String, required: true } })
const families = ref([])
const loading = ref(true)
const failed = ref(false)
const words = computed(() => props.locale === 'vi' ? {
  title: 'Tiêu chuẩn thiết kế', pending: 'Đang phát triển', soon: 'Sắp phát triển', open: 'Mở thư viện',
  loading: 'Đang tải thư viện tiêu chuẩn…', error: 'Không tải được danh sách tiêu chuẩn.', retry: 'Thử lại',
  mbma: 'Nội dung chờ phát triển; phân nhóm theo phiên bản ASCE 7 tương ứng.',
} : {
  title: 'Design standard', pending: 'In development', soon: 'Coming soon', open: 'Open library',
  loading: 'Loading standards libraries…', error: 'Could not load standards libraries.', retry: 'Retry',
  mbma: 'Content pending development; grouped by the corresponding ASCE 7 edition.',
})
const groups = computed(() => ['AISC360', 'ASCE7'].map(code => ({
  code, name: code === 'AISC360' ? 'AISC 360' : 'ASCE 7',
  editions: families.value.find(family => family.code === code)?.editions ?? [],
})))
const mbmaReferences = ['ASCE 7-10', 'ASCE 7-16', 'ASCE 7-22']
const canOpen = edition => edition.status === 'in_development'
const destination = edition => `${window.location.pathname}?standard=${encodeURIComponent(edition.code)}#/modules/steel/library/standards`
async function load() {
  loading.value = true; failed.value = false
  try { families.value = (await request('/api/v1/standards')).data }
  catch { failed.value = true }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="design-standards-library" :aria-label="words.title">
    <p v-if="loading" role="status">{{ words.loading }}</p>
    <div v-else-if="failed" role="alert"><p>{{ words.error }}</p><button type="button" class="quiet-button" @click="load">{{ words.retry }}</button></div>
    <template v-else>
      <section v-for="group in groups" :key="group.code" class="standard-family" :aria-label="group.name">
        <h2>{{ group.name }}</h2>
        <div class="standard-edition-grid">
          <component :is="canOpen(edition) ? 'a' : 'article'" v-for="edition in group.editions" :key="edition.code"
            class="standard-edition-card" :data-edition="edition.code" :href="canOpen(edition) ? destination(edition) : undefined"
            :target="canOpen(edition) ? '_blank' : undefined" :rel="canOpen(edition) ? 'noopener noreferrer' : undefined">
            <span class="edition-status">{{ canOpen(edition) ? words.pending : words.soon }}</span>
            <h3>{{ edition.title }}</h3>
            <strong v-if="canOpen(edition)">{{ words.open }} →</strong>
          </component>
        </div>
      </section>
      <section class="standard-family" aria-label="MBMA">
        <h2>MBMA</h2>
        <p class="mbma-note">{{ words.mbma }}</p>
        <div class="standard-edition-grid">
          <article v-for="reference in mbmaReferences" :key="reference" class="standard-edition-card" :data-mbma-reference="reference">
            <span class="edition-status">{{ words.pending }}</span><h3>MBMA · {{ reference }}</h3>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.standard-family + .standard-family { margin-top:30px; padding-top:26px; border-top:1px solid #c3cdd6; }
.standard-family h2 { margin:0 0 16px; font-size:23px; color:#23395d; }
.standard-edition-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
.standard-edition-card { display:flex; flex-direction:column; align-items:flex-start; gap:16px; min-width:0; padding:22px; border:1px solid #a8bac9; border-radius:12px; background:var(--surface-bg,#f4f1ea); color:#23395d; text-decoration:none; }
.standard-edition-card h3 { margin:0; font-size:19px; color:inherit; overflow-wrap:anywhere; }
.standard-edition-card strong { margin-top:auto; font-size:14px; }
.edition-status { padding:4px 10px; border:1px solid #b7c6d2; border-radius:20px; background:#edf1f5; color:#23395d; font-size:13px; line-height:1.5; }
a.standard-edition-card { background:#fffefa; transition:background .15s,color .15s; }
a.standard-edition-card:hover,a.standard-edition-card:focus-visible { background:#23395d; color:white; }
a.standard-edition-card:focus-visible { outline:2px solid #648ba6; outline-offset:3px; }
.mbma-note { margin:0 0 16px; color:var(--muted-ink,#53677b); line-height:1.7; }
@media(max-width:950px) { .standard-edition-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:650px) { .standard-edition-grid { grid-template-columns:1fr; } .standard-edition-card { padding:18px; } }
</style>
