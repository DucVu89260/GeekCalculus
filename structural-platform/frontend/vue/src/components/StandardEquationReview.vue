<script setup>
import { computed, ref, watch } from 'vue'
import { request } from '../api'
import { renderStandardMath } from '../standards-math.js'
import StandardEquation from './StandardEquation.vue'

const props = defineProps({ code: String, equation: Object, documents: Array, locale: { type: String, default: 'vi' } })
const emit = defineEmits(['saved', 'close'])
const draft = ref({})
const baseline = ref('')
const notes = ref('')
const compared = ref(false)
const busy = ref(false)
const error = ref('')
const history = ref([])
const vi = computed(() => props.locale === 'vi')
function json(value, fallback = []) {
  if (typeof value === 'string') { try { return JSON.parse(value) } catch { return fallback } }
  return value ?? fallback
}
watch(() => [props.code, props.equation], () => {
  const e = props.equation
  draft.value = { latex: e.latex || '', variables: JSON.stringify(json(e.variables), null, 2),
    conditions: JSON.stringify(json(e.conditions), null, 2), asd_lrfd_factors: JSON.stringify(json(e.asd_lrfd_factors), null, 2),
    dependencies: JSON.stringify(json(e.dependencies), null, 2), design_method: e.design_method || '',
    implementation_key: e.implementation_key || '', source_notes: e.source_notes || '' }
  baseline.value = JSON.stringify(draft.value)
  compared.value = false; notes.value = ''; error.value = ''; history.value = []
}, { immediate: true })
watch(draft, () => { compared.value = false }, { deep: true })
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value)
const editable = computed(() => ['candidate', 'needs_review', 'index_only'].includes(props.equation.verification_status))
const document = computed(() => props.documents?.find(d => d.id === props.equation.document_id && d.sha256 === props.equation.source_sha256))
const fileUrl = computed(() => document.value && props.equation.pdf_page ? `/api/v1/standards/${encodeURIComponent(props.code)}/documents/${document.value.id}/file#page=${props.equation.pdf_page}` : '')
const preview = computed(() => ({ ...props.equation, latex: draft.value.latex,
  variables: json(draft.value.variables), conditions: json(draft.value.conditions),
  asd_lrfd_factors: json(draft.value.asd_lrfd_factors), dependencies: json(draft.value.dependencies),
  design_method: draft.value.design_method,
  design_methods: draft.value.design_method === 'both' ? ['ASD', 'LRFD'] : draft.value.design_method ? [draft.value.design_method] : [],
  verification_status: 'needs_review' }))
const canApprove = computed(() => !dirty.value && compared.value && fileUrl.value && renderStandardMath(draft.value.latex).usable)
const base = computed(() => `/api/v1/admin/standards/${encodeURIComponent(props.code)}/equations/${props.equation.id}`)
async function save() {
  error.value = ''; busy.value = true
  const code = props.code, id = props.equation.id
  try {
    const data = { ...draft.value, design_method: draft.value.design_method || null, implementation_key: draft.value.implementation_key || null }
    for (const field of ['variables', 'conditions', 'asd_lrfd_factors', 'dependencies']) {
      data[field] = JSON.parse(draft.value[field])
      if (!Array.isArray(data[field])) throw new Error(`${field}: JSON array required`)
    }
    const result = await request(base.value, { method: 'PATCH', body: JSON.stringify({ data, notes: notes.value, expected_version: props.equation.record_version }) })
    if (code === props.code && id === props.equation.id) emit('saved', result.data)
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}
async function transition(status) {
  error.value = ''; busy.value = true
  const code = props.code, id = props.equation.id, version = props.equation.record_version, endpoint = base.value
  try {
    const bytes = new TextEncoder().encode(draft.value.latex.trim())
    const latexHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
    const result = await request(`${endpoint}/review`, { method: 'POST', body: JSON.stringify({
      status, notes: notes.value, expected_version: version,
      source_comparison: { compared: compared.value, document_id: props.equation.document_id,
        source_sha256: props.equation.source_sha256, pdf_page: props.equation.pdf_page, latex_sha256: latexHash },
    }) })
    if (code === props.code && id === props.equation.id) emit('saved', result.data)
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}
async function loadHistory() {
  error.value = ''; const endpoint = base.value
  try {
    const result = await request(`${endpoint}/history`)
    if (endpoint === base.value) history.value = result.data
  } catch (e) { error.value = e.message }
}
</script>

<template>
  <section class="formula-review" :aria-label="vi ? 'Duyệt công thức' : 'Equation review'">
    <header><h3>{{ vi ? 'Duyệt công thức' : 'Equation review' }} · {{ equation.label }} · v{{ equation.record_version }}</h3><button type="button" :disabled="busy" @click="emit('close')">{{ vi ? 'Đóng' : 'Close' }}</button></header>
    <p>{{ equation.verification_status }} · {{ equation.clause_code }} · PDF p. {{ equation.pdf_page }} · {{ equation.printed_page_label }}</p>
    <p class="source-hash">SHA-256: {{ equation.source_sha256 || '—' }}</p>
    <a v-if="fileUrl" :href="fileUrl" target="_blank" rel="noopener">{{ vi ? 'Đối chiếu đúng trang PDF gốc' : 'Compare with exact original PDF page' }}</a>
    <p v-else role="note">{{ vi ? 'Chưa có nguồn khớp để duyệt.' : 'No matching source is available for approval.' }}</p>
    <form @submit.prevent="save">
      <fieldset :disabled="busy || !editable">
        <label>LaTeX<textarea v-model="draft.latex" rows="4" maxlength="20000" /></label>
        <label>{{ vi ? 'Biến và đơn vị (JSON)' : 'Variables and units (JSON)' }}<textarea v-model="draft.variables" rows="5" /></label>
        <small>[{"symbol":"…", "definition":"…", "unit":"…"}]</small>
        <label>{{ vi ? 'Điều kiện / giới hạn (JSON)' : 'Conditions / limits (JSON)' }}<textarea v-model="draft.conditions" rows="3" /></label>
        <label>{{ vi ? 'Hệ số ASD/LRFD (JSON; [] nếu không áp dụng)' : 'ASD/LRFD factors (JSON; [] if inapplicable)' }}<textarea v-model="draft.asd_lrfd_factors" rows="3" /></label>
        <label>{{ vi ? 'Điều khoản / phương trình tham chiếu (JSON)' : 'Referenced clauses / equations (JSON)' }}<textarea v-model="draft.dependencies" rows="2" /></label>
        <label>{{ vi ? 'Phương pháp' : 'Method' }}<select v-model="draft.design_method"><option value="">—</option><option value="both">ASD + LRFD</option><option>ASD</option><option>LRFD</option></select></label>
        <label>{{ vi ? 'Khóa triển khai' : 'Implementation key' }}<input v-model="draft.implementation_key" maxlength="160" /></label>
        <label>{{ vi ? 'Ghi chú nguồn' : 'Source notes' }}<textarea v-model="draft.source_notes" rows="2" /></label>
      </fieldset>
      <p v-if="dirty" role="status">{{ vi ? 'Lưu bản nháp trước, rồi đối chiếu lại nguồn để duyệt.' : 'Save the draft, then compare the saved version with the source before approval.' }}</p>
      <StandardEquation :equation="preview" :locale="locale" />
      <label>{{ vi ? 'Lý do / bằng chứng rà soát' : 'Review reason / evidence' }}<textarea v-model="notes" :disabled="busy" rows="3" maxlength="5000" required /></label>
      <label class="comparison"><input v-model="compared" type="checkbox" :disabled="busy || dirty || !fileUrl" />{{ vi ? 'Tôi đã đối chiếu biểu thức, biến, đơn vị và điều kiện của phiên bản này với trang PDF nguồn.' : 'I compared this version’s expression, variables, units and conditions with the source PDF page.' }}</label>
      <div class="actions">
        <button v-if="editable" type="submit" :disabled="busy || !dirty || !notes.trim()">{{ vi ? 'Lưu bản nháp' : 'Save draft' }}</button>
        <button v-if="['candidate', 'index_only'].includes(equation.verification_status)" type="button" :disabled="busy || dirty" @click="transition('needs_review')">Needs review</button>
        <button v-if="equation.verification_status === 'needs_review'" type="button" :disabled="busy || !canApprove || notes.trim().length < 10" @click="transition('verified')">{{ vi ? 'Xác minh với nguồn' : 'Verify against source' }}</button>
        <button v-if="equation.verification_status === 'verified'" type="button" :disabled="busy || !canApprove || notes.trim().length < 10" @click="transition('published')">{{ vi ? 'Phát hành' : 'Publish' }}</button>
        <button type="button" :disabled="busy" @click="loadHistory">{{ vi ? 'Lịch sử duyệt' : 'Review history' }}</button>
      </div>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <ol><li v-for="event in history" :key="event.id">{{ event.created_at }} · {{ event.reviewer_name || 'Import' }} · {{ event.from_status }} → {{ event.to_status }}<p>{{ event.notes }}</p></li></ol>
  </section>
</template>

<style scoped>
.formula-review{margin-top:16px;padding:16px;border:2px solid #afc3d3;border-radius:8px;background:#f8fbfd;min-width:0}.formula-review header,.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}.formula-review h3{margin:0}.formula-review label{display:grid;gap:6px;margin:12px 0}.formula-review textarea,.formula-review input,.formula-review select{box-sizing:border-box;width:100%;font:inherit;padding:8px;border:1px solid #9caec0;border-radius:5px;background:white;color:#18354e}.formula-review textarea{font-family:monospace;resize:vertical}.formula-review fieldset{border:0;padding:0;min-width:0}.formula-review .comparison{display:flex;align-items:flex-start}.comparison input{width:auto;margin-top:4px}.source-hash{overflow-wrap:anywhere;font-size:12px}.actions{justify-content:flex-start}.formula-review button{padding:8px;border-radius:5px;border:1px solid #9caec0;background:#edf3f7;color:#18354e;cursor:pointer}.formula-review button:disabled{opacity:.5;cursor:default}[role=alert]{color:#8a2f20}
</style>
