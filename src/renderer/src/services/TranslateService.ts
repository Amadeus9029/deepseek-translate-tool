import { settings } from './SettingsService'
import { getOllamaTranslateService } from './OllamaTranslateService'

declare global {
  interface Window {
    api: {
      makeHttpsRequest: (options: any, data: string) => Promise<string>
    }
  }
}

export class TranslateService {
  constructor(private readonly apiKey: string) {}

  public getApiKey(): string {
    return this.apiKey
  }

  private async makeRequest(prompt: string): Promise<string> {
    const data = JSON.stringify({
      model: settings.value.model,
      messages: [
        {
          role: "system",
          content: "你是一个专业的翻译专家，请准确翻译用户的文本。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 1.3,
      max_tokens: 2000
    })

    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    }

    try {
      const responseData = await window.api.makeHttpsRequest(options, data)
      const response = JSON.parse(responseData)
      if (response.choices && response.choices[0] && response.choices[0].message) {
        return response.choices[0].message.content.trim()
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Translation request failed:', error)
      throw error
    }
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
        let prompt = `将此${sourceLang}文本翻译成${targetLang}，只返回翻译结果：\n\n${segment}`

        // 如果有术语表，添加到提示词中
        if (terms.length > 0) {
          prompt = `将此${sourceLang}文本翻译成${targetLang}，遵循以下术语表，只返回翻译结果：\n\n术语表：\n${terms.map(([s, t]) => `${s} → ${t}`).join('\n')}\n\n待翻译文本：\n${segment}`
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
      console.error('翻译失败:', error)
      throw error
    }
  }
}

// 统一的翻译服务接口
export class UnifiedTranslateService {
  /**
   * 翻译文本（统一接口）
   */
  async translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
    terms: [string, string][] = [],
    onProgress?: (current: number, total: number) => void
  ): Promise<string> {
    if (settings.value.useOllama) {
      // 使用 Ollama
      const ollamaService = getOllamaTranslateService()
      return await ollamaService.translateText(text, sourceLang, targetLang, terms, onProgress)
    } else {
      // 使用 DeepSeek API
      const deepseekService = getTranslateService()
      return await deepseekService.translateText(text, sourceLang, targetLang, terms, onProgress)
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    if (settings.value.useOllama) {
      const ollamaService = getOllamaTranslateService()
      return await ollamaService.testConnection()
    } else {
      // 对于 DeepSeek API，我们可以尝试一个简单的请求
      try {
        const deepseekService = getTranslateService()
        await deepseekService.translateText('test', '中文', '英文')
        return true
      } catch (error) {
        return false
      }
    }
  }
}

// 导出单例实例
let translateService: TranslateService | null = null
let unifiedTranslateService: UnifiedTranslateService | null = null

export function initTranslateService(apiKey: string): void {
  translateService = new TranslateService(apiKey)
}

export function getTranslateService(): TranslateService {
  const currentApiKey = settings.value.apiKey
  if (!currentApiKey) {
    throw new Error('请先在设置中配置API Key')
  }
  
  if (!translateService || translateService.getApiKey() !== currentApiKey) {
    translateService = new TranslateService(currentApiKey)
  }
  
  return translateService
}

export function getUnifiedTranslateService(): UnifiedTranslateService {
  if (!unifiedTranslateService) {
    unifiedTranslateService = new UnifiedTranslateService()
  }
  return unifiedTranslateService
} 