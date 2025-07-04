/// <reference path="./custom.d.ts" />

import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// 类型定义导入
import { SubtitleItem, TranslateLog, TranslateResult } from './types/types'

// 导入模块化组件
import { setupLogger } from './utils/logger'
import { setupWindowControls } from './window-controls'
import { setupFileHandlers } from './ipc/file-handlers'
import { setupSubtitleHandlers } from './ipc/subtitle-handlers'
import { setupLogHandlers } from './ipc/log-handlers'
import { setupTranslateResultHandlers } from './ipc/translate-result-handlers'
import { setupSettingsHandlers } from './ipc/settings-handlers'
import { setupOllamaHandlers } from './ipc/ollama-handlers'
import { setupNavigationHandlers } from './ipc/navigation-handlers'

// 初始化日志系统
const logger = setupLogger()

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

/**
 * 设置IPC处理程序
 * 初始化所有模块化的IPC处理器
 */
function setupIPC() {
  // 设置各个模块的处理程序
  setupFileHandlers(logger)
  setupSubtitleHandlers(logger)
  setupLogHandlers(logger)
  setupTranslateResultHandlers(logger)
  setupSettingsHandlers(logger)
  setupOllamaHandlers(logger)
  setupNavigationHandlers()
}

/**
 * 创建主窗口
 * @returns 创建的窗口实例
 */
function createWindow(): BrowserWindow {
  // 创建浏览器窗口
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

  // 设置窗口控制
  setupWindowControls(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 在开发环境中加载远程URL，在生产环境中加载本地HTML文件
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

  // 在开发环境中通过F12打开或关闭DevTools，在生产环境中忽略Command/Control + R
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 只在第一次时设置IPC
  if (!isIPCSetup) {
    setupIPC()
    isIPCSetup = true
  }

  // 创建浏览器窗口
  createWindow()

  app.on('activate', function () {
    // 在macOS上，当点击dock图标且没有其他窗口打开时，通常会重新创建一个应用程序窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * 格式化时间戳
 * @param ms 毫秒时间戳
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(ms: number): string {
  const date = new Date(ms)
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds},${milliseconds}`
}
