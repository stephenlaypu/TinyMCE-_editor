import type { UploadAdapter, UploadContext, UploadResult } from './types'
import { UploadValidationError } from './types'

export const imageUploadPolicy = {
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFileSize: 5 * 1024 * 1024,
} as const

export const videoUploadPolicy = {
  acceptedMimeTypes: ['video/mp4', 'video/webm'],
  maxFileSize: 200 * 1024 * 1024,
} as const

export const validateUploadFile = (file: File, context: UploadContext) => {
  if (!context.acceptedMimeTypes.includes(file.type)) {
    throw new UploadValidationError('invalidType')
  }

  if (file.size > context.maxFileSize) {
    throw new UploadValidationError('tooLarge')
  }
}

const isSafeUploadUrl = (value: string): boolean => {
  try {
    const url = new URL(value, window.location.href)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'blob:'
  } catch {
    return false
  }
}

export const validateUploadResult = (result: UploadResult): UploadResult => {
  if (!result.src.trim() || !isSafeUploadUrl(result.src)) {
    throw new UploadValidationError('invalidResponse')
  }

  const hasFileGuid = typeof result.fileGuid === 'string' && Boolean(result.fileGuid.trim())
  const hasFileState = result.fileState === 'active' || result.fileState === 'temporary'
  if (hasFileGuid !== hasFileState) {
    throw new UploadValidationError('invalidResponse')
  }

  return {
    ...result,
    src: result.src.trim(),
    ...(hasFileGuid ? { fileGuid: result.fileGuid?.trim() } : {}),
  }
}

export const uploadFile = async (
  adapter: UploadAdapter | undefined,
  file: File,
  context: UploadContext,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> => {
  validateUploadFile(file, context)

  if (!adapter) {
    throw new UploadValidationError('missingAdapter')
  }

  return validateUploadResult(await adapter.upload(file, context, onProgress))
}
