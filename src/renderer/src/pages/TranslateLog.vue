<template>
  <PageCard>
    <div class="main-container">
      <!-- 过滤器区域 -->
      <div class="filters-container">
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="filters.fileName"
              :label="t('log.searchFileName')"
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
              :label="t('log.status')"
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
              :label="t('log.type')"
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
                    :label="t('log.startDate')"
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
                  :label="t('log.endDate')"
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

      <!-- 工具栏 -->
      <v-toolbar density="comfortable" color="surface">
        <v-spacer></v-spacer>
        <v-btn
          variant="tonal"
          color="primary"
          prepend-icon="mdi-refresh"
          @click="refreshLogs"
          class="mr-2"
          size="small"
          style="text-transform: capitalize;"
        >
          {{ t('log.refresh') }}
        </v-btn>
        <v-btn
          variant="tonal"
          color="error"
          prepend-icon="mdi-delete"
          @click="clearLogs"
          size="small"
          style="text-transform: capitalize;"
        >
          {{ t('log.clear') }}
        </v-btn>
      </v-toolbar>

      <!-- 日志内容区域 -->
      <div class="content-container">
        <div v-if="filteredLogs.length === 0" class="empty-state">
          <v-icon size="64" color="grey" class="mb-4">mdi-text-box-outline</v-icon>
          <div class="text-h6 text-grey">{{ t('log.empty') }}</div>
          <div class="text-body-2 text-grey mt-2">{{ t('log.emptyTip') }}</div>
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
                    {{ log.completed ? t('log.completed') : t('log.uncompleted') }}
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
                    <span class="text-body-2">{{ t('log.file') }}：<span class="text-medium">{{ log.fileName }}</span></span>
                  </div>
                  <div class="detail-item">
                    <v-icon size="20" color="primary" class="mr-2">mdi-translate</v-icon>
                    <span class="text-body-2">{{ t('log.language') }}：<span class="text-medium">{{ log.sourceLanguage }} → {{ log.targetLanguage }}</span></span>
                  </div>
                  <div class="detail-item">
                    <v-icon size="20" color="primary" class="mr-2">mdi-counter</v-icon>
                    <span class="text-body-2">{{ t('log.count') }}：<span class="text-medium">{{ log.translateCount }}</span></span>
                  </div>
                  <div class="detail-item">
                    <v-icon size="20" color="primary" class="mr-2">mdi-clock-start</v-icon>
                    <span class="text-body-2">{{ t('log.startTime') }}：<span class="text-medium">{{ formatDate(log.startTime) }}</span></span>
                  </div>
                  <div class="detail-item" v-if="log.endTime">
                    <v-icon size="20" color="primary" class="mr-2">mdi-clock-end</v-icon>
                    <span class="text-body-2">{{ t('log.endTime') }}：<span class="text-medium">{{ formatDate(log.endTime) }}</span></span>
                  </div>
                  <div class="detail-item" v-if="log.duration">
                    <v-icon size="20" color="primary" class="mr-2">mdi-timer</v-icon>
                    <span class="text-body-2">{{ t('log.duration') }}：<span class="text-medium">{{ formatDuration(log.duration) }}</span></span>
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
      </div>

      <!-- 分页控件 -->
      <div class="pagination d-flex align-center justify-space-between">
        <div class="text-caption text-grey d-flex align-center">
          <span>{{ t('log.pageStats', { start: startItem, end: endItem, total: filteredLogs.length }) }}</span>
        </div>
        <div class="d-flex align-center gap-4">
          <v-select
            v-model="pageSize"
            :items="pageSizeOptions"
            item-title="title"
            item-value="value"
            :label="t('log.perPage', { count: pageSize })"
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
  </PageCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import PageCard from '../components/ui/PageCard.vue'
import { useI18n } from 'vue-i18n'
import { useTranslateStore, type LogEntry } from '../stores/translateStore'

const { t } = useI18n()

// 使用翻译状态存储
const translateStore = useTranslateStore()

// 获取IPC渲染器
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// 获取今天的日期字符串 YYYY-MM-DD 格式
const getTodayString = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// 获取当月第一天的日期字符串 YYYY-MM-DD 格式
const getFirstDayOfMonth = () => {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().split('T')[0]
}

// 日期相关
const startDateMenu = ref(false)
const endDateMenu = ref(false)
const dateRange = ref({
  start: getFirstDayOfMonth(),
  end: getTodayString()
})

// 过滤相关
const filters = ref({
  fileName: '',
  status: [] as string[],
  startDate: getFirstDayOfMonth(),
  endDate: getTodayString(),
  translateType: [] as string[],
  sortOrder: 'desc'
})

const statusOptions = [
  { title: t('log.completed'), value: 'completed' },
  { title: t('log.uncompleted'), value: 'uncompleted' },
  { title: t('log.error'), value: 'error' }
]

const translateTypeOptions = [
  { title: t('log.text'), value: 'text' },
  { title: t('log.document'), value: 'document' },
  { title: t('log.subtitle'), value: 'subtitle' }
]

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [
  { title: t('log.perPage', { count: 10 }), value: 10 },
  { title: t('log.perPage', { count: 20 }), value: 20 },
  { title: t('log.perPage', { count: 50 }), value: 50 },
  { title: t('log.perPage', { count: 100 }), value: 100 }
]

// 从 store 获取日志
const logs = computed(() => translateStore.translateLogs)

// 计算当前页的起始和结束项
const startItem = computed(() => {
  return filteredLogs.value.length > 0 ? (currentPage.value - 1) * pageSize.value + 1 : 0
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
  dateRange.value.start = getFirstDayOfMonth()
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
    return t('log.unknownType')
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
  return Math.ceil(filteredLogs.value.length / pageSize.value) || 1
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
  await translateStore.loadTranslateLogs()
}

// 清空日志
const clearLogs = async () => {
  if (confirm(t('log.clearConfirm'))) {
    const success = await translateStore.clearTranslateLogs()
    if (!success) {
      console.error(t('log.clearFailed'))
    }
  }
}

// 处理翻译完成事件
const handleTranslationCompleted = () => {
  translateStore.loadTranslateLogs()
}

// 修改组件挂载时的初始化逻辑
onMounted(async () => {
  // 设置初始日期范围
  const today = getTodayString()
  const firstDay = getFirstDayOfMonth()
  dateRange.value.start = firstDay
  dateRange.value.end = today
  filters.value.startDate = firstDay
  filters.value.endDate = today
  
  // 立即加载日志
  await translateStore.loadTranslateLogs()
  
  // 添加IPC事件监听器，当新的翻译完成时更新日志
  if (ipcRenderer) {
    ipcRenderer.on('translation-completed', handleTranslationCompleted)
  }
})

// 在组件卸载前移除事件监听器
onBeforeUnmount(() => {
  if (ipcRenderer) {
    ipcRenderer.removeListener('translation-completed', handleTranslationCompleted)
  }
})
</script>

<style>
@import '../styles/common.css';
</style>

<style scoped>
/* 主容器样式 */
.main-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 过滤器区域样式 */
.filters-container {
  min-height: 72px;
  padding: 0px;
  background: rgb(var(--v-theme-surface));
}

/* 内容区域样式 */
.content-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 16px;
  margin: 0;
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

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

/* 分页相关样式 */
.pagination {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  padding: 0;
  min-height: 64px;
  background: rgb(var(--v-theme-surface));
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

/* 自定义滚动条样式 */
.content-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.content-container::-webkit-scrollbar-track {
  background: transparent;
}

.content-container::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

.content-container::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}

/* 响应式布局调整 */
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

.pagination .v-btn,
.v-toolbar .v-btn {
  text-transform: capitalize !important;
}
</style> 