import { settings } from './SettingsService'
import { ITranslateService, ITranslateServiceFactory } from './ITranslateService'
import { deepSeekTranslateServiceFactory } from './DeepSeekTranslateService'
import { ollamaTranslateServiceFactory } from './OllamaTranslateService'

/**
 * 翻译服务类型
 */
export type TranslateServiceType = 'deepseek' | 'ollama' | 'custom'

/**
 * 翻译服务管理器
 * 负责根据配置选择合适的翻译服务
 */
export class TranslateServiceManager {
  private static instance: TranslateServiceManager | null = null
  private currentService: ITranslateService | null = null
  private customFactories: Map<string, ITranslateServiceFactory> = new Map()
  private activeCustomService: string | null = null
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  public static getInstance(): TranslateServiceManager {
    if (!TranslateServiceManager.instance) {
      TranslateServiceManager.instance = new TranslateServiceManager()
    }
    return TranslateServiceManager.instance
  }
  
  /**
   * 注册自定义翻译服务工厂
   * @param name 服务名称
   * @param factory 服务工厂
   */
  public registerCustomService(name: string, factory: ITranslateServiceFactory): void {
    this.customFactories.set(name, factory)
    console.log(`[翻译服务管理器] 已注册自定义翻译服务: ${name}`)
  }
  
  /**
   * 设置活跃的自定义服务
   * @param name 服务名称
   * @returns 是否设置成功
   */
  public setActiveCustomService(name: string | null): boolean {
    if (name === null) {
      this.activeCustomService = null
      return true
    }
    
    if (!this.customFactories.has(name)) {
      console.error(`[翻译服务管理器] 未找到自定义翻译服务: ${name}`)
      return false
    }
    
    this.activeCustomService = name
    console.log(`[翻译服务管理器] 已设置活跃的自定义翻译服务: ${name}`)
    return true
  }
  
  /**
   * 获取当前配置下的翻译服务
   */
  public getTranslateService(): ITranslateService {
    // 如果有活跃的自定义服务，优先使用
    if (this.activeCustomService && this.customFactories.has(this.activeCustomService)) {
      const factory = this.customFactories.get(this.activeCustomService)!
      this.currentService = factory.createTranslateService()
      return this.currentService
    }
    
    // 根据配置选择合适的翻译服务
    if (settings.value.useOllama) {
      // 使用 Ollama 本地模型
      this.currentService = ollamaTranslateServiceFactory.createTranslateService()
    } else {
      // 使用 DeepSeek API
      this.currentService = deepSeekTranslateServiceFactory.createTranslateService()
    }
    
    return this.currentService
  }
  
  /**
   * 获取所有可用的自定义翻译服务名称
   */
  public getAvailableCustomServices(): string[] {
    return Array.from(this.customFactories.keys())
  }
  
  /**
   * 获取当前活跃的自定义服务名称
   */
  public getActiveCustomService(): string | null {
    return this.activeCustomService
  }
  
  /**
   * 翻译文本（统一接口）
   */
  public async translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
    terms: [string, string][] = [],
    onProgress?: (current: number, total: number) => void,
    translationType: 'text' | 'document' | 'subtitle' = 'text'
  ): Promise<string> {
    const service = this.getTranslateService()
    return await service.translateText(text, sourceLang, targetLang, terms, onProgress, translationType)
  }
  
  /**
   * 测试连接
   */
  public async testConnection(): Promise<boolean> {
    const service = this.getTranslateService()
    return await service.testConnection()
  }
}

// 导出单例获取函数
export function getTranslateServiceManager(): TranslateServiceManager {
  return TranslateServiceManager.getInstance()
} 