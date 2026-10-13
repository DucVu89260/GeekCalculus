<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { request, demoMode, clearSessionToken } from './api'
import { copy } from './i18n'
import LoginView from './components/LoginView.vue'
import InterfaceChooser from './components/InterfaceChooser.vue'
import WorkspaceView from './components/WorkspaceView.vue'
import AdminConsole from './components/AdminConsole.vue'
import ModuleHub from './components/ModuleHub.vue'
import { moduleFromHash } from './modules'

const locale = ref(localStorage.getItem('geekcalculus-locale') === 'en' ? 'en' : 'vi')
const user = ref(null)
const surface = ref('chooser')
const moduleCode = ref(moduleFromHash())
const authLoading = ref(true)
const signingIn = ref(false)
const authErrorKey = ref('')
const t = (key) => copy[locale.value]?.[key] ?? copy.en[key] ?? key
const isAdmin = computed(() => user.value?.role === 'admin')

function readUser(payload) {
  return payload?.data?.user ?? payload?.data ?? payload?.user ?? null
}

function setSession(sessionUser) {
  const sameAccount = user.value?.id === sessionUser.id
  user.value = sessionUser
  authErrorKey.value = ''
  if (moduleCode.value) surface.value = 'module'
  else if (!sameAccount || (surface.value === 'admin' && sessionUser.role !== 'admin')) surface.value = sessionUser.role === 'admin' ? 'chooser' : 'usage'
}

function authErrorKeyFor(error) {
  if (error?.message === 'Invalid email or password.') return 'authInvalidCredentials'
  if (error?.status === 422) {
    const fields = error.errors ?? {}
    if (fields.email) return 'authInvalidEmail'
    if (fields.password) return 'authInvalidPassword'
    return 'authValidationError'
  }
  if (error?.status === 429) return 'authTooManyAttempts'
  if (error?.status === 401 || error?.status === 403) return 'authInvalidCredentials'
  if (error?.status >= 500) return 'authServerError'
  return 'authInvalidCredentials'
}

async function restoreSession() {
  try {
    const payload = await request('/api/auth/me')
    const sessionUser = readUser(payload)
    if (sessionUser && typeof sessionUser === 'object' && sessionUser.role) setSession(sessionUser)
    else user.value = null
  } catch {
    user.value = null
  } finally {
    authLoading.value = false
  }
}

function handleSessionExpired() {
  clearSessionToken()
  if (!user.value) return
  user.value = null
  surface.value = 'chooser'
  authErrorKey.value = 'authSessionExpired'
}

async function signIn(credentials) {
  authErrorKey.value = ''
  signingIn.value = true
  try {
    const payload = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    let sessionUser = readUser(payload)
    if (!sessionUser) sessionUser = readUser(await request('/api/auth/me'))
    if (!sessionUser || !sessionUser.role) throw new Error('Missing authenticated user')
    setSession(sessionUser)
    localStorage.setItem('geekcalculus-login', String(Date.now()))
  } catch (error) {
    authErrorKey.value = authErrorKeyFor(error)
  } finally {
    signingIn.value = false
  }
}

async function signOut() {
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    if (error?.status !== 401) { authErrorKey.value = 'authServerError'; return }
  }
  user.value = null
  surface.value = 'chooser'
  authErrorKey.value = ''
  localStorage.setItem('geekcalculus-logout', String(Date.now()))
}

function syncModuleRoute() {
  moduleCode.value = moduleFromHash()
  if (user.value) {
    if (moduleCode.value) surface.value = 'module'
    else if (surface.value === 'module') surface.value = 'usage'
  }
}

function handleStorage(event) {
  if (event.key === 'geekcalculus-logout') { clearSessionToken(); user.value = null; surface.value = 'chooser'; authErrorKey.value = '' }
  else if (event.key === 'geekcalculus-login' || (demoMode && event.key === 'geekcalculus-demo-session-v1')) { clearSessionToken(); restoreSession() }
}

function selectInterface(selected) {
  if (selected === 'admin' && !isAdmin.value) return
  window.location.hash = ''
  moduleCode.value = null
  surface.value = selected
}

function changeLocale(nextLocale) {
  if (nextLocale === 'vi' || nextLocale === 'en') locale.value = nextLocale
}

watch(locale, (nextLocale) => {
  localStorage.setItem('geekcalculus-locale', nextLocale)
  document.documentElement.lang = nextLocale
  document.title = nextLocale === 'vi' ? 'GeekCalculus — Không gian kết cấu' : 'GeekCalculus — Structural workspace'
})

onMounted(() => {
  window.addEventListener('geekcalculus-session-expired', handleSessionExpired)
  window.addEventListener('hashchange', syncModuleRoute)
  window.addEventListener('storage', handleStorage)
  document.documentElement.lang = locale.value
  document.title = locale.value === 'vi' ? 'GeekCalculus — Không gian kết cấu' : 'GeekCalculus — Structural workspace'
  restoreSession()
})

onUnmounted(() => {
  window.removeEventListener('geekcalculus-session-expired', handleSessionExpired)
  window.removeEventListener('hashchange', syncModuleRoute)
  window.removeEventListener('storage', handleStorage)
})
</script>

<template>
  <p v-if="user && authErrorKey" class="auth-error" role="alert">{{ t(authErrorKey) }}</p>
  <main v-if="authLoading" class="auth-loading" role="status" :aria-label="t('loading')">
    <span class="auth-spinner"></span><span>{{ t('loading') }}</span>
  </main>
  <LoginView
    v-else-if="!user"
    :locale="locale"
    :demo-mode="demoMode"
    :loading="signingIn"
    :error-key="authErrorKey"
    @change-locale="changeLocale"
    @submit="signIn"
  />
  <InterfaceChooser
    v-else-if="surface === 'chooser' && isAdmin"
    :locale="locale"
    :user="user"
    @change-locale="changeLocale"
    @select="selectInterface"
    @sign-out="signOut"
  />
  <AdminConsole
    v-else-if="surface === 'admin' && isAdmin"
    v-model:locale="locale"
    :user="user"
    @usage="selectInterface('usage')"
    @choose-interface="selectInterface('chooser')"
    @sign-out="signOut"
  />
  <ModuleHub
    v-else-if="surface === 'module' && moduleCode"
    v-model:locale="locale"
    :module-code="moduleCode"
    :user="user"
    :is-admin="isAdmin"
    @home="selectInterface('usage')"
    @open-admin="selectInterface('admin')"
    @sign-out="signOut"
  />
  <WorkspaceView
    v-else
    v-model:locale="locale"
    :user="user"
    :is-admin="isAdmin"
    @open-admin="selectInterface('admin')"
    @sign-out="signOut"
  />
</template>
