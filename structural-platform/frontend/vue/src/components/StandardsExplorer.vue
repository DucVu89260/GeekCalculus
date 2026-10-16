<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { request, demoMode } from '../api'
import { aisc36010Equations, equationDocument } from '../aisc-equation-library.mjs'
import StandardSourceCorpus from './StandardSourceCorpus.vue'

const props = defineProps({ locale: { type: String, default: 'vi' }, canEdit: Boolean })
const families = ref([])
const selected = ref(new URLSearchParams(window.location.search).get('standard') || '')
const detail = ref(null)
const equations = ref([])
const search = ref('')
const loading = ref(true)
const error = ref('')
const showReview = ref(true)
const activePage = ref(null)
const activeDocumentId = ref(null)
const activeEquation = ref(null)
const sourcePreview = ref(null)
const viewTab = ref('outline')
const sectionFilter = ref('normative')
const activeClause = ref(null)
const equationPage = ref(1)
const isAsce710 = computed(() => selected.value === 'ASCE7-10')
const displayedEquations = computed(() => {
  const q = search.value.trim().toLowerCase()
  return equations.value.filter(eq => (!q || [eq.label, eq.clause_code, eq.expression, eq.latex, eq.reference_expression].join(' ').toLowerCase().includes(q))
    && (viewTab.value !== 'outline' || !activeClause.value || q || eq.clause_code === activeClause.value.code || eq.clause_code.startsWith(activeClause.value.code + '.')))
})
const equationPages = computed(() => Math.max(1, Math.ceil(displayedEquations.value.length / 30)))
const visibleEquations = computed(() => displayedEquations.value.slice((equationPage.value - 1) * 30, equationPage.value * 30))
const current = computed(() => families.value.flatMap(f => f.editions.map(e => ({ ...e, family: f }))).find(e => e.code === selected.value))
const clauses = computed(() => (detail.value?.clauses || []).filter(c => (sectionFilter.value === 'all' || c.kind === sectionFilter.value) && (!search.value || [c.code,c.title,c.summary].join(' ').toLowerCase().includes(search.value.toLowerCase()))))
const pdfUrl = computed(() => {
  const doc = equationDocument(detail.value?.documents || [], activeDocumentId.value)
  if (!doc || !selected.value) return ''
  if (doc.file_url) return doc.file_url + '#page=' + (activePage.value || 1)
  return '/api/v1/standards/' + encodeURIComponent(selected.value) + '/documents/' + doc.id + '/file#page=' + (activePage.value || 1)
})
async function list() {
  loading.value = true
  try {
    families.value = (await request('/api/v1/standards')).data
    if (!selected.value || !families.value.some(f=>f.editions.some(e=>e.code===selected.value))) selected.value = families.value.find(f => f.code === 'AISC360')?.editions?.[0]?.code || ''
    if (selected.value) await loadEdition()
  } catch(e) { error.value = e.message || 'Could not load standards.' }
  finally { loading.value = false }
}
let editionGeneration = 0
async function loadEdition() {
  const generation = ++editionGeneration
  detail.value = null; equations.value = []; error.value = ''
  activeClause.value = null; equationPage.value = 1; activePage.value = null; activeDocumentId.value = null; activeEquation.value = null; search.value = ''; viewTab.value = 'outline'
  if (!selected.value) return
  try {
    const [a,b] = await Promise.all([
      request('/api/v1/standards/'+encodeURIComponent(selected.value)),
      selected.value === 'ASCE7-10' ? Promise.resolve({ data: [] }) : request('/api/v1/standards/'+encodeURIComponent(selected.value)+'/equations')
    ])
    if (generation !== editionGeneration) return
    detail.value = a.data; equations.value = selected.value === 'AISC360-10' ? aisc36010Equations(b.data) : b.data
    if (selected.value === 'ASCE7-10') {
      activeClause.value = a.data.clauses.find(c => c.kind === 'normative' && c.code === '26') || null
      activePage.value = activeClause.value?.pdf_page || 1
      activeDocumentId.value = activeClause.value?.document_id ?? null
    }
  } catch(e) { if (generation === editionGeneration) error.value = e.message || 'Could not load edition.' }
}
function goTo(c) { activeClause.value = c; activeEquation.value = null; activeDocumentId.value = c.document_id ?? null; equationPage.value = 1; activePage.value = c.pdf_page || null }
async function goToEquation(eq) {
  activeEquation.value = eq
  activeDocumentId.value = eq.document_id ?? null
  activePage.value = eq.pdf_page || null
  await nextTick()
  sourcePreview.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
watch([search, viewTab], () => { equationPage.value = 1 })
watch(selected,loadEdition)
onMounted(list)
</script>

<template>
  <div class="standards-panel">
    <header class="standards-header"><div><h2>{{ current?.title || 'Standards Explorer' }} <span class="std-heading-suffix">· Standards Explorer</span></h2><p>{{ demoMode ? 'Engineering standards · source-indexed library' : locale === 'vi' ? 'Thư viện tiêu chuẩn kỹ thuật · dữ liệu từ database' : 'Engineering standards · database-backed' }}</p></div><button type="button" class="std-muted" @click="showReview=!showReview">{{ showReview ? 'Hide Review' : 'Show Review' }}</button></header>
    <p v-if="error" role="alert" class="std-error">{{ error }}</p>
    <p v-if="loading">Loading standards…</p>
    <div v-else class="std-families">
      <details v-for="family in families" :key="family.id" :open="family.editions.some(e => e.code === selected)">
        <summary><strong>{{ family.name }}</strong> <small>{{ family.publisher }}</small></summary>
        <div class="std-editions">
          <button v-for="edition in family.editions" :key="edition.id" type="button" :aria-pressed="selected===edition.code" @click="selected=edition.code">{{ edition.title }}</button>
        </div>
      </details>
    </div>
    <div v-if="detail" class="std-workspace">
      <div class="std-context"><strong>{{ current?.title }}</strong><span>{{ detail.clauses.length }} indexed clauses · <template v-if="!isAsce710">{{ equations.length }} equation labels · </template>{{ detail.documents.length }} {{ demoMode ? 'source documents' : 'private documents' }}</span></div>
      <div class="std-reader-tabs">
        <button type="button" :aria-pressed="viewTab==='outline'" @click="viewTab='outline'">Document Outline</button>
        <button v-if="!isAsce710" type="button" :aria-pressed="viewTab==='equations'" @click="viewTab='equations'">Equation Library</button>
        <button type="button" :aria-pressed="viewTab==='source'" @click="viewTab='source'">PDF Source</button>
        <button v-if="!isAsce710 && detail.documents.some(d => d.extraction_summary)" type="button" :aria-pressed="viewTab==='corpus'" @click="viewTab='corpus'">Source Corpus · Toàn văn / Bảng / Công thức</button>
      </div>
      <StandardSourceCorpus v-if="viewTab === 'corpus'" :key="selected" :code="selected" :documents="detail.documents" />
      <div v-else class="std-three" :class="{ 'std-without-review': !showReview }">
        <aside class="std-outline"><label>Table of contents<input v-model="search" placeholder="Search clauses or equations…" /></label><select v-model="sectionFilter" aria-label="Document section"><option value="normative">Specification</option><option value="commentary">Commentary</option><option value="all">All sections</option></select><button v-for="clause in clauses" :key="clause.id" class="std-clause" :aria-pressed="activeClause?.code === clause.code && activeClause?.kind === clause.kind" type="button" @click="goTo(clause)"><b>{{ clause.code }}</b><span>{{ clause.title }}</span><small>{{ clause.pdf_page ? 'PDF p. '+clause.pdf_page : clause.printed_page ? 'Printed p. '+clause.printed_page+' · PDF mapping pending' : 'No page mapped' }}</small></button><p v-if="!clauses.length">No matching clauses indexed yet.</p></aside>
        <section class="std-main">
          <h3>{{ viewTab === 'equations' ? 'Equation Library' : viewTab === 'source' || isAsce710 ? 'PDF Source' : 'Equations & References' }}</h3>
          <p v-if="isAsce710 && activeClause"><strong>{{ activeClause.code }} · {{ activeClause.title }}</strong></p>
          <p v-if="selected === 'AISC360-10' && viewTab !== 'source'" class="std-empty">{{ locale === 'vi' ? 'Import hiện lập chỉ mục mã và trang PDF, chưa phiên âm toàn bộ công thức. Một số biểu thức tham khảo được lấy từ bộ quy tắc I/H hiện có. Chọn mã để xem trang nguồn; trạng thái xác minh được giữ nguyên.' : 'Import indexes labels and PDF pages; it does not transcribe all formulas. Available implementation references come from the existing I/H rules. Select a label to view its source; review status is unchanged.' }}</p>
          <p v-if="!isAsce710 && !equations.length && viewTab !== 'source'" class="std-empty">No equation expressions available in this database yet. Only engineering-verified formulas may be used in calculations.</p>
          <article v-for="eq in (viewTab === 'source' ? [] : visibleEquations)" :key="eq.id" class="std-equation"><button type="button" class="std-eq-jump" :aria-pressed="activeEquation?.id === eq.id" @click="goToEquation(eq)"><strong>{{ eq.label }}</strong></button><code>{{ eq.latex || eq.expression || eq.reference_expression || (locale === 'vi' ? 'Chưa phiên âm biểu thức · chọn mã để xem PDF gốc' : 'Expression not transcribed · select label to view source PDF') }}</code><span><small v-if="eq.reference_expression" class="std-reference-label">{{ locale === 'vi' ? 'Tham khảo từ bộ quy tắc I/H · cần đối chiếu PDF' : 'I/H implementation reference · check against PDF' }}</small>{{ eq.clause_code }} · {{ eq.verification_status }} · {{ eq.pdf_page ? 'PDF p. '+eq.pdf_page : 'Source unmapped' }}</span></article>
          <nav v-if="viewTab !== 'source' && displayedEquations.length" class="std-equation-pages" aria-label="Equation pages"><button type="button" :disabled="equationPage <= 1" @click="equationPage--">Previous</button><span>{{ displayedEquations.length }} labels · {{ equationPage }}/{{ equationPages }}</span><button type="button" :disabled="equationPage >= equationPages" @click="equationPage++">Next</button></nav>
          <div ref="sourcePreview" class="std-source-selection" tabindex="-1">
          <h3>{{ activeEquation ? (activeEquation.label || activeEquation.clause) + ' · PDF Source' : 'PDF Preview' }}</h3>
          <p v-if="activeEquation || (isAsce710 && activeClause)" role="status">{{ activePage ? 'PDF p. ' + activePage : (locale === 'vi' ? 'Chưa có trang nguồn cho mục này.' : 'No source page mapped for this item.') }} <a v-if="pdfUrl && activePage" :href="pdfUrl" target="_blank" rel="noopener">{{ locale === 'vi' ? 'Mở trang PDF trong tab mới' : 'Open PDF page in new tab' }}</a></p>
          <p v-if="activeEquation?.reference_expression"><code>{{ activeEquation.reference_expression }}</code><br /><small>{{ activeEquation.reference_citation }} · {{ activeEquation.reference_conditions }} · REVIEW_REQUIRED</small></p>
          <p v-if="isAsce710 && pdfUrl" class="std-source-provenance">ASCE 7-10 · 658 pages · <a :href="pdfUrl" target="_blank" rel="noopener">Open PDF</a> · <a :href="pdfUrl.split('#')[0]" download="ASCE 7-10.pdf">Download PDF</a><br /><small>SHA-256: {{ detail.library?.source_sha256 || detail.documents.find(d => d.kind === 'specification')?.sha256 }}</small></p>
          <iframe v-if="pdfUrl" :key="pdfUrl" :src="pdfUrl" title="Engineering standard PDF source" class="std-pdf"></iframe>
          <p v-else class="std-empty">{{ locale === 'vi' ? 'Chưa có PDF nguồn phù hợp. Quản trị viên cần import PDF và liên kết tài liệu với mục tiêu chuẩn.' : 'No unambiguous source PDF is linked. Ask an administrator to import and associate the source document.' }}</p>
        </div>
        </section>
        <aside v-if="showReview" class="std-review"><h3>Source Review</h3><p v-if="isAsce710">{{ locale === 'vi' ? 'Chọn điều khoản trong mục lục để xem trang PDF gốc. Công thức được đọc trực tiếp trong PDF, không cần phiên âm.' : 'Select an outline entry to view its original PDF page. Read equations directly in the PDF; no transcription is required.' }}</p><p v-if="!isAsce710">Equation candidates must be checked against the source PDF before use in design calculations.</p><p>Unverified catalog headings are navigation-only.</p><p>{{ demoMode ? 'PDF source and its page index are included in this library.' : 'Private corpus documentation requires authentication.' }}</p></aside>
      </div>
    </div>
  </div>
</template>
<style scoped>
.standards-panel{background:#f9f7f2;color:#243a58;padding:22px;border-radius:12px}.standards-header{display:flex;justify-content:space-between;gap:10px;align-items:start}.standards-header h2{margin:0}.standards-header p,.std-context span{color:#667790;font-size:13px}.std-families{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.std-families details{background:white;border:1px solid #d5dce6;border-radius:8px;padding:10px;min-width:225px}.std-families summary{cursor:pointer}.std-families small{display:block;color:#718097}.std-editions{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.std-editions button,.std-muted,.std-upload button{padding:7px 10px;border:1px solid #b2bfd0;border-radius:6px;background:#f6f7f9;color:#243a58;cursor:pointer}.std-editions button[aria-pressed=true]{background:#243a58;color:white}.std-context{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:15px 0}.std-upload{display:flex;flex-wrap:wrap;align-items:center;gap:9px;border:1px solid #d2dce7;background:white;padding:12px;border-radius:8px}.std-upload small{width:100%;color:#63718b}.std-three{display:grid;grid-template-columns:minmax(195px,1fr) minmax(300px,2.3fr) minmax(170px,.8fr);gap:12px;margin-top:16px}.std-outline,.std-main,.std-review{background:white;padding:14px;border:1px solid #d6dfe7;border-radius:9px;min-width:0}.std-outline{max-height:640px;overflow:auto}.std-outline input{width:100%;margin:7px 0;padding:9px;box-sizing:border-box}.std-clause{display:grid;width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid #edf0f4;padding:10px 5px;gap:3px;color:#23395d;cursor:pointer}.std-clause:hover{background:#eef3f8}.std-clause small{color:#6b7890}.std-main h3{margin:8px 0 15px}.std-equation{display:grid;grid-template-columns:90px 1fr auto;align-items:center;gap:10px;border:1px solid #e9dfcb;background:#fffaf0;border-radius:7px;margin-bottom:7px;padding:10px}.std-equation strong,.std-equation code{font-weight:750}.std-eq-jump{border:0;background:none;color:#193c67;text-align:left;cursor:pointer}.std-eq-jump:disabled{cursor:default;opacity:.6}.std-equation code{white-space:normal;word-break:break-word}.std-equation span{font-size:12px;color:#7c8494}.std-pdf{height:530px;width:100%;border:1px solid #d3dce6;border-radius:6px}.std-empty{color:#7a6a4d;background:#fff8ea;padding:12px;border-radius:8px}.std-review p{font-size:13px;line-height:1.65}.std-error{color:#ad3434}.std-upload input{max-width:220px}@media(max-width:960px){.std-three{grid-template-columns:1fr}.std-outline{max-height:260px}.std-review{order:3}}
</style>

<style scoped>
.std-reader-tabs{display:flex;gap:7px;flex-wrap:wrap;padding:8px 0 14px;border-bottom:1px solid #d7dfe8}
.std-reader-tabs button{background:#e7edf5;border:1px solid #bac9dc;border-radius:7px;padding:9px 15px;font-weight:700;color:#263d5f;cursor:pointer}
.std-reader-tabs button[aria-pressed="true"]{background:#24395d;color:white}
.std-outline select{width:100%;padding:8px;margin-bottom:9px;border:1px solid #cbd6e4;border-radius:5px}
.std-without-review{grid-template-columns:minmax(210px,1fr) minmax(400px,3fr)}
.std-heading-suffix{font-size:15px;font-weight:400;color:#718096}
.std-main{background:#fffdf8}
.std-clause[aria-pressed="true"]{background:#e7edf5;border-left:3px solid #24395d;padding-left:8px}
.std-kernel{padding:12px;border:1px solid #d6dfe7;background:#f3f6fa;border-radius:7px;margin-bottom:14px}.std-kernel summary{cursor:pointer;font-weight:700}.std-formula{display:grid;gap:7px;border-top:1px solid #d6dfe7;padding:12px 0;margin-top:8px}.std-formula code{white-space:normal;overflow-wrap:anywhere}.std-formula small{color:#63718b}.std-source-provenance{font-size:13px;line-height:1.7;overflow-wrap:anywhere}.std-source-provenance a{color:#274c7e}.std-equation-pages{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:12px 0 20px;font-size:13px}.std-equation-pages button{padding:7px;border:1px solid #bac9dc;border-radius:5px;background:white;color:#24395d}
.std-equation{grid-template-columns:100px minmax(0,1fr) auto;box-shadow:0 1px 2px rgba(31,52,79,.05)}
.std-equation code{font-family:Cambria,'Times New Roman',serif;font-size:16px;font-weight:700}
.std-pdf{height:75vh;min-height:580px}
@media(max-width:900px){.std-without-review{grid-template-columns:1fr}}
</style>

<style scoped>
.std-source-selection{scroll-margin-top:24px}.std-source-selection a{display:inline-block;margin-left:8px}.std-reference-label{display:block;margin-bottom:5px;color:#866029}.std-eq-jump[aria-pressed="true"]{background:#e7edf5;outline:2px solid #24395d}.std-equation span{overflow-wrap:anywhere}@media(max-width:700px){.std-equation{grid-template-columns:80px minmax(0,1fr)}.std-equation span{grid-column:1 / -1}}
</style>
