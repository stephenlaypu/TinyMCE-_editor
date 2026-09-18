import { describe, expect, it } from 'vitest'
import { publicationPolicyPresets } from '../../src/editor/contentPolicy'
import {
  evaluatePageContentForPublication,
  preparePageContentForPublication,
} from '../../src/editor/pageContentPolicy'

const content = (html: string, js = '') => ({ html, css: '', js })

describe('page content publication policy', () => {
  it('combines block evaluation with cross-block collision blockers', () => {
    const report = evaluatePageContentForPublication(
      [
        { blockKey: 'hero', content: content('<h2 id="title">Hero</h2>') },
        { blockKey: 'tabs', content: content('<h2 id="title">Tabs</h2>') },
      ],
      {
        content: publicationPolicyPresets.flexibleContent,
        identifierCollisions: 'deny',
      },
    )

    expect(report.canPublish).toBe(false)
    expect(report.violations).toContainEqual({
      code: 'cross-block-id',
      count: 1,
      values: ['title'],
      blockKeys: ['hero', 'tabs'],
    })
    expect(report.blocks.every(({ evaluation }) => evaluation.canPublish)).toBe(true)
  })

  it('accepts collisions when every affected block can be safely namespaced', () => {
    const report = evaluatePageContentForPublication(
      [
        { blockKey: 'a', content: content('<input id="tab" type="radio" name="tabs">') },
        { blockKey: 'b', content: content('<input id="tab" type="radio" name="tabs">') },
      ],
      {
        content: publicationPolicyPresets.flexibleContent,
        identifierCollisions: 'namespace',
      },
    )

    expect(report.canPublish).toBe(true)
    expect(report.collisions.ids).toHaveLength(1)
    expect(report.collisions.radioNames).toHaveLength(1)
    expect(report.namespaceFailures).toEqual([])
  })

  it('fails closed when a colliding block contains JavaScript references', () => {
    const report = evaluatePageContentForPublication(
      [
        { blockKey: 'a', content: content('<div id="panel"></div>', 'openPanel("panel")') },
        { blockKey: 'b', content: content('<div id="panel"></div>') },
      ],
      {
        content: {
          ...publicationPolicyPresets.flexibleContent,
          customJavaScript: 'sandboxed',
        },
        identifierCollisions: 'namespace',
      },
    )

    expect(report.canPublish).toBe(false)
    expect(report.requiresSandboxedJavaScript).toBe(true)
    expect(report.namespaceFailures).toEqual([
      { blockKey: 'a', failures: [{ code: 'custom-javascript' }] },
    ])
    expect(report.violations).toContainEqual({
      code: 'identifier-namespace-failed',
      count: 1,
      blockKeys: ['a'],
    })
  })

  it('permits collisions only with an explicit isolated-document renderer policy', () => {
    const report = evaluatePageContentForPublication(
      [
        { blockKey: 'a', content: content('<div id="panel"></div>', 'openPanel("panel")') },
        { blockKey: 'b', content: content('<div id="panel"></div>') },
      ],
      {
        content: {
          ...publicationPolicyPresets.flexibleContent,
          customJavaScript: 'sandboxed',
        },
        identifierCollisions: 'isolated-document',
      },
    )

    expect(report.canPublish).toBe(true)
    expect(report.requiresSandboxedJavaScript).toBe(true)
    expect(report.requiresIsolatedDocuments).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('keeps isolated rendering mandatory even before content introduces a collision', () => {
    const report = evaluatePageContentForPublication(
      [{ blockKey: 'a', content: content('<p>Static content</p>') }],
      {
        content: publicationPolicyPresets.flexibleContent,
        identifierCollisions: 'isolated-document',
      },
    )

    expect(report.canPublish).toBe(true)
    expect(report.requiresIsolatedDocuments).toBe(true)
  })

  it('blocks duplicate block keys because audit and namespace identity are ambiguous', () => {
    const report = evaluatePageContentForPublication(
      [
        { blockKey: 'duplicate', content: content('<p>A</p>') },
        { blockKey: 'duplicate', content: content('<p>B</p>') },
      ],
      {
        content: publicationPolicyPresets.flexibleContent,
        identifierCollisions: 'namespace',
      },
    )

    expect(report.canPublish).toBe(false)
    expect(report.violations).toContainEqual({
      code: 'duplicate-block-key',
      count: 1,
      values: ['duplicate'],
      blockKeys: ['duplicate'],
    })
  })

  it('creates a namespaced publication copy without modifying stored blocks', () => {
    const blocks = [
      {
        blockKey: 'a',
        content: content('<h2 id="title">A</h2><a href="#title">Go</a>'),
      },
      {
        blockKey: 'b',
        content: content('<h2 id="title">B</h2><a href="#title">Go</a>'),
      },
    ]
    const result = preparePageContentForPublication(blocks, {
      content: publicationPolicyPresets.flexibleContent,
      identifierCollisions: 'namespace',
    })

    expect(result.ready).toBe(true)
    expect(result.renderMode).toBe('same-document')
    expect(result.transformedBlockKeys).toEqual(['a', 'b'])
    expect(result.blocks[0]?.content.html).toContain('id="block-a-title"')
    expect(result.blocks[0]?.content.html).toContain('href="#block-a-title"')
    expect(result.blocks[1]?.content.html).toContain('id="block-b-title"')
    expect(blocks[0]?.content.html).toContain('id="title"')
  })

  it('rejects a transformed copy if generated IDs collide with an untouched block', () => {
    const blocks = [
      { blockKey: 'a', content: content('<div id="panel"></div>') },
      { blockKey: 'b', content: content('<div id="panel"></div>') },
      { blockKey: 'c', content: content('<div id="block-a-panel"></div>') },
    ]
    const result = preparePageContentForPublication(blocks, {
      content: publicationPolicyPresets.flexibleContent,
      identifierCollisions: 'namespace',
    })

    expect(result.ready).toBe(false)
    expect(result.blocks).toEqual(blocks)
    expect(result.transformedBlockKeys).toEqual([])
    expect(result.failures).toEqual([
      {
        code: 'residual-identifier-collision',
        values: ['block-a-panel'],
        blockKeys: ['a', 'c'],
      },
    ])
  })

  it('returns an isolated renderer plan without pretending to transform content', () => {
    const blocks = [
      { blockKey: 'a', content: content('<div id="panel"></div>') },
      { blockKey: 'b', content: content('<div id="panel"></div>') },
    ]
    const result = preparePageContentForPublication(blocks, {
      content: publicationPolicyPresets.flexibleContent,
      identifierCollisions: 'isolated-document',
    })

    expect(result.ready).toBe(true)
    expect(result.renderMode).toBe('isolated-document')
    expect(result.blocks).toEqual(blocks)
    expect(result.transformedBlockKeys).toEqual([])
  })

  it('propagates media lifecycle blockers from a block to the page report', () => {
    const report = evaluatePageContentForPublication(
      [{ blockKey: 'hero', content: content('<img src="blob:https://admin.example/id">') }],
      {
        content: publicationPolicyPresets.flexibleContent,
        identifierCollisions: 'deny',
      },
    )

    expect(report.canPublish).toBe(false)
    expect(report.blocks[0]?.evaluation.violations).toContainEqual({
      code: 'preview-media-url',
      count: 1,
      values: ['blob:https://admin.example/id'],
    })
  })
})
