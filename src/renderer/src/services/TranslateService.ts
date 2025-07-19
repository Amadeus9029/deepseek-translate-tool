import { getTranslateServiceManager } from './TranslateServiceManager'

/**
 * 兼容性导出，供现有代码使用
 * 未来可以逐步迁移到使用 TranslateServiceManager
 */
export function getUnifiedTranslateService() {
  return getTranslateServiceManager()
} 