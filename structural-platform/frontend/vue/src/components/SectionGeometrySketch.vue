<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  shape: { type: String, default: '' },
  dimensions: { type: Object, default: () => ({}) },
  locale: { type: String, default: 'en' },
})

const markerId = `section-dimension-arrow-${useId().replaceAll(':', '')}`
const labels = {
  vi: { title: 'Sơ đồ tiết diện', schematic: 'Sơ đồ minh họa; không theo tỷ lệ khi thiếu kích thước hoặc tỷ lệ không hợp lệ.', diameter: 'Đường kính' },
  en: { title: 'Section sketch', schematic: 'Schematic; not to scale when dimensions are missing or proportions are invalid.', diameter: 'Diameter' },
}
const t = (key) => labels[props.locale]?.[key] ?? labels.en[key]

function positive(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function dimensionText(symbol, value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0
    ? `${symbol} = ${new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 5 }).format(parsed)} mm`
    : symbol
}

function featureText(symbol, value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0
    ? `${symbol} ${new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 4 }).format(parsed)}`
    : symbol
}

const drawing = computed(() => {
  const d = props.dimensions ?? {}
  const shape = props.shape
  const diameter = positive(d.diameter, 160)
  const legacyWidth = positive(d.width, 160)
  const topFlangeWidth = positive(d.top_flange_width, legacyWidth)
  const bottomFlangeWidth = positive(d.bottom_flange_width, legacyWidth)
  const width = shape === 'circle' || shape === 'circular_hollow' ? diameter : shape === 'i' ? Math.max(topFlangeWidth, bottomFlangeWidth) : legacyWidth
  const height = shape === 'circle' || shape === 'circular_hollow' ? diameter : positive(d.depth, 300)
  const rawTw = positive(d.web_thickness, 12)
  const rawTf = positive(d.flange_thickness, positive(d.top_flange_thickness, 14))
  const rawTopTf = positive(d.top_flange_thickness, rawTf)
  const rawBottomTf = positive(d.bottom_flange_thickness, rawTf)
  const rawThickness = positive(d.thickness, 12)
  const tw = Math.min(rawTw, width * 0.42)
  const tf = Math.min(rawTf, height * 0.35)
  const topTf = Math.min(rawTopTf, height * 0.35)
  const bottomTf = Math.min(rawBottomTf, height * 0.35)
  const thickness = Math.min(rawThickness, width * 0.4, height * 0.4)
  const scale = Math.min(138 / width, 126 / height)
  const drawWidth = width * scale
  const drawHeight = height * scale
  const left = 112 + (138 - drawWidth) / 2
  const top = 23 + (128 - drawHeight) / 2
  const x = (value) => left + value * scale
  const y = (value) => top + (height - value) * scale
  const center = width / 2
  const pointsPath = (points) => `M ${points.map(([px, py]) => `${x(px)} ${y(py)}`).join(' L ')} Z`
  let outline = ''
  let inner = null
  let circle = null
  let innerCircle = null
  let webLabel = null
  let flangeLabel = null
  let bottomFlangeLabel = null
  let thicknessLabel = null
  const hasAsymmetricFlangeDimensions = ['top_flange_width', 'bottom_flange_width', 'top_flange_thickness', 'bottom_flange_thickness'].some((key) => Number.isFinite(Number(d[key])) && Number(d[key]) > 0)
  const requiredDimensions = shape === 'circle' ? ['diameter']
    : shape === 'circular_hollow' ? ['diameter', 'thickness']
      : shape === 'i' && hasAsymmetricFlangeDimensions ? ['depth', 'web_thickness', 'top_flange_width', 'bottom_flange_width', 'top_flange_thickness', 'bottom_flange_thickness']
        : ['i', 'channel', 'tee'].includes(shape) ? ['depth', 'width', 'web_thickness', 'flange_thickness']
        : ['angle', 'rectangular_hollow'].includes(shape) ? ['depth', 'width', 'thickness']
          : shape === 'rectangle' ? ['depth', 'width'] : []
  const allDimensionsPresent = requiredDimensions.length > 0 && requiredDimensions.every((key) => Number.isFinite(Number(d[key])) && Number(d[key]) > 0)
  const proportionsValid = shape === 'circle' || shape === 'rectangle'
    ? true
    : shape === 'circular_hollow' ? rawThickness * 2 < diameter
      : shape === 'rectangular_hollow' ? rawThickness * 2 < Math.min(width, height)
        : shape === 'angle' ? rawThickness < Math.min(width, height)
      : shape === 'i' ? rawTw <= Math.min(topFlangeWidth, bottomFlangeWidth) && rawTopTf + rawBottomTf < height
        : shape === 'channel' ? rawTw < width && rawTf * 2 < height
            : shape === 'tee' ? rawTw < width && rawTf < height : false
  const thicknessWasClamped = (['i', 'channel', 'tee'].includes(shape) && (rawTw > width * 0.42 || rawTf > height * 0.35 || rawTopTf > height * 0.35 || rawBottomTf > height * 0.35))
    || (['angle', 'rectangular_hollow', 'circular_hollow'].includes(shape) && rawThickness > Math.min(width * 0.4, height * 0.4))

  if (shape === 'circle') {
    circle = { cx: x(center), cy: y(height / 2), r: drawWidth / 2 }
  } else if (shape === 'circular_hollow') {
    circle = { cx: x(center), cy: y(height / 2), r: drawWidth / 2 }
    const innerDiameter = Math.max(diameter - 2 * thickness, diameter * 0.1)
    innerCircle = { cx: x(center), cy: y(height / 2), r: (innerDiameter / diameter) * drawWidth / 2 }
    thicknessLabel = featureText('t', d.thickness)
  } else if (shape === 'rectangle') {
    outline = `M ${x(0)} ${y(0)} H ${x(width)} V ${y(height)} H ${x(0)} Z`
  } else if (shape === 'rectangular_hollow') {
    outline = `M ${x(0)} ${y(0)} H ${x(width)} V ${y(height)} H ${x(0)} Z`
    inner = { x: x(thickness), y: y(height - thickness), width: drawWidth - 2 * thickness * scale, height: drawHeight - 2 * thickness * scale }
    thicknessLabel = featureText('t', d.thickness)
  } else if (shape === 'i') {
    const topWidth = topFlangeWidth
    const bottomWidth = bottomFlangeWidth
    const centerX = center
    outline = pointsPath([
      [centerX - bottomWidth / 2, 0], [centerX + bottomWidth / 2, 0], [centerX + bottomWidth / 2, bottomTf],
      [centerX + tw / 2, bottomTf], [centerX + tw / 2, height - topTf], [centerX + topWidth / 2, height - topTf],
      [centerX + topWidth / 2, height], [centerX - topWidth / 2, height], [centerX - topWidth / 2, height - topTf],
      [centerX - tw / 2, height - topTf], [centerX - tw / 2, bottomTf], [centerX - bottomWidth / 2, bottomTf],
    ])
    webLabel = featureText('tw', d.web_thickness)
    if (Math.abs(rawTopTf - rawBottomTf) < 1e-9) flangeLabel = featureText('tf', d.flange_thickness ?? d.top_flange_thickness)
    else {
      flangeLabel = featureText('tft', d.top_flange_thickness)
      bottomFlangeLabel = featureText('tfb', d.bottom_flange_thickness)
    }
  } else if (shape === 'channel') {
    outline = pointsPath([[0, 0], [width, 0], [width, tf], [tw, tf], [tw, height - tf], [width, height - tf], [width, height], [0, height]])
    webLabel = featureText('tw', d.web_thickness)
    flangeLabel = featureText('tf', d.flange_thickness)
  } else if (shape === 'tee') {
    const centerX = width / 2
    outline = pointsPath([[0, height], [width, height], [width, height - tf], [centerX + tw / 2, height - tf], [centerX + tw / 2, 0], [centerX - tw / 2, 0], [centerX - tw / 2, height - tf], [0, height - tf]])
    webLabel = featureText('tw', d.web_thickness)
    flangeLabel = featureText('tf', d.flange_thickness)
  } else if (shape === 'angle') {
    outline = pointsPath([[0, 0], [width, 0], [width, thickness], [thickness, thickness], [thickness, height], [0, height]])
    thicknessLabel = featureText('t', d.thickness)
  } else {
    outline = `M ${x(0)} ${y(0)} H ${x(width)} V ${y(height)} H ${x(0)} Z`
  }

  const isCircular = shape === 'circle' || shape === 'circular_hollow'
  return {
    left, top, right: left + drawWidth, bottom: top + drawHeight,
    centerX: left + drawWidth / 2, centerY: top + drawHeight / 2,
    outline, inner, circle, innerCircle, webLabel, flangeLabel, bottomFlangeLabel, thicknessLabel,
    horizontalLabel: dimensionText(isCircular ? 'D' : 'b', isCircular ? d.diameter : width),
    verticalLabel: dimensionText(isCircular ? 'D' : 'h', isCircular ? d.diameter : d.depth),
    hasDimensions: allDimensionsPresent && proportionsValid && !thicknessWasClamped,
  }
})
</script>

<template>
  <div class="section-geometry-sketch">
    <svg viewBox="0 0 360 220" role="img" :aria-label="t('title')">
      <title>{{ t('title') }}</title>
      <defs>
        <marker :id="markerId" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse">
          <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#6b86a0" />
        </marker>
      </defs>
      <path v-if="drawing.outline" :d="drawing.outline" class="section-geometry-outline" />
      <rect v-if="drawing.inner" v-bind="drawing.inner" class="section-geometry-hole" />
      <circle v-if="drawing.circle" v-bind="drawing.circle" class="section-geometry-outline" />
      <circle v-if="drawing.innerCircle" v-bind="drawing.innerCircle" class="section-geometry-hole" />

      <text v-if="drawing.webLabel" :x="drawing.centerX + 5" :y="drawing.centerY + 3" class="section-geometry-feature-label">{{ drawing.webLabel }}</text>
      <text v-if="drawing.flangeLabel" :x="drawing.right + 6" :y="drawing.top + 15" class="section-geometry-feature-label">{{ drawing.flangeLabel }}</text>
      <text v-if="drawing.bottomFlangeLabel" :x="drawing.right + 6" :y="drawing.bottom - 7" class="section-geometry-feature-label">{{ drawing.bottomFlangeLabel }}</text>
      <text v-if="drawing.thicknessLabel" :x="drawing.centerX + 7" :y="drawing.centerY + 3" class="section-geometry-feature-label">{{ drawing.thicknessLabel }}</text>

      <line x1="83" :x2="drawing.left" :y1="drawing.top" :y2="drawing.top" class="section-geometry-extension" />
      <line x1="83" :x2="drawing.left" :y1="drawing.bottom" :y2="drawing.bottom" class="section-geometry-extension" />
      <line x1="83" x2="83" :y1="drawing.top" :y2="drawing.bottom" class="section-geometry-dimension" :marker-start="`url(#${markerId})`" :marker-end="`url(#${markerId})`" />
      <text x="65" :y="drawing.centerY" class="section-geometry-dimension-label section-geometry-vertical-label">{{ drawing.verticalLabel }}</text>
      <line :x1="drawing.left" :x2="drawing.left" :y1="drawing.bottom" y2="177" class="section-geometry-extension" />
      <line :x1="drawing.right" :x2="drawing.right" :y1="drawing.bottom" y2="177" class="section-geometry-extension" />
      <line :x1="drawing.left" :x2="drawing.right" y1="177" y2="177" class="section-geometry-dimension" :marker-start="`url(#${markerId})`" :marker-end="`url(#${markerId})`" />
      <text :x="drawing.centerX" y="194" class="section-geometry-dimension-label section-geometry-horizontal-label">{{ drawing.horizontalLabel }}</text>

      <line x1="296" y1="160" x2="326" y2="160" class="section-geometry-axis" />
      <line x1="296" y1="160" x2="296" y2="132" class="section-geometry-axis" />
      <text x="332" y="163" class="section-geometry-axis-label">X</text>
      <text x="293" y="126" class="section-geometry-axis-label">Y</text>
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
.section-geometry-feature-label { fill: #52718e; font-size: 12px; font-weight: 700; }
.section-geometry-axis { stroke: #65809a; stroke-width: 1.1; }
.section-geometry-axis-label { fill: #65809a; font-size: 13px; font-weight: 700; }
.section-geometry-sketch-note { margin: 0; color: #8495a5; font-size: 13px; line-height: 1.5; }
</style>
