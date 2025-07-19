/**
 * Word文档解析处理程序
 * 处理Word文档解析相关的IPC请求
 */

import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import JSZip from 'jszip'
import { Logger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'

// 定义标签占位符的接口
interface TagPlaceholder {
  id: string;
  type: 'style' | 'image' | 'table' | 'other';
  originalTag: string;
  position: {
    start: number;
    end: number;
  };
  metadata?: any;
}

// 定义段落和句子的接口
interface TextSegment {
  id: string;
  type: 'paragraph' | 'run' | 'sentence';
  text: string;
  originalXml?: string;
  placeholders?: TagPlaceholder[];
}

/**
 * 解析Word文档
 * @param filePath Word文档路径
 * @returns 解析结果
 */
async function parseDocx(filePath: string): Promise<{
  success: boolean;
  documentXml?: string;
  stylesXml?: string;
  contentTypes?: string;
  fileList?: string[];
  outputDir?: string;
  paragraphs?: string[];
  processedSegments?: TextSegment[];
  error?: string;
}> {
  try {
    console.log(`开始解析Word文档: ${filePath}`);
    
    // 读取文件
    const data = fs.readFileSync(filePath);
    
    // 使用JSZip解压文件
    const zip = new JSZip();
    const contents = await zip.loadAsync(data);
    
    // 创建保存解析结果的目录
    const fileName = path.basename(filePath, '.docx');
    const outputDir = path.join(process.cwd(), `${fileName}_parsed`);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 获取文档主要内容 (word/document.xml)
    const documentXml = await contents.file('word/document.xml')?.async('string') || '';
    if (documentXml) {
      fs.writeFileSync(path.join(outputDir, 'document.xml'), documentXml);
    }
    
    // 获取样式信息 (word/styles.xml)
    const stylesXml = await contents.file('word/styles.xml')?.async('string') || '';
    if (stylesXml) {
      fs.writeFileSync(path.join(outputDir, 'styles.xml'), stylesXml);
    }
    
    // 获取内容类型信息 ([Content_Types].xml)
    const contentTypesXml = await contents.file('[Content_Types].xml')?.async('string') || '';
    if (contentTypesXml) {
      fs.writeFileSync(path.join(outputDir, 'Content_Types.xml'), contentTypesXml);
    }
    
    // 获取所有文件列表
    const fileList = Object.keys(contents.files);
    fs.writeFileSync(path.join(outputDir, 'file_list.txt'), fileList.join('\n'));
    
    // 提取图片文件
    const mediaFolder = path.join(outputDir, 'media');
    if (!fs.existsSync(mediaFolder)) {
      fs.mkdirSync(mediaFolder, { recursive: true });
    }
    
    // 查找并提取所有媒体文件
    for (const filePath of fileList) {
      if (filePath.startsWith('word/media/')) {
        const mediaFile = contents.file(filePath);
        if (mediaFile) {
          const fileName = path.basename(filePath);
          const buffer = await mediaFile.async('nodebuffer');
          fs.writeFileSync(path.join(mediaFolder, fileName), buffer);
        }
      }
    }
    
    // 分析document.xml中的段落和文本
    let paragraphs: string[] = [];
    if (documentXml) {
      paragraphs = extractParagraphs(documentXml);
      fs.writeFileSync(
        path.join(outputDir, 'extracted_text.txt'), 
        paragraphs.join('\n\n')
      );
    }
    
    // 预处理文档内容
    const processedContent = await preprocessDocumentContent(documentXml);
    
    // 保存预处理结果
    if (processedContent.segments.length > 0) {
      fs.writeFileSync(
        path.join(outputDir, 'processed_segments.json'),
        JSON.stringify(processedContent.segments, null, 2)
      );
      
      fs.writeFileSync(
        path.join(outputDir, 'placeholders.json'),
        JSON.stringify(processedContent.placeholders, null, 2)
      );
      
      // 保存纯文本版本
      fs.writeFileSync(
        path.join(outputDir, 'processed_text.txt'),
        processedContent.segments.map(segment => segment.text).join('\n\n')
      );
    }
    
    return {
      success: true,
      documentXml,
      stylesXml,
      contentTypes: contentTypesXml,
      fileList,
      outputDir,
      paragraphs,
      processedSegments: processedContent.segments
    };
  } catch (error) {
    console.error('解析Word文档时出错:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 从document.xml中提取段落文本
 * @param xmlContent document.xml内容
 * @returns 段落文本数组
 */
function extractParagraphs(xmlContent: string): string[] {
  const paragraphs: string[] = [];
  
  // 简单的正则表达式匹配，实际应用中应该使用XML解析器
  const paragraphRegex = /<w:p\b[^>]*>(.*?)<\/w:p>/gs;
  const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
  
  let paragraphMatch;
  while ((paragraphMatch = paragraphRegex.exec(xmlContent)) !== null) {
    const paragraphContent = paragraphMatch[1];
    let textContent = '';
    
    let textMatch;
    while ((textMatch = textRegex.exec(paragraphContent)) !== null) {
      textContent += textMatch[1];
    }
    
    if (textContent.trim()) {
      paragraphs.push(textContent);
    }
  }
  
  return paragraphs;
}

/**
 * 预处理文档内容
 * 清洗空行、页眉页脚、批注、修订痕迹
 * 分段/分句
 * 保护标签
 * @param xmlContent document.xml内容
 * @returns 预处理后的文档内容
 */
async function preprocessDocumentContent(xmlContent: string): Promise<{
  segments: TextSegment[];
  placeholders: Record<string, TagPlaceholder>;
}> {
  // 初始化结果
  const segments: TextSegment[] = [];
  const placeholders: Record<string, TagPlaceholder> = {};
  
  if (!xmlContent) {
    return { segments, placeholders };
  }
  
  try {
    // 1. 清洗页眉页脚、批注、修订痕迹
    let cleanedXml = removeHeaderFooter(xmlContent);
    cleanedXml = removeComments(cleanedXml);
    cleanedXml = removeRevisions(cleanedXml);
    
    // 2. 提取段落
    const paragraphs = extractParagraphsWithXml(cleanedXml);
    
    // 3. 处理每个段落
    for (const paragraph of paragraphs) {
      // 跳过空段落
      if (!paragraph.text.trim()) {
        continue;
      }
      
      // 3.1 保护标签
      const { text: processedText, extractedPlaceholders } = extractAndReplaceTags(paragraph.text, paragraph.xml);
      
      // 将提取的占位符添加到全局占位符集合中
      Object.assign(placeholders, extractedPlaceholders);
      
      // 3.2 分句处理
      const sentences = splitIntoSentences(processedText);
      
      // 如果没有有效的句子，则添加整个段落
      if (sentences.length === 0) {
        segments.push({
          id: `p_${segments.length + 1}`,
          type: 'paragraph',
          text: processedText,
          originalXml: paragraph.xml,
          placeholders: Object.keys(extractedPlaceholders).map(key => extractedPlaceholders[key])
        });
      } else {
        // 添加每个句子
        for (const sentence of sentences) {
          segments.push({
            id: `s_${segments.length + 1}`,
            type: 'sentence',
            text: sentence,
            originalXml: paragraph.xml, // 保存原始XML，便于后续还原
            placeholders: Object.keys(extractedPlaceholders).map(key => extractedPlaceholders[key])
          });
        }
      }
    }
    
    return { segments, placeholders };
  } catch (error) {
    console.error('预处理文档内容时出错:', error);
    return { segments, placeholders };
  }
}

/**
 * 移除页眉页脚
 * @param xmlContent XML内容
 * @returns 清理后的XML内容
 */
function removeHeaderFooter(xmlContent: string): string {
  // 移除页眉
  let result = xmlContent.replace(/<w:hdr\b[^>]*>.*?<\/w:hdr>/gs, '');
  // 移除页脚
  result = result.replace(/<w:ftr\b[^>]*>.*?<\/w:ftr>/gs, '');
  return result;
}

/**
 * 移除批注
 * @param xmlContent XML内容
 * @returns 清理后的XML内容
 */
function removeComments(xmlContent: string): string {
  // 移除批注引用
  let result = xmlContent.replace(/<w:commentReference\b[^>]*\/>/g, '');
  // 移除批注范围开始
  result = result.replace(/<w:commentRangeStart\b[^>]*\/>/g, '');
  // 移除批注范围结束
  result = result.replace(/<w:commentRangeEnd\b[^>]*\/>/g, '');
  return result;
}

/**
 * 移除修订痕迹
 * @param xmlContent XML内容
 * @returns 清理后的XML内容
 */
function removeRevisions(xmlContent: string): string {
  // 移除删除的内容
  let result = xmlContent.replace(/<w:del\b[^>]*>.*?<\/w:del>/gs, '');
  // 保留插入的内容，但移除标记
  result = result.replace(/<w:ins\b[^>]*>(.*?)<\/w:ins>/gs, '$1');
  return result;
}

/**
 * 提取段落及其XML
 * @param xmlContent XML内容
 * @returns 段落数组，包含文本和原始XML
 */
function extractParagraphsWithXml(xmlContent: string): Array<{ text: string; xml: string }> {
  const paragraphs: Array<{ text: string; xml: string }> = [];
  
  // 提取段落及其XML
  const paragraphRegex = /<w:p\b[^>]*>(.*?)<\/w:p>/gs;
  const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
  
  let paragraphMatch;
  while ((paragraphMatch = paragraphRegex.exec(xmlContent)) !== null) {
    const paragraphXml = paragraphMatch[0];
    const paragraphContent = paragraphMatch[1];
    let textContent = '';
    
    // 提取段落中的文本
    let textMatch;
    while ((textMatch = textRegex.exec(paragraphContent)) !== null) {
      textContent += textMatch[1];
    }
    
    paragraphs.push({
      text: textContent,
      xml: paragraphXml
    });
  }
  
  return paragraphs;
}

/**
 * 提取并替换标签
 * @param text 文本内容
 * @param xml 原始XML
 * @returns 处理后的文本和提取的标签占位符
 */
function extractAndReplaceTags(text: string, xml: string): {
  text: string;
  extractedPlaceholders: Record<string, TagPlaceholder>;
} {
  let processedText = text;
  const extractedPlaceholders: Record<string, TagPlaceholder> = {};
  
  try {
    // 1. 提取样式标签
    processedText = extractStyleTags(processedText, xml, extractedPlaceholders);
    
    // 2. 提取表格标签
    processedText = extractTableTags(processedText, xml, extractedPlaceholders);
    
    // 3. 提取图片标签
    processedText = extractImageTags(processedText, xml, extractedPlaceholders);
    
    return { text: processedText, extractedPlaceholders };
  } catch (error) {
    console.error('提取并替换标签时出错:', error);
    return { text: processedText, extractedPlaceholders };
  }
}

/**
 * 提取样式标签
 * @param text 文本内容
 * @param xml 原始XML
 * @param placeholders 占位符集合
 * @returns 处理后的文本
 */
function extractStyleTags(text: string, xml: string, placeholders: Record<string, TagPlaceholder>): string {
  let processedText = text;
  
  // 样式标签的正则表达式
  const styleRegex = /<w:rPr\b[^>]*>(.*?)<\/w:rPr>/gs;
  
  // 在XML中查找样式标签
  let styleMatch;
  while ((styleMatch = styleRegex.exec(xml)) !== null) {
    const styleTag = styleMatch[0];
    const styleContent = styleMatch[1];
    
    // 创建唯一标识符
    const placeholderId = `style_${uuidv4().substring(0, 8)}`;
    const placeholderText = `<w:rPr:${placeholderId}>`;
    
    // 创建占位符对象
    placeholders[placeholderId] = {
      id: placeholderId,
      type: 'style',
      originalTag: styleTag,
      position: {
        start: styleMatch.index,
        end: styleMatch.index + styleTag.length
      },
      metadata: {
        content: styleContent
      }
    };
    
    // 替换文本中的样式标签（如果存在）
    processedText = processedText.replace(styleTag, placeholderText);
  }
  
  return processedText;
}

/**
 * 提取表格标签
 * @param text 文本内容
 * @param xml 原始XML
 * @param placeholders 占位符集合
 * @returns 处理后的文本
 */
function extractTableTags(text: string, xml: string, placeholders: Record<string, TagPlaceholder>): string {
  let processedText = text;
  
  // 表格标签的正则表达式
  const tableRegex = /<w:tbl\b[^>]*>(.*?)<\/w:tbl>/gs;
  
  // 在XML中查找表格标签
  let tableMatch;
  while ((tableMatch = tableRegex.exec(xml)) !== null) {
    const tableTag = tableMatch[0];
    
    // 创建唯一标识符
    const placeholderId = `table_${uuidv4().substring(0, 8)}`;
    const placeholderText = `<w:tbl:${placeholderId}>`;
    
    // 创建占位符对象
    placeholders[placeholderId] = {
      id: placeholderId,
      type: 'table',
      originalTag: tableTag,
      position: {
        start: tableMatch.index,
        end: tableMatch.index + tableTag.length
      }
    };
    
    // 替换文本中的表格标签（如果存在）
    processedText = processedText.replace(tableTag, placeholderText);
  }
  
  return processedText;
}

/**
 * 提取图片标签
 * @param text 文本内容
 * @param xml 原始XML
 * @param placeholders 占位符集合
 * @returns 处理后的文本
 */
function extractImageTags(text: string, xml: string, placeholders: Record<string, TagPlaceholder>): string {
  let processedText = text;
  
  // 图片标签的正则表达式
  const imageRegex = /<w:drawing\b[^>]*>(.*?)<\/w:drawing>/gs;
  
  // 在XML中查找图片标签
  let imageMatch;
  while ((imageMatch = imageRegex.exec(xml)) !== null) {
    const imageTag = imageMatch[0];
    
    // 创建唯一标识符
    const placeholderId = `image_${uuidv4().substring(0, 8)}`;
    const placeholderText = `<w:drawing:${placeholderId}>`;
    
    // 创建占位符对象
    placeholders[placeholderId] = {
      id: placeholderId,
      type: 'image',
      originalTag: imageTag,
      position: {
        start: imageMatch.index,
        end: imageMatch.index + imageTag.length
      }
    };
    
    // 替换文本中的图片标签（如果存在）
    processedText = processedText.replace(imageTag, placeholderText);
  }
  
  return processedText;
}

/**
 * 将文本分割成句子
 * @param text 文本内容
 * @returns 句子数组
 */
function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) {
    return [];
  }
  
  // 使用正则表达式分割句子
  // 考虑中英文标点符号
  const sentenceRegex = /([.!?。！？\n]+\s*)/g;
  const sentences = text.split(sentenceRegex).filter(s => s.trim());
  
  // 合并句子和标点
  const result: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const punctuation = sentences[i + 1] || '';
    result.push((sentence + punctuation).trim());
  }
  
  return result;
}

/**
 * 获取Word文档结构
 * @param filePath Word文档路径
 * @returns 文档结构信息
 */
async function getDocxStructure(filePath: string): Promise<{
  success: boolean;
  structure?: any;
  error?: string;
}> {
  try {
    // 读取文件
    const data = fs.readFileSync(filePath);
    
    // 使用JSZip解压文件
    const zip = new JSZip();
    const contents = await zip.loadAsync(data);
    
    // 获取文件列表
    const fileList = Object.keys(contents.files);
    
    // 获取文档主要内容 (word/document.xml)
    const documentXml = await contents.file('word/document.xml')?.async('string') || '';
    
    // 获取样式信息 (word/styles.xml)
    const stylesXml = await contents.file('word/styles.xml')?.async('string') || '';
    
    // 简单解析文档结构
    const structure = {
      files: fileList,
      hasDocumentXml: !!documentXml,
      hasStylesXml: !!stylesXml,
      paragraphs: documentXml ? extractParagraphs(documentXml) : [],
      mediaFiles: fileList.filter(file => file.startsWith('word/media/')).map(file => path.basename(file))
    };
    
    return {
      success: true,
      structure
    };
  } catch (error) {
    console.error('获取Word文档结构失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 预处理Word文档内容
 * @param filePath Word文档路径
 * @param savePath 可选的保存路径
 * @returns 预处理结果
 */
async function preprocessDocx(filePath: string, savePath?: string): Promise<{
  success: boolean;
  segments?: TextSegment[];
  placeholders?: Record<string, TagPlaceholder>;
  outputDir?: string;
  error?: string;
}> {
  try {
    // 读取文件
    const data = fs.readFileSync(filePath);
    
    // 使用JSZip解压文件
    const zip = new JSZip();
    const contents = await zip.loadAsync(data);
    
    // 创建保存解析结果的目录
    const fileName = path.basename(filePath, '.docx');
    let outputDir;
    
    if (savePath && fs.existsSync(savePath)) {
      // 使用用户设置的保存路径
      outputDir = path.join(savePath, `${fileName}_preprocessed`);
    } else {
      // 使用默认路径
      outputDir = path.join(process.cwd(), `${fileName}_preprocessed`);
    }
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 获取文档主要内容 (word/document.xml)
    const documentXml = await contents.file('word/document.xml')?.async('string') || '';
    if (!documentXml) {
      return {
        success: false,
        error: '无法读取文档内容'
      };
    }
    
    // 预处理文档内容
    const processedContent = await preprocessDocumentContent(documentXml);
    
    // 保存预处理结果 - 只保存必要的文件
    fs.writeFileSync(
      path.join(outputDir, 'processed_segments.json'),
      JSON.stringify(processedContent.segments, null, 2)
    );
    
    // 不再保存placeholders.json和processed_text.txt，除非是调试模式
    
    return {
      success: true,
      segments: processedContent.segments,
      placeholders: processedContent.placeholders,
      outputDir
    };
  } catch (error) {
    console.error('预处理Word文档内容时出错:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 设置Word文档解析处理程序
 * @param logger 日志对象
 */
export function setupDocxParserHandlers(logger: Logger): void {
  // 解析Word文档
  ipcMain.handle('parse-docx', async (_, filePath) => {
    try {
      logger.info(`接收到解析Word文档请求: ${filePath}`);
      return await parseDocx(filePath);
    } catch (error) {
      logger.error('处理解析Word文档请求失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  
  // 获取Word文档结构
  ipcMain.handle('get-docx-structure', async (_, filePath) => {
    try {
      logger.info(`接收到获取Word文档结构请求: ${filePath}`);
      return await getDocxStructure(filePath);
    } catch (error) {
      logger.error('处理获取Word文档结构请求失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  
  // 预处理Word文档内容
  ipcMain.handle('preprocess-docx', async (_, filePath, savePath) => {
    try {
      logger.info(`接收到预处理Word文档请求: ${filePath}`);
      if (savePath) {
        logger.info(`使用自定义保存路径: ${savePath}`);
      }
      return await preprocessDocx(filePath, savePath);
    } catch (error) {
      logger.error('处理预处理Word文档请求失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
} 