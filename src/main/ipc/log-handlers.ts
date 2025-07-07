/**
 * 日志处理模块
 * 处理翻译日志的读取、保存和清理
 */

import { app, ipcMain } from 'electron'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import { TranslateLog } from '../types/types'
import { Logger } from '../utils/logger'

/**
 * 设置日志处理程序
 * @param logger 日志对象
 */
export function setupLogHandlers(logger: Logger): void {
  // 读取日志
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
          logger.error(`解析日志文件失败: ${file.name}`, e)
        }
      }

      return { success: true, logs }
    } catch (error) {
      logger.error('读取日志失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 清除日志
  ipcMain.handle('clear-logs', async () => {
    try {
      const logsDir = path.join(app.getPath('userData'), 'logs')
      
      if (await fsExtra.pathExists(logsDir)) {
        await fsExtra.emptyDir(logsDir)
      }

      return { success: true }
    } catch (error) {
      logger.error('清除日志失败:', error)
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
      logger.error('保存日志失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })
} 