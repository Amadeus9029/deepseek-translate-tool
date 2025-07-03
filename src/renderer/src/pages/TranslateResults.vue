<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import { useTranslateStore } from '../stores/translateStore'

interface TranslateResult {
  id: string
  type: '文本' | '文档' | '字幕'
  sourceLanguage: string
  targetLanguage: string
  sourceContent: string
  translatedContent: string
  timestamp: string
  status: '成功' | '失败'
  fileName: string
  filePath: string
}

// 修改重命名目标类型
interface RenameTarget {
  result: TranslateResult
  type: 'source' | 'output'
}

const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)

// 模拟数据
const results = ref<TranslateResult[]>([])

// 加载翻译结果
async function loadResults() {
  try {
    const response = await ipcRenderer?.invoke('read-translate-results')
    if (response?.success) {
      results.value = response.results
    } else {
      console.error('加载翻译结果失败:', response?.error)
    }
  } catch (error) {
    console.error('加载翻译结果失败:', error)
  }
}

// 在组件挂载时加载结果
onMounted(() => {
  loadResults()
})

const search = ref('')
const selectedType = ref<string[]>([])
const selectedStatus = ref<string[]>([])
const dateRange = ref([null, null])
const sortBy = ref('timestamp')
const sortDesc = ref(true)
const selectedResult = ref<TranslateResult | null>(null)
const detailDialog = ref(false)
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

// 重命名对话框
const renameDialog = ref(false)
const renameTarget = ref<RenameTarget | null>(null)
const newFileName = ref('')

const types = ['文本', '文档', '字幕']
const statuses = ['成功', '失败']

// 使用翻译状态存储
const translateStore = useTranslateStore()

// 过滤和排序后的结果
const filteredResults = computed(() => {
  return results.value
    .filter(result => {
      const matchSearch = search.value === '' || 
        result.sourceContent.toLowerCase().includes(search.value.toLowerCase()) ||
        result.translatedContent.toLowerCase().includes(search.value.toLowerCase())
      
      const matchType = selectedType.value.length === 0 || 
        selectedType.value.includes(result.type)
      
      const matchStatus = selectedStatus.value.length === 0 || 
        selectedStatus.value.includes(result.status)
      
      const matchDate = !dateRange.value[0] || !dateRange.value[1] || 
        (new Date(result.timestamp) >= new Date(dateRange.value[0]) &&
         new Date(result.timestamp) <= new Date(dateRange.value[1]))
      
      return matchSearch && matchType && matchStatus && matchDate
    })
    .sort((a, b) => {
      const modifier = sortDesc.value ? -1 : 1
      return modifier * a[sortBy.value].localeCompare(b[sortBy.value])
    })
})
// 清除所有翻译结果
// const clearResults = async () => {
//   try {
//     const response = await ipcRenderer?.invoke('clear-translate-results')
//     if (response?.success) {
//       results.value = []
//     } else {
//       console.error('清除翻译结果失败:', response?.error)
//     }
//   } catch (error) {
//     console.error('清除翻译结果失败:', error)
//   }
// }

// 导出翻译结果
const exportResults = async () => {
  try {
    // 过滤后的结果转为CSV格式
    const csvContent = filteredResults.value.map(result => {
      return [
        result.type,
        result.sourceLanguage,
        result.targetLanguage,
        `"${result.sourceContent.replace(/"/g, '""')}"`,
        `"${result.translatedContent.replace(/"/g, '""')}"`,
        result.timestamp,
        result.status,
        result.fileName ? `"${getFileName(result.fileName)}"` : '',
        result.filePath ? `"${getFileName(result.filePath)}"` : ''
      ].join(',')
    })

    // 添加CSV头
    const headers = [
      '类型',
      '源语言',
      '目标语言',
      '源文本',
      '翻译结果',
      '时间',
      '状态',
      '文件名',
      '输出文件'
    ].join(',')

    const csvData = [headers, ...csvContent].join('\n')

    // 创建Blob对象
    const blob = new Blob(['\ufeff' + csvData], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    // 创建下载链接
    const link = document.createElement('a')
    link.href = url
    link.download = `翻译结果_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()

    // 清理
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出翻译结果失败:', error)
  }
}

const showDetails = (result: TranslateResult) => {
  selectedResult.value = result
  detailDialog.value = true
}

const clearFilters = () => {
  search.value = ''
  selectedType.value = []
  selectedStatus.value = []
  dateRange.value = [null, null]
}

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 检查文件路径是否完整，如果不是完整路径则显示错误提示
const isValidPath = (filePath: string | undefined): boolean => {
  if (!filePath) return false
  // 检查是否是有效的路径格式
  return /^([a-zA-Z]:\\|\\\\|\/|~\/|\.\/|\.\.\/|[a-zA-Z]:\/)/i.test(filePath)
}

// 打开文件
const openFile = async (filePath: string | undefined) => {
  if (!filePath) {
    showError('文件路径为空')
    return
  }
  
  if (!isValidPath(filePath)) {
    showError(`文件路径不完整或无效: ${filePath}`)
    return
  }
  
  try {
    const result = await ipcRenderer?.invoke('open-file', filePath)
    if (!result?.success) {
      showError(`打开文件失败: ${result?.error}`)
    }
  } catch (error) {
    showError(`打开文件失败: ${error}`)
  }
}

// 打开文件所在文件夹
const openFileLocation = async (filePath: string | undefined) => {
  if (!filePath) {
    showError('文件路径为空')
    return
  }
  
  if (!isValidPath(filePath)) {
    showError(`文件路径不完整或无效: ${filePath}`)
    return
  }
  
  try {
    const result = await ipcRenderer?.invoke('open-file-location', filePath)
    if (!result?.success) {
      showError(`打开文件夹失败: ${result?.error}`)
    }
  } catch (error) {
    showError(`打开文件夹失败: ${error}`)
  }
}

// 显示错误消息
const showError = (message: string) => {
  snackbarColor.value = 'error'
  snackbarText.value = message
  showSnackbar.value = true
}

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

// 格式化长文本显示
const formatLongText = (text: string, maxLength = 100) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// 计算文本行数
const getLineCount = (text: string) => {
  return text.split('\n').length
}

// 获取文件名
const getFileName = (filePath: string | undefined) => {
  if (!filePath) return ''
  return filePath.split(/[\\/]/).pop() || ''
}

// 获取文件夹路径
const getDirectoryPath = (filePath: string | undefined) => {
  if (!filePath) return ''
  const fileName = getFileName(filePath)
  return filePath.slice(0, filePath.length - fileName.length)
}

// 打开重命名对话框
const openRenameDialog = (result: TranslateResult, type: 'source' | 'output') => {
  renameTarget.value = { result, type }
  newFileName.value = type === 'source' ? getFileName(result.fileName) : getFileName(result.filePath)
  renameDialog.value = true
}

// 修改重命名执行逻辑
const renameFile = async () => {
  if (!renameTarget.value || !newFileName.value) return

  try {
    const { result, type } = renameTarget.value
    const oldPath = type === 'source' ? result.fileName : result.filePath
    if (!oldPath) {
      snackbarColor.value = 'error'
      snackbarText.value = '文件路径不存在'
      showSnackbar.value = true
      return
    }

    const dirPath = getDirectoryPath(oldPath)
    const newPath = `${dirPath}${newFileName.value}`

    const renameResult = await ipcRenderer?.invoke('rename-file', {
      oldPath,
      newPath
    })

    if (renameResult?.success) {
      // 根据类型更新相应的文件名或路径
      if (type === 'source') {
        result.fileName = newPath // 更新为完整路径
      } else {
        result.filePath = newPath
      }

      // 更新存储文件中的翻译结果
      const updateResult = await ipcRenderer?.invoke('update-translate-result', {
        id: result.id,
        updates: {
          fileName: result.fileName,
          filePath: result.filePath
        }
      })

      if (updateResult?.success) {
        snackbarColor.value = 'success'
        snackbarText.value = '重命名成功'
      } else {
        snackbarColor.value = 'warning'
        snackbarText.value = '文件重命名成功，但更新存储失败'
        // 重新加载结果以保持数据一致性
        await loadResults()
      }
    } else {
      snackbarColor.value = 'error'
      snackbarText.value = '重命名失败: ' + renameResult?.error
    }
  } catch (error) {
    snackbarColor.value = 'error'
    snackbarText.value = '重命名失败: ' + error
  }

  showSnackbar.value = true
  renameDialog.value = false
}

// 添加查看字幕翻译结果的方法
const viewSubtitleResult = (result: TranslateResult) => {
  if (result.type === '字幕') {
    // 将字幕结果加载到store中
    translateStore.setSubtitleFile(result.fileName || '')
    translateStore.setSourceSubtitles(result.sourceContent)
    translateStore.setTranslatedSubtitles(result.translatedContent)
    translateStore.setOutputPath(result.filePath || '')
    
    // 计算字幕数量
    const sourceLines = result.sourceContent.split('\n').filter(line => line.trim()).length
    const translatedLines = result.translatedContent.split('\n').filter(line => line.trim()).length
    
    // 更新翻译进度
    translateStore.updateTranslationProgress(translatedLines, sourceLines)
    
    // 跳转到字幕翻译页面
    navigateToPage('字幕翻译')
  } else {
    showDetails(result)
  }
}

// 添加导航方法
const navigateToPage = (page: string) => {
  ipcRenderer?.send('navigate-to-page', page)
}
</script>

<template>
  <div class="translate-results-container">
    <v-card class="results-card" :theme="isDark ? 'dark' : 'light'">
      <!-- 工具栏 -->
      <v-toolbar density="comfortable" color="surface">
        <v-toolbar-title class="text-h6">翻译结果</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          prepend-icon="mdi-export"
          variant="tonal"
          class="mr-2"
          @click="exportResults"
        >
          导出结果
        </v-btn>
      </v-toolbar>

      <!-- 过滤器区域 -->
      <v-card-text>
        <div class="filters-container">
          <v-text-field
            v-model="search"
            label="搜索"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="comfortable"
            hide-details
            clearable
            class="filter-item"
          ></v-text-field>
          <v-select
            v-model="selectedType"
            :items="types"
            label="类型"
            multiple
            chips
            variant="outlined"
            density="comfortable"
            hide-details
            class="filter-item"
          ></v-select>
          <v-select
            v-model="selectedStatus"
            :items="statuses"
            label="状态"
            multiple
            chips
            variant="outlined"
            density="comfortable"
            hide-details
            class="filter-item"
          ></v-select>
          <v-btn
            variant="text"
            color="primary"
            @click="clearFilters"
            prepend-icon="mdi-filter-off"
            class="filter-item"
          >
            清除筛选
          </v-btn>
        </div>
      </v-card-text>

      <!-- 结果列表 -->
      <v-card-text class="px-0">
        <v-table fixed-header height="calc(100vh - 300px)">
          <thead>
            <tr>
              <th class="text-left">类型</th>
              <th class="text-left">源语言</th>
              <th class="text-left">目标语言</th>
              <th class="text-left" style="min-width: 200px;">输入</th>
              <th class="text-left" style="min-width: 200px;">输出</th>
              <th class="text-left" style="white-space: nowrap;">时间</th>
              <th class="text-left">状态</th>
              <th class="text-center" style="width: 68px;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in filteredResults" :key="result.id">
              <td>
                <v-chip
                  :color="result.type === '文本' ? 'primary' : result.type === '文档' ? 'success' : 'info'"
                  size="small"
                >
                  {{ result.type }}
                </v-chip>
              </td>
              <td>{{ result.sourceLanguage }}</td>
              <td>{{ result.targetLanguage }}</td>
              <td class="text-content">
                <div class="text-preview" v-tooltip.top="result.type === '文本' ? result.sourceContent : getFileName(result.fileName)">
                  {{ result.type === '文本' ? formatLongText(result.sourceContent) : getFileName(result.fileName) }}
                </div>
                <div v-if="result.fileName" class="file-actions">
                  <div class="action-group">
                    <v-btn
                      icon="mdi-file"
                      variant="text"
                      size="x-small"
                      color="primary"
                      @click.stop="openFile(result.fileName)"
                      v-tooltip.top="'打开源文件'"
                    ></v-btn>
                    <v-btn
                      icon="mdi-folder-open"
                      variant="text"
                      size="x-small"
                      color="primary"
                      @click.stop="openFileLocation(result.fileName)"
                      v-tooltip.top="'打开源文件夹'"
                    ></v-btn>
                  </div>
                  <div class="action-group">
                    <v-btn
                      icon="mdi-pencil"
                      variant="text"
                      size="x-small"
                      color="warning"
                      @click.stop="openRenameDialog(result, 'source')"
                      v-tooltip.top="'重命名源文件'"
                    ></v-btn>
                  </div>
                </div>
              </td>
              <td class="text-content">
                <div class="text-preview" v-tooltip.top="result.type === '文本' ? result.translatedContent : getFileName(result.filePath)">
                  {{ result.type === '文本' ? formatLongText(result.translatedContent) : getFileName(result.filePath) }}
                </div>
                <div v-if="result.filePath" class="file-actions">
                  <div class="action-group">
                    <v-btn
                      icon="mdi-file"
                      variant="text"
                      size="x-small"
                      color="primary"
                      @click.stop="openFile(result.filePath)"
                      v-tooltip.top="'打开输出文件'"
                    ></v-btn>
                    <v-btn
                      icon="mdi-folder-open"
                      variant="text"
                      size="x-small"
                      color="primary"
                      @click.stop="openFileLocation(result.filePath)"
                      v-tooltip.top="'打开输出文件夹'"
                    ></v-btn>
                  </div>
                  <div class="action-group">
                    <v-btn
                      icon="mdi-pencil-box"
                      variant="text"
                      size="x-small"
                      color="warning"
                      @click.stop="openRenameDialog(result, 'output')"
                      v-tooltip.top="'重命名输出文件'"
                    ></v-btn>
                  </div>
                </div>
              </td>
              <td>{{ formatDate(result.timestamp) }}</td>
              <td>
                <v-chip
                  :color="result.status === '成功' ? 'success' : 'error'"
                  size="small"
                >
                  {{ result.status }}
                </v-chip>
              </td>
              <td class="text-center">
                <v-btn
                  icon="mdi-eye"
                  variant="text"
                  size="small"
                  @click="viewSubtitleResult(result)"
                  color="primary"
                ></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <!-- 详情对话框 -->
    <v-dialog v-model="detailDialog" max-width="1000">
      <v-card v-if="selectedResult" class="detail-dialog">
        <v-card-title class="text-h5 d-flex align-center">
          翻译详情
          <v-chip
            :color="selectedResult.type === '文本' ? 'primary' : selectedResult.type === '文档' ? 'success' : 'info'"
            class="ml-2"
          >
            {{ selectedResult.type }}
          </v-chip>
          <v-spacer></v-spacer>
          <template v-if="selectedResult.fileName">
            <v-btn
              variant="text"
              color="primary"
              class="mr-2"
              @click="openFile(selectedResult.filePath!)"
              prepend-icon="mdi-file"
            >
              打开文件
            </v-btn>
            <v-btn
              variant="text"
              color="primary"
              @click="openFileLocation(selectedResult.filePath!)"
              prepend-icon="mdi-folder-open"
            >
              打开所在文件夹
            </v-btn>
          </template>
        </v-card-title>
        
        <v-divider></v-divider>

        <v-card-text class="detail-content">
          <div class="d-flex align-center mb-4">
            <div class="text-body-1">
              <strong>翻译时间：</strong>{{ formatDate(selectedResult.timestamp) }}
            </div>
            <v-spacer></v-spacer>
            <div class="text-body-1">
              <strong>状态：</strong>
              <v-chip
                :color="selectedResult.status === '成功' ? 'success' : 'error'"
                size="small"
              >
                {{ selectedResult.status }}
              </v-chip>
            </div>
          </div>

          <v-row>
            <v-col cols="6">
              <div class="text-h6 mb-2">源文本 ({{ selectedResult.sourceLanguage }})</div>
              <v-card
                variant="outlined"
                :class="{'content-card': true, 'content-card-large': getLineCount(selectedResult.sourceContent) > 10}"
              >
                <pre class="content-text">{{ selectedResult.sourceContent }}</pre>
              </v-card>
            </v-col>
            <v-col cols="6">
              <div class="text-h6 mb-2">翻译结果 ({{ selectedResult.targetLanguage }})</div>
              <v-card
                variant="outlined"
                :class="{'content-card': true, 'content-card-large': getLineCount(selectedResult.translatedContent) > 10}"
              >
                <pre class="content-text">{{ selectedResult.translatedContent }}</pre>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions class="detail-actions">
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            variant="text"
            @click="detailDialog = false"
          >
            关闭
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 重命名对话框 -->
    <v-dialog v-model="renameDialog" max-width="500">
      <v-card>
        <v-card-title>重命名文件</v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-4">当前文件名：{{ renameTarget?.type === 'source' ? getFileName(renameTarget.result.fileName) : getFileName(renameTarget?.result.filePath) }}</div>
          <v-text-field
            v-model="newFileName"
            label="新文件名"
            hide-details
            class="mt-2"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            variant="text"
            @click="renameDialog = false"
          >
            取消
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            @click="renameFile"
            :disabled="!newFileName"
          >
            确认
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 提示消息 -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.translate-results-container {
  width: 100%;
  height: 100%;
  padding: 16px;
}

.results-card {
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.filters-container {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: nowrap;
}

.filter-item {
  flex: 1;
  min-width: 0;
}

.filter-item:last-child {
  flex: 0 0 auto;
}

.text-content {
  max-width: 300px;
  padding: 8px 12px;
  position: relative;
}

.text-preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  line-height: 1.4;
  cursor: pointer;
}

.file-actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  background: rgba(var(--v-theme-surface), 0.9);
  padding: 2px 4px;
  border-radius: 4px;
}

.action-group {
  display: flex;
  gap: 4px;
  padding: 0 2px;
}

.action-group:first-child {
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.text-content:hover .file-actions {
  opacity: 1;
}

:deep(th) {
  white-space: nowrap !important;
  font-weight: 600 !important;
}

.detail-dialog {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.content-card {
  padding: 16px;
  background: rgb(var(--v-theme-background));
  height: auto;
  max-height: 300px;
  overflow-y: auto;
}

.content-card-large {
  height: 400px;
}

.content-text {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
}

.detail-actions {
  border-top: 1px solid rgba(var(--v-border-color), 0.12);
  padding: 12px 20px;
}

:deep(.v-card-title) {
  padding: 20px;
}

:deep(.v-card-text) {
  padding-top: 20px;
}

/* 自定义滚动条样式 */
.content-card::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.content-card::-webkit-scrollbar-track {
  background: transparent;
}

.content-card::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

.content-card::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}
</style> 