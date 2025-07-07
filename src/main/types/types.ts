// 字幕项类型定义
export interface SubtitleItem {
  start: string
  end: string
  text: string
  translation?: string
  type: 'srt' | 'ass'
  style?: string
}

// 翻译日志接口
export interface TranslateLog {
  fileName: string
  sourceLanguage: string
  targetLanguage: string
  translateCount: number
  startTime: string
  endTime?: string
  duration?: number
  completed: boolean
  error?: string
}

// 翻译结果接口
export interface TranslateResult {
  type: '文本' | '文档' | '字幕'
  sourceLanguage: string
  targetLanguage: string
  sourceContent: string
  translatedContent: string
  timestamp: string
  status: '成功' | '失败'
  fileName?: string
  filePath?: string
  id?: string
} 