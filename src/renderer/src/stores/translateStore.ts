import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LanguageOption } from '../constants/languages'

// 字幕项接口
export interface SubtitleItem {
  index?: string
  start: string
  end: string
  text: string
  translation?: string
  type: 'srt' | 'ass'
  style?: string
}

// 视频翻译状态
export interface VideoTranslateState {
  subtitleFile: string
  outputFormat: string
  sourceLanguage: string
  targetLanguage: string
  translatedSubtitles: Array<{
    id: number
    start: string
    end: string
    text: string
    translation: string
  }>
  translationComplete: boolean
  currentProgress: number
  totalItems: number
  isTranslating: boolean
  status: string
}

// 文本翻译状态
export interface TextTranslateState {
  sourceText: string
  translatedText: string
  sourceLanguage: LanguageOption | null
  targetLanguage: LanguageOption | null
  isTranslating: boolean
}

// 文档翻译状态
export interface DocumentTranslateState {
  excelFile: string
  referenceType: 'none' | 'internal' | 'external'
  internalRefLang: string
  externalRefFile: string
  externalRefLang: string
  sourceLanguage: LanguageOption | null
  selectedLanguages: string[]
  logs: string[]
  isTranslating: boolean
}

// 应用设置状态
export interface SettingsState {
  apiKey: string
  savePath: string
  concurrentThreads: number
  batchSize: number
  maxRetries: number
  saveInterval: number
  progressInterval: number
  model: string
  subtitleBatchSize: number
  useOllama: boolean
  ollamaUrl: string
  ollamaModel: string
  themeMode: 'system' | 'light' | 'dark'
}

// Ollama模型数据状态 - 简化版
export interface OllamaModelState {
  availableModels: Array<{title: string, value: string, description?: string}>
  modelParams: Record<string, string[]>
}

// 定义翻译状态存储
export const useTranslateStore = defineStore('translate', () => {
  // 字幕文件路径
  const subtitleFile = ref('')
  // 源字幕内容
  const sourceSubtitles = ref('')
  // 翻译后的字幕内容
  const translatedSubtitles = ref('')
  // 字幕数组
  const subtitles = ref<SubtitleItem[]>([])
  // 翻译完成的字幕项
  const translatedItems = ref<SubtitleItem[]>([])
  // 翻译是否完成
  const translationComplete = ref(false)
  // 输出路径
  const outputPath = ref('')
  // 字幕总数
  const subtitleCount = ref(0)
  // 已翻译字幕数
  const translatedCount = ref(0)
  // 翻译进度
  const translationProgress = ref({
    current: 0,
    total: 0
  })
  // 源文本
  const sourceText = ref('')
  const translatedText = ref('')
   
  // 视频翻译状态
  const videoTranslate = ref<VideoTranslateState>({
    subtitleFile: '',
    outputFormat: 'srt',
    sourceLanguage: '英语',
    targetLanguage: '中文',
    translatedSubtitles: [],
    translationComplete: false,
    currentProgress: 0,
    totalItems: 0,
    isTranslating: false,
    status: ''
  })

  // 文本翻译状态
  const textTranslate = ref<TextTranslateState>({
    sourceText: '',
    translatedText: '',
    sourceLanguage: null,
    targetLanguage: null,
    isTranslating: false
  })

  // 文档翻译状态
  const documentTranslate = ref<DocumentTranslateState>({
    excelFile: '',
    referenceType: 'none',
    internalRefLang: '',
    externalRefFile: '',
    externalRefLang: '',
    sourceLanguage: null,
    selectedLanguages: [],
    logs: [],
    isTranslating: false
  })

  // 应用设置状态
  const settings = ref<SettingsState>({
    apiKey: '',
    savePath: './',
    concurrentThreads: 5,
    batchSize: 10,
    maxRetries: 3,
    saveInterval: 100,
    progressInterval: 10,
    model: 'deepseek-chat',
    subtitleBatchSize: 20,
    useOllama: false,
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'deepseek-r1:7b',
    themeMode: 'system'
  })
  
  // Ollama模型数据
  const ollamaModelData = ref<OllamaModelState>({
    availableModels: [],
    modelParams: {}
  })
  
  // 清空字幕翻译状态
  function clearSubtitles() {
    subtitles.value = []
    translatedItems.value = []
    translationComplete.value = false
    sourceSubtitles.value = ''
    translatedSubtitles.value = ''
    outputPath.value = ''
    subtitleCount.value = 0
    translatedCount.value = 0
    translationProgress.value = {
      current: 0,
      total: 0
    }
  }

  // 设置字幕文件路径
  function setSubtitleFile(path: string) {
    subtitleFile.value = path
  }

  // 设置字幕数组
  function setSubtitles(items: SubtitleItem[]) {
    subtitles.value = items
    subtitleCount.value = items.length
    translationProgress.value.total = items.length
    sourceSubtitles.value = items.map(item => item.text).join('\n')
  }

  // 设置源字幕内容
  function setSourceSubtitles(content: string) {
    sourceSubtitles.value = content
  }

  // 设置翻译后的字幕内容
  function setTranslatedSubtitles(content: string) {
    translatedSubtitles.value = content
  }

  // 更新翻译完成的字幕项
  function updateTranslatedItems(items: SubtitleItem[]) {
    translatedItems.value = items
    translatedCount.value = items.length
    translatedSubtitles.value = items.map(item => item.translation).join('\n')
    if (items.length === subtitles.value.length) {
      translationComplete.value = true
    }
  }

  // 设置输出路径
  function setOutputPath(path: string) {
    outputPath.value = path
  }

  // 更新翻译进度
  function updateTranslationProgress(count: number, total?: number) {
    translatedCount.value = count
    translationProgress.value.current = count
    if (total !== undefined) {
      translationProgress.value.total = total
    }
  }

  // 设置源文本
  function setSourceText(text: string) {
    sourceText.value = text
  }

  // 设置翻译后的文本
  function setTranslatedText(text: string) {
    translatedText.value = text
  }
   
  // 重置视频翻译状态
  function resetVideoTranslate() {
    videoTranslate.value = {
      subtitleFile: '',
      outputFormat: 'srt',
      sourceLanguage: '英语',
      targetLanguage: '中文',
      translatedSubtitles: [],
      translationComplete: false,
      currentProgress: 0,
      totalItems: 0,
      isTranslating: false,
      status: ''
    }
  }
   
  // 重置文本翻译状态
  function resetTextTranslate() {
    textTranslate.value = {
      sourceText: '',
      translatedText: '',
      sourceLanguage: null,
      targetLanguage: null,
      isTranslating: false
    }
  }
   
  // 重置文档翻译状态
  function resetDocumentTranslate() {
    documentTranslate.value = {
      excelFile: '',
      referenceType: 'none',
      internalRefLang: '',
      externalRefFile: '',
      externalRefLang: '',
      sourceLanguage: null,
      selectedLanguages: [],
      logs: [],
      isTranslating: false
    }
  }
   
  // 更新设置
  function updateSettings(newSettings: Partial<SettingsState>) {
    settings.value = {
      ...settings.value,
      ...newSettings
    }
  }
  
  // 更新Ollama模型数据
  function updateOllamaModelData(data: Partial<OllamaModelState>) {
    ollamaModelData.value = { ...ollamaModelData.value, ...data }
  }
  
  // 更新特定模型的参数列表
  function updateModelParams(modelName: string, params: string[]) {
    ollamaModelData.value.modelParams = {
      ...ollamaModelData.value.modelParams,
      [modelName]: params
    }
  }
   
  // 添加日志
  function addDocumentLog(log: string) {
    documentTranslate.value.logs.push(log)
  }
  
  // 返回所有状态和方法
  return {
    // 字幕翻译状态
    subtitleFile,
    sourceSubtitles,
    translatedSubtitles,
    subtitles,
    translatedItems,
    translationComplete,
    outputPath,
    subtitleCount,
    translatedCount,
    translationProgress,
    
    // 文本翻译状态
    sourceText,
    translatedText,
     
    // 新的状态管理
    videoTranslate,
    textTranslate,
    documentTranslate,
    settings,
    ollamaModelData,
     
    // 字幕翻译方法
    clearSubtitles,
    setSubtitleFile,
    setSubtitles,
    setSourceSubtitles,
    setTranslatedSubtitles,
    updateTranslatedItems,
    setOutputPath,
    updateTranslationProgress,
     
    // 文本翻译方法
    setSourceText,
    setTranslatedText,
     
    // 重置方法
    resetVideoTranslate,
    resetTextTranslate,
    resetDocumentTranslate,
     
    // 设置方法
    updateSettings,
    updateOllamaModelData,
    updateModelParams,
     
    // 日志方法
    addDocumentLog
  }
}) 