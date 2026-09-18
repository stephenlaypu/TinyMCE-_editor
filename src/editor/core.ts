export { default as CmsContentEditor } from './CmsContentEditor.vue'

export type { AppLocale } from './i18n'
export type { EditorContent } from './types/editorContent'
export type { ContentBlockData, ContentBlockDataWriteOptions } from './contentBlockData'
export {
  decodeLegacyEncodedHtmlDocument,
  normalizeContentBlockHtmlFieldKey,
  readEditorContentFromBlockData,
  writeEditorContentToBlockData,
} from './contentBlockData'
export type {
  UploadAdapter,
  UploadContext,
  UploadErrorCode,
  UploadKind,
  UploadResult,
  UploadSource,
} from './uploads/types'
export { UploadValidationError } from './uploads/types'
export { createHttpUploadAdapter, localPreviewUploadAdapter } from './uploads/adapters'
export { imageUploadPolicy, videoUploadPolicy } from './uploads/upload'
export { allowedIframeDomains } from './tinymce/registerMediaTools'
export { defaultEditorPolicy, editorPolicyPresets, resolveEditorPolicy } from './policy'
export type {
  AccessibilityProfile,
  EditorMode,
  EditorPolicy,
  EditorPolicyOverride,
  MediaInsertionMode,
} from './policy'

export type WorkspaceMode = 'basic' | 'advanced'
