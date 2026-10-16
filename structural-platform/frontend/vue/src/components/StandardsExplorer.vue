<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { request } from '../api'
import StandardsToc from './StandardsToc.vue'
import PrivateStandardPdf from './PrivateStandardPdf.vue'
import StandardEquation from './StandardEquation.vue'
import StandardTable from './StandardTable.vue'

const props = defineProps({ locale: { type: String, default: 'vi' }, canEdit: Boolean })

const families = ref([])
const selectedCode = ref(new URLSearchParams(window.location.search).get('standard') || '')
const detail = ref(null)
const clauses = ref([])
const equations = ref([])
const parameters = ref([])
const tables = ref([])
const clauseSearch = ref('')
const equationSearch = ref('')
const sectionFilter = ref('normative')
const loadingCatalog = ref(true)
const loadingEdition = ref(false)
const error = ref('')
const showReview = ref(true)
const activePage = ref(1)
const activeDocumentId = ref(null)
const selectedClauseId = ref(null)
const viewTab = ref('outline')
const notes = ref([])
const noteDraft = ref('')
const notesLoading = ref(false)
const noteSaving = ref(false)
const noteError = ref('')
const sourcePanel = ref(null)

const text = computed(() => props.locale === 'vi' ? {
  subtitle: 'Thư viện tiêu chuẩn kỹ thuật · dữ liệu từ cơ sở dữ liệu',
  hideReview: 'Ẩn phần rà soát', showReview: 'Hiện phần rà soát', loading: 'Đang tải thư viện tiêu chuẩn…',
  loadingEdition: 'Đang tải nội dung từ cơ sở dữ liệu…', retry: 'Thử lại', inDevelopment: 'Đang phát triển',
  comingSoon: 'Sắp ra mắt', editionStatus: 'Trạng thái phiên bản', breadcrumb: 'Tiêu chuẩn thiết kế',
  indexed: 'điều khoản đã lập chỉ mục', equations: 'mã phương trình', documents: 'tài liệu nguồn riêng tư',
  tabOutline: 'Mục lục', tabEquations: 'Thư viện phương trình', tabParameters: 'Thông số', tabTables: 'Bảng', tabSource: 'PDF nguồn',
  noClause: 'Chưa có điều khoản được lập chỉ mục cho phiên bản này.', noEquation: 'Chưa có phương trình cho điều khoản này.',
  noEquationExpression: 'Các mã phương trình vẫn là nội dung cần rà soát. Không dùng dữ liệu chưa xác minh cho tính toán thiết kế.',
  noParameters: 'Chưa có thông số được lập chỉ mục cho phiên bản này.', noTables: 'Chưa có bảng được lập chỉ mục cho phiên bản này.',
  sourceTitle: 'Tài liệu PDF riêng tư', sourcePageMissing: 'Điều khoản đang chọn chưa có ánh xạ chính xác tới trang PDF. Bộ xem không tự chuyển sang một trang gần đúng.',
  sourceHash: 'SHA-256', sourceRevision: 'Bản sửa đổi', sourceFilename: 'Tên tệp gốc', sourcePages: 'Số trang PDF', sourceStatus: 'Trạng thái nhập', sourceVerification: 'Trạng thái xác minh',
  extractionTitle: 'Chẩn đoán lập chỉ mục', extraction: 'Phương pháp trích xuất', sourceImported: 'Thời điểm nhập', coverageTitle: 'Độ bao phủ chỉ mục',
  notesTitle: 'Ghi chú kỹ thuật cá nhân', notePlaceholder: 'Ghi chú riêng cho điều khoản này…', saveNote: 'Lưu ghi chú',
  noNotes: 'Chưa có ghi chú cho điều khoản này.', noteSaved: 'Đã lưu ghi chú.', noteRequired: 'Nhập nội dung ghi chú trước khi lưu.',
  reviewTitle: 'Nguồn & rà soát', reviewNotice: 'Chỉ các mục đã xác minh hoặc đã phát hành mới được xem là dữ liệu đã duyệt. Nội dung khác chỉ phục vụ tra cứu và rà soát.',
  adminReview: 'Tài khoản quản trị có thể dùng quy trình rà soát được ủy quyền.',
  sourceReference: 'Nguồn', kindSpecification: 'Specification', kindCommentary: 'Commentary', kindFrontMatter: 'Tài liệu mở đầu',
  summary: 'Tóm tắt kỹ thuật', verification: 'Trạng thái xác minh', searchEquations: 'Tìm mã hoặc biểu thức phương trình…',
  recordStatus: 'Trạng thái', recordSource: 'Tham chiếu nguồn', noSource: 'Chưa có tham chiếu nguồn',
} : {
  subtitle: 'Engineering standards · database-backed',
  hideReview: 'Hide Review', showReview: 'Show Review', loading: 'Loading standards library…',
  loadingEdition: 'Loading edition content from the database…', retry: 'Retry', inDevelopment: 'In development',
  comingSoon: 'Coming soon', editionStatus: 'Edition status', breadcrumb: 'Design standard',
  indexed: 'indexed clauses', equations: 'equation labels', documents: 'private source documents',
  tabOutline: 'Document outline', tabEquations: 'Equation library', tabParameters: 'Parameters', tabTables: 'Tables', tabSource: 'PDF source',
  noClause: 'No clauses have been indexed for this edition yet.', noEquation: 'No equations are indexed for this clause.',
  noEquationExpression: 'Equation labels still require review. Unverified data is not available for design calculations.',
  noParameters: 'No parameters have been indexed for this edition yet.', noTables: 'No tables have been indexed for this edition yet.',
  sourceTitle: 'Private source PDF', sourcePageMissing: 'The selected clause has no exact physical PDF page mapping. The viewer will not jump to an approximate page.',
  sourceHash: 'SHA-256', sourceRevision: 'Revision', sourceFilename: 'Original filename', sourcePages: 'PDF pages', sourceStatus: 'Import status', sourceVerification: 'Verification status',
  extractionTitle: 'Indexing diagnostics', extraction: 'Extraction method', sourceImported: 'Imported at', coverageTitle: 'Index coverage',
  notesTitle: 'Personal technical notes', notePlaceholder: 'Add a private note to this clause…', saveNote: 'Save note',
  noNotes: 'There are no notes for this clause yet.', noteSaved: 'Note saved.', noteRequired: 'Enter note text before saving.',
  reviewTitle: 'Source & review', reviewNotice: 'Only verified or published records are approved. Other content is provided for reference and review.',
  adminReview: 'Administrator access can use the authorized review workflow.',
  sourceReference: 'Source', kindSpecification: 'Specification', kindCommentary: 'Commentary', kindFrontMatter: 'Front matter',
  summary: 'Technical summary', verification: 'Verification status', searchEquations: 'Search equation label or expression…',
  recordStatus: 'Status', recordSource: 'Source reference', noSource: 'No source reference',
})

const current = computed(() => families.value.flatMap(family => (family.editions || []).map(edition => ({ ...edition, family }))).find(edition => edition.code === selectedCode.value))
const clausesById = computed(() => new Map(clauses.value.map(clause => [String(clause.id), clause])))
const selectedClause = computed(() => clausesById.value.get(String(selectedClauseId.value)) || null)
const isComingSoon = computed(() => !current.value || String(current.value.status || '').toLowerCase().replace(/[\s-]/g, '_') === 'coming_soon')
const editionStatus = computed(() => {
  const status = String(current.value?.status || '').toLowerCase().replace(/[\s-]/g, '_')
  if (status === 'coming_soon') return text.value.comingSoon
  if (status === 'in_development' || status === 'catalogued') return text.value.inDevelopment
  return current.value?.status || ''
})
const sourceDocument = computed(() => {
  const documentId = activeDocumentId.value ?? selectedClause.value?.document_id
  return (detail.value?.documents || []).find(document => String(document.id) === String(documentId)) || null
})
function reportForDocument(document) {
  const report = document?.import_report
  if (typeof report !== 'string') return report && typeof report === 'object' ? report : null
  try {
    const parsed = JSON.parse(report)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch { return null }
}
const importReport = computed(() => reportForDocument(sourceDocument.value))
const equationsForClause = computed(() => {
  let rows = equations.value.filter(equation => {
    if (selectedClause.value && equation.clause_id != null) return String(equation.clause_id) === String(selectedClause.value.id)
    return selectedClause.value && String(equation.clause_code || '') === String(selectedClause.value.code)
  })
  const query = equationSearch.value.trim().toLocaleLowerCase()
  if (query) rows = rows.filter(equation => [equation.label, equation.latex, equation.clause_code].join(' ').toLocaleLowerCase().includes(query))
  return rows
})
const coverageEntries = computed(() => {
  const coverage = detail.value?.coverage
  if (!coverage || typeof coverage !== 'object') return []
  return Object.entries(coverage).filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
})
const mappedSourcePage = computed(() => selectedClause.value?.pdf_page || null)
const activePrintedPage = computed(() => {
  const physicalPage = Number(activePage.value)
  const rows = importReport.value?.pages
  if (Array.isArray(rows) && Number.isFinite(physicalPage)) {
    const page = rows.find(row => Number(row?.pdf_page) === physicalPage)
    if (page?.printed_page_label != null && String(page.printed_page_label).trim() !== '') return page.printed_page_label
  }
  if (selectedClause.value
    && String(selectedClause.value.document_id ?? sourceDocument.value?.id) === String(sourceDocument.value?.id)
    && Number(selectedClause.value.pdf_page) === physicalPage) {
    return selectedClause.value.printed_page_label ?? selectedClause.value.printed_page ?? null
  }
  return null
})

let editionSequence = 0
let editionController = null
let notesSequence = 0
let notesController = null

function rootPath(code = selectedCode.value) { return `/api/v1/standards/${encodeURIComponent(code)}` }
function isMissingEndpoint(error) { return [404, 405, 501].includes(error?.status) }

async function fetchAllPages(resource, { code = selectedCode.value, signal, fallback = null, optional = false } = {}) {
  const base = `${rootPath(code)}/${resource}`
  const records = []
  let page = 1
  let lastPage = 1
  try {
    do {
      const separator = base.includes('?') ? '&' : '?'
      const response = await request(`${base}${separator}page=${page}&per_page=100`, { signal })
      const payload = Array.isArray(response?.data) ? response.data : []
      records.push(...payload)
      const meta = response?.meta || {}
      const advertisedLast = Number(meta.last_page)
      lastPage = Number.isFinite(advertisedLast) && advertisedLast > 0 ? Math.min(advertisedLast, 1000) : page
      page++
    } while (page <= lastPage)
    return records
  } catch (fetchError) {
    if (fetchError?.name === 'AbortError') throw fetchError
    if (isMissingEndpoint(fetchError)) {
      if (Array.isArray(fallback)) return fallback
      if (optional) return []
    }
    throw fetchError
  }
}

async function fetchLegacyEquations(code, signal) {
  try {
    const response = await request(`${rootPath(code)}/equations`, { signal })
    return Array.isArray(response?.data) ? response.data : []
  } catch (fetchError) {
    if (fetchError?.name === 'AbortError' || !isMissingEndpoint(fetchError)) throw fetchError
    return []
  }
}

function selectInitialEdition() {
  const all = families.value.flatMap(family => family.editions || [])
  const requested = all.find(edition => edition.code === selectedCode.value)
  if (requested) return requested.code
  return all.find(edition => edition.code === 'AISC360-10')?.code
    || all.find(edition => String(edition.status).toLowerCase() !== 'coming_soon')?.code
    || all[0]?.code || ''
}

async function loadCatalog() {
  loadingCatalog.value = true
  error.value = ''
  try {
    const response = await request('/api/v1/standards')
    families.value = Array.isArray(response?.data) ? response.data : []
    const nextCode = selectInitialEdition()
    if (nextCode && nextCode === selectedCode.value) await loadEdition(nextCode)
    else selectedCode.value = nextCode
  } catch (loadError) {
    error.value = loadError?.message || 'Could not load standards.'
  } finally {
    loadingCatalog.value = false
  }
}

function findDocumentFor(record, kind = record?.kind) {
  const documents = detail.value?.documents || []
  const explicitId = record?.document_id
  if (explicitId != null) {
    const exact = documents.find(document => String(document.id) === String(explicitId))
    if (exact) return exact
  }
  const normalizedKind = String(kind || '').toLowerCase()
  const preferredKind = normalizedKind === 'commentary' ? 'commentary' : 'specification'
  return documents.find(document => document.kind === preferredKind) || documents[0] || null
}

function printedPageForEquation(equation) {
  const document = findDocumentFor(equation, equation?.kind)
  const physicalPage = Number(equation?.pdf_page)
  const rows = reportForDocument(document)?.pages
  if (Array.isArray(rows) && Number.isFinite(physicalPage)) {
    const page = rows.find(row => Number(row?.pdf_page) === physicalPage)
    if (page?.printed_page_label != null && String(page.printed_page_label).trim() !== '') return page.printed_page_label
  }
  return equation?.printed_page_label ?? equation?.printed_page ?? null
}

function selectClause(clause, { page = clause?.pdf_page, documentId = null, loadPersonalNotes = true } = {}) {
  if (!clause) return
  const previousDocumentId = activeDocumentId.value
  selectedClauseId.value = clause.id
  const doc = documentId != null
    ? (detail.value?.documents || []).find(document => String(document.id) === String(documentId)) || findDocumentFor(clause, clause.kind)
    : findDocumentFor(clause, clause.kind)
  activeDocumentId.value = doc?.id ?? null
  if (page != null && Number.isFinite(Number(page)) && Number(page) > 0) activePage.value = Number(page)
  else if (String(previousDocumentId) !== String(activeDocumentId.value)) activePage.value = doc ? 1 : null
  if (clause.kind === 'normative' || clause.kind === 'commentary') sectionFilter.value = clause.kind
  else if (clause.kind === 'front_matter') sectionFilter.value = 'all'
  if (loadPersonalNotes) loadNotes(clause)
}

async function loadEdition(code = selectedCode.value) {
  const sequence = ++editionSequence
  editionController?.abort()
  editionController = null
  notesController?.abort()
  notesController = null
  notesSequence++
  notes.value = []
  noteDraft.value = ''
  noteError.value = ''
  error.value = ''
  detail.value = null
  clauses.value = []
  equations.value = []
  parameters.value = []
  tables.value = []
  selectedClauseId.value = null
  activeDocumentId.value = null
  activePage.value = 1
  const edition = families.value.flatMap(family => family.editions || []).find(item => item.code === code)
  if (!edition || String(edition.status || '').toLowerCase().replace(/[\s-]/g, '_') === 'coming_soon') {
    loadingEdition.value = false
    return
  }

  const controller = new AbortController()
  editionController = controller
  const signal = controller.signal
  loadingEdition.value = true
  try {
    const response = await request(rootPath(code), { signal })
    if (sequence !== editionSequence) return
    detail.value = response?.data || null
    const legacyClauses = Array.isArray(detail.value?.clauses) ? detail.value.clauses : []
    const [clauseRows, equationRows, parameterRows, tableRows] = await Promise.all([
      fetchAllPages('clauses', { code, signal, fallback: legacyClauses }),
      fetchAllPages('equations', { code, signal }).catch(async fetchError => {
        if (fetchError?.name === 'AbortError') throw fetchError
        return fetchLegacyEquations(code, signal)
      }),
      fetchAllPages('parameters', { code, signal, optional: true }),
      fetchAllPages('tables', { code, signal, optional: true }),
    ])
    if (sequence !== editionSequence) return
    clauses.value = clauseRows
    equations.value = equationRows
    parameters.value = parameterRows
    tables.value = tableRows
    const initial = clauseRows.find(clause => clause.kind === 'normative') || clauseRows[0]
    const defaultDocument = findDocumentFor(initial, initial?.kind) || (detail.value?.documents || []).find(document => document.kind === 'specification') || detail.value?.documents?.[0]
    activeDocumentId.value = defaultDocument?.id ?? null
    activePage.value = initial?.pdf_page ? Number(initial.pdf_page) : (defaultDocument ? 1 : null)
    if (initial) {
      selectedClauseId.value = initial.id
      sectionFilter.value = initial.kind === 'commentary' ? 'commentary' : 'normative'
      loadNotes(initial)
    }
  } catch (loadError) {
    if (loadError?.name !== 'AbortError' && sequence === editionSequence) error.value = loadError?.message || 'Could not load edition.'
  } finally {
    if (sequence === editionSequence) loadingEdition.value = false
  }
}

function selectEdition(edition) {
  if (!edition || String(edition.status || '').toLowerCase().replace(/[\s-]/g, '_') === 'coming_soon') return
  selectedCode.value = edition.code
}

function sourceForEquation(equation) {
  const clause = clausesById.value.get(String(equation.clause_id))
    || clauses.value.find(item => item.code === equation.clause_code)
  if (clause) selectClause(clause, { page: equation.pdf_page, documentId: equation.document_id ?? clause.document_id })
  else {
    const doc = findDocumentFor(equation, equation.kind)
    activeDocumentId.value = doc?.id ?? null
    if (equation.pdf_page) activePage.value = Number(equation.pdf_page)
  }
  viewTab.value = 'source'
  nextTick(() => sourcePanel.value?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
}

function syncClauseToViewerPage(page) {
  if (!Number.isFinite(Number(page))) return
  activePage.value = Number(page)
  const candidates = clauses.value.filter(clause => clause.pdf_page && (
    clause.document_id == null || activeDocumentId.value == null || String(clause.document_id) === String(activeDocumentId.value)
  )).sort((a, b) => Number(a.pdf_page) - Number(b.pdf_page))
  const match = [...candidates].reverse().find(clause => Number(clause.pdf_page) <= Number(page))
  if (match) selectClause(match, { page: Number(page), documentId: activeDocumentId.value })
}

async function loadNotes(clause) {
  if (!clause?.id || !selectedCode.value) return
  const sequence = ++notesSequence
  notesController?.abort()
  const controller = new AbortController()
  notesController = controller
  notesLoading.value = true
  noteError.value = ''
  notes.value = []
  noteDraft.value = ''
  try {
    const response = await request(`${rootPath()}/notes?clause_id=${encodeURIComponent(clause.id)}`, { signal: controller.signal })
    if (sequence !== notesSequence || String(selectedClauseId.value) !== String(clause.id)) return
    notes.value = Array.isArray(response?.data) ? response.data : (response?.data ? [response.data] : [])
  } catch (loadError) {
    if (loadError?.name !== 'AbortError' && sequence === notesSequence) noteError.value = loadError?.message || 'Could not load personal notes.'
  } finally {
    if (sequence === notesSequence) notesLoading.value = false
  }
}

async function saveNote() {
  const body = noteDraft.value.trim()
  if (!body) { noteError.value = text.value.noteRequired; return }
  if (!selectedClause.value) return
  const clauseId = selectedClause.value.id
  const editionCode = selectedCode.value
  const noteLoadSequence = notesSequence
  noteSaving.value = true
  noteError.value = ''
  try {
    const response = await request(`${rootPath(editionCode)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ clause_id: clauseId, body }),
    })
    const saved = response?.data
    if (String(selectedCode.value) === String(editionCode) && String(selectedClauseId.value) === String(clauseId) && noteLoadSequence === notesSequence) {
      if (saved) notes.value = [...notes.value, saved]
      noteDraft.value = ''
    }
  } catch (saveError) {
    noteError.value = saveError?.message || 'Could not save note.'
  } finally {
    noteSaving.value = false
  }
}

function statusLabel(status) {
  const normalized = String(status || 'unknown').toLowerCase()
  const vi = { verified: 'Đã xác minh', published: 'Đã phát hành', candidate: 'Ứng viên', needs_review: 'Cần rà soát', deprecated: 'Đã thay thế', index_only: 'Chỉ mục lục', pending: 'Đang chờ', indexed: 'Đã lập chỉ mục' }
  const en = { verified: 'Verified', published: 'Published', candidate: 'Candidate', needs_review: 'Needs review', deprecated: 'Deprecated', index_only: 'Index only', pending: 'Pending', indexed: 'Indexed' }
  return (props.locale === 'vi' ? vi : en)[normalized] || String(status || 'Unknown').replaceAll('_', ' ')
}

function kindLabel(kind) {
  if (kind === 'normative') return text.value.kindSpecification
  if (kind === 'commentary') return text.value.kindCommentary
  return text.value.kindFrontMatter
}

function recordTitle(record, index) { return record.label || record.code || record.key || record.identifier || record.name || record.title || `${props.locale === 'vi' ? 'Mục' : 'Record'} ${index + 1}` }
function recordFields(record) {
  if (!record || typeof record !== 'object') return [['value', record]]
  return Object.entries(record).filter(([key, value]) => !['id', 'created_at', 'updated_at'].includes(key) && value !== null && value !== undefined)
}
function printValue(value) { return typeof value === 'string' ? value : (value && typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)) }

watch(selectedCode, code => {
  if (!loadingCatalog.value && code) loadEdition(code)
})

onMounted(loadCatalog)
</script>

<template>
  <div class="standards-panel">
    <header class="standards-header">
      <div>
        <h2>{{ current?.title || 'Standards Explorer' }} <span class="std-heading-suffix">· Standards Explorer</span></h2>
        <p>{{ text.subtitle }}</p>
      </div>
      <button type="button" class="std-muted" :aria-expanded="showReview" @click="showReview = !showReview">{{ showReview ? text.hideReview : text.showReview }}</button>
    </header>

    <p v-if="error" role="alert" class="std-error"><span>{{ error }}</span> <button type="button" @click="loadEdition()">{{ text.retry }}</button></p>
    <p v-if="loadingCatalog" role="status" class="std-loading">{{ text.loading }}</p>
    <p v-if="loadingEdition && !detail" role="status" class="std-loading">{{ text.loadingEdition }}</p>
    <div v-else class="std-families">
      <details v-for="family in families" :key="family.id || family.code" :open="family.code === 'AISC360'">
        <summary><strong>{{ family.name }}</strong> <small>{{ family.publisher }}</small></summary>
        <div class="std-editions">
          <div v-for="edition in family.editions || []" :key="edition.id || edition.code" class="std-edition-option">
            <button type="button" :aria-pressed="selectedCode === edition.code" :disabled="String(edition.status || '').toLowerCase().replace(/[\s-]/g, '_') === 'coming_soon'" @click="selectEdition(edition)">{{ edition.title }}</button>
            <small :class="{ 'std-coming-soon': String(edition.status || '').toLowerCase().replace(/[\s-]/g, '_') === 'coming_soon' }">{{ String(edition.status || '').toLowerCase().replace(/[\s-]/g, '_') === 'coming_soon' ? text.comingSoon : text.inDevelopment }}</small>
          </div>
        </div>
      </details>
    </div>

    <section v-if="current && isComingSoon" class="std-coming-panel" role="status">
      <strong>{{ current.title }}</strong><span>{{ text.comingSoon }}</span>
    </section>

    <div v-if="detail && !isComingSoon && !error" class="std-workspace">
      <div class="std-context">
        <strong>{{ current?.title }}</strong><span class="std-edition-status">{{ text.editionStatus }}</span>
        <span>{{ clauses.length }} {{ text.indexed }} · {{ equations.length }} {{ text.equations }} · {{ detail.documents?.length || 0 }} {{ text.documents }}</span>
      </div>
      <p v-if="loadingEdition" class="std-loading" role="status">{{ text.loadingEdition }}</p>
      <div v-if="!loadingEdition" class="std-reader-tabs" role="tablist" :aria-label="text.breadcrumb">
        <button type="button" role="tab" :aria-selected="viewTab === 'outline'" @click="viewTab = 'outline'">{{ text.tabOutline }}</button>
        <button type="button" role="tab" :aria-selected="viewTab === 'equations'" @click="viewTab = 'equations'">{{ text.tabEquations }}</button>
        <button type="button" role="tab" :aria-selected="viewTab === 'parameters'" @click="viewTab = 'parameters'">{{ text.tabParameters }}</button>
        <button type="button" role="tab" :aria-selected="viewTab === 'tables'" @click="viewTab = 'tables'">{{ text.tabTables }}</button>
        <button type="button" role="tab" :aria-selected="viewTab === 'source'" @click="viewTab = 'source'; nextTick(() => sourcePanel?.scrollIntoView({ block: 'start', behavior: 'smooth' }))">{{ text.tabSource }}</button>
      </div>

      <div v-if="!loadingEdition" class="std-three" :class="{ 'std-without-review': !showReview }">
        <StandardsToc
          :clauses="clauses"
          :selected-id="selectedClauseId"
          :search="clauseSearch"
          :kind="sectionFilter"
          :locale="locale"
          @select="selectClause"
          @update:search="clauseSearch = $event"
          @update:kind="sectionFilter = $event"
        />

        <main class="std-main">
          <template v-if="viewTab === 'outline'">
            <template v-if="selectedClause">
              <header class="std-clause-heading">
                <div><span>{{ kindLabel(selectedClause.kind) }}</span><h3><strong>{{ selectedClause.code }}</strong> {{ selectedClause.title }}</h3></div>
                <span class="std-clause-status">{{ statusLabel(selectedClause.verification_status) }}</span>
              </header>
              <section v-if="selectedClause.summary" class="std-summary"><h4>{{ text.summary }}</h4><p>{{ selectedClause.summary }}</p></section>
              <section class="std-main-section">
                <header class="std-section-heading"><h3>{{ text.tabEquations }}</h3><label><span class="sr-only">{{ text.searchEquations }}</span><input v-model="equationSearch" type="search" :placeholder="text.searchEquations" /></label></header>
                <p v-if="!equationsForClause.length" class="std-empty">{{ text.noEquation }} <span>{{ text.noEquationExpression }}</span></p>
                <StandardEquation v-for="equation in equationsForClause" :key="equation.id || `${equation.clause_code}-${equation.label}`" :equation="equation" :locale="locale" :printed-page="printedPageForEquation(equation)" :can-navigate="Boolean(findDocumentFor(equation, equation.kind))" @source="sourceForEquation" />
              </section>
            </template>
            <p v-else class="std-empty">{{ text.noClause }}</p>
          </template>

          <section v-else-if="viewTab === 'equations'" class="std-main-section">
            <header class="std-section-heading"><h3>{{ text.tabEquations }} <span v-if="selectedClause">· {{ selectedClause.code }}</span></h3><label><span class="sr-only">{{ text.searchEquations }}</span><input v-model="equationSearch" type="search" :placeholder="text.searchEquations" /></label></header>
            <p v-if="!equationsForClause.length" class="std-empty">{{ text.noEquation }} <span>{{ text.noEquationExpression }}</span></p>
            <StandardEquation v-for="equation in equationsForClause" :key="equation.id || `${equation.clause_code}-${equation.label}`" :equation="equation" :locale="locale" :printed-page="printedPageForEquation(equation)" :can-navigate="Boolean(findDocumentFor(equation, equation.kind))" @source="sourceForEquation" />
          </section>

          <section v-else-if="viewTab === 'parameters'" class="std-main-section">
            <h3>{{ text.tabParameters }}</h3>
            <p v-if="!parameters.length" class="std-empty">{{ text.noParameters }}</p>
            <article v-for="(record, index) in parameters" :key="record.id || record.key || record.code || index" class="std-registry-record">
              <header><strong>{{ recordTitle(record, index) }}</strong><span>{{ statusLabel(record.verification_status || record.status) }}</span></header>
              <dl><div v-for="[key, value] in recordFields(record)" :key="key"><dt>{{ key.replaceAll('_', ' ') }}</dt><dd>{{ printValue(value) }}</dd></div></dl>
              <small>{{ record.source_anchor || record.clause_code || text.noSource }}<template v-if="record.pdf_page"> · PDF p. {{ record.pdf_page }}</template></small>
            </article>
          </section>

          <section v-else-if="viewTab === 'tables'" class="std-main-section">
            <h3>{{ text.tabTables }}</h3>
            <p v-if="!tables.length" class="std-empty">{{ text.noTables }}</p>
            <StandardTable v-for="(record, index) in tables" :key="record.id || record.table_code || record.key || index" :record="record" :locale="locale" :can-navigate="Boolean(findDocumentFor(record, record.kind))" @source="sourceForEquation" />
          </section>

          <section ref="sourcePanel" class="std-source-section" :class="{ 'std-source-selected': viewTab === 'source' }">
            <header><h3>{{ text.sourceTitle }}</h3><span v-if="selectedClause">{{ selectedClause.code }} · {{ selectedClause.title }}</span></header>
            <p v-if="selectedClause && !mappedSourcePage" class="std-source-warning" role="note">{{ text.sourcePageMissing }}</p>
            <PrivateStandardPdf
              v-if="sourceDocument"
              :key="`${selectedCode}-${sourceDocument.id}`"
              :edition-code="selectedCode"
              :document-id="sourceDocument.id"
              :page="activePage || 1"
              :page-count="sourceDocument.page_count"
              :printed-page="activePrintedPage"
              :locale="locale"
              @pagechange="syncClauseToViewerPage"
            />
            <p v-else class="std-empty">{{ detail.documents?.length ? text.sourcePageMissing : (locale === 'vi' ? 'Quản trị viên chưa nhập tài liệu PDF riêng tư.' : 'The private source PDF has not been imported by an administrator.') }}</p>
          </section>
        </main>

        <aside v-if="showReview" class="std-review">
          <h3>{{ text.reviewTitle }}</h3><p class="std-review-notice">{{ text.reviewNotice }}</p>
          <p v-if="canEdit" class="std-admin-review">{{ text.adminReview }}</p>

          <section class="std-review-section">
            <h4>{{ text.sourceTitle }}</h4>
            <dl v-if="sourceDocument" class="std-source-metadata">
              <div v-if="sourceDocument.sha256"><dt>{{ text.sourceHash }}</dt><dd><code>{{ sourceDocument.sha256 }}</code></dd></div>
              <div v-if="sourceDocument.original_name"><dt>{{ text.sourceFilename }}</dt><dd>{{ sourceDocument.original_name }}</dd></div>
              <div v-if="sourceDocument.revision || sourceDocument.document_revision"><dt>{{ text.sourceRevision }}</dt><dd>{{ sourceDocument.revision || sourceDocument.document_revision }}</dd></div>
              <div v-if="sourceDocument.page_count"><dt>{{ text.sourcePages }}</dt><dd>{{ sourceDocument.page_count }}</dd></div>
              <div v-if="sourceDocument.processing_status"><dt>{{ text.sourceStatus }}</dt><dd>{{ statusLabel(sourceDocument.processing_status) }}</dd></div>
              <div v-if="sourceDocument.verification_status"><dt>{{ text.sourceVerification }}</dt><dd>{{ statusLabel(sourceDocument.verification_status) }}</dd></div>
              <div v-if="sourceDocument.imported_at"><dt>{{ text.sourceImported }}</dt><dd>{{ sourceDocument.imported_at }}</dd></div>
            </dl>
            <p v-else class="std-review-muted">{{ locale === 'vi' ? 'Chưa có tài liệu riêng tư được đăng ký.' : 'No private source document is registered.' }}</p>
          </section>

          <section v-if="coverageEntries.length" class="std-review-section">
            <h4>{{ text.coverageTitle }}</h4>
            <dl class="std-source-metadata"><div v-for="[key, value] in coverageEntries" :key="key"><dt>{{ key.replaceAll('_', ' ') }}</dt><dd>{{ value }}</dd></div></dl>
          </section>

          <section class="std-review-section">
            <h4>{{ text.extractionTitle }}</h4>
            <p v-if="selectedClause?.extraction_method"><strong>{{ text.extraction }}:</strong> {{ selectedClause.extraction_method }}</p>
            <p v-if="selectedClause?.source_anchor"><strong>{{ text.sourceReference }}:</strong> {{ selectedClause.source_anchor }}</p>
            <p v-if="selectedClause?.verification_status"><strong>{{ text.verification }}:</strong> {{ statusLabel(selectedClause.verification_status) }}</p>
            <p v-if="!selectedClause?.extraction_method && !selectedClause?.source_anchor" class="std-review-muted">{{ locale === 'vi' ? 'Chưa có thêm chẩn đoán trích xuất cho điều khoản đang chọn.' : 'No additional extraction diagnostics are available for the selected clause.' }}</p>
          </section>

          <section v-if="selectedClause" class="std-review-section std-notes">
            <h4>{{ text.notesTitle }}</h4>
            <p v-if="notesLoading" role="status">{{ locale === 'vi' ? 'Đang tải ghi chú…' : 'Loading notes…' }}</p>
            <ul v-else-if="notes.length" class="std-note-list"><li v-for="note in notes" :key="note.id || note.created_at"><p>{{ note.body }}</p><small>{{ note.created_at || '' }}</small></li></ul>
            <p v-else class="std-review-muted">{{ text.noNotes }}</p>
            <label><span class="sr-only">{{ text.notePlaceholder }}</span><textarea v-model="noteDraft" rows="3" :placeholder="text.notePlaceholder" :disabled="noteSaving" @keydown.ctrl.enter="saveNote" @keydown.meta.enter="saveNote"></textarea></label>
            <p v-if="noteError" role="alert" class="std-error">{{ noteError }}</p>
            <button type="button" class="std-note-save" :disabled="noteSaving || !noteDraft.trim()" @click="saveNote">{{ noteSaving ? (locale === 'vi' ? 'Đang lưu…' : 'Saving…') : text.saveNote }}</button>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.standards-panel{background:#f9f7f2;color:#243a58;padding:22px;border-radius:12px}.standards-header{display:flex;justify-content:space-between;gap:10px;align-items:start}.standards-header h2{margin:0}.standards-header p,.std-context span{color:#667790;font-size:13px}.std-heading-suffix{font-size:15px;font-weight:400;color:#718096}.std-families{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.std-families details{background:white;border:1px solid #d5dce6;border-radius:8px;padding:10px;min-width:225px}.std-families summary{cursor:pointer}.std-families summary small{display:block;color:#718097}.std-editions{display:grid;gap:7px;margin-top:10px}.std-edition-option{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.std-editions button,.std-muted,.std-note-save,.std-error button{padding:7px 10px;border:1px solid #b2bfd0;border-radius:6px;background:#f6f7f9;color:#243a58;cursor:pointer}.std-editions button[aria-pressed=true]{background:#243a58;color:white}.std-editions button:disabled{background:#f3f4f6;color:#8a94a2;cursor:default}.std-edition-option small{color:#536e8c;font-size:11px}.std-edition-option small.std-coming-soon{color:#8993a0}.std-context{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:15px 0}.std-context span{font-size:12px}.std-edition-status{padding:3px 8px;border-radius:20px;background:#eaf0f7;color:#425f7f}.std-coming-panel{display:flex;gap:12px;align-items:center;padding:16px;border:1px solid #d6dfe7;border-radius:8px;background:white;color:#65748a}.std-reader-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0 14px;border-bottom:1px solid #d7dfe8}.std-reader-tabs button{padding:9px 13px;border:1px solid #bac9dc;border-radius:7px;background:#e7edf5;color:#263d5f;font-weight:700;cursor:pointer}.std-reader-tabs button[aria-selected=true]{background:#24395d;color:white}.std-three{display:grid;grid-template-columns:minmax(210px,1fr) minmax(330px,2.5fr) minmax(190px,.95fr);gap:12px;margin-top:16px}.std-three.std-without-review{grid-template-columns:minmax(210px,1fr) minmax(400px,3fr)}.std-main,.std-review{min-width:0;padding:14px;border:1px solid #d6dfe7;border-radius:9px;background:#fff}.std-main{background:#fffdf8}.std-clause-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:11px;border-bottom:1px solid #e4e8ee}.std-clause-heading>div>span{font-size:12px;color:#718096}.std-clause-heading h3{margin:5px 0}.std-clause-heading h3 strong{font-weight:800}.std-clause-status{flex:0 0 auto;padding:4px 8px;border-radius:20px;background:#fff0df;color:#85541d;font-size:11px}.std-summary{margin:12px 0;padding:11px;border-left:3px solid #91a6bf;background:#f4f6f8}.std-summary h4,.std-summary p{margin:0}.std-summary h4{font-size:13px}.std-summary p{margin-top:5px;line-height:1.5}.std-main-section{margin-top:13px}.std-main-section>h3{margin:6px 0 12px}.std-section-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.std-section-heading h3{margin:7px 0 12px}.std-section-heading h3 span{font-size:14px;font-weight:500}.std-section-heading input{max-width:210px;padding:7px;border:1px solid #cbd6e4;border-radius:5px}.std-empty{margin:8px 0;padding:12px;border-radius:8px;background:#fff8ea;color:#7a6a4d;line-height:1.5}.std-empty span{display:block;margin-top:5px;font-size:13px}.std-source-section{margin-top:16px;padding-top:12px;border-top:1px solid #dfe4eb;scroll-margin-top:12px}.std-source-section>header{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px}.std-source-section h3{margin:0 0 9px}.std-source-section>header span{font-size:12px;color:#697990}.std-source-warning{margin:4px 0 8px;padding:8px;border:1px solid #e5d4bd;border-radius:6px;background:#fff8ed;color:#815d34;font-size:12px}.std-source-selected{scroll-margin-top:16px}.std-review{line-height:1.5}.std-review h3{margin:0 0 8px}.std-review p{font-size:13px}.std-review-notice{padding:9px;border-radius:7px;background:#fff6e8;color:#755b39}.std-admin-review{padding:8px;border-radius:6px;background:#eef3f8;color:#47617c}.std-review-section{padding:10px 0;border-top:1px solid #edf0f4}.std-review-section h4{margin:0 0 7px;font-size:14px}.std-review-section p{margin:6px 0}.std-review-muted{color:#778498}.std-source-metadata{display:grid;gap:6px;margin:0}.std-source-metadata>div{display:grid;gap:2px}.std-source-metadata dt{font-size:11px;color:#6b7a90;font-weight:700}.std-source-metadata dd{margin:0;font-size:12px;overflow-wrap:anywhere}.std-source-metadata code{font-size:10px;word-break:break-all}.std-note-list{display:grid;gap:6px;max-height:220px;overflow:auto;margin:6px 0;padding:0;list-style:none}.std-note-list li{padding:8px;border-radius:6px;background:#f5f6f8}.std-note-list li p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.std-note-list small{color:#718096}.std-notes textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd6e4;border-radius:5px;font:inherit;resize:vertical}.std-note-save{margin-top:6px;background:#24395d;color:white}.std-note-save:disabled{opacity:.55;cursor:default}.std-error{display:flex;justify-content:space-between;align-items:center;gap:8px;color:#ad3434}.std-loading{padding:9px;color:#667790}.std-registry-record{margin:9px 0;padding:10px;border:1px solid #e1e5eb;border-radius:7px;background:white}.std-registry-record header{display:flex;justify-content:space-between;gap:8px}.std-registry-record header span,.std-registry-record small{color:#6c7890;font-size:11px}.std-registry-record dl{display:grid;gap:4px;margin:8px 0}.std-registry-record dl div{display:grid;grid-template-columns:minmax(110px,.8fr) minmax(0,2fr);gap:8px}.std-registry-record dt{font-weight:700;text-transform:capitalize}.std-registry-record dd{margin:0;overflow-wrap:anywhere}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.std-without-review .std-review{display:none}.std-review button,.std-error button{font:inherit}@media(max-width:1050px){.std-three,.std-three.std-without-review{grid-template-columns:minmax(200px,.8fr) minmax(0,2fr)}.std-review{grid-column:1/-1;order:3}.std-without-review .std-review{display:none}}@media(max-width:700px){.standards-panel{padding:14px}.standards-header{align-items:flex-start;flex-direction:column}.std-three,.std-three.std-without-review{grid-template-columns:1fr}.std-outline{max-height:300px}.std-review{grid-column:auto}.std-section-heading{align-items:flex-start;flex-direction:column}.std-section-heading input{max-width:100%;width:100%;box-sizing:border-box}.std-reader-tabs button{flex:1 1 40%;padding:8px 6px}.std-registry-record dl div{grid-template-columns:1fr;gap:2px}}
</style>

<style scoped>
.std-registry-record dd{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:12px}
</style>
