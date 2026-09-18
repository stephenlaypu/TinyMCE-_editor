import type { EditorContent } from './types/editorContent'

export type ContentBlockData = Record<string, unknown>

export interface ContentBlockDataWriteOptions {
  htmlFieldKey?: string
  allowCss?: boolean
  allowJavaScript?: boolean
}

const asRecord = (value: unknown): ContentBlockData =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ContentBlockData)
    : {}

const stringField = (data: ContentBlockData, key: string) =>
  typeof data[key] === 'string' ? data[key] : ''

const encodedHtmlDocumentStartPattern = /^\s*&lt;[a-z][\w:-]*(?:\s|\/?&gt;)/i

export const decodeLegacyEncodedHtmlDocument = (value: string): string => {
  if (!encodedHtmlDocumentStartPattern.test(value)) {
    return value
  }

  const decoder = document.createElement('textarea')
  decoder.innerHTML = value
  const decoded = decoder.value
  const template = document.createElement('template')
  template.innerHTML = decoded

  return template.content.querySelector('*') ? decoded : value
}

export const normalizeContentBlockHtmlFieldKey = (value?: string): string => {
  const key = value?.trim() || 'html'
  return key === 'css' || key === 'js' ? 'html' : key
}

export const readEditorContentFromBlockData = (
  value: unknown,
  htmlFieldKey = 'html',
): EditorContent => {
  const data = asRecord(value)
  const htmlKey = normalizeContentBlockHtmlFieldKey(htmlFieldKey)

  return {
    html: stringField(data, htmlKey),
    css: stringField(data, 'css'),
    js: stringField(data, 'js'),
  }
}

export const writeEditorContentToBlockData = (
  currentValue: unknown,
  content: EditorContent,
  options: ContentBlockDataWriteOptions = {},
): ContentBlockData => {
  const current = asRecord(currentValue)
  const htmlKey = normalizeContentBlockHtmlFieldKey(options.htmlFieldKey)

  return {
    ...current,
    [htmlKey]: content.html,
    ...(options.allowCss ? { css: content.css } : {}),
    ...(options.allowJavaScript ? { js: content.js } : {}),
  }
}
