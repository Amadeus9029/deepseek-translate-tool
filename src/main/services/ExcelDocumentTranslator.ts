import { DocumentTranslator, DocumentParseResult, TranslationResult, DocumentRestoreResult, TranslationConfig, TranslatedSegment } from './DocumentTranslator';
import * as path from 'path';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as XLSX from 'xlsx';
import { Logger } from '../utils/logger';

/**
 * Excel文档翻译器
 * 处理Excel文件的解析、翻译和还原
 */
export class ExcelDocumentTranslator extends DocumentTranslator {
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * 解析Excel文档，提取需要翻译的文本
   * @param filePath Excel文件路径
   * @param savePath 可选的保存路径
   * @returns 解析结果
   */
  async parseDocument(filePath: string, savePath?: string): Promise<DocumentParseResult> {
    try {
      // 读取Excel文件
      const workbook = XLSX.readFile(filePath);
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // 确定输出目录
      let outputDir;
      if (savePath && fs.existsSync(savePath)) {
        outputDir = path.join(savePath, `${fileName}_preprocessed`);
      } else {
        outputDir = path.join(process.cwd(), `${fileName}_preprocessed`);
      }
      
      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 提取所有工作表的文本
      const segments: any[] = [];
      let segmentId = 1;

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

        // 处理每一行
        data.forEach((row: string[], rowIndex: number) => {
          if (!Array.isArray(row)) return;
          
          // 处理每个单元格
          row.forEach((cell: unknown, colIndex: number) => {
            if (!cell || typeof cell !== 'string') return;
            
            const text = cell.trim();
            if (text) {
              segments.push({
                id: `cell_${segmentId++}`,
                type: 'cell',
                text,
                metadata: {
                  sheetName,
                  row: rowIndex,
                  col: colIndex
                }
              });
            }
          });
        });
      }

      // 保存解析结果
      const segmentsFile = path.join(outputDir, 'segments.json');
      fs.writeFileSync(segmentsFile, JSON.stringify(segments, null, 2));

      return {
        success: true,
        segments,
        outputDir
      };
    } catch (error) {
      this.logger.error('解析Excel文档失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 批量翻译Excel文档内容
   * @param segments 要翻译的文本段落
   * @param config 翻译配置
   * @param sourceLang 源语言
   * @param targetLang 目标语言
   * @returns 翻译结果
   */
  async translateDocument(
    segments: any[],
    config: TranslationConfig,
    sourceLang: string = '英语',
    targetLang: string = '中文'
  ): Promise<TranslationResult> {
    try {
      const translatedSegments: TranslatedSegment[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        this.logger.info(`翻译单元格 ${i + 1}/${segments.length}: ${segment.id}`);

        // 跳过空单元格
        if (!segment.text || !segment.text.trim()) {
          translatedSegments.push({
            ...segment,
            translatedText: ''
          });
          continue;
        }

        try {
          const translatedText = await this.translateText(
            segment.text,
            config,
            sourceLang,
            targetLang
          );

          translatedSegments.push({
            ...segment,
            translatedText
          });
        } catch (error) {
          this.logger.error(`翻译单元格 ${segment.id} 失败:`, error);
          // 使用原文作为翻译结果
          translatedSegments.push({
            ...segment,
            translatedText: segment.text
          });
        }
      }

      return {
        success: true,
        translatedSegments
      };
    } catch (error) {
      this.logger.error('批量翻译Excel文档内容失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 还原翻译后的Excel文档
   * @param options 还原选项
   * @returns 还原结果
   */
  async restoreDocument(options: {
    originalFilePath: string;
    translatedSegments: TranslatedSegment[];
    outputFileName: string;
    savePath?: string;
  }): Promise<DocumentRestoreResult> {
    try {
      const { originalFilePath, translatedSegments, outputFileName, savePath } = options;

      // 读取原始Excel文件
      const workbook = XLSX.readFile(originalFilePath);
      const fileName = path.basename(originalFilePath, '.xlsx');

      // 确定输出目录
      let outputDir;
      if (savePath && fs.existsSync(savePath)) {
        outputDir = path.join(savePath, `${fileName}_translated`);
      } else {
        outputDir = path.join(process.cwd(), `${fileName}_translated`);
      }

      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 创建翻译结果的映射
      const translationMap = new Map<string, string>();
      translatedSegments.forEach(segment => {
        if (segment.metadata) {
          const key = `${segment.metadata.sheetName}_${segment.metadata.row}_${segment.metadata.col}`;
          translationMap.set(key, segment.translatedText || '');
        }
      });

      // 更新每个工作表
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

        // 更新翻译后的内容
        data.forEach((row: string[], rowIndex: number) => {
          if (!Array.isArray(row)) return;
          
          row.forEach((_, colIndex: number) => {
            const key = `${sheetName}_${rowIndex}_${colIndex}`;
            const translatedText = translationMap.get(key);
            
            if (translatedText !== undefined) {
              // 更新单元格内容
              const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
              worksheet[cellRef] = { t: 's', v: translatedText };
            }
          });
        });
      }

      // 保存翻译后的Excel文件
      const outputPath = path.join(outputDir, outputFileName);
      XLSX.writeFile(workbook, outputPath);

      return {
        success: true,
        outputPath
      };
    } catch (error) {
      this.logger.error('还原翻译后的Excel文档失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 