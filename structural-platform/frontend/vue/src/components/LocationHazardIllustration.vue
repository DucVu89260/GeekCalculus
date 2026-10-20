<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: { type: String, required: true, validator: value => ['wind', 'seismic'].includes(value) },
  locale: { type: String, required: true },
})
const labels = computed(() => props.locale === 'vi'
  ? { wind: 'Gió tác dụng lên công trình', seismic: 'Gia tốc nền tham chiếu aɡR', note: 'Hình minh họa', ground: 'Chuyển động nền' }
  : { wind: 'Wind acting on a structure', seismic: 'Reference ground acceleration aɡR', note: 'Schematic illustration', ground: 'Ground motion' })
</script>

<template>
  <figure class="hazard-illustration" :data-hazard="kind">
    <svg viewBox="0 0 480 170" role="img" :aria-label="labels[kind]">
      <g v-if="kind === 'wind'" stroke-linecap="round" stroke-linejoin="round">
        <!-- Wind streams and pressure arrows; schematic, without numeric scale. -->
        <g fill="none" stroke="#648ba6" stroke-width="3">
          <path d="M29 58 H125 Q145 58 145 44 Q145 31 132 31 Q120 31 120 42" />
          <path d="M18 85 H170 M53 111 H149" />
          <path d="m159 77 11 8-11 8 M138 103l11 8-11 8" />
          <path d="M164 49 Q208 17 256 22 H323 M313 15l10 7-10 7" opacity=".65" />
        </g>
        <path d="M209 78 293 38 379 78 V139 H209Z" fill="#e1eaf0" stroke="#23395d" stroke-width="2.5" />
        <path d="M209 78 H379 M293 38 V139 M220 87 H279 V130 H220Z M308 87 H367 V130 H308Z" fill="none" stroke="#648ba6" stroke-width="2" />
        <path d="M220 87 279 130 M279 87 220 130 M308 87 367 130 M367 87 308 130" fill="none" stroke="#a0b7c7" stroke-width="1.5" />
        <g fill="none" stroke="#23395d" stroke-width="2.5">
          <path d="M169 86 H201 m-9-6 9 6-9 6 M169 112 H201 m-9-6 9 6-9 6" />
          <path d="M241 34 251 54 m-9-5 9 5 1-10" />
        </g>
        <path d="M183 140 H406" stroke="#b1b7bb" stroke-width="2" />
        <path d="M198 149 H391" stroke="#d0d5d8" stroke-width="2" stroke-dasharray="4 9" />
      </g>
      <g v-else stroke-linecap="round" stroke-linejoin="round">
        <!-- A grounded frame and bidirectional ground movement, not a response spectrum. -->
        <path d="M160 107 V35 H320 V107Z" fill="#e1eaf0" stroke="#23395d" stroke-width="2.5" />
        <path d="M160 59 H320 M160 83 H320 M213 35 V107 M267 35 V107" fill="none" stroke="#648ba6" stroke-width="2" />
        <path d="M151 107 H329 V117 H151Z" fill="#c0cfda" stroke="#23395d" stroke-width="2" />
        <path d="M79 118 H401 L413 143 H67Z" fill="#e8e1d5" />
        <path d="M79 118 H401 M73 131 H176 l10-5 12 10 12-5 H407" fill="none" stroke="#b6aa96" stroke-width="1.5" />
        <g fill="none" stroke="#648ba6" stroke-width="2.5">
          <path d="M53 82 H70 l6-12 8 24 8-35 8 39 8-16 H130" />
          <path d="M187 153 H293 m-11-6 11 6-11 6 M198 147l-11 6 11 6" />
        </g>
        <text x="353" y="65" fill="#23395d" font-size="21" font-family="inherit">a<tspan baseline-shift="sub" font-size="13">gR</tspan></text>
      </g>
    </svg>
    <figcaption><strong>{{ labels[kind] }}</strong><span>{{ kind === 'seismic' ? labels.ground + ' · ' : '' }}{{ labels.note }}</span></figcaption>
  </figure>
</template>

<style scoped>
.hazard-illustration { margin:0 0 22px; padding:8px 12px 13px; border:1px solid #d3dde3; border-radius:10px; background:#fbfcfc; color:#23395d; }
.hazard-illustration svg { display:block; width:100%; height:auto; max-height:170px; }
.hazard-illustration figcaption { display:flex; flex-direction:column; gap:4px; text-align:center; line-height:1.5; }
.hazard-illustration strong { font-size:15px; font-weight:600; }
.hazard-illustration span { font-size:12px; color:#53677b; }
</style>
