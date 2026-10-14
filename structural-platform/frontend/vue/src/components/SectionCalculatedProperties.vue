<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, default: null },
  calculatedAt: { type: String, default: '' },
  locale: { type: String, default: 'en' },
})

const labels = {
  en: {
    title: 'Section Properties', calculatedAt: 'Calculated', geometric: 'Geometric', elastic: 'Elastic',
    plastic: 'Plastic', principal: 'Principal axes', advanced: 'Advanced', area: 'A · Area', perimeter: 'P · Perimeter',
    xbar: 'x̄ · Centroid x', ybar: 'ȳ · Centroid y', ix: 'Ix', iy: 'Iy', ixy: 'Ixy', sxPositive: 'Sx+', sxNegative: 'Sx−',
    syPositive: 'Sy+', syNegative: 'Sy−', rx: 'rx', ry: 'ry', pnaX: 'PNAx', pnaY: 'PNAy', zx: 'Zx', zy: 'Zy',
    imax: 'Imax', imin: 'Imin', angle: 'Major-axis angle', orientation: 'Orientation', determinate: 'Determinate',
    indeterminate: 'Indeterminate', j: 'J · Torsion constant', cw: 'Cw · Warping constant', shearCenter: 'Shear center',
    shearCenterX: 'SCx', shearCenterY: 'SCy', shearOffsetX: 'SCx offset', shearOffsetY: 'SCy offset', shearAreas: 'Effective shear areas',
    ax: 'Ax · Effective shear area x', ay: 'Ay · Effective shear area y', thinWall: 'Thin-wall approximation', notComputed: 'Not computed', computedValueOmitted: 'Computed; value omitted',
    noSnapshot: 'No calculated section properties are saved for this record.',
  },
  vi: {
    title: 'Section Properties', calculatedAt: 'Thời điểm tính', geometric: 'Hình học', elastic: 'Đàn hồi',
    plastic: 'Dẻo', principal: 'Trục chính', advanced: 'Nâng cao', area: 'A · Diện tích', perimeter: 'P · Chu vi',
    xbar: 'x̄ · Tọa độ trọng tâm x', ybar: 'ȳ · Tọa độ trọng tâm y', ix: 'Ix', iy: 'Iy', ixy: 'Ixy',
    sxPositive: 'Sx+', sxNegative: 'Sx−', syPositive: 'Sy+', syNegative: 'Sy−', rx: 'rx', ry: 'ry',
    pnaX: 'PNAx', pnaY: 'PNAy', zx: 'Zx', zy: 'Zy', imax: 'Imax', imin: 'Imin', angle: 'Góc trục chính',
    orientation: 'Trạng thái phương', determinate: 'Xác định', indeterminate: 'Không xác định',
    j: 'J · Hằng số xoắn', cw: 'Cw · Hằng số vênh', shearCenter: 'Tâm cắt', shearCenterX: 'SCx', shearCenterY: 'SCy',
    shearOffsetX: 'Độ lệch SCx', shearOffsetY: 'Độ lệch SCy', shearAreas: 'Diện tích cắt hữu hiệu',
    ax: 'Ax · Diện tích cắt hữu hiệu x', ay: 'Ay · Diện tích cắt hữu hiệu y', thinWall: 'Xấp xỉ thành mỏng', computedValueOmitted: 'Đã tính; không có giá trị',
    notComputed: 'Chưa tính', noSnapshot: 'Bản ghi này chưa có Section Properties đã lưu.',
  },
}
const t = (key) => labels[props.locale]?.[key] ?? labels.en[key] ?? key

const groups = computed(() => {
  const properties = props.result?.properties ?? {}
  const geometric = properties.geometric ?? {}
  const elastic = properties.elastic ?? {}
  const plastic = properties.plastic
  const principal = properties.principal ?? {}
  const advanced = props.result?.advanced ?? {}
  return [
    { key: 'geometric', title: t('geometric'), rows: [
      ['area', 'area', 'mm²'], ['perimeter', 'perimeter', 'mm'], ['xbar', 'centroid_x', 'mm'], ['ybar', 'centroid_y', 'mm'],
    ].map(([label, key, unit]) => row(t(label), geometric[key], unit)) },
    { key: 'elastic', title: t('elastic'), rows: [
      ['ix', 'ix', 'mm⁴'], ['iy', 'iy', 'mm⁴'], ['ixy', 'ixy', 'mm⁴'],
      ['sxPositive', 'sx_positive', 'mm³'], ['sxNegative', 'sx_negative', 'mm³'],
      ['syPositive', 'sy_positive', 'mm³'], ['syNegative', 'sy_negative', 'mm³'], ['rx', 'rx', 'mm'], ['ry', 'ry', 'mm'],
    ].map(([label, key, unit]) => row(t(label), elastic[key], unit)) },
    { key: 'plastic', title: t('plastic'), rows: plastic ? [
      ['pnaX', 'pna_x', 'mm'], ['pnaY', 'pna_y', 'mm'], ['zx', 'zx', 'mm³'], ['zy', 'zy', 'mm³'],
    ].map(([label, key, unit]) => row(t(label), plastic[key], unit)) : [], emptyReason: props.result?.diagnostics?.plastic?.reason ?? 'not_requested' },
    { key: 'principal', title: t('principal'), rows: [
      row(t('imax'), principal.i_major, 'mm⁴'), row(t('imin'), principal.i_minor, 'mm⁴'),
      row(t('angle'), principal.major_axis_angle_degrees, '°'),
      row(t('orientation'), t(principal.orientation_status ?? ''), ''),
    ] },
    { key: 'advanced', title: t('advanced'), rows: advancedRows(advanced) },
  ].filter((group) => group.rows.length || group.key === 'plastic')
})

function row(label, value, unit) { return { label, value, unit, method: '', reason: '' } }
function advancedRows(advanced) {
  const rows = []
  const methodText = (method) => {
    if (!method) return ''
    if (String(method).toLowerCase().includes('thin_wall') || String(method).toLowerCase().includes('thin-wall')) return t('thinWall')
    return String(method).replaceAll('_', ' ')
  }
  const add = (key, label, unit) => {
    const property = advanced[key]
    if (!property) return
    const common = { method: methodText(property.method), reason: property.reason ?? '' }
    if (property.status !== 'computed') {
      rows.push({ label, value: null, unit, kind: 'unavailable', ...common })
      return
    }
    if (property.value === null || property.value === undefined) {
      rows.push({ label, value: null, unit, kind: 'computed-without-value', ...common })
      return
    }
    if (key === 'shear_center' && property.value && typeof property.value === 'object') {
      rows.push({ label: t('shearCenter'), value: null, unit: '', kind: 'vector-heading', ...common })
      rows.push({ ...row(t('shearCenterX'), property.value.x, 'mm'), method: common.method })
      rows.push({ ...row(t('shearCenterY'), property.value.y, 'mm'), method: common.method })
      rows.push({ ...row(t('shearOffsetX'), property.value.offset_x, 'mm'), method: common.method })
      rows.push({ ...row(t('shearOffsetY'), property.value.offset_y, 'mm'), method: common.method })
      return
    }
    if (key === 'effective_shear_area' && property.value && typeof property.value === 'object') {
      rows.push({ label: t('shearAreas'), value: null, unit: '', kind: 'vector-heading', ...common })
      rows.push({ ...row(t('ax'), property.value.x, 'mm²'), method: common.method })
      rows.push({ ...row(t('ay'), property.value.y, 'mm²'), method: common.method })
      return
    }
    rows.push({ label, value: property.value, unit, ...common })
  }
  add('torsion_constant_j', t('j'), 'mm⁴')
  add('warping_constant_cw', t('cw'), 'mm⁶')
  add('shear_center', t('shearCenter'), 'mm')
  add('effective_shear_area', t('shearAreas'), 'mm²')
  return rows
}
function format(value, unit = '') {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    const formatted = new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 8 }).format(value)
    return unit ? `${formatted} ${unit}` : formatted
  }
  return String(value)
}
function reason(value) {
  if (!value) return t('notComputed')
  const display = {
    not_requested: props.locale === 'vi' ? 'chưa yêu cầu' : 'not requested',
    solver_not_implemented: props.locale === 'vi' ? 'chưa triển khai' : 'not implemented',
    convergence_not_achieved: props.locale === 'vi' ? 'chưa đạt hội tụ' : 'convergence not achieved',
    numerical_precision_limit: props.locale === 'vi' ? 'giới hạn độ chính xác số' : 'numerical precision limit',
  }
  return display[value] ?? value.replaceAll('_', ' ')
}
function formatDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
</script>

<template>
  <section class="section-calculated-properties" :aria-label="t('title')">
    <header><strong>{{ t('title') }}</strong><small v-if="calculatedAt">{{ t('calculatedAt') }}: {{ formatDate(calculatedAt) }}</small></header>
    <p v-if="!result" class="section-calculated-empty">{{ t('noSnapshot') }}</p>
    <div v-else class="section-calculated-grid">
      <article v-for="group in groups" :key="group.key" class="section-calculated-group">
        <h5>{{ group.title }}</h5>
        <dl>
          <div v-for="item in group.rows" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd v-if="item.kind === 'vector-heading'" class="section-calculated-vector-heading"><small v-if="item.method">{{ item.method }}</small></dd>
            <dd v-else-if="item.kind === 'computed-without-value'" class="section-calculated-computed-without-value">
              {{ t('computedValueOmitted') }}<small v-if="item.method">{{ item.method }}</small>
            </dd>
            <dd v-else-if="item.reason || item.kind === 'unavailable' || (group.key === 'advanced' && item.value === null)" class="section-calculated-unavailable">
              {{ reason(item.reason) }}<small v-if="item.method">{{ item.method }}</small>
            </dd>
            <dd v-else>{{ format(item.value, item.unit) }}<small v-if="item.method">{{ item.method }}</small></dd>
          </div>
          <li v-if="group.key === 'plastic' && !group.rows.length" class="section-calculated-empty-row">{{ reason(group.emptyReason) }}</li>
        </dl>
      </article>
    </div>
    <details v-if="result?.solver" class="section-calculated-provenance">
      <summary>{{ result.solver.method }} · {{ result.solver.version }} · {{ result.geometry_hash }}</summary>
      <ul><li v-for="assumption in result.diagnostics?.assumptions ?? []" :key="assumption">{{ assumption.replaceAll('_', ' ') }}</li></ul>
    </details>
  </section>
</template>

<style scoped>
.section-calculated-properties { margin-top: 11px; padding: 10px; border: 1px solid #e3ebf1; border-radius: 7px; background: var(--surface-bg); }
.section-calculated-properties > header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; color: #456681; font-size: 14px; }
.section-calculated-properties > header small { color: var(--muted-ink); font-size: 12px; font-weight: 500; }
.section-calculated-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.section-calculated-group { min-width: 0; padding: 8px; border: 1px solid #e9eef2; border-radius: 6px; }
.section-calculated-group h5 { margin: 0 0 5px; color: #52738f; font-size: 13px; font-weight: 750; letter-spacing: .035em; text-transform: uppercase; }
.section-calculated-group dl { display: grid; gap: 0; margin: 0; }
.section-calculated-group dl > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px solid #eef2f5; }
.section-calculated-group dl > div:last-child { border-bottom: 0; }
.section-calculated-group dt { color: var(--muted-ink); font-size: 13px; line-height: 1.4; }
.section-calculated-group dd { margin: 0; color: #344f69; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
.section-calculated-group dd small { display: block; color: var(--muted-ink); font-size: 12px; font-weight: 500; }
.section-calculated-group dd.section-calculated-vector-heading { color: #52738f; }
.section-calculated-group .section-calculated-unavailable, .section-calculated-empty-row, .section-calculated-empty { color: var(--muted-ink); font-size: 12px; font-weight: 500; }
.section-calculated-empty-row { margin: 3px 0; list-style: none; text-align: right; }
.section-calculated-provenance { margin-top: 8px; color: var(--muted-ink); font-size: 12px; overflow-wrap: anywhere; }
.section-calculated-provenance summary { cursor: pointer; }
.section-calculated-provenance ul { display: flex; flex-wrap: wrap; gap: 4px 14px; padding-left: 16px; }
@media (max-width: 600px) { .section-calculated-grid { grid-template-columns: 1fr; } }
</style>
