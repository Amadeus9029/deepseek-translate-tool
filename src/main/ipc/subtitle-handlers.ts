/**
 * 字幕处理模块
 * 处理字幕文件的读取、解析和保存
 */

import { app, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import * as chardet from 'chardet'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import { extname } from 'path'
import { SubtitleItem } from '../types/types'
import { Logger } from '../utils/logger'
import { formatTimestamp } from '../index'

/**
 * 设置字幕处理程序
 * @param logger 日志对象
 */
export function setupSubtitleHandlers(logger: Logger): void {
  // 读取字幕文件
  ipcMain.handle('read-subtitle-file', async (_, subtitlePath: string) => {
    try {
      // 检测文件编码
      const encoding = await chardet.detectFile(subtitlePath)
      const content = await fs.readFile(subtitlePath, encoding as BufferEncoding)
      
      // 根据文件扩展名选择解析方法
      const ext = extname(subtitlePath).toLowerCase()
      let subtitles: SubtitleItem[] = []

      if (ext === '.srt') {
        subtitles = await parseSrtFile(content)
      } else if (ext === '.ass') {
        subtitles = await parseAssFile(content)
      } else {
        throw new Error('不支持的字幕格式')
      }

      if (subtitles.length === 0) {
        throw new Error('未找到有效的字幕内容')
      }

      return {
        success: true,
        subtitles
      }
    } catch (error: unknown) {
      logger.error('读取字幕文件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 保存翻译后的字幕
  ipcMain.handle('save-subtitles', async (_, { subtitles, sourceFile, targetLanguage }: {
    subtitles: SubtitleItem[]
    sourceFile: string
    targetLanguage: string
  }) => {
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

      // 创建输出目录在用户设置的存储路径下
      const resultDir = path.join(savePath, 'subtitle_translations')
      await fs.mkdir(resultDir, { recursive: true })

      // 生成输出文件路径
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const outputPath = path.join(resultDir, `${path.basename(sourceFile, path.extname(sourceFile))}_${targetLanguage}_${timestamp}${path.extname(sourceFile)}`)

      // 根据字幕类型生成内容
      let content = ''
      if (subtitles[0].type === 'srt') {
        content = generateSrtContent(subtitles)
      } else if (subtitles[0].type === 'ass') {
        content = await generateAssContent(subtitles, sourceFile)
      } else {
        throw new Error('不支持的字幕格式')
      }

      // 保存文件
      await fs.writeFile(outputPath, content, 'utf8')

      return {
        success: true,
        outputPath
      }
    } catch (error: unknown) {
      logger.error('保存字幕失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}

/**
 * 解析SRT格式字幕文件
 * @param content 文件内容
 * @returns 解析后的字幕项数组
 */
async function parseSrtFile(content: string): Promise<SubtitleItem[]> {
  // 动态导入 subsrt-ts
  const subsrt = await import('subsrt-ts')
  // 解析 SRT 格式
  const parsed = subsrt.default.parse(content) as any[]
  if (!Array.isArray(parsed)) {
    throw new Error('SRT解析失败')
  }
  
  return parsed
    .filter(node => node.type === 'caption' && node.text && node.text.trim())
    .map(node => ({
      start: formatTimestamp(node.start),
      end: formatTimestamp(node.end),
      text: node.text.trim(),
      type: 'srt' as const
    }))
}

/**
 * 解析ASS格式字幕文件
 * @param content 文件内容
 * @returns 解析后的字幕项数组
 */
function parseAssFile(content: string): SubtitleItem[] {
  // 解析 ASS 格式
  const lines = content.split('\n')
  let isEvents = false
  const events: SubtitleItem[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed === '[Events]') {
      isEvents = true
      continue
    }

    if (isEvents) {
      if (trimmed.startsWith('Format:')) {
        continue
      }

      if (trimmed.startsWith('Dialogue:')) {
        const parts = trimmed.substring(9).split(',')
        if (parts.length >= 10) {
          const text = parts.slice(9).join(',').trim()
          if (text) {
            events.push({
              start: parts[1].trim(),
              end: parts[2].trim(),
              style: parts[3].trim(),
              text: text.replace(/\\N/g, '\n'),
              type: 'ass' as const
            })
          }
        }
      }
    }
  }

  return events
}

/**
 * 生成SRT格式内容
 * @param subtitles 字幕项数组
 * @returns SRT格式内容
 */
function generateSrtContent(subtitles: SubtitleItem[]): string {
  return subtitles.map((item, index) => {
    return `${index + 1}\n${item.start} --> ${item.end}\n${item.translation}\n\n`
  }).join('')
}

/**
 * 生成ASS格式内容
 * @param subtitles 字幕项数组
 * @param sourceFile 源文件路径
 * @returns ASS格式内容
 */
async function generateAssContent(subtitles: SubtitleItem[], sourceFile: string): Promise<string> {
  // 复制原文件的样式部分
  const encoding = await chardet.detectFile(sourceFile)
  const originalContent = await fs.readFile(sourceFile, encoding as BufferEncoding)
  const parts = originalContent.split('[Events]')
  
  if (parts.length !== 2) {
    throw new Error('无效的 ASS 文件格式')
  }

  // 保持原文件的样式部分，只替换对话部分
  let content = parts[0] + '[Events]\n'
  
  // 获取 Format 行
  const lines = parts[1].split('\n')
  const formatLine = lines.find(line => line.trim().startsWith('Format:'))
  if (!formatLine) {
    throw new Error('无法找到 ASS 文件的 Format 行')
  }
  content += formatLine + '\n'

  // 添加翻译后的对话
  content += subtitles.map(item => {
    return `Dialogue: 0,${item.start},${item.end},${item.style || 'Default'},,0,0,0,,${item.translation}`
  }).join('\n')

  return content
} 