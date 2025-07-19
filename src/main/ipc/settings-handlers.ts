/**
 * 设置处理模块
 * 处理应用程序设置的保存和读取
 */

import { app, ipcMain } from 'electron'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import { Logger } from '../utils/logger'
import * as https from 'https'

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

  // 查询DeepSeek API余额
  ipcMain.handle('check-deepseek-balance', async (_, apiKey: string) => {
    try {
      logger.info('开始查询DeepSeek API余额')
      
      if (!apiKey || apiKey.trim() === '') {
        return {
          success: false,
          error: 'API密钥不能为空'
        }
      }

      const result = await checkDeepSeekBalance(apiKey)
      logger.info('查询DeepSeek API余额成功')
      return {
        success: true,
        credits: result.credits,
        currency: result.currency
      }
    } catch (error) {
      logger.error('查询DeepSeek API余额失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}

/**
 * 查询DeepSeek API余额
 * @param apiKey DeepSeek API密钥
 * @returns 余额信息
 */
async function checkDeepSeekBalance(apiKey: string): Promise<{ credits: string; currency?: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/user/balance',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000 // 10秒超时
    }

    const req = https.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data)
          
          if (res.statusCode === 200) {
            if (response.is_available && response.balance_infos && response.balance_infos.length > 0) {
              // 获取余额信息
              const balanceInfo = response.balance_infos[0]; // 获取第一个余额信息
              const totalBalance = balanceInfo.total_balance || '0';
              const currency = balanceInfo.currency || ''; // 获取货币类型
              
              resolve({ 
                credits: totalBalance,
                currency: currency
              });
            } else {
              reject(new Error('响应中没有余额信息'))
            }
          } else if (response.error) {
            if (response.error.type === 'invalid_api_key') {
              reject(new Error('API密钥无效'))
            } else {
              reject(new Error(response.error.message || '查询余额失败'))
            }
          } else {
            reject(new Error(`请求失败，状态码: ${res.statusCode}`))
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error instanceof Error ? error.message : String(error)}`))
        }
      })
    })
    
    req.on('error', (error) => {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        reject(new Error('无法连接到DeepSeek API服务器，请检查网络连接'))
      } else if (error.message.includes('timeout')) {
        reject(new Error('请求超时，请稍后重试'))
      } else {
        reject(error)
      }
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时，请稍后重试'))
    })
    
    req.end()
  })
} 