<template>
  <PageCard>
    <!-- 语言设置 -->
    <div class="language-settings">
      <LanguageSelector
        v-model:sourceLanguage="store.textTranslate.sourceLanguage"
        v-model:targetLanguage="store.textTranslate.targetLanguage"
        :availableLanguages="availableLanguages"
        :disabled="store.textTranslate.isTranslating"
        @swap="swapLanguages"
      />
    </div>

    <!-- 翻译区域 -->
    <TextAreaPair
      v-model:sourceText="store.textTranslate.sourceText"
      v-model:translatedText="store.textTranslate.translatedText"
      :sourceDisabled="store.textTranslate.isTranslating"
      @clearSource="clearSourceText"
      @copyResult="copyResult"
      :sourceTitle="t('textTranslate.sourceText')"
      :targetTitle="t('textTranslate.translatedText')"
      :sourcePlaceholder="t('textTranslate.emptySourceText')"
      :targetPlaceholder="t('textTranslate.translatedText')"
    />

    <!-- 操作按钮 -->
    <ActionSection>
      <ActionButton
        :label="t('textTranslate.translateButton')"
        :loading="store.textTranslate.isTranslating"
        :loadingText="t('textTranslate.translating')"
        :disabled="!store.textTranslate.sourceText || store.textTranslate.isTranslating"
        @click="startTranslate"
      />
    </ActionSection>
  </PageCard>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableLanguages, type LanguageOption } from '../constants/languages'
import { useTranslateStore } from '../stores/translateStore'
import { TextTranslateHandler, saveLogAndResult } from '../services/TranslateHandlers'
import PageCard from '../components/ui/PageCard.vue'
import LanguageSelector from '../components/ui/LanguageSelector.vue'
import TextAreaPair from '../components/ui/TextAreaPair.vue'
import ActionSection from '../components/ui/ActionSection.vue'
import ActionButton from '../components/ui/ActionButton.vue'

const store = useTranslateStore()
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const { t } = useI18n()

// 组件挂载时初始化状态
onMounted(() => {
  // 如果状态为空，设置默认值
  if (!store.textTranslate.sourceLanguage) {
    store.textTranslate.sourceLanguage = { text: '英语', value: '英语' } as LanguageOption
  }
  if (!store.textTranslate.targetLanguage) {
    store.textTranslate.targetLanguage = { text: '中文', value: '中文' } as LanguageOption
  }
})

// 清空源文本
const clearSourceText = () => {
  const result = TextTranslateHandler.clearSourceText(
    store.textTranslate.sourceText, 
    store.textTranslate.translatedText
  )
  store.textTranslate.sourceText = result.sourceText
  store.textTranslate.translatedText = result.translatedText
}

// 复制翻译结果
const copyResult = () => {
  TextTranslateHandler.copyResult(store.textTranslate.translatedText)
}

// 交换语言
const swapLanguages = () => {
  const result = TextTranslateHandler.swapLanguages(
    store.textTranslate.sourceLanguage as LanguageOption,
    store.textTranslate.targetLanguage as LanguageOption,
    store.textTranslate.sourceText,
    store.textTranslate.translatedText
  )
  
  store.textTranslate.sourceLanguage = result.sourceLanguage
  store.textTranslate.targetLanguage = result.targetLanguage
  store.textTranslate.sourceText = result.sourceText
  store.textTranslate.translatedText = result.translatedText
}

// 开始翻译
const startTranslate = async () => {
  if (!store.textTranslate.sourceText || store.textTranslate.isTranslating) return

  try {
    store.textTranslate.isTranslating = true
    
    const { result, logEntry, translateResult, error } = await TextTranslateHandler.startTranslate(
      store.textTranslate.sourceText,
      store.textTranslate.sourceLanguage,
      store.textTranslate.targetLanguage,
      false
    )
    
    store.textTranslate.translatedText = result
    
    // 保存日志和翻译结果
    await saveLogAndResult(logEntry, translateResult)
    
    if (error) {
      throw error
    }
  } catch (error) {
    console.error(t('errors.translateFailed'), error)
    // 错误处理已经在TextTranslateHandler.startTranslate中完成
  } finally {
    store.textTranslate.isTranslating = false
  }
}
</script>

<style>
@import '../styles/common.css';
</style>

<style scoped>
.language-settings {
  margin-bottom: 24px;
}
</style> 