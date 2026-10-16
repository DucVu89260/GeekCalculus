<script setup>
import { computed } from 'vue'
import { renderStandardMath } from '../standards-math.js'
import 'katex/dist/katex.min.css'

const props = defineProps({ equation: { type: Object, required: true }, locale: { type: String, default: 'en' }, canNavigate: Boolean, canEdit: Boolean, printedPage: { type: [Number, String], default: null } })
const emit = defineEmits(['source', 'review'])
const words = computed(() => props.locale === 'vi' ? {
  source: 'Mở nguồn', pdf: 'PDF p.', printed: 'Trang in', noExpression: 'Chưa có biểu thức toán học được nhập.',
  renderError: 'Không thể hiển thị biểu thức đã trích xuất.', variables: 'Định nghĩa biến', conditions: 'Điều kiện áp dụng',
  methods: 'Phương pháp thiết kế', factors: 'Tham số ASD/LRFD', dependencies: 'Điều khoản liên quan', extraction: 'Phương pháp trích xuất',
  anchor: 'Mốc nguồn', implementation: 'Khóa triển khai', approved: 'Đã xác minh để sử dụng',
  review: 'Chưa được xác minh · không dùng cho tính toán', sourceMissing: 'Chưa ánh xạ trang nguồn',
} : {
  source: 'Open source', pdf: 'PDF p.', printed: 'Printed page', noExpression: 'No mathematical expression has been transcribed.',
  renderError: 'The extracted expression could not be rendered.', variables: 'Variable definitions', conditions: 'Application conditions',
  methods: 'Design methods', factors: 'ASD/LRFD parameters', dependencies: 'Related provisions', extraction: 'Extraction method',
  anchor: 'Source anchor', implementation: 'Implementation key', approved: 'Verified for use',
  review: 'Unverified · do not use for calculation', sourceMissing: 'Source page not mapped',
})

function parseValue(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return Object.entries(value).map(([symbol, definition]) => ({ symbol, definition }))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed !== value) return parseValue(parsed)
    } catch { /* legacy plain text remains visible */ }
    return [value]
  }
  return [String(value)]
}

function asText(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ')
  return Object.entries(value).map(([key, entry]) => `${key}: ${asText(entry)}`).join(' · ')
}

function variableRow(value, index) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const symbol = value.symbol ?? value.variable ?? value.name ?? value.key ?? `x${index + 1}`
    const definition = value.definition ?? value.description ?? value.meaning ?? value.label ?? ''
    const unit = value.unit ?? value.units
    const dimensions = value.dimensions ?? value.dimension
    return { key: `${symbol}-${index}`, symbol: asText(symbol), definition: asText(definition), unit: asText(unit), dimensions: asText(dimensions) }
  }
  return { key: `${index}-${asText(value)}`, symbol: '', definition: asText(value), unit: '', dimensions: '' }
}

const approved = computed(() => ['verified', 'published'].includes(String(props.equation.verification_status || '').toLowerCase()))
const verificationLabel = computed(() => {
  const status = String(props.equation.verification_status || 'unknown').toLowerCase()
  const labels = props.locale === 'vi'
    ? { verified: 'Đã xác minh', published: 'Đã phát hành', candidate: 'Ứng viên', needs_review: 'Cần rà soát', deprecated: 'Đã thay thế', unknown: 'Chưa rõ trạng thái' }
    : { verified: 'Verified', published: 'Published', candidate: 'Candidate', needs_review: 'Needs review', deprecated: 'Deprecated', unknown: 'Unknown status' }
  return labels[status] || status.replaceAll('_', ' ')
})
const variables = computed(() => parseValue(props.equation.variables).map(variableRow))
const conditions = computed(() => parseValue(props.equation.conditions).map(asText).filter(Boolean))
const designMethods = computed(() => {
  const methods = parseValue(props.equation.design_methods ?? props.equation.methods ?? props.equation.design_method).map(asText).filter(Boolean)
  return methods.flatMap(method => method.toLowerCase() === 'both' ? ['ASD', 'LRFD'] : [method])
})
const factors = computed(() => parseValue(props.equation.design_parameters ?? props.equation.resistance_factors ?? props.equation.asd_lrfd_factors ?? props.equation.factors).map(asText).filter(Boolean))
const dependencies = computed(() => parseValue(props.equation.dependencies ?? props.equation.cross_references).map(asText).filter(Boolean))
const latex = computed(() => typeof props.equation.latex === 'string' ? props.equation.latex.trim() : '')
const math = computed(() => renderStandardMath(latex.value))
const mathHtml = computed(() => math.value.html)
const rendered = computed(() => math.value.usable)
const physicalPage = computed(() => props.equation.pdf_page)
const printedPage = computed(() => props.printedPage ?? props.equation.printed_page_label ?? props.equation.printed_page)
</script>

<template>
  <article class="std-equation" :class="{ 'std-equation-approved': approved }" :data-verification-status="equation.verification_status || 'unknown'">
    <header class="std-equation-head">
      <button type="button" class="std-equation-source" :aria-label="`${words.source} ${equation.label || ''}`" :disabled="!canNavigate || !physicalPage" @click="emit('source', equation)">
        <strong class="std-equation-label">{{ equation.label || 'Equation' }}</strong>
        <span v-if="physicalPage">{{ words.pdf }} {{ physicalPage }}<template v-if="printedPage"> · {{ words.printed }} {{ printedPage }}</template></span>
        <span v-else>{{ words.sourceMissing }}</span>
      </button>
      <span class="std-verification" :class="approved ? 'is-approved' : 'needs-review'"><strong>{{ verificationLabel }}</strong><span> · {{ approved ? words.approved : words.review }}</span></span>
    </header>

    <p class="std-equation-provenance">{{ equation.clause_code }}<span v-if="equation.extraction_confidence != null"> · {{ locale === 'vi' ? 'Độ tin cậy trích xuất' : 'Extraction confidence' }} {{ Math.round(equation.extraction_confidence * 100) }}%</span></p>
    <button v-if="canEdit && Number.isInteger(equation.id)" type="button" @click="emit('review', equation)">{{ locale === 'vi' ? 'Biên tập / Duyệt nguồn' : 'Edit / Review source' }}</button>
    <div v-if="rendered" class="std-equation-math" v-html="mathHtml"></div>
    <p v-else-if="latex" class="std-equation-unrendered" role="note">{{ words.renderError }} <code>{{ latex }}</code></p>
    <p v-else class="std-equation-unrendered" role="note">{{ words.noExpression }}</p>

    <dl v-if="variables.length" class="std-equation-details">
      <div class="std-equation-detail-group">
        <dt>{{ words.variables }}</dt>
        <dd><ul><li v-for="variable in variables" :key="variable.key"><strong v-if="variable.symbol" class="std-variable-symbol">{{ variable.symbol }}</strong><span>{{ variable.definition }}</span><span v-if="variable.unit" class="std-variable-unit">{{ variable.unit }}</span><span v-if="variable.dimensions" class="std-variable-unit">({{ variable.dimensions }})</span></li></ul></dd>
      </div>
      <div v-if="conditions.length" class="std-equation-detail-group"><dt>{{ words.conditions }}</dt><dd><ul><li v-for="condition in conditions" :key="condition">{{ condition }}</li></ul></dd></div>
      <div v-if="designMethods.length" class="std-equation-detail-group"><dt>{{ words.methods }}</dt><dd>{{ designMethods.join(' · ') }}</dd></div>
      <div v-if="factors.length" class="std-equation-detail-group"><dt>{{ words.factors }}</dt><dd>{{ factors.join(' · ') }}</dd></div>
      <div v-if="dependencies.length" class="std-equation-detail-group"><dt>{{ words.dependencies }}</dt><dd>{{ dependencies.join(' · ') }}</dd></div>
      <div v-if="equation.source_anchor" class="std-equation-detail-group"><dt>{{ words.anchor }}</dt><dd>{{ equation.source_anchor }}</dd></div>
      <div v-if="equation.extraction_method" class="std-equation-detail-group"><dt>{{ words.extraction }}</dt><dd>{{ equation.extraction_method }}</dd></div>
      <div v-if="equation.implementation_key" class="std-equation-detail-group"><dt>{{ words.implementation }}</dt><dd><code>{{ equation.implementation_key }}</code></dd></div>
    </dl>
    <dl v-else-if="conditions.length || designMethods.length || factors.length || dependencies.length || equation.source_anchor || equation.extraction_method || equation.implementation_key" class="std-equation-details">
      <div v-if="conditions.length" class="std-equation-detail-group"><dt>{{ words.conditions }}</dt><dd><ul><li v-for="condition in conditions" :key="condition">{{ condition }}</li></ul></dd></div>
      <div v-if="designMethods.length" class="std-equation-detail-group"><dt>{{ words.methods }}</dt><dd>{{ designMethods.join(' · ') }}</dd></div>
      <div v-if="factors.length" class="std-equation-detail-group"><dt>{{ words.factors }}</dt><dd>{{ factors.join(' · ') }}</dd></div>
      <div v-if="dependencies.length" class="std-equation-detail-group"><dt>{{ words.dependencies }}</dt><dd>{{ dependencies.join(' · ') }}</dd></div>
      <div v-if="equation.source_anchor" class="std-equation-detail-group"><dt>{{ words.anchor }}</dt><dd>{{ equation.source_anchor }}</dd></div>
      <div v-if="equation.extraction_method" class="std-equation-detail-group"><dt>{{ words.extraction }}</dt><dd>{{ equation.extraction_method }}</dd></div>
      <div v-if="equation.implementation_key" class="std-equation-detail-group"><dt>{{ words.implementation }}</dt><dd><code>{{ equation.implementation_key }}</code></dd></div>
    </dl>
  </article>
</template>

<style scoped>
.std-equation{min-width:0;margin:0 0 9px;padding:10px 12px;border:1px solid #e4dac7;border-radius:7px;background:#fffaf0;box-shadow:0 1px 2px #1f344f0d}.std-equation-approved{border-left:4px solid #60846a}.std-equation-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.std-equation-source{display:grid;justify-items:start;gap:2px;border:0;background:transparent;color:#193c67;text-align:left;cursor:pointer}.std-equation-source:disabled{cursor:default;opacity:.65}.std-equation-source span{font-size:12px;color:#687890}.std-equation-label{font-size:15px;font-weight:800}.std-verification{display:inline-block;max-width:50%;padding:4px 8px;border-radius:20px;font-size:11px;line-height:1.35;text-align:center}.std-verification.is-approved{background:#e8f2e9;color:#365d3f}.std-verification.needs-review{background:#fff0df;color:#85541d}.std-equation-math{max-width:100%;padding:8px 0;overflow-x:auto;color:#222}.std-equation-math :deep(.katex-display){margin:.3em 0;text-align:left}.std-equation-unrendered{margin:6px 0;padding:8px;background:#fff3e8;color:#79522e;overflow-wrap:anywhere}.std-equation-details{display:grid;gap:7px;margin:7px 0 0;padding-top:7px;border-top:1px solid #eee3d2}.std-equation-detail-group{display:grid;grid-template-columns:minmax(115px, .55fr) minmax(0,2fr);gap:8px;margin:0}.std-equation-detail-group dt{font-size:12px;font-weight:700;color:#506680}.std-equation-detail-group dd{min-width:0;margin:0;font-size:13px;color:#394a5e;overflow-wrap:anywhere}.std-equation-detail-group ul{display:grid;gap:4px;margin:0;padding-left:17px}.std-variable-symbol{font-family:Cambria,'Times New Roman',serif;font-size:15px;color:#182e4b}.std-variable-unit{margin-left:5px;color:#65748a;font-size:12px}@media(max-width:560px){.std-equation-head{align-items:flex-start;flex-direction:column}.std-verification{max-width:100%}.std-equation-detail-group{grid-template-columns:1fr;gap:2px}}
</style>

<style scoped>
.std-variable-symbol { margin-right: .35em; white-space: nowrap; }
</style>
