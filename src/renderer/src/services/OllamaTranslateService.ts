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
          content: "你是一个专业的翻译专家，请准确翻译用户的文本。只返回翻译结果，不要添加任何解释、思考过程或额外内容。"
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
      // 使用主进程代理发送请求
      const result = await ipcRenderer.invoke('ollama-fetch', {
        baseUrl: this.ollamaUrl,
        path: '/api/chat',
        method: 'POST',
        body: data
      })

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
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Ollama translation request failed:', error)
      throw error
    }
  }

  /**
   * 清理翻译输出，移除思考内容和其他非翻译内容
   */
  private cleanTranslationOutput(text: string): string {
    // 移除 <think> 标签及其内容
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '')
    
    // 移除其他可能的标记和前缀
    text = text.replace(/^(翻译结果[:：]|Translation[:：])/i, '')
    text = text.replace(/^(Here is the translation[:：]|以下是翻译[:：])/i, '')
    
    // 移除可能的解释性文本
    text = text.replace(/^我会将这段.*?翻译[：:]/i, '')
    text = text.replace(/^这是.*?的翻译[：:]/i, '')
    
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
    onProgress?: (current: number, total: number) => void
  ): Promise<string> {
    try {
      // 将文本分段
      const segments = this.splitText(text)
      const translatedSegments: string[] = []

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        
        // 构建简化的提示词
        let prompt = `将此${sourceLang}文本翻译成${targetLang}。只返回翻译结果，不要添加任何解释、思考过程或额外内容：\n\n${segment}`

        // 如果有术语表，添加到提示词中
        if (terms.length > 0) {
          prompt = `将此${sourceLang}文本翻译成${targetLang}，遵循以下术语表。只返回翻译结果，不要添加任何解释、思考过程或额外内容：\n\n术语表：\n${terms.map(([s, t]) => `${s} → ${t}`).join('\n')}\n\n待翻译文本：\n${segment}`
        }

        // 发送翻译请求
        const translation = await this.makeRequest(prompt)
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