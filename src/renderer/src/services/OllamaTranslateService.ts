import { settings } from './SettingsService'

declare global {
  interface Window {
    require: any;
  }
}

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

export class OllamaTranslateService {
  constructor(
    private readonly ollamaUrl: string,
    private readonly ollamaModel: string
  ) {}

  private async makeRequest(prompt: string): Promise<string> {
    const data = {
      model: this.ollamaModel,
      messages: [
        {
          role: "system",
          content: "你是一个专业翻译引擎。你必须严格遵守：1.只输出纯翻译文本；2.源文本与译文必须一一对应，不增不减；3.绝对不输出任何提示词、规则、说明、注释或标记；4.如有歧义，直接选择最合理的一种翻译；5.保持简洁精确。任何额外内容都会导致翻译结果无法使用。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      stream: false,
      think: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 2000
      }
    }

    try {
      // 添加超时处理
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('请求超时，请检查Ollama服务是否正常运行')), 30000); // 30秒超时
      });
      
      // 实际请求
      const requestPromise = ipcRenderer.invoke('ollama-fetch', {
        baseUrl: this.ollamaUrl,
        path: '/api/chat',
        method: 'POST',
        body: data
      });
      
      // 使用Promise.race来实现超时处理
      const result = await Promise.race([requestPromise, timeoutPromise]);

      if (!result.success) {
        throw new Error(`请求失败: ${result.error}`)
      }

      const responseData = result.data
      if (responseData.message && responseData.message.content) {
        let content = responseData.message.content.trim()
        
        // 移除思考内容
        content = this.cleanTranslationOutput(content)
        
        return content
      } else {
        throw new Error('无效的响应格式，请检查模型输出')
      }
    } catch (error) {
      console.error('Ollama translation request failed:', error)
      // 提供更具体的错误信息
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('请求失败')) {
          throw new Error('无法连接到Ollama服务，请确保Ollama已启动并正常运行')
        } else if (error.message.includes('timeout')) {
          throw new Error('翻译请求超时，请检查Ollama服务负载或网络连接')
        }
        throw error
      }
      throw new Error('翻译请求失败，请检查Ollama服务状态')
    }
  }

  /**
   * 清理翻译输出，移除思考内容和其他非翻译内容
   */
  private cleanTranslationOutput(text: string): string {
    // 移除提示词规则部分
    const promptRules = /【.*?要求】[\s\S]*?(?=\n\n|$)/;
    text = text.replace(promptRules, '');
    
    // 移除各种标记
    text = text.replace(/【.*?】.*?\n/g, '');
    text = text.replace(/【.*?】/g, '');
    
    // 移除术语表、原文等标记
    text = text.replace(/术语表：[\s\S]*?(?=\n\n|$)/g, '');
    text = text.replace(/原文：[\s\S]*?(?=\n\n|$)/g, '');
    text = text.replace(/译文：/g, '');
    text = text.replace(/翻译：/g, '');
    text = text.replace(/翻译结果：/g, '');
    
    // 移除数字列表（如1. 2. 3.）
    text = text.replace(/^\d+\.\s.*?(?:\n|$)/gm, '');
    
    // 移除冒号开头的行
    text = text.replace(/^[^:：]*[:：].*?(?:\n|$)/gm, '');
    
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

  /**
   * 将文本分段，每段最多1000个字符
   */
  private splitText(text: string, maxLength: number = 1000): string[] {
    const segments: string[] = []
    const lines = text.split('\n')
    let currentSegment: string[] = []
    let currentLength = 0

    for (const line of lines) {
      const lineLength = line.length
      if (currentLength + lineLength > maxLength && currentSegment.length > 0) {
        segments.push(currentSegment.join('\n'))
        currentSegment = [line]
        currentLength = lineLength
      } else {
        currentSegment.push(line)
        currentLength += lineLength
      }
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment.join('\n'))
    }

    return segments
  }

  /**
   * 翻译文本
   */
  async translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
    terms: [string, string][] = [],
    onProgress?: (current: number, total: number) => void,
    translationType: 'text' | 'document' | 'subtitle' = 'text'
  ): Promise<string> {
    try {
      // 将文本分段
      const segments = this.splitText(text)
      const translatedSegments: string[] = []

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        
        // 构建简化的提示词，不指定具体翻译类型
        let prompt = `将以下${sourceLang}文本翻译成${targetLang}，只输出纯翻译结果：\n\n${segment}`

        // 如果有术语表，添加到提示词中
        if (terms.length > 0) {
          prompt = `将以下${sourceLang}文本翻译成${targetLang}，使用指定术语表，只输出纯翻译结果：\n\n${terms.map(([s, t]) => `${s} = ${t}`).join('\n')}\n\n${segment}`
        }

        // 发送翻译请求
        let translation = await this.makeRequest(prompt)
        
        // 额外清理步骤，确保没有任何提示词或注释
        translation = this.cleanTranslationOutput(translation)
        
        translatedSegments.push(translation)

        // 报告进度
        onProgress?.(i + 1, segments.length)
      }

      // 合并所有翻译结果
      return translatedSegments.join('\n')
    } catch (error) {
      console.error('Ollama 翻译失败:', error)
      throw error
    }
  }

  /**
   * 测试 Ollama 连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await ipcRenderer.invoke('ollama-fetch', {
        baseUrl: this.ollamaUrl,
        path: '/api/tags',
        method: 'GET'
      })
      return result.success
    } catch (error) {
      console.error('Ollama 连接测试失败:', error)
      return false
    }
  }

  /**
   * 获取可用的模型列表
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const result = await ipcRenderer.invoke('ollama-fetch', {
        baseUrl: this.ollamaUrl,
        path: '/api/tags',
        method: 'GET'
      })
      
      if (!result.success) {
        throw new Error(`请求失败: ${result.error}`)
      }

      return result.data.models?.map((model: any) => model.name) || []
    } catch (error) {
      console.error('获取 Ollama 模型列表失败:', error)
      return []
    }
  }
}

// 导出单例实例
let ollamaTranslateService: OllamaTranslateService | null = null

export function initOllamaTranslateService(): void {
  const { ollamaUrl, ollamaModel } = settings.value
  ollamaTranslateService = new OllamaTranslateService(ollamaUrl, ollamaModel)
}

export function getOllamaTranslateService(): OllamaTranslateService {
  const { ollamaUrl, ollamaModel } = settings.value
  
  if (!ollamaTranslateService || 
      ollamaTranslateService['ollamaUrl'] !== ollamaUrl || 
      ollamaTranslateService['ollamaModel'] !== ollamaModel) {
    ollamaTranslateService = new OllamaTranslateService(ollamaUrl, ollamaModel)
  }
  
  return ollamaTranslateService
} 