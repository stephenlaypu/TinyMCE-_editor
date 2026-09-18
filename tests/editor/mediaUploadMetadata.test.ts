import { describe, expect, it } from 'vitest'
import { applyUploadedMediaMetadata } from '../../src/editor/mediaUploadMetadata'

describe('uploaded media metadata', () => {
  it('attaches file-library identity to matching image and video sources', () => {
    const uploads = new Map([
      [
        '/media/image.jpg',
        {
          src: '/media/image.jpg',
          fileGuid: 'image-guid',
          fileState: 'active' as const,
        },
      ],
      [
        '/temp/video.mp4',
        {
          src: '/temp/video.mp4',
          fileGuid: 'video-guid',
          fileState: 'temporary' as const,
        },
      ],
    ])
    const result = applyUploadedMediaMetadata(
      '<img src="/media/image.jpg"><video><source src="/temp/video.mp4"></video>',
      uploads,
    )

    expect(result).toContain('data-cms-file-guid="image-guid"')
    expect(result).toContain('data-cms-file-state="active"')
    expect(result).toContain('data-cms-file-guid="video-guid"')
    expect(result).toContain('data-cms-file-state="temporary"')
  })

  it('removes stale identity when an author changes the managed source URL', () => {
    const result = applyUploadedMediaMetadata(
      '<img src="/media/new.jpg" data-cms-file-guid="old-guid" data-cms-file-state="active" data-cms-file-source="/media/old.jpg">',
      new Map(),
    )

    expect(result).toBe('<img src="/media/new.jpg">')
  })

  it('does not mutate unrelated content', () => {
    const html = '<p>Text only</p>'
    expect(applyUploadedMediaMetadata(html, new Map())).toBe(html)
  })
})
