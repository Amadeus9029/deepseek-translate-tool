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
  // Ollama 相关设置
  useOllama: boolean;
  ollamaUrl: string;
  ollamaModel: string;
}

// Ollama模型数据接口 - 简化版
interface OllamaModelData {
  availableModels: Array<{title: string, value: string, description?: string}>;
  modelParams: Record<string, string[]>;
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
  subtitleBatchSize: 20,
  // Ollama 默认设置
  useOllama: false,
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'deepseek-r1:7b'
}

// 默认Ollama模型数据 - 简化版
const defaultOllamaModelData: OllamaModelData = {
  availableModels: [],
  modelParams: {}
}

// 创建响应式的设置存储
const settings = ref<Settings>({ ...defaultSettings })

// 创建响应式的Ollama模型数据存储
const ollamaModelData = ref<OllamaModelData>({ ...defaultOllamaModelData })

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
  
  // 加载Ollama模型数据
  const savedOllamaModelData = localStorage.getItem('ollama-model-data')
  if (savedOllamaModelData) {
    try {
      const parsed = JSON.parse(savedOllamaModelData)
      ollamaModelData.value = { ...defaultOllamaModelData, ...parsed }
    } catch (e) {
      console.error('加载Ollama模型数据失败:', e)
    }
  }
}

// 保存设置到localStorage
const saveSettings = (newSettings: Partial<Settings>) => {
  settings.value = { ...settings.value, ...newSettings }
  localStorage.setItem('app-settings', JSON.stringify(settings.value))
}

// 保存Ollama模型数据到localStorage
const saveOllamaModelData = (data: Partial<OllamaModelData>) => {
  ollamaModelData.value = { ...ollamaModelData.value, ...data }
  localStorage.setItem('ollama-model-data', JSON.stringify(ollamaModelData.value))
}

// 更新特定模型的参数列表
const updateModelParams = (modelName: string, params: string[]) => {
  ollamaModelData.value.modelParams = {
    ...ollamaModelData.value.modelParams,
    [modelName]: params
  }
  localStorage.setItem('ollama-model-data', JSON.stringify(ollamaModelData.value))
}

// 获取特定设置项
const getSetting = <K extends keyof Settings>(key: K): Settings[K] => {
  return settings.value[key]
}

// 初始化时加载设置
loadSettings()

export { settings, ollamaModelData, loadSettings, saveSettings, saveOllamaModelData, updateModelParams, getSetting }
export type { Settings, OllamaModelData } 