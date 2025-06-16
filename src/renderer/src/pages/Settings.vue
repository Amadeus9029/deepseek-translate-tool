<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import { settings, saveSettings as updateSettings } from '../services/SettingsService'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

const apiKey = ref(settings.value.apiKey)
const showApiKey = ref(false)
const savePath = ref(settings.value.savePath || 'C:/Users/Amadeus/Desktop/translateSKU/TranslateApplication')
const theme = useTheme()
const themeMode = ref('light')

// 翻译参数设置
const concurrentThreads = ref(String(settings.value.concurrentThreads))
const batchSize = ref(String(settings.value.batchSize))
const maxRetries = ref(String(settings.value.maxRetries))
const saveInterval = ref(String(settings.value.saveInterval))
const progressInterval = ref(String(settings.value.progressInterval))

// 字幕翻译设置
const subtitleBatchSize = ref(String(settings.value.subtitleBatchSize || 20))

// DeepSeek模型设置
const model = ref(settings.value.model)

// 可用的模型列表
const availableModels = [
  { title: 'DeepSeek Chat', value: 'deepseek-chat' },
  { title: 'DeepSeek Reasoner', value: 'deepseek-reasoner' }
]

// 主题切换函数
const updateTheme = (mode: string) => {
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.global.name.value = prefersDark ? 'dark' : 'light'
  } else {
    theme.global.name.value = mode
  }
}

// 监听主题变化
watch(themeMode, (newMode) => {
  updateTheme(newMode)
  localStorage.setItem('theme-mode', newMode)
})

// 选择存储路径
const selectSavePath = async () => {
  try {
    const result = await ipcRenderer?.invoke('select-directory')
    if (result?.success && result.dirPath) {
      savePath.value = result.dirPath
    }
  } catch (error) {
    console.error('选择存储路径失败:', error)
  }
}

// 保存设置
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const saveSettings = async () => {
  // 保存设置到本地存储
  updateSettings({
    apiKey: apiKey.value,
    savePath: savePath.value,
    concurrentThreads: Number(concurrentThreads.value),
    batchSize: Number(batchSize.value),
    maxRetries: Number(maxRetries.value),
    saveInterval: Number(saveInterval.value),
    progressInterval: Number(progressInterval.value),
    model: model.value,
    subtitleBatchSize: Number(subtitleBatchSize.value)
  })

  // 保存设置到主进程
  try {
    const result = await ipcRenderer?.invoke('save-settings', {
      apiKey: apiKey.value,
      savePath: savePath.value,
      concurrentThreads: Number(concurrentThreads.value),
      batchSize: Number(batchSize.value),
      maxRetries: Number(maxRetries.value),
      saveInterval: Number(saveInterval.value),
      progressInterval: Number(progressInterval.value),
      model: model.value,
      subtitleBatchSize: Number(subtitleBatchSize.value)
    })
    if (!result?.success) {
      snackbarColor.value = 'error'
      snackbarText.value = '保存设置失败: ' + result?.error
    } else {
      snackbarColor.value = 'success'
      snackbarText.value = '设置保存成功'
    }
    showSnackbar.value = true
  } catch (error) {
    snackbarColor.value = 'error'
    snackbarText.value = '保存设置失败: ' + error
    showSnackbar.value = true
  }
}

// 加载设置
const loadSettings = async () => {
  try {
    const result = await ipcRenderer?.invoke('read-settings')
    if (result?.success && result.settings) {
      // 更新本地设置
      updateSettings(result.settings)
      // 更新响应式变量
      apiKey.value = result.settings.apiKey || ''
      savePath.value = result.settings.savePath || ''
      concurrentThreads.value = String(result.settings.concurrentThreads || 5)
      batchSize.value = String(result.settings.batchSize || 10)
      maxRetries.value = String(result.settings.maxRetries || 3)
      saveInterval.value = String(result.settings.saveInterval || 100)
      progressInterval.value = String(result.settings.progressInterval || 10)
      model.value = result.settings.model || 'deepseek-chat'
      subtitleBatchSize.value = String(result.settings.subtitleBatchSize || 20)
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 在组件挂载时加载设置
onMounted(() => {
  loadSettings()
  
  const savedTheme = localStorage.getItem('theme-mode')
  if (savedTheme) {
    themeMode.value = savedTheme
    updateTheme(savedTheme)
  }

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (themeMode.value === 'system') {
      theme.global.name.value = e.matches ? 'dark' : 'light'
    }
  })
})
</script>

<template>
  <div class="page-container">
    <v-card class="translate-card" flat>
      <v-card-title class="settings-title">
        <span>设置</span>
      </v-card-title>
      
      <v-card-text>
        <!-- DeepSeek API设置 -->
        <div class="section-title">DeepSeek API设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
            <v-text-field
              v-model="apiKey"
              :type="showApiKey ? 'text' : 'password'"
              label="API Key"
              :append-inner-icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showApiKey = !showApiKey"
            ></v-text-field>
            <div class="text-caption text-grey">注意：请确保API Key有足够的余额，余额不足时翻译将会失败。</div>
          </v-col>
        </v-row>

        <!-- DeepSeek模型设置 -->
        <div class="section-title">模型设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
            <v-select
              v-model="model"
              :items="availableModels"
              label="选择模型"
              item-title="title"
              item-value="value"
              persistent-hint
              hint="DeepSeek Reasoner模型效果更好但费用更高，请根据需求选择"
            ></v-select>
            <div class="text-caption text-grey mt-2">
              注意：DeepSeek Reasoner模型的翻译质量更高，但会消耗更多API额度，建议重要文档使用此模型。
            </div>
          </v-col>
        </v-row>

        <!-- 主题设置 -->
        <div class="section-title">主题设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
            <v-radio-group v-model="themeMode" inline>
              <v-radio label="跟随系统" value="system"></v-radio>
              <v-radio label="明亮模式" value="light"></v-radio>
              <v-radio label="深色模式" value="dark"></v-radio>
            </v-radio-group>
          </v-col>
        </v-row>

        <!-- 存储设置 -->
        <div class="section-title">存储设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
                          <v-text-field
              v-model="savePath"
              label="存储位置"
              append-inner-icon="mdi-folder"
              readonly
              @click:append-inner="selectSavePath"
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- 翻译参数设置 -->
        <div class="section-title">翻译参数设置</div>
        <v-row class="mb-6">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="concurrentThreads"
              label="并发线程数"
              type="number"
              hint="建议：1-10，默认：5"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="batchSize"
              label="批处理大小"
              type="number"
              hint="建议：5-20，默认：10"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="maxRetries"
              label="最大重试次数"
              type="number"
              hint="建议：1-5，默认：3"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="saveInterval"
              label="保存间隔"
              type="number"
              hint="每处理多少单元保存一次，默认：100"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="progressInterval"
              label="进度显示间隔"
              type="number"
              hint="每处理多少单元刷新一次进度，默认：10"
              persistent-hint
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- 字幕翻译设置 -->
        <div class="section-title">字幕翻译设置</div>
        <v-row>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="subtitleBatchSize"
              label="字幕批量翻译数量"
              type="number"
              hint="建议：10-20，最大值：30"
              persistent-hint
              :rules="[v => (v && Number(v) > 0 && Number(v) <= 30) || '批量翻译数量必须在1-30之间']"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row class="mt-6">
          <v-col cols="12" class="text-right">
            <v-btn color="primary" @click="saveSettings">保存设置</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

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

<style>
@import '../styles/common.css';
</style>

<style scoped>
.settings-page-wrapper {
  flex: 1 1 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  background: transparent;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

.settings-card {
  width: 100%;
  max-width: 1200px;
  max-height: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  margin: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 16px 24px;
  border: 1px solid rgb(var(--v-theme-surface-variant));
}

.settings-title {
  font-size: 24px;
  font-weight: bold;
  padding-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
  color: rgb(var(--v-theme-on-surface));
}
</style> 