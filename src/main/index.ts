import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, extname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as XLSX from 'xlsx'
import { promises as fs } from 'fs'
import * as chardet from 'chardet'
import path from 'path'
import fsExtra from 'fs-extra'

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
      await fsExtra.move(oldPath, newPath)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
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
