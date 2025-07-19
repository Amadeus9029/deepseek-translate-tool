import { getUnifiedTranslateService } from './TranslateService'
import type { LanguageOption } from '../constants/languages'
import type { SubtitleItem } from '../stores/translateStore'
import { settings } from './SettingsService'

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
   * 选择文档文件（支持Excel和Word）
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
          { name: 'Excel 文件', extensions: ['xlsx', 'xls'] },
          { name: 'Word 文档', extensions: ['docx', 'doc'] },
          { name: '所有文件', extensions: ['*'] }
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
   * 选择参考文档文件（仅支持Excel）
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
   * 获取文件类型
   * @param filePath 文件路径
   */
  static getFileType(filePath: string): 'excel' | 'word' {
    const ext = filePath.toLowerCase().split('.').pop()
    if (ext === 'docx' || ext === 'doc') {
      return 'word'
    }
    return 'excel'
  }

  /**
   * 验证翻译参数
   * @param documentFile 文档文件路径
   * @param selectedLanguages 选择的目标语言列表
   * @param referenceType 参考源类型
   * @param internalRefLang 内置参考源语言
   * @param externalRefFile 外置参考源文件
   * @param externalRefLang 外置参考源语言
   * @param addLog 添加日志的回调
   */
  static validateTranslateParams(
    documentFile: string,
    selectedLanguages: string[],
    referenceType: 'none' | 'internal' | 'external',
    internalRefLang: any,
    externalRefFile: string,
    externalRefLang: any,
    addLog: (log: string) => void,
    t: (key: string, params?: any) => string
  ): boolean {
    if (!documentFile) {
      addLog(t('documentTranslate.selectFileFirst'))
      return false
    }

    if (selectedLanguages.length === 0) {
      addLog(t('documentTranslate.selectTargetLang'))
      return false
    }

    // 对于Word文档，不支持参考源设置
    const fileType = this.getFileType(documentFile)
    if (fileType === 'word' && referenceType !== 'none') {
      addLog(t('documentTranslate.wordNoReference'))
      return false
    }

    // 验证参考源设置（仅对Excel文件）
    if (fileType === 'excel') {
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
    }

    return true
  }

  /**
   * 创建日志条目
   * @param documentFile 文档文件路径
   * @param sourceLang 源语言
   * @param selectedLanguages 目标语言列表
   */
  static createLogEntry(documentFile: string, sourceLang: string | { text: string; value: string }, selectedLanguages: string[]): LogEntry {
    const startTime = new Date().toISOString();
    return {
      fileName: documentFile.split(/[\\/]/).pop() || '',
      sourceLanguage: typeof sourceLang === 'string' ? sourceLang : (sourceLang?.text || ''),
      targetLanguage: selectedLanguages.join(', '),
      translateCount: 0,
      startTime,
      completed: false,
      translateType: 'document'
    };
  }

  /**
   * 创建翻译结果记录
   * @param params 参数
   */
  static createTranslateResultRecord(params: {
    sourceLang: string | { text: string; value: string };
    targetLang: string;
    documentFile: string;
    segmentsCount: number;
    outputPath: string;
  }): TranslateResult {
    return {
      type: '文档' as const,
      sourceLanguage: typeof params.sourceLang === 'string' ? params.sourceLang : (params.sourceLang?.text || ''),
      targetLanguage: params.targetLang,
      sourceContent: '文档内容',
      translatedContent: `已翻译 ${params.segmentsCount} 个段落`,
      timestamp: new Date().toISOString(),
      status: '成功' as const,
      fileName: params.documentFile,
      filePath: params.outputPath
    };
  }
}

/**
 * 文档翻译服务类
 */
export class DocumentTranslateService {
  /**
   * 开始翻译Word文档
   * @param params 翻译参数
   */
  static async translateDocx(params: {
    ipcRenderer: any;
    documentFile: string;
    sourceLang: string | { text: string; value: string };
    selectedLanguages: string[];
    addLog: (log: string) => void;
    t: (key: string, params?: any) => string;
    savePath: string;
    setIsTranslating: (value: boolean) => void;
    translateConfig: {
      url: string;
      model: string;
      useOllama: boolean;
      apiKey: string;
    };
  }): Promise<{
    success: boolean;
    error?: string;
    outputPaths?: string[];
  }> {
    const { ipcRenderer, documentFile, sourceLang, selectedLanguages, addLog, t, savePath, setIsTranslating, translateConfig } = params;
    const logEntry = DocumentTranslateHandler.createLogEntry(documentFile, sourceLang, selectedLanguages);
    const outputPaths: string[] = [];
    
    try {
      setIsTranslating(true);
      addLog(t('documentTranslate.logStart', { file: documentFile }));
      
      // 多语言批量翻译
      for (const targetLang of selectedLanguages) {
        addLog(`开始翻译文档到 ${targetLang}...`);
        
        // 生成输出文件名
        const fileName = documentFile.split(/[\\/]/).pop() || '';
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFileName = `${baseName}_${targetLang}_${timestamp}.docx`;
        
        // 使用统一的文档翻译接口
        const result = await ipcRenderer.invoke('translate-document-complete', {
          filePath: documentFile,
          sourceLang: typeof sourceLang === 'string' ? sourceLang : (sourceLang?.text || '英语'),
          targetLang,
          config: translateConfig,
          outputFileName,
          savePath
        });
        
        if (!result.success) {
          const errorMessage = result.error || '翻译文档失败';
          
          // 检查是否是配置相关错误
          if (errorMessage.includes('Ollama配置无效') || 
              errorMessage.includes('无法连接到Ollama服务') ||
              errorMessage.includes('Deepseek API密钥无效') ||
              errorMessage.includes('无法连接到Deepseek API')) {
            addLog(`❌ 配置错误: ${errorMessage}`);
            addLog('请检查翻译设置并重新开始翻译');
            return { success: false, error: errorMessage };
          }
          
          // 检查是否是文件相关错误
          if (errorMessage.includes('原始文件不存在') || 
              errorMessage.includes('无法读取文档内容') ||
              errorMessage.includes('生成的文件验证失败')) {
            addLog(`❌ 文件错误: ${errorMessage}`);
            addLog('请检查文档文件是否完整且可访问');
            return { success: false, error: errorMessage };
          }
          
          // 其他错误
          addLog(`❌ 翻译失败: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
        
        addLog(`✅ 翻译完成，共翻译了 ${result.translatedSegmentsCount || 0} 个段落`);
        addLog(`📁 文档已保存至: ${result.outputPath}`);
        outputPaths.push(result.outputPath!);

        // 保存翻译结果
        const translateResultRecord = DocumentTranslateHandler.createTranslateResultRecord({
          sourceLang,
          targetLang,
          documentFile,
          segmentsCount: result.translatedSegmentsCount || 0,
          outputPath: result.outputPath!
        });
        await ipcRenderer.invoke('save-translate-result', translateResultRecord);
      }

      // 更新并保存日志
      const endTime = new Date().toISOString();
      const duration = Math.round((new Date(endTime).getTime() - new Date(logEntry.startTime).getTime()) / 1000);
      
      Object.assign(logEntry, {
        translateCount: (logEntry.translateCount || 0) * selectedLanguages.length,
        endTime,
        duration,
        completed: true
      });
      
      await ipcRenderer.invoke('save-log', logEntry);
      addLog(t('documentTranslate.logAllDone'));
      
      return { success: true, outputPaths };
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      
      // 检查是否是网络或连接错误
      if (errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('网络连接')) {
        addLog(`❌ 连接错误: ${errorMessage}`);
        addLog('请检查网络连接和翻译服务设置');
      } else if (errorMessage.includes('API密钥') || errorMessage.includes('配置')) {
        addLog(`❌ 配置错误: ${errorMessage}`);
        addLog('请检查翻译设置中的API密钥或Ollama配置');
      } else {
        addLog(`❌ 未知错误: ${errorMessage}`);
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setIsTranslating(false);
    }
  }

  /**
   * 开始翻译Excel文件
   * @param params 翻译参数
   */
  static async translateExcel(params: {
    ipcRenderer: any;
    documentFile: string;
    sourceLang: string | { text: string; value: string };
    selectedLanguages: string[];
    referenceType: 'none' | 'internal' | 'external';
    internalRefLang: any;
    externalRefFile: string;
    externalRefLang: any;
    addLog: (log: string) => void;
    t: (key: string, params?: any) => string;
    setIsTranslating: (value: boolean) => void;
  }): Promise<{
    success: boolean;
    error?: string;
    outputPath?: string;
  }> {
    const { 
      ipcRenderer, documentFile, sourceLang, selectedLanguages, 
      referenceType, internalRefLang, externalRefFile, externalRefLang,
      addLog, t, setIsTranslating 
    } = params;

    // 创建日志对象
    const startTime = new Date().toISOString();
    const logEntry = {
      fileName: documentFile.split(/[\\/]/).pop() || '',
      sourceLanguage: typeof sourceLang === 'string' ? sourceLang : (sourceLang?.text || ''),
      targetLanguage: selectedLanguages.join(', '),
      translateCount: 0,
      startTime,
      completed: false,
      translateType: 'document'
    };

    try {
      setIsTranslating(true);
      addLog(t('documentTranslate.logStart', { file: documentFile }));
      addLog(t('documentTranslate.logSourceLang', { lang: typeof sourceLang === 'string' ? sourceLang : (sourceLang?.text || '') }));
      addLog(t('documentTranslate.logTargetLang', { lang: selectedLanguages.join(', ') }));

      // 获取文件类型
      const fileType = DocumentTranslateHandler.getFileType(documentFile);
      let data: ExcelRow[] = [];
      let sheetName = '';

      if (fileType === 'excel') {
        // 读取Excel文件
        const result = await ipcRenderer.invoke('read-excel-file', documentFile);
        if (!result.success) {
          throw new Error(`读取Excel文件失败: ${result.error}`);
        }
        data = result.data;
        sheetName = result.sheetName;
      } else {
        // 读取Word文档
        const result = await ipcRenderer.invoke('read-word-file', documentFile);
        if (!result.success) {
          throw new Error(`读取Word文档失败: ${result.error}`);
        }
        data = result.data;
        sheetName = result.sheetName;
      }

      // 如果使用外置参考源，读取参考文件（仅对Excel文件）
      let referenceData: ExcelRow[] = [];
      if (fileType === 'excel' && referenceType === 'external') {
        const refResult = await ipcRenderer.invoke('read-excel-file', externalRefFile);
        if (!refResult.success) {
          throw new Error(`读取参考文件失败: ${refResult.error}`);
        }
        referenceData = refResult.data;
      }

      // 获取翻译服务实例
      const translateService = getUnifiedTranslateService();

      // 创建新的数据结构，保留原始数据
      const translatedData: ExcelRow[] = [];
      let processedCount = 0;

      // 获取源文本列和参考文本列（如果使用内置参考）
      const sourceColumn = Object.keys(data[0])[0]; // 第一列作为源文本
      const refColumn = fileType === 'excel' && referenceType === 'internal' ? internalRefLang : null;

      // 遍历每一行数据
      for (const row of data as ExcelRow[]) {
        // 创建新行，首先复制原始行的所有数据
        const translatedRow: ExcelRow = { ...row };
        
        // 获取源文本
        const sourceText = row[sourceColumn];
        if (typeof sourceText === 'string' && sourceText.trim()) {
          // 为每个目标语言进行翻译
          for (const targetLang of selectedLanguages) {
            try {
              let refValue = '';

              // 获取参考文本（仅对Excel文件）
              if (fileType === 'excel') {
                if (referenceType === 'internal' && refColumn) {
                  // 从当前行获取参考文本
                  const internalRef = row[refColumn];
                  refValue = typeof internalRef === 'string' ? internalRef : '';
                } else if (referenceType === 'external') {
                  // 从参考文件中查找匹配的行
                  const matchingRow = referenceData.find(refRow => {
                    return refRow[sourceColumn] === sourceText;
                  });
                  if (matchingRow) {
                    const externalRef = matchingRow[externalRefLang];
                    refValue = typeof externalRef === 'string' ? externalRef : '';
                  }
                }
              }

              // 构建简化的提示词
              const prompt = refValue
                ? `${sourceText}\n参考翻译: ${refValue}`
                : sourceText;

              const translatedText = await translateService.translateText(
                prompt,
                typeof sourceLang === 'string' ? sourceLang : (sourceLang?.text || '英语'),
                targetLang,
                [], // 这里可以添加术语表支持
                (current, total) => {
                  addLog(t('documentTranslate.logTranslating', { row: processedCount + 1, lang: targetLang, current, total }));
                }
              );

              // 添加翻译结果列
              translatedRow[targetLang] = translatedText;
            } catch (err) {
              console.error('翻译失败:', err);
              translatedRow[targetLang] = `[翻译失败] ${sourceText}`;
            }
          }
        }

        translatedData.push(translatedRow);
        processedCount++;
        addLog(t('documentTranslate.logRowDone', { row: processedCount, total: data.length }));
      }

      // 生成输出文件夹路径
      const outputDir = documentFile.replace(/\.[^.]+$/, '_translations');
      // 生成输出文件名（使用相对路径）
      const fileName = `translated_${new Date().getTime()}.${fileType === 'excel' ? 'xlsx' : 'docx'}`;
      const outputPath = `${outputDir}/${fileName}`;

      // 通过IPC保存翻译后的文件，让主进程处理目录创建
      let saveResult;
      if (fileType === 'excel') {
        saveResult = await ipcRenderer.invoke('save-excel-file', {
          data: translatedData,
          filePath: outputPath,
          sheetName,
          createDir: true // 添加标志告诉主进程需要创建目录
        });
      } else {
        saveResult = await ipcRenderer.invoke('save-word-file', {
          data: translatedData,
          filePath: outputPath,
          createDir: true // 添加标志告诉主进程需要创建目录
        });
      }

      if (!saveResult.success) {
        throw new Error(`保存翻译结果失败: ${saveResult.error}`);
      }

      // 更新日志对象
      const endTime = new Date().toISOString();
      const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
      
      Object.assign(logEntry, {
        translateCount: processedCount * selectedLanguages.length,
        endTime,
        duration,
        completed: true
      });

      // 保存日志
      await ipcRenderer.invoke('save-log', logEntry);

      // 保存翻译结果
      const translateResult = {
        type: '文档' as const,
        sourceLanguage: typeof sourceLang === 'string' ? sourceLang : (sourceLang?.text || ''),
        targetLanguage: selectedLanguages.join(', '),
        sourceContent: '文档内容',
        translatedContent: `已翻译 ${processedCount} 行，共 ${selectedLanguages.length} 种语言`,
        timestamp: startTime,
        status: '成功' as const,
        fileName: documentFile, // 存储完整的源文件路径
        filePath: saveResult.outputPath // 使用主进程返回的实际输出路径
      };
      await ipcRenderer.invoke('save-translate-result', translateResult);

      addLog(t('documentTranslate.logSaved', { path: saveResult.outputPath }));
      addLog(t('documentTranslate.logAllDone'));
      
      return { success: true, outputPath: saveResult.outputPath };
    } catch (err: unknown) {
      console.error('翻译过程出错:', err);
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      
      // 更新错误日志
      Object.assign(logEntry, {
        endTime: new Date().toISOString(),
        duration: Math.round((new Date().getTime() - new Date(startTime).getTime()) / 1000),
        completed: false,
        error: errorMessage
      });
      
      // 保存错误日志
      await ipcRenderer.invoke('save-log', logEntry);

      // 保存失败的翻译结果
      const translateResult = {
        type: '文档' as const,
        sourceLanguage: typeof sourceLang === 'string' ? sourceLang : (sourceLang?.text || ''),
        targetLanguage: selectedLanguages.join(', '),
        sourceContent: '文档内容',
        translatedContent: `翻译失败: ${errorMessage}`,
        timestamp: startTime,
        status: '失败' as const,
        fileName: documentFile, // 存储完整的源文件路径
        filePath: documentFile
      };
      await ipcRenderer.invoke('save-translate-result', translateResult);
      
      addLog(t('documentTranslate.logError', { error: errorMessage }));
      return { success: false, error: errorMessage };
    } finally {
      setIsTranslating(false);
    }
  }
}

/**
 * 视频字幕翻译服务类
 */
export class VideoTranslateService {
  /**
   * 开始翻译字幕
   * @param params 翻译参数
   */
  static async translateSubtitles(params: {
    ipcRenderer: any;
    subtitleFile: string;
    sourceLanguage: string;
    targetLanguage: string;
    subtitles: SubtitleItem[];
    t: (key: string, params?: any) => string;
    setStatus: (status: string) => void;
    setIsTranslating: (value: boolean) => void;
    updateTranslationProgress: (current: number, total?: number) => void;
    updateTranslatedItems: (items: SubtitleItem[]) => void;
    setOutputPath: (path: string) => void;
    batchSize?: number;
  }): Promise<{
    success: boolean;
    error?: string;
    outputPath?: string;
  }> {
    const { 
      ipcRenderer, subtitleFile, sourceLanguage, targetLanguage, subtitles,
      t, setStatus, setIsTranslating, updateTranslationProgress,
      updateTranslatedItems, setOutputPath, batchSize = 20
    } = params;

    // 创建日志对象
    const startTime = new Date().toISOString();
    const logEntry = {
      fileName: subtitleFile.split(/[\\/]/).pop() || '',
      sourceLanguage,
      targetLanguage,
      translateCount: 0,
      startTime,
      completed: false,
      translateType: 'subtitle'
    };

    try {
      // 直接修改状态
      setIsTranslating(true);
      setStatus(t('videoTranslate.prepareToTranslate'));
      updateTranslationProgress(0);

      const translateService = getUnifiedTranslateService();
      const batch = batchSize;
      const total = subtitles.length;
      const translatedItems: SubtitleItem[] = [];
      let remainingItems = [...subtitles]; // 待翻译的条目
      let failedAttempts = 0;
      const maxFailedAttempts = 3; // 最大连续失败次数
      const timeout = 30000; // 30秒超时

      // 批量翻译
      while (remainingItems.length > 0) {
        // 动态调整批次大小，如果之前失败过，减小批次大小
        const dynamicBatchSize = failedAttempts > 0 ? Math.max(5, Math.floor(batch / (failedAttempts + 1))) : batch;
        const currentBatch = remainingItems.slice(0, dynamicBatchSize);
        const texts = currentBatch.map(item => item.text);

        try {
          // 显示当前进度
          setStatus(t('videoTranslate.translatingBatch', { current: translatedItems.length + 1, total: total }));
          
          // 对于本地模型，每行单独翻译可能更稳定
          if (currentBatch.length > 1) {
            // 逐行翻译
            const batchTranslations: string[] = [];
            for (let i = 0; i < currentBatch.length; i++) {
              const singleText = currentBatch[i].text;
              setStatus(t('videoTranslate.translatingSingle', { current: translatedItems.length + i + 1, total: total }));
              
              const singleTranslation = await SubtitleTranslateHandler.withTimeout(
                translateService.translateText(
                  singleText,
                  sourceLanguage,
                  targetLanguage,
                  [],
                  () => {} // 空进度回调
                ),
                timeout
              );
              
              // 清理翻译结果
              batchTranslations.push(SubtitleTranslateHandler.cleanTranslation(singleTranslation));
            }
            
            // 保存所有翻译结果
            currentBatch.forEach((item, index) => {
              const translated = { ...item, type: item.type || 'srt' };
              translated.translation = batchTranslations[index].trim();
              translatedItems.push(translated);
            });
          } else {
            // 批量翻译
            const translations = await SubtitleTranslateHandler.withTimeout(
              translateService.translateText(
                texts.join('\n'),
                sourceLanguage,
                targetLanguage,
                [],
                (current, total) => {
                  setStatus(t('videoTranslate.translatingBatchProgress', { current: current, total: total }));
                }
              ),
              timeout
            );

            // 处理翻译结果
            const translationArray = translations.split('\n').filter(t => t.trim());
            
            if (translationArray.length === currentBatch.length) {
              // 如果数量匹配，保存所有翻译结果
              currentBatch.forEach((item, index) => {
                const translated = { ...item, type: item.type || 'srt' };
                translated.translation = SubtitleTranslateHandler.cleanTranslation(translationArray[index].trim());
                translatedItems.push(translated);
              });
            } else {
              // 如果数量不匹配，切换到逐行翻译
              failedAttempts++;
              setStatus(t('videoTranslate.batchTranslationMismatch', { translated: translationArray.length, total: currentBatch.length }));
              
              // 逐行翻译
              const batchTranslations: string[] = [];
              for (let i = 0; i < currentBatch.length; i++) {
                const singleText = currentBatch[i].text;
                setStatus(t('videoTranslate.translatingSingle', { current: translatedItems.length + i + 1, total: total }));
                
                const singleTranslation = await SubtitleTranslateHandler.withTimeout(
                  translateService.translateText(
                    singleText,
                    sourceLanguage,
                    targetLanguage,
                    [],
                    () => {} // 空进度回调
                  ),
                  timeout
                );
                
                // 清理翻译结果
                batchTranslations.push(SubtitleTranslateHandler.cleanTranslation(singleTranslation));
              }
              
              // 保存所有翻译结果
              currentBatch.forEach((item, index) => {
                const translated = { ...item, type: item.type || 'srt' };
                translated.translation = batchTranslations[index].trim();
                translatedItems.push(translated);
              });
            }
          }
          
          // 从待翻译列表中移除已翻译的条目
          remainingItems = remainingItems.slice(currentBatch.length);
          updateTranslationProgress(translatedItems.length, total);
          updateTranslatedItems(translatedItems);
          
          // 重置失败计数
          failedAttempts = 0;
          
        } catch (error: unknown) {
          console.error('翻译失败:', error);
          failedAttempts++;
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          setStatus(t('videoTranslate.translationFailed', { error: errorMessage }));
          
          // 如果失败次数过多，减小批次大小或抛出错误
          if (failedAttempts >= maxFailedAttempts) {
            if (currentBatch.length > 1) {
              // 将当前批次拆分为更小的批次重试
              setStatus(t('videoTranslate.continuousFailures', { failures: failedAttempts }));
              // 不移除条目，下一轮循环会使用更小的批次大小
            } else {
              // 如果已经是单条翻译还失败，则跳过这条
              setStatus(t('videoTranslate.singleTranslationFailed', { failures: failedAttempts }));
              remainingItems = remainingItems.slice(1); // 跳过当前条目
              failedAttempts = 0; // 重置失败计数
            }
          }
          
          // 如果所有条目都无法翻译，抛出错误
          if (remainingItems.length === total && translatedItems.length === 0 && failedAttempts >= maxFailedAttempts) {
            throw new Error(t('videoTranslate.tooManyTranslationFailures'));
          }
        }

        // 添加短暂延迟，避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 保存翻译结果
      if (translatedItems.length > 0) {
        const saveResult = await ipcRenderer.invoke('save-subtitles', {
          subtitles: translatedItems,
          sourceFile: subtitleFile,
          targetLanguage
        });

        if (!saveResult.success) {
          throw new Error(saveResult.error);
        }

        // 保存输出路径
        setOutputPath(saveResult.outputPath);

        // 更新日志对象
        const endTime = new Date().toISOString();
        const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
        
        Object.assign(logEntry, {
          translateCount: translatedItems.length,
          endTime,
          duration,
          completed: true
        });

        // 保存日志
        await ipcRenderer?.invoke('save-log', logEntry);

        // 保存翻译结果
        const translateResult = {
          type: '字幕' as const,
          sourceLanguage,
          targetLanguage,
          sourceContent: subtitles.map(s => s.text).join('\n'),
          translatedContent: translatedItems.map(s => s.translation).join('\n'),
          timestamp: startTime,
          status: '成功' as const,
          fileName: subtitleFile,
          filePath: saveResult.outputPath
        };
        await ipcRenderer?.invoke('save-translate-result', translateResult);

        setStatus(t('videoTranslate.translationComplete', { filePath: saveResult.outputPath }));
        return { success: true, outputPath: saveResult.outputPath };
      } else {
        throw new Error(t('videoTranslate.noContentTranslated'));
      }
    } catch (error: unknown) {
      console.error('翻译失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 更新错误日志
      Object.assign(logEntry, {
        endTime: new Date().toISOString(),
        duration: Math.round((new Date().getTime() - new Date(startTime).getTime()) / 1000),
        completed: false,
        error: errorMessage
      });
      
      // 保存错误日志
      await ipcRenderer?.invoke('save-log', logEntry);

      // 保存失败的翻译结果
      const translateResult = {
        type: '字幕' as const,
        sourceLanguage,
        targetLanguage,
        sourceContent: subtitles.map(s => s.text).join('\n'),
        translatedContent: `翻译失败: ${errorMessage}`,
        timestamp: startTime,
        status: '失败' as const,
        fileName: subtitleFile,
        filePath: subtitleFile
      };
      await ipcRenderer?.invoke('save-translate-result', translateResult);
      
      setStatus(t('videoTranslate.translationFailed', { error: errorMessage }));
      return { success: false, error: errorMessage };
    } finally {
      // 确保在finally块中设置isTranslating为false
      setIsTranslating(false);
    }
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

/**
 * 获取文件类型
 * @param filePath 文件路径
 * @returns 文件类型
 */
export function getFileType(filePath: string): 'excel' | 'word' | 'unknown' {
  if (!filePath) return 'unknown'
  const ext = filePath.toLowerCase().split('.').pop()
  if (ext === 'xlsx' || ext === 'xls') return 'excel'
  if (ext === 'docx' || ext === 'doc') return 'word'
  return 'unknown'
} 