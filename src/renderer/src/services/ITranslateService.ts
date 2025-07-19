/**
 * 翻译进度回调函数类型
 */
export type TranslateProgressCallback = (current: number, total: number) => void;

/**
 * 翻译服务接口
 * 所有翻译服务实现必须遵循此接口
 */
export interface ITranslateService {
  /**
   * 翻译文本
   * @param text 要翻译的文本
   * @param sourceLang 源语言
   * @param targetLang 目标语言
   * @param terms 术语表 [源术语, 目标术语][]
   * @param onProgress 进度回调函数
   * @param translationType 翻译类型，默认为'text'
   * @returns 翻译后的文本
   */
  translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
    terms?: [string, string][],
    onProgress?: TranslateProgressCallback,
    translationType?: 'text' | 'document' | 'subtitle'
  ): Promise<string>;

  /**
   * 测试翻译服务连接
   * @returns 连接是否成功
   */
  testConnection(): Promise<boolean>;
}

/**
 * 翻译服务工厂接口
 */
export interface ITranslateServiceFactory {
  /**
   * 创建翻译服务实例
   * @returns 翻译服务实例
   */
  createTranslateService(): ITranslateService;
} 