import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initTheme } from './stores/theme'
import './styles/base.css'

initTheme()

createApp(App).use(createPinia()).mount('#app')
