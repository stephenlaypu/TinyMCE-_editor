export { default as CmsContentEditor } from './CmsContentEditor.vue'

export type { AppLocale } from './i18n'
export type { EditorContent } from './types/editorContent'
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

export type EditorMode = 'strict' | 'normal'
export type AccessibilityProfile = 'content-quality' | 'tw-aa-110'
export type WorkspaceMode = 'basic' | 'advanced'
