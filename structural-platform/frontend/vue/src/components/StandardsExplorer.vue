<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { request } from '../api'

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
const viewTab = ref('outline')
const sectionFilter = ref('normative')
const current = computed(() => families.value.flatMap(f => f.editions.map(e => ({ ...e, family: f }))).find(e => e.code === selected.value))
const clauses = computed(() => (detail.value?.clauses || []).filter(c => (sectionFilter.value === 'all' || c.kind === sectionFilter.value) && (!search.value || [c.code,c.title,c.summary].join(' ').toLowerCase().includes(search.value.toLowerCase()))))
const pdfUrl = computed(() => {
  const doc = detail.value?.documents?.find(d => d.kind === 'specification')
  if (!doc || !selected.value) return ''
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
async function loadEdition() {
  detail.value = null; equations.value = []; error.value = ''
  if (!selected.value) return
  try {
    const [a,b] = await Promise.all([
      request('/api/v1/standards/'+encodeURIComponent(selected.value)),
      request('/api/v1/standards/'+encodeURIComponent(selected.value)+'/equations')
    ])
    detail.value = a.data; equations.value = b.data; activePage.value = null
  } catch(e) { error.value = e.message || 'Could not load edition.' }
}
function goTo(c) { if (c.pdf_page) activePage.value = c.pdf_page }
function goToEquation(eq) { if (eq.pdf_page) activePage.value = eq.pdf_page }
watch(selected,loadEdition)
onMounted(list)
</script>

<template>
  <div class="standards-panel">
    <header class="standards-header"><div><h2>{{ current?.title || 'Standards Explorer' }} <span class="std-heading-suffix">· Standards Explorer</span></h2><p>{{ locale === 'vi' ? 'Thư viện tiêu chuẩn kỹ thuật · dữ liệu từ database' : 'Engineering standards · database-backed' }}</p></div><button type="button" class="std-muted" @click="showReview=!showReview">{{ showReview ? 'Hide Review' : 'Show Review' }}</button></header>
    <p v-if="error" role="alert" class="std-error">{{ error }}</p>
    <p v-if="loading">Loading standards…</p>
    <div v-else class="std-families">
      <details v-for="family in families" :key="family.id" :open="family.code==='AISC360'">
        <summary><strong>{{ family.name }}</strong> <small>{{ family.publisher }}</small></summary>
        <div class="std-editions">
          <button v-for="edition in family.editions" :key="edition.id" type="button" :aria-pressed="selected===edition.code" @click="selected=edition.code">{{ edition.title }}</button>
        </div>
      </details>
    </div>
    <div v-if="detail" class="std-workspace">
      <div class="std-context"><strong>{{ current?.title }}</strong><span>{{ detail.clauses.length }} indexed clauses · {{ equations.length }} equation labels · {{ detail.documents.length }} private documents</span></div>
      <div class="std-reader-tabs">
        <button type="button" :aria-pressed="viewTab==='outline'" @click="viewTab='outline'">Document Outline</button>
        <button type="button" :aria-pressed="viewTab==='equations'" @click="viewTab='equations'">Equation Library</button>
        <button type="button" :aria-pressed="viewTab==='source'" @click="viewTab='source'">PDF Source</button>
      </div>
      <div class="std-three" :class="{ 'std-without-review': !showReview }">
        <aside class="std-outline"><label>Table of contents<input v-model="search" placeholder="Search clauses…" /></label><select v-model="sectionFilter" aria-label="Document section"><option value="normative">Specification</option><option value="commentary">Commentary</option><option value="all">All sections</option></select><button v-for="clause in clauses" :key="clause.id" class="std-clause" type="button" @click="goTo(clause)"><b>{{ clause.code }}</b><span>{{ clause.title }}</span><small>{{ clause.pdf_page ? 'PDF p. '+clause.pdf_page : clause.printed_page ? 'Printed p. '+clause.printed_page+' · PDF mapping pending' : 'No page mapped' }}</small></button><p v-if="!clauses.length">No matching clauses indexed yet.</p></aside>
        <section class="std-main">
          <h3>{{ viewTab === 'equations' ? 'Equation Library' : viewTab === 'source' ? 'PDF Source' : 'Equations & References' }}</h3>
          <p v-if="!equations.length && viewTab !== 'source'" class="std-empty">No equation expressions available in this database yet. Only engineering-verified formulas may be used in calculations.</p>
          <article v-for="eq in (viewTab === 'source' ? [] : equations)" :key="eq.id" class="std-equation"><button type="button" class="std-eq-jump" :disabled="!eq.pdf_page" @click="goToEquation(eq)"><strong>{{ eq.label }}</strong></button><code>{{ eq.latex || 'Pending engineering review — no approved expression' }}</code><span>{{ eq.clause_code }} · {{ eq.verification_status }} · {{ eq.pdf_page ? 'PDF p. '+eq.pdf_page : 'Source unmapped' }}</span></article>
          <h3>PDF Preview</h3>
          <iframe v-if="pdfUrl" :key="pdfUrl" :src="pdfUrl" title="Private engineering standard PDF" class="std-pdf"></iframe>
          <p v-else class="std-empty">The private source PDF has not been imported by the backend administrator yet.</p>
        </section>
        <aside v-if="showReview" class="std-review"><h3>Source Review</h3><p>Equation candidates must be checked against the source PDF before use in design calculations.</p><p>Unverified catalog headings are navigation-only.</p><p>Documentation is available only to authenticated users.</p></aside>
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
.std-equation{grid-template-columns:100px minmax(0,1fr) auto;box-shadow:0 1px 2px rgba(31,52,79,.05)}
.std-equation code{font-family:Cambria,'Times New Roman',serif;font-size:16px;font-weight:700}
.std-pdf{height:75vh;min-height:580px}
@media(max-width:900px){.std-without-review{grid-template-columns:1fr}}
</style>