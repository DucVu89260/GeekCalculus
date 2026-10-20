<script setup>
import { computed, ref } from 'vue'
import LibraryBrowser from './LibraryBrowser.vue'
import DesignStandardsLibrary from './DesignStandardsLibrary.vue'

const props = defineProps({ locale: { type: String, required: true } })
const active = ref('')
const words = computed(() => props.locale === 'vi' ? {
  title: 'Danh mục thư viện', materials: 'Vật liệu', section_types: 'Loại tiết diện', sections: 'Tiết diện',
  standards: 'Tiêu chuẩn thiết kế', choose: 'Chọn một mục thư viện để xem nội dung.',
} : {
  title: 'Library categories', materials: 'Material', section_types: 'Section types', sections: 'Sections',
  standards: 'Design standard', choose: 'Choose a library category to view its content.',
})
const categories = ['materials', 'section_types', 'sections', 'standards']
</script>

<template>
  <section class="steel-library" :aria-label="words.title">
    <div class="steel-library-menu" role="group" :aria-label="words.title">
      <button v-for="category in categories" :key="category" type="button" :data-library-category="category"
        :aria-pressed="active === category" @click="active = category">{{ words[category] }}</button>
    </div>
    <p v-if="!active" class="steel-library-empty">{{ words.choose }}</p>
    <DesignStandardsLibrary v-else-if="active === 'standards'" :locale="locale" />
    <LibraryBrowser v-else :key="active" :locale="locale" :initial-resource="active" :show-tabs="false" :can-edit="false" />
  </section>
</template>

<style scoped>
.steel-library-menu { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:24px; }
.steel-library-menu button { min-height:54px; padding:12px 16px; border:1px solid #23395d; border-radius:8px; background:#fffefa; color:#23395d; font:inherit; font-weight:650; line-height:1.5; cursor:pointer; transition:background .15s,color .15s; }
.steel-library-menu button:hover,.steel-library-menu button[aria-pressed="true"],.steel-library-menu button:focus-visible { background:#23395d; color:white; }
.steel-library-menu button:focus-visible { outline:2px solid #648ba6; outline-offset:3px; }
.steel-library-empty { padding:28px 16px; margin:0; border:1px dashed #b6c5d1; border-radius:10px; text-align:center; color:var(--muted-ink,#53677b); line-height:1.7; }
@media(max-width:650px) { .steel-library-menu { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; } .steel-library-menu button { padding:12px 8px; } }
</style>
