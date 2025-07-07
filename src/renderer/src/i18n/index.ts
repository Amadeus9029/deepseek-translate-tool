import { createI18n } from 'vue-i18n'
import { settings } from '../services/SettingsService'

// 创建i18n实例
export const i18n = createI18n({
  legacy: false, // 使用组合式API
  locale: settings.value.language || 'zh-CN', // 默认语言
  fallbackLocale: 'zh-CN', // 回退语言
  missingWarn: false, // 关闭缺失翻译警告
  messages: {} // 初始化为空，使用懒加载
})

// 已加载的语言
const loadedLanguages: string[] = []

// 设置i18n语言并加载语言包
export async function setI18nLanguage(lang: string): Promise<void> {
  // 如果语言已经加载，直接切换
  if (i18n.global.locale.value === lang && loadedLanguages.includes(lang)) {
    return
  }

  // 如果语言包未加载，动态加载
  if (!loadedLanguages.includes(lang)) {
    try {
      const messages = await loadLanguageAsync(lang)
      i18n.global.setLocaleMessage(lang, messages.default || messages)
      loadedLanguages.push(lang)
    } catch (error) {
      console.error(`Failed to load language: ${lang}`, error)
      // 如果加载失败且不是默认语言，尝试加载默认语言
      if (lang !== 'zh-CN') {
        return setI18nLanguage('zh-CN')
      }
      return
    }
  }

  // 设置语言
  i18n.global.locale.value = lang
  document.querySelector('html')?.setAttribute('lang', lang)

  // 更新设置
  settings.value.language = lang
  localStorage.setItem('app-language', lang)

  return Promise.resolve()
}

// 动态加载语言包
async function loadLanguageAsync(lang: string) {
  // 使用动态导入加载语言包
  try {
    return await import(`./locales/${lang}.ts`)
  } catch (error) {
    console.error(`Error loading language file: ${lang}`, error)
    throw error
  }
}

// 初始化i18n，加载当前语言
export async function initI18n(): Promise<void> {
  // 获取当前语言设置
  const currentLang = settings.value.language || localStorage.getItem('app-language') || 'zh-CN'
  await setI18nLanguage(currentLang)
} 