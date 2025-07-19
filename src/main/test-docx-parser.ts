/**
 * Word文档解析器
 * 使用JSZip解析.docx文件中的XML内容
 */

import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

/**
 * 解析Word文档
 * @param filePath Word文档路径
 */
async function parseDocx(filePath: string): Promise<void> {
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
    
    console.log(`解析结果将保存到: ${outputDir}`);
    
    // 获取文档主要内容 (word/document.xml)
    const documentXml = await contents.file('word/document.xml')?.async('string');
    if (documentXml) {
      fs.writeFileSync(path.join(outputDir, 'document.xml'), documentXml);
      console.log('已提取 document.xml');
    } else {
      console.log('未找到 document.xml');
    }
    
    // 获取样式信息 (word/styles.xml)
    const stylesXml = await contents.file('word/styles.xml')?.async('string');
    if (stylesXml) {
      fs.writeFileSync(path.join(outputDir, 'styles.xml'), stylesXml);
      console.log('已提取 styles.xml');
    }
    
    // 获取文档关系 (word/_rels/document.xml.rels)
    const relsXml = await contents.file('word/_rels/document.xml.rels')?.async('string');
    if (relsXml) {
      fs.writeFileSync(path.join(outputDir, 'document.xml.rels'), relsXml);
      console.log('已提取 document.xml.rels');
    }
    
    // 获取文档属性 (docProps/core.xml)
    const coreXml = await contents.file('docProps/core.xml')?.async('string');
    if (coreXml) {
      fs.writeFileSync(path.join(outputDir, 'core.xml'), coreXml);
      console.log('已提取 core.xml');
    }
    
    // 获取内容类型信息 ([Content_Types].xml)
    const contentTypesXml = await contents.file('[Content_Types].xml')?.async('string');
    if (contentTypesXml) {
      fs.writeFileSync(path.join(outputDir, 'Content_Types.xml'), contentTypesXml);
      console.log('已提取 [Content_Types].xml');
    }
    
    // 获取所有文件列表
    const fileList = Object.keys(contents.files);
    fs.writeFileSync(path.join(outputDir, 'file_list.txt'), fileList.join('\n'));
    console.log('已保存文件列表');
    
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
          console.log(`已提取媒体文件: ${fileName}`);
        }
      }
    }
    
    // 分析document.xml中的段落和文本
    if (documentXml) {
      // 简单提取段落文本（不考虑格式）
      const paragraphs = extractParagraphs(documentXml);
      fs.writeFileSync(
        path.join(outputDir, 'extracted_text.txt'), 
        paragraphs.join('\n\n')
      );
      console.log(`已提取 ${paragraphs.length} 个段落的文本`);
    }
    
    console.log('Word文档解析完成');
  } catch (error) {
    console.error('解析Word文档时出错:', error);
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
 * 主函数
 */
async function main() {
  // 检查命令行参数
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('请提供Word文档路径作为参数');
    console.log('用法: node test-docx-parser.js <文档路径>');
    return;
  }
  
  const filePath = args[0];
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    return;
  }
  
  if (!filePath.toLowerCase().endsWith('.docx')) {
    console.error('只支持.docx格式文件');
    return;
  }
  
  await parseDocx(filePath);
}

// 执行主函数
main().catch(console.error); 