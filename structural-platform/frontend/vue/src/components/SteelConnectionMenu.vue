<script setup>
import { computed, reactive, ref } from 'vue'
import ConnectionThumbnail from './ConnectionThumbnail.vue'
import { CONNECTION_FAMILIES, CONNECTION_GROUPS, CONNECTION_TYPES } from '../connections/catalog.js'

const props = defineProps({ locale: { type: String, required: true } })

const words = {
  en: {
    title: 'Steel connection catalog', description: 'Choose a connection group, then select an illustrated connection type.',
    groupLabel: 'Connection groups', searchLabel: 'Search connections', searchPlaceholder: 'Search by connection name',
    families: 'Connection families', workspace: 'Prepared workspace', pending: 'This illustrative workspace is prepared for future connection design tools.',
    noResults: 'No connection types match this search.',
    prepared: 'Illustrative catalog entry', types: 'connection types', anchorage: 'Anchorage & column bases', steel: 'Structural steel connections',
  },
  vi: {
    title: 'Danh mục liên kết thép', description: 'Chọn nhóm liên kết, sau đó chọn loại liên kết minh họa.',
    groupLabel: 'Nhóm liên kết', searchLabel: 'Tìm liên kết', searchPlaceholder: 'Tìm theo tên liên kết',
    families: 'Họ liên kết', workspace: 'Không gian làm việc đã chuẩn bị', pending: 'Không gian minh họa này được chuẩn bị cho các công cụ thiết kế liên kết trong tương lai.',
    noResults: 'Không tìm thấy loại liên kết phù hợp.',
    prepared: 'Mục minh họa trong danh mục', types: 'loại liên kết', anchorage: 'Bu-lông neo & chân cột', steel: 'Liên kết kết cấu thép',
  },
}
const t = key => words[props.locale]?.[key] ?? words.en[key]
const activeGroupId = ref(CONNECTION_GROUPS[0]?.id ?? '')
const search = ref('')
const selectedByGroup = reactive(Object.fromEntries(CONNECTION_GROUPS.map(group => [
  group.id,
  CONNECTION_TYPES.find(connection => connection.group === group.id)?.id ?? '',
])))

const activeGroup = computed(() => CONNECTION_GROUPS.find(group => group.id === activeGroupId.value) ?? CONNECTION_GROUPS[0])
const selectedConnection = computed(() => CONNECTION_TYPES.find(connection => connection.id === selectedByGroup[activeGroupId.value]))
const selectedFamily = computed(() => CONNECTION_FAMILIES.find(family => family.id === selectedConnection.value?.family))
const visibleFamilies = computed(() => {
  const query = normalizeSearch(search.value)
  return CONNECTION_FAMILIES.filter(family => family.group === activeGroupId.value).map(family => {
    const connections = CONNECTION_TYPES.filter(connection => connection.family === family.id)
    const familyMatches = query && matchesSearch(query, [family.name_en, family.name_vi, family.id])
    return {
      ...family,
      connections: connections.filter(connection => !query || familyMatches || matchesSearch(query, [connection.name_en, connection.name_vi, connection.id])),
    }
  }).filter(family => family.connections.length)
})
const visibleConnectionCount = computed(() => visibleFamilies.value.reduce((sum, family) => sum + family.connections.length, 0))

function label(entry) {
  return props.locale === 'vi' ? entry?.name_vi || entry?.name_en || '' : entry?.name_en || entry?.name_vi || ''
}
function groupLabel(group) {
  return t(group.id) || label(group)
}
function familyThumbnail(family) {
  if (family.group === 'anchorage') return 'base'
  if (family.id === 'moment' || family.id === 'seismic') return 'moment'
  if (family.id === 'simple_shear') return 'shear'
  return 'simple'
}
function selectConnection(connection) {
  selectedByGroup[connection.group] = connection.id
}
function selectGroup(groupId) {
  activeGroupId.value = groupId
  search.value = ''
}
function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().replace(/đ/g, 'd').trim()
}
function matchesSearch(query, fields) {
  return fields.some(value => normalizeSearch(value).includes(query))
}
</script>

<template>
  <section class="steel-connection-menu steel-design-panel" role="tabpanel" :aria-label="t('title')">
    <header class="connection-catalog-heading">
      <h3>{{ t('title') }}</h3>
      <p>{{ t('description') }}</p>
    </header>

    <div class="connection-group-tabs" role="group" :aria-label="t('groupLabel')">
      <button
        v-for="group in CONNECTION_GROUPS"
        :key="group.id"
        type="button"
        class="connection-group-tab"
        :class="{ selected: activeGroupId === group.id }"
        :data-group="group.id"
        :aria-pressed="activeGroupId === group.id"
        @click="selectGroup(group.id)"
      >
        <ConnectionThumbnail :thumbnail="group.id === 'anchorage' ? 'base' : 'simple'" :group="group.id" :label="groupLabel(group)" />
        <span class="connection-group-copy"><strong>{{ groupLabel(group) }}</strong><small>{{ CONNECTION_TYPES.filter(connection => connection.group === group.id).length }}</small></span>
      </button>
    </div>

    <div class="connection-catalog-tools">
      <label>
        <span>{{ t('searchLabel') }}</span>
        <input v-model="search" type="search" :placeholder="t('searchPlaceholder')" />
      </label>
      <span class="connection-count" aria-live="polite">{{ visibleConnectionCount }} {{ t('types') }}</span>
    </div>

    <div v-if="activeGroup" class="connection-catalog-content">
      <header class="connection-active-group-heading">
        <div>
          <h4>{{ groupLabel(activeGroup) }}</h4>
          <p>{{ props.locale === 'vi' ? activeGroup.description_vi : activeGroup.description_en }}</p>
        </div>
      </header>

      <p v-if="visibleConnectionCount === 0" class="connection-no-results">{{ t('noResults') }}</p>
      <section v-for="family in visibleFamilies" :key="family.id" class="connection-family">
        <header class="connection-family-heading">
          <ConnectionThumbnail :thumbnail="familyThumbnail(family)" :group="family.group" :label="label(family)" />
          <div>
            <h5>{{ label(family) }}</h5>
            <p>{{ family.connections.length }} · {{ t('types') }}</p>
          </div>
        </header>
        <div class="connection-card-grid">
          <button
            v-for="connection in family.connections"
            :key="connection.id"
            type="button"
            class="connection-type-card"
            :class="{ selected: selectedByGroup[connection.group] === connection.id }"
            :data-connection="connection.id"
            :aria-label="label(connection)"
            :aria-pressed="selectedByGroup[connection.group] === connection.id"
            @click="selectConnection(connection)"
          >
            <ConnectionThumbnail :connection="connection" :label="label(connection)" />
            <span class="connection-type-copy"><strong>{{ label(connection) }}</strong><small>{{ t('prepared') }}</small></span>
          </button>
        </div>
      </section>
    </div>

    <section v-if="selectedConnection" class="connection-workspace" :data-connection="selectedConnection.id" :aria-label="t('workspace')" aria-live="polite">
      <ConnectionThumbnail class="connection-workspace-image" :connection="selectedConnection" :label="label(selectedConnection)" />
      <div class="connection-workspace-copy">
        <span v-if="selectedFamily" class="connection-workspace-family">{{ label(selectedFamily) }}</span>
        <h4>{{ label(selectedConnection) }}</h4>
        <p>{{ t('pending') }}</p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.steel-connection-menu { margin-top: 14px; padding: 22px; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--surface-bg); }
.connection-catalog-heading h3 { margin: 0; color: #203b58; font-size: 21px; }
.connection-catalog-heading p { margin: 7px 0 18px; color: var(--muted-ink); font-size: 16px; }
.connection-group-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.connection-group-tab { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 12px; border: 1px solid var(--surface-border); border-radius: 10px; background: var(--workspace-bg); color: #23395d; text-align: left; font: inherit; cursor: pointer; }
.connection-group-tab.selected, .connection-group-tab:hover { border-color: #23395d; background: #23395d; color: #fff; }
.connection-group-tab:focus-visible, .connection-type-card:focus-visible { outline: 3px solid #8bb6df; outline-offset: 3px; }
.connection-group-tab :deep(.connection-thumbnail) { flex: 0 0 82px; width: 82px; }
.connection-group-copy { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.connection-group-copy strong { font-size: 17px; line-height: 1.35; }
.connection-group-copy small { flex: 0 0 auto; padding: 3px 7px; border-radius: 20px; background: rgb(255 255 255 / 17%); font-size: 12px; }
.connection-catalog-tools { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin: 16px 0 20px; }
.connection-catalog-tools label { display: grid; flex: 1; gap: 5px; max-width: 460px; color: var(--muted-ink); font-size: 13px; }
.connection-catalog-tools input { min-height: 42px; padding: 8px 11px; border: 1px solid var(--surface-border); border-radius: 7px; background: var(--workspace-bg); color: #23395d; font: inherit; }
.connection-count { padding: 8px 11px; border-radius: 7px; background: var(--workspace-bg); color: var(--muted-ink); font-size: 13px; }
.connection-active-group-heading { margin-bottom: 15px; }
.connection-active-group-heading h4 { margin: 0; color: #203b58; font-size: 19px; }
.connection-active-group-heading p { margin: 4px 0 0; color: var(--muted-ink); font-size: 14px; line-height: 1.5; }
.connection-family { margin-top: 18px; }
.connection-family-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.connection-family-heading :deep(.connection-thumbnail) { flex: 0 0 54px; width: 54px; border-radius: 7px; }
.connection-family-heading h5 { margin: 0; color: #52738f; font-size: 15px; }
.connection-family-heading p { margin: 3px 0 0; color: var(--muted-ink); font-size: 12px; }
.connection-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.connection-type-card { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 112px; padding: 10px; border: 1px solid var(--surface-border); border-radius: 9px; background: var(--workspace-bg); color: #23395d; text-align: left; font: inherit; cursor: pointer; transition: border-color .15s, background .15s, color .15s; }
.connection-type-card:hover, .connection-type-card.selected { border-color: #23395d; background: #23395d; color: #fff; }
.connection-type-card :deep(.connection-thumbnail) { flex: 0 0 88px; width: 88px; }
.connection-type-copy { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.connection-type-copy strong { font-size: 15px; line-height: 1.35; }
.connection-type-copy small { font-size: 12px; line-height: 1.35; opacity: .75; }
.connection-no-results { padding: 18px; border-radius: 8px; background: var(--workspace-bg); color: var(--muted-ink); }
.connection-workspace { display: flex; align-items: center; gap: 18px; margin-top: 22px; padding: 17px; border: 1px solid #a6b8ca; border-radius: 10px; background: var(--workspace-bg); }
.connection-workspace :deep(.connection-thumbnail) { flex: 0 0 132px; width: 132px; }
.connection-workspace-copy { min-width: 0; }
.connection-workspace-family { color: #52738f; font-size: 13px; font-weight: 650; }
.connection-workspace h4 { margin: 3px 0 5px; color: #203b58; font-size: 19px; }
.connection-workspace p { margin: 0; color: var(--muted-ink); line-height: 1.5; }
@media (max-width: 1040px) { .connection-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 650px) {
  .steel-connection-menu { padding: 16px 12px; }
  .connection-group-tabs { grid-template-columns: 1fr; gap: 8px; }
  .connection-card-grid { grid-template-columns: 1fr; gap: 9px; }
  .connection-type-card { min-height: 94px; padding: 9px; }
  .connection-type-card :deep(.connection-thumbnail) { flex-basis: 76px; width: 76px; }
  .connection-workspace { align-items: flex-start; gap: 12px; padding: 12px; }
  .connection-workspace :deep(.connection-thumbnail) { flex-basis: 86px; width: 86px; }
}
@media (prefers-reduced-motion: reduce) { .connection-type-card { transition: none; } }
</style>
