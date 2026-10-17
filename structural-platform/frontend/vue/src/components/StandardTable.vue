<script setup>
import { computed } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps({ record: { type: Object, required: true }, locale: { type: String, default: 'en' }, canNavigate: Boolean })
const emit = defineEmits(['source'])

const words = computed(() => props.locale === 'vi' ? {
  source: 'Mở nguồn', pdf: 'PDF p.', printed: 'Trang in', status: 'Trạng thái',
  case: 'Trường hợp', description: 'Mô tả cấu kiện', ratio: 'Tỷ số bề rộng/chiều dày', examples: 'Ví dụ',
  conditions: 'Điều kiện áp dụng', footnotes: 'Chú thích', omitted: 'Các trường hợp bị lược bỏ',
  partial: 'Bảng chỉ có bản chép một phần; không đại diện cho bảng đầy đủ.',
  notComplete: 'Ví dụ và sơ đồ trong nguồn chưa được đưa vào bản chép này.',
} : {
  source: 'Open source', pdf: 'PDF p.', printed: 'Printed page', status: 'Status',
  case: 'Case', description: 'Element description', ratio: 'Width-to-thickness ratio', examples: 'Examples',
  conditions: 'Application conditions', footnotes: 'Footnotes', omitted: 'Omitted cases',
  partial: 'This is a partial table transcription; it does not represent the complete table.',
  notComplete: 'Source examples and diagrams are not included in this transcription.',
})

function parseValue(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

function objectValue(value) {
  const parsed = parseValue(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function listValue(value) {
  const parsed = parseValue(value)
  if (Array.isArray(parsed)) return parsed
  if (parsed == null || parsed === '') return []
  return [parsed]
}

const sourceMetadata = computed(() => objectValue(props.record.source_metadata))
const rows = computed(() => {
  const rows = listValue(props.record.rows)
  if (rows.length) return rows.filter(row => row && typeof row === 'object' && !Array.isArray(row))
  return listValue(sourceMetadata.value.rows).filter(row => row && typeof row === 'object' && !Array.isArray(row))
})

const definitions = [
  { key: 'case', aliases: ['case', 'case_number', 'label'], label: () => words.value.case, value: row => row.case_number ?? row.label ?? row.case },
  { key: 'description_of_element', aliases: ['description_of_element', 'description'], label: () => words.value.description, value: row => row.description_of_element ?? row.description },
  { key: 'width_to_thickness_ratio', aliases: ['width_to_thickness_ratio'], label: () => words.value.ratio, value: row => row.width_to_thickness_ratio },
  { key: 'lambda_p', aliases: ['lambda_p', 'lambda_p_latex'], label: () => 'λp', value: row => row.lambda_p_latex ?? row.lambda_p, math: true },
  { key: 'lambda_r', aliases: ['lambda_r', 'lambda_r_latex'], label: () => 'λr', value: row => row.lambda_r_latex ?? row.lambda_r, math: true },
  { key: 'examples', aliases: ['examples', 'example'], label: () => words.value.examples, value: row => row.examples ?? row.example },
]

function columnKey(column) {
  if (typeof column === 'string') return column
  return column?.key ?? column?.field ?? column?.name ?? ''
}

const columns = computed(() => {
  const requested = listValue(props.record.columns).length ? listValue(props.record.columns) : listValue(sourceMetadata.value.columns)
  const requestedKeys = requested.map(columnKey).filter(Boolean)
  const available = definitions.filter(definition => {
    const requestedColumn = requestedKeys.length === 0 || requestedKeys.some(key => definition.aliases.includes(key))
    return requestedColumn && rows.value.some(row => {
      const value = definition.value(row)
      return value !== null && value !== undefined && value !== ''
    })
  })
  return available.map(definition => ({ ...definition, label: definition.label() }))
})

const rowModels = computed(() => rows.value.map((row, index) => {
  const anchor = objectValue(row.source_anchor)
  const recordAnchor = objectValue(props.record.source_anchor)
  return {
    row,
    key: row.id ?? `${props.record.table_code || props.record.id}-${index}`,
    values: columns.value.map(column => column.value(row)),
    status: row.verification_status || props.record.verification_status || props.record.status,
    conditions: listValue(row.conditions).map(displayValue).filter(Boolean),
    footnoteRefs: listValue(row.footnote_refs ?? row.footnotes).map(displayValue).filter(Boolean),
    documentId: row.document_id ?? props.record.document_id,
    clauseId: row.clause_id ?? props.record.clause_id,
    clauseCode: row.clause_code ?? props.record.clause_code ?? anchor.clause_code ?? recordAnchor.clause_code,
    kind: row.kind ?? props.record.kind,
    pdfPage: row.pdf_page ?? props.record.pdf_page ?? anchor.pdf_page,
    printedPage: row.printed_page_label ?? props.record.printed_page_label ?? anchor.printed_page_label,
    label: row.label ?? row.case_number ?? `${props.record.table_code || props.record.label || 'table'} row ${index + 1}`,
  }
}))

function displayValue(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(', ')
  return Object.entries(value).map(([key, item]) => `${key}: ${displayValue(item)}`).join(' · ')
}

const footnotes = computed(() => listValue(props.record.footnotes).length ? listValue(props.record.footnotes) : listValue(sourceMetadata.value.footnotes))
const coverage = computed(() => objectValue(props.record.coverage ?? sourceMetadata.value.coverage))
const omittedCases = computed(() => listValue(coverage.value.omitted_case_ids).map(displayValue).filter(Boolean))
const includedCases = computed(() => listValue(coverage.value.included_case_ids).map(displayValue).filter(Boolean))
const rawApplicability = computed(() => parseValue(props.record.applicability ?? sourceMetadata.value.applicability))
const applicabilityMetadata = computed(() => objectValue(rawApplicability.value))
const coverageType = computed(() => props.record.coverage_type ?? sourceMetadata.value.coverage_type ?? applicabilityMetadata.value.coverage_type ?? coverage.value.coverage_type)
const partial = computed(() => coverageType.value === 'partial' || props.record.complete_table === false || sourceMetadata.value.complete_table === false || applicabilityMetadata.value.complete_table === false)
const examplesMissing = computed(() => props.record.source_example_diagrams_included === false || sourceMetadata.value.source_example_diagrams_included === false || applicabilityMetadata.value.source_example_diagrams_included === false)
const showRowStatus = computed(() => rowModels.value.some(row => row.status))
const rowColumnSpan = computed(() => columns.value.length + 1 + (showRowStatus.value ? 1 : 0))
const applicability = computed(() => {
  const value = rawApplicability.value
  if (value && typeof value === 'object' && !Array.isArray(value)) return value.description ?? value.use ?? ''
  return value
})
const notes = computed(() => props.record.source_notes ?? props.record.notes ?? sourceMetadata.value.notes ?? '')
const tableTitle = computed(() => props.record.title || props.record.table_code || props.record.label || 'Table')
const tableCode = computed(() => props.record.table_code || props.record.label || props.record.id || '')
const sourceAnchor = computed(() => objectValue(props.record.source_anchor))
const sourcePage = computed(() => props.record.pdf_page ?? sourceAnchor.value.pdf_page ?? null)
const printedPage = computed(() => props.record.printed_page_label ?? props.record.printed_page ?? sourceAnchor.value.printed_page_label ?? null)

function verificationLabel(status) {
  const normalized = String(status || 'unknown').toLowerCase()
  const labels = props.locale === 'vi'
    ? { verified: 'Đã xác minh', published: 'Đã phát hành', candidate: 'Ứng viên', needs_review: 'Cần rà soát', deprecated: 'Đã thay thế', unknown: 'Chưa rõ trạng thái' }
    : { verified: 'Verified', published: 'Published', candidate: 'Candidate', needs_review: 'Needs review', deprecated: 'Deprecated', unknown: 'Unknown status' }
  return labels[normalized] || normalized.replaceAll('_', ' ')
}

function mathHtml(value) {
  const latex = displayValue(value)
  if (!latex) return ''
  try {
    return katex.renderToString(latex, { displayMode: false, throwOnError: false, trust: false, strict: 'warn', output: 'htmlAndMathml' })
  } catch { return '' }
}

function mathRendered(value) {
  const html = mathHtml(value)
  return Boolean(html) && !html.includes('katex-error')
}

function sourceRecord(row = null) {
  if (!row) return props.record
  return {
    ...props.record,
    clause_id: row.clauseId,
    clause_code: row.clauseCode,
    document_id: row.documentId,
    kind: row.kind,
    pdf_page: row.pdfPage,
    printed_page_label: row.printedPage,
    label: row.label,
  }
}
</script>

<template>
  <article class="std-table-card" :data-verification-status="record.verification_status || 'unknown'">
    <header class="std-table-heading">
      <div><strong>{{ tableCode }}</strong><h4>{{ tableTitle }}</h4></div>
      <span class="std-table-status">{{ verificationLabel(record.verification_status) }}</span>
    </header>

    <div class="std-table-source-line">
      <button type="button" class="std-table-source" :aria-label="`${words.source} ${tableCode}`" :disabled="!canNavigate || !sourcePage" @click="emit('source', sourceRecord())">
        {{ words.source }}<template v-if="sourcePage"> · {{ words.pdf }} {{ sourcePage }}</template><template v-if="printedPage"> · {{ words.printed }} {{ printedPage }}</template>
      </button>
      <span v-if="sourceAnchor.table_id || sourceAnchor.clause_code">{{ sourceAnchor.table_id || sourceAnchor.clause_code }}</span>
    </div>

    <p v-if="partial" class="std-table-coverage" role="note">
      <strong>{{ words.partial }}</strong>
      <span v-if="includedCases.length">{{ locale === 'vi' ? 'Đã chép: ' : 'Transcribed: ' }}<code v-for="item in includedCases" :key="item">{{ item }} </code></span>
      <span v-if="omittedCases.length">{{ words.omitted }}: <code v-for="item in omittedCases" :key="item">{{ item }} </code></span>
    </p>
    <p v-if="applicability" class="std-table-applicability"><strong>{{ locale === 'vi' ? 'Phạm vi áp dụng' : 'Applicability' }}:</strong> {{ displayValue(applicability) }}</p>

    <div v-if="rowModels.length && columns.length" class="std-table-scroll">
      <table>
        <caption class="sr-only">{{ tableCode }} — {{ tableTitle }}</caption>
        <thead><tr>
          <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
          <th v-if="showRowStatus" scope="col">{{ words.status }}</th>
          <th scope="col">{{ words.source }}</th>
        </tr></thead>
        <tbody>
          <template v-for="row in rowModels" :key="row.key">
            <tr>
              <td v-for="(value, index) in row.values" :key="columns[index].key">
                <span v-if="columns[index].math && value != null && value !== '' && mathRendered(value)" class="std-table-math" v-html="mathHtml(value)"></span>
                <code v-else-if="columns[index].math && value != null && value !== ''">{{ displayValue(value) }}</code>
                <span v-else>{{ displayValue(value) }}</span>
                <sup v-if="columns[index].key === 'case' && row.footnoteRefs.length">{{ row.footnoteRefs.join(', ') }}</sup>
              </td>
              <td v-if="showRowStatus"><span class="std-table-row-status">{{ verificationLabel(row.status) }}</span></td>
              <td><button type="button" class="std-table-source" :aria-label="`${words.source} ${row.label}`" :disabled="!canNavigate || !row.pdfPage" @click="emit('source', sourceRecord(row))">{{ row.pdfPage ? `${words.pdf} ${row.pdfPage}` : words.source }}<template v-if="row.printedPage"> · {{ words.printed }} {{ row.printedPage }}</template></button></td>
            </tr>
            <tr v-if="row.conditions.length" class="std-table-row-detail">
              <td :colspan="rowColumnSpan"><strong>{{ words.conditions }}:</strong> {{ row.conditions.join(' · ') }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p v-if="examplesMissing" class="std-table-muted">{{ words.notComplete }}</p>
    <section v-if="footnotes.length" class="std-table-footnotes">
      <h5>{{ words.footnotes }}</h5>
      <ul><li v-for="(footnote, index) in footnotes" :key="footnote.marker || index"><strong v-if="footnote.marker">{{ footnote.marker }}</strong> {{ displayValue(footnote.text ?? footnote) }}</li></ul>
    </section>
    <p v-if="notes" class="std-table-muted">{{ displayValue(notes) }}</p>
  </article>
</template>

<style scoped>
.std-table-card{min-width:0;margin:9px 0;padding:11px;border:1px solid #d9e0e8;border-radius:8px;background:#fff}.std-table-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.std-table-heading strong{font-size:13px;color:#405d7a}.std-table-heading h4{margin:4px 0;font-size:14px;line-height:1.4}.std-table-status,.std-table-row-status{padding:3px 7px;border-radius:20px;background:#fff0df;color:#85541d;font-size:11px;white-space:nowrap}.std-table-source-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 8px;color:#687890;font-size:12px}.std-table-source{padding:3px 6px;border:1px solid #bdc8d6;border-radius:5px;background:#f5f7f9;color:#22486d;font:inherit;cursor:pointer}.std-table-source:disabled{opacity:.6;cursor:default}.std-table-coverage{display:grid;gap:4px;margin:7px 0;padding:8px;border-left:3px solid #bd8b49;background:#fff8ed;color:#715731;font-size:12px}.std-table-coverage code{margin-right:3px;overflow-wrap:anywhere}.std-table-applicability{margin:7px 0;color:#4e6177;font-size:12px}.std-table-scroll{max-width:100%;overflow:auto;border:1px solid #e0e5eb;border-radius:6px}.std-table-scroll table{width:100%;border-collapse:collapse;background:white;font-size:12px}.std-table-scroll th,.std-table-scroll td{padding:7px 8px;border-bottom:1px solid #e7ebf0;text-align:left;vertical-align:top}.std-table-scroll th{position:sticky;top:0;background:#f1f4f7;color:#344d69;white-space:nowrap}.std-table-scroll td{min-width:72px;line-height:1.45}.std-table-scroll td:first-child{white-space:nowrap;font-weight:700}.std-table-math{display:inline-block;min-width:max-content}.std-table-math :deep(.katex){font-size:1em}.std-table-row-detail td{background:#fafbfd;color:#53657a;font-size:11px}.std-table-row-status{display:inline-block}.std-table-footnotes{margin-top:8px;padding-top:7px;border-top:1px solid #e8edf2}.std-table-footnotes h5{margin:0 0 4px;font-size:12px}.std-table-footnotes ul{display:grid;gap:4px;margin:0;padding-left:18px;color:#52647a;font-size:11px}.std-table-muted{margin:7px 0;color:#65748a;font-size:11px;line-height:1.45}.std-table-anchor-only{margin:0;color:#788597;font-size:11px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style>
