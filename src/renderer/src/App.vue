<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import TextTranslate from './pages/TextTranslate.vue'
import DocumentTranslate from './pages/DocumentTranslate.vue'
import VideoTranslate from './pages/VideoTranslate.vue'
import TranslateLog from './pages/TranslateLog.vue'
import TranslateResults from './pages/TranslateResults.vue'
import Settings from './pages/Settings.vue'
import About from './pages/About.vue'
import { settings } from './services/SettingsService'

const drawer = ref(true)
const isMaximized = ref(false)

const menuItems = [
  { title: '文本翻译', icon: 'mdi-translate' },
  { title: '文档翻译', icon: 'mdi-file-document' },
  // { title: '图片翻译', icon: 'mdi-image' },
  // { title: '语音翻译', icon: 'mdi-microphone' },
  { title: '字幕翻译', icon: 'mdi-video' },
  { title: '翻译结果', icon: 'mdi-text-box-check' },
  { title: '日志', icon: 'mdi-file-document-edit' },
  { title: '设置', icon: 'mdi-cog' },
  { title: '关于', icon: 'mdi-information' }
]

const selectedMenu = ref('文本翻译')
const isAlwaysOnTop = ref(false)
const theme = useTheme()

// 计算当前是否是深色模式
const isDark = computed(() => theme.global.current.value.dark)

// 添加一个key来强制重新渲染组件
const componentKey = ref(0)

// 监听菜单切换，当切换到日志或翻译结果时，强制重新渲染组件
watch(selectedMenu, (newValue) => {
  // 每次切换菜单都增加key值，强制重新渲染组件
  componentKey.value++
  
  // 从设置中获取当前主题设置并应用
  applyThemeFromSettings()
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
    case '文本翻译':
      return TextTranslate
    case '文档翻译':
      return DocumentTranslate
    case '字幕翻译':
      return VideoTranslate
    case '翻译结果':
      return TranslateResults
    case '日志':
      return TranslateLog
    case '设置':
      return Settings
    case '关于':
      return About
    default:
      return TextTranslate
  }
})

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
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
    selectedMenu.value = page
  })
}
</script>

<template>
  <div class="app-root">
    <!-- 顶部自定义标题栏，移到v-app外部 -->
    <div class="custom-title-bar" :class="{ 'theme--dark': isDark }" @dblclick="toggleMaximize">
      <div class="title-bar-left">
        <v-icon size="28" :color="isDark ? 'white' : 'primary'" class="app-logo">mdi-translate</v-icon>
        <span class="app-title">智能翻译工具</span>
      </div>
      <div class="title-bar-btns">
        <button class="title-btn" @click="toggleAlwaysOnTop" title="置顶">
          <v-icon size="18">{{ isAlwaysOnTop ? 'mdi-pin' : 'mdi-pin-outline' }}</v-icon>
        </button>
        <button class="title-btn" @click="minimize" title="最小化">
          <v-icon size="18">mdi-window-minimize</v-icon>
        </button>
        <button class="title-btn" @click="toggleMaximize" title="最大化/还原">
          <v-icon size="18">{{ isMaximized ? 'mdi-window-restore' : 'mdi-window-maximize' }}</v-icon>
        </button>
        <button class="title-btn close-btn" @click="close" title="关闭">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
    </div>
    <!-- Vuetify应用内容，必须用v-app包裹 -->
    <v-app>
      <div class="app-content">
        <!-- 侧边栏 -->
        <v-navigation-drawer
          v-model="drawer"
          permanent
          class="sidebar"
          :class="{ 'theme--dark': isDark }"
        >
          <div class="sidebar-header d-flex align-center">
            <v-icon size="32" :color="isDark ? 'white' : 'primary'" class="mr-2">mdi-translate</v-icon>
            <span class="app-title">智能翻译工具</span>
          </div>
          <v-list class="sidebar-list">
            <v-list-item
              v-for="item in menuItems"
              :key="item.title"
              :title="item.title"
              :prepend-icon="item.icon"
              :active="selectedMenu === item.title"
              @click="selectedMenu = item.title"
              class="sidebar-list-item"
              :class="{ 'sidebar-list-item--active': selectedMenu === item.title }"
            >
              <template #title>
                <span :class="{ 'active-title': selectedMenu === item.title }">{{ item.title }}</span>
              </template>
            </v-list-item>
          </v-list>
        </v-navigation-drawer>
        <!-- 主内容区 -->
        <div class="main-bg">
          <div class="main-header">
            <span class="main-title">{{ selectedMenu }}</span>
          </div>
          <v-main data-v-7a7a37b1 class="v-main no-scrollbar"
            style="--v-layout-left: 210px; --v-layout-right: 0px; --v-layout-top: 0px; --v-layout-bottom: 0px;">
            <div class="main-content-wrapper">
              <keep-alive>
                <component :is="currentComponent" :key="componentKey" />
              </keep-alive>
            </div>
          </v-main>
        </div>
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
.custom-title-bar {
  height: 40px;
  background: rgb(var(--v-theme-surface));
  /* border-bottom: 1px solid rgb(var(--v-theme-surface-variant)); */
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: drag;
  user-select: none;
  padding: 0 16px 0 16px;
  flex-shrink: 0;
  z-index: 1000;
}
.custom-title-bar.theme--dark {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}
.app-content {
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
}
.sidebar {
  flex-shrink: 0;
}
.sidebar.theme--dark {
  border-right-color: rgba(255, 255, 255, 0.12);
}
.main-bg {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  background: rgb(var(--v-theme-background));
}
.main-bg::-webkit-scrollbar {
  display: none;
}
.main-content-wrapper {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  background: transparent;
  height: calc(100vh - 40px - 32px);
  width: 100%;
  margin: 0;
  padding: 16px;
  box-sizing: border-box;
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

.v-navigation-drawer.sidebar {
  width: 210px !important;
  padding-top: 0;
}

.sidebar-header {
  height: 56px;
  padding: 0 20px;
  margin-top: 20px;
  font-size: 20px;
  font-weight: bold;
  background: rgb(var(--v-theme-surface));
  user-select: none;
}
.app-logo {
  color: rgb(var(--v-theme-primary));
}
.app-title {
  font-size: 20px;
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
}

.sidebar-list {
  margin-top: 8px;
}

.sidebar-list-item {
  margin: 4px 0;
  border-radius: 8px !important;
  padding-left: 16px !important;
  padding-right: 16px !important;
  width: calc(100% - 16px);
  margin-left: 8px;
  margin-right: 8px;
  transition: background 0.2s;
}
.sidebar-list-item--active {
  background: rgba(var(--v-theme-primary), 0.12) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  font-weight: bold;
  border-radius: 16px;
}
.active-title {
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
}

.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.v-app {
  padding-top: 40px !important; /* 让整个应用内容下移，避开顶部标题栏 */
  height: calc(100vh - 40px);
  box-sizing: border-box;
}
.v-application--wrap {
  padding-top: 0 !important; /* 避免重复padding */
}

.translate-card {
  width: 100%;
  max-width: 1200px;
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

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-bar-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.title-btn {
  width: 36px;
  height: 36px;
  border: none;
  outline: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s, color 0.18s;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  border-radius: 6px;
}
.title-btn:hover {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
.close-btn {
  color: rgb(var(--v-theme-on-surface));
}
.close-btn:hover {
  background: #ff4d4f;
  color: #fff;
}
.theme--dark .title-btn {
  color: rgba(255, 255, 255, 0.8);
}
.theme--dark .close-btn {
  color: rgba(255, 255, 255, 0.8);
}
.app-logo {
  color: rgb(var(--v-theme-primary));
}
.app-title {
  font-size: 20px;
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
  margin-left: 4px;
}

/* 圆润美观的主内容区滚动条 */
.main-bg::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}
.main-bg::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 6px;
  min-height: 40px;
  transition: background 0.2s;
}
.main-bg::-webkit-scrollbar-thumb:hover {
  background: #bdbdbd;
}
.main-bg::-webkit-scrollbar-corner {
  background: transparent;
}

.main-header {
  height: 32px;
  background: rgb(var(--v-theme-surface));
  display: flex;
  align-items: center;
  padding: 0 24px;
  margin-left: 210px;
  padding-bottom: 16px;
}

.main-title {
  font-size: 20px;
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
}

.v-main {
  padding-top: 0 !important;
  overflow-y: auto;
}

.v-main::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}

.v-main::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 6px;
  min-height: 40px;
  transition: background 0.2s;
}

.v-main::-webkit-scrollbar-thumb:hover {
  background: #bdbdbd;
}

.v-main::-webkit-scrollbar-corner {
  background: transparent;
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
</style>
