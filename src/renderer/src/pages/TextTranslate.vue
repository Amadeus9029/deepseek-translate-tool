<template>
  <div class="page-container">
    <v-card class="translate-card" flat>
      <v-card-text>
        <!-- 语言设置 -->
        <div class="language-settings">
          <div class="source-language">
            <v-autocomplete
              v-model="store.textTranslate.sourceLanguage"
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
              v-model="store.textTranslate.targetLanguage"
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
                :disabled="!store.textTranslate.sourceText || store.textTranslate.isTranslating"
              >清空</v-btn>
            </div>
            <v-textarea
              v-model="store.textTranslate.sourceText"
              :placeholder="'请输入要翻译的文本'"
              :rows="8"
              auto-grow
              hide-details
              variant="outlined"
              class="text-input"
              :disabled="store.textTranslate.isTranslating"
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
                :disabled="!store.textTranslate.translatedText"
              >复制</v-btn>
            </div>
            <v-textarea
              v-model="store.textTranslate.translatedText"
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
            :loading="store.textTranslate.isTranslating"
            :disabled="!store.textTranslate.sourceText || store.textTranslate.isTranslating"
          >
            {{ store.textTranslate.isTranslating ? '翻译中...' : '翻译' }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { getUnifiedTranslateService } from '../services/TranslateService'
import { availableLanguages, type LanguageOption } from '../constants/languages'
import { useTranslateStore } from '../stores/translateStore'

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

const store = useTranslateStore()
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 组件挂载时初始化状态
onMounted(() => {
  // 如果状态为空，设置默认值
  if (!store.textTranslate.sourceLanguage) {
    store.textTranslate.sourceLanguage = { text: '英语', value: '英语' }
  }
  if (!store.textTranslate.targetLanguage) {
    store.textTranslate.targetLanguage = { text: '中文', value: '中文' }
  }
})

// 清空源文本
const clearSourceText = () => {
  store.textTranslate.sourceText = ''
  store.textTranslate.translatedText = ''
}

// 复制翻译结果
const copyResult = () => {
  if (store.textTranslate.translatedText) {
    navigator.clipboard.writeText(store.textTranslate.translatedText)
  }
}

// 交换语言
const swapLanguages = () => {
  const temp = store.textTranslate.sourceLanguage
  store.textTranslate.sourceLanguage = store.textTranslate.targetLanguage
  store.textTranslate.targetLanguage = temp

  // 如果已经有翻译结果，也交换文本
  if (store.textTranslate.translatedText) {
    const tempText = store.textTranslate.sourceText
    store.textTranslate.sourceText = store.textTranslate.translatedText
    store.textTranslate.translatedText = tempText
  }
}

// 开始翻译
const startTranslate = async () => {
  if (!store.textTranslate.sourceText || store.textTranslate.isTranslating) return

  // 创建日志对象
  const startTime = new Date().toISOString()
  const logEntry: LogEntry = {
    fileName: '文本翻译',
    sourceLanguage: store.textTranslate.sourceLanguage?.text || '',
    targetLanguage: store.textTranslate.targetLanguage?.text || '',
    translateCount: 1,
    startTime,
    completed: false,
    translateType: 'text'
  }

  const translateResult: TranslateResult = {
    type: '文本',
    sourceLanguage: store.textTranslate.sourceLanguage?.text || '',
    targetLanguage: store.textTranslate.targetLanguage?.text || '',
    sourceContent: store.textTranslate.sourceText,
    translatedContent: '',
    timestamp: startTime,
    status: '成功'
  }

  try {
    store.textTranslate.isTranslating = true
    const translateService = getUnifiedTranslateService()

    const result = await translateService.translateText(
      store.textTranslate.sourceText,
      store.textTranslate.sourceLanguage?.value || '英语',
      store.textTranslate.targetLanguage?.value || '中文',
      [], // 这里可以添加术语表支持
      () => {} // 进度回调
    )

    store.textTranslate.translatedText = result
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
    
    // 提取错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    
    // 设置更友好的错误提示
    if (errorMessage.includes('API Key')) {
      store.textTranslate.translatedText = `翻译失败: ${errorMessage}\n\n请检查您的API Key是否正确设置，并确保它有足够的余额。`
    } else if (errorMessage.includes('网络') || errorMessage.includes('连接')) {
      store.textTranslate.translatedText = `翻译失败: ${errorMessage}\n\n请检查您的网络连接是否正常，以及是否可以访问DeepSeek API。`
    } else if (errorMessage.includes('配额') || errorMessage.includes('429')) {
      store.textTranslate.translatedText = `翻译失败: ${errorMessage}\n\n您的API请求次数已达到限制，请稍后再试或检查账户余额。`
    } else {
      store.textTranslate.translatedText = `翻译失败: ${errorMessage}\n\n如果问题持续存在，请尝试切换到Ollama本地模式。`
    }
    
    // 更新错误日志
    Object.assign(logEntry, {
      endTime: new Date().toISOString(),
      duration: Math.round((new Date().getTime() - new Date(startTime).getTime()) / 1000),
      completed: false,
      error: errorMessage
    })
    
    // 保存错误日志
    await ipcRenderer?.invoke('save-log', logEntry)

    translateResult.status = '失败'
    translateResult.translatedContent = '翻译失败: ' + errorMessage
    
    // 保存失败记录
    await ipcRenderer?.invoke('save-translate-result', translateResult)
  } finally {
    store.textTranslate.isTranslating = false
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