/**
 * 设置处理模块
 * 处理应用程序设置的保存和读取
 */

import { app, ipcMain } from 'electron'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import { Logger } from '../utils/logger'

/**
 * 设置设置处理程序
 * @param logger 日志对象
 */
export function setupSettingsHandlers(logger: Logger): void {
  // 保存设置
  ipcMain.handle('save-settings', async (_, settings: any) => {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json')
      await fsExtra.writeJSON(settingsPath, settings, { spaces: 2 })
      logger.info('保存设置成功')
      return { success: true }
    } catch (error) {
      logger.error('保存设置失败:', error)
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
        logger.info('读取设置成功')
        return { success: true, settings }
      }
      logger.info('设置文件不存在，返回空对象')
      return { success: true, settings: {} }
    } catch (error) {
      logger.error('读取设置失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 获取应用版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })
} 