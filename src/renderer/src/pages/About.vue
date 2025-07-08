<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const version = ref('1.0.0')
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const { t } = useI18n()

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
          <h1 class="text-h4 mb-2">{{ t('about.appName') }}</h1>
          <div class="text-subtitle-1 text-medium-emphasis">{{ t('about.version') }} {{ version }}</div>
        </div>
        
        <v-divider class="my-4"></v-divider>
        
        <div class="about-content">
          <div class="feature-section">
            <h2 class="text-h6 mb-3">{{ t('about.features') }}</h2>
            <v-list>
              <v-list-item prepend-icon="mdi-translate" :title="t('about.textTranslate')" :subtitle="t('about.textTranslateDesc')"></v-list-item>
              <v-list-item prepend-icon="mdi-file-document" :title="t('about.documentTranslate')" :subtitle="t('about.documentTranslateDesc')"></v-list-item>
              <v-list-item prepend-icon="mdi-video" :title="t('about.subtitleTranslate')" :subtitle="t('about.subtitleTranslateDesc')"></v-list-item>
            </v-list>
          </div>
          
          <v-divider class="my-4"></v-divider>
          
          <div class="contact-section">
            <h2 class="text-h6 mb-3">{{ t('about.contact') }}</h2>
            <v-list>
              <v-list-item prepend-icon="mdi-email" :title="t('about.feedbackEmail')" subtitle="965720890@qq.com"></v-list-item>
              <v-list-item prepend-icon="mdi-github" :title="t('about.github')" subtitle="https://github.com/Amadeus9029/Deepseek-Translate-Tool"></v-list-item>
            </v-list>
          </div>
          
          <v-divider class="my-4"></v-divider>
          
          <div class="copyright-section text-center">
            <p class="text-medium-emphasis">© {{ new Date().getFullYear() }} {{ t('about.appName') }}. {{ t('about.allRightsReserved') }}</p>
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
  width: 6px;
  height: 6px;
}

.about-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.about-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 3px;
}

.about-scroll-container::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
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