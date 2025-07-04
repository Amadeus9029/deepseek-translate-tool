/**
 * 窗口控制模块
 * 处理窗口的最小化、最大化、关闭等操作
 */

import { BrowserWindow, ipcMain } from 'electron'

/**
 * 设置窗口控制
 * @param mainWindow 主窗口实例
 */
export function setupWindowControls(mainWindow: BrowserWindow): void {
  // 处理窗口最小化
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize()
  })

  // 处理窗口最大化/还原
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

  // 处理窗口关闭
  ipcMain.on('window-close', () => {
    mainWindow.close()
  })

  // 处理窗口置顶
  ipcMain.on('window-toggle-always-on-top', () => {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop)
  })
} 