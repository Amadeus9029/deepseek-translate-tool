import './assets/main.css'

import { createApp } from 'vue'
// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
// Material Design Icons
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'
// Components
import App from './App.vue'
import { initTranslateService } from './services/TranslateService'
import config from './config/config'

// 初始化翻译服务
initTranslateService(config.apiKey)

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
    defaultTheme: 'light',
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

// 创建Vue应用
const app = createApp(App)
app.use(vuetify).mount('#app')

const updateTheme = (mode: string) => {
  localStorage.setItem('theme-mode', mode)
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    vuetify.theme.global.name.value = prefersDark ? 'dark' : 'light'
  } else {
    vuetify.theme.global.name.value = mode
  }
}

// 在组件初始化时读取存储的主题
const savedTheme = localStorage.getItem('theme-mode')
if (savedTheme) {
  vuetify.theme.global.name.value = savedTheme
  updateTheme(savedTheme)
}
