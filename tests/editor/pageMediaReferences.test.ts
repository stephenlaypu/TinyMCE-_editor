import { describe, expect, it } from 'vitest'
import { resolvePageManagedMediaReferences } from '../../src/editor/pageMediaReferences'

const managedImage = (fileGuid: string, source: string) => ({
  html: `<img src="${source}" data-cms-file-guid="${fileGuid}" data-cms-file-state="temporary" data-cms-file-source="${source}">`,
  css: '',
  js: '',
})

describe('page managed media resolution', () => {
  it('resolves every block as one page result', () => {
    const result = resolvePageManagedMediaReferences(
      [
        { blockKey: 'hero', content: managedImage('hero-guid', '/temp/hero.jpg') },
        { blockKey: 'body', content: managedImage('body-guid', '/temp/body.jpg') },
      ],
      [
        { fileGuid: 'hero-guid', publicUrl: 'https://cdn.example.com/hero.jpg' },
        { fileGuid: 'body-guid', publicUrl: 'https://cdn.example.com/body.jpg' },
      ],
    )

    expect(result.resolved).toBe(true)
    expect(result.resolvedFileGuids).toEqual(['body-guid', 'hero-guid'])
    expect(result.blocks[0]?.content.html).toContain('https://cdn.example.com/hero.jpg')
    expect(result.blocks[1]?.content.html).toContain('https://cdn.example.com/body.jpg')
  })

  it('returns every original block when one block cannot be resolved', () => {
    const blocks = [
      { blockKey: 'hero', content: managedImage('hero-guid', '/temp/hero.jpg') },
      { blockKey: 'body', content: managedImage('body-guid', '/temp/body.jpg') },
    ]
    const result = resolvePageManagedMediaReferences(blocks, [
      { fileGuid: 'hero-guid', publicUrl: 'https://cdn.example.com/hero.jpg' },
    ])

    expect(result.resolved).toBe(false)
    expect(result.blocks).toEqual(blocks)
    expect(result.resolvedFileGuids).toEqual([])
    expect(result.blockFailures).toEqual([
      {
        blockKey: 'body',
        failures: [{ code: 'missing-resolution', fileGuids: ['body-guid'] }],
      },
    ])
  })
})
