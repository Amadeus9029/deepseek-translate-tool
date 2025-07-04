<template>
  <div class="document-translate">
    <v-card class="translate-card" flat>
      <v-card-text>
        <!-- 文件设置 -->
        <div class="section">
          <div class="section-title">文件设置</div>
          <div class="file-input-row">
            <div class="label">Excel文件:</div>
            <v-text-field
              v-model="store.documentTranslate.excelFile"
              hide-details
              density="compact"
              variant="outlined"
              readonly
              placeholder="请选择Excel文件"
              class="file-input"
            ></v-text-field>
            <v-btn 
              color="primary" 
              class="select-btn" 
              @click="selectFile"
              :disabled="store.documentTranslate.isTranslating"
            >
              选择文件
            </v-btn>
          </div>
        </div>

        <!-- 翻译参考设置 -->
        <div class="section">
          <div class="section-title">翻译参考设置</div>
          <div class="reference-options">
            <v-radio-group v-model="store.documentTranslate.referenceType" inline hide-details>
              <v-radio label="不使用参考源" value="none"></v-radio>
              <v-radio label="使用内置参考源" value="internal"></v-radio>
              <v-radio label="使用外置参考源" value="external"></v-radio>
            </v-radio-group>

            <!-- 内置参考源设置 -->
            <div v-if="store.documentTranslate.referenceType === 'internal'" class="mt-4">
              <v-select
                v-model="store.documentTranslate.internalRefLang"
                :items="availableLanguages"
                label="选择参考语言列"
                hide-details
                density="compact"
                variant="outlined"
                class="reference-select"
              ></v-select>
            </div>

            <!-- 外置参考源设置 -->
            <div v-if="store.documentTranslate.referenceType === 'external'" class="mt-4">
              <div class="file-input-row mb-2">
                <v-text-field
                  v-model="store.documentTranslate.externalRefFile"
                  hide-details
                  density="compact"
                  variant="outlined"
                  readonly
                  placeholder="请选择参考Excel文件"
                  class="file-input"
                ></v-text-field>
                <v-btn 
                  color="primary" 
                  class="select-btn" 
                  @click="selectRefFile"
                  :disabled="store.documentTranslate.isTranslating"
                >
                  选择文件
                </v-btn>
              </div>
              <v-select
                v-model="store.documentTranslate.externalRefLang"
                :items="availableLanguages"
                label="选择参考语言列"
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
          <div class="section-title">语言设置</div>
          <div class="language-settings">
            <div class="source-language">
              <div class="label">源语言:</div>
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
        <div class="action-section">
          <v-btn 
            color="primary" 
            size="large" 
            class="start-btn" 
            @click="startTranslate"
            :loading="store.documentTranslate.isTranslating"
            :disabled="store.documentTranslate.isTranslating"
          >
            {{ store.documentTranslate.isTranslating ? '翻译中...' : '开始翻译' }}
          </v-btn>
        </div>

        <!-- 运行日志 -->
        <div class="section">
          <div class="section-title">运行日志</div>
          <div class="log-container">
            <div v-if="store.documentTranslate.logs.length === 0" class="empty-log">
              暂无日志信息
            </div>
            <div v-else class="log-content">
              <div v-for="(log, index) in store.documentTranslate.logs" :key="index" class="log-item">
                {{ log }}
              </div>
            </div>
          </div>
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

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const store = useTranslateStore()

interface ExcelRow {
  [key: string]: string | number | boolean | null | undefined
}

// 组件挂载时初始化状态
onMounted(() => {
  // 如果状态为空，设置默认值
  if (!store.documentTranslate.sourceLanguage) {
    store.documentTranslate.sourceLanguage = { text: '英语', value: '英语' }
  }
})

async function selectFile() {
  if (!ipcRenderer) return
  
  try {
    const result = await ipcRenderer.invoke('open-file-dialog', {
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
      ]
    })
    
    if (result.filePath) {
      store.documentTranslate.excelFile = result.filePath
      store.addDocumentLog(`已选择文件: ${result.filePath}`)
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

async function selectRefFile() {
  if (!ipcRenderer) return
  
  try {
    const result = await ipcRenderer.invoke('open-file-dialog', {
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
      ]
    })
    
    if (result.filePath) {
      store.documentTranslate.externalRefFile = result.filePath
      store.addDocumentLog(`已选择参考文件: ${result.filePath}`)
    }
  } catch (error) {
    console.error('选择参考文件失败:', error)
  }
}

async function startTranslate() {
  if (!store.documentTranslate.excelFile) {
    store.addDocumentLog('请先选择要翻译的文件')
    return
  }

  if (store.documentTranslate.selectedLanguages.length === 0) {
    store.addDocumentLog('请选择至少一个目标语言')
    return
  }

  // 验证参考源设置
  if (store.documentTranslate.referenceType === 'internal' && !store.documentTranslate.internalRefLang) {
    store.addDocumentLog('请选择内置参考源语言')
    return
  }

  if (store.documentTranslate.referenceType === 'external') {
    if (!store.documentTranslate.externalRefFile) {
      store.addDocumentLog('请选择外置参考源文件')
      return
    }
    if (!store.documentTranslate.externalRefLang) {
      store.addDocumentLog('请选择外置参考源语言')
      return
    }
  }

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
      `开始翻译：${store.documentTranslate.excelFile}`,
      `源语言：${store.documentTranslate.sourceLanguage?.text || ''}`,
      `目标语言：${store.documentTranslate.selectedLanguages.join(', ')}`
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
                store.addDocumentLog(`正在翻译第 ${processedCount + 1} 行的 ${targetLang} 翻译，进度：${current}/${total}`)
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
      store.addDocumentLog(`完成第 ${processedCount}/${data.length} 行的所有语言翻译`)
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

    store.addDocumentLog(`已保存所有翻译结果到: ${saveResult.outputPath}`)
    store.addDocumentLog('翻译任务已完成！')
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
    
    store.addDocumentLog(`翻译出错: ${errorMessage}`)
  } finally {
    store.documentTranslate.isTranslating = false
  }
}
</script>

<style scoped>
.document-translate {
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  overflow: hidden;
}

.translate-card {
  width: 100%;
  height: 100%;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.v-card-text {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px; /* 为滚动条预留空间 */
}

/* 美化v-card-text的滚动条 */
.v-card-text::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}

.v-card-text::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

.v-card-text::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: rgb(var(--v-theme-on-surface));
}

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
  min-width: 100px;
}

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

.action-section {
  display: flex;
  justify-content: center;
  margin: 32px 0;
}

.start-btn {
  min-width: 160px;
}

.log-container {
  height: 200px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 4px;
  padding: 16px;
  overflow-y: auto;
}

.empty-log {
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-align: center;
  padding: 16px;
}

.log-item {
  padding: 4px 0;
  color: rgb(var(--v-theme-on-surface));
}

.reference-select {
  width: 200px;
}
</style> 