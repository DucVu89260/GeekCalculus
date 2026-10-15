<script setup>
import { onMounted, ref } from 'vue'
import { request } from '../api'
const families=ref([]), error=ref('')
onMounted(async()=>{try{families.value=(await request('/api/v1/standards')).data}catch(e){error.value=e.message}})
const destination=code=>window.location.pathname+'?standard='+encodeURIComponent(code)+'#/modules/steel/library/standards'
</script>
<template>
  <details class="std-nav"><summary>Design Standard ▾</summary>
    <div v-if="error" role="alert">{{ error }}</div>
    <div v-for="family in families" :key="family.code" class="std-nav-family"><strong>{{ family.name }}</strong>
      <div class="std-nav-links"><template v-for="edition in family.editions" :key="edition.code"><a v-if="edition.code === 'AISC360-10'" :href="destination(edition.code)">{{ edition.title }} · In development</a><span v-else class="std-pending" :title="'Coming soon: ' + edition.title">{{ edition.title }} · Coming soon</span></template></div>
    </div>
    <small v-if="!families.length&&!error">Loading database…</small>
  </details>
</template>
<style scoped>
.std-nav{position:relative;display:inline-block;border:1px solid #a6b6cb;border-radius:7px;background:#fff;color:#21385a;z-index:5}.std-nav summary{padding:9px 12px;cursor:pointer;font-weight:700;list-style:none}.std-nav[open]{box-shadow:0 6px 22px #253c5d20}.std-nav-family{padding:10px 12px;min-width:220px;border-top:1px solid #e4e8ef}.std-nav-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.std-nav-links a{padding:6px 9px;background:#eaf0f7;border:1px solid #d5dfec;border-radius:6px;color:#253c5d;text-decoration:none;font-weight:600}.std-nav-links a:hover{background:#253c5d;color:white}.std-pending{padding:6px 9px;background:#f3f4f6;color:#798594;border:1px dashed #d2d9e1;border-radius:6px;font-size:13px}.std-nav small{display:block;padding:9px}
</style>