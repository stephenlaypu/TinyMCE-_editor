import type { UploadAdapter, UploadResult } from './types'
import { UploadValidationError } from './types'

const parseUploadResponse = (value: unknown): UploadResult => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('src' in value) ||
    typeof value.src !== 'string' ||
    !value.src.trim()
  ) {
    throw new UploadValidationError('invalidResponse')
  }

  return value as UploadResult
}

export const createHttpUploadAdapter = (endpoint: string): UploadAdapter => ({
  upload(file, context, onProgress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest()
      const body = new FormData()
      body.append('file', file)
      body.append('kind', context.kind)

      request.open('POST', endpoint)
      request.responseType = 'json'
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.round((event.loaded / event.total) * 100))
        }
      })
      request.addEventListener('load', () => {
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(`Upload failed with status ${request.status}.`))
          return
        }

        try {
          resolve(parseUploadResponse(request.response))
        } catch (error) {
          reject(error)
        }
      })
      request.addEventListener('error', () => reject(new Error('Upload request failed.')))
      request.addEventListener('abort', () => reject(new Error('Upload request was aborted.')))
      request.send(body)
    })
  },
})

export const localPreviewUploadAdapter: UploadAdapter = {
  async upload(file) {
    return {
      src: URL.createObjectURL(file),
      mimeType: file.type,
    }
  },
}
