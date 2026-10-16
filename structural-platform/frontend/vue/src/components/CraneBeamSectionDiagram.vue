<script setup>
import { computed } from 'vue'

const props = defineProps({
  dimensions: { type: Object, default: () => ({}) },
  sections: { type: Object, default: null },
  locale: { type: String, default: 'en' },
  variant: { type: String, default: 'section' },
})

const words = {
  en: {
    wholeTitle: 'Whole asymmetric I/H section', effectiveTitle: 'Effective top and bottom T sections',
    topT: 'Top flange + effective web', bottomT: 'Bottom flange + effective web',
    cg: 'CG', pna: 'PNA', xAxis: 'X', yAxis: 'Y', schematicNote: 'Illustrative geometry scaled from the submitted dimensions.',
    bearingTitle: 'Local wheel-to-flange bearing · J10', wheel: 'Wheel / rail contact', wlmax: 'WLmax',
    bearing: 'Bearing length N', flange: 'Top flange', web: 'Web',
  },
  vi: {
    wholeTitle: 'Tiết diện I/H bất đối xứng hoàn chỉnh', effectiveTitle: 'Các tiết diện chữ T hiệu dụng trên và dưới',
    topT: 'Cánh trên + phần bụng hiệu dụng', bottomT: 'Cánh dưới + phần bụng hiệu dụng',
    cg: 'CG', pna: 'PNA', xAxis: 'X', yAxis: 'Y', schematicNote: 'Hình minh họa được co giãn theo kích thước đã nhập.',
    bearingTitle: 'Ép cục bộ bánh xe lên cánh · J10', wheel: 'Tiếp xúc bánh xe / ray', wlmax: 'WLmax',
    bearing: 'Chiều dài tựa N', flange: 'Cánh trên', web: 'Bụng',
  },
}
const t = key => words[props.locale]?.[key] ?? words.en[key]
const d = computed(() => ({
  depth: Number(props.dimensions?.depth) || 0,
  topWidth: Number(props.dimensions?.top_flange_width) || 0,
  bottomWidth: Number(props.dimensions?.bottom_flange_width) || 0,
  topThickness: Number(props.dimensions?.top_flange_thickness) || 0,
  bottomThickness: Number(props.dimensions?.bottom_flange_thickness) || 0,
  webThickness: Number(props.dimensions?.web_thickness) || 0,
}))
const whole = computed(() => {
  const maxWidth = Math.max(d.value.topWidth, d.value.bottomWidth, d.value.webThickness, 1)
  const scale = Math.min(178 / maxWidth, 194 / Math.max(d.value.depth, 1))
  const width = maxWidth * scale
  const left = 66 + (178 - width) / 2
  const y = 42
  const webX = left + (width - d.value.webThickness * scale) / 2
  return {
    scale, left, y, width, height: d.value.depth * scale,
    topX: left + (width - d.value.topWidth * scale) / 2,
    topWidth: d.value.topWidth * scale,
    bottomX: left + (width - d.value.bottomWidth * scale) / 2,
    bottomWidth: d.value.bottomWidth * scale,
    webX, webWidth: d.value.webThickness * scale,
    topH: d.value.topThickness * scale,
    bottomY: y + Math.max(d.value.depth - d.value.bottomThickness, 0) * scale,
    bottomH: d.value.bottomThickness * scale,
  }
})
const tSections = computed(() => {
  const topDepth = d.value.topThickness + (Number(props.sections?.top_web_depth_mm) || 0)
  const bottomDepth = d.value.bottomThickness + (Number(props.sections?.bottom_web_depth_mm) || 0)
  const maxWidth = Math.max(d.value.topWidth, d.value.bottomWidth, d.value.webThickness, 1)
  const scale = Math.min(118 / maxWidth, 176 / Math.max(topDepth, bottomDepth, 1))
  const topWidth = d.value.topWidth * scale
  const bottomWidth = d.value.bottomWidth * scale
  const topX = 44 + (170 - topWidth) / 2
  const bottomX = 284 + (170 - bottomWidth) / 2
  const topY = 47 + (176 - topDepth * scale) / 2
  const bottomY = 47 + (176 - bottomDepth * scale) / 2
  const webWidth = d.value.webThickness * scale
  const topWebDepth = Number(props.sections?.top_web_depth_mm) || 0
  const bottomWebDepth = Number(props.sections?.bottom_web_depth_mm) || 0
  return {
    scale, topDepth, bottomDepth, topX, bottomX, topY, bottomY, topWidth, bottomWidth, webWidth,
    topWebX: topX + (topWidth - webWidth) / 2,
    bottomWebX: bottomX + (bottomWidth - webWidth) / 2,
    topFlangeHeight: d.value.topThickness * scale,
    bottomFlangeHeight: d.value.bottomThickness * scale,
    topWebHeight: topWebDepth * scale,
    bottomWebHeight: bottomWebDepth * scale,
    topCgY: topY + (Number(props.sections?.top_yc_from_outer_face_mm) || 0) * scale,
    bottomCgY: bottomY + bottomDepth * scale - (Number(props.sections?.bottom_yc_from_outer_face_mm) || 0) * scale,
  }
})
const baseProperties = computed(() => props.sections?.base?.properties ?? {})
const cgY = computed(() => {
  const raw = baseProperties.value.geometric?.centroid_y
  if (raw === null || raw === undefined) return null
  const value = Number(raw)
  return Number.isFinite(value) ? whole.value.y + (d.value.depth - value) * whole.value.scale : null
})
const pnaY = computed(() => {
  const raw = baseProperties.value.plastic?.pna_y
  if (raw === null || raw === undefined) return null
  const value = Number(raw)
  return Number.isFinite(value) ? whole.value.y + (d.value.depth - value) * whole.value.scale : null
})
const axisLabels = computed(() => {
  const cg = cgY.value
  const pna = pnaY.value
  const offset = cg !== null && pna !== null && Math.abs(cg - pna) < 22
  const clamp = (value) => Math.max(16, Math.min(292, value))
  if (!offset) return { offset: false, cgY: cg === null ? null : clamp(cg + 4), pnaY: pna === null ? null : clamp(pna + 4) }
  return cg <= pna
    ? { offset: true, cgY: clamp(cg - 8), pnaY: clamp(pna + 14) }
    : { offset: true, cgY: clamp(cg + 14), pnaY: clamp(pna - 8) }
})
const dimensionLabels = computed(() => ({
  depth: number(d.value.depth), topWidth: number(d.value.topWidth), bottomWidth: number(d.value.bottomWidth),
  topThickness: number(d.value.topThickness), bottomThickness: number(d.value.bottomThickness), webThickness: number(d.value.webThickness),
}))
function number(value) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 4 }).format(value)
}
</script>

<template>
  <div v-if="variant === 'bearing'" class="crane-local-bearing">
    <svg viewBox="0 0 360 220" role="img" :aria-label="t('bearingTitle')" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <title>{{ t('bearingTitle') }}</title>
      <rect x="1" y="1" width="358" height="218" rx="10" fill="#fcfbf7" stroke="#d8e2e9" />
      <circle cx="180" cy="43" r="25" fill="#dce3e8" stroke="#526c80" stroke-width="2" />
      <path d="M155 43h50m-25-25v50" stroke="#9baab5" stroke-width="1.5" />
      <rect x="135" y="74" width="90" height="10" rx="2" fill="#596d7c" />
      <path d="M135 68h90m-90-4v12m90-12v12" stroke="#47677f" stroke-width="1.5" fill="none" />
      <path d="M180 82v18m-7-8 7 9 7-9" stroke="#ac6235" stroke-width="2.5" fill="none" />
      <rect x="47" y="101" width="266" height="18" fill="#c7e0ed" stroke="#285474" stroke-width="2" />
      <rect x="171" y="117" width="18" height="84" fill="#c7e0ed" stroke="#285474" stroke-width="2" />
      <path d="M47 126h266" stroke="#fff" stroke-width="2" opacity=".7" />
      <g fill="#345670" text-anchor="middle" font-size="13" font-family="system-ui, sans-serif">
        <text x="180" y="15">{{ t('wheel') }}</text>
        <text x="180" y="61">N</text>
        <text x="180" y="96">{{ t('wlmax') }}</text>
        <text x="235" y="115">{{ t('flange') }}</text>
        <text x="205" y="162">{{ t('web') }}</text>
      </g>
      <path d="M135 58v-7m90 7v-7" stroke="#47677f" stroke-width="1.5" />
      <text x="260" y="67" fill="#345670" font-size="12" font-family="system-ui, sans-serif">{{ t('bearing') }}</text>
    </svg>
  </div>

  <div v-else class="crane-section-diagrams">
    <figure class="crane-section-diagram">
      <figcaption>{{ t('wholeTitle') }}</figcaption>
      <svg viewBox="0 0 400 300" role="img" :aria-label="t('wholeTitle')" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <title>{{ t('wholeTitle') }}</title>
        <defs><marker id="crane-section-axis-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 6 3.5 0 7" fill="none" stroke="#355c78" /></marker></defs>
        <rect x="1" y="1" width="398" height="298" rx="10" fill="#fcfbf7" stroke="#d8e2e9" />
        <rect :x="whole.topX" :y="whole.y" :width="whole.topWidth" :height="whole.topH" fill="#c7dce8" stroke="#285474" stroke-width="2" />
        <rect :x="whole.webX" :y="whole.y + whole.topH" :width="whole.webWidth" :height="Math.max(whole.height - whole.topH - whole.bottomH, 0)" fill="#c7dce8" stroke="#285474" stroke-width="2" />
        <rect :x="whole.bottomX" :y="whole.bottomY" :width="whole.bottomWidth" :height="whole.bottomH" fill="#c7dce8" stroke="#285474" stroke-width="2" />
        <path d="M65 271h270m-270 0-5-4m5 4-5 4" stroke="#7a8994" stroke-width="1.3" fill="none" />
        <text x="197" y="289" text-anchor="middle" fill="#526c80" font-size="12">{{ t('schematicNote') }}</text>
        <g fill="#355c78" font-size="12" font-family="system-ui, sans-serif">
          <text x="165" y="31" text-anchor="middle">bₜ = {{ dimensionLabels.topWidth }} mm</text>
          <text x="165" y="260" text-anchor="middle">bᵦ = {{ dimensionLabels.bottomWidth }} mm</text>
          <text x="386" y="26" text-anchor="end">H = {{ dimensionLabels.depth }} mm</text>
          <text :x="whole.webX + whole.webWidth + 7" y="130">t<tspan baseline-shift="sub" font-size="9">w</tspan> = {{ dimensionLabels.webThickness }} mm</text>
          <text :x="whole.topX + whole.topWidth + 6" :y="whole.y + whole.topH / 2 + 4">tₜ {{ dimensionLabels.topThickness }}</text>
          <text :x="whole.bottomX + whole.bottomWidth + 6" :y="whole.bottomY + whole.bottomH / 2 + 4">tᵦ {{ dimensionLabels.bottomThickness }}</text>
        </g>
        <g v-if="cgY !== null" stroke="#bd6442" fill="#bd6442">
          <path :d="`M42 ${cgY}H312`" stroke-dasharray="5 4" stroke-width="1.5" />
          <circle :cx="whole.webX + whole.webWidth / 2" :cy="cgY" r="4" />
          <path v-if="axisLabels.offset" :d="`M312 ${cgY}L316 ${axisLabels.cgY}`" stroke-width="1" />
          <text x="318" :y="axisLabels.cgY" font-size="12" stroke="none">{{ t('cg') }}</text>
        </g>
        <g v-if="pnaY !== null" stroke="#bd8b39" fill="#bd8b39">
          <path :d="`M42 ${pnaY}H312`" stroke-dasharray="3 4" stroke-width="1.2" />
          <path v-if="axisLabels.offset" :d="`M312 ${pnaY}L316 ${axisLabels.pnaY}`" stroke-width="1" />
          <text x="318" :y="axisLabels.pnaY" font-size="12" stroke="none">{{ t('pna') }}</text>
        </g>
        <g v-if="cgY !== null" stroke="#355c78" stroke-width="1.5" fill="none" marker-end="url(#crane-section-axis-arrow)">
          <path :d="`M${whole.webX + whole.webWidth / 2} ${cgY}V${cgY - 29}`" />
          <path :d="`M${whole.webX + whole.webWidth / 2} ${cgY}H${whole.webX + whole.webWidth / 2 + 50}`" />
        </g>
        <g v-if="cgY !== null" fill="#355c78" font-size="13" font-weight="700">
          <text :x="whole.webX + whole.webWidth / 2 + 4" :y="cgY - 33">{{ t('yAxis') }}</text>
          <text :x="whole.webX + whole.webWidth / 2 + 54" :y="cgY + 4">{{ t('xAxis') }}</text>
        </g>
      </svg>
    </figure>

    <figure class="crane-section-diagram">
      <figcaption>{{ t('effectiveTitle') }}</figcaption>
      <svg viewBox="0 0 500 300" role="img" :aria-label="t('effectiveTitle')" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <title>{{ t('effectiveTitle') }}</title>
        <rect x="1" y="1" width="498" height="298" rx="10" fill="#fcfbf7" stroke="#d8e2e9" />
        <g fill="#c7dce8" stroke="#285474" stroke-width="2">
          <rect :x="tSections.topX" :y="tSections.topY" :width="tSections.topWidth" :height="tSections.topFlangeHeight" />
          <rect :x="tSections.topWebX" :y="tSections.topY + tSections.topFlangeHeight" :width="tSections.webWidth" :height="tSections.topWebHeight" />
          <rect :x="tSections.bottomWebX" :y="tSections.bottomY" :width="tSections.webWidth" :height="tSections.bottomWebHeight" />
          <rect :x="tSections.bottomX" :y="tSections.bottomY + tSections.bottomWebHeight" :width="tSections.bottomWidth" :height="tSections.bottomFlangeHeight" />
        </g>
        <path v-if="sections" :d="`M${tSections.topX - 8} ${tSections.topCgY}H${tSections.topX + tSections.topWidth + 8} M${tSections.bottomX - 8} ${tSections.bottomCgY}H${tSections.bottomX + tSections.bottomWidth + 8}`" stroke="#bd6442" stroke-dasharray="4 3" stroke-width="1.5" fill="none" />
        <circle v-if="sections" :cx="tSections.topWebX + tSections.webWidth / 2" :cy="tSections.topCgY" r="3.5" fill="#bd6442" />
        <circle v-if="sections" :cx="tSections.bottomWebX + tSections.webWidth / 2" :cy="tSections.bottomCgY" r="3.5" fill="#bd6442" />
        <g fill="#355c78" text-anchor="middle" font-family="system-ui, sans-serif">
          <text x="129" y="26" font-size="13" font-weight="700">{{ t('topT') }}</text>
          <text x="369" y="26" font-size="13" font-weight="700">{{ t('bottomT') }}</text>
          <text x="129" y="248" font-size="12">hᵥ = {{ number(sections?.top_web_depth_mm) }} mm</text>
          <text x="369" y="248" font-size="12">hᵥ = {{ number(sections?.bottom_web_depth_mm) }} mm</text>
          <text x="129" y="269" font-size="12">y꜀ = {{ number(sections?.top_yc_from_outer_face_mm) }} mm</text>
          <text x="369" y="269" font-size="12">y꜀ = {{ number(sections?.bottom_yc_from_outer_face_mm) }} mm</text>
        </g>
      </svg>
    </figure>
  </div>
</template>

<style scoped>
.crane-section-diagrams { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.crane-section-diagram { min-width: 0; margin: 0; padding: 12px; border: 1px solid #d8e2e9; border-radius: 10px; background: #fcfbf7; }
.crane-section-diagram figcaption { min-height: 42px; color: #345670; font-size: 14px; font-weight: 700; line-height: 1.4; }
.crane-section-diagram svg, .crane-local-bearing svg { display: block; width: 100%; height: auto; }
.crane-local-bearing { max-width: 580px; padding: 10px; border: 1px solid #d8e2e9; border-radius: 10px; background: #fcfbf7; }
@media (max-width: 850px) { .crane-section-diagrams { grid-template-columns: 1fr; } }
</style>
