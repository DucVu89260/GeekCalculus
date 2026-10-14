<script setup>
import { computed, useId } from 'vue'
import { resolveSectionProfile, sectionProfileDimensions, SECTION_REGISTRY } from '../sectional-properties/catalog.js'

const props = defineProps({
  profileId: { type: String, default: '' },
  shape: { type: String, default: '' },
  dimensions: { type: Object, default: () => ({}) },
  locale: { type: String, default: 'en' },
})
const markerId = `section-dimension-arrow-${useId().replaceAll(':', '')}`
const labels = {
  vi: { title: 'Sơ đồ tiết diện', schematic: 'Sơ đồ minh họa; không theo tỷ lệ khi thiếu kích thước.', width: 'Bề rộng', height: 'Chiều cao', diameter: 'Đường kính' },
  en: { title: 'Section sketch', schematic: 'Schematic; not to scale when dimensions are missing.', width: 'Width', height: 'Height', diameter: 'Diameter' },
}
const t = (key) => labels[props.locale]?.[key] ?? labels.en[key]

function numeric(value, fallback, allowZero = false) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0) ? parsed : fallback
}
function valueLabel(symbol, value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
    ? `${symbol} = ${new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 4 }).format(parsed)} mm`
    : symbol
}

const profile = computed(() => resolveSectionProfile(props.profileId || props.shape, props.dimensions))
const values = computed(() => sectionProfileDimensions(profile.value, props.dimensions))
const suppliedValues = computed(() => sectionProfileDimensions(profile.value, props.dimensions, { includeDefaults: false }))
const drawing = computed(() => {
  const p = profile.value
  const d = values.value
  if (!p) return { hasDimensions: false, outline: '', circles: [], holes: [], labels: [] }
  const v = (key, fallback = 1) => numeric(d[key], fallback)
  const width = p.id === 'circle' || p.id === 'chs'
    ? v('diameter')
    : p.id === 'double_angle' ? 2 * v('width') + numeric(d.distance, 0, true)
      : p.id === 'symmetric_i' ? v('width')
        : p.id === 'asymmetric_i' ? Math.max(v('top_flange_width'), v('bottom_flange_width'))
          : v('width')
  const height = p.id === 'circle' || p.id === 'chs' ? v('diameter') : v(p.id === 'rectangle' || p.id === 'shs_rhs' ? 'height' : 'depth')
  const scale = Math.min(140 / Math.max(width, Number.EPSILON), 124 / Math.max(height, Number.EPSILON))
  const drawWidth = width * scale, drawHeight = height * scale
  const left = 112 + (140 - drawWidth) / 2
  const top = 20 + (124 - drawHeight) / 2
  const x = (position) => left + position * scale
  const y = (position) => top + (height - position) * scale
  const path = (points) => `M ${points.map(([px, py]) => `${x(px)} ${y(py)}`).join(' L ')} Z`
  let outline = ''
  const circles = []
  const holes = []
  const featureLabels = []
  const b = v('width', width), h = height
  const tw = v('web_thickness'), tf = v('flange_thickness'), t = v('thickness')
  const hasDimensions = p.dimensions.every((key) => {
    const raw = Number(suppliedValues.value[key]), def = SECTION_REGISTRY.dimensions[key]
    return Number.isFinite(raw) && (def?.allow_zero ? raw >= (def.minimum ?? 0) : raw >= (def.minimum ?? 0))
  })

  if (p.id === 'circle' || p.id === 'chs') {
    circles.push({ cx: x(width / 2), cy: y(height / 2), r: drawWidth / 2 })
    if (p.id === 'chs') {
      const innerDiameter = Math.max(0, width - 2 * numeric(d.thickness, 0))
      holes.push({ cx: x(width / 2), cy: y(height / 2), r: innerDiameter / 2 * scale })
      featureLabels.push({ text: valueLabel('t', d.thickness), x: x(width / 2) + 6, y: y(height / 2) + 4 })
    }
  } else if (p.id === 'rectangle') {
    outline = path([[0, 0], [b, 0], [b, h], [0, h]])
  } else if (p.id === 'shs_rhs') {
    outline = path([[0, 0], [b, 0], [b, h], [0, h]])
    const innerWidth = Math.max(0, b - 2 * t), innerHeight = Math.max(0, h - 2 * t)
    holes.push({ x: x(t), y: y(h - t), width: innerWidth * scale, height: innerHeight * scale })
    featureLabels.push({ text: valueLabel('t', d.thickness), x: x(b / 2) + 6, y: y(h / 2) + 4 })
  } else if (p.id === 'symmetric_i' || p.id === 'asymmetric_i') {
    const topWidth = p.id === 'symmetric_i' ? b : v('top_flange_width', b)
    const bottomWidth = p.id === 'symmetric_i' ? b : v('bottom_flange_width', b)
    const topThickness = p.id === 'symmetric_i' ? tf : v('top_flange_thickness')
    const bottomThickness = p.id === 'symmetric_i' ? tf : v('bottom_flange_thickness')
    const centerX = width / 2
    const topLeft = centerX - topWidth / 2, bottomLeft = centerX - bottomWidth / 2
    outline = path([
      [bottomLeft, 0], [bottomLeft + bottomWidth, 0], [bottomLeft + bottomWidth, bottomThickness],
      [centerX + tw / 2, bottomThickness], [centerX + tw / 2, h - topThickness],
      [topLeft + topWidth, h - topThickness], [topLeft + topWidth, h], [topLeft, h],
      [topLeft, h - topThickness], [centerX - tw / 2, h - topThickness],
      [centerX - tw / 2, bottomThickness], [bottomLeft, bottomThickness],
    ])
    featureLabels.push({ text: valueLabel('tw', d.web_thickness), x: x(centerX) + 6, y: y(h / 2) })
    featureLabels.push({ text: valueLabel('tf', p.id === 'symmetric_i' ? d.flange_thickness : d.top_flange_thickness), x: x(centerX + topWidth / 2) + 5, y: y(h - topThickness / 2) })
    if (p.id === 'asymmetric_i') featureLabels.push({ text: valueLabel('tb', d.bottom_flange_thickness), x: x(centerX + bottomWidth / 2) + 5, y: y(bottomThickness / 2) })
  } else if (p.id === 'channel') {
    outline = path([[0, 0], [b, 0], [b, tf], [tw, tf], [tw, h - tf], [b, h - tf], [b, h], [0, h]])
    featureLabels.push({ text: valueLabel('tw', d.web_thickness), x: x(tw / 2) + 5, y: y(h / 2) })
    featureLabels.push({ text: valueLabel('tf', d.flange_thickness), x: x(b) + 5, y: y(h - tf / 2) })
  } else if (p.id === 'tee') {
    const center = b / 2
    outline = path([[0, h], [b, h], [b, h - tf], [center + tw / 2, h - tf], [center + tw / 2, 0], [center - tw / 2, 0], [center - tw / 2, h - tf], [0, h - tf]])
    featureLabels.push({ text: valueLabel('tw', d.web_thickness), x: x(center) + 5, y: y(h / 2) })
    featureLabels.push({ text: valueLabel('tf', d.flange_thickness), x: x(b) + 5, y: y(h - tf / 2) })
  } else if (p.id === 'angle') {
    outline = path([[0, 0], [b, 0], [b, t], [t, t], [t, h], [0, h]])
    featureLabels.push({ text: valueLabel('t', d.thickness), x: x(t) + 5, y: y(t) - 4 })
  } else if (p.id === 'double_angle') {
    const gap = numeric(d.distance, 0, true), legWidth = b, bottomLeft = [[0, 0], [legWidth, 0], [legWidth, h], [legWidth - t, h], [legWidth - t, t], [0, t]]
    const rightStart = legWidth + gap
    const bottomRight = [[rightStart, 0], [rightStart + legWidth, 0], [rightStart + legWidth, t], [rightStart + t, t], [rightStart + t, h], [rightStart, h]]
    outline = `${path(bottomLeft)} ${path(bottomRight)}`
    featureLabels.push({ text: valueLabel('t', d.thickness), x: x(legWidth - t / 2) + 5, y: y(t / 2) })
    featureLabels.push({ text: valueLabel('g', d.distance), x: x(legWidth + gap / 2) - 3, y: y(h / 2) })
  }

  const circular = p.id === 'circle' || p.id === 'chs'
  const horizontalKey = circular ? 'diameter' : 'width'
  const verticalKey = circular ? 'diameter' : (p.id === 'rectangle' || p.id === 'shs_rhs' ? 'height' : 'depth')
  const horizontalSymbol = circular ? 'D' : p.id === 'double_angle' ? '2b + g' : p.id === 'angle' ? 'b' : 'b'
  const horizontalValue = p.id === 'double_angle' ? width : circular ? d.diameter : p.id === 'symmetric_i' ? d.width : p.id === 'asymmetric_i' ? width : d[horizontalKey]

  return {
    left, top, right: left + drawWidth, bottom: top + drawHeight, centerX: left + drawWidth / 2, centerY: top + drawHeight / 2,
    outline, circles, holes, featureLabels, hasDimensions,
    horizontalLabel: valueLabel(horizontalSymbol, horizontalValue),
    verticalLabel: valueLabel(circular ? 'D' : 'h', d[verticalKey]),
  }
})
</script>

<template>
  <div class="section-geometry-sketch">
    <svg viewBox="0 0 360 220" role="img" :aria-label="t('title')">
      <title>{{ t('title') }}</title>
      <defs><marker :id="markerId" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M 0 0 L 7 3.5 L 0 7 z" fill="#6b86a0" /></marker></defs>
      <path v-if="drawing.outline" :d="drawing.outline" class="section-geometry-outline" fill-rule="evenodd" />
      <circle v-for="(circle, index) in drawing.circles" :key="`circle-${index}`" v-bind="circle" class="section-geometry-outline" />
      <template v-for="(hole, index) in drawing.holes" :key="`hole-${index}`">
        <rect v-if="'width' in hole" v-bind="hole" class="section-geometry-hole" />
        <circle v-else v-bind="hole" class="section-geometry-hole" />
      </template>
      <text v-for="(label, index) in drawing.featureLabels" :key="`feature-${index}`" :x="label.x" :y="label.y" class="section-geometry-feature-label">{{ label.text }}</text>
      <line x1="83" :x2="drawing.left" :y1="drawing.top" :y2="drawing.top" class="section-geometry-extension" />
      <line x1="83" :x2="drawing.left" :y1="drawing.bottom" :y2="drawing.bottom" class="section-geometry-extension" />
      <line x1="83" x2="83" :y1="drawing.top" :y2="drawing.bottom" class="section-geometry-dimension" :marker-start="`url(#${markerId})`" :marker-end="`url(#${markerId})`" />
      <text x="65" :y="drawing.centerY" class="section-geometry-dimension-label section-geometry-vertical-label">{{ drawing.verticalLabel }}</text>
      <line :x1="drawing.left" :x2="drawing.left" :y1="drawing.bottom" y2="177" class="section-geometry-extension" />
      <line :x1="drawing.right" :x2="drawing.right" :y1="drawing.bottom" y2="177" class="section-geometry-extension" />
      <line :x1="drawing.left" :x2="drawing.right" y1="177" y2="177" class="section-geometry-dimension" :marker-start="`url(#${markerId})`" :marker-end="`url(#${markerId})`" />
      <text :x="drawing.centerX" y="194" class="section-geometry-dimension-label section-geometry-horizontal-label">{{ drawing.horizontalLabel }}</text>
      <line x1="296" y1="160" x2="326" y2="160" class="section-geometry-axis" /><line x1="296" y1="160" x2="296" y2="132" class="section-geometry-axis" />
      <text x="332" y="163" class="section-geometry-axis-label">X</text><text x="293" y="126" class="section-geometry-axis-label">Y</text>
    </svg>
    <p v-if="!drawing.hasDimensions" class="section-geometry-sketch-note">{{ t('schematic') }}</p>
  </div>
</template>

<style scoped>
.section-geometry-sketch { min-width: 0; }
.section-geometry-sketch svg { display: block; width: 100%; min-height: 180px; max-height: 220px; }
.section-geometry-outline { fill: #dce9f4; stroke: #375f83; stroke-width: 1.6; }
.section-geometry-hole { fill: var(--soft-bg); stroke: #375f83; stroke-width: 1.2; }
.section-geometry-dimension { stroke: #6b86a0; stroke-width: 1; }
.section-geometry-extension { stroke: #b4c3d0; stroke-width: .8; stroke-dasharray: 2 2; }
.section-geometry-dimension-label { fill: #536f89; font-size: 13px; font-weight: 650; }
.section-geometry-horizontal-label { text-anchor: middle; }
.section-geometry-vertical-label { text-anchor: middle; dominant-baseline: middle; transform: rotate(-90deg); transform-box: fill-box; transform-origin: center; }
.section-geometry-feature-label { fill: #52718e; font-size: 10px; font-weight: 700; }
.section-geometry-axis { stroke: #65809a; stroke-width: 1.1; }.section-geometry-axis-label { fill: #65809a; font-size: 13px; font-weight: 700; }
.section-geometry-sketch-note { margin: 0; color: #8495a5; font-size: 13px; line-height: 1.5; }
</style>
