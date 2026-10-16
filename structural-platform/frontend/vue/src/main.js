import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

// Preserve the published standards picker without enabling the preview in the live backend.
if (import.meta.env.VITE_DEMO_MODE === 'true') import('./demo/standards-preview.js')

// Keep the test label visible even when an existing local gateway has not reloaded.
if (window.location.hostname === 'geekcalculus.test') {
  const marker = document.createElement('script')
  marker.src = `${import.meta.env.BASE_URL}test-environment.js`
  document.head.append(marker)
}
