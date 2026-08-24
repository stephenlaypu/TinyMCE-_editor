import { createI18n } from 'vue-i18n'
import { editorMessages } from './editor/i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-TW',
  fallbackLocale: 'en-US',
  messages: editorMessages,
})
