import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
// Material Design Icons
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'
// i18n
import { i18n, initI18n } from './i18n'
// Components
import App from './App.vue'
import { initTranslateService } from './services/TranslateService'
import { settings, loadSettings } from './services/SettingsService'
import config from './config/config'

// 初始化翻译服务
initTranslateService(config.apiKey)

// 确保加载设置
loadSettings()

// 获取主题设置
const getThemeMode = () => {
  // 首先尝试从设置中获取
  if (settings.value.themeMode) {
    return settings.value.themeMode
  }
  
  // 其次尝试从localStorage获取
  const savedTheme = localStorage.getItem('theme-mode')
  if (savedTheme) {
    return savedTheme as 'system' | 'light' | 'dark'
  }
  
  // 默认使用system
  return 'system'
}

// 确定初始主题
const initialTheme = getThemeMode()
const effectiveTheme = initialTheme === 'system' 
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : initialTheme

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi
    }
  },
  theme: {
    defaultTheme: effectiveTheme,
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
        }
      },
      dark: {
        dark: true,
        colors: {
          primary: '#2196F3',
          secondary: '#424242',
        }
      }
    }
  }
})

// 创建Pinia实例
const pinia = createPinia()

// 初始化i18n
await initI18n()

// 创建Vue应用
const app = createApp(App)
app.use(vuetify)
app.use(pinia)
app.use(i18n)
app.mount('#app')

const updateTheme = (mode: string) => {
  localStorage.setItem('theme-mode', mode)
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    vuetify.theme.global.name.value = prefersDark ? 'dark' : 'light'
  } else {
    vuetify.theme.global.name.value = mode
  }
}

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (getThemeMode() === 'system') {
    vuetify.theme.global.name.value = e.matches ? 'dark' : 'light'
  }
})
