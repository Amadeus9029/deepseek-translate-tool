<!-- Word文档解析页面 -->
<template>
  <PageCard>
    <div class="docx-parser">
      <SectionHeader :title="'Word文档解析与翻译'" />
      
      <!-- 文件选择 -->
      <div class="section">
        <FileSelector
          :filePath="filePath"
          :label="'Word文档'"
          :placeholder="'选择Word文档'"
          :disabled="isProcessing || isPreprocessing"
          :buttonText="'选择文件'"
          @select="selectFile"
        />
      </div>
      
      <!-- 操作按钮 -->
      <ActionSection>
        <ActionButton
          :label="'解析文档'"
          :loadingText="'解析中...'"
          :loading="isProcessing"
          :disabled="!filePath || isProcessing || isPreprocessing"
          @click="parseDocx"
        />
        
        <ActionButton
          :label="'查看文档结构'"
          :loadingText="'加载中...'"
          :loading="isLoadingStructure"
          :disabled="!filePath || isProcessing || isLoadingStructure || isPreprocessing"
          @click="getDocxStructure"
        />
        
        <ActionButton
          :label="'预处理文档'"
          :loadingText="'预处理中...'"
          :loading="isPreprocessing"
          :disabled="!filePath || isProcessing || isPreprocessing"
          @click="preprocessDocx"
        />
        
        <ActionButton
          v-if="parseResult && parseResult.outputDir"
          :label="'打开解析输出目录'"
          :disabled="isProcessing || isPreprocessing"
          @click="openOutputDir"
        />
        
        <ActionButton
          v-if="preprocessResult && preprocessResult.outputDir"
          :label="'打开预处理输出目录'"
          :disabled="isProcessing || isPreprocessing"
          @click="openPreprocessDir"
        />
      </ActionSection>
      
      <!-- 解析结果 -->
      <DocxParserResult
        :loading="isProcessing"
        :error="error"
        :result="parseResult"
      />
      
      <!-- 文档结构 -->
      <div v-if="docStructure" class="section mt-4">
        <SectionHeader :title="'文档结构'" />
        <v-card>
          <v-card-text>
            <div class="structure-item">
              <strong>文件数量:</strong> {{ docStructure.files?.length || 0 }}
            </div>
            <div class="structure-item">
              <strong>段落数量:</strong> {{ docStructure.paragraphs?.length || 0 }}
            </div>
            <div class="structure-item">
              <strong>媒体文件:</strong> {{ docStructure.mediaFiles?.length || 0 }}
            </div>
            
            <div class="mt-4">
              <h4>文档内容预览</h4>
              <div v-if="docStructure.paragraphs && docStructure.paragraphs.length > 0" class="preview-content">
                <div v-for="(paragraph, index) in docStructure.paragraphs.slice(0, 10)" :key="index" class="preview-paragraph">
                  {{ paragraph }}
                </div>
                <div v-if="docStructure.paragraphs.length > 10" class="more-content">
                  还有 {{ docStructure.paragraphs.length - 10 }} 个段落未显示...
                </div>
              </div>
              <div v-else class="no-content">
                未找到文档内容
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>
      
      <!-- 预处理结果 -->
      <div v-if="preprocessResult && preprocessResult.segments" class="section mt-4">
        <SectionHeader :title="'预处理结果'" />
        <v-card>
          <v-card-text>
            <div class="structure-item">
              <strong>处理后段落/句子数量:</strong> {{ preprocessResult.segments.length }}
            </div>
            <div class="structure-item">
              <strong>提取的标签数量:</strong> {{ Object.keys(preprocessResult.placeholders || {}).length }}
            </div>
            <div class="structure-item">
              <strong>输出目录:</strong> {{ preprocessResult.outputDir }}
            </div>
            
            <div class="mt-4">
              <h4>预处理内容预览</h4>
              <div v-if="preprocessResult.segments && preprocessResult.segments.length > 0" class="preview-content">
                <div v-for="(segment, index) in preprocessResult.segments.slice(0, 10)" :key="index" class="preview-segment">
                  <div class="segment-header">
                    <span class="segment-id">{{ segment.id }}</span>
                    <span class="segment-type">{{ segment.type }}</span>
                  </div>
                  <div class="segment-text">{{ segment.text }}</div>
                </div>
                <div v-if="preprocessResult.segments.length > 10" class="more-content">
                  还有 {{ preprocessResult.segments.length - 10 }} 个段落/句子未显示...
                </div>
              </div>
              <div v-else class="no-content">
                未找到预处理内容
              </div>
            </div>
            
            <div class="mt-4">
              <h4>标签占位符示例</h4>
              <div v-if="preprocessResult.placeholders && Object.keys(preprocessResult.placeholders).length > 0" class="preview-content">
                <div v-for="(placeholder, id, index) in limitObjectEntries(preprocessResult.placeholders, 5)" :key="id" class="preview-placeholder">
                  <div class="placeholder-header">
                    <span class="placeholder-id">{{ id }}</span>
                    <span class="placeholder-type">{{ placeholder.type }}</span>
                  </div>
                  <div class="placeholder-tag">{{ truncateText(placeholder.originalTag, 100) }}</div>
                </div>
                <div v-if="Object.keys(preprocessResult.placeholders).length > 5" class="more-content">
                  还有 {{ Object.keys(preprocessResult.placeholders).length - 5 }} 个标签占位符未显示...
                </div>
              </div>
              <div v-else class="no-content">
                未找到标签占位符
              </div>
            </div>
            
            <!-- 翻译按钮 -->
            <div class="mt-4 translation-section" v-if="preprocessResult && preprocessResult.segments && preprocessResult.segments.length > 0">
              <h4>翻译文档</h4>
              <div class="translation-controls">
                <div class="language-selectors">
                  <div class="language-selector">
                    <label>源语言:</label>
                    <v-select
                      v-model="sourceLang"
                      :items="languages"
                      item-title="label"
                      item-value="value"
                      density="compact"
                      variant="outlined"
                      hide-details
                    ></v-select>
                  </div>
                  
                  <div class="language-selector">
                    <label>目标语言:</label>
                    <v-select
                      v-model="targetLang"
                      :items="languages"
                      item-title="label"
                      item-value="value"
                      density="compact"
                      variant="outlined"
                      hide-details
                    ></v-select>
                  </div>
                </div>
                
                <ActionButton
                  :label="'翻译文档'"
                  :loadingText="'翻译中...'"
                  :loading="isTranslating"
                  :disabled="!preprocessResult || !preprocessResult.outputDir || isTranslating"
                  @click="translateDocument"
                />
              </div>
            </div>
            
            <!-- 翻译结果 -->
            <div v-if="translatedSegments.length > 0" class="mt-4">
              <h4>翻译结果</h4>
              <div class="preview-content">
                <div v-for="(segment, index) in translatedSegments.slice(0, 10)" :key="index" class="preview-segment">
                  <div class="segment-header">
                    <span class="segment-id">{{ segment.id }}</span>
                    <span class="segment-type">{{ segment.type }}</span>
                  </div>
                  <div class="segment-text">
                    <div class="source-text">原文: {{ segment.text }}</div>
                    <div class="translated-text">译文: {{ segment.translatedText }}</div>
                  </div>
                </div>
                <div v-if="translatedSegments.length > 10" class="more-content">
                  还有 {{ translatedSegments.length - 10 }} 个段落/句子未显示...
                </div>
                
                <div class="mt-4 translation-actions">
                  <div class="translation-info">
                    <div class="info-item">
                      <strong>翻译段落数量:</strong> {{ translatedSegments.length }}
                    </div>
                    <div class="info-item">
                      <strong>输出文件:</strong> {{ translatedFilePath }}
                    </div>
                  </div>
                  
                  <div class="action-buttons">
                    <ActionButton
                      :label="'打开翻译结果文件'"
                      :disabled="!translatedFilePath"
                      @click="openTranslatedFile"
                    />
                    
                    <ActionButton
                      :label="'打开输出目录'"
                      :disabled="!translatedFilePath"
                      @click="openTranslatedFileLocation"
                    />
                  </div>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </PageCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageCard from '../components/ui/PageCard.vue'
import SectionHeader from '../components/ui/SectionHeader.vue'
import FileSelector from '../components/ui/FileSelector.vue'
import ActionButton from '../components/ui/ActionButton.vue'
import ActionSection from '../components/ui/ActionSection.vue'
import DocxParserResult from '../components/ui/DocxParserResult.vue'
import { getUnifiedTranslateService } from '../services/TranslateService'

// 定义接口
interface TextSegment {
  id: string;
  type: string;
  text: string;
  originalXml?: string;
  placeholders?: any[];
}

interface TranslatedSegment extends TextSegment {
  translatedText: string;
}

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const { t } = useI18n()

// 状态
const filePath = ref<string>('')
const isProcessing = ref<boolean>(false)
const isLoadingStructure = ref<boolean>(false)
const isPreprocessing = ref<boolean>(false)
const isTranslating = ref<boolean>(false)
const error = ref<string>('')
const parseResult = ref<any>(null)
const docStructure = ref<any>(null)
const preprocessResult = ref<any>(null)
const sourceLang = ref('英语')
const targetLang = ref('中文')
const translatedSegments = ref<TranslatedSegment[]>([])
const translatedFilePath = ref('')

// 语言选项
const languages = [
  { label: '中文', value: '中文' },
  { label: '英语', value: '英语' },
  { label: '日语', value: '日语' },
  { label: '韩语', value: '韩语' },
  { label: '法语', value: '法语' },
  { label: '德语', value: '德语' },
  { label: '西班牙语', value: '西班牙语' },
  { label: '俄语', value: '俄语' }
]

// 选择Word文档
async function selectFile() {
  try {
    const result = await ipcRenderer.invoke('open-file-dialog', {
      filters: [
        { name: 'Word文档', extensions: ['docx'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result.success && result.filePath) {
      filePath.value = result.filePath
      // 清除之前的结果
      parseResult.value = null
      docStructure.value = null
      preprocessResult.value = null
      translatedSegments.value = []
      translatedFilePath.value = ''
      error.value = ''
    }
  } catch (err: any) {
    console.error('选择文件失败:', err)
    error.value = `选择文件失败: ${err.message || err}`
  }
}

// 解析Word文档
async function parseDocx() {
  if (!filePath.value) return
  
  try {
    isProcessing.value = true
    error.value = ''
    
    const result = await ipcRenderer.invoke('parse-docx', filePath.value)
    
    if (result.success) {
      parseResult.value = result
    } else {
      error.value = result.error || '解析失败，未知错误'
    }
  } catch (err: any) {
    console.error('解析文档失败:', err)
    error.value = `解析文档失败: ${err.message || err}`
  } finally {
    isProcessing.value = false
  }
}

// 获取文档结构
async function getDocxStructure() {
  if (!filePath.value) return
  
  try {
    isLoadingStructure.value = true
    
    const result = await ipcRenderer.invoke('get-docx-structure', filePath.value)
    
    if (result.success) {
      docStructure.value = result.structure
    } else {
      console.error('获取文档结构失败:', result.error)
    }
  } catch (err: any) {
    console.error('获取文档结构失败:', err)
  } finally {
    isLoadingStructure.value = false
  }
}

// 预处理Word文档
async function preprocessDocx() {
  if (!filePath.value) return
  
  try {
    isPreprocessing.value = true
    error.value = ''
    
    const result = await ipcRenderer.invoke('preprocess-docx', filePath.value)
    
    if (result.success) {
      preprocessResult.value = result
    } else {
      error.value = result.error || '预处理失败，未知错误'
    }
  } catch (err: any) {
    console.error('预处理文档失败:', err)
    error.value = `预处理文档失败: ${err.message || err}`
  } finally {
    isPreprocessing.value = false
  }
}

// 翻译文档
async function translateDocument() {
  if (!preprocessResult.value || !preprocessResult.value.outputDir) return
  
  try {
    isTranslating.value = true
    error.value = ''
    
    // 获取翻译服务
    const translateService = getUnifiedTranslateService()
    
    // 直接使用预处理结果中的段落
    if (!preprocessResult.value.segments || !Array.isArray(preprocessResult.value.segments)) {
      throw new Error('未找到有效的段落数据')
    }
    
    const segments = preprocessResult.value.segments as TextSegment[]
    console.log(`开始翻译 ${segments.length} 个段落`)
    
    // 翻译每个段落
    const translatedSegs: TranslatedSegment[] = []
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      
      // 跳过空段落
      if (!segment.text || !segment.text.trim()) {
        translatedSegs.push({
          ...segment,
          translatedText: ''
        })
        continue
      }
      
      console.log(`翻译段落 ${i + 1}/${segments.length}: ${segment.id}`)
      console.log(`原文: ${segment.text.substring(0, 50)}${segment.text.length > 50 ? '...' : ''}`)
      
      try {
        // 使用翻译服务翻译文本
        const translatedText = await translateService.translateText(
          segment.text,
          sourceLang.value,
          targetLang.value,
          []
        )
        
        console.log(`译文: ${translatedText.substring(0, 50)}${translatedText.length > 50 ? '...' : ''}`)
        
        translatedSegs.push({
          ...segment,
          translatedText
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`翻译段落 ${segment.id} 失败:`, errorMsg)
        
        // 添加错误信息
        translatedSegs.push({
          ...segment,
          translatedText: `[翻译失败: ${errorMsg}]`
        })
      }
    }
    
    // 将结果保存到状态中
    translatedSegments.value = translatedSegs
    
    // 生成输出文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = filePath.value.split(/[\\/]/).pop() || ''
    const fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'))
    const outputFileName = `${baseName}_${targetLang.value}_${timestamp}${fileExt}`
    
    // 准备可序列化的数据用于IPC传输
    const serializableSegments = translatedSegs.map(seg => ({
      id: seg.id,
      type: seg.type,
      text: seg.text,
      translatedText: seg.translatedText,
      originalXml: seg.originalXml
      // 不包含可能导致序列化问题的placeholders
    }))
    
    // 还原翻译后的Word文档
    const restoreResult = await ipcRenderer.invoke('restore-translated-docx', {
      originalFilePath: filePath.value,
      translatedSegments: serializableSegments,
      outputFileName
    })
    
    if (restoreResult.success) {
      translatedFilePath.value = restoreResult.outputPath
      console.log(`翻译完成，已保存至: ${restoreResult.outputPath}`)
    } else {
      throw new Error(restoreResult.error || '还原翻译后的Word文档失败')
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('翻译文档失败:', errorMsg)
    error.value = `翻译文档失败: ${errorMsg}`
  } finally {
    isTranslating.value = false
  }
}

// 打开解析输出目录
async function openOutputDir() {
  if (!parseResult.value || !parseResult.value.outputDir) return
  
  try {
    await ipcRenderer.invoke('open-file', parseResult.value.outputDir)
  } catch (err: any) {
    console.error('打开输出目录失败:', err)
  }
}

// 打开预处理输出目录
async function openPreprocessDir() {
  if (!preprocessResult.value || !preprocessResult.value.outputDir) return
  
  try {
    await ipcRenderer.invoke('open-file', preprocessResult.value.outputDir)
  } catch (err: any) {
    console.error('打开预处理输出目录失败:', err)
  }
}

// 打开翻译结果文件
async function openTranslatedFile() {
  if (!translatedFilePath.value) return
  
  try {
    await ipcRenderer.invoke('open-file', translatedFilePath.value)
  } catch (err: any) {
    console.error('打开翻译结果文件失败:', err)
  }
}

// 打开翻译结果文件所在目录
async function openTranslatedFileLocation() {
  if (!translatedFilePath.value) return
  
  try {
    await ipcRenderer.invoke('open-file-location', translatedFilePath.value)
  } catch (err: any) {
    console.error('打开输出目录失败:', err)
  }
}

// 限制对象条目数量的辅助函数
function limitObjectEntries(obj: Record<string, any>, limit: number): Record<string, any> {
  if (!obj) return {}
  
  const keys = Object.keys(obj).slice(0, limit)
  const result: Record<string, any> = {}
  
  keys.forEach(key => {
    result[key] = obj[key]
  })
  
  return result
}

// 截断文本的辅助函数
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  
  if (text.length <= maxLength) {
    return text
  }
  
  return text.substring(0, maxLength) + '...'
}
</script>

<style scoped>
.docx-parser {
  width: 100%;
}

.section {
  margin-bottom: 20px;
}

.structure-item {
  margin-bottom: 8px;
}

.preview-content {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-top: 8px;
}

.preview-paragraph {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.preview-segment {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.segment-header {
  display: flex;
  margin-bottom: 4px;
}

.segment-id {
  font-weight: bold;
  margin-right: 8px;
  color: #1976d2;
}

.segment-type {
  color: #666;
  font-style: italic;
}

.segment-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-placeholder {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.placeholder-header {
  display: flex;
  margin-bottom: 4px;
}

.placeholder-id {
  font-weight: bold;
  margin-right: 8px;
  color: #1976d2;
}

.placeholder-type {
  color: #666;
  font-style: italic;
}

.placeholder-tag {
  font-family: monospace;
  font-size: 12px;
  background-color: #f5f5f5;
  padding: 4px;
  border-radius: 2px;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-paragraph:last-child,
.preview-segment:last-child,
.preview-placeholder:last-child {
  border-bottom: none;
}

.more-content {
  padding: 8px;
  color: #666;
  text-align: center;
  font-style: italic;
}

.no-content {
  padding: 16px;
  color: #999;
  text-align: center;
  font-style: italic;
}

.translation-section {
  border-top: 1px solid #eee;
  padding-top: 16px;
}

.translation-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
}

.language-selectors {
  display: flex;
  gap: 16px;
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.source-text {
  margin-bottom: 4px;
}

.translated-text {
  color: #1976d2;
}

.translation-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.translation-info {
  display: flex;
  gap: 20px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}
</style> 