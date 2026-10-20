<script setup>
import { computed } from 'vue'
import { moduleHref } from '../modules'

const props = defineProps({ locale: { type: String, required: true } })
const words = computed(() => props.locale === 'vi' ? {
  title: 'Danh sách thư viện', lookup: 'Tra thông số theo địa danh',
  description: 'Thông số gió, gia tốc nền và gia tốc phổ chu kỳ ngắn / dài theo địa danh Việt Nam.',
  available: 'Có thể tra cứu', pending: 'Đang phát triển',
} : {
  title: 'Standards libraries', lookup: 'Look up location parameters',
  description: 'Wind, ground acceleration and short / long-period spectral acceleration by Vietnamese location.',
  available: 'Available', pending: 'In development',
})
const planned = ['ASCE 7-10', 'ASCE 7-16', 'ASCE 7-22', 'TCVN 2737:2023']
</script>

<template>
  <section class="loading-library" :aria-label="words.title">
    <h2>{{ words.title }}</h2>
    <div class="loading-library-grid">
      <a class="loading-library-card vn-library-entry" :href="moduleHref('loads/library/vietnam-location')">
        <span class="library-status available">{{ words.available }}</span>
        <h3>QCVN 02:2022/BXD</h3>
        <p>{{ words.description }}</p>
        <strong>{{ words.lookup }} →</strong>
      </a>
      <article v-for="standard in planned" :key="standard" class="loading-library-card library-planned">
        <span class="library-status">{{ words.pending }}</span>
        <h3>{{ standard }}</h3>
      </article>
    </div>
  </section>
</template>

<style scoped>
.loading-library { color:#23395d; }
.loading-library h2 { margin:0 0 22px; font-size:23px; }
.loading-library-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
.loading-library-card { display:flex; flex-direction:column; align-items:flex-start; gap:14px; min-width:0; padding:22px; border:1px solid #a8bac9; border-radius:12px; background:#fffefa; color:#23395d; text-decoration:none; }
.loading-library-card h3 { margin:0; font-size:21px; color:inherit; }
.loading-library-card p { margin:0; line-height:1.7; }
.loading-library-card strong { margin-top:auto; font-size:15px; }
.library-status { display:inline-block; padding:4px 10px; border:1px solid #b7c6d2; border-radius:20px; background:#edf1f5; font-size:13px; }
.library-status.available { background:#e6efe9; border-color:#b2c9b9; color:#345943; }
a.loading-library-card { grid-column:1/-1; transition:background .15s,color .15s; }
a.loading-library-card:hover,a.loading-library-card:focus-visible { background:#23395d; color:white; }
a.loading-library-card:focus-visible { outline:2px solid #648ba6; outline-offset:3px; }
.library-planned { background:var(--surface-bg,#f4f1ea); }
@media(max-width:650px) { .loading-library-grid { grid-template-columns:1fr; } .loading-library-card { padding:18px; } }
</style>
