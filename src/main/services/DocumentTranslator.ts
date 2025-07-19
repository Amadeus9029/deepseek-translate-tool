/**
 * 文档翻译器抽象类
 * 定义文档翻译的通用接口和方法
 */

import { Logger } from '../utils/logger';

// 翻译配置接口
export interface TranslationConfig {
  url?: string;
  model?: string;
  useOllama: boolean;
  apiKey?: string;
}

// 单元格元数据接口
export interface CellMetadata {
  sheetName: string;
  row: number;
  col: number;
}

// 翻译段落接口
export interface TranslatedSegment {
  id: string;
  type: string;
  text: string;
  translatedText: string;
  originalXml?: string;
  placeholders?: any[];
  metadata?: CellMetadata;
}

// 文档翻译结果接口
export interface TranslationResult {
  success: boolean;
  translatedSegments?: TranslatedSegment[];
  outputPath?: string;
  error?: string;
}

// 文档解析结果接口
export interface DocumentParseResult {
  success: boolean;
  segments?: any[];
  placeholders?: any;
  outputDir?: string;
  error?: string;
}

// 文档还原结果接口
export interface DocumentRestoreResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * 文档翻译器抽象类
 */
export abstract class DocumentTranslator {
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 翻译单个文本
   * @param text 要翻译的文本
   * @param config 翻译配置
   * @param sourceLang 源语言
   * @param targetLang 目标语言
   * @returns 翻译后的文本
   */
  protected async translateText(
    text: string,
    config: TranslationConfig,
    sourceLang: string = '英语',
    targetLang: string = '中文'
  ): Promise<string> {
    try {
      // 检查配置是否有效
      if (config.useOllama && (!config.url || !config.model)) {
        throw new Error('Ollama配置无效，请检查设置');
      }
      
      if (!config.useOllama && !config.apiKey) {
        throw new Error('Deepseek API密钥未设置，请在设置页面配置API密钥');
      }

      // TODO: 实现具体的翻译逻辑
      // 这里应该调用翻译服务
      return text;
    } catch (error) {
      this.logger.error('翻译文本失败:', error);
      throw error;
    }
  }

  /**
   * 解析文档
   * @param filePath 文档路径
   * @param savePath 可选的保存路径
   */
  abstract parseDocument(filePath: string, savePath?: string): Promise<DocumentParseResult>;

  /**
   * 翻译文档
   * @param segments 要翻译的文本段落
   * @param config 翻译配置
   * @param sourceLang 源语言
   * @param targetLang 目标语言
   */
  abstract translateDocument(
    segments: any[],
    config: TranslationConfig,
    sourceLang?: string,
    targetLang?: string
  ): Promise<TranslationResult>;

  /**
   * 还原文档
   * @param options 还原选项
   */
  abstract restoreDocument(options: {
    originalFilePath: string;
    translatedSegments: TranslatedSegment[];
    outputFileName: string;
    savePath?: string;
  }): Promise<DocumentRestoreResult>;
} 