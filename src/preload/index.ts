import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import https from 'https'

// Custom APIs for renderer
const api = {
  makeHttpsRequest: (options: any, data: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = ''

        // 检查状态码
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`HTTP请求失败，状态码: ${res.statusCode}`))
        }

        res.on('data', (chunk) => {
          responseData += chunk
        })

        res.on('end', () => {
          resolve(responseData)
        })
      })

      req.on('error', (error) => {
        console.error('HTTPS请求错误:', error)
        reject(new Error(`网络请求失败: ${error.message}`))
      })

      // 添加请求超时处理
      req.setTimeout(30000, () => {
        req.destroy()
        reject(new Error('请求超时，请检查网络连接'))
      })

      req.write(data)
      req.end()
    })
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
