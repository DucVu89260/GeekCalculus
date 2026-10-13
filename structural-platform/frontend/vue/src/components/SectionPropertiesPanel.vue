<script setup>
import { ref } from 'vue'
import GeometryWorkbench from './GeometryWorkbench.vue'
import SectionPropertiesView from './SectionPropertiesView.vue'

defineProps({ locale: { type: String, required: true }, asymmetricOnly: { type: Boolean, default: false } })
const advancedOpen = ref(false)
</script>

<template>
  <div class="section-properties-panel">
    <GeometryWorkbench :locale="locale" />
    <details class="section-properties-advanced" @toggle="advancedOpen = $event.target.open">
      <summary>{{ locale === 'vi' ? 'I/H bất đối xứng và đặc trưng nâng cao' : 'Asymmetric I/H and advanced properties' }}</summary>
      <SectionPropertiesView v-if="advancedOpen" :locale="locale" :asymmetric-only="asymmetricOnly" />
    </details>
  </div>
</template>

<style scoped>
.section-properties-panel { display: grid; gap: 16px; min-width: 0; }
.section-properties-advanced { border: 1px solid var(--surface-border); background: var(--surface-bg); border-radius: 12px; padding: 18px; min-width: 0; }
.section-properties-advanced summary { color: var(--muted-ink); cursor: pointer; font-size: 17px; font-weight: 650; }
.section-properties-advanced summary:focus-visible { outline: 3px solid #8bb6df; outline-offset: 4px; }
.section-properties-advanced[open] summary { margin-bottom: 20px; }
@media (max-width: 600px) { .section-properties-advanced { padding: 14px 10px; } }
</style>
