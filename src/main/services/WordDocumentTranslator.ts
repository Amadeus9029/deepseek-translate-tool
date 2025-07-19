import { DocumentTranslator, DocumentParseResult, TranslationResult, DocumentRestoreResult, TranslationConfig, TranslatedSegment } from './DocumentTranslator';
import * as path from 'path';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import JSZip from 'jszip';
import { Logger } from '../utils/logger';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export class WordDocumentTranslator extends DocumentTranslator {
  constructor(logger: Logger) {
    super(logger);
  }

  // 完整的文档翻译流程
  async translateDocumentComplete(options: {
    filePath: string;
    sourceLang?: string;
    targetLang?: string;
    config: TranslationConfig;
    outputFileName?: string;
    savePath?: string;
  }): Promise<{
    success: boolean;
    outputPath?: string;
    error?: string;
    segmentsCount?: number;
    translatedSegmentsCount?: number;
  }> {
    try {
      const {
        filePath,
        sourceLang = '英语',
        targetLang = '中文',
        config,
        outputFileName,
        savePath
      } = options;

      this.logger.info(`开始完整文档翻译流程: ${filePath}`);
      this.logger.info(`源语言: ${sourceLang}, 目标语言: ${targetLang}`);

      // 验证翻译配置
      const configValidation = this.validateTranslationConfig(config);
      if (!configValidation.valid) {
        return { success: false, error: configValidation.error };
      }

      // 1. 预处理文档 - 只在内存中处理，不保存中间文件
      this.logger.info('步骤1: 预处理文档...');
      const parseResult = await this.parseDocument(filePath);
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const segmentsCount = parseResult.segments?.length || 0;
      this.logger.info(`预处理完成，提取了 ${segmentsCount} 个文本段落`);

      // 2. 翻译内容
      this.logger.info('步骤2: 翻译文档内容...');
      const translateResult = await this.translateDocument(
        parseResult.segments || [],
        config,
        sourceLang,
        targetLang
      );
      if (!translateResult.success) {
        return { success: false, error: translateResult.error };
      }

      const translatedSegmentsCount = translateResult.translatedSegments?.length || 0;
      this.logger.info(`翻译完成，共翻译了 ${translatedSegmentsCount} 个段落`);

      // 3. 还原文档
      this.logger.info('步骤3: 还原翻译后的文档...');
      const finalOutputFileName = outputFileName || 
        `${path.basename(filePath, '.docx')}_${targetLang}_${new Date().toISOString().replace(/[:.]/g, '-')}.docx`;

      const restoreResult = await this.restoreDocument({
        originalFilePath: filePath,
        translatedSegments: translateResult.translatedSegments || [],
        outputFileName: finalOutputFileName,
        savePath
      });

      if (!restoreResult.success) {
        return { success: false, error: restoreResult.error };
      }

      this.logger.info(`文档翻译完成，输出路径: ${restoreResult.outputPath}`);
      return {
        success: true,
        outputPath: restoreResult.outputPath,
        segmentsCount,
        translatedSegmentsCount
      };
    } catch (error) {
      this.logger.error('完整文档翻译流程失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // 实现抽象方法：翻译文档内容
  async translateDocument(
    segments: any[],
    config: TranslationConfig,
    sourceLang?: string,
    targetLang?: string
  ): Promise<TranslationResult> {
    try {
      this.logger.info(`开始翻译文档内容，共${segments.length}个段落`);
      
      const translatedSegments: TranslatedSegment[] = [];
      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        if (!segment.text || !segment.text.trim()) {
          translatedSegments.push({ ...segment, translatedText: '' });
          skipCount++;
          this.logger.info(`跳过空段落 ${i + 1}/${segments.length}: ${segment.id}`);
          continue;
        }

        this.logger.info(`翻译段落 ${i + 1}/${segments.length}: "${segment.text.substring(0, 50)}${segment.text.length > 50 ? '...' : ''}"`);
        
        let translatedText = '';
        let success = false;
        
        // 尝试最多3次翻译
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) {
              this.logger.info(`第 ${attempt} 次尝试翻译段落 ${segment.id}...`);
            }
            
            // 添加详细日志记录API调用前
            this.logger.info(`调用翻译API，段落 ${i + 1}，原文: "${segment.text.substring(0, 100)}${segment.text.length > 100 ? '...' : ''}"`);
            
            const rawTranslatedText = await this.translateText(segment.text, config, sourceLang, targetLang);
            
            // 添加详细日志记录API调用后
            this.logger.info(`翻译API返回原始结果，段落 ${i + 1}，长度: ${rawTranslatedText.length}，内容: "${rawTranslatedText.substring(0, 100)}${rawTranslatedText.length > 100 ? '...' : ''}"`);
            
            // 检查API是否返回空结果
            if (!rawTranslatedText || rawTranslatedText.trim() === '') {
              this.logger.warn(`翻译API返回空结果，段落 ${i + 1}，将重试`);
              throw new Error('翻译API返回空结果');
            }
            
            translatedText = rawTranslatedText;
            success = true;
            successCount++;
            this.logger.info(`翻译成功: "${translatedText.substring(0, 50)}${translatedText.length > 50 ? '...' : ''}"`);
            break;
          } catch (error) {
            this.logger.error(`翻译段落 ${segment.id} 失败 (尝试 ${attempt}/3):`, error);
            if (attempt < 3) {
              await new Promise(res => setTimeout(res, 1000));
            }
          }
        }

        if (!success) {
          failCount++;
          this.logger.warn(`段落 ${segment.id} 翻译失败，使用原文`);
        }

        translatedSegments.push({
          ...segment,
          translatedText: success ? translatedText : segment.text
        });
      }
      
      this.logger.info(`翻译完成: 成功${successCount}个，失败${failCount}个，跳过${skipCount}个`);
      
      return { success: true, translatedSegments };
    } catch (error) {
      this.logger.error('文档翻译失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // 统一的段落提取方法
  private extractParagraphsFromXml(documentXml: string): Array<{
    fullXml: string;
    textContent: string;
    index: number;
  }> {
    const paragraphRegex = /<w:p\b[^>]*>.*?<\/w:p>/gs;
    const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
    const paragraphs: Array<{
      fullXml: string;
      textContent: string;
      index: number;
    }> = [];
    
    let paragraphMatch;
    let index = 0;
    
    while ((paragraphMatch = paragraphRegex.exec(documentXml)) !== null) {
      index++;
      const paragraphXml = paragraphMatch[0];
      let textContent = '';
      let textMatch;
      
      // 重置正则表达式的lastIndex，确保正确匹配
      textRegex.lastIndex = 0;
      
      while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
        textContent += textMatch[1];
      }
      
      const trimmedText = textContent.trim();
      
      paragraphs.push({
        fullXml: paragraphXml,
        textContent: trimmedText,
        index
      });
    }
    
    return paragraphs;
  }

  // 解析Word文档，输出分段json
  async parseDocument(filePath: string, savePath?: string): Promise<DocumentParseResult> {
    try {
      this.logger.info(`开始解析Word文档: ${filePath}`);
      
      const data = fs.readFileSync(filePath);
      const zip = new JSZip();
      const contents = await zip.loadAsync(data);
      const fileName = path.basename(filePath, '.docx');
      // 不再创建中间目录，只在内存中处理
      // let outputDir = savePath && fs.existsSync(savePath)
      //   ? path.join(savePath, `${fileName}_preprocessed`)
      //   : path.join(process.cwd(), `${fileName}_preprocessed`);
      // if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      
      const documentXml = await contents.file('word/document.xml')?.async('string') || '';
      if (!documentXml) return { success: false, error: '无法读取文档内容' };
      
      // 使用统一的段落提取方法
      const allParagraphs = this.extractParagraphsFromXml(documentXml);
      let segments: any[] = [];
      let totalParagraphs = allParagraphs.length;
      let emptyParagraphs = 0;
      
      this.logger.info('开始提取段落...');
      
      for (const paragraph of allParagraphs) {
        if (paragraph.textContent) {
          segments.push({
            id: `p_${paragraph.index}`,
            type: 'paragraph',
            text: paragraph.textContent,
            originalXml: paragraph.fullXml
          });
          
          this.logger.info(`段落${segments.length}: "${paragraph.textContent.substring(0, 50)}${paragraph.textContent.length > 50 ? '...' : ''}"`);
        } else {
          emptyParagraphs++;
          this.logger.info(`跳过空段落${paragraph.index}`);
        }
      }
      
      this.logger.info(`解析完成: 总共${totalParagraphs}个段落，有效段落${segments.length}个，空段落${emptyParagraphs}个`);
      
      // 不再保存中间文件
      // const segmentsPath = path.join(outputDir, 'processed_segments.json');
      // fs.writeFileSync(segmentsPath, JSON.stringify(segments, null, 2));
      // this.logger.info(`段落数据已保存至: ${segmentsPath}`);
      
      // 不再保存调试信息文件
      // const debugInfo = {
      //   totalParagraphs,
      //   validParagraphs: segments.length,
      //   emptyParagraphs,
      //   segments: segments.map(s => ({
      //     id: s.id,
      //     text: s.text,
      //     length: s.text.length
      //   }))
      // };
      // fs.writeFileSync(path.join(outputDir, 'debug_info.json'), JSON.stringify(debugInfo, null, 2));
      // this.logger.info(`调试信息已保存至: ${path.join(outputDir, 'debug_info.json')}`);
      
      return { success: true, segments };
    } catch (error) {
      this.logger.error('Word解析失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // 批量翻译Word文档内容
  async translateContent(options: { segmentsFilePath: string; sourceLang?: string; targetLang?: string; config: TranslationConfig; }): Promise<TranslationResult> {
    try {
      const { segmentsFilePath, sourceLang = '英语', targetLang = '中文', config } = options;
      this.logger.info(`开始批量翻译Word文档内容: ${segmentsFilePath}`);
      this.logger.info(`源语言: ${sourceLang}, 目标语言: ${targetLang}`);
      
      if (!fs.existsSync(segmentsFilePath)) return { success: false, error: '段落文件不存在' };
      const segmentsData = fs.readFileSync(segmentsFilePath, 'utf-8');
      let segments = JSON.parse(segmentsData);
      
      this.logger.info(`成功解析段落数据，共 ${segments.length} 个段落`);
      
      const translatedSegments: TranslatedSegment[] = [];
      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment.text || !segment.text.trim()) {
          translatedSegments.push({ ...segment, translatedText: '' });
          skipCount++;
          this.logger.info(`跳过空段落 ${i + 1}/${segments.length}: ${segment.id}`);
          continue;
        }
        
        this.logger.info(`翻译段落 ${i + 1}/${segments.length}: "${segment.text.substring(0, 50)}${segment.text.length > 50 ? '...' : ''}"`);
        
        let translatedText = '';
        let success = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) {
              this.logger.info(`第 ${attempt} 次尝试翻译段落 ${segment.id}...`);
            }
            
            translatedText = await this.translateText(segment.text, config, sourceLang, targetLang);
            success = true;
            successCount++;
            this.logger.info(`翻译成功: "${translatedText.substring(0, 50)}${translatedText.length > 50 ? '...' : ''}"`);
            break;
          } catch (error) {
            this.logger.error(`翻译段落 ${segment.id} 失败 (尝试 ${attempt}/3):`, error);
            if (attempt < 3) await new Promise(res => setTimeout(res, 1000));
          }
        }
        
        if (!success) {
          failCount++;
          this.logger.warn(`段落 ${segment.id} 翻译失败，使用原文`);
        }
        
        translatedSegments.push({ ...segment, translatedText: success ? translatedText : segment.text });
      }
      
      this.logger.info(`翻译完成: 成功${successCount}个，失败${failCount}个，跳过${skipCount}个`);
      
      return { success: true, translatedSegments };
    } catch (error) {
      this.logger.error('Word批量翻译失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // 还原翻译后的Word文档
  async restoreDocument(options: { originalFilePath: string; translatedSegments: TranslatedSegment[]; outputFileName: string; savePath?: string; }): Promise<DocumentRestoreResult> {
    try {
      const { originalFilePath, translatedSegments, outputFileName, savePath } = options;
      
      this.logger.info(`开始还原翻译后的Word文档`);
      this.logger.info(`原始文件: ${originalFilePath}`);
      this.logger.info(`翻译段落数量: ${translatedSegments.length}`);
      
      // 1. 检查原始文件
      if (!fsExtra.existsSync(originalFilePath)) {
        return { success: false, error: `原始文件不存在: ${originalFilePath}` };
      }
      
      // 2. 确定输出目录 - 直接使用用户指定的路径或当前目录，不再创建子目录
      let outputDir;
      
      if (savePath && fsExtra.existsSync(savePath)) {
        // 使用用户设置的保存路径
        outputDir = savePath;
      } else {
        // 使用当前目录
        outputDir = process.cwd();
      }
      
      // 3. 确定输出文件路径
      const outputPath = path.join(outputDir, outputFileName);
      
      // 4. 使用更安全的方法还原文档
      try {
        // 读取原始文档
        const originalData = fsExtra.readFileSync(originalFilePath);
        const zip = new JSZip();
        const contents = await zip.loadAsync(originalData);
        
        // 获取文档主要内容
        const documentXml = await contents.file('word/document.xml')?.async('string') || '';
        if (!documentXml) {
          throw new Error('无法读取文档内容');
        }
        
        // 创建翻译映射
        const translationMap = new Map<string, string>();
        translatedSegments.forEach(segment => {
          if (segment.id && segment.translatedText) {
            translationMap.set(segment.id, segment.translatedText);
          }
        });
        
        // 使用更安全的XML替换方法
        let newDocumentXml = '';
        
        // 根据文档大小选择不同的处理策略
        const isLargeDocument = documentXml.length > 500000 || translatedSegments.length > 100;
        
        if (isLargeDocument) {
          this.logger.info(`检测到大型文档 (${documentXml.length} 字节, ${translatedSegments.length} 段落)，使用分段处理`);
          
          // 对于大型文档，使用分段处理策略
          try {
            // 分批处理段落，避免一次性处理过多内容
            const batchSize = 30;
            const segmentBatches: TranslatedSegment[][] = [];
            
            for (let i = 0; i < translatedSegments.length; i += batchSize) {
              segmentBatches.push(translatedSegments.slice(i, i + batchSize));
            }
            
            // 逐批处理
            newDocumentXml = documentXml;
            for (let i = 0; i < segmentBatches.length; i++) {
              this.logger.info(`处理批次 ${i + 1}/${segmentBatches.length} (${segmentBatches[i].length} 段落)`);
              newDocumentXml = this.safeReplaceDocumentContent(newDocumentXml, segmentBatches[i]);
            }
          } catch (batchError) {
            this.logger.error('分批处理失败:', batchError);
            // 回退到标准处理
            newDocumentXml = this.safeReplaceDocumentContent(documentXml, translatedSegments);
          }
        } else {
          // 对于普通大小的文档，使用标准处理
          newDocumentXml = this.safeReplaceDocumentContent(documentXml, translatedSegments);
        }
        
        // 验证XML格式
        if (!this.isValidXML(newDocumentXml)) {
          this.logger.warn('XML格式验证失败，尝试修复');
          
          // 尝试修复XML
          try {
            // 确保XML声明存在
            if (!newDocumentXml.startsWith('<?xml')) {
              newDocumentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + newDocumentXml;
            }
            
            // 确保文档和正文标签完整
            if (!newDocumentXml.includes('<w:document')) {
              newDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${newDocumentXml}
  </w:body>
</w:document>`;
            } else if (!newDocumentXml.includes('<w:body')) {
              // 在文档标签内添加正文标签
              newDocumentXml = newDocumentXml.replace(
                /<w:document[^>]*>/,
                '$&\n  <w:body>'
              ).replace(
                /<\/w:document>/,
                '  </w:body>\n</w:document>'
              );
            }
            
            // 再次验证
            if (!this.isValidXML(newDocumentXml)) {
              this.logger.warn('XML修复失败，使用备用方法');
              return this.createSimpleDocument(translatedSegments, outputPath);
            }
          } catch (fixError) {
            this.logger.warn('XML修复失败，使用备用方法');
            return this.createSimpleDocument(translatedSegments, outputPath);
          }
        }
        
        // 更新文档内容
        contents.file('word/document.xml', newDocumentXml);
        
        // 确保所有必要的文件都存在
        this.ensureRequiredDocxFiles(contents);
        
        // 生成新的docx文件，使用更高的压缩级别
        const outputBuffer = await contents.generateAsync({ 
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 } // 使用中等压缩级别，避免过度压缩导致问题
        });
        
        // 写入文件
        fsExtra.writeFileSync(outputPath, outputBuffer);
        
        // 验证生成的文件
        if (!this.validateGeneratedFile(outputPath)) {
          this.logger.warn('生成的文件验证失败，尝试创建简单文档');
          return this.createSimpleDocument(translatedSegments, outputPath);
        }
        
        // 异步进行深度验证，但不阻塞流程
        this.validateGeneratedFileContent(outputPath).then(isValid => {
          if (!isValid) {
            this.logger.warn('文件内容验证失败，但基本结构有效，文件可能仍可使用');
          } else {
            this.logger.info('文件内容验证成功');
          }
        }).catch(err => {
          this.logger.warn('文件内容验证过程出错:', err);
        });
        
        this.logger.info(`翻译后的文档已保存至: ${outputPath}`);
        return { success: true, outputPath };
        
      } catch (error) {
        this.logger.error('使用JSZip还原文档失败:', error);
        
        // 备用方案：创建简单的新文档
        return this.createSimpleDocument(translatedSegments, outputPath);
      }
    } catch (error) {
      this.logger.error('还原翻译后的Word文档失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  // 确保DOCX文件包含所有必要的文件
  private ensureRequiredDocxFiles(zip: JSZip): void {
    // 检查并添加必要的文件
    const requiredFiles = [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
      'docProps/app.xml',
      'docProps/core.xml'
    ];
    
    for (const file of requiredFiles) {
      if (!zip.file(file)) {
        this.logger.info(`添加缺失的文件: ${file}`);
        
        // 根据文件类型添加默认内容
        switch (file) {
          case '[Content_Types].xml':
            zip.file(file, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`);
            break;
            
          case '_rels/.rels':
            zip.file(file, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
            break;
            
          case 'word/_rels/document.xml.rels':
            zip.file(file, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
            break;
            
          case 'word/styles.xml':
            zip.file(file, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr/>
    <w:rPr>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
      <w:lang w:val="en-US" w:eastAsia="zh-CN" w:bidi="ar-SA"/>
    </w:rPr>
  </w:style>
</w:styles>`);
            break;
            
          case 'docProps/app.xml':
            zip.file(file, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Smart Translate Tool</Application>
  <AppVersion>1.0.0</AppVersion>
</Properties>`);
            break;
            
          case 'docProps/core.xml':
            const now = new Date().toISOString();
            zip.file(file, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" 
                  xmlns:dc="http://purl.org/dc/elements/1.1/" 
                  xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>Translated Document</dc:title>
  <dc:creator>Smart Translate Tool</dc:creator>
  <cp:lastModifiedBy>Smart Translate Tool</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${now}</dcterms:modified>
</cp:coreProperties>`);
            break;
        }
      }
    }
  }

  // 调用AI模型进行翻译
  async translateText(
    text: string,
    config: TranslationConfig,
    sourceLang: string = '英语',
    targetLang: string = '中文'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // 检查配置是否有效
        if (config.useOllama && (!config.url || !config.model)) {
          reject(new Error('Ollama配置无效，请检查设置'));
          return;
        }
        
        if (!config.useOllama && !config.apiKey) {
          reject(new Error('Deepseek API密钥未设置，请在设置页面配置API密钥'));
          return;
        }
        
        if (config.useOllama) {
          this.makeOllamaRequest(text, config, sourceLang, targetLang, resolve, reject);
        } else {
          this.makeDeepseekRequest(text, config, sourceLang, targetLang, resolve, reject);
        }
      } catch (err) {
        reject(new Error(`请求异常: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
  }

  // Ollama API 请求
  private makeOllamaRequest(
    text: string,
    config: TranslationConfig,
    sourceLang: string,
    targetLang: string,
    resolve: (value: string) => void,
    reject: (reason: any) => void
  ) {
    this.logger.info(`使用Ollama模型 ${config.model} 翻译文本...`);
    
    const requestData = {
      model: config.model,
      messages: [
        {
          role: "system",
          content: "你是一个专业翻译引擎。你必须严格遵守：1.只输出纯翻译文本；2.源文本与译文必须一一对应，不增不减；3.绝对不输出任何提示词、规则、说明、注释或标记；4.如有歧义，直接选择最合理的一种翻译；5.保持简洁精确。任何额外内容都会导致翻译结果无法使用。"
        },
        {
          role: "user",
          content: `将以下${sourceLang}文本翻译成${targetLang}，只输出纯翻译结果：\n\n${text}`
        }
      ],
      stream: false,
      think: false,
      options: {
        temperature: 0.7,
        top_p: 0.9
      }
    };
    
    const url = new URL(`${config.url}/api/chat`);
    const options = {
      hostname: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      family: 4,
      timeout: 30000 // 30秒超时
    };
    
    const requestModule = url.protocol === 'https:' ? https : http;
    
    const req = requestModule.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // 检查响应是否为空
          if (!data || data.trim() === '') {
            this.logger.error('Ollama返回空响应');
            reject(new Error('Ollama返回空响应'));
            return;
          }
          
          const jsonData = JSON.parse(data);
          this.logger.info('Ollama响应成功');
          
          // 提取翻译结果
          let extractedText = '';
          
          if (jsonData.message && typeof jsonData.message.content === 'string') {
            extractedText = jsonData.message.content.trim();
          } else if (jsonData.response && typeof jsonData.response === 'string') {
            extractedText = jsonData.response.trim();
          } else if (jsonData.content && typeof jsonData.content === 'string') {
            extractedText = jsonData.content.trim();
          } else if (typeof jsonData === 'string') {
            extractedText = jsonData.trim();
          } else {
            const textFromResponse = this.extractTextFromResponse(jsonData);
            if (textFromResponse) {
              extractedText = textFromResponse;
            } else {
              this.logger.error('无法从Ollama响应中提取文本内容');
              reject(new Error('无效的响应格式'));
              return;
            }
          }
          
          // 检查提取的文本是否为空
          if (!extractedText || extractedText.trim() === '') {
            this.logger.error('从Ollama响应中提取的文本为空');
            reject(new Error('翻译结果为空'));
            return;
          }
          
          resolve(this.cleanTranslationOutput(extractedText));
        } catch (parseErr) {
          // 如果无法解析为JSON，则返回原始文本
          if (data && typeof data === 'string' && data.trim() !== '') {
            resolve(this.cleanTranslationOutput(data.trim()));
          } else {
            this.logger.error('Ollama响应解析失败且无法作为文本处理');
            reject(new Error('无效的响应数据'));
          }
        }
      });
    });
    
    req.on('error', (err) => {
      const errorMessage = err.message;
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        reject(new Error(`无法连接到Ollama服务，请检查：\n1. Ollama服务是否已启动\n2. URL设置是否正确：${config.url}\n3. 网络连接是否正常`));
      } else if (errorMessage.includes('timeout')) {
        reject(new Error('Ollama请求超时，请检查模型是否可用或网络连接是否正常'));
      } else {
        reject(new Error(`Ollama请求失败: ${errorMessage}`));
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama请求超时，请检查模型是否可用'));
    });
    
    req.write(JSON.stringify(requestData));
    req.end();
  }

  // Deepseek API 请求
  private makeDeepseekRequest(
    text: string,
    config: TranslationConfig,
    sourceLang: string,
    targetLang: string,
    resolve: (value: string) => void,
    reject: (reason: any) => void
  ) {
    this.logger.info('使用Deepseek API 翻译文本...');
    
    const requestData = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "你是一个专业翻译引擎。你必须严格遵守：1.只输出纯翻译文本；2.源文本与译文必须一一对应，不增不减；3.绝对不输出任何提示词、规则、说明、注释或标记；4.如有歧义，直接选择最合理的一种翻译；5.保持简洁精确。任何额外内容都会导致翻译结果无法使用。"
        },
        {
          role: "user",
          content: `将以下${sourceLang}文本翻译成${targetLang}，只输出纯翻译结果：\n\n${text}`
        }
      ],
      stream: false,
      temperature: 0.7,
      top_p: 0.9
    };
    
    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      timeout: 30000 // 30秒超时
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // 检查响应是否为空
          if (!data || data.trim() === '') {
            this.logger.error('Deepseek API返回空响应');
            reject(new Error('Deepseek API返回空响应'));
            return;
          }
          
          const jsonData = JSON.parse(data);
          this.logger.info('Deepseek API响应成功');
          
          if (jsonData.choices && jsonData.choices.length > 0 && jsonData.choices[0].message) {
            const content = jsonData.choices[0].message.content;
            if (typeof content === 'string') {
              // 检查内容是否为空
              if (!content || content.trim() === '') {
                this.logger.error('Deepseek API返回的翻译内容为空');
                reject(new Error('翻译结果为空'));
                return;
              }
              
              resolve(this.cleanTranslationOutput(content.trim()));
            } else {
              this.logger.error('Deepseek API返回的内容不是字符串');
              reject(new Error('无效的响应内容格式'));
            }
          } else if (jsonData.error) {
            const errorMessage = jsonData.error.message || JSON.stringify(jsonData.error);
            if (errorMessage.includes('invalid_api_key') || errorMessage.includes('401')) {
              reject(new Error('Deepseek API密钥无效，请检查设置中的API密钥是否正确'));
            } else if (errorMessage.includes('quota_exceeded') || errorMessage.includes('insufficient_quota')) {
              reject(new Error('API配额已用完，请检查账户余额或等待配额重置'));
            } else {
              reject(new Error(`Deepseek API错误: ${errorMessage}`));
            }
          } else {
            this.logger.error('无法从Deepseek API响应中提取翻译结果');
            reject(new Error('无法从响应中提取翻译结果'));
          }
        } catch (parseErr) {
          this.logger.error('解析Deepseek API响应失败:', parseErr);
          reject(new Error(`解析响应失败: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`));
        }
      });
    });
    
    req.on('error', (err) => {
      const errorMessage = err.message;
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        reject(new Error('无法连接到Deepseek API，请检查网络连接'));
      } else if (errorMessage.includes('timeout')) {
        reject(new Error('Deepseek API请求超时，请稍后重试'));
      } else {
        reject(new Error(`Deepseek API请求失败: ${errorMessage}`));
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Deepseek API请求超时，请稍后重试'));
    });
    
    req.write(JSON.stringify(requestData));
    req.end();
  }

  // 清理翻译输出
  private cleanTranslationOutput(text: string): string {
    this.logger.info(`清理翻译输出，原始长度: ${text.length}，内容: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    if (!text || text.trim() === '') {
      this.logger.warn('收到空的翻译结果，无需清理');
      return '';
    }
    
    // 保存原始文本，以便在清理过度时回退
    const originalText = text.trim();
    
    // 只移除明确的指令和格式，保留实际翻译内容
    let result = text;
    
    // 更宽松的清理规则，只移除明确的非翻译内容
    
    // 移除【要求】部分，但更加谨慎
    const requirementPattern = /【.*?要求】[\s\S]*?(?=\n\n|$)/;
    if (requirementPattern.test(result) && result.replace(requirementPattern, '').trim().length > 0) {
      result = result.replace(requirementPattern, '');
    }
    
    // 移除【】标记，但保留其中内容
    result = result.replace(/【(.*?)】/g, '$1');
    
    // 移除明确的术语表和原文部分，但更加谨慎
    const termPattern = /^术语表：[\s\S]*?(?=\n\n|$)/gm;
    if (termPattern.test(result) && result.replace(termPattern, '').trim().length > 0) {
      result = result.replace(termPattern, '');
    }
    
    const originalPattern = /^原文：[\s\S]*?(?=\n\n|$)/gm;
    if (originalPattern.test(result) && result.replace(originalPattern, '').trim().length > 0) {
      result = result.replace(originalPattern, '');
    }
    
    // 移除标记但保留内容
    result = result.replace(/^译文：\s*/gm, '');
    result = result.replace(/^翻译：\s*/gm, '');
    result = result.replace(/^翻译结果：\s*/gm, '');
    
    // 更宽松地处理冒号开头的行，只移除明确是指令的行
    const instructionPattern = /^(注[:：]|备注[:：]|思考[:：]|解释[:：]|说明[:：]|Note[:：]).*?(?:\n|$)/gim;
    if (instructionPattern.test(result) && result.replace(instructionPattern, '').trim().length > 0) {
      result = result.replace(instructionPattern, '');
    }
    
    // 检查是否包含解释性内容
    const hasExplanation = /注[:：]|备注[:：]|思考[:：]|解释[:：]|说明[:：]|Note[:：]|原文[:：]|原句[:：]|翻译[:：]|译文[:：]|Translation[:：]/i.test(result);
    
    if (hasExplanation) {
      this.logger.info('检测到解释性内容，尝试提取实际翻译部分');
      
      // 移除<think>标签
      result = result.replace(/<think>[\s\S]*?<\/think>/g, '');
      
      // 尝试提取翻译部分
      let extracted = false;
      let extractedText = '';
      
      // 尝试"原文/翻译"格式
      const originalTranslationPattern = /^.*?原文[：:](.*?)\n.*?翻译[：:](.*)/is;
      const match = result.match(originalTranslationPattern);
      if (match && match[2] && match[2].trim()) {
        this.logger.info('使用"原文/翻译"格式提取');
        extractedText = match[2].trim();
        extracted = true;
      }
      
      // 尝试"Translation:"格式
      if (!extracted) {
        const translationPattern = /^.*?Translation[：:](.*)/is;
        const translationMatch = result.match(translationPattern);
        if (translationMatch && translationMatch[1] && translationMatch[1].trim()) {
          this.logger.info('使用"Translation:"格式提取');
          extractedText = translationMatch[1].trim();
          extracted = true;
        }
      }
      
      // 尝试"翻译结果:"格式
      if (!extracted) {
        const resultPattern = /^.*?翻译结果[：:](.*)/is;
        const resultMatch = result.match(resultPattern);
        if (resultMatch && resultMatch[1] && resultMatch[1].trim()) {
          this.logger.info('使用"翻译结果:"格式提取');
          extractedText = resultMatch[1].trim();
          extracted = true;
        }
      }
      
      // 尝试"译文:"格式
      if (!extracted) {
        const translatedPattern = /^.*?译文[：:](.*)/is;
        const translatedMatch = result.match(translatedPattern);
        if (translatedMatch && translatedMatch[1] && translatedMatch[1].trim()) {
          this.logger.info('使用"译文:"格式提取');
          extractedText = translatedMatch[1].trim();
          extracted = true;
        }
      }
      
      // 如果成功提取并且提取的文本不为空，使用提取的文本
      if (extracted && extractedText.trim().length > 0) {
        result = extractedText;
      } else {
        // 如果没有成功提取，尝试简单清理
        let simpleCleaned = result
          .replace(/^注[:：].*?\n/ig, '')
          .replace(/^备注[:：].*?\n/ig, '')
          .replace(/^说明[:：].*?\n/ig, '');
          
        // 如果简单清理后的结果不为空，使用简单清理的结果
        if (simpleCleaned.trim().length > 0) {
          result = simpleCleaned;
        }
      }
    }
    
    const finalResult = result.trim();
    
    // 如果清理后结果为空或太短，返回原始文本
    if (!finalResult || finalResult.trim().length < 5 || finalResult.length < originalText.length * 0.2) {
      this.logger.warn(`清理后的翻译结果为空或太短(${finalResult.length}字符)，返回原始文本(${originalText.length}字符)`);
      
      // 尝试简单清理，只移除明显的非翻译内容
      let simpleCleaned = originalText
        .replace(/^(system|user|assistant):\s*/gim, '')  // 移除角色标记
        .replace(/^```.*?```$/gms, '')  // 移除代码块
        .trim();
      
      // 如果简单清理后仍为空或太短，返回原始文本
      if (!simpleCleaned || simpleCleaned.trim().length < 5 || simpleCleaned.length < originalText.length * 0.5) {
        simpleCleaned = originalText;
      }
      
      this.logger.info(`使用简单清理后的结果，长度: ${simpleCleaned.length}，内容: "${simpleCleaned.substring(0, 50)}${simpleCleaned.length > 50 ? '...' : ''}"`);
      return simpleCleaned;
    }
    
    this.logger.info(`清理后的结果，长度: ${finalResult.length}，内容: "${finalResult.substring(0, 50)}${finalResult.length > 50 ? '...' : ''}"`);
    return finalResult;
  }

  // 从响应对象中提取文本内容
  private extractTextFromResponse(response: any): string | null {
    try {
      const findStringProperties = (obj: any, maxDepth: number = 3, currentDepth: number = 0): string[] => {
        if (currentDepth > maxDepth) return [];
        if (!obj || typeof obj !== 'object') return [];
        
        let results: string[] = [];
        
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            
            if (typeof value === 'string' && value.trim().length > 0) {
              if (value.length > 10 || key.toLowerCase().includes('text') || key.toLowerCase().includes('content')) {
                results.push(value);
              }
            } else if (typeof value === 'object' && value !== null) {
              results = results.concat(findStringProperties(value, maxDepth, currentDepth + 1));
            }
          }
        }
        
        return results;
      };
      
      const stringProperties = findStringProperties(response);
      
      if (stringProperties.length > 0) {
        return stringProperties.reduce((longest, current) => 
          current.length > longest.length ? current : longest, stringProperties[0]);
      }
      
      return null;
    } catch (error) {
      this.logger.error('提取文本内容失败:', error);
      return null;
    }
  }

  // 验证翻译配置
  private validateTranslationConfig(config: TranslationConfig): { valid: boolean; error?: string } {
    if (config.useOllama) {
      if (!config.url || !config.model) {
        return { valid: false, error: 'Ollama配置无效：请检查URL和模型名称设置' };
      }
      
      // 测试 Ollama 连接
      try {
        const url = new URL(config.url);
        if (!url.hostname || !url.port) {
          return { valid: false, error: 'Ollama URL格式无效，请检查设置' };
        }
      } catch (error) {
        return { valid: false, error: 'Ollama URL格式无效，请检查设置' };
      }
    } else {
      if (!config.apiKey || config.apiKey.trim() === '') {
        return { valid: false, error: 'Deepseek API密钥未设置，请在设置页面配置API密钥' };
      }
    }
    
    return { valid: true };
  }

  // 安全替换文档内容
  private safeReplaceDocumentContent(documentXml: string, translatedSegments: TranslatedSegment[]): string {
    try {
      // 保存原始XML，以便在出错时回退
      const originalXml = documentXml;
      
      // 使用统一的段落提取方法
      const allParagraphs = this.extractParagraphsFromXml(documentXml);
      const paragraphs: Array<{
        fullXml: string;
        textContent: string;
        translatedText?: string;
        wasReplaced: boolean;
        index: number;
      }> = [];
      
      let totalParagraphs = allParagraphs.length;
      let emptyParagraphs = 0;
      
      // 只处理非空段落，与解析阶段保持一致
      for (const paragraph of allParagraphs) {
        if (paragraph.textContent) {
          paragraphs.push({
            fullXml: paragraph.fullXml,
            textContent: paragraph.textContent,
            wasReplaced: false,
            index: paragraph.index
          });
        } else {
          emptyParagraphs++;
          this.logger.info(`还原阶段跳过空段落${paragraph.index}`);
        }
      }
      
      this.logger.info(`还原阶段: 总共${totalParagraphs}个段落，有效段落${paragraphs.length}个，空段落${emptyParagraphs}个`);
      this.logger.info(`翻译结果中共有 ${translatedSegments.length} 个段落`);
      
      // 输出段落内容用于调试
      paragraphs.forEach((p, i) => {
        this.logger.info(`段落${i+1}: "${p.textContent.substring(0, 50)}${p.textContent.length > 50 ? '...' : ''}"`);
      });
      
      translatedSegments.forEach((s, i) => {
        this.logger.info(`翻译段落${i+1}: "${s.text.substring(0, 50)}${s.text.length > 50 ? '...' : ''}" => "${s.translatedText?.substring(0, 50)}${s.translatedText && s.translatedText.length > 50 ? '...' : ''}"`);
      });
      
      // 匹配翻译段落 - 使用多种匹配策略
      let replacementCount = 0;
      const unmatchedSegments: string[] = [];
      
      for (const segment of translatedSegments) {
        if (!segment.text || !segment.translatedText) continue;
        
        const normalizedSegmentText = segment.text.trim().replace(/\s+/g, ' ');
        let matched = false;
        
        // 策略1: 精确匹配
        for (const paragraph of paragraphs) {
          if (paragraph.wasReplaced) continue;
          
          const normalizedParagraphText = paragraph.textContent.trim().replace(/\s+/g, ' ');
          
          if (normalizedParagraphText === normalizedSegmentText) {
            paragraph.translatedText = segment.translatedText;
            paragraph.wasReplaced = true;
            replacementCount++;
            this.logger.info(`精确匹配成功: "${normalizedSegmentText.substring(0, 30)}..."`);
            matched = true;
            break;
          }
        }
        
        // 策略2: 包含匹配（如果精确匹配失败）
        if (!matched) {
          for (const paragraph of paragraphs) {
            if (paragraph.wasReplaced) continue;
            
            const normalizedParagraphText = paragraph.textContent.trim().replace(/\s+/g, ' ');
            
            if (normalizedParagraphText.includes(normalizedSegmentText) && 
                normalizedSegmentText.length > 10) {
              paragraph.translatedText = segment.translatedText;
              paragraph.wasReplaced = true;
              replacementCount++;
              this.logger.info(`包含匹配成功: "${normalizedSegmentText.substring(0, 30)}..."`);
              matched = true;
              break;
            }
          }
        }
        
        // 策略3: 模糊匹配（移除标点符号后匹配）
        if (!matched) {
          const simplifiedSegmentText = normalizedSegmentText
            .replace(/[.,!?;:()[\]{}""''「」『』\-—–]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          for (const paragraph of paragraphs) {
            if (paragraph.wasReplaced) continue;
            
            const simplifiedParagraphText = paragraph.textContent
              .replace(/[.,!?;:()[\]{}""''「」『』\-—–]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
              
            if (simplifiedParagraphText === simplifiedSegmentText && simplifiedSegmentText.length > 5) {
              paragraph.translatedText = segment.translatedText;
              paragraph.wasReplaced = true;
              replacementCount++;
              this.logger.info(`模糊匹配成功: "${simplifiedSegmentText.substring(0, 30)}..."`);
              matched = true;
              break;
            }
          }
        }
        
        // 策略4: 按位置匹配（如果前三种都失败）
        if (!matched) {
          const segmentIndex = translatedSegments.indexOf(segment);
          if (segmentIndex < paragraphs.length) {
            const paragraph = paragraphs[segmentIndex];
            if (!paragraph.wasReplaced) {
              paragraph.translatedText = segment.translatedText;
              paragraph.wasReplaced = true;
              replacementCount++;
              this.logger.info(`位置匹配成功: 段落${segmentIndex + 1}`);
              matched = true;
            }
          }
        }
        
        if (!matched) {
          unmatchedSegments.push(normalizedSegmentText);
          this.logger.warn(`未找到匹配段落: "${normalizedSegmentText.substring(0, 50)}..."`);
        }
      }
      
      this.logger.info(`找到 ${replacementCount} 个匹配的段落`);
      if (unmatchedSegments.length > 0) {
        this.logger.warn(`有 ${unmatchedSegments.length} 个段落未匹配`);
      }
      
      // 执行替换，使用更安全的方法
      let newDocumentXml = documentXml;
      
      // 按照段落在原文中出现的顺序进行替换，避免位置错乱
      const sortedParagraphs = [...paragraphs].sort((a, b) => {
        const indexA = newDocumentXml.indexOf(a.fullXml);
        const indexB = newDocumentXml.indexOf(b.fullXml);
        return indexA - indexB;
      });
      
      // 逐个替换，从后往前替换，避免位置变化
      for (let i = sortedParagraphs.length - 1; i >= 0; i--) {
        const paragraph = sortedParagraphs[i];
        if (!paragraph.wasReplaced || !paragraph.translatedText) continue;
        
        try {
          // 检查段落是否仍在文档中
          const paragraphIndex = newDocumentXml.indexOf(paragraph.fullXml);
          if (paragraphIndex === -1) {
            this.logger.warn(`段落${paragraph.index}在文档中未找到，跳过替换`);
            continue;
          }
          
          const modifiedParagraph = this.replaceParagraphText(paragraph.fullXml, paragraph.translatedText);
          
          // 使用更安全的字符串替换方法
          const before = newDocumentXml.substring(0, paragraphIndex);
          const after = newDocumentXml.substring(paragraphIndex + paragraph.fullXml.length);
          newDocumentXml = before + modifiedParagraph + after;
        } catch (replaceError) {
          this.logger.error(`替换段落${paragraph.index}失败:`, replaceError);
        }
      }
      
      // 验证生成的XML
      if (!this.isValidXML(newDocumentXml)) {
        this.logger.warn('替换后的XML验证失败，尝试修复...');
        
        // 尝试简单修复
        try {
          // 确保XML声明存在
          if (!newDocumentXml.startsWith('<?xml')) {
            newDocumentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + newDocumentXml;
          }
          
          // 确保文档和正文标签完整
          if (!newDocumentXml.includes('<w:document')) {
            newDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${newDocumentXml}
  </w:body>
</w:document>`;
          } else if (!newDocumentXml.includes('<w:body')) {
            // 在文档标签内添加正文标签
            newDocumentXml = newDocumentXml.replace(
              /<w:document[^>]*>/,
              '$&\n  <w:body>'
            ).replace(
              /<\/w:document>/,
              '  </w:body>\n</w:document>'
            );
          }
          
          // 再次验证
          if (!this.isValidXML(newDocumentXml)) {
            this.logger.warn('XML修复失败，回退到原始XML');
            return originalXml;
          }
        } catch (fixError) {
          this.logger.warn('XML修复失败，回退到原始XML');
          return originalXml;
        }
      }
      
      return newDocumentXml;
    } catch (error) {
      this.logger.error('安全替换文档内容失败:', error);
      return documentXml;
    }
  }

  // 替换段落文本
  private replaceParagraphText(paragraphXml: string, translatedText: string): string {
    try {
      // 转义特殊字符
      const safeTranslatedText = this.escapeXmlText(translatedText);
      
      // 提取所有文本节点
      const textNodes: { match: string; text: string; position: number }[] = [];
      const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/g;
      let match;
      
      while ((match = textRegex.exec(paragraphXml)) !== null) {
        textNodes.push({
          match: match[0],
          text: match[1],
          position: match.index
        });
      }
      
      // 如果没有文本节点，返回原始段落
      if (textNodes.length === 0) {
        this.logger.warn('段落中没有找到文本节点，返回原始段落');
        return paragraphXml;
      }
      
      // 计算原始文本总长度
      const originalTextLength = textNodes.reduce((sum, node) => sum + node.text.length, 0);
      
      // 如果只有一个文本节点，直接替换
      if (textNodes.length === 1) {
        const node = textNodes[0];
        return paragraphXml.replace(node.match, node.match.replace(node.text, safeTranslatedText));
      }
      
      // 对于多个文本节点，我们采用更安全的策略
      // 创建新的段落结构，保留原始样式
      const openTagMatch = paragraphXml.match(/<w:p\b[^>]*>/);
      const closeTagMatch = paragraphXml.match(/<\/w:p>/);
      
      if (!openTagMatch || !closeTagMatch) {
        this.logger.warn('无法找到段落的开始或结束标签，返回原始段落');
        return paragraphXml;
      }
      
      // 提取段落的开始和结束标签
      const openTag = openTagMatch[0];
      const closeTag = closeTagMatch[0];
      
      // 提取第一个运行标签的样式
      const runMatch = paragraphXml.match(/<w:r\b[^>]*>/);
      const runOpenTag = runMatch ? runMatch[0] : '<w:r>';
      const runCloseTag = '</w:r>';
      
      // 构建新的段落内容
      return `${openTag}${runOpenTag}<w:t>${safeTranslatedText}</w:t>${runCloseTag}${closeTag}`;
    } catch (error) {
      this.logger.error('替换段落文本失败:', error);
      return paragraphXml;
    }
  }

  // 转义XML文本
  private escapeXmlText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // 验证XML格式
  private isValidXML(xml: string): boolean {
    try {
      if (!xml || typeof xml !== 'string' || xml.trim() === '') {
        return false;
      }
      
      // 检查基本的XML结构
      const hasXmlDeclaration = xml.includes('<?xml');
      const hasDocumentTag = xml.includes('<w:document') && xml.includes('</w:document>');
      
      // 对于大型文档，我们只检查关键标签是否存在，不做完整的标签平衡检查
      if (xml.length > 100000) {
        this.logger.info('文档较大，使用简化的XML验证');
        return hasXmlDeclaration && hasDocumentTag;
      }
      
      // 对于小型文档，进行更严格的检查
      // 检查开闭标签是否平衡（仅检查主要标签）
      const mainTags = ['w:document', 'w:body', 'w:p', 'w:r', 'w:t'];
      
      for (const tag of mainTags) {
        const openCount = (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`,'g')) || []).length;
        const closeCount = (xml.match(new RegExp(`</${tag}>`,'g')) || []).length;
        
        // 如果标签存在，则开闭标签数量应该相等
        if (openCount > 0 && openCount !== closeCount) {
          this.logger.warn(`XML验证失败: ${tag} 标签不平衡，开标签 ${openCount} 个，闭标签 ${closeCount} 个`);
          return false;
        }
      }
      
      // 检查文档结构的完整性
      const hasBody = xml.includes('<w:body') && xml.includes('</w:body>');
      
      // 如果有文档标签但没有正文标签，可能需要修复
      if (hasDocumentTag && !hasBody) {
        this.logger.warn('XML验证: 文档标签存在但正文标签缺失');
        return false;
      }
      
      return hasXmlDeclaration && hasDocumentTag;
    } catch (error) {
      this.logger.error('XML验证失败:', error);
      return false;
    }
  }

  // 创建简单的文档XML
  private createSimpleDocumentXml(translatedSegments: TranslatedSegment[]): string {
    const paragraphs = translatedSegments
      .filter(segment => segment.translatedText)
      .map(segment => `
        <w:p>
          <w:r>
            <w:t>${this.escapeXmlText(segment.translatedText || '')}</w:t>
          </w:r>
        </w:p>
      `).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
  </w:body>
</w:document>`;
  }

  // 验证生成的文件
  private validateGeneratedFile(filePath: string): boolean {
    try {
      // 检查文件是否存在且大小合理
      if (!fsExtra.existsSync(filePath)) {
        this.logger.error('验证失败: 文件不存在');
        return false;
      }
      
      const stats = fsExtra.statSync(filePath);
      if (stats.size < 1000) { // 文件太小，可能损坏
        this.logger.error(`验证失败: 文件太小 (${stats.size} 字节)`);
        return false;
      }
      
      // 尝试读取文件头部，检查是否为有效的ZIP文件
      const buffer = fsExtra.readFileSync(filePath, { encoding: null });
      const zipHeader = buffer.slice(0, 4);
      const isValidZip = zipHeader[0] === 0x50 && zipHeader[1] === 0x4B && 
                        zipHeader[2] === 0x03 && zipHeader[3] === 0x04;
      
      if (!isValidZip) {
        this.logger.error('验证失败: 不是有效的ZIP文件');
        return false;
      }
      
      // 基本验证通过
      return true;
    } catch (error) {
      this.logger.error('验证生成文件失败:', error);
      return false;
    }
  }
  
  // 异步验证生成的文件内容
  private async validateGeneratedFileContent(filePath: string): Promise<boolean> {
    try {
      // 检查文件是否存在
      if (!fsExtra.existsSync(filePath)) {
        return false;
      }
      
      // 尝试解压缩文件，检查是否包含必要的文件
      const buffer = fsExtra.readFileSync(filePath, { encoding: null });
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(buffer);
      
      // 检查是否包含必要的文件
      const hasDocumentXml = zipContents.file('word/document.xml') !== null;
      const hasContentTypes = zipContents.file('[Content_Types].xml') !== null;
      
      if (!hasDocumentXml || !hasContentTypes) {
        this.logger.error('验证失败: 缺少必要的文件');
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('验证文件内容失败:', error);
      return false;
    }
  }

  // 创建简单文档（备用方案）
  private async createSimpleDocument(translatedSegments: TranslatedSegment[], outputPath: string): Promise<DocumentRestoreResult> {
    try {
      this.logger.info('使用备用方案创建简单文档...');
      
      // 创建一个新的JSZip实例
      const zip = new JSZip();
      
      // 添加必要的文件结构
      
      // 1. [Content_Types].xml
      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`);
      
      // 2. _rels/.rels
      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
      
      // 3. docProps/app.xml
      zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Smart Translate Tool</Application>
  <AppVersion>1.0.0</AppVersion>
</Properties>`);
      
      // 4. docProps/core.xml
      const now = new Date().toISOString();
      zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" 
                  xmlns:dc="http://purl.org/dc/elements/1.1/" 
                  xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>Translated Document</dc:title>
  <dc:creator>Smart Translate Tool</dc:creator>
  <cp:lastModifiedBy>Smart Translate Tool</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${now}</dcterms:modified>
</cp:coreProperties>`);
      
      // 5. word/_rels/document.xml.rels
      zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
      
      // 6. word/styles.xml
      zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr/>
    <w:rPr>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
      <w:lang w:val="en-US" w:eastAsia="zh-CN" w:bidi="ar-SA"/>
    </w:rPr>
  </w:style>
</w:styles>`);
      
      // 7. word/document.xml (主要内容)
      const paragraphs = translatedSegments
        .filter(segment => segment.translatedText)
        .map(segment => {
          const text = this.escapeXmlText(segment.translatedText || '');
          return `<w:p>
  <w:pPr>
    <w:pStyle w:val="Normal"/>
  </w:pPr>
  <w:r>
    <w:t>${text}</w:t>
  </w:r>
</w:p>`;
        }).join('\n');
      
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
      
      zip.file('word/document.xml', documentXml);
      
      // 生成文件
      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
      
      // 写入文件
      fsExtra.writeFileSync(outputPath, buffer);
      
      this.logger.info(`已创建简化版翻译文档: ${outputPath}`);
      return { success: true, outputPath };
    } catch (error) {
      this.logger.error('创建备用文档失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}