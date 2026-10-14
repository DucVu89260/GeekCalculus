import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

// Preserve the published standards picker without enabling the preview in the live backend.
if (import.meta.env.VITE_DEMO_MODE === 'true') import('./demo/standards-preview.js')
