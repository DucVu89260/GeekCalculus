<script setup>
import { computed } from 'vue'

const props = defineProps({
  connection: { type: Object, default: null },
  thumbnail: { type: String, default: '' },
  group: { type: String, default: '' },
  label: { type: String, default: '' },
})

const id = computed(() => props.thumbnail || props.connection?.thumbnail || props.connection?.id || '')
const groupId = computed(() => props.connection?.group || props.group || (['base', 'anchorage'].includes(id.value) ? 'anchorage' : 'steel'))
const accessibleLabel = computed(() => props.label || props.connection?.name_en || props.connection?.name_vi || 'Connection illustration')
const isAnchorage = computed(() => groupId.value === 'anchorage')
const mode = computed(() => {
  const value = id.value
  if (value === 'base' || ['simple_base', 'moment_base', 'stiffened_base', 'shear_lug'].includes(value)) return 'base'
  if (value === 'moment') return 'moment'
  if (value === 'shear' || value === 'simple') return 'shear'
  if (isAnchorage.value) {
    if (['embedded_plate', 'anchor_channel'].includes(value)) return 'embedded'
    if (['headed_anchor', 'hooked_anchor', 'expansion_anchor', 'undercut_anchor', 'screw_anchor', 'adhesive_anchor'].includes(value)) return 'anchor'
    return 'anchorage'
  }
  if (value === 'brace_gusset' || value === 'hss_slotted_gusset' || value === 'clevis_pin' || value === 'truss_node' || value === 'cross_brace' || value.includes('brace') || value.includes('truss') || value.includes('clevis')) return 'brace'
  if (value.includes('splice')) return 'splice'
  if (value.startsWith('hss_')) return 'hss'
  if (['purlin_girt_cleat', 'support_bracket', 'facade_attachment', 'hanger_connection', 'crane_rail_attachment'].includes(value)) return 'secondary'
  if (value === 'rbs' || value === 'wuf_w' || value === 'double_tee_moment' || value === 'slotted_web' || value === 'special_moment_system' || value.includes('moment') || props.connection?.family === 'moment' || props.connection?.family === 'seismic') return 'moment'
  if (props.connection?.family === 'simple_shear' || value.includes('shear') || value.includes('seat')) return 'shear'
  return 'steel'
})
const isWelded = computed(() => /welded|wuf|direct_welded|haunched/.test(id.value))
const isBolted = computed(() => !isWelded.value && /bolted|anchor|shear|plate|splice|hss|cleat|seat|bracket|base|gusset|flange_angle_moment/.test(id.value))
</script>

<template>
  <svg class="connection-thumbnail" viewBox="0 0 180 112" role="img" :aria-label="accessibleLabel" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <title>{{ accessibleLabel }}</title>
    <rect x="1" y="1" width="178" height="110" rx="10" fill="#f2f4f5" stroke="#d4dce2" />

    <template v-if="isAnchorage">
      <rect x="10" y="65" width="160" height="37" rx="2" fill="#d8dee2" stroke="#a4afb7" stroke-width="1.5" />
      <path d="M10 72h160M18 88h144M25 96h130" stroke="#c0c8ce" stroke-width="1" />
      <circle cx="31" cy="80" r="1.5" fill="#aeb9c0" /><circle cx="148" cy="78" r="1.5" fill="#aeb9c0" />
      <circle cx="42" cy="93" r="1.5" fill="#aeb9c0" /><circle cx="136" cy="91" r="1.5" fill="#aeb9c0" />

      <g v-if="mode === 'anchor'" fill="none" stroke="#365d7e" stroke-linecap="round" stroke-linejoin="round">
        <path d="M69 15v67M111 15v67" stroke-width="5" />
        <path v-if="id === 'headed_anchor'" d="M62 82h14M104 82h14" stroke-width="6" />
        <path v-else-if="id === 'hooked_anchor'" d="M69 78v9h10M111 78v9h-10" stroke-width="4" />
        <path v-else-if="id === 'expansion_anchor'" d="m64 72 5 5 5-5m32 0 5 5 5-5" stroke-width="3.5" />
        <path v-else-if="id === 'undercut_anchor'" d="m64 75 5 6 5-6m32 0 5 6 5-6" stroke-width="4.5" />
        <path v-else-if="id === 'screw_anchor'" d="m65 42 8 4m-8 5 8 4m-8 5 8 4m34-22 8 4m-8 5 8 4m-8 5 8 4" stroke-width="2" />
        <path v-else d="M64 43h10v39m32-39h10v39" stroke-width="2" opacity=".7" />
        <path d="M57 13h24M99 13h24" stroke-width="3" />
      </g>

      <g v-else-if="mode === 'embedded'">
        <rect x="43" y="63" width="94" height="7" rx="1" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <path d="M57 66v24M123 66v24" stroke="#365d7e" stroke-width="4" />
        <template v-if="id === 'anchor_channel'">
          <path d="M52 45v12h76V45M59 50h62" fill="none" stroke="#355d7d" stroke-width="5" stroke-linejoin="round" />
          <circle cx="71" cy="49" r="3" fill="#e7b34f" /><circle cx="109" cy="49" r="3" fill="#e7b34f" />
        </template>
        <template v-else>
          <rect x="65" y="38" width="50" height="8" fill="#527796" stroke="#294966" stroke-width="1.5" />
          <path d="M74 37v-8m32 8v-8" stroke="#365d7e" stroke-width="3" />
        </template>
      </g>

      <g v-else-if="mode === 'base'">
        <path d="M70 13h40v7H94v37h16v7H70v-7h16V20H70z" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <rect x="40" y="62" width="100" height="7" rx="1" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <path d="M52 64v29m76-29v29" stroke="#365d7e" stroke-width="3.5" />
        <path v-if="id === 'stiffened_base'" d="M48 61 68 43v18m64 0L112 43v18" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
        <path v-if="id === 'shear_lug'" d="M85 68v17h10V68" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <circle v-for="x in [52, 128]" :key="`base-bolt-${x}`" :cx="x" cy="62" r="3" fill="#e7b34f" stroke="#8b6a2d" />
      </g>

      <g v-else>
        <path d="M67 15h46v8H94v34h19v8H67v-8h19V23H67z" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <rect x="43" y="62" width="94" height="7" rx="1" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <path d="M58 65v27m64-27v27" stroke="#365d7e" stroke-width="3.5" />
      </g>
    </template>

    <template v-else-if="mode === 'brace'">
      <path d="M15 87 87 48 163 87" fill="none" stroke="#527796" stroke-width="12" stroke-linecap="square" />
      <path d="m67 59 22-19 24 20-25 19z" fill="#d9e0e5" stroke="#365d7e" stroke-width="2" />
      <path d="m78 54 20 17m-24-1 19-17" stroke="#365d7e" stroke-width="2" />
      <circle cx="87" cy="59" r="3.5" fill="#e7b34f" /><circle cx="77" cy="67" r="3.5" fill="#e7b34f" /><circle cx="98" cy="67" r="3.5" fill="#e7b34f" />
      <path v-if="id === 'clevis_pin'" d="M22 82v12m-5-6h10m116-8v12m-5-6h10" stroke="#294966" stroke-width="3" />
      <path v-if="id === 'cross_brace'" d="M16 27 163 95M16 95 163 27" stroke="#7895ad" stroke-width="6" opacity=".9" />
      <path v-if="id === 'truss_node'" d="M87 48V15M67 59 43 22m45 37 42-36" stroke="#527796" stroke-width="7" />
    </template>

    <template v-else-if="mode === 'hss'">
      <g fill="#7895ad" stroke="#294966" stroke-width="2">
        <rect x="74" y="14" width="32" height="84" rx="3" />
        <rect v-if="!id.includes('_k_n')" x="16" y="39" width="60" height="27" rx="3" />
        <rect v-if="id.includes('_x')" x="104" y="39" width="60" height="27" rx="3" />
      </g>
      <g fill="#f2f4f5" stroke="#456a86" stroke-width="1.2">
        <rect x="80" y="21" width="20" height="70" rx="2" />
        <rect v-if="!id.includes('_k_n')" x="21" y="45" width="49" height="15" rx="2" />
        <rect v-if="id.includes('_x')" x="110" y="45" width="49" height="15" rx="2" />
      </g>
      <g v-if="id.includes('_k_n')" fill="#7895ad" stroke="#294966" stroke-width="2" stroke-linejoin="round">
        <path d="M14 21 79 41v13L14 35z" />
        <path d="M14 77 79 58v13L14 91z" />
        <path d="m23 27 47 15m-47 41 47-14" fill="none" stroke="#e4e9ed" stroke-width="3" />
      </g>
      <path v-if="id.includes('plate') || id.includes('bolted')" d="M69 34h42v38H69z" fill="none" stroke="#e7b34f" stroke-width="4" />
      <path v-if="id.includes('through')" d="M86 15v83" stroke="#e7b34f" stroke-width="4" />
      <circle v-if="id.includes('bolted')" cx="90" cy="41" r="3" fill="#e7b34f" /><circle v-if="id.includes('bolted')" cx="90" cy="65" r="3" fill="#e7b34f" />
    </template>

    <template v-else-if="mode === 'splice'">
      <path v-if="id.includes('column')" d="M68 10h44v8H94v76h18v8H68v-8h18V18H68z" fill="#527796" stroke="#294966" stroke-width="1.5" />
      <template v-else>
        <path d="M13 41h154v11H13zM13 64h154v11H13z" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <path d="M13 50h154v16H13z" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
      </template>
      <rect v-if="!id.includes('column')" x="75" y="31" width="30" height="57" rx="1" fill="#d9e0e5" stroke="#365d7e" stroke-width="2" />
      <rect v-if="id.includes('column')" x="62" y="47" width="56" height="25" fill="#d9e0e5" stroke="#365d7e" stroke-width="2" />
      <g v-if="isBolted" fill="#e7b34f" stroke="#8b6a2d" stroke-width="1">
        <circle v-for="x in [81, 99]" :key="`splice-x-${x}`" :cx="x" cy="42" r="3" />
        <circle v-for="x in [81, 99]" :key="`splice-y-${x}`" :cx="x" cy="78" r="3" />
      </g>
      <path v-if="isWelded" d="M70 35l5 4-5 4 5 4m25-12 5 4-5 4 5 4" fill="none" stroke="#c27e50" stroke-width="2" />
    </template>

    <template v-else>
      <path d="M67 11h46v8H94v78h19v8H67v-8h19V19H67z" fill="#527796" stroke="#294966" stroke-width="1.5" />
      <path d="M15 40h57v11H15zM15 61h57v11H15z" fill="#527796" stroke="#294966" stroke-width="1.5" />

      <g v-if="mode === 'moment'">
        <template v-if="id === 'extended_end_plate' || id === 'flush_end_plate'">
          <rect x="66" :y="id === 'extended_end_plate' ? 30 : 39" width="9" :height="id === 'extended_end_plate' ? 52 : 34" rx="1" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
          <circle v-if="isBolted" v-for="y in (id === 'extended_end_plate' ? [35, 45, 55, 66, 77] : [44, 52, 60, 68])" :key="`endplate-bolt-a-${y}`" cx="78" :cy="y" r="2.4" fill="#e7b34f" />
          <circle v-if="isBolted" v-for="y in (id === 'extended_end_plate' ? [35, 45, 55, 66, 77] : [44, 52, 60, 68])" :key="`endplate-bolt-b-${y}`" cx="104" :cy="y" r="2.4" fill="#e7b34f" />
        </template>
        <template v-else-if="id.includes('flange_plate')">
          <rect x="62" y="33" width="42" height="8" rx="1" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
          <rect x="62" y="71" width="42" height="8" rx="1" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
          <circle v-if="isBolted" v-for="x in [73, 91]" :key="`flange-bolt-top-${x}`" :cx="x" cy="37" r="2.4" fill="#e7b34f" />
          <circle v-if="isBolted" v-for="x in [73, 91]" :key="`flange-bolt-bottom-${x}`" :cx="x" cy="75" r="2.4" fill="#e7b34f" />
          <path v-if="isWelded" d="M66 42l4 4-4 4m0 10 4 4-4 4" fill="none" stroke="#c27e50" stroke-width="2" />
        </template>
        <template v-else>
          <path v-if="isWelded" d="M66 40l5 4-5 4m0 15 5 4-5 4m22-31 5 4-5 4" fill="none" stroke="#c27e50" stroke-width="2" />
          <circle v-if="isBolted" cx="72" cy="45" r="2.4" fill="#e7b34f" />
          <circle v-if="isBolted" cx="72" cy="66" r="2.4" fill="#e7b34f" />
        </template>
        <path v-if="id === 'rbs'" d="M20 39q14 7 0 14m0 8q14 7 0 14" fill="none" stroke="#f2f4f5" stroke-width="2" />
        <path v-if="id === 'special_moment_system'" d="M62 29h40v54H62z" fill="none" stroke="#e7b34f" stroke-width="2" stroke-dasharray="4 3" />
      </g>

      <g v-else-if="mode === 'shear'">
        <rect x="66" y="44" width="8" height="25" rx="1" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
        <circle v-if="isBolted" v-for="y in [49, 57, 65]" :key="`shear-bolt-${y}`" cx="69.5" :cy="y" r="2.2" fill="#e7b34f" />
        <path v-if="id.includes('seat')" d="M70 72h18v7H70zM70 78v-8" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
        <path v-if="id === 'stiffened_seat'" d="m71 72 12-12v12" fill="#d6a54a" stroke="#8b6a2d" stroke-width="1.3" />
        <path v-if="isWelded" d="m74 46 4 4-4 4m0 7 4 4-4 4" fill="none" stroke="#c27e50" stroke-width="1.8" />
        <path v-if="id === 'double_angle_shear'" d="M61 44v25m5-25v25" stroke="#c27e50" stroke-width="2" />
      </g>

      <g v-else-if="mode === 'secondary'">
        <path d="M72 31h73v10H72z" fill="#527796" stroke="#294966" stroke-width="1.5" />
        <path d="M82 41v29h-8V41m8 29h21v-7H82" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
        <circle v-if="isBolted" cx="86" cy="47" r="2.5" fill="#e7b34f" /><circle v-if="isBolted" cx="86" cy="58" r="2.5" fill="#e7b34f" />
        <path v-if="id === 'facade_attachment'" d="M108 28v43h38V28" fill="none" stroke="#7895ad" stroke-width="4" />
        <path v-if="id === 'crane_rail_attachment'" d="M79 25h67v5H79zm12 5v7m17-7v7m17-7v7" fill="#d6a54a" stroke="#8b6a2d" stroke-width="1.5" />
      </g>

      <g v-else>
        <rect x="66" y="44" width="9" height="25" rx="1" fill="#7895ad" stroke="#294966" stroke-width="1.5" />
        <circle v-if="isBolted" v-for="y in [49, 57, 65]" :key="`generic-bolt-${y}`" cx="70.5" :cy="y" r="2.2" fill="#e7b34f" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.connection-thumbnail { display: block; width: 100%; height: auto; overflow: hidden; border-radius: 8px; }
</style>
