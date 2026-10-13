<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import DesignCodeIcon from './DesignCodeIcon.vue'

const props = defineProps({
  options: { type: Array, default: () => [] },
  locale: { type: String, default: 'en' },
  placeholder: { type: String, default: 'Select a design code' },
  placeholderValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const model = defineModel({ type: String, default: '' })

const baseId = useId()
const root = ref(null)
const trigger = ref(null)
const listbox = ref(null)
const isOpen = ref(false)
const activeIndex = ref(0)
const popupStyle = ref({})
const listboxId = `${baseId}-listbox`
const triggerId = `${baseId}-trigger`

const items = computed(() => {
  const options = props.options.filter((option) => option?.code && String(option.code) !== props.placeholderValue)
  const currentValue = String(model.value ?? '')
  if (currentValue && currentValue !== props.placeholderValue && !options.some((option) => String(option.code) === currentValue)) {
    options.push({ code: currentValue, name_vi: currentValue, name_en: currentValue })
  }
  return [
    { code: props.placeholderValue, name_vi: props.placeholder, name_en: props.placeholder, placeholder: true },
    ...options,
  ]
})
const selectedIndex = computed(() => {
  const selected = items.value.findIndex((item) => String(item.code) === String(model.value ?? ''))
  return selected >= 0 ? selected : 0
})
const selectedItem = computed(() => items.value[selectedIndex.value] ?? items.value[0])

function optionName(item) {
  if (!item) return props.placeholder
  if (item.placeholder) return props.placeholder
  return props.locale === 'vi'
    ? item.name_vi || item.name_en || item.code
    : item.name_en || item.name_vi || item.code
}

function optionCode(item) {
  return item?.placeholder ? '' : String(item?.code ?? '')
}

function optionDetail(item) {
  if (!item || item.placeholder) return ''
  const name = optionName(item)
  return name && name !== item.code ? name : ''
}

function optionId(index) {
  return `${baseId}-option-${index}`
}

function updatePopupPosition() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const width = Math.min(Math.max(rect.width, 190), Math.max(160, viewportWidth - 24))
  const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12))
  const below = Math.max(0, viewportHeight - rect.bottom - 12)
  const above = Math.max(0, rect.top - 12)
  const placeBelow = below >= Math.min(240, above) || below >= above
  const available = placeBelow ? below : above
  const maxHeight = Math.max(80, Math.min(260, available))
  const top = placeBelow ? Math.min(viewportHeight - maxHeight - 8, rect.bottom + 5) : Math.max(8, rect.top - maxHeight - 5)
  popupStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${maxHeight}px` }
}

function scrollActiveIntoView() {
  const option = listbox.value?.querySelector(`[data-index="${activeIndex.value}"]`)
  option?.scrollIntoView?.({ block: 'nearest' })
}

async function openMenu(index = selectedIndex.value) {
  if (props.disabled) return
  activeIndex.value = Math.max(0, Math.min(index, items.value.length - 1))
  updatePopupPosition()
  isOpen.value = true
  await nextTick()
  updatePopupPosition()
  scrollActiveIntoView()
}

function closeMenu({ restoreFocus = false } = {}) {
  isOpen.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function choose(item) {
  if (!item || props.disabled) return
  model.value = String(item.code ?? '')
  closeMenu({ restoreFocus: true })
}

function stepActive(delta) {
  const last = items.value.length - 1
  activeIndex.value = (activeIndex.value + delta + items.value.length) % items.value.length
  nextTick(scrollActiveIntoView)
}

function onKeydown(event) {
  if (props.disabled) return
  if (event.key === 'Tab') {
    closeMenu()
    return
  }
  if (event.key === 'Escape') {
    if (isOpen.value) {
      event.preventDefault()
      closeMenu({ restoreFocus: true })
    }
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) openMenu(selectedIndex.value)
    else stepActive(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    if (!isOpen.value) openMenu(event.key === 'Home' ? 0 : items.value.length - 1)
    else {
      activeIndex.value = event.key === 'Home' ? 0 : items.value.length - 1
      nextTick(scrollActiveIntoView)
    }
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!isOpen.value) openMenu(selectedIndex.value)
    else choose(items.value[activeIndex.value])
  }
}

function onOutsidePointer(event) {
  if (root.value?.contains(event.target) || listbox.value?.contains(event.target)) return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer)
  window.addEventListener('resize', updatePopupPosition)
  window.addEventListener('scroll', updatePopupPosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  window.removeEventListener('resize', updatePopupPosition)
  window.removeEventListener('scroll', updatePopupPosition, true)
})
</script>

<template>
  <div ref="root" class="design-code-select">
    <button
      :id="triggerId"
      ref="trigger"
      type="button"
      class="design-code-select-trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="listboxId"
      :aria-activedescendant="isOpen ? optionId(activeIndex) : undefined"
      :data-value="String(model ?? '')"
      :disabled="disabled"
      @click="isOpen ? closeMenu() : openMenu()"
      @keydown="onKeydown"
    >
      <span class="design-code-select-value">
        <span v-if="optionCode(selectedItem)" class="design-code-select-icon" aria-hidden="true"><DesignCodeIcon :code="optionCode(selectedItem)" /></span>
        <span class="design-code-select-label">{{ optionCode(selectedItem) || optionName(selectedItem) }}</span>
        <small v-if="optionDetail(selectedItem)" class="design-code-select-detail">{{ optionDetail(selectedItem) }}</small>
      </span>
      <span class="design-code-select-chevron" aria-hidden="true">⌄</span>
    </button>

    <Teleport to="body">
      <div
        :id="listboxId"
        ref="listbox"
        class="design-code-select-listbox"
        role="listbox"
        :aria-labelledby="triggerId"
        :style="popupStyle"
        v-show="isOpen"
      >
        <div
          v-for="(item, index) in items"
          :id="optionId(index)"
          :key="String(item.code) || 'placeholder'"
          class="design-code-select-option"
          :class="{ active: index === activeIndex, selected: String(item.code) === String(model ?? '') }"
          role="option"
          :aria-selected="String(item.code) === String(model ?? '')"
          :data-value="String(item.code ?? '')"
          :data-index="index"
          @pointerenter="activeIndex = index"
          @mousedown.prevent
          @click="choose(item)"
        >
          <span v-if="optionCode(item)" class="design-code-select-icon" aria-hidden="true"><DesignCodeIcon :code="optionCode(item)" /></span>
          <span class="design-code-select-label">{{ optionCode(item) || optionName(item) }}</span>
          <small v-if="optionDetail(item)" class="design-code-select-detail">{{ optionDetail(item) }}</small>
          <span v-if="String(item.code) === String(model ?? '')" class="design-code-select-check" aria-hidden="true">✓</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.design-code-select { position: relative; width: 100%; min-width: 0; }
.design-code-select-trigger { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 36px; padding: 7px 10px; border: 1px solid #d2dfeb; border-radius: 7px; background: #fff; color: #2e4964; font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
.design-code-select-trigger:hover:not(:disabled) { border-color: #8eaecb; background: #f9fcff; }
.design-code-select-trigger:focus-visible { outline: 3px solid #a8c7e2; outline-offset: 2px; }
.design-code-select-trigger:disabled { cursor: not-allowed; opacity: .6; }
.design-code-select-value { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; }
.design-code-select-icon { display: inline-flex; flex: 0 0 22px; align-items: center; justify-content: center; width: 22px; height: 16px; overflow: hidden; border: 1px solid #dce4ec; border-radius: 2px; background: #fff; }
.design-code-select-icon :deep(svg) { display: block; width: 100%; height: 100%; }
.design-code-select-label { overflow: hidden; color: inherit; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.design-code-select-detail { overflow: hidden; color: #8798a8; font-size: 9px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.design-code-select-chevron { flex: 0 0 auto; color: #7790a7; font-size: 15px; line-height: 1; }
.design-code-select-listbox { position: fixed; z-index: 1000; padding: 5px; overflow-y: auto; border: 1px solid #cfddea; border-radius: 9px; background: #fff; box-shadow: 0 12px 32px #1d395425; overscroll-behavior: contain; }
.design-code-select-option { display: flex; align-items: center; gap: 9px; min-height: 37px; padding: 8px 9px; border-radius: 6px; color: #2e4964; font-size: 11px; cursor: pointer; }
.design-code-select-option:hover, .design-code-select-option.active { background: #23395d; color: #fff; }
.design-code-select-option.selected { font-weight: 700; }
.design-code-select-option .design-code-select-detail { margin-left: auto; }
.design-code-select-check { margin-left: auto; color: #4a8a68; font-size: 12px; }
.design-code-select-option.active .design-code-select-check { color: #fff; }
@media (max-width: 520px) { .design-code-select-option { min-height: 43px; padding: 10px; } }
</style>
