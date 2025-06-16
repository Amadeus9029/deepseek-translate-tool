import { ref } from 'vue'

// 定义设置接口
interface Settings {
  apiKey: string;
  savePath: string;
  concurrentThreads: number;
  batchSize: number;
  maxRetries: number;
  saveInterval: number;
  progressInterval: number;
  model: string;
  subtitleBatchSize: number;
}

// 默认设置
const defaultSettings: Settings = {
  apiKey: '',
  savePath: '',
  concurrentThreads: 5,
  batchSize: 10,
  maxRetries: 3,
  saveInterval: 100,
  progressInterval: 10,
  model: 'deepseek-chat',
  subtitleBatchSize: 20
}

// 创建响应式的设置存储
const settings = ref<Settings>({ ...defaultSettings })

// 从localStorage加载设置
const loadSettings = () => {
  const savedSettings = localStorage.getItem('app-settings')
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings)
      settings.value = { ...defaultSettings, ...parsed }
    } catch (e) {
      console.error('加载设置失败:', e)
    }
  }
}

// 保存设置到localStorage
const saveSettings = (newSettings: Partial<Settings>) => {
  settings.value = { ...settings.value, ...newSettings }
  localStorage.setItem('app-settings', JSON.stringify(settings.value))
}

// 获取特定设置项
const getSetting = <K extends keyof Settings>(key: K): Settings[K] => {
  return settings.value[key]
}

// 初始化时加载设置
loadSettings()

export { settings, loadSettings, saveSettings, getSetting }
export type { Settings } 