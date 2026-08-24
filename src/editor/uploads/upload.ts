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

  return adapter.upload(file, context, onProgress)
}
