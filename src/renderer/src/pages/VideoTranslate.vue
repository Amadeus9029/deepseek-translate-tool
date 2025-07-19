<template>
  <PageCard>
        <!-- 文件设置 -->
        <div class="section">
      <SectionHeader :title="t('videoTranslate.subtitleFile')" />
      <FileSelector
        :filePath="translateStore.subtitleFile"
        :label="t('videoTranslate.subtitleFile')"
              :placeholder="t('videoTranslate.selectSubtitleFile')"
        :buttonText="t('videoTranslate.selectFile')"
              :disabled="translateStore.videoTranslate.isTranslating"
        @select="selectFile"
      />
        </div>

        <!-- 语言设置 -->
        <div class="section">
      <SectionHeader :title="t('videoTranslate.languageSettings')" />
      <LanguageSelector
        v-model:sourceLanguage="sourceLanguage"
        v-model:targetLanguage="targetLanguage"
        :availableLanguages="availableLanguages"
              :disabled="translateStore.videoTranslate.isTranslating"
        @swap="swapLanguages"
      />
        </div>

        <!-- 字幕预览 -->
        <div class="section preview-section">
          <div class="preview-header">
            <div class="preview-title">
              <span>{{ t('videoTranslate.sourceSubtitles') }}</span>
              <div class="subtitle-info" v-if="translateStore.subtitles.length > 0">
                {{ t('videoTranslate.subtitleCount', { count: translateStore.subtitles.length }) }}
              </div>
            </div>
            <div class="preview-title">
              <span>{{ t('videoTranslate.translatedSubtitles') }}</span>
              <div class="subtitle-info" v-if="translateStore.translatedItems.length > 0">
                {{ t('videoTranslate.translatedCount', { translated: translateStore.translatedItems.length, total: translateStore.subtitles.length }) }}
              </div>
            </div>
          </div>
          <div class="preview-content">
            <v-textarea
              v-model="translateStore.sourceSubtitles"
              :placeholder="t('videoTranslate.sourcePlaceholder')"
              hide-details
              variant="outlined"
              class="text-input"
              readonly
              no-resize
            ></v-textarea>
            <v-textarea
              v-model="translateStore.translatedSubtitles"
              :placeholder="t('videoTranslate.translatedPlaceholder')"
              hide-details
              variant="outlined"
              class="text-input"
              readonly
              no-resize
            ></v-textarea>
          </div>
        </div>

        <!-- 操作按钮和状态 -->
    <ActionSection :showStatus="!!translateStore.videoTranslate.status" :statusText="t(translateStore.videoTranslate.status)">
      <ActionButton 
        :label="t('videoTranslate.startTranslate')"
        :loadingText="t('videoTranslate.translating')"
            :loading="translateStore.videoTranslate.isTranslating"
            :disabled="!canTranslate"
        @click="startTranslate"
      />
    </ActionSection>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUnifiedTranslateService } from '../services/TranslateService'
import { availableLanguages, type LanguageOption } from '../constants/languages'
import { settings } from '../services/SettingsService'
import { useTranslateStore, type SubtitleItem } from '../stores/translateStore'
import { SubtitleTranslateHandler, saveLogAndResult, VideoTranslateService } from '../services/TranslateHandlers'
import PageCard from '../components/ui/PageCard.vue'
import LanguageSelector from '../components/ui/LanguageSelector.vue'
import FileSelector from '../components/ui/FileSelector.vue'
import ActionButton from '../components/ui/ActionButton.vue'
import ActionSection from '../components/ui/ActionSection.vue'
import SectionHeader from '../components/ui/SectionHeader.vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 使用翻译状态存储
const translateStore = useTranslateStore()

// 创建计算属性来处理语言选择器的双向绑定
const sourceLanguage = computed({
  get: () => {
    // 确保返回的是LanguageOption类型对象
    const lang = translateStore.videoTranslate.sourceLanguage
    // 如果是字符串，转换为LanguageOption对象
    if (typeof lang === 'string') {
      return { text: lang, value: lang } as LanguageOption
    }
    return lang as unknown as LanguageOption
  },
  set: (value: LanguageOption) => {
    // 存储到store中
    translateStore.videoTranslate.sourceLanguage = value.value
  }
})

const targetLanguage = computed({
  get: () => {
    // 确保返回的是LanguageOption类型对象
    const lang = translateStore.videoTranslate.targetLanguage
    // 如果是字符串，转换为LanguageOption对象
    if (typeof lang === 'string') {
      return { text: lang, value: lang } as LanguageOption
    }
    return lang as unknown as LanguageOption
  },
  set: (value: LanguageOption) => {
    // 存储到store中
    translateStore.videoTranslate.targetLanguage = value.value
  }
})

// 基础状态
const batchSize = ref('20')

// 计算是否可以开始翻译
const canTranslate = computed(() => {
  return translateStore.subtitleFile && 
         translateStore.subtitles.length > 0 && 
         !translateStore.videoTranslate.isTranslating &&
         batchSize.value && 
         parseInt(batchSize.value) > 0 && 
         parseInt(batchSize.value) <= 30
})

// 选择字幕文件
async function selectFile() {
  await SubtitleTranslateHandler.selectFile(
    ipcRenderer,
    translateStore.clearSubtitles,
    translateStore.setSubtitleFile,
    (status) => translateStore.videoTranslate.status = status,
    translateStore.setSubtitles,
    t
  )
}

// 交换语言
function swapLanguages() {
  // 使用store中的语言设置
  const temp = sourceLanguage.value
  sourceLanguage.value = targetLanguage.value
  targetLanguage.value = temp
}

// 开始翻译
async function startTranslate() {
  if (!canTranslate.value) return

  try {
    const result = await VideoTranslateService.translateSubtitles({
      ipcRenderer,
      subtitleFile: translateStore.subtitleFile,
      sourceLanguage: translateStore.videoTranslate.sourceLanguage,
      targetLanguage: translateStore.videoTranslate.targetLanguage,
      subtitles: translateStore.subtitles,
      t,
      setStatus: (status) => translateStore.videoTranslate.status = status,
      setIsTranslating: (value) => translateStore.videoTranslate.isTranslating = value,
      updateTranslationProgress: translateStore.updateTranslationProgress,
      updateTranslatedItems: translateStore.updateTranslatedItems,
      setOutputPath: translateStore.setOutputPath,
      batchSize: settings.value.subtitleBatchSize
    })

    if (!result.success) {
      console.error('翻译失败:', result.error)
      translateStore.videoTranslate.status = t('videoTranslate.translationFailed', { error: result.error })
    }
  } catch (error: unknown) {
    console.error('翻译失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    translateStore.videoTranslate.status = t('videoTranslate.translationFailed', { error: errorMessage })
    translateStore.videoTranslate.isTranslating = false
  }
}

// 组件挂载时，如果有缓存的字幕数据，则恢复状态
onMounted(() => {
  // 确保组件挂载时isTranslating为false
  translateStore.videoTranslate.isTranslating = false
  
  if (translateStore.subtitleFile) {
    translateStore.videoTranslate.status = t('videoTranslate.loadedSubtitles', { count: translateStore.subtitles.length })
  }
  
  // 确保状态在组件挂载时被保存
  if (translateStore.videoTranslate.status) {
    // 如果有状态信息，说明可能正在翻译中或有其他操作
    // 确保store中的翻译状态与当前状态一致
    if (translateStore.videoTranslate.isTranslating) {
      // 如果store中显示正在翻译，但实际上已经完成，则更新状态
      if (translateStore.translationComplete) {
        translateStore.videoTranslate.isTranslating = false
      }
    }
  }
})
</script>

<style>
@import '../styles/common.css';
</style>

<style scoped>
.section {
  margin-bottom: 24px;
}

/* 预览区域 */
.preview-section {
  background: rgba(var(--v-theme-surface-variant), 0.05);
  border-radius: 8px;
  padding: 20px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 0 16px;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.subtitle-info {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-weight: normal;
}

.preview-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.text-input {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 4px;
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
  height: 300px;
  overflow-y: auto;
}

/* 美化滚动条 */
.text-input::-webkit-scrollbar {
  width: 6px;
}

.text-input::-webkit-scrollbar-track {
  background: transparent;
}

.text-input::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 3px;
}

.text-input::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}
</style>