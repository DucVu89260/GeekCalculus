<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  clauses: { type: Array, default: () => [] },
  selectedId: { type: [Number, String], default: null },
  search: { type: String, default: '' },
  kind: { type: String, default: 'normative' },
  locale: { type: String, default: 'en' },
})
const emit = defineEmits(['select', 'update:search', 'update:kind'])

const expandedIds = ref(new Set())
const words = computed(() => props.locale === 'vi' ? {
  toc: 'Mục lục', search: 'Tìm số điều khoản hoặc tiêu đề…', filter: 'Lọc nội dung tiêu chuẩn',
  specification: 'Specification', commentary: 'Commentary', all: 'Tất cả phần',
  noMatches: 'Không tìm thấy điều khoản phù hợp.', pdf: 'PDF', printed: 'Trang in', noPage: 'Chưa ánh xạ trang nguồn', expand: 'Mở rộng', collapse: 'Thu gọn',
} : {
  toc: 'Table of contents', search: 'Search clause number or title…', filter: 'Filter document section',
  specification: 'Specification', commentary: 'Commentary', all: 'All sections',
  noMatches: 'No matching clauses found.', pdf: 'PDF', printed: 'Printed page', noPage: 'Source page not mapped', expand: 'Expand', collapse: 'Collapse',
})

function sortClauses(rows) {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return [...rows].sort((a, b) => {
    const aPage = Number(a.pdf_page || a.printed_page || Number.MAX_SAFE_INTEGER)
    const bPage = Number(b.pdf_page || b.printed_page || Number.MAX_SAFE_INTEGER)
    return aPage - bPage || collator.compare(String(a.code || ''), String(b.code || ''))
  })
}

const roots = computed(() => {
  const rows = props.clauses || []
  const byId = new Map(rows.map(row => [String(row.id), { ...row, children: [] }]))
  const rootRows = []
  for (const row of rows) {
    const node = byId.get(String(row.id))
    const parentId = row.parent_id ?? row.parent_clause_id
    const parent = parentId == null ? null : byId.get(String(parentId))
    if (parent && parent !== node) parent.children.push(node)
    else rootRows.push(node)
  }
  const sortTree = nodes => {
    const ordered = sortClauses(nodes)
    ordered.forEach(node => { node.children = sortTree(node.children) })
    return ordered
  }
  return sortTree(rootRows)
})

const filteredRoots = computed(() => {
  const query = props.search.trim().toLocaleLowerCase()
  const kind = props.kind
  const filterTree = node => {
    const children = node.children.map(filterTree).filter(Boolean)
    const matchesKind = kind === 'all' || node.kind === kind
    const matchesText = !query || [node.code, node.title, node.summary].join(' ').toLocaleLowerCase().includes(query)
    if ((!matchesKind || !matchesText) && children.length === 0) return null
    return { ...node, children, activeMatch: matchesKind && matchesText }
  }
  return roots.value.map(filterTree).filter(Boolean)
})

const visibleNodes = computed(() => {
  const rows = []
  const forceExpand = props.search.trim().length > 0
  const walk = (node, depth) => {
    const id = String(node.id)
    const expanded = forceExpand || expandedIds.value.has(id)
    rows.push({ node, depth, expanded, hasChildren: node.children.length > 0 })
    if (expanded) node.children.forEach(child => walk(child, depth + 1))
  }
  filteredRoots.value.forEach(node => walk(node, 0))
  return rows
})

watch(() => props.clauses, clauses => {
  expandedIds.value = new Set((clauses || []).filter(row => row.parent_id == null).map(row => String(row.id)))
}, { immediate: true })

function toggle(id) {
  const next = new Set(expandedIds.value)
  const key = String(id)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedIds.value = next
}

function pageLabel(clause) {
  const physical = clause.pdf_page ? `${words.value.pdf} p. ${clause.pdf_page}` : ''
  const printed = clause.printed_page_label || (clause.printed_page ? `${words.value.printed} ${clause.printed_page}` : '')
  return [physical, printed].filter(Boolean).join(' · ') || words.value.noPage
}
</script>

<template>
  <aside class="std-outline" :aria-label="words.toc">
    <label class="std-toc-search">
      <span>{{ words.toc }}</span>
      <input :value="search" type="search" :placeholder="words.search" @input="emit('update:search', $event.target.value)" />
    </label>
    <label class="std-toc-filter">
      <span class="sr-only">{{ words.filter }}</span>
      <select :value="kind" :aria-label="words.filter" @change="emit('update:kind', $event.target.value)">
        <option value="normative">{{ words.specification }}</option>
        <option value="commentary">{{ words.commentary }}</option>
        <option value="all">{{ words.all }}</option>
      </select>
    </label>
    <nav class="std-toc-list" :aria-label="words.toc">
      <div v-for="row in visibleNodes" :key="row.node.id" class="std-toc-row" :style="{ '--toc-depth': row.depth }">
        <button v-if="row.hasChildren" type="button" class="std-toc-expand" :aria-label="(row.expanded ? words.collapse : words.expand) + ' ' + row.node.code" :aria-expanded="row.expanded" @click="toggle(row.node.id)">{{ row.expanded ? '▾' : '▸' }}</button>
        <span v-else class="std-toc-expander-spacer" aria-hidden="true"></span>
        <button type="button" class="std-clause" :class="{ active: String(selectedId) === String(row.node.id) }" :aria-current="String(selectedId) === String(row.node.id) ? 'location' : undefined" @click="emit('select', row.node)">
          <strong>{{ row.node.code }}</strong>
          <span class="std-clause-title">{{ row.node.title }}</span>
          <small>{{ pageLabel(row.node) }}</small>
        </button>
      </div>
      <p v-if="visibleNodes.length === 0" class="std-toc-empty">{{ words.noMatches }}</p>
    </nav>
  </aside>
</template>

<style scoped>
.std-outline{min-width:0;max-height:76vh;overflow:auto;padding:14px;border:1px solid #d6dfe7;border-radius:9px;background:#fff}.std-toc-search{display:grid;gap:7px;font-weight:700}.std-toc-search input,.std-toc-filter select{width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd6e4;border-radius:5px;background:#fff;color:#243a58}.std-toc-filter{display:block;margin:8px 0}.std-toc-list{display:grid;gap:2px}.std-toc-row{display:grid;grid-template-columns:24px minmax(0,1fr);gap:2px;align-items:start;padding-left:calc(var(--toc-depth)*13px)}.std-toc-expand{width:24px;height:34px;border:0;background:transparent;color:#47678b;cursor:pointer}.std-toc-expander-spacer{width:24px}.std-clause{display:grid;width:100%;min-width:0;gap:3px;padding:8px 6px;border:0;border-bottom:1px solid #edf0f4;background:transparent;color:#23395d;text-align:left;cursor:pointer}.std-clause:hover,.std-clause.active{background:#eaf0f7}.std-clause.active{box-shadow:inset 3px 0 #24395d}.std-clause-title{overflow-wrap:anywhere}.std-clause small{color:#6b7890}.std-toc-empty{padding:8px;color:#697990}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style>
