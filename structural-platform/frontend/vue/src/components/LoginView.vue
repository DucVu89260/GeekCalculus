<script setup>
import { computed, ref } from 'vue'
import { copy } from '../i18n'

const props = defineProps({
  locale: { type: String, required: true },
  errorKey: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  demoMode: { type: Boolean, default: false },
})
const emit = defineEmits(['submit', 'change-locale'])
const email = ref('')
const password = ref('')
const t = (key) => copy[props.locale]?.[key] ?? copy.en[key] ?? key
const errorText = computed(() => props.errorKey ? t(props.errorKey) : '')

function useDemoAccount(role) {
  email.value = role === 'admin' ? 'admin@demo.geekcalculus.test' : 'user@demo.geekcalculus.test'
  password.value = 'demo'
}

function submit() {
  emit('submit', { email: email.value.trim(), password: password.value })
}
</script>

<template>
  <main class="auth-page login-page">
    <section class="login-visual" :aria-label="t('authVisualTitle')">
      <div class="visual-grid"></div>
      <div class="visual-content">
        <a class="auth-wordmark auth-wordmark-light" href="#login">GeekCalculus<span>.</span></a>
        <div class="visual-copy">
          <span class="visual-kicker">{{ t('authVisualKicker') }}</span>
          <h1>{{ t('authVisualTitle') }}</h1>
          <p>{{ t('authVisualSubtitle') }}</p>
        </div>
        <div class="visual-caption"><span class="visual-caption-dot"></span>{{ t('authVisualCaption') }}</div>
      </div>
    </section>

    <section id="login" class="login-side">
      <header class="auth-topline">
        <span class="auth-wordmark auth-wordmark-dark">GeekCalculus<span>.</span></span>
        <div class="language-switch" role="group" :aria-label="t('language')">
          <button type="button" :aria-pressed="locale === 'vi'" @click="emit('change-locale', 'vi')">VI</button>
          <button type="button" :aria-pressed="locale === 'en'" @click="emit('change-locale', 'en')">EN</button>
        </div>
      </header>

      <div class="login-card">
        <div class="login-heading">
          <span class="auth-eyebrow">{{ t('authEyebrow') }}</span>
          <h2>{{ t('authTitle') }}</h2>
          <p>{{ t('authSubtitle') }}</p>
        </div>

        <form class="login-form" @submit.prevent="submit">
          <label class="auth-field">
            <span>{{ t('authEmail') }}</span>
            <input v-model="email" type="email" name="email" autocomplete="username" required :placeholder="t('authEmailPlaceholder')" />
          </label>
          <label class="auth-field">
            <span>{{ t('authPassword') }}</span>
            <input v-model="password" type="password" name="password" autocomplete="current-password" required :placeholder="t('authPasswordPlaceholder')" />
          </label>
          <p v-if="errorText" class="auth-error" role="alert">{{ errorText }}</p>
          <button class="primary-button auth-submit" type="submit" :disabled="loading">
            <span v-if="loading" class="auth-spinner" aria-hidden="true"></span>
            {{ loading ? t('authSigningIn') : t('authSignIn') }}
            <span v-if="!loading" aria-hidden="true">↗</span>
          </button>
        </form>

        <section v-if="demoMode" class="demo-login-note" :aria-label="t('demoLoginTitle')">
          <div class="demo-note-heading"><span class="demo-lock">!</span><div><strong>{{ t('demoLoginTitle') }}</strong><p>{{ t('demoLoginWarning') }}</p></div></div>
          <div class="demo-account-actions">
            <button type="button" class="demo-account-button" @click="useDemoAccount('admin')"><span><strong>{{ t('demoAdmin') }}</strong><small>admin@demo.geekcalculus.test</small></span><i>↗</i></button>
            <button type="button" class="demo-account-button" @click="useDemoAccount('user')"><span><strong>{{ t('demoUser') }}</strong><small>user@demo.geekcalculus.test</small></span><i>↗</i></button>
          </div>
          <p class="demo-password-hint">{{ t('demoPasswordHint') }}</p>
        </section>
        <p v-else class="auth-account-setup">{{ t('authAccountSetup') }}</p>
      </div>

      <footer class="auth-footer"><span>{{ t('authFooter') }}</span><span>© 2026 GeekCalculus</span></footer>
    </section>
  </main>
</template>
