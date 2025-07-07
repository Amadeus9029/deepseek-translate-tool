/**
 * 模块声明文件
 * 用于解决TypeScript模块导入问题
 */

// 声明各个模块，让TypeScript能够识别它们
declare module './window-controls' {
  import { BrowserWindow } from 'electron'
  export function setupWindowControls(mainWindow: BrowserWindow): void
}

declare module './ipc/file-handlers' {
  import { Logger } from '../utils/logger'
  export function setupFileHandlers(logger: Logger): void
}

declare module './ipc/subtitle-handlers' {
  import { Logger } from '../utils/logger'
  export function setupSubtitleHandlers(logger: Logger): void
}

declare module './ipc/log-handlers' {
  import { Logger } from '../utils/logger'
  export function setupLogHandlers(logger: Logger): void
}

declare module './ipc/translate-result-handlers' {
  import { Logger } from '../utils/logger'
  export function setupTranslateResultHandlers(logger: Logger): void
}

declare module './ipc/settings-handlers' {
  import { Logger } from '../utils/logger'
  export function setupSettingsHandlers(logger: Logger): void
}

declare module './ipc/ollama-handlers' {
  import { Logger } from '../utils/logger'
  export function setupOllamaHandlers(logger: Logger): void
}

declare module './ipc/navigation-handlers' {
  export function setupNavigationHandlers(): void
}

// 声明资源导入
declare module '*.png?asset' {
  const content: string
  export default content
} 