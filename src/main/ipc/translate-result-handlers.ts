/**
 * 翻译结果处理模块
 * 处理翻译结果的保存、读取、更新和清理
 */

import { app, ipcMain, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import { TranslateResult } from '../types/types'
import { Logger } from '../utils/logger'

/**
 * 设置翻译结果处理程序
 * @param logger 日志对象
 */
export function setupTranslateResultHandlers(logger: Logger): void {
  // 保存翻译结果
  ipcMain.handle('save-translate-result', async (event, result: TranslateResult) => {
    try {
      const savePath = await getSavePath()

      // 创建结果目录
      const resultsDir = path.join(savePath, 'translate_results')
      await fsExtra.mkdirp(resultsDir)

      // 生成结果文件名
      const timestamp = new Date().getTime()
      const fileName = `translate_${timestamp}.json`
      const filePath = path.join(resultsDir, fileName)

      // 写入结果文件
      await fsExtra.writeJSON(filePath, result, { spaces: 2 })

      // 发送翻译完成事件通知给所有窗口
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('translation-completed')
      })

      return { success: true }
    } catch (error) {
      logger.error('保存翻译结果失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 读取翻译结果
  ipcMain.handle('read-translate-results', async () => {
    try {
      const savePath = await getSavePath()
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
          logger.error(`解析结果文件失败: ${file.name}`, e)
        }
      }

      return { success: true, results }
    } catch (error) {
      logger.error('读取翻译结果失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 更新翻译结果
  ipcMain.handle('update-translate-result', async (_, { id, updates }: { id: string, updates: Partial<TranslateResult> }) => {
    try {
      const savePath = await getSavePath()
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
      logger.error('更新翻译结果失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 清除翻译结果
  ipcMain.handle('clear-translate-results', async () => {
    try {
      const savePath = await getSavePath()
      const resultsDir = path.join(savePath, 'translate_results')
      
      if (await fsExtra.pathExists(resultsDir)) {
        await fsExtra.emptyDir(resultsDir)
      }

      return { success: true }
    } catch (error) {
      logger.error('清除翻译结果失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })
}

/**
 * 获取保存路径
 * @returns 保存路径
 */
async function getSavePath(): Promise<string> {
  // 读取设置
  const settingsPath = path.join(app.getPath('userData'), 'settings.json')
  let savePath = app.getPath('userData')
  
  if (await fsExtra.pathExists(settingsPath)) {
    const settings = await fsExtra.readJSON(settingsPath)
    if (settings.savePath) {
      savePath = settings.savePath
    }
  }

  return savePath
} 