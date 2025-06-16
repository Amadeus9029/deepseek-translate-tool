<template>
  <div class="page-container">
    <div class="header">
      <div class="d-flex align-center">
        <v-icon size="24" color="primary" class="mr-2">mdi-text-box-outline</v-icon>
        <span class="text-h6">翻译日志</span>
      </div>
      <div class="d-flex align-center">
        <v-btn
          variant="tonal"
          color="primary"
          prepend-icon="mdi-refresh"
          @click="refreshLogs"
          class="mr-2"
          size="small"
        >
          刷新
        </v-btn>
        <v-btn
          variant="tonal"
          color="error"
          prepend-icon="mdi-delete"
          @click="clearLogs"
          size="small"
        >
          清空
        </v-btn>
      </div>
    </div>

    <!-- 过滤器部分 -->
    <div class="filters">
      <v-expand-transition>
        <div class="filter-container pa-4">
          <v-row dense>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="filters.fileName"
                label="按文件名搜索"
                density="compact"
                variant="outlined"
                prepend-inner-icon="mdi-magnify"
                hide-details
                class="search-field"
                clearable
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-select
                v-model="filters.status"
                :items="statusOptions"
                label="完成状态"
                density="compact"
                variant="outlined"
                hide-details
                class="status-select"
                multiple
                chips
                item-title="title"
                item-value="value"
                @update:model-value="handleStatusChange"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="4">
              <v-select
                v-model="filters.translateType"
                :items="translateTypeOptions"
                label="翻译类型"
                density="compact"
                variant="outlined"
                hide-details
                class="type-select"
                multiple
                chips
                item-title="title"
                item-value="value"
                @update:model-value="handleTypeChange"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="4">
              <div class="d-flex align-center">
                <v-menu
                  v-model="startDateMenu"
                  :close-on-content-click="false"
                  transition="scale-transition"
                >
                  <template v-slot:activator="{ props }">
                    <v-text-field
                      v-model="filters.startDate"
                      label="开始日期"
                      readonly
                      density="compact"
                      variant="outlined"
                      prepend-inner-icon="mdi-calendar"
                      hide-details
                      v-bind="props"
                      clearable
                      @click:clear="clearStartDate"
                      class="mr-2"
                    ></v-text-field>
                  </template>
                  <v-date-picker
                    v-model="dateRange.start"
                    :max="dateRange.end"
                    @update:model-value="updateDateRange"
                    class="date-picker"
                    locale="zh-cn"
                  ></v-date-picker>
                </v-menu>
              </div>
            </v-col>
            <v-col cols="12" sm="4">
              <v-menu
                v-model="endDateMenu"
                :close-on-content-click="false"
                transition="scale-transition"
              >
                <template v-slot:activator="{ props }">
                  <v-text-field
                    v-model="filters.endDate"
                    label="结束日期"
                    readonly
                    density="compact"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar"
                    hide-details
                    v-bind="props"
                    clearable
                    @click:clear="clearEndDate"
                  ></v-text-field>
                </template>
                <v-date-picker
                  v-model="dateRange.end"
                  :min="dateRange.start"
                  @update:model-value="updateDateRange"
                  class="date-picker"
                  locale="zh-cn"
                ></v-date-picker>
              </v-menu>
            </v-col>
            <v-col cols="12" sm="4">
              <v-btn
                  icon
                  variant="text"
                  size="small"
                  :color="filters.sortOrder === 'desc' ? 'primary' : ''"
                  @click="filters.sortOrder = filters.sortOrder === 'desc' ? 'asc' : 'desc'"
                >
                  <v-icon>{{ filters.sortOrder === 'desc' ? 'mdi-sort-calendar-descending' : 'mdi-sort-calendar-ascending' }}</v-icon>
                </v-btn>
            </v-col>
          </v-row>
        </div>
      </v-expand-transition>
    </div>

    <div class="content">
      <div v-if="filteredLogs.length === 0" class="empty-state">
        <v-icon size="64" color="grey" class="mb-4">mdi-text-box-outline</v-icon>
        <div class="text-h6 text-grey">暂无日志记录</div>
        <div class="text-body-2 text-grey mt-2">尝试调整过滤条件或清除筛选</div>
      </div>
      <div v-else class="log-list">
        <v-slide-y-transition group>
          <v-card 
            v-for="(log, index) in paginatedLogs" 
            :key="index" 
            class="log-item mb-4" 
            variant="outlined"
            :elevation="0"
            :class="{ 'error-card': log.error }"
          >
          <v-card-item>
            <div class="d-flex align-center justify-space-between mb-2">
              <div class="d-flex align-center">
                <v-chip
                  :color="getStatusColor(log)"
                  size="small"
                    class="mr-2"
                  label
                >
                  {{ log.completed ? '已完成' : '未完成' }}
                </v-chip>
                  <v-chip
                    color="primary"
                    size="small"
                    class="mr-3"
                    variant="outlined"
                    label
                  >
                    {{ getTranslateTypeName(log.translateType) }}
                  </v-chip>
                  <span class="text-subtitle-1 font-weight-medium text-truncate">{{ log.fileName }}</span>
              </div>
              <span class="text-caption text-grey">{{ formatDate(log.startTime) }}</span>
            </div>

            <v-divider class="mb-4"></v-divider>

            <div class="log-details">
                <div class="detail-grid">
                  <div class="detail-item">
                <v-icon size="20" color="primary" class="mr-2">mdi-file-document</v-icon>
                    <span class="text-body-2">文件：<span class="text-medium">{{ log.fileName }}</span></span>
              </div>
                  <div class="detail-item">
                <v-icon size="20" color="primary" class="mr-2">mdi-translate</v-icon>
                    <span class="text-body-2">语言：<span class="text-medium">{{ log.sourceLanguage }} → {{ log.targetLanguage }}</span></span>
              </div>
                  <div class="detail-item">
                <v-icon size="20" color="primary" class="mr-2">mdi-counter</v-icon>
                    <span class="text-body-2">翻译数量：<span class="text-medium">{{ log.translateCount }}</span></span>
              </div>
                  <div class="detail-item">
                <v-icon size="20" color="primary" class="mr-2">mdi-clock-start</v-icon>
                    <span class="text-body-2">开始时间：<span class="text-medium">{{ formatDate(log.startTime) }}</span></span>
              </div>
                  <div class="detail-item" v-if="log.endTime">
                <v-icon size="20" color="primary" class="mr-2">mdi-clock-end</v-icon>
                    <span class="text-body-2">结束时间：<span class="text-medium">{{ formatDate(log.endTime) }}</span></span>
              </div>
                  <div class="detail-item" v-if="log.duration">
                <v-icon size="20" color="primary" class="mr-2">mdi-timer</v-icon>
                    <span class="text-body-2">总用时：<span class="text-medium">{{ formatDuration(log.duration) }}</span></span>
                  </div>
              </div>
              <div v-if="log.error" class="error-message mt-3">
                  <pre class="error-text">{{ log.error }}</pre>
              </div>
            </div>
          </v-card-item>
        </v-card>
        </v-slide-y-transition>
      </div>

      <!-- 分页控件 -->
      <div class="pagination d-flex align-center justify-end">
        <div class="d-flex align-center gap-4">
          <v-select
            v-model="pageSize"
            :items="pageSizeOptions"
            label="每页显示"
            density="compact"
            variant="outlined"
            hide-details
            class="page-size-select"
          ></v-select>
          <div class="text-caption text-grey d-flex align-center">
            <span>第 {{ startItem }}-{{ endItem }} 条，共 {{ filteredLogs.length }} 条</span>
          </div>
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
          ></v-pagination>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

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

const logs = ref<LogEntry[]>([])
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 获取今天的日期字符串 YYYY-MM-DD 格式
const getTodayString = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// 日期相关
const startDateMenu = ref(false)
const endDateMenu = ref(false)
const dateRange = ref({
  start: getTodayString(),
  end: getTodayString()
})

// 过滤相关
const filters = ref({
  fileName: '',
  status: [] as string[],
  startDate: getTodayString(),
  endDate: getTodayString(),
  translateType: [] as string[],
  sortOrder: 'desc'
})

const statusOptions = [
  { title: '已完成', value: 'completed' },
  { title: '未完成', value: 'uncompleted' },
  { title: '出错', value: 'error' }
]

const translateTypeOptions = [
  { title: '文本翻译', value: 'text' },
  { title: '文档翻译', value: 'document' },
  { title: '字幕翻译', value: 'subtitle' }
]

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [
  { title: '10条/页', value: 10 },
  { title: '20条/页', value: 20 },
  { title: '50条/页', value: 50 },
  { title: '100条/页', value: 100 }
]

// 计算当前页的起始和结束项
const startItem = computed(() => {
  return (currentPage.value - 1) * pageSize.value + 1
})

const endItem = computed(() => {
  const end = currentPage.value * pageSize.value
  return end > filteredLogs.value.length ? filteredLogs.value.length : end
})

// 更新日期范围
const updateDateRange = () => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  filters.value.startDate = formatDate(dateRange.value.start)
  filters.value.endDate = formatDate(dateRange.value.end)
  
  startDateMenu.value = false
  endDateMenu.value = false
}

// 清除开始日期
const clearStartDate = () => {
  dateRange.value.start = getTodayString()
  filters.value.startDate = ''
}

// 清除结束日期
const clearEndDate = () => {
  dateRange.value.end = getTodayString()
  filters.value.endDate = ''
}

// 获取翻译类型名称
const getTranslateTypeName = (type: string) => {
  const option = translateTypeOptions.find(opt => opt.value === type)
  if (!option || type === 'unknown') {
    return '未知类型'
  }
  return option.title
}

// 添加排序功能
const sortLogs = (logs: LogEntry[]) => {
  return [...logs].sort((a, b) => {
    const dateA = new Date(a.startTime).getTime()
    const dateB = new Date(b.startTime).getTime()
    return filters.value.sortOrder === 'desc' ? dateB - dateA : dateA - dateB
  })
}

// 处理状态选择变化
const handleStatusChange = (newValue: string[]) => {
  filters.value.status = newValue
}

// 处理类型选择变化
const handleTypeChange = (newValue: string[]) => {
  filters.value.translateType = newValue
}

// 修改过滤日志的计算属性
const filteredLogs = computed(() => {
  let filtered = logs.value.filter(log => {
    // 文件名过滤
    if (filters.value.fileName && !log.fileName.toLowerCase().includes(filters.value.fileName.toLowerCase())) {
      return false
    }

    // 状态过滤
    if (filters.value.status.length > 0) {
      const matchesStatus = filters.value.status.some(status => {
        if (status === 'completed') return log.completed && !log.error
        if (status === 'uncompleted') return !log.completed && !log.error
        if (status === 'error') return !!log.error
        return false
      })
      if (!matchesStatus) return false
    }

    // 翻译类型过滤
    if (filters.value.translateType.length > 0) {
      if (!filters.value.translateType.includes(log.translateType)) return false
    }

    // 日期范围过滤
    if (filters.value.startDate && filters.value.endDate) {
      const startDate = new Date(filters.value.startDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(filters.value.endDate)
      endDate.setHours(23, 59, 59, 999)
      
      const logDate = new Date(log.startTime)
      if (logDate < startDate || logDate > endDate) return false
    }

    return true
  })

  // 应用排序
  return sortLogs(filtered)
})

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(filteredLogs.value.length / pageSize.value)
})

// 获取当前页的日志
const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredLogs.value.slice(start, end)
})

// 监听过滤器变化，重置页码
watch([filters, pageSize], () => {
  currentPage.value = 1
})

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

// 格式化持续时间
const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}秒`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return `${minutes}分${remainingSeconds}秒`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}小时${remainingMinutes}分${remainingSeconds}秒`
}

// 获取状态颜色
const getStatusColor = (log: LogEntry): string => {
  if (log.error) return 'error'
  return log.completed ? 'success' : 'warning'
}

// 刷新日志
const refreshLogs = async () => {
  if (!ipcRenderer) return
  try {
    const result = await ipcRenderer.invoke('read-logs')
    if (result.success) {
      logs.value = result.logs
    } else {
      console.error('读取日志失败:', result.error)
    }
  } catch (error) {
    console.error('刷新日志失败:', error)
  }
}

// 清空日志
const clearLogs = async () => {
  if (!ipcRenderer) return
  if (confirm('确定要清空所有日志吗？')) {
    try {
      const result = await ipcRenderer.invoke('clear-logs')
      if (result.success) {
        logs.value = []
      } else {
        console.error('清空日志失败:', result.error)
      }
    } catch (error) {
      console.error('清空日志失败:', error)
    }
  }
}

// 修改组件挂载时的初始化逻辑
onMounted(async () => {
  // 设置初始日期范围
  const today = getTodayString()
  dateRange.value.start = today
  dateRange.value.end = today
  filters.value.startDate = today
  filters.value.endDate = today
  
  // 立即加载日志
  await refreshLogs()
})
</script>

<style>
@import '../styles/common.css';
</style>

<style scoped>
.page-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  position: relative;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  position: sticky;
  top: 0;
  z-index: 2;
}

.filters {
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  position: sticky;
  top: 64px;
  z-index: 2;
}

.filter-container {
  background: rgba(var(--v-theme-surface-variant), 0.05);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  background: rgba(var(--v-theme-surface-variant), 0.02);
  padding-bottom: 80px;
  position: relative;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.log-item {
  background: rgb(var(--v-theme-surface));
  border-radius: 8px;
  transition: all 0.3s ease;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.log-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.error-card {
  border-left: 4px solid rgb(var(--v-theme-error));
}

.log-details {
  padding: 12px;
  background: rgba(var(--v-theme-surface-variant), 0.03);
  border-radius: 6px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
}

.text-medium {
  font-weight: 500;
}

.error-message {
  margin: 8px;
  padding: 12px;
  background: rgba(var(--v-theme-error), 0.05);
  border-radius: 6px;
}

.error-text {
  color: rgb(var(--v-theme-error));
  font-family: 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.pagination {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgb(var(--v-theme-surface));
  padding: 16px 24px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  z-index: 3;
  backdrop-filter: blur(10px);
  margin: 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
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

.search-field,
.status-select,
.type-select {
  transition: all 0.3s ease;
}

.search-field:hover,
.status-select:hover,
.type-select:hover {
  transform: translateY(-1px);
}

.v-menu__content {
  max-height: none !important;
}

.v-date-picker {
  width: 320px;
}

/* 自定义滚动条样式 */
.content::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}

.content::-webkit-scrollbar-track {
  background: transparent;
}

.content::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

.content::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}

/* 响应式布局调整 */
@media (max-width: 768px) {
  .pagination {
    padding: 16px;
  }

  .pagination .d-flex {
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }

  .page-size-select {
    width: 140px;
  }

  .pagination-control {
    width: 100%;
    justify-content: flex-end;
  }
}

.date-picker {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.v-date-picker {
  width: 360px;
}
</style> 