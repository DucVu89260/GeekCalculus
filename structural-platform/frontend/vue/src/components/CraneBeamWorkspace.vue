<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CraneBeamView from './CraneBeamView.vue'
import { moduleHref } from '../modules'

const locale = defineModel('locale', { type: String, required: true })
const emit = defineEmits(['sign-out'])
const home = import.meta.env.BASE_URL
const hiHref = `${home}hi-doubly-symmetric-aisc360-10.html`
const activeSection = ref('crane-geometry')
const words = {
  en: { workspace: 'Workspace', dashboard: 'Dashboard', steel: 'Steel Design', component: 'Component', section: 'Section Properties', tools: 'Engineering Tools', material: 'Material Library', standards: 'Design Standards (Library)', contents: 'Contents', geometry: 'Section geometry', bearing: 'Wheel bearing', input: 'Input Parameters', properties: 'Section Properties', checks: 'Preliminary results', verification: 'Remaining checks', details: 'Calculation details', title: 'Crane Beam', subtitle: 'Asymmetric I/H · Shared Section Properties · AISC 360-10 ASD', review: 'PRELIMINARY · NOT VERIFIED', notice: 'Existing scoped calculations only. Remaining member, wheel-load and fatigue checks are not verified.', signOut: 'Sign out', nav: 'Member workspace navigation', language: 'Language' },
  vi: { workspace: 'Không gian làm việc', dashboard: 'Tổng quan', steel: 'Thiết kế thép', component: 'Cấu kiện', section: 'Đặc trưng tiết diện', tools: 'Công cụ kỹ thuật', material: 'Thư viện vật liệu', standards: 'Tiêu chuẩn thiết kế (Thư viện)', contents: 'Mục lục', geometry: 'Hình học tiết diện', bearing: 'Gối tựa bánh xe', input: 'Thông số đầu vào', properties: 'Đặc trưng tiết diện', checks: 'Kết quả sơ bộ', verification: 'Các kiểm tra còn lại', details: 'Chi tiết tính toán', title: 'Dầm cầu trục · Crane Beam', subtitle: 'I/H bất đối xứng · Section Properties dùng chung · AISC 360-10 ASD', review: 'SƠ BỘ · CHƯA KIỂM CHỨNG', notice: 'Giữ phạm vi tính hiện có. Các kiểm tra cấu kiện, tải bánh xe và mỏi còn lại chưa được kiểm chứng.', signOut: 'Đăng xuất', nav: 'Điều hướng cấu kiện', language: 'Ngôn ngữ' },
}
const t = key => words[locale.value]?.[key] ?? words.en[key] ?? key
const sections = [
  ['crane-geometry', 'geometry'], ['crane-bearing', 'bearing'], ['crane-inputs', 'input'],
  ['crane-properties', 'properties'], ['crane-checks', 'checks'],
  ['crane-verification', 'verification'], ['crane-details', 'details'],
]
const navigation = computed(() => [
  { label: t('dashboard'), href: home }, { label: t('steel'), href: moduleHref('steel') },
  { label: t('component'), href: moduleHref('steel'), child: true },
  { label: 'H/I Doubly Symmetric', href: hiHref, child: true },
  { label: 'Crane Beam', href: moduleHref('steel/crane-beam'), child: true, active: true },
  { label: t('section'), href: moduleHref('steel/section-properties') },
])
function jumpTo(id) {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
let observer
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) activeSection.value = entry.target.id
  }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 })
  for (const [id] of sections) {
    const element = document.getElementById(id)
    if (element) observer.observe(element)
  }
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div id="crane-member-workspace" class="member-shell">
    <aside class="member-navigation" :aria-label="t('nav')">
      <a class="member-logo" :href="home">Geek<span>Calculus</span></a>
      <nav class="member-global-nav" :aria-label="t('workspace')">
        <p class="member-caption">{{ t('workspace') }}</p>
        <a v-for="link in navigation" :key="link.label" :href="link.href" class="member-navitem" :class="{ 'is-child': link.child, active: link.active }" :aria-current="link.active ? 'page' : undefined"><span v-if="link.child" aria-hidden="true">↳</span>{{ link.label }}</a>
        <p class="member-caption">{{ t('tools') }}</p>
        <a class="member-navitem" :href="moduleHref('steel/library')">{{ t('material') }}</a>
        <a class="member-navitem" :href="moduleHref('steel/library/standards')">{{ t('standards') }}</a>
      </nav>
      <h2 class="member-outline-heading">{{ t('contents') }}</h2>
      <nav class="member-outline" :aria-label="t('contents')">
        <button v-for="([id, label], index) in sections" :key="id" type="button" :class="{ active: activeSection === id }" :aria-current="activeSection === id ? 'location' : undefined" @click="jumpTo(id)">{{ String(index + 1).padStart(2, '0') }} · {{ t(label) }}</button>
      </nav>
      <p class="member-review-note">{{ t('notice') }}</p>
    </aside>
    <main class="member-main">
      <header class="member-topbar">
        <a :href="moduleHref('steel')">{{ t('steel') }} › {{ t('component') }} › <strong>Crane Beam</strong></a>
        <div class="member-actions">
          <div class="language-switch" role="group" :aria-label="t('language')"><button type="button" :aria-pressed="locale === 'vi'" @click="locale = 'vi'">VI</button><button type="button" :aria-pressed="locale === 'en'" @click="locale = 'en'">EN</button></div>
          <button type="button" class="quiet-button" @click="emit('sign-out')">{{ t('signOut') }}</button>
        </div>
      </header>
      <div class="member-page">
        <header class="member-intro"><h1>{{ t('title') }}</h1><p>{{ t('subtitle') }}</p><span class="member-status">{{ t('review') }}</span></header>
        <CraneBeamView :locale="locale" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.member-shell{display:grid;grid-template-columns:minmax(0,1fr) 282px;min-height:100vh;background:var(--page-bg);color:#243d55}
.member-page :deep(.crane-beam > header){display:none}
.member-navigation{grid-column:2;grid-row:1;position:sticky;top:0;height:100vh;overflow-y:auto;background:#e7e9ec;border-left:1px solid #bfc5cd}
.member-main{grid-column:1;grid-row:1;min-width:0}.member-logo{display:block;padding:20px 18px;background:#192f46;color:#fff;font-size:22px;font-weight:800;text-decoration:none}.member-logo span{color:#79d3d7}
.member-global-nav{padding:12px 9px}.member-caption{margin:15px 9px 7px;color:#63798e;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.member-navitem{display:flex;gap:9px;min-height:36px;align-items:center;padding:9px 11px;border-radius:5px;color:#31485e;font-size:14px;text-decoration:none;line-height:1.4}.member-navitem.is-child{padding-left:24px}.member-navitem:hover,.member-navitem:focus-visible{background:#d4e1ed;color:#183a62}.member-navitem.active{background:#ccdae9;color:#1b4e7b;box-shadow:inset 3px 0 #3a76a7;font-weight:700}
.member-outline-heading{padding:11px 14px;background:#d5d9de;border-block:1px solid #c5cbd1;font-size:17px}.member-outline{padding:8px}.member-outline button{display:block;width:100%;margin:3px 0;padding:9px;text-align:left;border:0;border-radius:4px;background:transparent;color:#334558;font-size:14px;line-height:1.4}
#crane-member-workspace .member-outline button.active{background:#c0d3e6;color:#123a63;font-weight:700;box-shadow:inset 3px 0 #2a6b9e}.member-review-note{margin:16px;padding-top:12px;border-top:1px solid #c5cbd3;color:#6b7d8e;font-size:12px;line-height:1.6}
.member-topbar{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;background:var(--workspace-bg);border-bottom:1px solid var(--surface-border)}.member-topbar>a{font-size:14px;text-decoration:none}.member-actions{display:flex;align-items:center;gap:10px}.member-page{width:calc(100% - 32px);max-width:1580px;margin:16px auto;padding:24px;background:var(--workspace-bg);border:1px solid var(--surface-border);border-radius:16px}.member-intro h1{font-size:29px}.member-intro p{margin:8px 0 12px;color:var(--muted-ink);font-size:15px}.member-status{display:inline-block;padding:6px 10px;border:1px solid #efd9b6;border-radius:20px;background:#fff6e7;color:#8c641d;font-size:12px;font-weight:700}
@media(max-width:1100px){.member-shell{grid-template-columns:minmax(0,1fr) 235px}.member-page{padding:18px}}
@media(max-width:750px){.member-shell{display:flex;flex-direction:column}.member-navigation{position:static;height:auto;max-height:300px;overflow-y:auto;border-left:0;border-bottom:1px solid #bfc5cd}.member-logo{padding:12px 18px}.member-main{width:100%}.member-page{width:calc(100% - 16px);margin:8px auto;padding:14px}.member-topbar{position:static;padding:12px;gap:10px}.member-intro h1{font-size:25px}}
@media print{.member-shell{display:block}.member-navigation,.member-topbar{display:none}.member-page{width:100%;margin:0;padding:0;border:0}}
</style>
