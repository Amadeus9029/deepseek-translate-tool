/**
 * 日志工具模块
 * 提供统一的日志记录功能
 */

// 日志接口定义
export interface Logger {
  info: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
}

/**
 * 设置日志系统
 * @returns 日志对象
 */
export function setupLogger(): Logger {
  return {
    info: (message: string, ...args: any[]) => {
      const time = new Date().toLocaleTimeString('zh-CN')
      if (args.length > 0) {
        console.log(`[${time}] [INFO] ${message}`, ...args)
      } else {
        console.log(`[${time}] [INFO] ${message}`)
      }
    },
    
    error: (message: string, ...args: any[]) => {
      const time = new Date().toLocaleTimeString('zh-CN')
      if (args.length > 0) {
        console.error(`[${time}] [ERROR] ${message}`, ...args)
      } else {
        console.error(`[${time}] [ERROR] ${message}`)
      }
    },
    
    warn: (message: string, ...args: any[]) => {
      const time = new Date().toLocaleTimeString('zh-CN')
      if (args.length > 0) {
        console.warn(`[${time}] [WARN] ${message}`, ...args)
      } else {
        console.warn(`[${time}] [WARN] ${message}`)
      }
    }
  }
} 