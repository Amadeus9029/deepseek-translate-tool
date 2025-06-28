<template>
  <div class="page-container">
    <v-card class="translate-card" flat>
      <v-card-text>
        <!-- 文件设置 -->
        <div class="section">
          <div class="section-title">字幕文件</div>
          <div class="file-input-row">
            <div class="label">字幕文件:</div>
            <v-text-field
              v-model="subtitleFile"
              hide-details
              density="compact"
              variant="outlined"
              readonly
              placeholder="请选择字幕文件"
              class="file-input"
            ></v-text-field>
            <v-btn 
              color="primary" 
              class="select-btn" 
              @click="selectFile"
              :disabled="isTranslating"
            >
              选择文件
            </v-btn>
          </div>
        </div>

        <!-- 语言设置 -->
        <div class="section">
          <div class="section-title">语言设置</div>
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
              :disabled="isTranslating"
            ></v-autocomplete>
            <v-btn 
              icon="mdi-swap-horizontal" 
              variant="text" 
              @click="swapLanguages"
              class="swap-btn"
              :disabled="isTranslating"
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
              :disabled="isTranslating"
            ></v-autocomplete>
          </div>
        </div>

        <!-- 翻译设置 -->
        <!-- <div class="section">
          <div class="section-title">翻译设置</div>
          <div class="translation-settings">
            <v-text-field
              v-model="batchSize"
              label="批量翻译数量"
              type="number"
              hide-details
              density="compact"
              variant="outlined"
              class="batch-input"
              :disabled="isTranslating"
              :rules="[v => (v && v > 0 && v <= 30) || '批量翻译数量必须在1-30之间']"
            ></v-text-field>
            <div class="hint-text">建议值：10-20，最大值：30</div>
          </div>
        </div> -->

        <!-- 字幕预览 -->
        <div class="section preview-section">
          <div class="preview-header">
            <div class="preview-title">
              <span>原文字幕</span>
              <div class="subtitle-info" v-if="subtitleCount > 0">
                共 {{ subtitleCount }} 条字幕

              </div>
            </div>
            <div class="preview-title">
              <span>翻译字幕</span>
              <div class="subtitle-info" v-if="translatedCount > 0">
                已翻译 {{ translatedCount }}/{{ subtitleCount }} 条

              </div>
            </div>
          </div>
          <div class="preview-content">
            <v-textarea
              v-model="sourceSubtitles"
              placeholder="原文字幕将显示在这里"
              hide-details
              variant="outlined"
              class="text-input"
              readonly
              no-resize
            ></v-textarea>
            <v-textarea
              v-model="translatedSubtitles"
              placeholder="翻译结果将显示在这里"
              hide-details
              variant="outlined"
              class="text-input"
              readonly
              no-resize
            ></v-textarea>
          </div>
        </div>

        <!-- 操作按钮和状态 -->
        <div class="action-section">
          <v-btn 
            color="primary" 
            size="large" 
            class="translate-btn" 
            @click="startTranslate"
            :loading="isTranslating"
            :disabled="!canTranslate"
          >
            {{ isTranslating ? '翻译中...' : '开始翻译' }}
          </v-btn>
          <div class="status-section" v-if="status">
            {{ status }}
          </div>
        </div>


      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getUnifiedTranslateService } from '../services/TranslateService'
import { availableLanguages, type LanguageOption } from '../constants/languages'
import { settings } from '../services/SettingsService'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 字幕项接口
interface SubtitleItem {
  index?: string
  start: string
  end: string
  text: string
  translation?: string
  type: 'srt' | 'ass'
  style?: string
}

// 基础状态
const subtitleFile = ref('')
const sourceLanguage = ref<LanguageOption>({ text: '英语', value: '英语' })
const targetLanguage = ref<LanguageOption>({ text: '中文', value: '中文' })
const batchSize = ref('20')
const isTranslating = ref(false)
const status = ref('')

// 字幕内容
const subtitles = ref<Array<SubtitleItem>>([])
const translatedSubtitles = ref('')
const sourceSubtitles = ref('')

// 字幕数量统计
const subtitleCount = computed(() => subtitles.value.length)
const translatedCount = ref(0)

const outputPath = ref('')

// 计算是否可以开始翻译
const canTranslate = computed(() => {
  return subtitleFile.value && 
         subtitles.value.length > 0 && 
         !isTranslating.value &&
         batchSize.value && 
         parseInt(batchSize.value) > 0 && 
         parseInt(batchSize.value) <= 30
})

// 选择字幕文件
async function selectFile() {
  if (!ipcRenderer) return
  
  try {
    const result = await ipcRenderer.invoke('open-file-dialog')
    
    if (result.success && result.filePath) {
      subtitleFile.value = result.filePath
      status.value = '正在读取字幕...'
      
      // 读取字幕文件
      const subtitleResult = await ipcRenderer.invoke('read-subtitle-file', result.filePath)
      
      if (subtitleResult.success) {
        subtitles.value = subtitleResult.subtitles
        sourceSubtitles.value = subtitles.value.map(item => item.text).join('\n')
        status.value = `已读取 ${subtitles.value.length} 条字幕`
      } else {
        throw new Error(subtitleResult.error)
      }
    }
  } catch (error: unknown) {
    console.error('选择文件失败:', error)
    status.value = `读取字幕失败: ${error instanceof Error ? error.message : String(error)}`
  }
}

// 交换语言
function swapLanguages() {
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
    fileName: subtitleFile.value.split(/[\\/]/).pop() || '',
    sourceLanguage: sourceLanguage.value.text,
    targetLanguage: targetLanguage.value.text,
    translateCount: 0,
    startTime,
    completed: false,
    translateType: 'subtitle'
  }

  try {
    isTranslating.value = true
    status.value = '准备开始翻译...'
    translatedCount.value = 0

    const translateService = getUnifiedTranslateService()
    const batch = settings.value.subtitleBatchSize
    const total = subtitles.value.length
    const translatedItems: SubtitleItem[] = []
    let remainingItems = [...subtitles.value] // 待翻译的条目
    let failedAttempts = 0
    const maxFailedAttempts = 3 // 最大连续失败次数

    // 批量翻译
    while (remainingItems.length > 0) {
      // 动态调整批次大小，如果之前失败过，减小批次大小
      const dynamicBatchSize = failedAttempts > 0 ? Math.max(5, Math.floor(batch / (failedAttempts + 1))) : batch
      const currentBatch = remainingItems.slice(0, dynamicBatchSize)
      const texts = currentBatch.map(item => item.text)

      try {
        // 显示当前进度
        status.value = `正在翻译第 ${translatedItems.length + 1} - ${translatedItems.length + currentBatch.length} 条，共 ${total} 条`
        
        // 对于本地模型，每行单独翻译可能更稳定
        if (settings.value.useOllama && currentBatch.length > 1) {
          // 逐行翻译
          const batchTranslations = []
          for (let i = 0; i < currentBatch.length; i++) {
            const singleText = currentBatch[i].text
            status.value = `正在翻译第 ${translatedItems.length + i + 1}/${total} 条`
            
            const singleTranslation = await translateService.translateText(
              singleText,
              sourceLanguage.value.text,
              targetLanguage.value.text,
              [],
              () => {} // 空进度回调
            )
            
            batchTranslations.push(singleTranslation)
          }
          
          // 保存所有翻译结果
          currentBatch.forEach((item, index) => {
            const translated = { ...item }
            translated.translation = batchTranslations[index].trim()
            translatedItems.push(translated)
          })
        } else {
          // 批量翻译
          const translations = await translateService.translateText(
            texts.join('\n'),
            sourceLanguage.value.text,
            targetLanguage.value.text,
            [],
            (current, total) => {
              status.value = `正在翻译第 ${translatedItems.length + 1} - ${translatedItems.length + currentBatch.length} 条，进度：${current}/${total}`
            }
          )

          // 处理翻译结果
          const translationArray = translations.split('\n').filter(t => t.trim())
          
          if (translationArray.length === currentBatch.length) {
            // 如果数量匹配，保存所有翻译结果
            currentBatch.forEach((item, index) => {
              const translated = { ...item }
              translated.translation = translationArray[index].trim()
              translatedItems.push(translated)
            })
          } else {
            // 如果数量不匹配，切换到逐行翻译
            failedAttempts++
            status.value = `批量翻译结果不匹配，切换到逐行翻译 (${translationArray.length} vs ${currentBatch.length})`
            
            // 逐行翻译
            const batchTranslations = []
            for (let i = 0; i < currentBatch.length; i++) {
              const singleText = currentBatch[i].text
              status.value = `正在单独翻译第 ${translatedItems.length + i + 1}/${total} 条`
              
              const singleTranslation = await translateService.translateText(
                singleText,
                sourceLanguage.value.text,
                targetLanguage.value.text,
                [],
                () => {} // 空进度回调
              )
              
              batchTranslations.push(singleTranslation)
            }
            
            // 保存所有翻译结果
            currentBatch.forEach((item, index) => {
              const translated = { ...item }
              translated.translation = batchTranslations[index].trim()
              translatedItems.push(translated)
            })
          }
        }
        
        // 从待翻译列表中移除已翻译的条目
        remainingItems = remainingItems.slice(currentBatch.length)
        translatedCount.value = translatedItems.length
        translatedSubtitles.value = translatedItems.map(item => item.translation).join('\n')
        
        // 重置失败计数
        failedAttempts = 0
        
      } catch (error: unknown) {
        console.error('翻译失败:', error)
        failedAttempts++
        
        const errorMessage = error instanceof Error ? error.message : String(error)
        status.value = `翻译失败: ${errorMessage}，正在重试...`
        
        // 如果失败次数过多，减小批次大小或抛出错误
        if (failedAttempts >= maxFailedAttempts) {
          if (currentBatch.length > 1) {
            // 将当前批次拆分为更小的批次重试
            status.value = `连续失败 ${failedAttempts} 次，减小批次大小重试`
            // 不移除条目，下一轮循环会使用更小的批次大小
          } else {
            // 如果已经是单条翻译还失败，则跳过这条
            status.value = `单条翻译失败 ${failedAttempts} 次，跳过此条`
            remainingItems = remainingItems.slice(1) // 跳过当前条目
            failedAttempts = 0 // 重置失败计数
          }
        }
        
        // 如果所有条目都无法翻译，抛出错误
        if (remainingItems.length === total && translatedItems.length === 0 && failedAttempts >= maxFailedAttempts) {
          throw new Error('翻译失败次数过多，请检查网络连接或稍后重试')
        }
      }

      // 添加短暂延迟，避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 保存翻译结果
    if (translatedItems.length > 0) {
      const saveResult = await ipcRenderer.invoke('save-subtitles', {
        subtitles: translatedItems,
        sourceFile: subtitleFile.value,
        targetLanguage: targetLanguage.value.text
      })

      if (!saveResult.success) {
        throw new Error(saveResult.error)
      }

      // 保存输出路径
      outputPath.value = saveResult.outputPath

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
      await ipcRenderer.invoke('save-log', logEntry)

      // 保存翻译结果
      const translateResult = {
        type: '字幕' as const,
        sourceLanguage: sourceLanguage.value.text,
        targetLanguage: targetLanguage.value.text,
        sourceContent: sourceSubtitles.value,
        translatedContent: translatedSubtitles.value,
        timestamp: startTime,
        status: '成功' as const,
        fileName: subtitleFile.value,
        filePath: saveResult.outputPath
      }
      await ipcRenderer.invoke('save-translate-result', translateResult)

      status.value = `翻译完成！已保存字幕文件：${saveResult.outputPath}`
    } else {
      throw new Error('没有成功翻译的内容')
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
    await ipcRenderer.invoke('save-log', logEntry)

    // 保存失败的翻译结果
    const translateResult = {
      type: '字幕' as const,
      sourceLanguage: sourceLanguage.value.text,
      targetLanguage: targetLanguage.value.text,
      sourceContent: sourceSubtitles.value,
      translatedContent: `翻译失败: ${errorMessage}`,
      timestamp: startTime,
      status: '失败' as const,
      fileName: subtitleFile.value,
      filePath: subtitleFile.value
    }
    await ipcRenderer.invoke('save-translate-result', translateResult)
    
    status.value = `翻译失败: ${errorMessage}`
  } finally {
    isTranslating.value = false
  }
}


</script>

<style>
@import '../styles/common.css';
</style>

<style scoped>
.v-card-text {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: rgb(var(--v-theme-on-surface));
}

/* 文件输入区域 */
.file-input-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.label {
  min-width: 80px;
  color: rgb(var(--v-theme-on-surface));
}

.file-input {
  flex: 1;
}

.select-btn {
  min-width: 120px;
}

/* 语言设置 */
.source-language {
  display: flex;
  align-items: center;
  gap: 16px;
}

.language-select {
  flex: 1;
  max-width: 400px;
}

/* 翻译设置 */
.translation-settings {
  max-width: 400px;
}

.batch-input {
  width: 100%;
}

.hint-text {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 4px;
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

/* 底部操作区域 */
.action-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  margin-top: 24px;
  background: rgb(var(--v-theme-surface));
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.translate-btn {
  min-width: 200px;
  height: 48px;
  font-size: 16px;
  letter-spacing: 0.5px;
}

.status-section {
  width: 100%;
  padding: 12px 16px;
  border-radius: 6px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
  font-size: 14px;
  line-height: 1.4;
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

.swap-btn {
  margin: 0;
}
</style>