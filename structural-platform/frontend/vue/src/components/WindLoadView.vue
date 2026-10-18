<script setup>
import { computed, ref, watch } from 'vue'
import { WIND_GROUPS, WIND_BUILDINGS } from '../../../../standards/asce7-10-wind-catalog.mjs'
import { moduleHref } from '../modules'
import WindEnvelopeWorkspace from './WindEnvelopeWorkspace.vue'
import WindDirectionalView from './WindDirectionalView.vue'
import WindBuildingSketch from './WindBuildingSketch.vue'
const props = defineProps({locale:{type:String,default:'vi'},workspace:{type:String,default:''}})
const open = ref(false), group = ref('envelope')
const en = computed(()=>props.locale==='en')
const t = (vi,english)=>en.value?english:vi
const choices = computed(()=>WIND_BUILDINGS.filter(item=>item.group===group.value))
watch(()=>props.workspace,(value,old)=>{if(!value && old) open.value=true})
const destination = item=>moduleHref(item.id==='envelope-low-rise'?'loads/wind/envelope-low-rise':'loads/wind/directional-walls')
</script>
<template>
  <WindEnvelopeWorkspace v-if="workspace === 'envelope'" :locale="locale" />
  <div v-else-if="workspace === 'directional'"><a class="wind-back" :href="moduleHref('loads/wind')">← {{ t('Loại công trình','Building types') }}</a><WindDirectionalView :locale="locale" /></div>
  <section v-else class="wind-picker" aria-label="Wind Load Generator">
    <header><span class="wind-eyebrow">LOADING / WIND LOAD GENERATOR</span><h2>{{ t('Tải trọng gió','Wind Load Generator') }}</h2><p>{{ t('Chọn tiêu chuẩn, phương pháp và loại công trình để bắt đầu.','Choose a standard, procedure and building type to begin.') }}</p></header>
    <div class="wind-standards" aria-label="Wind standards"><button type="button" :aria-pressed="open" @click="open=true">ASCE 7-10 <small>{{ t('Chọn công trình','Choose building') }} →</small></button><button type="button" disabled>ASCE 7-16</button><button type="button" disabled>ASCE 7-22</button><button type="button" disabled>EN 1991-1-4</button></div>
    <template v-if="open">
      <nav class="wind-procedures" aria-label="Wind procedures"><button v-for="item in WIND_GROUPS" :key="item.id" type="button" :aria-pressed="group===item.id" @click="group=item.id"><small>CHAPTER {{ item.chapter }}</small><strong>{{ en?item.en:item.vi }}</strong></button></nav>
      <div class="wind-building-grid"><component :is="item.ready ? 'a' : 'button'" v-for="item in choices" :key="item.id" :href="item.ready ? destination(item) : undefined" :disabled="!item.ready" :data-wind-building="item.id" class="wind-building-card"><div class="building-image"><WindBuildingSketch mode="catalog" :shape="item.shape" /></div><div class="building-caption"><small>{{ item.ref }} · ASCE 7-10</small><h3>{{ en?item.en:item.vi }}</h3><p>{{ item.id==='envelope-low-rise' ? t('MWFRS · Tường & mái · h ≤18 m · 5 phần báo cáo','MWFRS · Walls & roofs · h ≤18 m · 5 report sections') : item.ready ? t('Bộ tính Chương 27 hiện có','Existing Chapter 27 calculation') : t('Đang chờ phát triển','Coming soon') }}</p><span v-if="item.ready">{{ t('Mở workspace','Open workspace') }} →</span></div></component></div>
    </template>
    <p v-else class="wind-prompt">{{ t('Bấm ASCE 7-10 để xem các loại công trình có hình minh họa.','Select ASCE 7-10 to browse illustrated building types.') }}</p>
  </section>
</template>
<style scoped>
.wind-picker{background:#f7fafc;border:1px solid #d4e0e8;border-radius:12px;padding:24px;color:#23395d}.wind-eyebrow{font-size:12px;letter-spacing:.12em;color:#607b91}.wind-picker h2{font-size:27px;margin:10px 0}.wind-picker header p{color:#60768b;line-height:1.7}.wind-standards{display:flex;gap:9px;flex-wrap:wrap;margin:22px 0}.wind-standards button{background:white;border:1px solid #bbcad8;border-radius:8px;padding:12px 17px;font-size:16px;color:#23395d;cursor:pointer}.wind-standards button:first-child{background:#23395d;color:white}.wind-standards small{font-size:11px;margin-left:8px}.wind-standards button:disabled{opacity:.45;cursor:default}.wind-procedures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:24px 0}.wind-procedures button{display:grid;gap:7px;text-align:left;background:white;border:1px solid #cbd8e3;border-radius:8px;padding:14px;color:#36536c;cursor:pointer}.wind-procedures button[aria-pressed=true]{background:#e8f0f7;border-color:#456f91;box-shadow:inset 0 3px #315e82}.wind-procedures small{font-size:11px;letter-spacing:.08em}.wind-procedures strong{font-size:14px;line-height:1.5}.wind-building-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.wind-building-card{border:1px solid #cbd9e4;background:white;border-radius:12px;text-decoration:none;color:#23395d;overflow:hidden;text-align:left;min-width:0;display:flex;flex-direction:column;padding:0;font:inherit}.wind-building-card[href]:hover{border-color:#366788;box-shadow:0 5px 18px #23395d15}.wind-building-card[disabled]{opacity:.6;cursor:default}.building-image{background:#edf4f8;padding:15px 10px}.building-caption{padding:18px}.building-caption small{font-size:12px;color:#627b90}.building-caption h3{font-size:19px;line-height:1.4;margin:10px 0}.building-caption p{font-size:13px;line-height:1.7;color:#667d91}.building-caption>span{display:inline-block;margin-top:12px;font-size:13px;font-weight:700}.wind-prompt{border-top:1px solid #d3dfe8;padding-top:20px;color:#617a8f}.wind-back{display:inline-block;color:#315e82;margin-bottom:16px}button:focus-visible,a:focus-visible{outline:2px solid #4e91bc;outline-offset:3px}@media(max-width:1000px){.wind-procedures{grid-template-columns:repeat(2,minmax(0,1fr))}.wind-building-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.wind-building-grid,.wind-procedures{grid-template-columns:1fr}.wind-picker{padding:16px}.wind-picker h2{font-size:23px}}
</style>
