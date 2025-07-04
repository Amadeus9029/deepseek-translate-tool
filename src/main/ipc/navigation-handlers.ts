/**
 * 导航处理模块
 * 处理应用程序内部导航
 */

import { BrowserWindow, ipcMain } from 'electron'

/**
 * 设置导航处理程序
 */
export function setupNavigationHandlers(): void {
  // 导航到特定页面
  ipcMain.on('navigate-to-page', (_, page) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.send('change-page', page)
    }
  })
} 