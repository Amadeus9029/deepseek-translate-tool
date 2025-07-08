<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useTranslateStore } from '../stores/translateStore'
import PageCard from '../components/ui/PageCard.vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

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

// 过滤相关
const search = ref('')
const selectedType = ref<string[]>([])
const selectedStatus = ref<string[]>([])
const dateRange = ref([null, null])
const sortBy = ref('timestamp')
const sortDesc = ref(true)

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [
  { title: t('results.perPage', { count: 10 }), value: 10 },
  { title: t('results.perPage', { count: 20 }), value: 20 },
  { title: t('results.perPage', { count: 50 }), value: 50 },
  { title: t('results.perPage', { count: 100 }), value: 100 }
]

// 其他状态
const selectedResult = ref<TranslateResult | null>(null)
const detailDialog = ref(false)
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

// 重命名对话框
const renameDialog = ref(false)
const renameTarget = ref<RenameTarget | null>(null)
const newFileName = ref('')

const types = [
  { title: t('log.text'), value: '文本' },
  { title: t('log.document'), value: '文档' },
  { title: t('log.subtitle'), value: '字幕' }
]
const statuses = [
  { title: t('results.statusSuccess'), value: '成功' },
  { title: t('results.statusFailed'), value: '失败' }
]

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

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(filteredResults.value.length / pageSize.value) || 1
})

// 获取当前页的结果
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredResults.value.slice(start, end)
})

// 计算当前页的起始和结束项
const startItem = computed(() => {
  return filteredResults.value.length > 0 ? (currentPage.value - 1) * pageSize.value + 1 : 0
})

const endItem = computed(() => {
  const end = currentPage.value * pageSize.value
  return end > filteredResults.value.length ? filteredResults.value.length : end
})

// 监听过滤器变化，重置页码
watch([search, selectedType, selectedStatus, dateRange, sortBy, sortDesc], () => {
  currentPage.value = 1
})

// 监听页面大小变化
watch(pageSize, () => {
  currentPage.value = 1
})

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
      t('results.type'),
      t('results.sourceLanguage'),
      t('results.targetLanguage'),
      t('results.sourceText'),
      t('results.translatedText'),
      t('results.date'),
      t('results.status'),
      t('results.fileName'),
      t('results.outputFile')
    ].join(',')

    const csvData = [headers, ...csvContent].join('\n')

    // 创建Blob对象
    const blob = new Blob(['\ufeff' + csvData], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    // 创建下载链接
    const link = document.createElement('a')
    link.href = url
    link.download = `${t('results.translatedResults')}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
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
    showError(t('results.emptyFilePath'))
    return
  }
  
  if (!isValidPath(filePath)) {
    showError(t('results.invalidPath', { path: filePath }))
    return
  }
  
  try {
    const result = await ipcRenderer?.invoke('open-file', filePath)
    if (!result?.success) {
      showError(t('results.openFileFailed', { error: result?.error }))
    }
  } catch (error) {
    showError(t('results.openFileFailed', { error: error }))
  }
}

// 打开文件所在文件夹
const openFileLocation = async (filePath: string | undefined) => {
  if (!filePath) {
    showError(t('results.emptyFilePath'))
    return
  }
  
  if (!isValidPath(filePath)) {
    showError(t('results.invalidPath', { path: filePath }))
    return
  }
  
  try {
    const result = await ipcRenderer?.invoke('open-file-location', filePath)
    if (!result?.success) {
      showError(t('results.openFolderFailed', { error: result?.error }))
    }
  } catch (error) {
    showError(t('results.openFolderFailed', { error: error }))
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
      snackbarText.value = t('results.fileNotFound')
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
        snackbarText.value = t('results.renameSuccess')
      } else {
        snackbarColor.value = 'warning'
        snackbarText.value = t('results.renameSuccess') + t('results.updateStoreFailed')
        // 重新加载结果以保持数据一致性
        await loadResults()
      }
    } else {
      snackbarColor.value = 'error'
      snackbarText.value = t('results.renameFailed', { error: renameResult?.error })
    }
  } catch (error) {
    snackbarColor.value = 'error'
    snackbarText.value = t('results.renameFailed', { error: error })
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
  <PageCard>
    <div class="main-container">
      <!-- 过滤器区域 -->
      <div class="filters-container">
        <v-text-field
          v-model="search"
          :label="t('results.search')"
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
          :label="t('results.type')"
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
          :label="t('results.status')"
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
          style="text-transform: capitalize;"
        >
          {{ t('results.clearFilters') }}
        </v-btn>
      </div>
      <!-- 工具栏 -->
      <v-toolbar density="comfortable" color="surface">
        <v-spacer></v-spacer>
        <v-btn
          prepend-icon="mdi-export"
          variant="tonal"
          class="mr-2"
          @click="exportResults"
          style="text-transform: capitalize;"
        >
          {{ t('results.export') }}
        </v-btn>
      </v-toolbar>
      <!-- 表格区域 -->
      <div class="table-container">
        <v-table fixed-header height="100%">
          <thead>
            <tr>
              <th class="text-left">{{ t('results.type') }}</th>
              <th class="text-left">{{ t('results.sourceLanguage') }}</th>
              <th class="text-left">{{ t('results.targetLanguage') }}</th>
              <th class="text-left" style="min-width: 200px;">{{ t('results.source') }}</th>
              <th class="text-left" style="min-width: 200px;">{{ t('results.output') }}</th>
              <th class="text-left" style="white-space: nowrap;">{{ t('results.date') }}</th>
              <th class="text-left">{{ t('results.status') }}</th>
              <th class="text-center" style="width: 68px;">{{ t('results.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in paginatedResults" :key="result.id">
              <td>
                <v-chip
                  :color="result.type === '文本' ? 'primary' : result.type === '文档' ? 'success' : 'info'"
                  size="small"
                >
                  {{ result.type === '文本' ? t('log.text') : result.type === '文档' ? t('log.document') : t('log.subtitle') }}
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
                      v-tooltip.top="t('results.openFile')"
                    ></v-btn>
                    <v-btn
                      icon="mdi-folder-open"
                      variant="text"
                      size="x-small"
                      color="primary"
                      @click.stop="openFileLocation(result.fileName)"
                      v-tooltip.top="t('results.openFolder')"
                    ></v-btn>
                  </div>
                  <div class="action-group">
                    <v-btn
                      icon="mdi-pencil"
                      variant="text"
                      size="x-small"
                      color="warning"
                      @click.stop="openRenameDialog(result, 'source')"
                      v-tooltip.top="t('results.renameSource')"
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
                      v-tooltip.top="t('results.openFile')"
                    ></v-btn>
                    <v-btn
                      icon="mdi-folder-open"
                      variant="text"
                      size="x-small"
                      color="primary"
                      @click.stop="openFileLocation(result.filePath)"
                      v-tooltip.top="t('results.openFolder')"
                    ></v-btn>
                  </div>
                  <div class="action-group">
                    <v-btn
                      icon="mdi-pencil-box"
                      variant="text"
                      size="x-small"
                      color="warning"
                      @click.stop="openRenameDialog(result, 'output')"
                      v-tooltip.top="t('results.renameOutput')"
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
                  {{ result.status === '成功' ? t('results.statusSuccess') : t('results.statusFailed') }}
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
      </div>

      <!-- 分页控件 -->
      <div class="pagination d-flex align-center justify-space-between">
        <div class="text-caption text-grey d-flex align-center">
          <span>{{ t('results.pageStats', { start: startItem, end: endItem, total: filteredResults.length }) }}</span>
        </div>
        <div class="d-flex align-center gap-4">
          <v-select
            v-model="pageSize"
            :items="pageSizeOptions"
            item-title="title"
            item-value="value"
            :label="t('results.perPage', { count: pageSize })"
            density="compact"
            variant="outlined"
            hide-details
            class="page-size-select"
          ></v-select>
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="7"
            density="compact"
            class="pagination-control"
            :prev-icon="'mdi-chevron-left'"
            :next-icon="'mdi-chevron-right'"
            :first-icon="'mdi-chevron-double-left'"
            :last-icon="'mdi-chevron-double-right'"
            show-first-last
            rounded
            active-color="primary"
          ></v-pagination>
        </div>
      </div>
    </div>

    <!-- 详情对话框 -->
    <v-dialog v-model="detailDialog" max-width="1000">
      <v-card v-if="selectedResult" class="detail-dialog">
        <v-card-title class="text-h5 d-flex align-center">
          {{ t('results.details') }}
          <v-chip :color="selectedResult.type === '文本' ? 'primary' : selectedResult.type === '文档' ? 'success' : 'info'" class="ml-2">
            {{ selectedResult.type === '文本' ? t('log.text') : selectedResult.type === '文档' ? t('log.document') : t('log.subtitle') }}
          </v-chip>
          <v-spacer></v-spacer>
          <template v-if="selectedResult.fileName">
            <v-btn variant="text" color="primary" class="mr-2" @click="openFile(selectedResult.filePath!)" prepend-icon="mdi-file" style="text-transform: capitalize;">
              {{ t('results.openFile') }}
            </v-btn>
            <v-btn variant="text" color="primary" @click="openFileLocation(selectedResult.filePath!)" prepend-icon="mdi-folder-open" style="text-transform: capitalize;">
              {{ t('results.openFolder') }}
            </v-btn>
          </template>
        </v-card-title>
        
        <v-divider></v-divider>

        <v-card-text class="detail-content">
          <div class="d-flex align-center mb-4">
            <div class="text-body-1">
              <strong>{{ t('results.date') }}：</strong>{{ formatDate(selectedResult.timestamp) }}
            </div>
            <v-spacer></v-spacer>
            <div class="text-body-1">
              <strong>{{ t('results.status') }}：</strong>
              <v-chip :color="selectedResult.status === '成功' ? 'success' : 'error'" size="small">
                {{ selectedResult.status === '成功' ? t('results.statusSuccess') : t('results.statusFailed') }}
              </v-chip>
            </div>
          </div>

          <v-row>
            <v-col cols="6">
              <div class="text-h6 mb-2">{{ t('results.source') }} ({{ selectedResult.sourceLanguage }})</div>
              <v-card
                variant="outlined"
                :class="{'content-card': true, 'content-card-large': getLineCount(selectedResult.sourceContent) > 10}"
              >
                <pre class="content-text">{{ selectedResult.sourceContent }}</pre>
              </v-card>
            </v-col>
            <v-col cols="6">
              <div class="text-h6 mb-2">{{ t('results.output') }} ({{ selectedResult.targetLanguage }})</div>
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
          <v-btn color="primary" variant="text" @click="detailDialog = false">
            {{ t('results.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 重命名对话框 -->
    <v-dialog v-model="renameDialog" max-width="500">
      <v-card>
        <v-card-title>{{ t('results.rename') }}</v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-4">{{ t('results.currentName') }}：{{ renameTarget?.type === 'source' ? getFileName(renameTarget.result.fileName) : getFileName(renameTarget?.result.filePath) }}</div>
          <v-text-field v-model="newFileName" :label="t('results.newName')" hide-details class="mt-2"></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="renameDialog = false">
            {{ t('results.cancel') }}
          </v-btn>
          <v-btn color="primary" variant="text" @click="renameFile" :disabled="!newFileName">
            {{ t('results.confirm') }}
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
  </PageCard>
</template>

<style scoped>
.filters-container {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: nowrap;
  padding: 16px;
  min-height: 72px; /* 固定搜索栏高度 */
  background: rgb(var(--v-theme-surface));
}

.filter-item {
  flex: 1;
  min-width: 0;
}

.filter-item:last-child {
  flex: 0 0 auto;
}

/* 主容器样式 */
.main-container {
  display: flex;
  flex-direction: column;
  height: 100%; /* 占满PageCard的高度 */
}

/* 表格容器样式 */
.table-container {
  flex: 1;
  min-height: 0; /* 允许flex-grow收缩 */
  overflow: hidden;
  padding: 0 16px;
}

:deep(.v-table) {
  height: 100%;
}

:deep(.v-table__wrapper) {
  height: 100%;
  overflow: auto !important;
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

/* 分页相关样式 */
.pagination {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  padding: 16px 24px;
  min-height: 84px; /* 固定分页栏高度 */
  background: rgb(var(--v-theme-surface));
  margin-top: 16px;
}

.page-size-select {
  width: 120px;
}

.pagination-control {
  margin: 0;
}

.gap-4 {
  gap: 16px;
}

/* 确保分页控件在小屏幕上也能正确显示 */
@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .pagination .d-flex {
    width: 100%;
    justify-content: space-between;
  }
  
  .page-size-select {
    width: 100px;
  }
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

.filters-container .v-btn,
.v-toolbar .v-btn {
  text-transform: capitalize !important;
}

.detail-dialog .v-btn {
  text-transform: capitalize !important;
}
</style> 