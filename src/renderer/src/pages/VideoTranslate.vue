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
import { SubtitleTranslateHandler, saveLogAndResult } from '../services/TranslateHandlers'
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

  // 创建日志对象
  const startTime = new Date().toISOString()
  const logEntry = {
    fileName: translateStore.subtitleFile.split(/[\\/]/).pop() || '',
    sourceLanguage: translateStore.videoTranslate.sourceLanguage,
    targetLanguage: translateStore.videoTranslate.targetLanguage,
    translateCount: 0,
    startTime,
    completed: false,
    translateType: 'subtitle'
  }

  try {
    // 直接修改store中的状态
    translateStore.videoTranslate.isTranslating = true
    translateStore.videoTranslate.status = t('videoTranslate.prepareToTranslate')
    translateStore.updateTranslationProgress(0)

    const translateService = getUnifiedTranslateService()
    const batch = settings.value.subtitleBatchSize
    const total = translateStore.subtitles.length
    const translatedItems: SubtitleItem[] = []
    let remainingItems = [...translateStore.subtitles] // 待翻译的条目
    let failedAttempts = 0
    const maxFailedAttempts = 3 // 最大连续失败次数
    const timeout = 30000 // 30秒超时

    // 批量翻译
    while (remainingItems.length > 0) {
      // 动态调整批次大小，如果之前失败过，减小批次大小
      const dynamicBatchSize = failedAttempts > 0 ? Math.max(5, Math.floor(batch / (failedAttempts + 1))) : batch
      const currentBatch = remainingItems.slice(0, dynamicBatchSize)
      const texts = currentBatch.map(item => item.text)

      try {
        // 显示当前进度
        translateStore.videoTranslate.status = t('videoTranslate.translatingBatch', { current: translatedItems.length + 1, total: total })
        
        // 对于本地模型，每行单独翻译可能更稳定
        if (settings.value.useOllama && currentBatch.length > 1) {
          // 逐行翻译
          const batchTranslations: string[] = []
          for (let i = 0; i < currentBatch.length; i++) {
            const singleText = currentBatch[i].text
            translateStore.videoTranslate.status = t('videoTranslate.translatingSingle', { current: translatedItems.length + i + 1, total: total })
            
            const singleTranslation = await SubtitleTranslateHandler.withTimeout(
              translateService.translateText(
                singleText,
                translateStore.videoTranslate.sourceLanguage,
                translateStore.videoTranslate.targetLanguage,
                [],
                () => {} // 空进度回调
              ),
              timeout
            )
            
            // 清理翻译结果
            batchTranslations.push(SubtitleTranslateHandler.cleanTranslation(singleTranslation))
          }
          
          // 保存所有翻译结果
          currentBatch.forEach((item, index) => {
            const translated = { ...item, type: item.type || 'srt' }
            translated.translation = batchTranslations[index].trim()
            translatedItems.push(translated)
          })
        } else {
          // 批量翻译
          const translations = await SubtitleTranslateHandler.withTimeout(
            translateService.translateText(
              texts.join('\n'),
              translateStore.videoTranslate.sourceLanguage,
              translateStore.videoTranslate.targetLanguage,
              [],
              (current, total) => {
                translateStore.videoTranslate.status = t('videoTranslate.translatingBatchProgress', { current: current, total: total })
              }
            ),
            timeout
          )

          // 处理翻译结果
          const translationArray = translations.split('\n').filter(t => t.trim())
          
          if (translationArray.length === currentBatch.length) {
            // 如果数量匹配，保存所有翻译结果
            currentBatch.forEach((item, index) => {
              const translated = { ...item, type: item.type || 'srt' }
              translated.translation = SubtitleTranslateHandler.cleanTranslation(translationArray[index].trim())
              translatedItems.push(translated)
            })
          } else {
            // 如果数量不匹配，切换到逐行翻译
            failedAttempts++
            translateStore.videoTranslate.status = t('videoTranslate.batchTranslationMismatch', { translated: translationArray.length, total: currentBatch.length })
            
            // 逐行翻译
            const batchTranslations: string[] = []
            for (let i = 0; i < currentBatch.length; i++) {
              const singleText = currentBatch[i].text
              translateStore.videoTranslate.status = t('videoTranslate.translatingSingle', { current: translatedItems.length + i + 1, total: total })
              
              const singleTranslation = await SubtitleTranslateHandler.withTimeout(
                translateService.translateText(
                  singleText,
                  translateStore.videoTranslate.sourceLanguage,
                  translateStore.videoTranslate.targetLanguage,
                  [],
                  () => {} // 空进度回调
                ),
                timeout
              )
              
              // 清理翻译结果
              batchTranslations.push(SubtitleTranslateHandler.cleanTranslation(singleTranslation))
            }
            
            // 保存所有翻译结果
            currentBatch.forEach((item, index) => {
              const translated = { ...item, type: item.type || 'srt' }
              translated.translation = batchTranslations[index].trim()
              translatedItems.push(translated)
            })
          }
        }
        
        // 从待翻译列表中移除已翻译的条目
        remainingItems = remainingItems.slice(currentBatch.length)
        translateStore.updateTranslationProgress(translatedItems.length, total)
        translateStore.updateTranslatedItems(translatedItems)
        
        // 重置失败计数
        failedAttempts = 0
        
      } catch (error: unknown) {
        console.error('翻译失败:', error)
        failedAttempts++
        
        const errorMessage = error instanceof Error ? error.message : String(error)
        translateStore.videoTranslate.status = t('videoTranslate.translationFailed', { error: errorMessage })
        
        // 如果失败次数过多，减小批次大小或抛出错误
        if (failedAttempts >= maxFailedAttempts) {
          if (currentBatch.length > 1) {
            // 将当前批次拆分为更小的批次重试
            translateStore.videoTranslate.status = t('videoTranslate.continuousFailures', { failures: failedAttempts })
            // 不移除条目，下一轮循环会使用更小的批次大小
          } else {
            // 如果已经是单条翻译还失败，则跳过这条
            translateStore.videoTranslate.status = t('videoTranslate.singleTranslationFailed', { failures: failedAttempts })
            remainingItems = remainingItems.slice(1) // 跳过当前条目
            failedAttempts = 0 // 重置失败计数
          }
        }
        
        // 如果所有条目都无法翻译，抛出错误
        if (remainingItems.length === total && translatedItems.length === 0 && failedAttempts >= maxFailedAttempts) {
          throw new Error(t('videoTranslate.tooManyTranslationFailures'))
        }
      }

      // 添加短暂延迟，避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 保存翻译结果
    if (translatedItems.length > 0) {
      const saveResult = await ipcRenderer.invoke('save-subtitles', {
        subtitles: translatedItems,
        sourceFile: translateStore.subtitleFile,
        targetLanguage: translateStore.videoTranslate.targetLanguage
      })

      if (!saveResult.success) {
        throw new Error(saveResult.error)
      }

      // 保存输出路径
      translateStore.setOutputPath(saveResult.outputPath)

      // 更新日志对象
      const endTime = new Date().toISOString()
      const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      
      Object.assign(logEntry, {
        translateCount: translatedItems.length,
        endTime,
        duration,
        completed: true
      })

      // 保存日志
      await ipcRenderer?.invoke('save-log', logEntry)

      // 保存翻译结果
      const translateResult = {
        type: '字幕' as const,
        sourceLanguage: translateStore.videoTranslate.sourceLanguage,
        targetLanguage: translateStore.videoTranslate.targetLanguage,
        sourceContent: translateStore.sourceSubtitles,
        translatedContent: translateStore.translatedSubtitles,
        timestamp: startTime,
        status: '成功' as const,
        fileName: translateStore.subtitleFile,
        filePath: saveResult.outputPath
      }
      await ipcRenderer?.invoke('save-translate-result', translateResult)

      translateStore.videoTranslate.status = t('videoTranslate.translationComplete', { filePath: saveResult.outputPath })
    } else {
      throw new Error(t('videoTranslate.noContentTranslated'))
    }
  } catch (error: unknown) {
    console.error('翻译失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // 更新错误日志
    Object.assign(logEntry, {
      endTime: new Date().toISOString(),
      duration: Math.round((new Date().getTime() - new Date(startTime).getTime()) / 1000),
      completed: false,
      error: errorMessage
    })
    
    // 保存错误日志
    await ipcRenderer?.invoke('save-log', logEntry)

    // 保存失败的翻译结果
    const translateResult = {
      type: '字幕' as const,
      sourceLanguage: translateStore.videoTranslate.sourceLanguage,
      targetLanguage: translateStore.videoTranslate.targetLanguage,
      sourceContent: translateStore.sourceSubtitles,
      translatedContent: `翻译失败: ${errorMessage}`,
      timestamp: startTime,
      status: '失败' as const,
      fileName: translateStore.subtitleFile,
      filePath: translateStore.subtitleFile
    }
    await ipcRenderer?.invoke('save-translate-result', translateResult)
    
    translateStore.videoTranslate.status = t('videoTranslate.translationFailed', { error: errorMessage })
  } finally {
    // 确保在finally块中设置isTranslating为false
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