<script setup>
import { useId } from 'vue'
defineProps({ mode:{type:String,default:'elevation'}, roof:{type:String,default:'GABLE'}, shape:{type:String,default:'gable'}, direction:{type:String,default:'A'}, torsion:Boolean })
const marker = 'wind-arrow-' + useId().replace(/[^a-z0-9-]/gi,'')
</script>
<template>
  <svg viewBox="0 0 600 310" role="img" :aria-label="mode === 'plan' ? 'Building plan: L parallel to ridge, B normal to ridge and two wind directions' : mode === 'zones' ? `Case ${direction} ${torsion ? 'torsion' : 'basic'} surface zones` : 'Roof geometry and dimensions B, hr, he, h, theta'" class="wind-sketch">
    <defs><marker :id="marker" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10" fill="#2f6b99" /></marker></defs>
    <g v-if="mode === 'plan'">
      <rect x="135" y="55" width="330" height="160" rx="3" fill="#eff5fa" stroke="#23395d" stroke-width="2" />
      <path d="M135 135H465" stroke="#a55f31" stroke-width="2" stroke-dasharray="7 5" />
      <text x="300" y="125" text-anchor="middle">Ridge / Đỉnh mái</text>
      <g stroke="#2f6b99" stroke-width="1.5" :marker-start="`url(#${marker})`" :marker-end="`url(#${marker})`"><path d="M135 250H465" /><path d="M510 55V215" /></g>
      <g stroke="#90a5b8"><path d="M135 221V268M465 221V268M475 55H530M475 215H530" /></g>
      <text x="300" y="278" text-anchor="middle">L · Along ridge / Dọc nhà</text><text x="524" y="143">B</text>
      <path d="M40 135H117M300 302V230" stroke="#2f6b99" stroke-width="3" :marker-end="`url(#${marker})`" />
      <text x="15" y="115" font-size="13">Wind B →</text><text x="325" y="301" font-size="13">↑ Wind A</text>
    </g>
    <g v-else-if="mode === 'zones'">
      <template v-if="direction === 'A'">
        <path d="M155 235V140L300 55 445 140V235" fill="#eff5f9" stroke="#23395d" stroke-width="2" />
        <path d="M155 140 300 55" stroke="#528eac" stroke-width="8" /><path d="M300 55 445 140" stroke="#72a694" stroke-width="8" />
        <path d="M155 140V235M445 140V235" stroke="#528eac" stroke-width="7" />
        <path d="M45 190H130" stroke="#2f6b99" stroke-width="4" :marker-end="`url(#${marker})`" />
        <g font-size="20" font-weight="700"><text x="119" y="193">1{{ torsion ? 'T' : '' }}</text><text x="208" y="92">2{{ torsion ? 'T' : '' }}</text><text x="365" y="92">3{{ torsion ? 'T' : '' }}</text><text x="460" y="193">4{{ torsion ? 'T' : '' }}</text></g>
        <text x="300" y="177" text-anchor="middle">Case A · Transverse section</text>
        <text x="300" y="202" text-anchor="middle">Wind normal to ridge / Gió ngang nhà</text>
      </template>
      <template v-else>
        <rect x="140" y="70" width="320" height="160" fill="#eff5f9" stroke="#23395d" stroke-width="2" />
        <rect x="140" y="70" width="40" height="160" fill="#a8cdbf" opacity=".8" />
        <path d="M300 70V230" stroke="#7593a9" stroke-dasharray="6 4" />
        <path d="M140 150H460" stroke="#8aa6bb" stroke-dasharray="6 4" />
        <path d="M40 150H120" stroke="#2f6b99" stroke-width="4" :marker-end="`url(#${marker})`" />
        <g font-size="20" font-weight="700"><text x="104" y="160">5{{ torsion ? 'T' : '' }}</text><text x="477" y="160">6{{ torsion ? 'T' : '' }}</text><text x="285" y="52">1</text><text x="285" y="254">4</text><text x="220" y="138">2</text><text x="380" y="138">3</text></g>
        <g font-size="12"><text x="145" y="96">1E/2E</text><text x="145" y="214">3E/4E</text></g>
        <text x="300" y="185" text-anchor="middle">Case B · Plan / Mặt bằng</text>
        <text x="300" y="208" text-anchor="middle">L → · Wind along ridge / Gió dọc nhà</text>
      </template>
      <text x="300" y="281" text-anchor="middle">{{ torsion ? 'T: 25% net pressure · áp lực thuần' : 'E: end zones / vùng biên · 2a' }}</text>
      <text x="300" y="305" text-anchor="middle" font-size="12">Schematic / Minh họa · Full patterns: Fig. 28.4-1</text>
    </g>
    <g v-else>
      <g v-if="shape === 'sign'"><path d="M170 70H430V190H170ZM220 190V260M380 190V260" fill="#dceaf1" stroke="#23395d" stroke-width="3" /></g>
      <g v-else>
        <path d="M150 235V135H450V235Z" fill="#edf3f8" stroke="#23395d" stroke-width="2" />
        <path v-if="shape === 'dome' || shape === 'arch'" d="M150 135Q300 -10 450 135Z" fill="#d2e5ef" stroke="#23395d" stroke-width="2" />
        <path v-else-if="shape === 'trough'" d="M150 100 300 155 450 100" fill="none" stroke="#23395d" stroke-width="4" />
        <path v-else-if="roof === 'MONOSLOPE' || shape === 'mono'" d="M150 135V60L450 135Z" fill="#d2e5ef" stroke="#23395d" stroke-width="2" />
        <path v-else d="M150 135 300 60 450 135Z" fill="#d2e5ef" stroke="#23395d" stroke-width="2" />
      </g>
      <g v-if="mode !== 'catalog'" stroke="#2f6b99" stroke-width="1.4" :marker-start="`url(#${marker})`" :marker-end="`url(#${marker})`"><path d="M110 60V235M490 135V235M150 270H450M355 98V235" /></g>
      <g v-if="mode !== 'catalog'" fill="#24608c" font-size="18"><text x="80" y="150">hr</text><text x="500" y="195">he</text><text x="364" y="186">h</text><text x="300" y="295" text-anchor="middle">B · Normal to ridge / Ngang nhà</text><text x="212" y="125">θ</text></g>
      <path d="M42 180H125" stroke="#2f6b99" stroke-width="3" :marker-end="`url(#${marker})`" />
      <text x="30" y="162" font-size="13">Wind</text>
    </g>
  </svg>
</template>
<style scoped>.wind-sketch{width:100%;height:auto;display:block;max-height:310px;font-family:Calibri,'Segoe UI',sans-serif;color:#23395d}text{fill:#284961;font-size:20px}</style>
