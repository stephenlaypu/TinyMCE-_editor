import { describe, expect, it, vi } from 'vitest'
import type { UploadAdapter, UploadContext } from '../../../src/editor/uploads/types'
import { uploadFile } from '../../../src/editor/uploads/upload'

const imageContext: UploadContext = {
  kind: 'image',
  source: 'editor',
  acceptedMimeTypes: ['image/png'],
  maxFileSize: 1024,
  locale: 'zh-TW',
}

const createFile = (type = 'image/png', size = 3) =>
  new File([new Uint8Array(size)], 'sample.png', { type })

describe('uploadFile', () => {
  it('rejects unsupported MIME types before calling the adapter', async () => {
    const upload = vi.fn()

    await expect(
      uploadFile({ upload }, createFile('image/svg+xml'), imageContext),
    ).rejects.toMatchObject({ code: 'invalidType' })
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects files that exceed the configured limit', async () => {
    await expect(
      uploadFile({ upload: vi.fn() }, createFile('image/png', 1025), imageContext),
    ).rejects.toMatchObject({ code: 'tooLarge' })
  })

  it('fails explicitly when the reusable editor has no upload adapter', async () => {
    await expect(uploadFile(undefined, createFile(), imageContext)).rejects.toMatchObject({
      code: 'missingAdapter',
    })
  })

  it('delegates valid files and returns the permanent URL', async () => {
    const adapter: UploadAdapter = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.example.com/sample.png' }),
    }

    await expect(uploadFile(adapter, createFile(), imageContext)).resolves.toEqual({
      src: 'https://cdn.example.com/sample.png',
    })
    expect(adapter.upload).toHaveBeenCalledOnce()
  })

  it('accepts a complete file-library reference', async () => {
    const adapter: UploadAdapter = {
      upload: vi.fn().mockResolvedValue({
        src: 'https://cdn.example.com/sample.png',
        fileGuid: ' image-guid ',
        fileState: 'active',
      }),
    }

    await expect(uploadFile(adapter, createFile(), imageContext)).resolves.toMatchObject({
      src: 'https://cdn.example.com/sample.png',
      fileGuid: 'image-guid',
      fileState: 'active',
    })
  })

  it('rejects incomplete or unsafe upload responses', async () => {
    const incomplete: UploadAdapter = {
      upload: vi.fn().mockResolvedValue({
        src: '/media/sample.png',
        fileGuid: 'image-guid',
      }),
    }
    const unsafe: UploadAdapter = {
      upload: vi.fn().mockResolvedValue({ src: 'javascript:alert(1)' }),
    }

    await expect(uploadFile(incomplete, createFile(), imageContext)).rejects.toMatchObject({
      code: 'invalidResponse',
    })
    await expect(uploadFile(unsafe, createFile(), imageContext)).rejects.toMatchObject({
      code: 'invalidResponse',
    })
  })
})
