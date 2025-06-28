<template>
  <div class="page-container">
    <v-card class="translate-card" flat>
      <v-card-text>
        <!-- 语言设置 -->
        <div class="language-settings">
          <div class="source-language">
            <v-autocomplete
              v-model="sourceLanguage"
              :items="availableLanguages"
              label="源语言"
              hide-details
              density="compact"
              variant="outlined"
              class="language-select"
              item-title="text"
              item-value="value"
              return-object
              :menu-props="{ maxHeight: 300 }"
            ></v-autocomplete>
            <v-btn 
              icon="mdi-swap-horizontal" 
              variant="text" 
              @click="swapLanguages"
              class="swap-btn"
            ></v-btn>
            <v-autocomplete
              v-model="targetLanguage"
              :items="availableLanguages"
              label="目标语言"
              hide-details
              density="compact"
              variant="outlined"
              class="language-select"
              item-title="text"
              item-value="value"
              return-object
              :menu-props="{ maxHeight: 300 }"
            ></v-autocomplete>
          </div>
        </div>

        <!-- 翻译区域 -->
        <div class="translation-area">
          <!-- 源文本 -->
          <div class="text-section">
            <div class="text-header">
              <span class="text-title">源文本</span>
              <v-btn 
                variant="text" 
                density="compact" 
                @click="clearSourceText"
                :disabled="!sourceText || isTranslating"
              >清空</v-btn>
            </div>
            <v-textarea
              v-model="sourceText"
              :placeholder="'请输入要翻译的文本'"
              :rows="8"
              auto-grow
              hide-details
              variant="outlined"
              class="text-input"
              :disabled="isTranslating"
            ></v-textarea>
          </div>

          <!-- 翻译结果 -->
          <div class="text-section">
            <div class="text-header">
              <span class="text-title">翻译结果</span>
              <v-btn 
                variant="text" 
                density="compact" 
                @click="copyResult"
                :disabled="!translatedText"
              >复制</v-btn>
            </div>
            <v-textarea
              v-model="translatedText"
              placeholder="翻译结果将显示在这里"
              :rows="8"
              auto-grow
              hide-details
              variant="outlined"
              class="text-input"
              readonly
            ></v-textarea>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-section">
          <v-btn 
            color="primary" 
            size="large" 
            class="translate-btn" 
            @click="startTranslate"
            :loading="isTranslating"
            :disabled="!sourceText || isTranslating"
          >
            {{ isTranslating ? '翻译中...' : '翻译' }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getUnifiedTranslateService } from '../services/TranslateService'
import { availableLanguages, type LanguageOption } from '../constants/languages'

interface TranslateResult {
  type: '文本' | '文档' | '字幕'
  sourceLanguage: string
  targetLanguage: string
  sourceContent: string
  translatedContent: string
  timestamp: string
  status: '成功' | '失败'
}

// 添加日志接口
interface LogEntry {
  fileName: string
  sourceLanguage: string
  targetLanguage: string
  translateCount: number
  startTime: string
  endTime?: string
  duration?: number
  completed: boolean
  error?: string
  translateType: string
}

const sourceLanguage = ref<LanguageOption>({ text: '英语', value: '英语' })
const targetLanguage = ref<LanguageOption>({ text: '中文', value: '中文' })
const sourceText = ref('')
const translatedText = ref('')
const isTranslating = ref(false)

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 清空源文本
const clearSourceText = () => {
  sourceText.value = ''
  translatedText.value = ''
}

// 复制翻译结果
const copyResult = () => {
  if (translatedText.value) {
    navigator.clipboard.writeText(translatedText.value)
  }
}

// 交换语言
const swapLanguages = () => {
  const temp = sourceLanguage.value
  sourceLanguage.value = targetLanguage.value
  targetLanguage.value = temp

  // 如果已经有翻译结果，也交换文本
  if (translatedText.value) {
    const tempText = sourceText.value
    sourceText.value = translatedText.value
    translatedText.value = tempText
  }
}

// 开始翻译
const startTranslate = async () => {
  if (!sourceText.value || isTranslating.value) return

  // 创建日志对象
  const startTime = new Date().toISOString()
  const logEntry: LogEntry = {
    fileName: '文本翻译',
    sourceLanguage: sourceLanguage.value.text,
    targetLanguage: targetLanguage.value.text,
    translateCount: 1,
    startTime,
    completed: false,
    translateType: 'text'
  }

  const translateResult: TranslateResult = {
    type: '文本',
    sourceLanguage: sourceLanguage.value.text,
    targetLanguage: targetLanguage.value.text,
    sourceContent: sourceText.value,
    translatedContent: '',
    timestamp: startTime,
    status: '成功'
  }

  try {
    isTranslating.value = true
    const translateService = getUnifiedTranslateService()

    const result = await translateService.translateText(
      sourceText.value,
      sourceLanguage.value.value,
      targetLanguage.value.value,
      [], // 这里可以添加术语表支持
      () => {} // 进度回调
    )

    translatedText.value = result
    translateResult.translatedContent = result

    // 更新日志对象
    const endTime = new Date().toISOString()
    const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
    
    Object.assign(logEntry, {
      endTime,
      duration,
      completed: true
    })

    // 保存日志
    await ipcRenderer?.invoke('save-log', logEntry)

    // 保存翻译记录
    await ipcRenderer?.invoke('save-translate-result', translateResult)
  } catch (error) {
    console.error('翻译失败:', error)
    translatedText.value = '翻译失败，请重试'
    
    // 更新错误日志
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    Object.assign(logEntry, {
      endTime: new Date().toISOString(),
      duration: Math.round((new Date().getTime() - new Date(startTime).getTime()) / 1000),
      completed: false,
      error: errorMessage
    })
    
    // 保存错误日志
    await ipcRenderer?.invoke('save-log', logEntry)

    translateResult.status = '失败'
    translateResult.translatedContent = '翻译失败'
    
    // 保存失败记录
    await ipcRenderer?.invoke('save-translate-result', translateResult)
  } finally {
    isTranslating.value = false
  }
}
</script>

<style>
@import '../styles/common.css';
</style>

<style scoped>
.text-translate {
  width: 100%;
  height: 100%;
  padding: 16px;
}

.translate-card {
  width: 100%;
  height: 100%;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 8px;
}

.language-settings {
  margin-bottom: 24px;
}

.source-language {
  display: flex;
  align-items: center;
  gap: 16px;
}

.language-select {
  width: 200px;
}

.translation-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.text-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-title {
  font-size: 16px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.text-input {
  flex: 1;
  background: rgb(var(--v-theme-surface));
}

.action-section {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.translate-btn {
  min-width: 160px;
}

.swap-btn {
  margin: 0 8px;
}
</style> 