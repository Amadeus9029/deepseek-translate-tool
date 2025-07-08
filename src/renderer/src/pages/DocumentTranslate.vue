<template>
  <PageCard>
    <!-- 文件设置 -->
    <div class="section">
      <SectionHeader :title="t('documentTranslate.fileSettings')" />
      <FileSelector
        :filePath="store.documentTranslate.excelFile"
        :label="t('documentTranslate.excelFile')"
        :placeholder="t('documentTranslate.selectExcelFile')"
        :disabled="store.documentTranslate.isTranslating"
        :buttonText="t('documentTranslate.selectFile')"
        @select="selectFile"
      />
    </div>

    <!-- 翻译参考设置 -->
    <div class="section">
      <SectionHeader :title="t('documentTranslate.referenceSettings')" />
      <div class="reference-options">
        <v-radio-group v-model="store.documentTranslate.referenceType" inline hide-details>
          <v-radio :label="t('documentTranslate.noReference')" value="none"></v-radio>
          <v-radio :label="t('documentTranslate.internalReference')" value="internal"></v-radio>
          <v-radio :label="t('documentTranslate.externalReference')" value="external"></v-radio>
        </v-radio-group>

        <!-- 内置参考源设置 -->
        <div v-if="store.documentTranslate.referenceType === 'internal'" class="mt-4">
          <v-select
            v-model="store.documentTranslate.internalRefLang"
            :items="availableLanguages"
            :label="t('documentTranslate.selectRefLanguage')"
            hide-details
            density="compact"
            variant="outlined"
            class="reference-select"
          ></v-select>
        </div>

        <!-- 外置参考源设置 -->
        <div v-if="store.documentTranslate.referenceType === 'external'" class="mt-4">
          <div class="mb-2">
            <FileSelector
              :filePath="store.documentTranslate.externalRefFile"
              :placeholder="t('documentTranslate.selectRefFile')"
              :disabled="store.documentTranslate.isTranslating"
              :buttonText="t('documentTranslate.selectFile')"
              @select="selectRefFile"
            />
          </div>
          <v-select
            v-model="store.documentTranslate.externalRefLang"
            :items="availableLanguages"
            :label="t('documentTranslate.selectRefLanguage')"
            hide-details
            density="compact"
            variant="outlined"
            class="reference-select"
          ></v-select>
        </div>
      </div>
    </div>

    <!-- 语言设置 -->
    <div class="section">
      <SectionHeader :title="t('documentTranslate.languageSettings')" />
      <div class="language-settings">
        <div class="source-language">
          <div class="label">{{ t('documentTranslate.sourceLanguage') }}</div>
          <v-autocomplete
            v-model="store.documentTranslate.sourceLanguage"
            :items="availableLanguages"
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
        <div class="target-languages">
          <v-checkbox
            v-for="lang in availableLanguages"
            :key="lang.value"
            v-model="store.documentTranslate.selectedLanguages"
            :label="lang.text"
            :value="lang.value"
            hide-details
            density="compact"
            class="language-checkbox"
          ></v-checkbox>
        </div>
      </div>
    </div>

    <!-- 开始翻译按钮 -->
    <ActionSection>
      <ActionButton
        :label="t('documentTranslate.startTranslate')"
        :loadingText="t('documentTranslate.translating')"
        :loading="store.documentTranslate.isTranslating"
        :disabled="store.documentTranslate.isTranslating"
        @click="startTranslate"
      />
    </ActionSection>

    <!-- 运行日志 -->
    <LogDisplay
      :logs="store.documentTranslate.logs"
      :title="t('documentTranslate.runningLogs')"
      :emptyText="t('documentTranslate.noLogs')"
    />
  </PageCard>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { getUnifiedTranslateService } from '../services/TranslateService'
import { availableLanguages, type LanguageOption } from '../constants/languages'
import { useTranslateStore } from '../stores/translateStore'
import { DocumentTranslateHandler, type ExcelRow } from '../services/TranslateHandlers'
import PageCard from '../components/ui/PageCard.vue'
import FileSelector from '../components/ui/FileSelector.vue'
import SectionHeader from '../components/ui/SectionHeader.vue'
import ActionButton from '../components/ui/ActionButton.vue'
import ActionSection from '../components/ui/ActionSection.vue'
import LogDisplay from '../components/ui/LogDisplay.vue'
import { useI18n } from 'vue-i18n'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const store = useTranslateStore()
const { t } = useI18n()

// 组件挂载时初始化状态
onMounted(() => {
  // 如果状态为空，设置默认值
  if (!store.documentTranslate.sourceLanguage) {
    store.documentTranslate.sourceLanguage = { text: '英语', value: '英语' } as LanguageOption
  }
})

// 选择Excel文件
async function selectFile() {
  const filePath = await DocumentTranslateHandler.selectFile(
    ipcRenderer, 
    store.addDocumentLog
  )
  
  if (filePath) {
    store.documentTranslate.excelFile = filePath
  }
}

// 选择参考Excel文件
async function selectRefFile() {
  const filePath = await DocumentTranslateHandler.selectRefFile(
    ipcRenderer, 
    store.addDocumentLog
  )
  
  if (filePath) {
    store.documentTranslate.externalRefFile = filePath
  }
}

// 开始翻译
async function startTranslate() {
  // 验证参数
  const isValid = DocumentTranslateHandler.validateTranslateParams(
    store.documentTranslate.excelFile,
    store.documentTranslate.selectedLanguages,
    store.documentTranslate.referenceType,
    store.documentTranslate.internalRefLang,
    store.documentTranslate.externalRefFile,
    store.documentTranslate.externalRefLang,
    store.addDocumentLog
  )
  
  if (!isValid) return

  // 创建日志对象
  const startTime = new Date().toISOString()
  const logEntry = {
    fileName: store.documentTranslate.excelFile.split(/[\\/]/).pop() || '',
    sourceLanguage: store.documentTranslate.sourceLanguage?.text || '',
    targetLanguage: store.documentTranslate.selectedLanguages.join(', '),
    translateCount: 0,
    startTime,
    completed: false,
    translateType: 'document'  // 添加翻译类型
  }

  try {
    store.documentTranslate.isTranslating = true
    store.documentTranslate.logs = [
      t('documentTranslate.logStart', { file: store.documentTranslate.excelFile }),
      t('documentTranslate.logSourceLang', { lang: store.documentTranslate.sourceLanguage?.text || '' }),
      t('documentTranslate.logTargetLang', { lang: store.documentTranslate.selectedLanguages.join(', ') })
    ]

    // 读取主Excel文件
    const result = await ipcRenderer.invoke('read-excel-file', store.documentTranslate.excelFile)
    if (!result.success) {
      throw new Error(`读取Excel文件失败: ${result.error}`)
    }

    const { data, sheetName } = result

    // 如果使用外置参考源，读取参考文件
    let referenceData: ExcelRow[] = []
    if (store.documentTranslate.referenceType === 'external') {
      const refResult = await ipcRenderer.invoke('read-excel-file', store.documentTranslate.externalRefFile)
      if (!refResult.success) {
        throw new Error(`读取参考文件失败: ${refResult.error}`)
      }
      referenceData = refResult.data
    }

    // 获取翻译服务实例
    const translateService = getUnifiedTranslateService()

    // 创建新的数据结构，保留原始数据
    const translatedData: ExcelRow[] = []
    let processedCount = 0

    // 获取源文本列和参考文本列（如果使用内置参考）
    const sourceColumn = Object.keys(data[0])[0] // 第一列作为源文本
    const refColumn = store.documentTranslate.referenceType === 'internal' ? store.documentTranslate.internalRefLang : null

    // 遍历每一行数据
    for (const row of data as ExcelRow[]) {
      // 创建新行，首先复制原始行的所有数据
      const translatedRow: ExcelRow = { ...row }
      
      // 获取源文本
      const sourceText = row[sourceColumn]
      if (typeof sourceText === 'string' && sourceText.trim()) {
        // 为每个目标语言进行翻译
        for (const targetLang of store.documentTranslate.selectedLanguages) {
          try {
            let refValue = ''

            // 获取参考文本
            if (store.documentTranslate.referenceType === 'internal' && refColumn) {
              // 从当前行获取参考文本
              const internalRef = row[refColumn]
              refValue = typeof internalRef === 'string' ? internalRef : ''
            } else if (store.documentTranslate.referenceType === 'external') {
              // 从参考文件中查找匹配的行
              const matchingRow = referenceData.find(refRow => {
                return refRow[sourceColumn] === sourceText
              })
              if (matchingRow) {
                const externalRef = matchingRow[store.documentTranslate.externalRefLang]
                refValue = typeof externalRef === 'string' ? externalRef : ''
              }
            }

            // 构建简化的提示词
            const prompt = refValue
              ? `${sourceText}\n参考翻译: ${refValue}`
              : sourceText

            const translatedText = await translateService.translateText(
              prompt,
              store.documentTranslate.sourceLanguage?.text || '英语',
              targetLang,
              [], // 这里可以添加术语表支持
              (current, total) => {
                store.addDocumentLog(t('documentTranslate.logTranslating', { row: processedCount + 1, lang: targetLang, current, total }))
              }
            )

            // 添加翻译结果列
            translatedRow[targetLang] = translatedText
          } catch (err) {
            console.error('翻译失败:', err)
            translatedRow[targetLang] = `[翻译失败] ${sourceText}`
          }
        }
      }

      translatedData.push(translatedRow)
      processedCount++
      store.addDocumentLog(t('documentTranslate.logRowDone', { row: processedCount, total: data.length }))
    }

    // 生成输出文件夹路径
    const outputDir = store.documentTranslate.excelFile.replace(/\.[^.]+$/, '_translations')
    // 生成输出文件名（使用相对路径）
    const fileName = `translated_${new Date().getTime()}.xlsx`
    const outputPath = `${outputDir}/${fileName}`

    // 通过IPC保存翻译后的文件，让主进程处理目录创建
    const saveResult = await ipcRenderer.invoke('save-excel-file', {
      data: translatedData,
      filePath: outputPath,
      sheetName,
      createDir: true // 添加标志告诉主进程需要创建目录
    })

    if (!saveResult.success) {
      throw new Error(`保存翻译结果失败: ${saveResult.error}`)
    }

    // 更新日志对象
    const endTime = new Date().toISOString()
    const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
    
    Object.assign(logEntry, {
      translateCount: processedCount * store.documentTranslate.selectedLanguages.length,
      endTime,
      duration,
      completed: true
    })

    // 保存日志
    await ipcRenderer.invoke('save-log', logEntry)

    // 保存翻译结果
    const translateResult = {
      type: '文档' as const,
      sourceLanguage: store.documentTranslate.sourceLanguage?.text || '',
      targetLanguage: store.documentTranslate.selectedLanguages.join(', '),
      sourceContent: '文档内容',
      translatedContent: `已翻译 ${processedCount} 行，共 ${store.documentTranslate.selectedLanguages.length} 种语言`,
      timestamp: startTime,
      status: '成功' as const,
      fileName: store.documentTranslate.excelFile, // 存储完整的源文件路径
      filePath: saveResult.outputPath // 使用主进程返回的实际输出路径
    }
    await ipcRenderer.invoke('save-translate-result', translateResult)

    store.addDocumentLog(t('documentTranslate.logSaved', { path: saveResult.outputPath }))
    store.addDocumentLog(t('documentTranslate.logAllDone'))
  } catch (err: unknown) {
    console.error('翻译过程出错:', err)
    const errorMessage = err instanceof Error ? err.message : '未知错误'
    
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
      type: '文档' as const,
      sourceLanguage: store.documentTranslate.sourceLanguage?.text || '',
      targetLanguage: store.documentTranslate.selectedLanguages.join(', '),
      sourceContent: '文档内容',
      translatedContent: `翻译失败: ${errorMessage}`,
      timestamp: startTime,
      status: '失败' as const,
      fileName: store.documentTranslate.excelFile, // 存储完整的源文件路径
      filePath: store.documentTranslate.excelFile
    }
    await ipcRenderer.invoke('save-translate-result', translateResult)
    
    store.addDocumentLog(t('documentTranslate.logError', { error: errorMessage }))
  } finally {
    store.documentTranslate.isTranslating = false
  }
}
</script>

<style scoped>
.reference-options {
  padding: 16px;
  background: rgba(var(--v-theme-surface-variant), 0.1);
  border-radius: 8px;
}

.language-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.source-language {
  display: flex;
  align-items: center;
  gap: 16px;
}

.label {
  min-width: 80px;
  color: rgb(var(--v-theme-on-surface));
}

.language-select {
  width: 200px;
}

.target-languages {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.language-checkbox {
  margin: 0;
}

.reference-select {
  width: 200px;
}

.section {
  margin-bottom: 24px;
}
</style> 