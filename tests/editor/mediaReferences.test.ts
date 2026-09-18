import { describe, expect, it } from 'vitest'
import {
  diffMediaReferenceManifests,
  extractMediaReferenceManifest,
  resolveManagedMediaReferences,
} from '../../src/editor/mediaReferences'

describe('media reference manifest', () => {
  it('extracts managed image, video, poster and caption references', () => {
    const manifest = extractMediaReferenceManifest({
      html: `
        <img src="/media/hero.jpg" data-cms-file-guid="image-guid" data-cms-file-state="active">
        <video poster="/media/poster.jpg" data-cms-poster-file-guid="poster-guid" data-cms-poster-file-state="active">
          <source src="/media/movie.mp4" data-cms-file-guid="video-guid" data-cms-file-state="temporary">
          <track src="/media/captions.vtt" data-cms-file-guid="caption-guid" data-cms-file-state="active">
        </video>
      `,
    })

    expect(manifest.fileGuids).toEqual(['caption-guid', 'image-guid', 'poster-guid', 'video-guid'])
    expect(manifest.counts.active).toBe(3)
    expect(manifest.counts.temporary).toBe(1)
    expect(manifest.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'image', fileGuid: 'image-guid', status: 'active' }),
        expect.objectContaining({ kind: 'poster', fileGuid: 'poster-guid', status: 'active' }),
        expect.objectContaining({ kind: 'source', fileGuid: 'video-guid', status: 'temporary' }),
        expect.objectContaining({ kind: 'track', fileGuid: 'caption-guid', status: 'active' }),
      ]),
    )
  })

  it('classifies URLs that must not be published as permanent public media', () => {
    const manifest = extractMediaReferenceManifest({
      html: `
        <img src="blob:https://admin.example/id">
        <img src="data:image/png;base64,AAAA">
        <img src="/temp/upload.png">
        <video src="/webadmin/files/download/123"></video>
        <audio src="javascript:alert(1)"></audio>
        <img src="https://cdn.example.com/public.jpg">
      `,
    })

    expect(manifest.references.map(({ status }) => status)).toEqual([
      'preview-only',
      'embedded-data',
      'temporary',
      'admin-only',
      'invalid',
      'unmanaged',
    ])
  })

  it('does not let active metadata override an obviously non-public URL', () => {
    const manifest = extractMediaReferenceManifest({
      html: `
        <img src="blob:https://admin.example/id" data-cms-file-guid="blob-guid" data-cms-file-state="active">
        <img src="/temp/image.jpg" data-cms-file-guid="temp-guid" data-cms-file-state="active">
        <img src="/admin/files/image.jpg" data-cms-file-guid="admin-guid" data-cms-file-state="active">
      `,
    })

    expect(manifest.references.map(({ status }) => status)).toEqual([
      'preview-only',
      'temporary',
      'admin-only',
    ])
  })

  it('marks a managed reference without lifecycle state as unknown', () => {
    const manifest = extractMediaReferenceManifest({
      html: '<img src="/media/image.jpg" data-cms-file-guid="image-guid">',
    })

    expect(manifest.references[0]).toMatchObject({
      fileGuid: 'image-guid',
      status: 'unknown-managed-state',
    })
  })

  it('rejects a managed reference whose URL changed without updating its file identity', () => {
    const manifest = extractMediaReferenceManifest({
      html: '<img src="/media/replaced.jpg" data-cms-file-guid="image-guid" data-cms-file-state="active" data-cms-file-source="/media/original.jpg">',
    })

    expect(manifest.references[0]?.status).toBe('invalid')
  })

  it('produces the file-library activation and release delta', () => {
    const previous = extractMediaReferenceManifest({
      html: `
        <img src="/media/keep.jpg" data-cms-file-guid="keep-guid" data-cms-file-state="active">
        <img src="/media/remove.jpg" data-cms-file-guid="remove-guid" data-cms-file-state="active">
      `,
    })
    const next = extractMediaReferenceManifest({
      html: `
        <img src="/media/keep.jpg" data-cms-file-guid="keep-guid" data-cms-file-state="active">
        <video src="/temp/add.mp4" data-cms-file-guid="add-guid" data-cms-file-state="temporary"></video>
      `,
    })

    expect(diffMediaReferenceManifests(previous, next)).toEqual({
      addedFileGuids: ['add-guid'],
      removedFileGuids: ['remove-guid'],
      retainedFileGuids: ['keep-guid'],
      temporaryFileGuids: ['add-guid'],
    })
  })

  it('expands srcset into separate references instead of treating it as one URL', () => {
    const manifest = extractMediaReferenceManifest({
      html: '<picture><source srcset="/media/small.webp 1x, /media/large.webp 2x"><img src="/media/fallback.jpg"></picture>',
    })

    expect(manifest.references.map(({ attribute, url }) => ({ attribute, url }))).toEqual([
      { attribute: 'srcset', url: '/media/small.webp' },
      { attribute: 'srcset', url: '/media/large.webp' },
      { attribute: 'src', url: '/media/fallback.jpg' },
    ])
  })

  it('does not split the comma inside a data URL in srcset', () => {
    const manifest = extractMediaReferenceManifest({
      html: '<img srcset="data:image/png;base64,AAAA 1x, /media/large.png 2x">',
    })

    expect(manifest.references.map(({ url, status }) => ({ url, status }))).toEqual([
      { url: 'data:image/png;base64,AAAA', status: 'embedded-data' },
      { url: '/media/large.png', status: 'unmanaged' },
    ])
  })

  it('resolves temporary managed media to active public URLs without mutating the draft', () => {
    const content = {
      html: `
        <img src="/temp/image.jpg" data-cms-file-guid="image-guid" data-cms-file-state="temporary" data-cms-file-source="/temp/image.jpg">
        <video poster="/temp/poster.jpg" data-cms-poster-file-guid="poster-guid" data-cms-poster-file-state="temporary" data-cms-poster-file-source="/temp/poster.jpg"></video>
      `,
      css: '',
      js: '',
    }
    const result = resolveManagedMediaReferences(content, [
      { fileGuid: 'image-guid', publicUrl: 'https://cdn.example.com/image.jpg' },
      { fileGuid: 'poster-guid', publicUrl: 'https://cdn.example.com/poster.jpg' },
    ])

    expect(result.resolved).toBe(true)
    expect(result.resolvedFileGuids).toEqual(['image-guid', 'poster-guid'])
    expect(result.content.html).toContain('src="https://cdn.example.com/image.jpg"')
    expect(result.content.html).toContain('poster="https://cdn.example.com/poster.jpg"')
    expect(result.content.html).toContain('data-cms-file-state="active"')
    expect(content.html).toContain('/temp/image.jpg')
  })

  it('fails closed for missing or non-public media resolutions', () => {
    const content = {
      html: '<img src="/temp/image.jpg" data-cms-file-guid="image-guid" data-cms-file-state="temporary" data-cms-file-source="/temp/image.jpg">',
      css: '',
      js: '',
    }
    const missing = resolveManagedMediaReferences(content, [])
    const invalid = resolveManagedMediaReferences(content, [
      { fileGuid: 'image-guid', publicUrl: '/webadmin/files/image.jpg' },
    ])

    expect(missing).toMatchObject({
      content,
      resolved: false,
      failures: [{ code: 'missing-resolution', fileGuids: ['image-guid'] }],
    })
    expect(invalid.resolved).toBe(false)
    expect(invalid.failures.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['invalid-public-url', 'missing-resolution']),
    )
  })

  it('does not guess how one managed identity maps to a srcset', () => {
    const content = {
      html: '<img srcset="/temp/small.jpg 1x, /temp/large.jpg 2x" data-cms-srcset-file-guid="responsive-guid">',
      css: '',
      js: '',
    }
    const result = resolveManagedMediaReferences(content, [
      { fileGuid: 'responsive-guid', publicUrl: 'https://cdn.example.com/image.jpg' },
    ])

    expect(result.resolved).toBe(false)
    expect(result.failures).toContainEqual({
      code: 'unsupported-managed-srcset',
      fileGuids: ['responsive-guid'],
    })
  })

  it('rejects file metadata attached to an unsupported HTML element', () => {
    const content = {
      html: '<div data-cms-file-guid="hidden-guid" data-cms-file-state="active"></div>',
      css: '',
      js: '',
    }
    const result = resolveManagedMediaReferences(content, [
      { fileGuid: 'hidden-guid', publicUrl: 'https://cdn.example.com/image.jpg' },
    ])

    expect(result.resolved).toBe(false)
    expect(result.failures).toContainEqual({
      code: 'invalid-managed-element',
      fileGuids: ['hidden-guid'],
    })
  })
})
