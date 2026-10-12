<script setup>
import { copy } from '../i18n'

const props = defineProps({ locale: { type: String, required: true }, user: { type: Object, required: true } })
const emit = defineEmits(['select', 'sign-out', 'change-locale'])
const t = (key) => copy[props.locale]?.[key] ?? copy.en[key] ?? key
</script>

<template>
  <main class="interface-page">
    <header class="auth-topline interface-topline">
      <a class="auth-wordmark auth-wordmark-dark" href="#interface-choice">GeekCalculus<span>.</span></a>
      <div class="interface-top-actions">
        <span class="signed-in-label">{{ user.name || user.email }}</span>
        <div class="language-switch" role="group" :aria-label="t('language')">
          <button type="button" :aria-pressed="locale === 'vi'" @click="emit('change-locale', 'vi')">VI</button>
          <button type="button" :aria-pressed="locale === 'en'" @click="emit('change-locale', 'en')">EN</button>
        </div>
        <button type="button" class="quiet-button" @click="emit('sign-out')">{{ t('signOut') }}</button>
      </div>
    </header>

    <section id="interface-choice" class="chooser-card">
      <span class="auth-eyebrow">{{ t('interfaceEyebrow') }}</span>
      <h1>{{ t('chooseInterfaceTitle') }}</h1>
      <p class="chooser-subtitle">{{ t('chooseInterfaceSubtitle') }}</p>
      <div class="interface-options">
        <button type="button" class="interface-option admin-option" @click="emit('select', 'admin')">
          <span class="interface-icon"><svg viewBox="0 0 24 24"><path d="M4 19.5V5.8A1.8 1.8 0 0 1 5.8 4h12.4A1.8 1.8 0 0 1 20 5.8v13.7M8 8h8M8 12h5M8 16h3M3 20h18"/></svg></span>
          <span class="interface-option-copy"><strong>{{ t('adminInterface') }}</strong><small>{{ t('adminInterfaceDescription') }}</small></span>
          <span class="interface-arrow">↗</span>
        </button>
        <button type="button" class="interface-option usage-option" @click="emit('select', 'usage')">
          <span class="interface-icon"><svg viewBox="0 0 24 24"><path d="M4 19V5l8-2 8 2v14l-8 2-8-2Z"/><path d="m4 5 8 2 8-2M12 7v14M8 11h1m6 2h1m-8 2h1"/></svg></span>
          <span class="interface-option-copy"><strong>{{ t('usageInterface') }}</strong><small>{{ t('usageInterfaceDescription') }}</small></span>
          <span class="interface-arrow">↗</span>
        </button>
      </div>
      <div class="role-note"><span class="role-indicator"></span>{{ t('adminRoleConfirmed') }}</div>
    </section>
  </main>
</template>
