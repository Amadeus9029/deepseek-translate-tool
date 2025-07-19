/**
 * Word文档翻译处理程序
 * 处理Word文档翻译相关的IPC请求
 */

import { ipcMain } from 'electron';
import { WordDocumentTranslator } from '../services/WordDocumentTranslator';
import { Logger } from '../utils/logger';
import { TranslationConfig } from '../services/DocumentTranslator';

/**
 * 设置文档翻译处理程序
 * @param logger 日志对象
 */
export function setupDocxTranslatorHandlers(logger: Logger): void {
  // 统一的文档翻译处理器
  ipcMain.handle('translate-document-complete', async (_, options: {
    filePath: string;
    sourceLang?: string;
    targetLang?: string;
    config: TranslationConfig;
    outputFileName?: string;
    savePath?: string;
  }) => {
    try {
      logger.info(`接收到文档翻译请求: ${options.filePath}`);
      
      const translator = new WordDocumentTranslator(logger);
      const result = await translator.translateDocumentComplete(options);
      
      if (result.success) {
        logger.info(`文档翻译成功，输出路径: ${result.outputPath}`);
      } else {
        logger.error(`文档翻译失败: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      logger.error('处理文档翻译请求失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
} 