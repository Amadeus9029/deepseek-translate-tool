/**
 * 全局类型声明文件
 */

// 窗口控制模块
declare module './window-controls' {
  import { BrowserWindow } from 'electron'
  export function setupWindowControls(mainWindow: BrowserWindow): void
}

// 文件处理模块
declare module './ipc/file-handlers' {
  import { Logger } from './utils/logger'
  export function setupFileHandlers(logger: Logger): void
}

// 字幕处理模块
declare module './ipc/subtitle-handlers' {
  import { Logger } from './utils/logger'
  export function setupSubtitleHandlers(logger: Logger): void
}

// 日志处理模块
declare module './ipc/log-handlers' {
  import { Logger } from './utils/logger'
  export function setupLogHandlers(logger: Logger): void
}

// 翻译结果处理模块
declare module './ipc/translate-result-handlers' {
  import { Logger } from './utils/logger'
  export function setupTranslateResultHandlers(logger: Logger): void
}

// 设置处理模块
declare module './ipc/settings-handlers' {
  import { Logger } from './utils/logger'
  export function setupSettingsHandlers(logger: Logger): void
}

// Ollama处理模块
declare module './ipc/ollama-handlers' {
  import { Logger } from './utils/logger'
  export function setupOllamaHandlers(logger: Logger): void
}

// 导航处理模块
declare module './ipc/navigation-handlers' {
  export function setupNavigationHandlers(): void
}

// 图片资源导入
declare module '*.png?asset' {
  const content: string
  export default content
} 