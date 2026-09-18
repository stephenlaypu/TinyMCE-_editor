import { describe, expect, it } from 'vitest'
import { publicationPolicyPresets } from '../../src/editor/contentPolicy'
import { prepareResolvedPageContentForPublication } from '../../src/editor/publicationPipeline'

const pagePolicy = {
  content: publicationPolicyPresets.flexibleContent,
  identifierCollisions: 'namespace' as const,
}

describe('page publication pipeline', () => {
  it('resolves managed media before policy evaluation and identifier namespacing', () => {
    const result = prepareResolvedPageContentForPublication(
      [
        {
          blockKey: 'a',
          content: {
            html: '<section id="panel"><img src="/temp/a.jpg" data-cms-file-guid="a-guid" data-cms-file-state="temporary" data-cms-file-source="/temp/a.jpg"></section>',
            css: '#panel { display: block; }',
            js: '',
          },
        },
        {
          blockKey: 'b',
          content: { html: '<section id="panel">B</section>', css: '', js: '' },
        },
      ],
      pagePolicy,
      [{ fileGuid: 'a-guid', publicUrl: 'https://cdn.example.com/a.jpg' }],
    )

    expect(result.ready).toBe(true)
    expect(result.media.resolvedFileGuids).toEqual(['a-guid'])
    expect(result.publication?.transformedBlockKeys).toEqual(['a', 'b'])
    expect(result.blocks[0]?.content.html).toContain('https://cdn.example.com/a.jpg')
    expect(result.blocks[0]?.content.html).toContain('id="block-a-panel"')
    expect(result.blocks[0]?.content.css).toContain('#block-a-panel')
  })

  it('stops atomically before publication preparation when media resolution fails', () => {
    const blocks = [
      {
        blockKey: 'hero',
        content: {
          html: '<img src="/temp/a.jpg" data-cms-file-guid="a-guid" data-cms-file-state="temporary" data-cms-file-source="/temp/a.jpg">',
          css: '',
          js: '',
        },
      },
    ]
    const result = prepareResolvedPageContentForPublication(blocks, pagePolicy, [])

    expect(result.ready).toBe(false)
    expect(result.blocks).toEqual(blocks)
    expect(result.publication).toBeUndefined()
    expect(result.failures).toEqual(['media-resolution-failed'])
  })

  it('still blocks unmanaged preview URLs after the media resolution stage', () => {
    const result = prepareResolvedPageContentForPublication(
      [
        {
          blockKey: 'hero',
          content: { html: '<img src="blob:https://admin.example/id">', css: '', js: '' },
        },
      ],
      pagePolicy,
      [],
    )

    expect(result.media.resolved).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.failures).toEqual(['publication-preparation-failed'])
    expect(result.publication?.evaluation.blocks[0]?.evaluation.violations).toContainEqual({
      code: 'preview-media-url',
      count: 1,
      values: ['blob:https://admin.example/id'],
    })
  })
})
