<script setup>
import { computed, ref, watch } from 'vue'
import { calculateSectionProperties, convertSectionProperties } from '../analytical-engine.js'
import { SHAPE_DEFINITIONS, validateGeometryDefinition } from '../geometry-models.js'
import GeometryPreview from './GeometryPreview.vue'

const props = defineProps({ locale: { type: String, required: true } })

const words = {
  en: {
    title: 'Geometry Models / Analytical Engine', subtitle: 'Package 01 · Geometry Models  /  Package 02 · Analytical Engine',
    shape: 'Geometry model', unit: 'Input length unit', resultUnit: 'Result unit', calculate: 'Calculate properties',
    coordinate: 'Coordinates: origin at the lower-left of the bounding box; +x points right across width and +y points up across depth. Ix is about horizontal x, Iy about vertical y, and Ixy = ∫(x−x̄)(y−ȳ)dA.',
    localAxes: 'Axis names here are geometric x/y. Existing library Iy/Iz values retain the source catalog’s local-axis convention. If source local y follows depth and local z follows width, engine Iy maps to source Iy and engine Ix maps to source Iz; confirm each source before transferring values.',
    result: 'Gross section properties', area: 'Area A', perimeter: 'Perimeter P', centroid: 'Centroid (x̄, ȳ)',
    inertias: 'Centroidal second moments', products: 'Product of inertia Ixy', elastic: 'Elastic section modulus S',
    plastic: 'Plastic section modulus Z', gyration: 'Radius of gyration r', pna: 'Plastic neutral axes',
    aboutX: 'About x (horizontal)', aboutY: 'About y (vertical)', coordinateAt: 'coordinate',
    positive: 'positive', negative: 'negative', top: 'top (+y)', bottom: 'bottom (−y)', right: 'right (+x)', left: 'left (−x)',
    principal: 'Principal inertia', major: 'Major I₁', minor: 'Minor I₂', angle: 'Major-axis angle from +x',
    indeterminate: 'Indeterminate: the two principal inertias are equal.',
    invalid: 'Check the dimensions:', scope: 'Scope: solid rectangle/circle, symmetric I/H, CHS, and SHS/RHS with uniform wall thickness. Box and I/H corners are sharp. Properties describe homogeneous gross sections; fillets, additional openings, reinforcement, and code checks are not included.',
    rangeError: 'These dimensions exceed the supported numeric range. Use a smaller or larger length unit.',
    b: 'Width b', h: 'Height / depth h', D: 'Diameter D', tw: 'Web thickness tw', tf: 'Flange thickness tf', t: 'Wall thickness t',
    rectangle: 'Rectangle', circle: 'Circle', 'i-h': 'Symmetric I/H section',
    'circular-tube': 'CHS — Circular hollow section', 'rectangular-tube': 'SHS/RHS — Square / rectangular hollow section',
    perimeterNote: 'For hollow sections, P is the total outer and inner boundary length.',
    conversionError: 'The result cannot be represented in this unit. Choose another result unit.',
    wallError: 'Twice the wall thickness t must be less than every outer dimension.',
    wallPrecisionError: 'The wall thickness is too small to represent for these outer dimensions.',
  },
  vi: {
    title: 'Geometry Models / Analytical Engine', subtitle: 'Gói 01 · Mô hình hình học  /  Gói 02 · Bộ máy giải tích',
    shape: 'Mô hình hình học', unit: 'Đơn vị kích thước đầu vào', resultUnit: 'Đơn vị kết quả', calculate: 'Tính đặc trưng',
    coordinate: 'Tọa độ: gốc tại góc dưới trái của hộp bao; +x hướng sang phải theo bề rộng, +y hướng lên theo chiều cao. Ix quanh trục ngang x, Iy quanh trục đứng y và Ixy = ∫(x−x̄)(y−ȳ)dA.',
    localAxes: 'Trục ở đây là x/y hình học. Iy/Iz hiện có trong thư viện giữ quy ước trục địa phương của catalog nguồn. Nếu trục y của nguồn theo chiều cao và trục z theo bề rộng, Iy của engine tương ứng Iy nguồn, Ix của engine tương ứng Iz nguồn; cần xác nhận quy ước của từng nguồn trước khi chuyển số liệu.',
    result: 'Đặc trưng tiết diện nguyên', area: 'Diện tích A', perimeter: 'Chu vi P', centroid: 'Trọng tâm (x̄, ȳ)',
    inertias: 'Mô men quán tính qua trọng tâm', products: 'Tích quán tính Ixy', elastic: 'Mô đun chống uốn đàn hồi S',
    plastic: 'Mô đun chống uốn dẻo Z', gyration: 'Bán kính quán tính r', pna: 'Trục trung hòa dẻo',
    aboutX: 'Quanh x (ngang)', aboutY: 'Quanh y (đứng)', coordinateAt: 'tọa độ',
    positive: 'phía dương', negative: 'phía âm', top: 'trên (+y)', bottom: 'dưới (−y)', right: 'phải (+x)', left: 'trái (−x)',
    principal: 'Mô men quán tính chính', major: 'Lớn I₁', minor: 'Nhỏ I₂', angle: 'Góc trục chính lớn từ +x',
    indeterminate: 'Không xác định: hai mô men quán tính chính bằng nhau.',
    invalid: 'Kiểm tra kích thước:', scope: 'Phạm vi: chữ nhật/tròn đặc, I/H đối xứng, CHS và SHS/RHS có bề dày thành đồng đều. Góc hộp và I/H là góc vuông. Đặc trưng tiết diện nguyên đồng nhất; chưa xét bán kính lượn, lỗ bổ sung, cốt thép hoặc kiểm tra tiêu chuẩn.',
    rangeError: 'Kích thước vượt quá phạm vi số được hỗ trợ. Hãy chọn đơn vị chiều dài phù hợp hơn.',
    b: 'Bề rộng b', h: 'Chiều cao h', D: 'Đường kính D', tw: 'Bề dày bụng tw', tf: 'Bề dày cánh tf', t: 'Bề dày thành t',
    rectangle: 'Chữ nhật', circle: 'Hình tròn', 'i-h': 'Tiết diện I/H đối xứng',
    'circular-tube': 'CHS — Ống tròn', 'rectangular-tube': 'SHS/RHS — Hộp vuông / chữ nhật',
    perimeterNote: 'Với tiết diện rỗng, P là tổng chiều dài biên ngoài và biên trong.',
    conversionError: 'Kết quả không biểu diễn được bằng đơn vị này. Hãy chọn đơn vị kết quả khác.',
    wallError: 'Hai lần bề dày thành t phải nhỏ hơn mọi kích thước ngoài.',
    wallPrecisionError: 'Bề dày thành quá nhỏ để biểu diễn với kích thước ngoài này.',
  },
}

const t = key => words[props.locale]?.[key] ?? words.en[key] ?? key
const shape = ref('rectangle')
const unit = ref('mm')
const resultUnit = ref('mm')
const dimensions = ref({ b: 300, h: 500, D: 400, tw: 12, tf: 20, t: 10 })
const calculatedProperties = ref(null)
const properties = computed(() => {
  if (!calculatedProperties.value) return null
  try { return convertSectionProperties(calculatedProperties.value, resultUnit.value) } catch { return null }
})
const errors = ref([])
const currentShape = computed(() => SHAPE_DEFINITIONS[shape.value])
const validationInput = computed(() => ({
  shape: shape.value,
  unit: unit.value,
  dimensions: Object.fromEntries(currentShape.value.dimensions.map(({ key }) => [key, dimensions.value[key]])),
}))

watch([shape, unit, dimensions], () => {
  calculatedProperties.value = null
  errors.value = []
}, { deep: true })

function calculate() {
  const checked = validateGeometryDefinition(validationInput.value)
  errors.value = checked.errors
  calculatedProperties.value = null
  if (!checked.valid) return
  try {
    calculatedProperties.value = calculateSectionProperties(validationInput.value)
  } catch (error) {
    errors.value = [{ code: error.code ?? 'numerical_range' }]
  }
}

const number = value => new Intl.NumberFormat(props.locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 7 }).format(value)
const dimensionLabel = key => t(key)
const errorText = error => {
  if (error.code === 'numerical_range') return t('rangeError')
  if (error.code === 'web_too_wide') return props.locale === 'vi' ? 'Bề dày bụng tw phải nhỏ hơn bề rộng cánh b.' : 'Web thickness tw must be less than flange width b.'
  if (error.code === 'flanges_overlap') return props.locale === 'vi' ? 'Chiều cao h phải lớn hơn hai lần bề dày cánh tf.' : 'Depth h must be greater than twice flange thickness tf.'
  if (error.code === 'wall_too_thick') return t('wallError')
  if (error.code === 'thickness_not_representable') return t('wallPrecisionError')
  if (error.code === 'positive_number_required') return props.locale === 'vi' ? `${error.path.split('.').at(-1)} phải lớn hơn 0.` : error.message
  if (error.code === 'finite_number_required') return props.locale === 'vi' ? `${error.path.split('.').at(-1)} phải là số hữu hạn.` : error.message
  return error.message
}

calculate()
</script>

<template>
  <section class="module-panel geometry-workbench" aria-labelledby="geometry-title">
    <header class="geometry-heading">
      <div><h2 id="geometry-title">{{ t('title') }}</h2><p>{{ t('subtitle') }}</p></div>
    </header>

    <form class="geometry-form" @submit.prevent="calculate">
      <label class="field">
        <span>{{ t('shape') }}</span>
        <select v-model="shape" aria-label="Geometry model">
          <option v-for="option in Object.keys(SHAPE_DEFINITIONS)" :key="option" :value="option">{{ t(option) }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('unit') }}</span>
        <select v-model="unit" aria-label="Length unit">
          <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option><option value="in">in</option>
        </select>
      </label>
      <label v-for="dimension in currentShape.dimensions" :key="dimension.key" class="field">
        <span>{{ dimensionLabel(dimension.key) }}</span>
        <span class="geometry-number"><input v-model.number="dimensions[dimension.key]" type="number" min="0" step="any" :aria-label="dimensionLabel(dimension.key)"><small>{{ unit }}</small></span>
      </label>
      <button type="submit" class="primary-button geometry-submit">{{ t('calculate') }}</button>
    </form>

    <p class="geometry-coordinate-note">{{ t('coordinate') }}</p>
    <GeometryPreview :input="validationInput" :properties="properties" :locale="locale" />
    <p v-if="errors.length" class="error-message" role="alert">{{ t('invalid') }} {{ errors.map(errorText).join(' ') }}</p>

    <p v-if="calculatedProperties && !properties" role="alert" class="error-message">{{ t('conversionError') }}</p>
    <label v-if="calculatedProperties" class="field result-unit-selector">
      <span>{{ t('resultUnit') }}</span>
      <select v-model="resultUnit" :aria-label="t('resultUnit')">
        <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
      </select>
    </label>

    <template v-if="properties">
      <section class="geometry-results" aria-live="polite" aria-labelledby="geometry-results-title">
        <h3 id="geometry-results-title">{{ t('result') }}</h3>
        <p v-if="shape === 'circular-tube' || shape === 'rectangular-tube'" class="geometry-coordinate-note">{{ t('perimeterNote') }}</p>
        <dl class="geometry-summary">
          <div><dt>{{ t('area') }}</dt><dd>{{ number(properties.A) }} {{ properties.units.area }}</dd></div>
          <div><dt>{{ t('perimeter') }}</dt><dd>{{ number(properties.perimeter) }} {{ properties.units.length }}</dd></div>
          <div><dt>{{ t('centroid') }}</dt><dd>({{ number(properties.centroid.x) }}, {{ number(properties.centroid.y) }}) {{ properties.units.length }}</dd></div>
        </dl>
        <div class="geometry-result-grid">
          <section class="geometry-result-card">
            <h4>{{ t('inertias') }}</h4>
            <dl><div><dt>Ix</dt><dd>{{ number(properties.Ix) }} {{ properties.units.secondMoment }}</dd></div><div><dt>Iy</dt><dd>{{ number(properties.Iy) }} {{ properties.units.secondMoment }}</dd></div><div><dt>{{ t('products') }}</dt><dd>{{ number(properties.Ixy) }} {{ properties.units.secondMoment }}</dd></div></dl>
          </section>
          <section class="geometry-result-card">
            <h4>{{ t('elastic') }}</h4>
            <dl><div><dt>Sx {{ t('positive') }} · {{ t('top') }}</dt><dd>{{ number(properties.Sx.positive) }} {{ properties.units.sectionModulus }}</dd></div><div><dt>Sx {{ t('negative') }} · {{ t('bottom') }}</dt><dd>{{ number(properties.Sx.negative) }} {{ properties.units.sectionModulus }}</dd></div><div><dt>Sy {{ t('positive') }} · {{ t('right') }}</dt><dd>{{ number(properties.Sy.positive) }} {{ properties.units.sectionModulus }}</dd></div><div><dt>Sy {{ t('negative') }} · {{ t('left') }}</dt><dd>{{ number(properties.Sy.negative) }} {{ properties.units.sectionModulus }}</dd></div></dl>
          </section>
          <section class="geometry-result-card">
            <h4>{{ t('plastic') }}</h4>
            <dl><div><dt>Zx {{ t('positive') }} / {{ t('negative') }}</dt><dd>{{ number(properties.Zx.positive) }} / {{ number(properties.Zx.negative) }} {{ properties.units.sectionModulus }}</dd></div><div><dt>Zy {{ t('positive') }} / {{ t('negative') }}</dt><dd>{{ number(properties.Zy.positive) }} / {{ number(properties.Zy.negative) }} {{ properties.units.sectionModulus }}</dd></div></dl>
          </section>
          <section class="geometry-result-card">
            <h4>{{ t('gyration') }}</h4>
            <dl><div><dt>rx</dt><dd>{{ number(properties.rx) }} {{ properties.units.length }}</dd></div><div><dt>ry</dt><dd>{{ number(properties.ry) }} {{ properties.units.length }}</dd></div></dl>
          </section>
          <section class="geometry-result-card">
            <h4>{{ t('pna') }}</h4>
            <dl><div><dt>{{ t('aboutX') }} · {{ t('coordinateAt') }} ȳ</dt><dd>{{ number(properties.pna.aboutX.value) }} {{ properties.units.length }}</dd></div><div><dt>{{ t('aboutY') }} · {{ t('coordinateAt') }} x̄</dt><dd>{{ number(properties.pna.aboutY.value) }} {{ properties.units.length }}</dd></div></dl>
          </section>
          <section class="geometry-result-card">
            <h4>{{ t('principal') }}</h4>
            <dl><div><dt>{{ t('major') }}</dt><dd>{{ number(properties.principalInertia.major) }} {{ properties.units.secondMoment }}</dd></div><div><dt>{{ t('minor') }}</dt><dd>{{ number(properties.principalInertia.minor) }} {{ properties.units.secondMoment }}</dd></div><div><dt>{{ t('angle') }}</dt><dd v-if="properties.principalInertia.orientationIndeterminate">{{ t('indeterminate') }}</dd><dd v-else>{{ number(properties.principalInertia.majorAxisAngleDeg) }}°</dd></div></dl>
          </section>
        </div>
      </section>
    </template>

    <aside class="geometry-scope"><p>{{ t('scope') }}</p><p>{{ t('localAxes') }}</p></aside>
  </section>
</template>

<style scoped>
.geometry-workbench { display: grid; gap: 18px; background: var(--surface-bg); border: 1px solid var(--surface-border); padding: 24px; border-radius: 12px; }
.geometry-heading h2 { margin: 0; color: #254d78; font-size: 20px; }
.geometry-heading p, .geometry-coordinate-note, .geometry-scope p { color: var(--muted-ink); font-size: 14px; line-height: 1.65; margin: 5px 0 0; }
.geometry-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; align-items: end; }
.geometry-number { display: flex; align-items: center; gap: 8px; }
.geometry-number input { flex: 1; }
.geometry-number small { min-width: 25px; color: var(--muted-ink); }
.result-unit-selector { max-width: 260px; }
.geometry-submit { min-height: 44px; }
.geometry-results { border-top: 1px solid var(--surface-border); padding-top: 18px; }
.geometry-results > h3 { margin: 0 0 12px; color: #254d78; }
.geometry-summary, .geometry-result-card dl { margin: 0; }
.geometry-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.geometry-summary > div, .geometry-result-card { min-width: 0; padding: 13px; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--soft-bg); }
.geometry-summary dt, .geometry-result-card dt { color: var(--muted-ink); font-size: 13px; }
.geometry-summary dd, .geometry-result-card dd { margin: 3px 0 0; color: #254d78; font-size: 15px; font-weight: 650; overflow-wrap: anywhere; }
.geometry-result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 9px; }
.geometry-result-card { background: var(--surface-bg); }
.geometry-result-card h4 { margin: 0 0 8px; color: #375b80; font-size: 14px; }
.geometry-result-card dl { display: grid; gap: 7px; }
.geometry-result-card dl > div { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.geometry-result-card dt { min-width: 0; }
.geometry-result-card dd { text-align: right; }
.geometry-scope { padding-top: 12px; border-top: 1px solid var(--surface-border); }
.geometry-scope p + p { margin-top: 8px; }
@media (max-width: 620px) { .geometry-workbench { padding: 16px 12px; }.geometry-form, .geometry-result-grid { grid-template-columns: 1fr; }.geometry-summary { grid-template-columns: 1fr; }.geometry-result-card dl > div { align-items: flex-start; flex-direction: column; gap: 1px; }.geometry-result-card dd { text-align: left; } }
</style>
