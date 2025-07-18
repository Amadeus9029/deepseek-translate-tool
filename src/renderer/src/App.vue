<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'
import TextTranslate from './pages/TextTranslate.vue'
import DocumentTranslate from './pages/DocumentTranslate.vue'
import VideoTranslate from './pages/VideoTranslate.vue'
import TranslateLog from './pages/TranslateLog.vue'
import TranslateResults from './pages/TranslateResults.vue'
import Settings from './pages/Settings.vue'
import About from './pages/About.vue'
import DocxParser from './pages/DocxParser.vue'
import { settings } from './services/SettingsService'
import TitleBar from './components/layout/TitleBar.vue'
import Sidebar from './components/layout/Sidebar.vue'
import MainContent from './components/layout/MainContent.vue'
import { i18n } from './i18n'
import { setI18nLanguage } from './i18n'

const drawer = ref(true)
const isMaximized = ref(false)
const { t } = useI18n()

const menuItems = computed(() => [
  { key: 'textTranslate', title: t('menu.textTranslate'), icon: 'mdi-translate' },
  { key: 'documentTranslate', title: t('menu.documentTranslate'), icon: 'mdi-file-document' },
  { key: 'videoTranslate', title: t('menu.videoTranslate'), icon: 'mdi-video' },
  { key: 'translateResults', title: t('menu.translateResults'), icon: 'mdi-text-box-check' },
  { key: 'logs', title: t('menu.logs'), icon: 'mdi-file-document-edit' },
  // { key: 'docxParser', title: 'Word解析', icon: 'mdi-xml' },
  { key: 'settings', title: t('menu.settings'), icon: 'mdi-cog' },
  { key: 'about', title: t('menu.about'), icon: 'mdi-information' }
])

const selectedMenu = ref('textTranslate')
const isAlwaysOnTop = ref(false)
const theme = useTheme()

// 计算当前是否是深色模式
const isDark = computed(() => theme.global.current.value.dark)

// 添加一个key来强制重新渲染组件
const componentKey = computed(() => `${selectedMenu.value}`)

// 监听菜单切换时应用主题
watch(selectedMenu, () => {
  applyThemeFromSettings()
})

// 监听语言变化，更新selectedMenu
watch(() => t('menu.textTranslate'), () => {
  // 找到当前选中菜单项对应的新翻译
  const currentMenuIndex = menuItems.value.findIndex(item => item.key === selectedMenu.value)
  if (currentMenuIndex >= 0) {
    // 更新选中的菜单项
    selectedMenu.value = menuItems.value[currentMenuIndex].key
  }
}, { immediate: true })

// 监听全局设置的主题和语言变化，确保切换立即生效
watch(() => settings.value.themeMode, () => {
  applyThemeFromSettings()
})

watch(() => settings.value.language, async (newLang) => {
  await setI18nLanguage(newLang)
  // 强制刷新menuItems依赖的t()
  menuItems.value // 触发computed重新计算
})

// 从设置中获取并应用主题
const applyThemeFromSettings = () => {
  const themeMode = settings.value.themeMode || localStorage.getItem('theme-mode') || 'system'
  
  if (themeMode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.global.name.value = prefersDark ? 'dark' : 'light'
  } else {
    theme.global.name.value = themeMode
  }
}

// 在组件挂载时应用主题
onMounted(() => {
  applyThemeFromSettings()
})

// 根据选中的菜单返回对应的组件
const currentComponent = computed(() => {
  switch (selectedMenu.value) {
    case 'textTranslate':
      return TextTranslate
    case 'documentTranslate':
      return DocumentTranslate
    case 'videoTranslate':
      return VideoTranslate
    case 'translateResults':
      return TranslateResults
    case 'logs':
      return TranslateLog
    // case 'docxParser':
    //   return DocxParser
    case 'settings':
      return Settings
    case 'about':
      return About
    default:
      return TextTranslate
  }
})

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 窗口控制方法
const minimize = () => ipcRenderer && ipcRenderer.send('window-minimize')
const toggleMaximize = () => {
  if (ipcRenderer) {
    ipcRenderer.send('window-maximize')
    isMaximized.value = !isMaximized.value
  }
}
const close = () => ipcRenderer && ipcRenderer.send('window-close')
const toggleAlwaysOnTop = () => {
  isAlwaysOnTop.value = !isAlwaysOnTop.value
  ipcRenderer && ipcRenderer.send('window-toggle-always-on-top')
}

// 菜单选择处理
const handleMenuSelect = (menuKey: string) => {
  selectedMenu.value = menuKey
}

// 监听窗口状态变化
if (ipcRenderer) {
  ipcRenderer.on('window-maximized', () => {
    isMaximized.value = true
  })
  ipcRenderer.on('window-unmaximized', () => {
    isMaximized.value = false
  })
  
  // 监听页面切换请求
  ipcRenderer.on('change-page', (_, page) => {
    // 查找对应的菜单项
    const menuItem = menuItems.value.find(item => {
      // 检查英文菜单名称是否匹配
      if (page === 'Text Translation' || page === 'Document Translation' || 
          page === 'Subtitle Translation' || page === 'Translation Results' || 
          page === 'Logs' || page === 'Settings' || page === 'About') {
        return item.title.toLowerCase().includes(page.toLowerCase())
      }
      // 检查中文菜单名称是否匹配
      return item.title === page
    })
    
    if (menuItem) {
      selectedMenu.value = menuItem.key
    }
  })
}
</script>

<template>
  <div class="app-root">
    <!-- 顶部自定义标题栏 -->
    <TitleBar 
      :is-maximized="isMaximized" 
      :is-always-on-top="isAlwaysOnTop" 
      @minimize="minimize"
      @toggle-maximize="toggleMaximize"
      @close="close"
      @toggle-always-on-top="toggleAlwaysOnTop"
    />
    
    <!-- Vuetify应用内容 -->
    <v-app>
      <div class="app-content">
        <!-- 侧边栏 -->
        <Sidebar 
          :selected-menu="selectedMenu" 
          :menu-items="menuItems"
          @menu-select="handleMenuSelect"
        />
        
        <!-- 主内容区 -->
        <MainContent 
          :selected-menu="selectedMenu"
          :component-key="componentKey"
          :current-component="currentComponent"
          :menu-items="menuItems"
        />
      </div>
    </v-app>
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.app-content {
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
}

.v-app {
  padding-top: 40px !important; /* 让整个应用内容下移，避开顶部标题栏 */
  height: calc(100vh - 40px);
  box-sizing: border-box;
}
</style>

<style>
body, html {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
}

#app {
  margin: 0;
  padding: 0;
  height: 100vh;
  background: rgb(var(--v-theme-background));
}

.v-application {
  background: rgb(var(--v-theme-background));
  background-image: none !important;
}

.translate-card {
  width: 100%;
  max-height: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  margin: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 16px 24px;
  border: 1px solid rgb(var(--v-theme-surface-variant));
}

.translate-title {
  font-size: 24px;
  font-weight: bold;
  padding-bottom: 16px;
}

.translate-page-wrapper {
  flex: 1 1 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  background: transparent;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>
