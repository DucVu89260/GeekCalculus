<script setup>
import { computed, ref } from 'vue'
import data from '../../../../standards/qcvn02-2022-locations.json'
import { locationSnapshot, sourcePageUrl } from '../vietnam-location/lookup.js'
import { moduleHref } from '../modules'
import LocationHazardIllustration from './LocationHazardIllustration.vue'
import LocationCombobox from './LocationCombobox.vue'

const props = defineProps({ locale: { type: String, required: true } })
const words = {
  vi: {
    title: 'Tra cứu địa danh Việt Nam', subtitle: 'Gió và động đất · QCVN 02:2022/BXD', back: 'Về thư viện Loading',
    edition: 'Địa danh và phạm vi hành chính theo tài liệu năm 2022; chưa quy đổi sang địa danh sau sáp nhập.',
    province: 'Tỉnh / thành phố theo nguồn', chooseProvince: 'Chọn hoặc gõ tên tỉnh / thành phố…',
    noResults: 'Không tìm thấy tỉnh / thành phố phù hợp.',
    wind: 'Thông số gió', seismic: 'Thông số động đất', scope: 'Phạm vi gió trong Bảng 5.1', district: 'Địa danh trong Bảng 6.1 / 6.2',
    chooseScope: 'Chọn đúng phạm vi áp dụng…', chooseDistrict: 'Chọn quận / huyện / địa danh…', chooseFirst: 'Chọn hoặc gõ tên tỉnh / thành phố để bắt đầu.',
    windHint: 'Giữ nguyên các nhóm địa danh, xã và ngoại lệ của nguồn. Chọn phạm vi gió riêng; không tự ghép với địa danh động đất.',
    zone: 'Vùng gió', pressure: 'Áp lực gió W₀', v3: 'Vận tốc V₃s,50', v10: 'Vận tốc V₁₀m,50',
    wBasis: '3 giây · 20 năm · cao 10 m · địa hình B', v3Basis: '3 giây · 50 năm · cao 10 m · địa hình B',
    v10Basis: '10 phút · 50 năm · cao 10 m · địa hình B', agr: 'Đỉnh gia tốc nền tham chiếu aɡR', ss: 'Phổ gia tốc chu kỳ ngắn SS', s1: 'Phổ gia tốc chu kỳ dài S₁',
    agrBasis: 'Nền A · chu kỳ lặp 500 năm', ssBasis: 'T = 0,2 s · nền B · chu kỳ lặp 2.500 năm · cản 5%',
    s1Basis: 'T = 1 s · nền B · chu kỳ lặp 2.500 năm · cản 5%', gravity: 'g = 9,81 m/s². Các giá trị là số liệu tham chiếu, chưa nhân hệ số tầm quan trọng hoặc hệ số nền.',
    table: 'Bảng', printed: 'trang in', physical: 'trang PDF', missing: 'Chưa xác định đơn vị',
    vinh: 'Ô nguồn ghi “0,38” nhưng thiếu ký hiệu ×g. Giữ nguyên bản gốc, chưa gán giá trị có đơn vị cho SS.',
    tuSon: 'Nguồn dùng “Thành phố Từ Sơn” ở Bảng 6.1 và “Thị xã Từ Sơn” ở Bảng 6.2; giữ cả hai tên.',
    duyenHai: 'Bảng 6.2 dùng chung dòng “Thị xã, huyện Duyên Hải”; SS/S1 của dòng đó áp dụng cho cả hai địa danh được nêu.',
    phanRang: 'Khoảng trắng quanh dấu gạch trong tên Phan Rang–Tháp Chàm khác nhau giữa hai bảng; giữ tên gốc từng bảng.',
    spelling: 'Cách viết dấu hoặc khoảng trắng của địa danh khác nhau giữa hai bảng; tên gốc được giữ trong dữ liệu xuất.',
    export: 'Tải kết quả JSON', source: 'Nguồn và phạm vi', definitions: 'Định nghĩa trong tài liệu',
    sourceNote: 'Bảng 6.1, trang in 70 có tiêu đề đầu trang ghi “2020” trong chính PDF. Ấn bản của tài liệu là QCVN 02:2022/BXD.',
    count: '63 tỉnh/thành · 334 phạm vi gió · 705 địa danh động đất', raw: 'Nguồn ghi',
  },
  en: {
    title: 'Vietnam location lookup', subtitle: 'Wind and earthquake · QCVN 02:2022/BXD', back: 'Back to Loading Library',
    edition: 'Administrative names and coverage follow the 2022 source; later mergers have not been mapped.',
    province: 'Source province / municipality', chooseProvince: 'Choose or type a province / municipality…',
    noResults: 'No matching province / municipality.',
    wind: 'Wind parameters', seismic: 'Earthquake parameters', scope: 'Wind scope in Table 5.1', district: 'Location in Tables 6.1 / 6.2',
    chooseScope: 'Choose the applicable source scope…', chooseDistrict: 'Choose a district / source location…', chooseFirst: 'Choose or type a province / municipality to begin.',
    windHint: 'Source groups, communes and exceptions are retained. Select the wind scope separately; it is not automatically joined to the earthquake location.',
    zone: 'Wind zone', pressure: 'Wind pressure W₀', v3: 'Velocity V₃s,50', v10: 'Velocity V₁₀m,50',
    wBasis: '3 seconds · 20 years · 10 m height · terrain B', v3Basis: '3 seconds · 50 years · 10 m height · terrain B',
    v10Basis: '10 minutes · 50 years · 10 m height · terrain B', agr: 'Reference peak ground acceleration aɡR', ss: 'Short-period spectral acceleration SS', s1: 'Long-period spectral acceleration S₁',
    agrBasis: 'Ground A · 500-year return period', ssBasis: 'T = 0.2 s · ground B · 2,500-year return period · 5% damping',
    s1Basis: 'T = 1 s · ground B · 2,500-year return period · 5% damping', gravity: 'g = 9.81 m/s². Reference values have not been multiplied by importance or site factors.',
    table: 'Table', printed: 'printed page', physical: 'PDF page', missing: 'Unit unconfirmed',
    vinh: 'The source SS cell reads “0,38” without ×g. The original is retained; no unit-bearing SS value is assigned.',
    tuSon: 'Table 6.1 says “Thành phố Từ Sơn”; Table 6.2 says “Thị xã Từ Sơn”. Both source labels are retained.',
    duyenHai: 'Table 6.2 uses a shared “Thị xã, huyện Duyên Hải” row; its SS/S1 apply to both explicitly named locations.',
    phanRang: 'Spacing around the dash in Phan Rang–Tháp Chàm differs across the two tables; both source labels are retained.',
    spelling: 'Accent placement or spacing differs across the two tables; original labels are retained in the exported data.',
    export: 'Download JSON results', source: 'Source and coverage', definitions: 'Definitions in the source',
    sourceNote: 'Table 6.1, printed page 70, has a “2020” page header in the original PDF. The document edition is QCVN 02:2022/BXD.',
    count: '63 provinces/municipalities · 334 wind scopes · 705 earthquake locations', raw: 'Source text',
  },
}
const t = key => words[props.locale]?.[key] ?? words.en[key]
const provinceId = ref(''), windId = ref(''), seismicId = ref('')
const windRows = computed(() => data.wind.filter(row => row.province_id === provinceId.value))
const seismicRows = computed(() => data.seismic.filter(row => row.province_id === provinceId.value))
const wind = computed(() => data.wind.find(r => r.province_id === provinceId.value && r.id === windId.value))
const seismic = computed(() => data.seismic.find(r => r.province_id === provinceId.value && r.id === seismicId.value))
const pageLabel = s => `${t('table')} ${s.table} · ${t('printed')} ${s.printed_page} · ${t('physical')} ${s.pdf_page}`
const pageUrl = page => sourcePageUrl(data, page)
const number = value => new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
function changeProvince(id) {
  if (provinceId.value === id) return
  provinceId.value = id; windId.value = ''; seismicId.value = ''
}
function download() {
  const snapshot = locationSnapshot(data, { provinceId: provinceId.value, windId: windId.value, seismicId: seismicId.value })
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = `geekcalculus-vietnam-${provinceId.value}.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <section class="vn-lookup" :aria-label="t('title')">
    <header class="vn-header"><div><a :href="moduleHref('loads/library')">← {{ t('back') }}</a><h2>{{ t('title') }}</h2><p>{{ t('subtitle') }}</p><small>{{ t('count') }}</small></div><button type="button" class="quiet-button" :disabled="!wind && !seismic" @click="download">{{ t('export') }}</button></header>
    <p class="vn-edition" role="note">{{ t('edition') }}</p>
    <div class="vn-filters">
      <LocationCombobox id="vn-province" :model-value="provinceId" :options="data.provinces"
        :label="t('province')" :placeholder="t('chooseProvince')" :empty-message="t('noResults')"
        @update:model-value="changeProvince" />
    </div>
    <p v-if="!provinceId" class="vn-empty">{{ t('chooseFirst') }}</p>
    <div v-else class="vn-workspace">
      <section class="vn-section" :aria-label="t('wind')">
        <h3>{{ t('wind') }}</h3>
        <LocationHazardIllustration kind="wind" :locale="locale" />
        <label>{{ t('scope') }}<select v-model="windId" data-vn="wind"><option value="">{{ t('chooseScope') }}</option><option v-for="row in windRows" :key="row.id" :value="row.id">{{ row.location }}</option></select></label>
        <p class="vn-hint">{{ t('windHint') }}</p>
        <template v-if="wind"><p class="vn-scope">{{ wind.location }}</p><div class="vn-values">
          <article><h4>{{ t('zone') }}</h4><strong data-vn-value="zone">{{ wind.zone }}</strong></article>
          <article><h4>{{ t('pressure') }}</h4><strong data-vn-value="w0">{{ wind.w0_daN_m2 }} <small>daN/m²</small></strong><p>{{ t('wBasis') }}</p></article>
          <article><h4>{{ t('v3') }}</h4><strong data-vn-value="v3">{{ wind.v3s_50_m_s }} <small>m/s</small></strong><p>{{ t('v3Basis') }}</p></article>
          <article><h4>{{ t('v10') }}</h4><strong data-vn-value="v10">{{ wind.v10min_50_m_s }} <small>m/s</small></strong><p>{{ t('v10Basis') }}</p></article>
        </div><a class="vn-page-link" :href="pageUrl(wind.source.pdf_page)" target="_blank" rel="noopener noreferrer">{{ pageLabel(wind.source) }} ↗</a></template>
      </section>
      <section class="vn-section" :aria-label="t('seismic')">
        <h3>{{ t('seismic') }}</h3>
        <LocationHazardIllustration kind="seismic" :locale="locale" />
        <label>{{ t('district') }}<select v-model="seismicId" data-vn="seismic"><option value="">{{ t('chooseDistrict') }}</option><option v-for="row in seismicRows" :key="row.id" :value="row.id">{{ row.location }}</option></select></label>
        <template v-if="seismic"><p class="vn-scope">{{ seismic.location }}</p><div class="vn-values">
          <article v-for="parameter in ['agr', 'ss', 's1']" :key="parameter"><h4>{{ t(parameter) }}</h4><strong :data-vn-value="parameter">{{ seismic[parameter].value_g === null ? t('missing') : number(seismic[parameter].value_g) }} <small v-if="seismic[parameter].value_g !== null">g</small></strong><p>{{ t(parameter + 'Basis') }}</p><a class="vn-page-link" :href="pageUrl(seismic[parameter].source.pdf_page)" target="_blank" rel="noopener noreferrer">{{ pageLabel(seismic[parameter].source) }} ↗</a><p v-if="seismic[parameter].status === 'source_unit_missing'" class="vn-note">{{ t('vinh') }}</p></article>
        </div><p class="vn-hint">{{ t('gravity') }}</p><p v-for="note in seismic.notes" :key="note" class="vn-note">{{ t({ tu_son_labels_differ: 'tuSon', duyen_hai_shared_spectral_scope: 'duyenHai', phan_rang_spacing_differs: 'phanRang', source_label_spelling_differs: 'spelling' }[note]) }}</p></template>
      </section>
    </div>
    <details class="vn-source"><summary>{{ t('source') }}</summary><p><strong>{{ data.source.title }}</strong> · PDF {{ data.source.pdf_pages }} pages</p><p>{{ t('sourceNote') }}</p><p>{{ t('definitions') }}: <a :href="pageUrl(39)" target="_blank" rel="noopener noreferrer">5.2–5.4</a> · <a :href="pageUrl(66)" target="_blank" rel="noopener noreferrer">6.1–6.2</a></p><p>SHA-256: <code>{{ data.source.sha256 }}</code></p></details>
  </section>
</template>

<style scoped>
.vn-lookup { color: var(--ink, #23395d); }
.vn-header { display:flex; justify-content:space-between; align-items:start; gap:18px; flex-wrap:wrap; }.vn-header h2{margin:14px 0 8px;font-size:26px}.vn-header p{margin:0 0 8px}.vn-header small{color:var(--muted-ink,#567087)}
.vn-lookup a { color:#305c80; text-underline-offset:3px; }.vn-lookup a:hover{color:#142b48}
.vn-edition{padding:14px 16px;border-left:4px solid #58788d;background:#eaf0f3;border-radius:6px;line-height:1.7}
.vn-filters{max-width:620px;margin:24px 0}.vn-lookup label{display:flex;flex-direction:column;gap:9px;font-weight:650;min-width:0}.vn-lookup select,.vn-lookup input{width:100%;min-width:0;padding:12px;border:1px solid #23395d;border-radius:8px;background:#fffefa;color:#23395d;font:inherit;font-weight:400}
.vn-workspace{display:grid;grid-template-columns:1fr 1fr;gap:20px}.vn-section{min-width:0;padding:20px;background:var(--surface-bg,#f4f1ea);border:1px solid var(--surface-border,#c6d0d8);border-radius:12px}.vn-section h3{margin:0 0 18px;font-size:21px}
.vn-scope{background:#fffefa;border:1px solid #d4dce1;border-radius:7px;padding:12px;line-height:1.7;overflow-wrap:anywhere}.vn-hint,.vn-values p{line-height:1.65;font-size:14px;color:var(--muted-ink,#53677b)}
.vn-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.vn-values article{background:#fffefa;border:1px solid #d2dbe0;border-radius:9px;padding:16px;min-width:0}.vn-values h4{margin:0 0 12px;font-size:15px;font-weight:600}.vn-values strong{display:block;font-size:26px;overflow-wrap:anywhere}.vn-values strong small{font-size:16px;font-weight:500}.vn-values p{margin:12px 0 0}.vn-page-link{display:inline-block;margin-top:12px;font-size:13px;line-height:1.7}.vn-note{padding:12px;border:1px solid #dac796;background:#fff8e8;border-radius:8px;line-height:1.7;font-size:14px}
.vn-empty{padding:30px;text-align:center;color:var(--muted-ink,#53677b)}.vn-source{margin-top:24px;padding:16px;border:1px solid #bac9d4;border-radius:8px;background:#fffefa}.vn-source summary{font-weight:650;cursor:pointer}.vn-source p{line-height:1.7;font-size:14px}.vn-source code{overflow-wrap:anywhere}
@media(max-width:1000px){.vn-workspace{grid-template-columns:1fr}}@media(max-width:600px){.vn-section{padding:14px}.vn-values{grid-template-columns:1fr}.vn-header h2{font-size:23px}.vn-header .quiet-button{width:100%}}
</style>
