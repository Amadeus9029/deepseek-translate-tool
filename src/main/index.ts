import { app, shell, BrowserWindow, ipcMain, dialog, net } from 'electron'
import { join, extname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as XLSX from 'xlsx'
import { promises as fs } from 'fs'
import * as chardet from 'chardet'
import path from 'path'
import fsExtra from 'fs-extra'
import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'

// 添加自定义日志函数
const logger = {
  info: (message: string, ...args: any[]) => {
    const time = new Date().toLocaleTimeString('zh-CN')
    if (args.length > 0) {
      console.log(`[${time}] [INFO] ${message}`, ...args)
    } else {
      console.log(`[${time}] [INFO] ${message}`)
    }
  },
  
  error: (message: string, ...args: any[]) => {
    const time = new Date().toLocaleTimeString('zh-CN')
    if (args.length > 0) {
      console.error(`[${time}] [ERROR] ${message}`, ...args)
    } else {
      console.error(`[${time}] [ERROR] ${message}`)
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    const time = new Date().toLocaleTimeString('zh-CN')
    if (args.length > 0) {
      console.warn(`[${time}] [WARN] ${message}`, ...args)
    } else {
      console.warn(`[${time}] [WARN] ${message}`)
    }
  }
}

// 设置控制台输出编码为UTF-8，解决中文乱码问题
if (process.platform === 'win32') {
  process.env.LANG = 'zh-CN.UTF-8'
  // 尝试设置控制台代码页
  try {
    const cp = require('child_process')
    cp.execSync('chcp 65001', { stdio: 'ignore' })
  } catch (e) {
    logger.error('设置控制台代码页失败，可能会导致中文显示为乱码')
  }
}

// 添加类型定义
interface SubtitleItem {
  start: string
  end: string
  text: string
  translation?: string
  type: 'srt' | 'ass'
  style?: string
}

// interface SubtitleNode {
//   type: 'cue' | 'header'
//   data: {
//     start: number
//     end: number
//     text: string
//     settings?: string
//   }
// }

// 定义日志接口
interface TranslateLog {
  fileName: string
  sourceLanguage: string
  targetLanguage: string
  translateCount: number
  startTime: string
  endTime?: string
  duration?: number
  completed: boolean
  error?: string
}

// 定义翻译结果接口
interface TranslateResult {
  type: '文本' | '文档' | '字幕'
  sourceLanguage: string
  targetLanguage: string
  sourceContent: string
  translatedContent: string
  timestamp: string
  status: '成功' | '失败'
  fileName?: string
  filePath?: string
  id?: string
}

// 在文件顶部定义IPC处理程序
function setupIPC() {
  // 移除所有现有的监听器
  ipcMain.removeHandler('open-file-dialog')
  ipcMain.removeHandler('read-excel-file')
  ipcMain.removeHandler('save-excel-file')
  ipcMain.removeHandler('save-translate-result')

  // 打开文件对话框
  ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '字幕文件', extensions: ['srt', 'ass', 'vtt'] },
        { name: 'Excel 文件', extensions: ['xlsx', 'xls'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (!canceled && filePaths.length > 0) {
      return {
        success: true,
        filePath: filePaths[0]
      }
    }
    return {
      success: false,
      filePath: null
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
    } catch (error: any) {
      return { success: false, error: error.message }
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

      // 修改输出路径到用户设置的存储路径
      const fileName = path.basename(filePath)
      const relativeDir = path.dirname(filePath).split(path.sep).pop() // 获取最后一级目录名
      const outputDir = path.join(savePath, 'document_translations', relativeDir || '')
      const outputPath = path.join(outputDir, fileName)

      // 如果需要创建目录
      if (createDir) {
        await fs.mkdir(outputDir, { recursive: true })
      }

      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      XLSX.writeFile(workbook, outputPath)
      return { success: true, outputPath }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

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
        // 动态导入 subsrt-ts
        const subsrt = await import('subsrt-ts')
        // 解析 SRT 格式
        const parsed = subsrt.default.parse(content) as any[]
        if (!Array.isArray(parsed)) {
          throw new Error('SRT解析失败')
        }
        
        subtitles = parsed
          .filter(node => node.type === 'caption' && node.text && node.text.trim())
          .map(node => ({
            start: formatTimestamp(node.start),
            end: formatTimestamp(node.end),
            text: node.text.trim(),
            type: 'srt' as const
          }))
      } else if (ext === '.ass') {
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

        subtitles = events
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
      console.error('读取字幕文件失败:', error)
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
        // 生成 SRT 格式内容
        content = subtitles.map((item, index) => {
          return `${index + 1}\n${item.start} --> ${item.end}\n${item.translation}\n\n`
        }).join('')
      } else if (subtitles[0].type === 'ass') {
        // 复制原文件的样式部分
        const encoding = await chardet.detectFile(sourceFile)
        const originalContent = await fs.readFile(sourceFile, encoding as BufferEncoding)
        const parts = originalContent.split('[Events]')
        
        if (parts.length !== 2) {
          throw new Error('无效的 ASS 文件格式')
        }

        // 保持原文件的样式部分，只替换对话部分
        content = parts[0] + '[Events]\n'
        
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
      console.error('保存字幕失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 日志相关的IPC处理
  ipcMain.handle('read-logs', async () => {
    try {
      const logsDir = path.join(app.getPath('userData'), 'logs')
      
      // 如果目录不存在，创建目录并返回空数组
      if (!await fsExtra.pathExists(logsDir)) {
        await fsExtra.mkdirp(logsDir)
        return { success: true, logs: [] as TranslateLog[] }
      }

      // 读取所有日志文件
      const logFiles = await fsExtra.readdir(logsDir)
      
      // 获取所有文件的状态
      const fileStats = await Promise.all(
        logFiles
          .filter(file => file.endsWith('.json'))
          .map(async file => ({
            name: file,
            stat: await fsExtra.stat(path.join(logsDir, file))
          }))
      )

      // 按修改时间排序
      fileStats.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime())

      // 读取日志内容
      const logs: TranslateLog[] = []
      for (const file of fileStats) {
        try {
          const content = await fsExtra.readFile(path.join(logsDir, file.name), 'utf-8')
          const logData = JSON.parse(content) as TranslateLog
          logs.push(logData)
        } catch (e) {
          console.error(`解析日志文件失败: ${file.name}`, e)
        }
      }

      return { success: true, logs }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.handle('clear-logs', async () => {
    try {
      const logsDir = path.join(app.getPath('userData'), 'logs')
      
      if (await fsExtra.pathExists(logsDir)) {
        await fsExtra.emptyDir(logsDir)
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 保存翻译日志
  ipcMain.handle('save-log', async (_, log: TranslateLog) => {
    try {
      const logsDir = path.join(app.getPath('userData'), 'logs')
      
      // 确保日志目录存在
      await fsExtra.mkdirp(logsDir)

      // 生成日志文件名
      const timestamp = new Date().getTime()
      const fileName = `translate_${timestamp}.json`
      const filePath = path.join(logsDir, fileName)

      // 写入日志文件
      await fsExtra.writeFile(filePath, JSON.stringify(log, null, 2), 'utf-8')

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 保存翻译结果
  ipcMain.handle('save-translate-result', async (_, result: TranslateResult) => {
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

      // 创建结果目录
      const resultsDir = path.join(savePath, 'translate_results')
      await fsExtra.mkdirp(resultsDir)

      // 生成结果文件名
      const timestamp = new Date().getTime()
      const fileName = `translate_${timestamp}.json`
      const filePath = path.join(resultsDir, fileName)

      // 写入结果文件
      await fsExtra.writeJSON(filePath, result, { spaces: 2 })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
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
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 读取翻译结果
  ipcMain.handle('read-translate-results', async () => {
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

      const resultsDir = path.join(savePath, 'translate_results')
      
      // 如果目录不存在，创建目录并返回空数组
      if (!await fsExtra.pathExists(resultsDir)) {
        await fsExtra.mkdirp(resultsDir)
        return { success: true, results: [] as TranslateResult[] }
      }

      // 读取所有结果文件
      const resultFiles = await fsExtra.readdir(resultsDir)
      
      // 获取所有文件的状态
      const fileStats = await Promise.all(
        resultFiles
          .filter(file => file.endsWith('.json'))
          .map(async file => ({
            name: file,
            stat: await fsExtra.stat(path.join(resultsDir, file))
          }))
      )

      // 按修改时间排序
      fileStats.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime())

      // 读取结果内容
      const results: TranslateResult[] = []
      for (const file of fileStats) {
        try {
          const content = await fsExtra.readFile(path.join(resultsDir, file.name), 'utf-8')
          const resultData = JSON.parse(content) as TranslateResult
          // 添加id字段，使用文件名作为id
          resultData.id = file.name
          results.push(resultData)
        } catch (e) {
          console.error(`解析结果文件失败: ${file.name}`, e)
        }
      }

      return { success: true, results }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 更新翻译结果
  ipcMain.handle('update-translate-result', async (_, { id, updates }: { id: string, updates: Partial<TranslateResult> }) => {
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

      const resultsDir = path.join(savePath, 'translate_results')
      const filePath = path.join(resultsDir, id)

      // 检查文件是否存在
      if (!await fsExtra.pathExists(filePath)) {
        return { success: false, error: '找不到要更新的翻译结果文件' }
      }

      // 读取原始文件内容
      const content = await fsExtra.readFile(filePath, 'utf-8')
      const result = JSON.parse(content) as TranslateResult

      // 更新内容
      Object.assign(result, updates)

      // 写回文件
      await fsExtra.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8')

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 清除翻译结果
  ipcMain.handle('clear-translate-results', async () => {
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

      const resultsDir = path.join(savePath, 'translate_results')
      
      if (await fsExtra.pathExists(resultsDir)) {
        await fsExtra.emptyDir(resultsDir)
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
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
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 保存设置
  ipcMain.handle('save-settings', async (_, settings: any) => {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json')
      await fsExtra.writeJSON(settingsPath, settings, { spaces: 2 })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 读取设置
  ipcMain.handle('read-settings', async () => {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json')
      if (await fsExtra.pathExists(settingsPath)) {
        const settings = await fsExtra.readJSON(settingsPath)
        return { success: true, settings }
      }
      return { success: true, settings: {} }
    } catch (error) {
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
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 打开文件所在文件夹
  ipcMain.handle('open-file-location', async (_, filePath) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // Ollama 代理 handler
  ipcMain.handle('ollama-fetch', async (_, { baseUrl, path, method = 'GET', body }) => {
    return new Promise((resolve) => {
      try {
        const fullUrl = `${baseUrl}${path}`;
        const url = new URL(fullUrl);
        const options = {
          hostname: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname, // 强制使用 IPv4 地址
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          family: 4 // 强制使用 IPv4
        };

        const requestBody = body ? JSON.stringify(body) : undefined;
        
        // 选择 http 或 https 模块
        const requestModule = url.protocol === 'https:' ? https : http;
        
        const req = requestModule.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve({ success: true, data: jsonData });
            } catch (err) {
              resolve({ 
                success: false, 
                error: `解析响应失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}` 
              });
            }
          });
        });
        
        req.on('error', (err) => {
          resolve({ 
            success: false, 
            error: `请求失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}` 
          });
        });
        
        if (requestBody) {
          req.write(requestBody);
        }
        
        req.end();
      } catch (err) {
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}` 
        });
      }
    });
  });

  // 直接从Ollama API获取模型列表
  ipcMain.handle('fetch-ollama-api-models', async () => {
    return new Promise<{success: boolean, models?: any[], error?: string}>((resolve) => {
      try {
        logger.info('开始从Ollama API获取模型列表...');
        
        // 使用预定义的模型列表
        const predefinedModels = [
          { name: 'llama3', description: 'Meta Llama 3: The most capable openly available LLM to date', tags: ['8b', '70b'] },
          { name: 'llama3.1', description: 'Llama 3.1 is a new state-of-the-art model from Meta', tags: ['8b', '70b', '405b', 'tools'] },
          { name: 'llama2', description: 'Llama 2 is a collection of foundation language models', tags: ['7b', '13b', '70b'] },
          { name: 'mistral', description: 'The 7B model released by Mistral AI', tags: ['7b', 'tools'] },
          { name: 'gemma', description: 'Gemma is a family of lightweight, state-of-the-art open models built by Google DeepMind', tags: ['2b', '7b'] },
          { name: 'gemma2', description: 'Google Gemma 2 is a high-performing and efficient model', tags: ['2b', '9b', '27b'] },
          { name: 'gemma3', description: 'The current, most capable model that runs on a single GPU', tags: ['1b', '4b', '12b', '27b', 'vision'] },
          { name: 'qwen', description: 'Qwen 1.5 is a series of large language models by Alibaba Cloud', tags: ['0.5b', '1.8b', '4b', '7b', '14b', '32b', '72b', '110b'] },
          { name: 'qwen2', description: 'Qwen2 is a new series of large language models from Alibaba group', tags: ['0.5b', '1.5b', '7b', '72b', 'tools'] },
          { name: 'qwen2.5', description: 'Qwen2.5 models are pretrained on Alibaba\'s latest large-scale dataset', tags: ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b', 'tools'] },
          { name: 'qwen3', description: 'Qwen3 is the latest generation of large language models in Qwen series', tags: ['0.6b', '1.7b', '4b', '8b', '14b', '30b', '32b', '235b', 'tools', 'thinking'] },
          { name: 'phi3', description: 'Phi-3 is a family of lightweight 3B (Mini) and 14B (Medium) state-of-the-art open models by Microsoft', tags: ['3.8b', '14b'] },
          { name: 'phi4', description: 'Phi-4 is a 14B parameter, state-of-the-art open model from Microsoft', tags: ['14b'] },
          { name: 'deepseek-r1', description: 'DeepSeek-R1 is a family of open reasoning models with performance approaching that of leading models', tags: ['1.5b', '7b', '8b', '14b', '32b', '70b', '671b', 'tools', 'thinking'] },
          { name: 'codellama', description: 'A large language model that can use text prompts to generate and discuss code', tags: ['7b', '13b', '34b', '70b'] },
          { name: 'llava', description: 'LLaVA is a novel end-to-end trained large multimodal model that combines a vision encoder and Vicuna', tags: ['7b', '13b', '34b', 'vision'] }
        ];
        
        logger.info(`成功获取 ${predefinedModels.length} 个预定义模型`);
        
        resolve({ 
          success: true, 
          models: predefinedModels
        });
      } catch (err) {
        logger.error('获取Ollama API模型列表失败:', err);
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
        });
      }
    });
  });

  // 从Ollama官方库获取模型列表
  ipcMain.handle('fetch-official-models', async () => {
    return new Promise<{success: boolean, models?: any[], error?: string, debugInfo?: any}>((resolve) => {
      try {
        logger.info('开始获取Ollama官方模型列表...');
        const options = {
          hostname: 'ollama.com',
          port: 443,
          path: '/library',
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html'
          }
        };
        
        logger.info('请求配置', options);
        
        const req = https.request(options, (res) => {
          logger.info(`收到响应状态码: ${res.statusCode}`);
          logger.info('响应头', res.headers);
          
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              logger.info(`收到响应数据长度: ${data.length} 字节`);
              
              // 解析HTML内容，提取模型信息
              // 尝试多种可能的模型名称匹配模式
              const nameMatches: string[] = [];
              const descMatches: string[] = [];
              const tagMatches: string[][] = [];
              
              // 保存一小段HTML用于调试
              const htmlPreview = data.length > 5000 ? data.substring(0, 5000) + '...' : data;
              logger.info('HTML样本前100个字符:', htmlPreview.substring(0, 100));
              
              // 尝试精确匹配 #repo > ul > li > a > div:nth-child(1) > h2 > div > span 结构
              const repoPattern = /<div[^>]*id="repo"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i;
              const repoMatch = repoPattern.exec(data);
              
              if (repoMatch) {
                logger.info('找到了repo容器');
                const ulContent = repoMatch[1];
                
                // 从ul中提取所有li元素
                const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
                let liMatch: RegExpExecArray | null;
                const liContents: string[] = [];
                
                while ((liMatch = liPattern.exec(ulContent)) !== null) {
                  liContents.push(liMatch[1]);
                }
                
                logger.info(`找到了 ${liContents.length} 个li元素`);
                
                // 从每个li中提取模型名称
                for (const liContent of liContents) {
                  // 尝试匹配 a > div > h2 > div > span 结构
                  const modelNamePattern = /<a[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>/i;
                  const modelMatch = modelNamePattern.exec(liContent);
                  
                  if (modelMatch) {
                    const modelName = modelMatch[1].trim();
                    nameMatches.push(modelName);
                  }
                }
                
                logger.info(`从repo容器中提取到 ${nameMatches.length} 个模型名称`);
                if (nameMatches.length > 0) {
                  logger.info('模型名称:', nameMatches);
                }
              } else {
                logger.warn('未找到repo容器，尝试其他匹配模式');
              }
              
              // 如果上面的精确匹配没有结果，尝试其他模式
              if (nameMatches.length === 0) {
                // 尝试直接匹配所有 h2 > div > span 结构
                const spanPattern = /<h2[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>/gi;
                let spanMatch: RegExpExecArray | null;
                
                while ((spanMatch = spanPattern.exec(data)) !== null) {
                  nameMatches.push(spanMatch[1].trim());
                }
                
                logger.info(`使用h2>div>span模式提取到 ${nameMatches.length} 个模型名称`);
                if (nameMatches.length > 0) {
                  logger.info('模型名称:', nameMatches);
                }
              }
              
              // 如果仍然没有结果，尝试更宽松的模式
              if (nameMatches.length === 0) {
                // 尝试第一种模式: <h2><div><span>模型名</span></div></h2>
                const regex1 = /<h2[^>]*><div[^>]*><span[^>]*>([^<]+)<\/span>/g;
                let regexMatch1: RegExpExecArray | null;
                
                while ((regexMatch1 = regex1.exec(data)) !== null) {
                  nameMatches.push(regexMatch1[1].trim());
                }
                
                logger.info(`使用第一种模式提取到 ${nameMatches.length} 个模型名称`);
                
                // 如果第一种模式没有匹配到，尝试第二种模式: <h2>模型名</h2>
                if (nameMatches.length === 0) {
                  const regex2 = /<h2[^>]*>([^<]+)<\/h2>/g;
                  let regexMatch2: RegExpExecArray | null;
                  
                  while ((regexMatch2 = regex2.exec(data)) !== null) {
                    nameMatches.push(regexMatch2[1].trim());
                  }
                  
                  logger.info(`使用第二种模式提取到 ${nameMatches.length} 个模型名称`);
                }
                
                // 如果第二种模式也没有匹配到，尝试第三种模式: <div class="model-name">模型名</div>
                if (nameMatches.length === 0) {
                  const regex3 = /<div[^>]*class="[^"]*model-name[^"]*"[^>]*>([^<]+)<\/div>/g;
                  let regexMatch3: RegExpExecArray | null;
                  
                  while ((regexMatch3 = regex3.exec(data)) !== null) {
                    nameMatches.push(regexMatch3[1].trim());
                  }
                  
                  logger.info(`使用第三种模式提取到 ${nameMatches.length} 个模型名称`);
                }
              }
              
              // 提取所有描述（如果没有描述，使用空字符串）
              const descriptionRegex = /<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/div>/g;
              let descMatch: RegExpExecArray | null;
              
              while ((descMatch = descriptionRegex.exec(data)) !== null) {
                descMatches.push(descMatch[1].trim());
              }
              
              logger.info(`提取到 ${descMatches.length} 个模型描述`);
              
              // 提取所有标签组
              const tagsRegex = /<div[^>]*class="[^"]*tags[^"]*"[^>]*>(.*?)<\/div>/g;
              let tagsMatch: RegExpExecArray | null;
              
              while ((tagsMatch = tagsRegex.exec(data)) !== null) {
                const tagsHtml = tagsMatch[1];
                const tagList: string[] = [];
                const tagItemRegex = /<div[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/div>/g;
                let tagMatch: RegExpExecArray | null;
                
                while ((tagMatch = tagItemRegex.exec(tagsHtml)) !== null) {
                  tagList.push(tagMatch[1].trim());
                }
                
                tagMatches.push(tagList);
              }
              
              logger.info(`提取到 ${tagMatches.length} 组标签`);
              
              // 如果没有匹配到任何模型名称，检查是否有分页加载
              if (nameMatches.length === 0) {
                // 检查是否有分页或AJAX加载的迹象
                if (data.includes('pagination') || data.includes('load-more') || data.includes('infinite-scroll')) {
                  logger.warn('检测到可能存在分页或动态加载，网页内容可能需要JavaScript渲染');
                }
                
                // 检查是否有API端点
                if (data.includes('/api/') || data.includes('fetch(') || data.includes('axios.')) {
                  logger.warn('检测到可能使用API获取数据，可能需要直接调用API');
                }
                
                logger.warn('未能从HTML中提取模型名称，使用备用模型列表');
                
                // 使用备用模型列表
                const backupModels = [
                  'llama3', 'llama3.1', 'llama2', 'mistral', 'gemma', 'gemma2', 'gemma3',
                  'qwen', 'qwen2', 'qwen2.5', 'qwen3', 'phi3', 'phi4',
                  'deepseek-r1', 'codellama', 'llava'
                ];
                
                // 将备用模型添加到nameMatches
                backupModels.forEach(model => nameMatches.push(model));
              }
              
              // 组合模型信息
              const models: {name: string, description: string, tags: string[]}[] = [];
              for (let i = 0; i < nameMatches.length; i++) {
                models.push({
                  name: nameMatches[i],
                  description: i < descMatches.length ? descMatches[i] : '',
                  tags: i < tagMatches.length ? tagMatches[i] : []
                });
              }
              
              logger.info(`成功组合 ${models.length} 个模型信息`);
              
              // 保存HTML内容片段用于调试
              const htmlSample = data.length > 1000 ? data.substring(0, 1000) + '...' : data;
              
              resolve({ 
                success: true, 
                models: models,
                debugInfo: {
                  htmlSample,
                  modelCount: models.length,
                  nameMatchCount: nameMatches.length,
                  descMatchCount: descMatches.length,
                  tagMatchCount: tagMatches.length,
                  modelNames: nameMatches.slice(0, 20) // 添加模型名称到调试信息
                }
              });
            } catch (err) {
              logger.error('解析响应失败:', err);
              
              // 保存HTML内容片段用于调试
              const htmlSample = data.length > 1000 ? data.substring(0, 1000) + '...' : data;
              
              resolve({ 
                success: false, 
                error: `解析响应失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`,
                debugInfo: {
                  htmlSample,
                  error: err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)
                }
              });
            }
          });
        });
        
        req.on('error', (err) => {
          logger.error('请求失败:', err);
          resolve({ 
            success: false, 
            error: `请求失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`,
            debugInfo: {
              error: err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)
            }
          });
        });
        
        req.end();
      } catch (err) {
        logger.error('请求异常:', err);
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`,
          debugInfo: {
            error: err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)
          }
        });
      }
    });
  });

  // 获取特定模型的参数列表
  ipcMain.handle('fetch-model-params', async (event, modelName) => {
    return new Promise<{success: boolean, params?: string[], error?: string, debugInfo?: any}>((resolve) => {
      try {
        logger.info(`开始获取模型 ${modelName} 的参数列表...`);
        const options = {
          hostname: 'ollama.com',
          port: 443,
          path: `/library/${modelName}`,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html'
          }
        };
        
        logger.info('请求配置', options);
        
        const req = https.request(options, (res) => {
          logger.info(`收到响应状态码: ${res.statusCode}`);
          
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              logger.info(`收到响应数据长度: ${data.length} 字节`);
              
              // 解析HTML内容，提取参数列表
              const params: string[] = [];
              
              // 保存一小段HTML用于调试
              const htmlPreview = data.length > 5000 ? data.substring(0, 5000) + '...' : data;
              
              // 尝试匹配参数列表
              // 使用指定的选择器路径: body > main > div > section > div.overflow-hidden.rounded-lg.border.border-neutral-200 > div > div:nth-child(3) > span
              const paramsRegex = /<div[^>]*class="[^"]*overflow-hidden[^"]*rounded-lg[^"]*border[^"]*border-neutral-200[^"]*"[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i;
              const paramsMatch = paramsRegex.exec(data);
              
              if (paramsMatch) {
                // 提取所有参数标签
                const paramsHtml = paramsMatch[1];
                const tagRegex = /<div[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/div>/g;
                let tagMatch;
                
                while ((tagMatch = tagRegex.exec(paramsHtml)) !== null) {
                  params.push(tagMatch[1].trim());
                }
                
                logger.info(`提取到 ${params.length} 个参数: ${params.join(', ')}`);
              } else {
                // 尝试其他匹配模式
                logger.warn('未找到主要参数容器，尝试其他匹配模式');
                
                // 尝试匹配所有tag标签
                const tagRegex = /<div[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/div>/g;
                let tagMatch;
                
                while ((tagMatch = tagRegex.exec(data)) !== null) {
                  const tag = tagMatch[1].trim();
                  // 只保留可能是参数大小的标签 (如 7b, 13b 等)
                  if (/^\d+(\.\d+)?[bB]$/.test(tag)) {
                    params.push(tag);
                  }
                }
                
                logger.info(`使用备用模式提取到 ${params.length} 个参数: ${params.join(', ')}`);
              }
              
              // 如果没有找到参数，使用默认参数列表
              if (params.length === 0) {
                logger.warn('未找到参数列表，使用默认参数');
                
                // 根据模型名称提供一些常见的参数大小
                const defaultParams: Record<string, string[]> = {
                  'llama3': ['8b', '70b'],
                  'llama3.1': ['8b', '70b', '405b'],
                  'llama2': ['7b', '13b', '70b'],
                  'mistral': ['7b'],
                  'gemma': ['2b', '7b'],
                  'gemma2': ['2b', '9b', '27b'],
                  'gemma3': ['1b', '4b', '12b', '27b'],
                  'qwen': ['0.5b', '1.8b', '4b', '7b', '14b', '32b', '72b', '110b'],
                  'qwen2': ['0.5b', '1.5b', '7b', '72b'],
                  'qwen2.5': ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b'],
                  'qwen3': ['0.6b', '1.7b', '4b', '8b', '14b', '30b', '32b', '235b'],
                  'phi3': ['3.8b', '14b'],
                  'phi4': ['14b'],
                  'deepseek-r1': ['8b', '7b', '14b', '32b', '70b', '1.5b', '671b'],
                  'codellama': ['7b', '13b', '34b', '70b'],
                  'llava': ['7b', '13b', '34b']
                };
                
                // 获取默认参数，如果没有则使用空数组
                const modelParams = defaultParams[modelName] || [];
                modelParams.forEach(param => params.push(param));
                
                logger.info(`使用默认参数: ${params.join(', ')}`);
              }
              
              resolve({ 
                success: true, 
                params: params,
                debugInfo: {
                  htmlPreview: htmlPreview.substring(0, 1000),
                  paramsCount: params.length
                }
              });
            } catch (err) {
              logger.error('解析响应失败:', err);
              
              resolve({ 
                success: false, 
                error: `解析响应失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`,
                debugInfo: {
                  error: err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)
                }
              });
            }
          });
        });
        
        req.on('error', (err) => {
          logger.error('请求失败:', err);
          resolve({ 
            success: false, 
            error: `请求失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
          });
        });
        
        req.end();
      } catch (err) {
        logger.error('请求异常:', err);
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
        });
      }
    });
  });

  // 导航到特定页面
  ipcMain.on('navigate-to-page', (_, page) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.send('change-page', page)
    }
  })
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // 处理窗口控制
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      mainWindow.webContents.send('window-unmaximized')
    } else {
      mainWindow.maximize()
      mainWindow.webContents.send('window-maximized')
    }
  })

  // 监听窗口最大化事件
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized')
  })

  // 监听窗口还原事件
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized')
  })

  ipcMain.on('window-close', () => {
    mainWindow.close()
  })

  ipcMain.on('window-toggle-always-on-top', () => {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// 只在应用启动时设置一次IPC
let isIPCSetup = false

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 只在第一次时设置IPC
  if (!isIPCSetup) {
    setupIPC()
    isIPCSetup = true
  }

  // Create the browser window.
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// 添加时间戳格式化函数
function formatTimestamp(ms: number): string {
  const date = new Date(ms)
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds},${milliseconds}`
}
