import { getUnifiedTranslateService } from './TranslateService'
import type { LanguageOption } from '../constants/languages'
import type { SubtitleItem } from '../stores/translateStore'

// 通用接口
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
}

export interface LogEntry {
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

export interface ExcelRow {
  [key: string]: string | number | boolean | null | undefined
}

// 获取IPC渲染器
const getIpcRenderer = () => {
  return window.require ? window.require('electron').ipcRenderer : null
}

/**
 * 文本翻译处理程序
 */
export class TextTranslateHandler {
  /**
   * 清空源文本
   * @param sourceText 源文本的引用
   * @param translatedText 翻译文本的引用
   */
  static clearSourceText(sourceText: string, translatedText: string): { sourceText: string, translatedText: string } {
    return {
      sourceText: '',
      translatedText: ''
    }
  }

  /**
   * 复制翻译结果
   * @param translatedText 翻译结果
   */
  static copyResult(translatedText: string): void {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText)
    }
  }

  /**
   * 交换语言
   * @param sourceLanguage 源语言
   * @param targetLanguage 目标语言
   * @param sourceText 源文本
   * @param translatedText 翻译文本
   */
  static swapLanguages(
    sourceLanguage: LanguageOption,
    targetLanguage: LanguageOption,
    sourceText: string,
    translatedText: string
  ): {
    sourceLanguage: LanguageOption,
    targetLanguage: LanguageOption,
    sourceText: string,
    translatedText: string
  } {
    const tempLang = sourceLanguage
    const tempText = sourceText

    return {
      sourceLanguage: targetLanguage,
      targetLanguage: tempLang,
      sourceText: translatedText || sourceText,
      translatedText: translatedText ? tempText : ''
    }
  }

  /**
   * 开始翻译
   * @param sourceText 源文本
   * @param sourceLanguage 源语言
   * @param targetLanguage 目标语言
   * @param isTranslating 是否正在翻译的标志
   */
  static async startTranslate(
    sourceText: string,
    sourceLanguage: LanguageOption | null,
    targetLanguage: LanguageOption | null,
    isTranslating: boolean
  ): Promise<{
    result: string,
    logEntry: LogEntry,
    translateResult: TranslateResult,
    error?: Error
  }> {
    if (!sourceText) {
      throw new Error('无法开始翻译：源文本为空')
    }

    // 创建日志对象
    const startTime = new Date().toISOString()
    const logEntry: LogEntry = {
      fileName: '文本翻译',
      sourceLanguage: sourceLanguage?.text || '',
      targetLanguage: targetLanguage?.text || '',
      translateCount: 1,
      startTime,
      completed: false,
      translateType: 'text'
    }

    const translateResult: TranslateResult = {
      type: '文本',
      sourceLanguage: sourceLanguage?.text || '',
      targetLanguage: targetLanguage?.text || '',
      sourceContent: sourceText,
      translatedContent: '',
      timestamp: startTime,
      status: '成功'
    }

    try {
      const translateService = getUnifiedTranslateService()

      const result = await translateService.translateText(
        sourceText,
        sourceLanguage?.value || '英语',
        targetLanguage?.value || '中文',
        [], // 这里可以添加术语表支持
        () => {} // 进度回调
      )

      translateResult.translatedContent = result

      // 更新日志对象
      const endTime = new Date().toISOString()
      const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      
      Object.assign(logEntry, {
        endTime,
        duration,
        completed: true
      })

      return {
        result,
        logEntry,
        translateResult
      }
    } catch (error) {
      console.error('翻译失败:', error)
      
      // 提取错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      
      // 更新错误日志
      Object.assign(logEntry, {
        endTime: new Date().toISOString(),
        duration: Math.round((new Date().getTime() - new Date(startTime).getTime()) / 1000),
        completed: false,
        error: errorMessage
      })

      translateResult.status = '失败'
      translateResult.translatedContent = '翻译失败: ' + errorMessage
      
      return {
        result: formatErrorMessage(errorMessage),
        logEntry,
        translateResult,
        error: error instanceof Error ? error : new Error(errorMessage)
      }
    }
  }

  /**
   * 格式化错误信息为用户友好的消息
   * @param errorMessage 原始错误信息
   */
  static formatErrorMessage(errorMessage: string): string {
    if (errorMessage.includes('API Key')) {
      return `翻译失败: ${errorMessage}\n\n请检查您的API Key是否正确设置，并确保它有足够的余额。`
    } else if (errorMessage.includes('网络') || errorMessage.includes('连接')) {
      return `翻译失败: ${errorMessage}\n\n请检查您的网络连接是否正常，以及是否可以访问DeepSeek API。`
    } else if (errorMessage.includes('配额') || errorMessage.includes('429')) {
      return `翻译失败: ${errorMessage}\n\n您的API请求次数已达到限制，请稍后再试或检查账户余额。`
    } else {
      return `翻译失败: ${errorMessage}\n\n如果问题持续存在，请尝试切换到Ollama本地模式。`
    }
  }
}

/**
 * 字幕翻译处理程序
 */
export class SubtitleTranslateHandler {
  /**
   * 创建一个带超时的Promise
   * @param promise 原始Promise
   * @param timeoutMs 超时时间（毫秒）
   */
  static withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`操作超时，超过 ${timeoutMs/1000} 秒未响应`)), timeoutMs)
      )
    ])
  }

  /**
   * 选择字幕文件
   * @param ipcRenderer IPC渲染器
   * @param clearSubtitles 清空字幕的回调
   * @param setSubtitleFile 设置字幕文件的回调
   * @param setStatus 设置状态的回调
   * @param setSubtitles 设置字幕的回调
   */
  static async selectFile(
    ipcRenderer: any,
    clearSubtitles: () => void,
    setSubtitleFile: (path: string) => void,
    setStatus: (status: string) => void,
    setSubtitles: (subtitles: SubtitleItem[]) => void,
    t: (key: string, params?: any) => string
  ): Promise<void> {
    if (!ipcRenderer) return
    
    try {
      const result = await ipcRenderer.invoke('open-file-dialog')
      
      if (result.success && result.filePath) {
        // 清空之前的翻译结果
        clearSubtitles()
        setSubtitleFile(result.filePath)
        setStatus(t('videoTranslate.loadingSubtitles'))
        
        // 读取字幕文件
        const subtitleResult = await ipcRenderer.invoke('read-subtitle-file', result.filePath)
        
        if (subtitleResult.success) {
          setSubtitles(subtitleResult.subtitles)
          setStatus(t('videoTranslate.loadedSubtitles', { count: subtitleResult.subtitles.length }))
        } else {
          throw new Error(subtitleResult.error)
        }
      }
    } catch (error: unknown) {
      console.error('选择文件失败:', error)
      setStatus(t('videoTranslate.readFailed', { error: error instanceof Error ? error.message : String(error) }))
    }
  }

  /**
   * 清理翻译结果，移除不必要的解释和原文
   * @param text 原始翻译文本
   */
  static cleanTranslation(text: string): string {
    // 检查是否包含明显的解释性内容标记
    const hasExplanation = /注[:：]|备注[:：]|思考[:：]|解释[:：]|说明[:：]|Note[:：]|原文[:：]|原句[:：]|翻译[:：]|译文[:：]|Translation[:：]/i.test(text);
    
    // 如果包含解释性内容，尝试提取实际翻译部分
    if (hasExplanation) {
      // 移除 <think> 标签及其内容
      text = text.replace(/<think>[\s\S]*?<\/think>/g, '')
      
      // 处理"原文/翻译"格式
      const originalTranslationPattern = /^.*?原文[：:](.*?)\n.*?翻译[：:](.*)/is;
      const match = text.match(originalTranslationPattern);
      if (match && match[2]) {
        return match[2].trim();
      }
      
      // 处理"Translation:"格式
      const translationPattern = /^.*?Translation[：:](.*)/is;
      const translationMatch = text.match(translationPattern);
      if (translationMatch && translationMatch[1]) {
        return translationMatch[1].trim();
      }
      
      // 处理"翻译结果:"格式
      const resultPattern = /^.*?翻译结果[：:](.*)/is;
      const resultMatch = text.match(resultPattern);
      if (resultMatch && resultMatch[1]) {
        return resultMatch[1].trim();
      }
      
      // 处理"译文:"格式
      const translatedPattern = /^.*?译文[：:](.*)/is;
      const translatedMatch = text.match(translatedPattern);
      if (translatedMatch && translatedMatch[1]) {
        return translatedMatch[1].trim();
      }
      
      // 如果有注释或说明，尝试删除它们
      text = text.replace(/^注[:：].*?\n/ig, '')
      text = text.replace(/^备注[:：].*?\n/ig, '')
      text = text.replace(/^说明[:：].*?\n/ig, '')
      text = text.replace(/\n注[:：].*?$/ig, '')
      text = text.replace(/\n备注[:：].*?$/ig, '')
      text = text.replace(/\n说明[:：].*?$/ig, '')
      
      // 移除括号内的解释内容
      text = text.replace(/\([^)]*解释[^)]*\)/g, '')
      text = text.replace(/（[^）]*解释[^）]*）/g, '')
      text = text.replace(/\([^)]*说明[^)]*\)/g, '')
      text = text.replace(/（[^）]*说明[^）]*）/g, '')
      
      // 移除其他常见的解释性前缀
      text = text.replace(/^(这句话的意思是|这段文字的意思是|这个句子翻译成|翻译如下[:：]?|以下是翻译[:：]?)/i, '')
      
      // 移除问题和疑问
      text = text.replace(/^(这里的.*是什么意思|这个.*怎么翻译|如何理解.*)[?？]/ig, '')
      text = text.replace(/\n(这里的.*是什么意思|这个.*怎么翻译|如何理解.*)[?？]/ig, '\n')
      
      // 移除"我认为"、"我的翻译"等主观表述
      text = text.replace(/^(我认为|我的翻译是|我会将|我将会|我会把)/i, '')
      text = text.replace(/\n(我认为|我的翻译是|我会将|我将会|我会把)/i, '\n')
    }
    
    // 移除多余的空行
    text = text.replace(/\n{3,}/g, '\n\n')
    
    // 移除开头和结尾的空白
    text = text.trim()
    
    return text
  }
}

/**
 * 文档翻译处理程序
 */
export class DocumentTranslateHandler {
  /**
   * 选择Excel文件
   * @param ipcRenderer IPC渲染器
   * @param addLog 添加日志的回调
   */
  static async selectFile(
    ipcRenderer: any,
    addLog: (log: string) => void,
    t: (key: string, params?: any) => string
  ): Promise<string | null> {
    if (!ipcRenderer) return null
    
    try {
      const result = await ipcRenderer.invoke('open-file-dialog', {
        filters: [
          { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
        ]
      })
      
      if (result.filePath) {
        addLog(t('documentTranslate.selectedFile', { file: result.filePath }))
        return result.filePath
      }
    } catch (error) {
      console.error('选择文件失败:', error)
    }
    
    return null
  }

  /**
   * 选择参考Excel文件
   * @param ipcRenderer IPC渲染器
   * @param addLog 添加日志的回调
   */
  static async selectRefFile(
    ipcRenderer: any,
    addLog: (log: string) => void,
    t: (key: string, params?: any) => string
  ): Promise<string | null> {
    if (!ipcRenderer) return null
    
    try {
      const result = await ipcRenderer.invoke('open-file-dialog', {
        filters: [
          { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
        ]
      })
      
      if (result.filePath) {
        addLog(t('documentTranslate.selectedRefFile', { file: result.filePath }))
        return result.filePath
      }
    } catch (error) {
      console.error('选择参考文件失败:', error)
    }
    
    return null
  }

  /**
   * 验证翻译参数
   * @param excelFile Excel文件路径
   * @param selectedLanguages 选择的目标语言列表
   * @param referenceType 参考源类型
   * @param internalRefLang 内置参考源语言
   * @param externalRefFile 外置参考源文件
   * @param externalRefLang 外置参考源语言
   * @param addLog 添加日志的回调
   */
  static validateTranslateParams(
    excelFile: string,
    selectedLanguages: string[],
    referenceType: 'none' | 'internal' | 'external',
    internalRefLang: string,
    externalRefFile: string,
    externalRefLang: string,
    addLog: (log: string) => void,
    t: (key: string, params?: any) => string
  ): boolean {
    if (!excelFile) {
      addLog(t('documentTranslate.selectFileFirst'))
      return false
    }

    if (selectedLanguages.length === 0) {
      addLog(t('documentTranslate.selectTargetLang'))
      return false
    }

    // 验证参考源设置
    if (referenceType === 'internal' && !internalRefLang) {
      addLog(t('documentTranslate.selectInternalRefLang'))
      return false
    }

    if (referenceType === 'external') {
      if (!externalRefFile) {
        addLog(t('documentTranslate.selectExternalRefFile'))
        return false
      }
      if (!externalRefLang) {
        addLog(t('documentTranslate.selectExternalRefLang'))
        return false
      }
    }

    return true
  }
}

/**
 * 格式化错误信息为用户友好的消息
 * @param errorMessage 原始错误信息
 */
export function formatErrorMessage(errorMessage: string): string {
  if (errorMessage.includes('API Key')) {
    return `翻译失败: ${errorMessage}\n\n请检查您的API Key是否正确设置，并确保它有足够的余额。`
  } else if (errorMessage.includes('网络') || errorMessage.includes('连接')) {
    return `翻译失败: ${errorMessage}\n\n请检查您的网络连接是否正常，以及是否可以访问翻译API。`
  } else if (errorMessage.includes('配额') || errorMessage.includes('429')) {
    return `翻译失败: ${errorMessage}\n\n您的API请求次数已达到限制，请稍后再试或检查账户余额。`
  } else if (errorMessage.includes('超时')) {
    return `翻译失败: ${errorMessage}\n\n请求超时，请检查网络连接或服务器状态。`
  } else {
    return `翻译失败: ${errorMessage}\n\n如果问题持续存在，请尝试切换到其他翻译模式。`
  }
}

/**
 * 保存日志和翻译结果
 * @param logEntry 日志条目
 * @param translateResult 翻译结果
 */
export async function saveLogAndResult(
  logEntry: LogEntry,
  translateResult: TranslateResult
): Promise<void> {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) return
  
  try {
    // 保存日志
    await ipcRenderer.invoke('save-log', logEntry)
    
    // 保存翻译记录
    await ipcRenderer.invoke('save-translate-result', translateResult)
  } catch (error) {
    console.error('保存日志或翻译结果失败:', error)
  }
} 