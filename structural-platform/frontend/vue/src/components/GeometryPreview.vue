<script setup>
import { computed } from 'vue'
import { validateGeometryDefinition } from '../geometry'

const props = defineProps({ input: { type: Object, required: true }, properties: Object, locale: String })
const words = computed(() => props.locale === 'vi'
  ? { title: 'Hình học tiết diện', centroid: 'Trọng tâm', pna: 'Trục trung hòa dẻo', origin: 'Gốc hộp bao' }
  : { title: 'Section geometry', centroid: 'Centroid', pna: 'Plastic neutral axes', origin: 'Bounding-box origin' })
// Fit a dimensionally valid section in a fixed drawing area, keeping its aspect ratio.
const drawing = computed(() => {
  if (!validateGeometryDefinition(props.input).valid) return null
  const d = props.input.dimensions
  const round = ['circle', 'circular-tube'].includes(props.input.shape)
  const width = round ? d.D : d.b
  const height = round ? d.D : d.h
  const largest = Math.max(width, height)
  const w = width / largest * 220, h = height / largest * 220
  const left = 65 + (220 - w) / 2, top = 30 + (220 - h) / 2
  let points = []
  if (props.input.shape === 'rectangle') points = [[0, 0], [w, 0], [w, h], [0, h]]
  if (props.input.shape === 'i-h') {
    const tw = d.tw / largest * 220, tf = d.tf / largest * 220
    const a = (w - tw) / 2, b = (w + tw) / 2
    points = [[0, 0], [w, 0], [w, tf], [b, tf], [b, h - tf], [w, h - tf], [w, h], [0, h], [0, h - tf], [a, h - tf], [a, tf], [0, tf]]
  }
  const cx = left + w / 2, cy = top + h / 2
  let hollowPath = null
  if (props.input.shape === 'circular-tube') {
    const outer = w / 2, inner = (d.D - 2 * d.t) / largest * 110
    const ring = r => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
    hollowPath = `${ring(outer)} ${ring(inner)}`
  }
  if (props.input.shape === 'rectangular-tube') {
    const t = d.t / largest * 220
    const box = (x, y, b, h) => `M ${x} ${y} h ${b} v ${h} h ${-b} Z`
    hollowPath = `${box(left, top, w, h)} ${box(left + t, top + t, w - 2 * t, h - 2 * t)}`
  }
  return { w, h, left, top, bottom: top + h, cx, cy, hollowPath,
    polygon: points.map(([x, y]) => `${left + x},${top + h - y}`).join(' ') }
})
</script>

<template>
  <figure v-if="drawing" class="geometry-preview">
    <svg viewBox="0 0 350 310" role="img" :aria-label="words.title">
      <circle v-if="input.shape === 'circle'" :cx="drawing.cx" :cy="drawing.cy" :r="drawing.w / 2" class="section-outline" />
      <path v-else-if="drawing.hollowPath" :d="drawing.hollowPath" fill-rule="evenodd" class="section-outline hollow-section" />
      <polygon v-else :points="drawing.polygon" class="section-outline" />
      <g v-if="properties" class="neutral-axes">
        <line :x1="drawing.left - 12" :y1="drawing.cy" :x2="drawing.left + drawing.w + 12" :y2="drawing.cy" />
        <line :x1="drawing.cx" :y1="drawing.top - 12" :x2="drawing.cx" :y2="drawing.bottom + 12" />
      </g>
      <g class="coordinate-axes">
        <path :d="`M ${drawing.left} ${drawing.bottom} h 40 m -5 -3 l 5 3 l -5 3`" />
        <path :d="`M ${drawing.left} ${drawing.bottom} v -40 m -3 5 l 3 -5 l 3 5`" />
        <text :x="drawing.left + 44" :y="drawing.bottom + 5">+x</text>
        <text :x="drawing.left - 10" :y="drawing.bottom - 46">+y</text>
        <text :x="drawing.left - 13" :y="drawing.bottom + 17">O</text>
      </g>
      <circle v-if="properties" :cx="drawing.cx" :cy="drawing.cy" r="4" class="centroid-point" />
    </svg>
    <figcaption>{{ words.title }} · {{ words.origin }} O<span v-if="properties"> · <span class="centroid-key">●</span> {{ words.centroid }} · <span class="pna-key">┄</span> {{ words.pna }}</span></figcaption>
  </figure>
</template>

<style scoped>
.geometry-preview { margin: 0; padding: 10px; border: 1px solid var(--surface-border); border-radius: 8px; text-align: center; }
.geometry-preview svg { display: block; width: min(100%, 350px); margin: auto; }
.section-outline { fill: #b3c5d7; stroke: #23395d; stroke-width: 1.5; }
.coordinate-axes { fill: #23395d; stroke: #23395d; stroke-width: 1.3; }
.coordinate-axes text { stroke: none; font-size: 16px; }
.neutral-axes { stroke: #a44c14; stroke-width: 1.3; stroke-dasharray: 5 4; }
.centroid-point { fill: #a44c14; }
figcaption { font-size: 15px; color: var(--muted-ink); line-height: 1.6; }
.centroid-key, .pna-key { color: #a44c14; }
</style>
