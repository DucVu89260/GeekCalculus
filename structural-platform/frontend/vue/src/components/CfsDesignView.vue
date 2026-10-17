<script setup>
import { moduleHref } from '../modules'

const props = defineProps({ locale: { type: String, required: true }, showAddIn: Boolean })
const words = {
  vi: {
    title: 'Chọn module CFS', description: 'Các công cụ thiết kế thép tạo hình nguội.',
    addIn: 'CFS Lapping and Node Add-in', detail: 'Nối chồng xà gồ Z và nút liên kết',
    pending: 'Đang chờ tích hợp', back: 'Quay lại CFS Design',
    note: 'Module chưa được kết nối với package tính toán. Chức năng tính toán và chạy add-in chưa khả dụng.',
    illustration: 'Minh họa hai tiết diện Z nối chồng bằng bu lông',
  },
  en: {
    title: 'Choose a CFS module', description: 'Cold-formed steel design tools.',
    addIn: 'CFS Lapping and Node Add-in', detail: 'Z-purlin lapping and connection nodes',
    pending: 'Awaiting integration', back: 'Back to CFS Design',
    note: 'This module is not connected to the calculation package yet. Calculation and add-in execution are not available.',
    illustration: 'Illustration of two Z sections joined by a bolted lap',
  },
}
const t = key => words[props.locale]?.[key] ?? words.en[key] ?? key
</script>

<template>
  <section class="cfs-design" :aria-label="showAddIn ? t('addIn') : 'CFS Design'">
    <template v-if="!showAddIn">
      <header class="cfs-heading"><h2>{{ t('title') }}</h2><p>{{ t('description') }}</p></header>
      <div class="cfs-grid">
        <a class="cfs-card" :href="moduleHref('steel/cfs/lapping-node')">
          <svg class="cfs-illustration" viewBox="0 0 180 130" role="img" :aria-label="t('illustration')">
            <rect width="180" height="130" rx="10" fill="#f1ede6" />
            <g fill="none" stroke-linejoin="round" stroke-width="7">
              <path d="M25 28H75V97H121" stroke="#355e86" />
              <path d="M57 35H105V104H155" stroke="#80a4bd" />
            </g>
            <g fill="#fffefb" stroke="#23395d" stroke-width="2"><circle cx="88" cy="52" r="4"/><circle cx="88" cy="72" r="4"/><circle cx="88" cy="92" r="4"/></g>
            <path d="M21 116H159" stroke="#b6c3cc" stroke-dasharray="4 4" />
          </svg>
          <span class="cfs-card-copy"><strong>{{ t('addIn') }}</strong><span>{{ t('detail') }}</span><small>{{ t('pending') }}</small></span>
          <span class="cfs-arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </template>
    <section v-else class="cfs-add-in" aria-labelledby="cfs-add-in-title">
      <a class="cfs-back" :href="moduleHref('steel/cfs')">← {{ t('back') }}</a>
      <h2 id="cfs-add-in-title">{{ t('addIn') }}</h2>
      <p>{{ t('detail') }}</p>
      <span class="cfs-status">{{ t('pending') }}</span>
      <p role="status">{{ t('note') }}</p>
    </section>
  </section>
</template>

<style scoped>
.cfs-design{padding:22px;border:1px solid var(--surface-border);border-radius:12px;background:var(--surface-bg);color:#23395d}
.cfs-heading h2,.cfs-add-in h2{font-size:23px}.cfs-heading p,.cfs-add-in p{color:var(--muted-ink);font-size:16px;line-height:1.7}
.cfs-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}
.cfs-card{position:relative;display:flex;align-items:center;gap:18px;min-width:0;min-height:164px;padding:20px;border:1px solid #23395d;border-radius:12px;background:var(--workspace-bg);color:#23395d;text-decoration:none;transition:background .16s,color .16s,box-shadow .16s,transform .16s}
.cfs-card:hover,.cfs-card:focus-visible{background:#23395d;color:#fff;box-shadow:0 6px 18px #23395d26;transform:translateY(-2px)}
.cfs-card:focus-visible{outline:3px solid #8bb6df;outline-offset:3px}.cfs-illustration{width:120px;flex:0 0 120px;border-radius:10px}
.cfs-card-copy{display:flex;flex-direction:column;gap:8px;min-width:0}.cfs-card-copy strong{font-size:18px}.cfs-card-copy>span{font-size:15px;line-height:1.5}.cfs-card-copy small{font-size:13px;opacity:.8}.cfs-arrow{position:absolute;top:8px;right:12px;font-size:20px}
.cfs-back{display:inline-block;margin-bottom:20px;font-size:16px}.cfs-add-in h2{margin:0}.cfs-status{display:inline-block;padding:4px 10px;border:1px solid #c7d3e0;border-radius:20px;background:var(--navigation-bg);color:#365579;font-size:14px}
@media(max-width:1000px){.cfs-grid{grid-template-columns:1fr}}
@media(max-width:600px){.cfs-design{padding:16px 12px}.cfs-card{gap:12px;padding:16px 12px}.cfs-illustration{width:88px;flex-basis:88px}.cfs-card-copy strong{font-size:17px}}
@media(prefers-reduced-motion:reduce){.cfs-card{transition:none;transform:none}}
</style>
