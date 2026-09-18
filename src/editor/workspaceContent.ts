import type { EditorContent } from './types/editorContent'

export interface ExtractedLegacyStyles {
  html: string
  css: string
  didExtract: boolean
}

export const extractLegacyStyles = (source: string): ExtractedLegacyStyles => {
  const template = document.createElement('template')
  template.innerHTML = source
  const styles = Array.from(template.content.querySelectorAll('style'))
  const css = styles
    .map((style) => style.textContent?.trim() || '')
    .filter(Boolean)
    .join('\n\n')

  styles.forEach((style) => style.remove())

  return {
    html: template.innerHTML,
    css,
    didExtract: styles.length > 0,
  }
}

export const mergeCss = (...sources: string[]): string => {
  const result: string[] = []
  sources.forEach((source) => {
    const value = source.trim()
    if (value && !result.includes(value)) {
      result.push(value)
    }
  })
  return result.join('\n\n')
}

export const applyBasicHtmlChange = (
  content: EditorContent,
  html: string,
  ...additionalCss: string[]
): EditorContent => ({
  ...content,
  html,
  css: mergeCss(content.css, ...additionalCss),
})
