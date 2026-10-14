<script setup>
import { ref } from 'vue'
import SectionPropertiesPanel from './SectionPropertiesPanel.vue'
import SteelComponentMenu from './SteelComponentMenu.vue'

const props = defineProps({ locale: { type: String, required: true } })

const text = {
  vi: {
    title: 'Thiết kế kết cấu thép',
    subtitle: 'Thiết lập sơ bộ cấu kiện và liên kết thép.',
    status: 'Sơ bộ · Chưa sẵn sàng tính toán',
    componentSubtitle: 'Chọn loại tiết diện',
    connectionSubtitle: 'Liên kết · Thiết lập sơ bộ',
    standard: 'Tiêu chuẩn thiết kế',
    connectionType: 'Loại liên kết',
    beamColumn: 'Dầm – cột',
    splice: 'Nối cấu kiện',
    basePlate: 'Bản đế',
    braceGusset: 'Bản mã thanh giằng',
    fastener: 'Phương thức liên kết',
    bolted: 'Bu lông',
    welded: 'Hàn',
    mixed: 'Bu lông và hàn',
    boltGrade: 'Cấp bền bu lông',
    weldType: 'Dạng đường hàn',
    fillet: 'Hàn góc',
    butt: 'Hàn giáp mối',
    connectionNote: 'Các lựa chọn liên kết là thông tin sơ bộ. Chưa có thiết kế, kiểm tra sức chịu tải hoặc cấu tạo liên kết.',
    standardPlaceholder: 'Tiêu chuẩn chỉ là lựa chọn tham khảo; chưa có kiểm tra theo tiêu chuẩn.',
    sectionCalculator: 'Đặc trưng tiết diện',
    sectionCalculatorSubtitle: 'Tính chất hình học · Không lưu vào dự án',
  },
  en: {
    title: 'Steel design',
    subtitle: 'Set up preliminary steel members and connections.',
    status: 'Preliminary · Calculation is not ready',
    componentSubtitle: 'Choose a section type',
    connectionSubtitle: 'Connection · Preliminary setup',
    standard: 'Design standard',
    connectionType: 'Connection type',
    beamColumn: 'Beam-column',
    splice: 'Splice',
    basePlate: 'Base plate',
    braceGusset: 'Brace gusset',
    fastener: 'Fastening method',
    bolted: 'Bolted',
    welded: 'Welded',
    mixed: 'Bolted and welded',
    boltGrade: 'Bolt grade',
    weldType: 'Weld type',
    fillet: 'Fillet weld',
    butt: 'Butt weld',
    connectionNote: 'Connection choices are preliminary only. Connection design, resistance checks, and detailing are not available.',
    standardPlaceholder: 'Standards are reference selections only; no code checks are performed.',
    sectionCalculator: 'Section properties',
    sectionCalculatorSubtitle: 'Geometric calculator · Not saved to a project',
  },
}

const t = (key) => text[props.locale]?.[key] ?? text.en[key] ?? key
const activeTab = ref('component')
const connectionType = ref('beam_column')
const fastener = ref('bolted')
const boltGrade = ref('8.8')
const weldType = ref('fillet')
const connectionStandard = ref('tcvn_5575_2024')
const standards = [
  { value: 'tcvn_5575_2024', label: 'TCVN 5575:2024' },
  { value: 'eurocode_3', label: 'Eurocode 3 · EN 1993' },
  { value: 'aisc_360', label: 'AISC 360' },
]
const connectionTypes = [
  { value: 'beam_column', label: 'beamColumn' }, { value: 'splice', label: 'splice' },
  { value: 'base_plate', label: 'basePlate' }, { value: 'brace_gusset', label: 'braceGusset' },
]
const fasteningOptions = ['bolted', 'welded', 'mixed']
const boltGrades = ['4.6', '8.8', '10.9']
const weldTypes = ['fillet', 'butt']

</script>

<template>
  <section class="steel-design" :aria-label="t('title')">
    <header class="steel-design-header">
      <div class="steel-design-heading">
        <span v-if="activeTab !== 'section-properties'" class="steel-design-eyebrow">{{ t('status') }}</span>
        <h2>{{ t('title') }}</h2>
        <p>{{ t('subtitle') }}</p>
      </div>
      <div class="steel-design-mark" aria-hidden="true"><span></span><span></span><span></span></div>
    </header>

    <div class="steel-design-tabs" role="tablist" :aria-label="t('title')">
      <button type="button" role="tab" :aria-selected="activeTab === 'component'" :class="{ active: activeTab === 'component' }" @click="activeTab = 'component'">
        <strong>Component</strong><small>{{ t('componentSubtitle') }}</small>
      </button>
      <button type="button" role="tab" :aria-selected="activeTab === 'connection'" :class="{ active: activeTab === 'connection' }" @click="activeTab = 'connection'">
        <strong>Connection</strong><small>{{ t('connectionSubtitle') }}</small>
      </button>
      <button type="button" role="tab" :aria-selected="activeTab === 'section-properties'" :class="{ active: activeTab === 'section-properties' }" @click="activeTab = 'section-properties'">
        <strong>{{ t('sectionCalculator') }}</strong><small>{{ t('sectionCalculatorSubtitle') }}</small>
      </button>
    </div>

    <SteelComponentMenu v-show="activeTab === 'component'" :locale="locale" />

    <section v-if="activeTab === 'connection'" class="steel-design-panel" role="tabpanel">
      <div class="steel-design-form-grid">
        <label class="steel-design-field">
          <span>{{ t('connectionType') }}</span>
          <select v-model="connectionType" class="steel-design-select">
            <option v-for="item in connectionTypes" :key="item.value" :value="item.value">{{ t(item.label) }}</option>
          </select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('fastener') }}</span>
          <select v-model="fastener" class="steel-design-select">
            <option v-for="item in fasteningOptions" :key="item" :value="item">{{ t(item) }}</option>
          </select>
        </label>
        <label v-if="fastener !== 'welded'" class="steel-design-field">
          <span>{{ t('boltGrade') }}</span>
          <select v-model="boltGrade" class="steel-design-select"><option v-for="grade in boltGrades" :key="grade" :value="grade">{{ grade }}</option></select>
        </label>
        <label v-if="fastener !== 'bolted'" class="steel-design-field">
          <span>{{ t('weldType') }}</span>
          <select v-model="weldType" class="steel-design-select"><option v-for="item in weldTypes" :key="item" :value="item">{{ t(item) }}</option></select>
        </label>
        <label class="steel-design-field">
          <span>{{ t('standard') }}</span>
          <select v-model="connectionStandard" class="steel-design-select">
            <option v-for="item in standards" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
      </div>

      <div class="steel-design-standard-note"><span aria-hidden="true">i</span>{{ t('standardPlaceholder') }}</div>
      <div class="steel-design-connection-notice"><span class="steel-design-notice-icon" aria-hidden="true">↗</span><p>{{ t('connectionNote') }}</p></div>
    </section>

    <div v-show="activeTab === 'section-properties'" class="steel-design-properties-panel" role="tabpanel">
      <SectionPropertiesPanel :locale="locale" />
    </div>
  </section>
</template>

<style scoped>
.steel-design { color: #233850; }
.steel-design-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 4px 2px 20px; }
.steel-design-eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #4977a4; font-size: 14px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.steel-design-eyebrow::before { width: 7px; height: 7px; border-radius: 50%; background: #d4973d; content: ''; }
.steel-design-heading h2 { margin: 7px 0 5px; color: #203b58; font-size: 26px; letter-spacing: -.035em; }
.steel-design-heading p { margin: 0; color: var(--muted-ink); font-size: 16px; }
.steel-design-mark { display: flex; align-items: center; justify-content: center; gap: 6px; width: 48px; height: 48px; border: 1px solid var(--surface-border); border-radius: 14px; background: linear-gradient(145deg, var(--surface-bg), var(--page-bg)); }
.steel-design-mark span { display: block; width: 4px; border-radius: 3px; background: #6488ad; transform: skew(-20deg); }
.steel-design-mark span:nth-child(1) { height: 18px; }.steel-design-mark span:nth-child(2) { height: 28px; background: #355e86; }.steel-design-mark span:nth-child(3) { height: 22px; }
.steel-design-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 5px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--soft-bg); }
.steel-design-tabs button { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; padding: 13px 16px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: #4e6984; cursor: pointer; text-align: left; transition: color .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease; }
.steel-design-tabs button strong { font-size: 16px; font-weight: 700; }
.steel-design-tabs button small { color: inherit; font-size: 14px; opacity: .78; }
.steel-design-tabs button:hover, .steel-design-tabs button.active { border-color: #23395d; background: #23395d; color: #fff; box-shadow: 0 4px 12px #23395d26; }
.steel-design-tabs button:focus-visible, .steel-design-select:focus-visible { outline: 3px solid #8bb6df; outline-offset: 2px; }
.steel-design-panel { margin-top: 14px; padding: 22px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--surface-bg); }
.steel-design-properties-panel { margin-top: 14px; }
.steel-design-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.steel-design-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; color: #5d7690; font-size: 15px; font-weight: 650; }
.steel-design-select { width: 100%; min-height: 42px; padding: 9px 36px 9px 12px; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--workspace-bg); color: #233850; font: inherit; font-size: 16px; }
.steel-design-select:focus { border-color: #6d9bc5; box-shadow: 0 0 0 3px #d9e9f7; outline: none; }
.steel-design-select:disabled { cursor: not-allowed; opacity: .65; }
.steel-design-select option:hover, .steel-design-select option:checked { background: #23395d; color: white; }
.steel-design-standard-note { display: flex; gap: 9px; align-items: flex-start; margin: 16px 0 0; padding: 10px 12px; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--soft-bg); color: var(--muted-ink); font-size: 14px; line-height: 1.55; }
.steel-design-standard-note > span { display: grid; flex: 0 0 17px; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: #e5eff8; color: #537b9f; font-family: Georgia, serif; font-size: 15px; font-weight: 700; }
.steel-design-connection-notice { display: flex; align-items: flex-start; gap: 12px; margin-top: 22px; padding: 17px; border: 1px solid var(--surface-border); border-radius: 10px; background: linear-gradient(135deg, var(--soft-bg), var(--soft-bg)); }
.steel-design-notice-icon { display: grid; flex: 0 0 30px; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: #e2edf7; color: #547da2; font-size: 18px; }
.steel-design-connection-notice p { margin: 1px 0 0; color: var(--muted-ink); font-size: 15px; line-height: 1.65; }
@media (max-width: 560px) { .steel-design-tabs { grid-template-columns: 1fr; }.steel-design-header { align-items: flex-start; padding-bottom: 15px; }.steel-design-heading h2 { font-size: 23px; }.steel-design-mark { flex: 0 0 42px; width: 42px; height: 42px; }.steel-design-tabs button { padding: 11px 10px; }.steel-design-tabs button small { font-size: 13px; }.steel-design-panel { padding: 15px 12px; }.steel-design-form-grid { grid-template-columns: 1fr; gap: 12px; } }
@media (prefers-reduced-motion: reduce) { .steel-design-tabs button { transition: none; } }
</style>
