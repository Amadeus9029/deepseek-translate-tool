<script setup lang="ts">
import { ref, onMounted } from 'vue'

const version = ref('1.0.0')
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

onMounted(async () => {
  if (ipcRenderer) {
    const appVersion = await ipcRenderer.invoke('get-app-version')
    version.value = appVersion || '1.0.0'
  }
})
</script>

<template>
  <div class="about-wrapper">
    <v-card class="about-card" elevation="0">
      <div class="about-scroll-container">
        <div class="about-header">
          <v-icon size="64" color="primary" class="mb-4">mdi-translate</v-icon>
          <h1 class="text-h4 mb-2">智能翻译工具</h1>
          <div class="text-subtitle-1 text-medium-emphasis">版本 {{ version }}</div>
        </div>
        
        <v-divider class="my-4"></v-divider>
        
        <div class="about-content">
          <div class="feature-section">
            <h2 class="text-h6 mb-3">主要功能</h2>
            <v-list>
              <v-list-item prepend-icon="mdi-translate" title="文本翻译" subtitle="支持多语言之间的即时翻译"></v-list-item>
              <v-list-item prepend-icon="mdi-file-document" title="文档翻译" subtitle="支持多种格式文档的批量翻译"></v-list-item>
              <v-list-item prepend-icon="mdi-video" title="字幕翻译" subtitle="支持视频字幕的智能翻译"></v-list-item>
            </v-list>
          </div>
          
          <v-divider class="my-4"></v-divider>
          
          <div class="contact-section">
            <h2 class="text-h6 mb-3">联系与支持</h2>
            <v-list>
              <v-list-item prepend-icon="mdi-email" title="反馈邮箱" subtitle="965720890@qq.com"></v-list-item>
              <v-list-item prepend-icon="mdi-github" title="开源地址" subtitle="https://github.com/Amadeus9029/Deepseek-Translate-Tool"></v-list-item>
            </v-list>
          </div>
          
          <v-divider class="my-4"></v-divider>
          
          <div class="copyright-section text-center">
            <p class="text-medium-emphasis">© {{ new Date().getFullYear() }} Deepseek Translate Tool. All rights reserved.</p>
          </div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<style scoped>
.about-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.about-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: transparent !important;
}

.about-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.about-scroll-container::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}

.about-scroll-container::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 6px;
  min-height: 40px;
}

.about-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #bdbdbd;
}

.about-header {
  text-align: center;
  margin-bottom: 24px;
}

.about-content {
  max-width: 600px;
  margin: 0 auto;
}

.feature-section,
.contact-section {
  margin-bottom: 24px;
}

.copyright-section {
  margin-top: 32px;
  margin-bottom: 16px;
}

:deep(.v-list) {
  background: transparent !important;
  padding: 0;
}
</style> 