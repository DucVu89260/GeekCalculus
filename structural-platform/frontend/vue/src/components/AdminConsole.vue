<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { request } from '../api'
import { copy } from '../i18n'
import LibraryBrowser from './LibraryBrowser.vue'

const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['usage', 'choose-interface', 'sign-out'])
const locale = defineModel('locale', { type: String, required: true })
const t = (key) => copy[locale.value]?.[key] ?? copy.en[key] ?? key
const activeTab = ref('database')
const users = ref([])
const usersLoading = ref(false)
const usersError = ref(false)
const userMessageKey = ref('')
const userErrorKey = ref('')
const formOpen = ref(false)
const saving = ref(false)
const deletingId = ref(null)
const editUser = reactive({ id: null, name: '', email: '', role: 'user', password: '' })
let usersRequestId = 0

const adminCount = computed(() => users.value.filter((item) => item.role === 'admin').length)
const editingOnlyAdmin = computed(() => editUser.id != null && editUser.role === 'admin' && adminCount.value <= 1)

function unwrapRows(payload) {
  const data = payload?.data ?? payload
  return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
}

async function loadUsers() {
  const requestId = ++usersRequestId
  usersLoading.value = true
  usersError.value = false
  userErrorKey.value = ''
  try {
    const payload = await request('/api/admin/users')
    if (requestId !== usersRequestId) return
    users.value = unwrapRows(payload)
  } catch {
    if (requestId === usersRequestId) usersError.value = true
  } finally {
    if (requestId === usersRequestId) usersLoading.value = false
  }
}

function setTab(tab) {
  activeTab.value = tab
  if (tab === 'users' && !users.value.length && !usersLoading.value) loadUsers()
}

function openUserForm(user = null) {
  userMessageKey.value = ''
  userErrorKey.value = ''
  Object.assign(editUser, {
    id: user?.id ?? null,
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'user',
    password: '',
  })
  formOpen.value = true
}

async function saveUser() {
  userMessageKey.value = ''
  userErrorKey.value = ''
  if (editUser.password && editUser.password.length < 12) {
    userErrorKey.value = 'passwordTooShort'
    return
  }
  const editing = editUser.id !== null
  const body = { name: editUser.name.trim(), email: editUser.email.trim(), role: editUser.role }
  if (editUser.password) body.password = editUser.password
  saving.value = true
  try {
    await request(editing ? `/api/admin/users/${encodeURIComponent(editUser.id)}` : '/api/admin/users', {
      method: editing ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    })
    formOpen.value = false
    await loadUsers()
    if (!usersError.value) userMessageKey.value = editing ? 'userUpdated' : 'userCreated'
  } catch (error) {
    if (error?.status === 422) userErrorKey.value = 'validationError'
    else if (error?.status === 403) userErrorKey.value = error?.errors?.role ? 'lastAdminGuard' : 'readOnlyMessage'
    else if (error?.status === 409) userErrorKey.value = 'lastAdminGuard'
    else userErrorKey.value = 'userOperationError'
  } finally {
    saving.value = false
  }
}

async function deleteUser(user) {
  if (String(user.id) === String(props.user.id) || deletingId.value !== null) return
  if (!window.confirm(t('userDeleteConfirm'))) return
  deletingId.value = user.id
  userErrorKey.value = ''
  userMessageKey.value = ''
  try {
    await request(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
    await loadUsers()
    if (!usersError.value) userMessageKey.value = 'userDeleted'
  } catch (error) {
    if (error?.status === 409) userErrorKey.value = 'lastAdminGuard'
    else if (error?.status === 403) userErrorKey.value = 'cannotDeleteSelf'
    else userErrorKey.value = 'userOperationError'
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  if (activeTab.value === 'users') loadUsers()
})
</script>

<template>
  <div class="admin-page">
    <header class="admin-topbar">
      <a class="wordmark" href="#admin-home">GeekCalculus<span class="brand-dot">.</span><small>{{ t('adminWorkspace') }}</small></a>
      <div class="admin-top-actions">
        <span class="signed-in-label">{{ user.name || user.email }}</span>
        <div class="language-switch" role="group" :aria-label="t('language')">
          <button type="button" :aria-pressed="locale === 'vi'" @click="locale = 'vi'">VI</button>
          <button type="button" :aria-pressed="locale === 'en'" @click="locale = 'en'">EN</button>
        </div>
        <button type="button" class="quiet-button" @click="emit('usage')">{{ t('usageInterfaceButton') }}</button>
        <button type="button" class="quiet-button" @click="emit('choose-interface')">{{ t('changeInterface') }}</button>
        <button type="button" class="quiet-button sign-out-button" @click="emit('sign-out')">{{ t('signOut') }}</button>
      </div>
    </header>

    <main id="admin-home" class="admin-content">
      <div class="admin-heading"><div><span class="auth-eyebrow">{{ t('adminWorkspace') }}</span><h1>{{ t('adminSubtitle') }}</h1><p>{{ t('databaseSubtitle') }}</p></div><div class="admin-role-badge"><span></span>{{ t('roleAdmin') }}</div></div>

      <nav class="admin-tabs" role="tablist" :aria-label="t('adminWorkspace')">
        <button type="button" role="tab" :aria-selected="activeTab === 'database'" :class="{ active: activeTab === 'database' }" @click="setTab('database')">{{ t('databaseTab') }}</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'users'" :class="{ active: activeTab === 'users' }" @click="setTab('users')">{{ t('usersTab') }}</button>
      </nav>

      <section v-if="activeTab === 'database'" class="admin-panel">
        <LibraryBrowser :locale="locale" :can-edit="true" />
      </section>

      <section v-else class="admin-panel user-admin-panel">
        <div class="user-admin-heading"><div><h2>{{ t('accountManagement') }}</h2><p>{{ t('accountSubtitle') }}</p></div><button type="button" class="primary-button" @click="openUserForm()">＋ {{ t('createUser') }}</button></div>
        <p v-if="userErrorKey" class="library-message error-message" role="alert">{{ t(userErrorKey) }}</p>
        <p v-else-if="userMessageKey" class="library-message success-message" role="status">{{ t(userMessageKey) }}</p>
        <div v-if="usersLoading" class="library-empty" role="status"><span class="auth-spinner"></span>{{ t('loading') }}</div>
        <div v-else-if="usersError" class="library-empty"><p class="error-message">{{ t('usersError') }}</p><button type="button" class="quiet-button" @click="loadUsers">{{ t('retry') }}</button></div>
        <div v-else-if="!users.length" class="library-empty">{{ t('noUsers') }}</div>
        <div v-else class="library-table-wrap">
          <table class="library-table user-table"><thead><tr><th>{{ t('userName') }}</th><th>{{ t('email') }}</th><th>{{ t('role') }}</th><th>{{ t('actions') }}</th></tr></thead>
            <tbody><tr v-for="item in users" :key="item.id"><td>{{ item.name }}</td><td>{{ item.email }}</td><td><span class="role-pill" :class="item.role">{{ t(item.role === 'admin' ? 'roleAdmin' : 'roleUser') }}</span><small v-if="String(item.id) === String(user.id)" class="self-label">{{ t('signedInAccount') }}</small></td><td class="library-actions"><button type="button" class="quiet-button" @click="openUserForm(item)">{{ t('editRecord') }}</button><button type="button" class="quiet-button danger-button" :disabled="String(item.id) === String(user.id) || deletingId === item.id" :aria-label="String(item.id) === String(user.id) ? t('cannotDeleteSelf') : t('deleteUser')" @click="deleteUser(item)">{{ t('deleteUser') }}</button></td></tr></tbody>
          </table>
        </div>
      </section>
    </main>

    <div v-if="formOpen" class="editor-backdrop" @click.self="formOpen = false">
      <section class="library-editor user-editor" role="dialog" aria-modal="true" :aria-label="t(editUser.id ? 'updateUser' : 'createUser')">
        <header class="editor-heading"><div><span class="auth-eyebrow">{{ t('accountManagement') }}</span><h2>{{ t(editUser.id ? 'updateUser' : 'createUser') }}</h2></div><button type="button" class="quiet-button editor-close" :aria-label="t('cancel')" @click="formOpen = false">×</button></header>
        <form class="editor-form" @submit.prevent="saveUser">
          <label class="field full-field"><span>{{ t('userName') }}<b>*</b></span><input v-model.trim="editUser.name" required maxlength="160" autocomplete="name" /></label>
          <label class="field full-field"><span>{{ t('email') }}<b>*</b></span><input v-model.trim="editUser.email" type="email" required maxlength="255" autocomplete="email" /></label>
          <label class="field full-field"><span>{{ t('role') }}<b>*</b></span><select v-model="editUser.role" required :disabled="editingOnlyAdmin"><option value="user">{{ t('roleUser') }}</option><option value="admin">{{ t('roleAdmin') }}</option></select><small v-if="editingOnlyAdmin" class="field-hint">{{ t('lastAdminGuard') }}</small></label>
          <label class="field full-field"><span>{{ t('password') }}<b v-if="!editUser.id">*</b></span><input v-model="editUser.password" type="password" :required="!editUser.id" minlength="12" maxlength="72" autocomplete="new-password" :placeholder="editUser.id ? t('passwordOptional') : t('userPasswordHint')" /></label>
          <p v-if="userErrorKey" class="error-message full-field" role="alert">{{ t(userErrorKey) }}</p>
          <footer class="editor-actions full-field"><button type="button" class="quiet-button" @click="formOpen = false">{{ t('cancel') }}</button><button type="submit" class="primary-button" :disabled="saving">{{ saving ? t('saving') : t(editUser.id ? 'updateUser' : 'createUser') }}</button></footer>
        </form>
      </section>
    </div>
  </div>
</template>
