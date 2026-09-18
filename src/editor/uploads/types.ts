export type UploadKind = 'image' | 'video'
export type UploadSource = 'picker' | 'drop' | 'paste' | 'editor'

export interface UploadContext {
  readonly kind: UploadKind
  readonly source: UploadSource
  readonly acceptedMimeTypes: readonly string[]
  readonly maxFileSize: number
  readonly locale: 'zh-TW' | 'en-US'
}

export interface UploadResult {
  readonly src: string
  readonly fileGuid?: string
  readonly fileState?: 'active' | 'temporary'
  readonly alt?: string
  readonly title?: string
  readonly width?: number
  readonly height?: number
  readonly mimeType?: string
}

export interface UploadAdapter {
  upload(
    file: File,
    context: UploadContext,
    onProgress?: (percent: number) => void,
  ): Promise<UploadResult>
}

export type UploadErrorCode = 'invalidType' | 'tooLarge' | 'missingAdapter' | 'invalidResponse'

export class UploadValidationError extends Error {
  readonly code: UploadErrorCode

  constructor(code: UploadErrorCode) {
    super(code)
    this.name = 'UploadValidationError'
    this.code = code
  }
}
