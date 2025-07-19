import { settings } from './SettingsService'
import { ITranslateService, TranslateProgressCallback } from './ITranslateService'

declare global {
  interface Window {
    api: {
      makeHttpsRequest: (options: any, data: string) => Promise<string>
    }
  }
}

/**
 * DeepSeek API翻译服务实现
 */
export class DeepSeekTranslateService implements ITranslateService {
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
      console.log('发送翻译请求到DeepSeek API:', options.hostname + options.path)
      const responseData = await window.api.makeHttpsRequest(options, data)
      
      try {
        const response = JSON.parse(responseData)
        
        // 检查是否有错误信息
        if (response.error) {
          console.error('DeepSeek API返回错误:', response.error)
          throw new Error(`API错误: ${response.error.message || JSON.stringify(response.error)}`)
        }
        
        if (response.choices && response.choices[0] && response.choices[0].message) {
          return response.choices[0].message.content.trim()
        } else {
          console.error('无效的API响应格式:', response)
          throw new Error('无效的API响应格式，请检查API Key是否正确')
        }
      } catch (parseError) {
        console.error('解析API响应失败:', parseError, '原始响应:', responseData)
        throw new Error('解析API响应失败，请检查网络连接和API Key')
      }
    } catch (error) {
      console.error('翻译请求失败:', error)
      
      // 提供更具体的错误信息
      if (error instanceof Error) {
        // 检查常见错误
        if (error.message.includes('401')) {
          throw new Error('API Key无效或已过期，请检查您的API Key设置')
        } else if (error.message.includes('403')) {
          throw new Error('API访问被拒绝，请检查API Key权限')
        } else if (error.message.includes('429')) {
          throw new Error('API请求过于频繁或已超出配额限制')
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
          throw new Error('无法连接到DeepSeek API，请检查网络连接')
        }
        throw error
      }
      throw new Error('翻译请求失败，请检查网络连接和API Key')
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
    onProgress?: TranslateProgressCallback,
    translationType: 'text' | 'document' | 'subtitle' = 'text'
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

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 对于 DeepSeek API，我们可以尝试一个简单的请求
      await this.translateText('test', '中文', '英文')
      return true
    } catch (error) {
      return false
    }
  }
}

/**
 * DeepSeek翻译服务工厂
 */
export class DeepSeekTranslateServiceFactory {
  createTranslateService(): ITranslateService {
    const apiKey = settings.value.apiKey
    if (!apiKey) {
      throw new Error('请先在设置中配置API Key')
    }
    return new DeepSeekTranslateService(apiKey)
  }
}

// 导出工厂单例
const deepSeekTranslateServiceFactory = new DeepSeekTranslateServiceFactory()
export { deepSeekTranslateServiceFactory } 