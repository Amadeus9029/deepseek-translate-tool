/**
 * 文件处理模块
 * 处理文件的打开、读取、保存等操作
 */

import { app, dialog, ipcMain, shell } from 'electron'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import * as mammoth from 'mammoth'
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  BorderStyle,
  ImageRun
} from 'docx'
import { Logger } from '../utils/logger'
import JSZip from 'jszip'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { TranslationConfig } from '@/services/DocumentTranslator'

// 定义翻译后的文本段落接口
interface TranslatedSegment {
  id: string;
  type: 'paragraph' | 'run' | 'sentence';
  text: string;
  translatedText: string;
  originalXml?: string;
  placeholders?: any[];
}

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

// 移除了readOllamaConfig函数，配置由渲染进程传递

/**
 * 调用AI模型进行翻译（支持Ollama和Deepseek API）
 * @param text 要翻译的文本
 * @param config 翻译配置
 * @param sourceLang 源语言
 * @param targetLang 目标语言
 * @returns 翻译结果
 */
async function translateText(
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
        // 使用Ollama API
        console.log(`使用Ollama模型 ${config.model} 翻译文本...`);
        
        // 构建请求数据
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
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        };
        
        // 解析URL
        const url = new URL(`${config.url}/api/chat`);
        
        // 请求选项
        const options = {
          hostname: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          family: 4 // 强制使用 IPv4
        };
        
        // 选择 http 或 https 模块
        const requestModule = url.protocol === 'https:' ? https : http;
        
        // 发送请求
        const req = requestModule.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              // 尝试解析JSON
              const jsonData = JSON.parse(data);
              console.log(`Ollama响应成功`);
              
              // 提取翻译结果
              if (jsonData.message && typeof jsonData.message.content === 'string') {
                // 标准格式
                resolve(cleanTranslationOutput(jsonData.message.content.trim()));
              } else if (jsonData.response && typeof jsonData.response === 'string') {
                // 替代格式1
                resolve(cleanTranslationOutput(jsonData.response.trim()));
              } else if (jsonData.content && typeof jsonData.content === 'string') {
                // 替代格式2
                resolve(cleanTranslationOutput(jsonData.content.trim()));
              } else if (typeof jsonData === 'string') {
                // 纯文本响应
                resolve(cleanTranslationOutput(jsonData.trim()));
              } else {
                // 尝试从对象中找到任何可能的文本内容
                const extractedText = extractTextFromResponse(jsonData);
                if (extractedText) {
                  resolve(cleanTranslationOutput(extractedText));
                } else {
                  reject(new Error('无效的响应格式'));
                }
              }
            } catch (parseErr) {
              // 如果无法解析为JSON，则返回原始文本
              if (data && typeof data === 'string') {
                resolve(cleanTranslationOutput(data.trim()));
              } else {
                reject(new Error('无效的响应数据'));
              }
            }
          });
        });
        
        req.on('error', (err) => {
          reject(new Error(`请求失败: ${err.message}`));
        });
        
        // 发送请求数据
        req.write(JSON.stringify(requestData));
        req.end();
      } else {
        // 使用Deepseek API
        console.log(`使用Deepseek API 翻译文本...`);
        
        // 构建请求数据
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
        
        // Deepseek API请求选项
        const options = {
          hostname: 'api.deepseek.com',
          port: 443,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          }
        };
        
        // 发送请求
        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              // 尝试解析JSON
              const jsonData = JSON.parse(data);
              console.log(`Deepseek API响应成功`);
              
              // 提取翻译结果
              if (jsonData.choices && jsonData.choices.length > 0 && jsonData.choices[0].message) {
                const content = jsonData.choices[0].message.content;
                if (typeof content === 'string') {
                  resolve(cleanTranslationOutput(content.trim()));
                } else {
                  reject(new Error('无效的响应内容格式'));
                }
              } else if (jsonData.error) {
                reject(new Error(`API错误: ${jsonData.error.message || JSON.stringify(jsonData.error)}`));
              } else {
                reject(new Error('无法从响应中提取翻译结果'));
              }
            } catch (parseErr) {
              reject(new Error(`解析响应失败: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`));
            }
          });
        });
        
        req.on('error', (err) => {
          reject(new Error(`Deepseek API请求失败: ${err.message}`));
        });
        
        // 发送请求数据
        req.write(JSON.stringify(requestData));
        req.end();
      }
    } catch (err) {
      reject(new Error(`请求异常: ${err instanceof Error ? err.message : String(err)}`));
    }
  });
}

/**
 * 清理翻译输出，移除思考内容和其他非翻译内容
 * @param text 原始翻译文本
 * @returns 清理后的翻译文本
 */
function cleanTranslationOutput(text: string): string {
  // 移除提示词规则部分
  let result = text.replace(/【.*?要求】[\s\S]*?(?=\n\n|$)/, '');
  
  // 移除各种标记
  result = result.replace(/【.*?】.*?\n/g, '');
  result = result.replace(/【.*?】/g, '');
  
  // 移除术语表、原文等标记
  result = result.replace(/术语表：[\s\S]*?(?=\n\n|$)/g, '');
  result = result.replace(/原文：[\s\S]*?(?=\n\n|$)/g, '');
  result = result.replace(/译文：/g, '');
  result = result.replace(/翻译：/g, '');
  result = result.replace(/翻译结果：/g, '');
  
  // 移除数字列表（如1. 2. 3.）
  result = result.replace(/^\d+\.\s.*?(?:\n|$)/gm, '');
  
  // 移除冒号开头的行
  result = result.replace(/^[^:：]*[:：].*?(?:\n|$)/gm, '');
  
  // 检查是否包含明显的解释性内容标记
  const hasExplanation = /注[:：]|备注[:：]|思考[:：]|解释[:：]|说明[:：]|Note[:：]|原文[:：]|原句[:：]|翻译[:：]|译文[:：]|Translation[:：]/i.test(result);
  
  // 如果包含解释性内容，尝试提取实际翻译部分
  if (hasExplanation) {
    // 移除 <think> 标签及其内容
    result = result.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    // 处理"原文/翻译"格式
    const originalTranslationPattern = /^.*?原文[：:](.*?)\n.*?翻译[：:](.*)/is;
    const match = result.match(originalTranslationPattern);
    if (match && match[2]) {
      return match[2].trim();
    }
    
    // 处理"Translation:"格式
    const translationPattern = /^.*?Translation[：:](.*)/is;
    const translationMatch = result.match(translationPattern);
    if (translationMatch && translationMatch[1]) {
      return translationMatch[1].trim();
    }
    
    // 处理"翻译结果:"格式
    const resultPattern = /^.*?翻译结果[：:](.*)/is;
    const resultMatch = result.match(resultPattern);
    if (resultMatch && resultMatch[1]) {
      return resultMatch[1].trim();
    }
    
    // 处理"译文:"格式
    const translatedPattern = /^.*?译文[：:](.*)/is;
    const translatedMatch = result.match(translatedPattern);
    if (translatedMatch && translatedMatch[1]) {
      return translatedMatch[1].trim();
    }
    
    // 如果有注释或说明，尝试删除它们
    result = result.replace(/^注[:：].*?\n/ig, '');
    result = result.replace(/^备注[:：].*?\n/ig, '');
    result = result.replace(/^说明[:：].*?\n/ig, '');
  }
  
  return result.trim();
}

/**
 * 从响应对象中提取文本内容
 * @param response 响应对象
 * @returns 提取的文本内容
 */
function extractTextFromResponse(response: any): string | null {
  try {
    // 递归查找对象中的字符串属性
    const findStringProperties = (obj: any, maxDepth: number = 3, currentDepth: number = 0): string[] => {
      if (currentDepth > maxDepth) return [];
      if (!obj || typeof obj !== 'object') return [];
      
      let results: string[] = [];
      
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          
          if (typeof value === 'string' && value.trim().length > 0) {
            // 忽略可能是ID或其他非内容的短字符串
            if (value.length > 10 || key.toLowerCase().includes('text') || key.toLowerCase().includes('content')) {
              results.push(value);
            }
          } else if (typeof value === 'object' && value !== null) {
            // 递归查找嵌套对象
            results = results.concat(findStringProperties(value, maxDepth, currentDepth + 1));
          }
        }
      }
      
      return results;
    };
    
    const stringProperties = findStringProperties(response);
    
    // 选择最长的字符串，假设它最可能是翻译结果
    if (stringProperties.length > 0) {
      return stringProperties.reduce((longest, current) => 
        current.length > longest.length ? current : longest, stringProperties[0]);
    }
    
    return null;
  } catch (error) {
    console.error('提取文本内容失败:', error);
    return null;
  }
}

/**
 * 批量翻译Word文档内容
 * @param options 翻译选项
 * @returns 翻译结果
 */
async function translateDocxContent(options: {
  segmentsFilePath: string;
  sourceLang?: string;
  targetLang?: string;
  config: TranslationConfig;
}): Promise<{
  success: boolean;
  translatedSegments?: TranslatedSegment[];
  outputPath?: string;
  error?: string;
}> {
  try {
    const { segmentsFilePath, sourceLang = '英语', targetLang = '中文', config } = options;
    
    console.log(`开始批量翻译Word文档内容: ${segmentsFilePath}`);
    console.log(`源语言: ${sourceLang}, 目标语言: ${targetLang}`);
    console.log(`使用翻译配置: 模型=${config.model}, 使用Ollama=${config.useOllama}`);
    
    // 验证文件路径
    if (!segmentsFilePath || typeof segmentsFilePath !== 'string') {
      return {
        success: false,
        error: '无效的段落文件路径'
      };
    }

    // 读取预处理后的段落文件
    if (!fs.existsSync(segmentsFilePath)) {
      console.error(`段落文件不存在: ${segmentsFilePath}`);
      return {
        success: false,
        error: '段落文件不存在'
      };
    }
    
    const segmentsData = fs.readFileSync(segmentsFilePath, 'utf-8');
    let segments;
    try {
      segments = JSON.parse(segmentsData);
      console.log(`成功解析段落数据，共 ${segments.length} 个段落`);
    } catch (parseError) {
      console.error('解析段落数据失败:', parseError);
      return {
        success: false,
        error: `解析段落数据失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      };
    }
    
    // 翻译每个段落
    const translatedSegments: TranslatedSegment[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // 跳过空段落
      if (!segment.text || !segment.text.trim()) {
        translatedSegments.push({
          ...segment,
          translatedText: ''
        });
        console.log(`跳过空段落 ${i + 1}/${segments.length}: ${segment.id}`);
        continue;
      }
      
      console.log(`翻译段落 ${i + 1}/${segments.length}: ${segment.id}`);
      console.log(`原文: ${segment.text}`); // 显示完整原文
      
      // 添加重试逻辑，最多尝试3次
      let translatedText = '';
      let success = false;
      let lastError: unknown = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`第 ${attempt} 次尝试翻译段落 ${segment.id}...`);
          }
          
          translatedText = await translateText(
            segment.text,
            config,
            sourceLang,
            targetLang
          );
          
          console.log(`译文: ${translatedText}`); // 显示完整译文
          success = true;
          break; // 翻译成功，跳出重试循环
        } catch (error) {
          lastError = error;
          console.error(`翻译段落 ${segment.id} 失败 (尝试 ${attempt}/3):`, error);
          
          if (attempt < 3) {
            // 等待一小段时间再重试
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (success) {
        translatedSegments.push({
          ...segment,
          translatedText
        });
      } else {
        console.error(`翻译段落 ${segment.id} 失败，已达到最大重试次数`);
        
        // 使用原文作为翻译结果
        translatedSegments.push({
          ...segment,
          translatedText: segment.text // 使用原文
        });
      }
    }
    
    // 不再保存翻译结果到文件系统，直接返回内存中的结果
    return {
      success: true,
      translatedSegments
    };
  } catch (error) {
    console.error('批量翻译Word文档内容失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 读取Word文档结构
 * @param filePath Word文档路径
 * @returns 文档结构，包含文本节点
 */
async function readDocxStructure(filePath: string): Promise<{ success: boolean; textNodes?: any[]; error?: string }> {
  try {
    // 使用mammoth提取文本
    const result = await mammoth.extractRawText({ path: filePath });
    const paragraphs = result.value.split('\n').filter(p => p.trim());
    
    // 创建文本节点数组
    const textNodes = paragraphs.map((text, index) => ({
      id: `p${index}`,
      type: 'paragraph',
      text: text.trim()
    }));
    
    return {
      success: true,
      textNodes
    };
  } catch (error) {
    console.error("读取Word文档结构失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 保存Word文档结构
 * @param options 保存选项
 * @returns 保存结果
 */
async function saveDocxStructure(options: { filePath: string; textNodes: any[]; targetLanguage: string }): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  try {
    // 读取设置
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let savePath = app.getPath('userData');
    
    if (await fsExtra.pathExists(settingsPath)) {
      const settings = await fsExtra.readJSON(settingsPath);
      if (settings.savePath) {
        savePath = settings.savePath;
      }
    }
    
    // 使用用户设置的存储路径
    const outputPath = path.join(savePath, options.filePath);
    
    // 确保目录存在
    await fsExtra.ensureDir(path.dirname(outputPath));
    
    // 创建文档
    const paragraphs = options.textNodes.map(node => {
      return new Paragraph({
        children: [
          new TextRun({
            text: node.text,
            size: 24
          })
        ]
      });
    });
    
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    });
    
    // 保存文档
    const buffer = await Packer.toBuffer(doc);
    await fsExtra.writeFile(outputPath, buffer);
    
    return {
      success: true,
      outputPath
    };
  } catch (error) {
    console.error("保存Word文档结构失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}



/**
 * 转义正则表达式中的特殊字符
 * @param string 要转义的字符串
 * @returns 转义后的字符串
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 还原翻译后的Word文档
 * @param options 还原选项
 * @returns 还原结果
 */
async function restoreTranslatedDocx(options: {
  originalFilePath: string;
  translatedSegments: TranslatedSegment[];
  outputFileName: string;
  savePath?: string;
}): Promise<{
  success: boolean;
  outputPath?: string;
  error?: string;
}> {
  try {
    console.log(`开始还原翻译后的Word文档`);
    console.log(`原始文件: ${options.originalFilePath}`);
    console.log(`翻译段落数量: ${options.translatedSegments.length}`);
    
    // 1. 读取原始Word文档
    if (!fsExtra.existsSync(options.originalFilePath)) {
      return {
        success: false,
        error: `原始文件不存在: ${options.originalFilePath}`
      };
    }
    
    // 2. 确定输出目录 - 使用用户设置的路径或默认路径
    const fileName = path.basename(options.originalFilePath, '.docx');
    let outputDir;
    
    if (options.savePath && fsExtra.existsSync(options.savePath)) {
      // 使用用户设置的保存路径
      outputDir = path.join(options.savePath, `${fileName}_translated`);
    } else {
      // 使用默认路径
      outputDir = path.join(process.cwd(), `${fileName}_translated`);
    }
    
    // 确保输出目录存在
    if (!fsExtra.existsSync(outputDir)) {
      fsExtra.mkdirSync(outputDir, { recursive: true });
    }
    
    // 3. 确定输出文件路径
    const outputPath = path.join(outputDir, options.outputFileName);
    
    // 4. 首先尝试直接复制原始文档，然后修改内容
    try {
      // 复制原始文件到目标位置
      fsExtra.copyFileSync(options.originalFilePath, outputPath);
      console.log(`已复制原始文档到: ${outputPath}`);
      
      // 读取复制后的文件
      const data = fsExtra.readFileSync(outputPath);
      
      // 使用JSZip解压文件
      const zip = new JSZip();
      const contents = await zip.loadAsync(data);
      
      // 获取文档主要内容 (word/document.xml)
      let documentXml = await contents.file('word/document.xml')?.async('string') || '';
      if (!documentXml) {
        throw new Error('无法读取文档内容');
      }
      
      // 创建段落ID到翻译文本的映射，便于查找
      const translationMap = new Map<string, string>();
      options.translatedSegments.forEach(segment => {
        if (segment.id && segment.translatedText) {
          translationMap.set(segment.id, segment.translatedText);
        }
      });
      
      // 使用更安全的方式替换文本
      // 先解析所有段落
      const paragraphs: Array<{
        fullXml: string;
        textContent: string;
        translatedText?: string;
        wasReplaced: boolean;
      }> = [];
      
      // 提取所有段落
      const paragraphRegex = /<w:p\b[^>]*>.*?<\/w:p>/gs;
      let paragraphMatch;
      while ((paragraphMatch = paragraphRegex.exec(documentXml)) !== null) {
        const paragraphXml = paragraphMatch[0];
        
        // 提取段落中的所有文本
        const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
        let textContent = '';
        let textMatch;
        
        while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
          textContent += textMatch[1];
        }
        
        paragraphs.push({
          fullXml: paragraphXml,
          textContent,
          wasReplaced: false
        });
      }
      
      // 添加调试输出，输出段落数量和翻译段落数量
      console.log(`文档中共有 ${paragraphs.length} 个段落`);
      console.log(`翻译结果中共有 ${options.translatedSegments.length} 个段落`);
      
      // 输出前5个段落的内容，便于调试
      console.log('文档中的前5个段落:');
      paragraphs.slice(0, 5).forEach((p, i) => {
        console.log(`段落${i+1}: "${p.textContent.substring(0, 50)}${p.textContent.length > 50 ? '...' : ''}"`);
      });
      
      console.log('翻译结果中的前5个段落:');
      options.translatedSegments.slice(0, 5).forEach((s, i) => {
        console.log(`段落${i+1}: "${s.text.substring(0, 50)}${s.text.length > 50 ? '...' : ''}" => "${s.translatedText?.substring(0, 50)}${s.translatedText && s.translatedText.length > 50 ? '...' : ''}"`);
      });
      
      // 改进匹配逻辑，尝试多种匹配方式
      let replacementCount = 0;
      
      for (const segment of options.translatedSegments) {
        if (!segment.text || !segment.translatedText) continue;
        
        // 标准化文本，移除多余空格，便于匹配
        const normalizedSegmentText = segment.text.trim().replace(/\s+/g, ' ');
        
        let matched = false;
        
        // 1. 首先尝试精确匹配
        for (const paragraph of paragraphs) {
          if (paragraph.wasReplaced) continue; // 跳过已替换的段落
          
          const normalizedParagraphText = paragraph.textContent.trim().replace(/\s+/g, ' ');
          
          if (normalizedParagraphText === normalizedSegmentText) {
            paragraph.translatedText = segment.translatedText;
            paragraph.wasReplaced = true;
            replacementCount++;
            matched = true;
            break;
          }
        }
        
        // 2. 如果精确匹配失败，尝试包含匹配（段落包含翻译段落文本）
        if (!matched) {
          for (const paragraph of paragraphs) {
            if (paragraph.wasReplaced) continue; // 跳过已替换的段落
            
            const normalizedParagraphText = paragraph.textContent.trim().replace(/\s+/g, ' ');
            
            if (normalizedParagraphText.includes(normalizedSegmentText) && 
                normalizedSegmentText.length > 10) { // 只匹配长度大于10的文本，避免误匹配
              paragraph.translatedText = segment.translatedText;
              paragraph.wasReplaced = true;
              replacementCount++;
              console.log(`使用包含匹配成功: "${normalizedSegmentText.substring(0, 30)}..."`);
              matched = true;
              break;
            }
          }
        }
        
        // 3. 如果前两种方法都失败，尝试模糊匹配（移除标点符号和特殊字符后匹配）
        if (!matched) {
          const simplifiedSegmentText = normalizedSegmentText
            .replace(/[.,!?;:()[\]{}""''「」『』\-—–]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          for (const paragraph of paragraphs) {
            if (paragraph.wasReplaced) continue; // 跳过已替换的段落
            
            const simplifiedParagraphText = paragraph.textContent
              .replace(/[.,!?;:()[\]{}""''「」『』\-—–]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
              
            if (simplifiedParagraphText === simplifiedSegmentText) {
              paragraph.translatedText = segment.translatedText;
              paragraph.wasReplaced = true;
              replacementCount++;
              console.log(`使用模糊匹配成功: "${simplifiedSegmentText.substring(0, 30)}..."`);
              matched = true;
              break;
            }
          }
        }
      }
      
      console.log(`找到 ${replacementCount} 个匹配的段落`);
      
      // 如果匹配数量为0，尝试使用第二种方法
      if (replacementCount === 0) {
        console.log('未找到匹配段落，尝试使用第二种匹配方法...');
        throw new Error('未找到匹配段落，尝试使用第二种方法');
      }
      
      // 执行替换
      let newDocumentXml = documentXml;
      for (const paragraph of paragraphs) {
        if (!paragraph.wasReplaced || !paragraph.translatedText) continue;
        
        // 创建安全的替换版本
        let modifiedParagraph = paragraph.fullXml;
        const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
        
        // 收集所有文本节点
        const textMatches: Array<{
          fullMatch: string;
          textContent: string;
          startIndex: number;
          endIndex: number;
        }> = [];
        
        let textMatch;
        while ((textMatch = textRegex.exec(paragraph.fullXml)) !== null) {
          textMatches.push({
            fullMatch: textMatch[0],
            textContent: textMatch[1],
            startIndex: textMatch.index,
            endIndex: textMatch.index + textMatch[0].length
          });
        }
        
        // 如果只有一个文本节点，直接替换
        if (textMatches.length === 1) {
          const safeTranslatedText = paragraph.translatedText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
            
          modifiedParagraph = modifiedParagraph.replace(
            textMatches[0].fullMatch,
            textMatches[0].fullMatch.replace(textMatches[0].textContent, safeTranslatedText)
          );
        } 
        // 如果有多个文本节点，将第一个非空节点替换为翻译文本，其余置空
        else if (textMatches.length > 1) {
          // 找到第一个非空文本节点
          const nonEmptyIndex = textMatches.findIndex(m => m.textContent.trim().length > 0);
          if (nonEmptyIndex >= 0) {
            // 创建一个新的段落XML，逐个替换文本节点
            let newParagraphXml = paragraph.fullXml;
            
            for (let i = 0; i < textMatches.length; i++) {
              const match = textMatches[i];
              let replacement;
              
              if (i === nonEmptyIndex) {
                // 替换为翻译文本
                const safeTranslatedText = paragraph.translatedText
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&apos;');
                  
                replacement = match.fullMatch.replace(match.textContent, safeTranslatedText);
              } else {
                // 其他节点置空
                replacement = match.fullMatch.replace(match.textContent, '');
              }
              
              // 替换当前节点
              newParagraphXml = newParagraphXml.replace(match.fullMatch, replacement);
            }
            
            modifiedParagraph = newParagraphXml;
          }
        }
        
        // 在文档XML中替换段落
        newDocumentXml = newDocumentXml.replace(paragraph.fullXml, modifiedParagraph);
      }
      
      // 更新文档内容
      contents.file('word/document.xml', newDocumentXml);
      
      // 生成新的docx文件
      const outputBuffer = await contents.generateAsync({ type: 'nodebuffer' });
      fsExtra.writeFileSync(outputPath, outputBuffer);
      
      console.log(`翻译后的文档已保存至: ${outputPath}`);
    
    return {
      success: true,
        outputPath
    };
  } catch (error) {
      console.error('使用JSZip还原文档失败:', error);
      
      // 如果第一种方法失败，尝试第二种方法：完全复制原文档并逐一替换文本
      try {
        console.log('尝试使用第二种方法...');
        
        // 重新复制原始文件
        fsExtra.copyFileSync(options.originalFilePath, outputPath);
        
        // 使用docx库打开文档
        const buffer = fsExtra.readFileSync(outputPath);
        const zip = new JSZip();
        const contents = await zip.loadAsync(buffer);
        
        // 获取document.xml
        const documentXml = await contents.file('word/document.xml')?.async('string') || '';
        if (!documentXml) {
          throw new Error('无法读取文档内容');
        }
        
        // 创建一个简单的文本替换映射
        const replacements: Array<[string, string]> = [];
        for (const segment of options.translatedSegments) {
          if (segment.text && segment.translatedText) {
            // 标准化文本，移除多余空格
            const normalizedText = segment.text.trim().replace(/\s+/g, ' ');
            const normalizedTranslatedText = segment.translatedText
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
            
            replacements.push([
              normalizedText,
              normalizedTranslatedText
            ]);
          }
        }
        
        // 按文本长度降序排序，避免短文本替换导致的问题
        replacements.sort((a, b) => b[0].length - a[0].length);
        
        // 执行替换
        let newContent = documentXml;
        let replaceCount = 0;
        
        // 输出前几个替换项，便于调试
        console.log('替换映射示例:');
        replacements.slice(0, 3).forEach((r, i) => {
          console.log(`替换项${i+1}: "${r[0].substring(0, 30)}${r[0].length > 30 ? '...' : ''}" => "${r[1].substring(0, 30)}${r[1].length > 30 ? '...' : ''}"`);
        });
        
        // 更灵活的替换方法
        for (const [source, target] of replacements) {
          // 1. 尝试直接替换w:t标签中的文本
          const exactRegex = new RegExp(`(<w:t[^>]*>)(${escapeRegExp(source)})(<\\/w:t>)`, 'g');
          const beforeCount = replaceCount;
          
          newContent = newContent.replace(exactRegex, (match, prefix, text, suffix) => {
            replaceCount++;
            return `${prefix}${target}${suffix}`;
          });
          
          // 如果直接替换成功，继续下一个
          if (replaceCount > beforeCount) continue;
          
          // 2. 如果直接替换失败，尝试跨多个w:t标签匹配
          // 这种情况下，文本可能被分割在多个w:t标签中
          // 首先尝试找到包含源文本的段落
          const paragraphRegex = /<w:p\b[^>]*>.*?<\/w:p>/gs;
          let paragraphMatch;
          
          while ((paragraphMatch = paragraphRegex.exec(newContent)) !== null) {
            const paragraphXml = paragraphMatch[0];
            
            // 提取段落中的纯文本
            const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
            let paragraphText = '';
            let textMatches: Array<{
              fullMatch: string;
              text: string;
              start: number;
              end: number;
            }> = [];
            let textMatch;
            
            while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
              paragraphText += textMatch[1];
              textMatches.push({
                fullMatch: textMatch[0],
                text: textMatch[1],
                start: textMatch.index,
                end: textMatch.index + textMatch[0].length
              });
            }
            
            // 标准化段落文本
            const normalizedParagraphText = paragraphText.trim().replace(/\s+/g, ' ');
            
            // 如果段落包含源文本
            if (normalizedParagraphText.includes(source) && source.length > 10) {
              // 找到第一个非空的w:t标签
              const nonEmptyIndex = textMatches.findIndex(m => m.text.trim().length > 0);
              
              if (nonEmptyIndex >= 0) {
                // 替换这个标签的内容
                let newParagraphXml = paragraphXml;
                const match = textMatches[nonEmptyIndex];
                
                newParagraphXml = newParagraphXml.replace(
                  match.fullMatch,
                  match.fullMatch.replace(match.text, target)
                );
                
                // 清空其他标签的内容
                for (let i = 0; i < textMatches.length; i++) {
                  if (i !== nonEmptyIndex) {
                    const m = textMatches[i];
                    newParagraphXml = newParagraphXml.replace(
                      m.fullMatch,
                      m.fullMatch.replace(m.text, '')
                    );
                  }
                }
                
                // 替换整个段落
                newContent = newContent.replace(paragraphXml, newParagraphXml);
                replaceCount++;
                console.log(`使用段落级替换成功: "${source.substring(0, 30)}${source.length > 30 ? '...' : ''}"`);
                break;
              }
            }
          }
        }
        
        console.log(`第二种方法替换了 ${replaceCount} 处文本`);
        
        // 更新文档内容
        contents.file('word/document.xml', newContent);
        
        // 生成新的docx文件
        const outputBuffer = await contents.generateAsync({ type: 'nodebuffer' });
        fsExtra.writeFileSync(outputPath, outputBuffer);
        
        console.log(`翻译后的文档已保存至: ${outputPath}`);
        
        return {
          success: true,
          outputPath
        };
      } catch (error2) {
        console.error('第二种方法也失败:', error2);
        
        // 最后的备选方案：创建一个简单的新文档
        try {
          console.log('尝试创建简单文档作为备选方案...');
          
          // 创建段落
          const paragraphs = options.translatedSegments
            .filter(segment => segment.translatedText)
            .map(segment => {
              return new Paragraph({
                children: [
                  new TextRun({
                    text: segment.translatedText || '',
                    size: 24
                  })
                ]
              });
            });
          
          // 创建文档
          const doc = new Document({
            sections: [
              {
                properties: {},
                children: paragraphs
              }
            ]
          });
          
          // 保存文档
          const buffer = await Packer.toBuffer(doc);
          fsExtra.writeFileSync(outputPath, buffer);
          
          console.log(`已创建简化版翻译文档: ${outputPath}`);
          console.log('注意: 此版本不包含原始文档的格式和样式');
    
    return {
      success: true,
            outputPath
          };
        } catch (fallbackError) {
          console.error('创建备选文档也失败:', fallbackError);
          throw error; // 抛出原始错误
        }
      }
    }
  } catch (error) {
    console.error('还原翻译后的Word文档失败:', error);
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
  const paragraphRegex = /<w:p\b[^>]*>.*?<\/w:p>/gs;
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
  let result = xmlContent.replace(/<w:commentRangeStart\b[^>]*>.*?<\/w:commentRangeStart>/gs, '');
  result = result.replace(/<w:commentRangeEnd\b[^>]*>.*?<\/w:commentRangeEnd>/gs, '');
  // 移除批注内容
  result = result.replace(/<w:comment\b[^>]*>.*?<\/w:comment>/gs, '');
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
 * 提取带XML的段落
 * @param xmlContent XML内容
 * @returns 段落数组，包含文本和XML
 */
function extractParagraphsWithXml(xmlContent: string): Array<{ text: string; xml: string }> {
  const paragraphs: Array<{ text: string; xml: string }> = [];
  
  // 使用正则表达式匹配段落
  const paragraphRegex = /<w:p\b[^>]*>.*?<\/w:p>/gs;
  const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
  
  let paragraphMatch;
  while ((paragraphMatch = paragraphRegex.exec(xmlContent)) !== null) {
    const paragraphXml = paragraphMatch[0];
    let textContent = '';
    
    // 提取段落中的所有文本
    let textMatch;
    while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
      textContent += textMatch[1];
    }
    
    if (textContent.trim()) {
      paragraphs.push({
        text: textContent,
        xml: paragraphXml
      });
    }
  }
  
  return paragraphs;
}

/**
 * 提取和替换标签
 * @param text 文本内容
 * @param xml XML内容
 * @returns 处理后的文本和提取的占位符
 */
function extractAndReplaceTags(text: string, xml: string): {
  text: string;
  extractedPlaceholders: Record<string, TagPlaceholder>;
} {
  // 初始化结果
  let processedText = text;
  const extractedPlaceholders: Record<string, TagPlaceholder> = {};
  
  // 提取样式标签
  processedText = extractStyleTags(processedText, xml, extractedPlaceholders);
  
  // 提取表格标签
  processedText = extractTableTags(processedText, xml, extractedPlaceholders);
  
  // 提取图片标签
  processedText = extractImageTags(processedText, xml, extractedPlaceholders);
  
  return {
    text: processedText,
    extractedPlaceholders
  };
}

/**
 * 提取样式标签
 * @param text 文本内容
 * @param xml XML内容
 * @param placeholders 占位符集合
 * @returns 处理后的文本
 */
function extractStyleTags(text: string, xml: string, placeholders: Record<string, TagPlaceholder>): string {
  // 这里简化处理，实际应用中应该使用XML解析器
  // 查找样式相关的标签，如粗体、斜体、下划线等
  const styleRegex = /<w:rPr\b[^>]*>.*?<\/w:rPr>/gs;
  
  let processedText = text;
  let styleMatch;
  
  while ((styleMatch = styleRegex.exec(xml)) !== null) {
    const styleTag = styleMatch[0];
    const placeholderId = `style_${uuidv4().substring(0, 8)}`;
    
    // 创建占位符
    placeholders[placeholderId] = {
      id: placeholderId,
      type: 'style',
      originalTag: styleTag,
      position: {
        start: styleMatch.index,
        end: styleMatch.index + styleTag.length
      }
    };
    
    // 在实际应用中，这里应该将样式标签替换为占位符
    // 但在这个简化版本中，我们不修改文本内容
  }
  
  return processedText;
}

/**
 * 提取表格标签
 * @param text 文本内容
 * @param xml XML内容
 * @param placeholders 占位符集合
 * @returns 处理后的文本
 */
function extractTableTags(text: string, xml: string, placeholders: Record<string, TagPlaceholder>): string {
  // 查找表格相关的标签
  const tableRegex = /<w:tbl\b[^>]*>.*?<\/w:tbl>/gs;
  
  let processedText = text;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(xml)) !== null) {
    const tableTag = tableMatch[0];
    const placeholderId = `table_${uuidv4().substring(0, 8)}`;
    
    // 创建占位符
    placeholders[placeholderId] = {
      id: placeholderId,
      type: 'table',
      originalTag: tableTag,
      position: {
        start: tableMatch.index,
        end: tableMatch.index + tableTag.length
      }
    };
    
    // 在实际应用中，这里应该将表格标签替换为占位符
    // 但在这个简化版本中，我们不修改文本内容
  }
  
  return processedText;
}

/**
 * 提取图片标签
 * @param text 文本内容
 * @param xml XML内容
 * @param placeholders 占位符集合
 * @returns 处理后的文本
 */
function extractImageTags(text: string, xml: string, placeholders: Record<string, TagPlaceholder>): string {
  // 查找图片相关的标签
  const imageRegex = /<w:drawing\b[^>]*>.*?<\/w:drawing>/gs;
  
  let processedText = text;
  let imageMatch;
  
  while ((imageMatch = imageRegex.exec(xml)) !== null) {
    const imageTag = imageMatch[0];
    const placeholderId = `image_${uuidv4().substring(0, 8)}`;
    
    // 创建占位符
    placeholders[placeholderId] = {
      id: placeholderId,
      type: 'image',
      originalTag: imageTag,
      position: {
        start: imageMatch.index,
        end: imageMatch.index + imageTag.length
      }
    };
    
    // 在实际应用中，这里应该将图片标签替换为占位符
    // 但在这个简化版本中，我们不修改文本内容
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
 * 设置文件处理程序
 * @param logger 日志对象
 */
export function setupFileHandlers(logger: Logger): void {
  // 打开文件对话框
  ipcMain.handle('open-file-dialog', async (_, options?: { filters?: any[] }) => {
    try {
      const defaultFilters = [
        { name: '字幕文件', extensions: ['srt', 'ass', 'vtt'] },
        { name: 'Excel 文件', extensions: ['xlsx', 'xls'] },
        { name: 'Word 文档', extensions: ['docx', 'doc'] },
        { name: '所有文件', extensions: ['*'] }
      ]
      
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: options?.filters || defaultFilters
      })
      
      return {
        success: true,
        filePath: !canceled && filePaths.length > 0 ? filePaths[0] : null
      }
    } catch (error) {
      logger.error('打开文件对话框失败:', error)
      return {
        success: false,
        filePath: null,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 读取Excel文件
  ipcMain.handle('read-excel-file', async (_, filePath) => {
    try {
      const workbook = XLSX.readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)
      return { success: true, data, sheetName }
    } catch (error) {
      logger.error('读取Excel文件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })

  // 读取Word文档
  ipcMain.handle('read-word-file', async (_, filePath) => {
    try {
      const result = await mammoth.extractRawText({ path: filePath })
      const paragraphs = result.value.split('\n').filter(p => p.trim())
      
      // 将段落转换为类似Excel的数据结构
      const data = paragraphs.map((paragraph, index) => ({
        [`段落${index + 1}`]: paragraph.trim()
      }))
      
      return { 
        success: true, 
        data, 
        paragraphs,
        sheetName: '文档内容'
      }
    } catch (error) {
      logger.error('读取Word文档失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })

  // 保存Excel文件
  ipcMain.handle('save-excel-file', async (_, { data, filePath, sheetName, createDir = false }) => {
    try {
      // 读取设置
      const settingsPath = path.join(app.getPath('userData'), 'settings.json')
      let savePath = app.getPath('userData')
      
      if (await fsExtra.pathExists(settingsPath)) {
        const settings = await fsExtra.readJSON(settingsPath)
        if (settings.savePath) {
          savePath = settings.savePath
        }
      }

      // 使用用户设置的存储路径
      const fileName = path.basename(filePath)
      const outputPath = path.join(savePath, fileName)

      // 如果需要创建目录
      if (createDir) {
        await fsExtra.mkdirp(path.dirname(outputPath))
      }

      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      XLSX.writeFile(workbook, outputPath)
      
      return { success: true, outputPath }
    } catch (error) {
      logger.error('保存Excel文件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })

  // 保存Word文档
  ipcMain.handle('save-word-file', async (_, { data, filePath, createDir = false }) => {
    try {
      // 读取设置
      const settingsPath = path.join(app.getPath('userData'), 'settings.json')
      let savePath = app.getPath('userData')
      
      if (await fsExtra.pathExists(settingsPath)) {
        const settings = await fsExtra.readJSON(settingsPath)
        if (settings.savePath) {
          savePath = settings.savePath
        }
      }

      // 使用用户设置的存储路径
      const fileName = path.basename(filePath)
      const outputPath = path.join(savePath, fileName)

      // 如果需要创建目录
      if (createDir) {
        await fsExtra.mkdirp(path.dirname(outputPath))
      }

      // 创建Word文档
      const doc = new Document({
        sections: [{
          properties: {},
          children: data.map((item: any) => {
            const text = Object.values(item)[0] as string
            return new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  size: 24
                })
              ]
            })
          })
        }]
      })

      // 保存文档
      const buffer = await Packer.toBuffer(doc)
      await fsExtra.writeFile(outputPath, buffer)
      
      return { success: true, outputPath }
    } catch (error) {
      logger.error('保存Word文档失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })

  // 选择文件夹
  ipcMain.handle('select-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      return {
        success: true,
        dirPath: result.canceled ? null : result.filePaths[0]
      }
    } catch (error) {
      logger.error('选择文件夹失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 重命名文件
  ipcMain.handle('rename-file', async (_, { oldPath, newPath }) => {
    try {
      // 检查源文件是否存在
      if (!await fsExtra.pathExists(oldPath)) {
        return { success: false, error: '源文件不存在' }
      }
      
      // 检查目标文件是否已存在
      if (await fsExtra.pathExists(newPath)) {
        return { success: false, error: '目标文件已存在' }
      }
      
      // 执行重命名
      await fsExtra.rename(oldPath, newPath)
      return { success: true }
    } catch (error) {
      logger.error('重命名文件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })

  // 打开文件
  ipcMain.handle('open-file', async (_, filePath) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      logger.error('打开文件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })

  // 打开文件所在文件夹
  ipcMain.handle('open-file-location', async (_, filePath) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      logger.error('打开文件位置失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })
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
  
  // 还原翻译后的Word文档
  ipcMain.handle('restore-translated-docx', async (_, options) => {
    try {
      const { originalFilePath, translatedSegments, outputFileName, savePath } = options;
      
      logger.info(`接收到还原翻译后的Word文档请求`);
      logger.info(`原始文件: ${originalFilePath}`);
      logger.info(`翻译段落数量: ${translatedSegments.length}`);
      if (savePath) {
        logger.info(`保存路径: ${savePath}`);
      }
      
      return await restoreTranslatedDocx({
        originalFilePath,
        translatedSegments,
        outputFileName,
        savePath
      });
    } catch (error) {
      logger.error('处理还原翻译后的Word文档请求失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // 路径拼接
  ipcMain.handle('join-paths', async (_, ...paths: string[]) => {
    try {
      return {
        success: true,
        path: path.join(...paths)
      }
    } catch (error) {
      logger.error('路径拼接失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 确保目录存在
  ipcMain.handle('ensure-dir', async (_, dirPath: string) => {
    try {
      await fsExtra.mkdirp(dirPath)
      return { success: true }
    } catch (error) {
      logger.error('创建目录失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
} 