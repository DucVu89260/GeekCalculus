<script setup>
import SectionPropertiesPanel from './SectionPropertiesPanel.vue'

const props = defineProps({ locale: { type: String, required: true }, asymmetricOnly: { type: Boolean, default: false } })
</script>

<template>
  <!-- Kept as an import-compatible facade; all calculations live in SectionPropertiesPanel. -->
  <SectionPropertiesPanel :locale="locale" :profile-id="asymmetricOnly ? 'asymmetric_i' : 'rectangle'" />
</template>
