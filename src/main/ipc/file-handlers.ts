/**
 * 文件处理模块
 * 处理文件的打开、读取、保存等操作
 */

import { app, dialog, ipcMain, shell } from 'electron'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import { Logger } from '../utils/logger'

/**
 * 设置文件处理程序
 * @param logger 日志对象
 */
export function setupFileHandlers(logger: Logger): void {
  // 打开文件对话框
  ipcMain.handle('open-file-dialog', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: '字幕文件', extensions: ['srt', 'ass', 'vtt'] },
          { name: 'Excel 文件', extensions: ['xlsx', 'xls'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      
      return {
        success: true,
        filePath: !canceled && filePaths.length > 0 ? filePaths[0] : null
      }
    } catch (error) {
      logger.error('打开文件对话框失败:', error)
      return {
        success: false,
        filePath: null,
        error: error instanceof Error ? error.message : String(error)
      }
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
    } catch (error) {
      logger.error('读取Excel文件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
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
        await fsExtra.mkdirp(outputDir)
      }

      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      XLSX.writeFile(workbook, outputPath)
      
      return { success: true, outputPath }
    } catch (error) {
      logger.error('保存Excel文件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
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
      logger.error('选择文件夹失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
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
      logger.error('重命名文件失败:', error)
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
      logger.error('打开文件失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })

  // 打开文件所在文件夹
  ipcMain.handle('open-file-location', async (_, filePath) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      logger.error('打开文件位置失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  })
} 