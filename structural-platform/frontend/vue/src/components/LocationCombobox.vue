<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { foldLocation } from '../vietnam-location/lookup.js'

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  placeholder: { type: String, required: true },
  emptyMessage: { type: String, required: true },
  options: { type: Array, required: true },
})
const model = defineModel({ type: String, default: '' })
const input = ref(null)
const list = ref(null)
const open = ref(false)
const text = ref('')
const query = ref('')
const active = ref(-1)
const selected = computed(() => props.options.find(option => option.id === model.value))
const matches = computed(() => {
  const tokens = foldLocation(query.value).split(' ').filter(Boolean)
  return props.options.filter(option => tokens.every(token => foldLocation(option.name).includes(token)))
})
watch(() => model.value, () => { text.value = selected.value?.name ?? '' }, { immediate: true })

function show() {
  if (open.value) return
  query.value = ''
  open.value = true
  active.value = matches.value.findIndex(option => option.id === model.value)
}
function close() {
  open.value = false
  text.value = selected.value?.name ?? ''
  query.value = ''
  active.value = -1
}
function filter(event) {
  text.value = event.target.value
  query.value = text.value
  open.value = true
  active.value = -1
  if (list.value) list.value.scrollTop = 0
}
function choose(option) {
  close()
  model.value = option.id
  text.value = option.name
  input.value?.focus()
}
function keydown(event) {
  if (event.isComposing) return
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    const option = matches.value[active.value < 0 ? 0 : active.value]
    if (option) choose(option)
  }
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    show()
    const last = matches.value.length - 1
    active.value = event.key === 'ArrowDown' ? Math.min(active.value + 1, last) : (active.value < 0 ? last : Math.max(0, active.value - 1))
    nextTick(() => list.value?.children[active.value]?.scrollIntoView({ block: 'nearest' }))
  }
}
</script>

<template>
  <div class="location-combobox" @focusout="event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }">
    <label :for="id">{{ label }}</label>
    <div class="location-input">
      <input :id="id" ref="input" :value="text" data-vn="province" role="combobox" autocomplete="off"
        :placeholder="placeholder" aria-autocomplete="list" aria-haspopup="listbox" :aria-expanded="open"
        :aria-controls="`${id}-options`" :aria-activedescendant="open && active >= 0 ? `${id}-option-${active}` : undefined"
        @focus="show" @click="event => { show(); if (!query) event.target.select() }" @input="filter" @keydown="keydown" />
      <span aria-hidden="true">⌄</span>
    </div>
    <div v-if="open" class="location-popup">
      <ul :id="`${id}-options`" ref="list" role="listbox" :aria-label="label">
        <li v-for="(option, index) in matches" :id="`${id}-option-${index}`" :key="option.id"
          role="option" :aria-selected="option.id === model" :data-value="option.id" :class="{ active: index === active }"
          @pointerdown.prevent @click="choose(option)">{{ option.name }}</li>
      </ul>
      <p v-if="!matches.length" role="status">{{ emptyMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.location-combobox { position:relative; min-width:0; }
.location-combobox label { display:block; margin-bottom:9px; font-weight:650; }
.location-input { position:relative; }
.location-input input { display:block; width:100%; padding:12px 38px 12px 12px; border:1px solid #23395d; border-radius:8px; background:#fffefa; color:#23395d; font:inherit; }
.location-input input:focus-visible { outline:2px solid #648ba6; outline-offset:2px; }
.location-input span { position:absolute; right:14px; top:50%; transform:translateY(-50%); pointer-events:none; color:#23395d; }
.location-popup { position:absolute; top:calc(100% + 5px); left:0; right:0; z-index:20; padding:5px; border:1px solid #23395d; border-radius:8px; background:#fffefa; box-shadow:0 8px 24px #23395d24; }
.location-popup ul { list-style:none; margin:0; padding:0; max-height:260px; overflow-y:auto; overscroll-behavior:contain; }
.location-popup li { padding:11px 12px; border-radius:5px; cursor:pointer; color:#23395d; line-height:1.5; overflow-wrap:anywhere; }
.location-popup li[aria-selected="true"] { background:#e5edf4; font-weight:650; }
.location-popup li:hover,.location-popup li.active { background:#23395d; color:#fff; }
.location-popup p { margin:0; padding:12px; color:#53677b; line-height:1.5; }
</style>
