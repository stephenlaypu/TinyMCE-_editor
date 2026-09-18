import { describe, expect, it } from 'vitest'
import {
  findContentIdentifierCollisions,
  namespaceContentIdentifiers,
} from '../../src/editor/contentIdentifiers'

describe('content identifier policy', () => {
  it('detects ID and radio group collisions across blocks', () => {
    const report = findContentIdentifierCollisions([
      {
        blockKey: 'block-a',
        content: {
          html: '<h2 id="heading">A</h2><input type="radio" name="tabs">',
          css: '',
          js: '',
        },
      },
      {
        blockKey: 'block-b',
        content: {
          html: '<h2 id="heading">B</h2><input type="radio" name="tabs">',
          css: '',
          js: '',
        },
      },
    ])

    expect(report.ids).toEqual([{ value: 'heading', blockKeys: ['block-a', 'block-b'] }])
    expect(report.radioNames).toEqual([{ value: 'tabs', blockKeys: ['block-a', 'block-b'] }])
  })

  it('namespaces HTML, ARIA, SVG, CSS selectors and radio groups together', () => {
    const result = namespaceContentIdentifiers(
      {
        html: `
          <style>#panel, :is(#panel, .fallback) { clip-path: url(#clip); }</style>
          <section aria-labelledby="heading description">
            <h2 id="heading">Heading</h2>
            <p id="description">Description</p>
            <input id="tab" name="tabs" type="radio" aria-controls="panel">
            <label for="tab">Tab</label>
            <a href="#panel">Panel</a>
            <div id="panel"></div>
            <svg><clipPath id="clip"></clipPath><path fill="url(#clip)" style="clip-path: url(#clip)"></path></svg>
          </section>
        `,
        css: '#panel { color: red; } @media (width > 10rem) { #heading { color: blue; } }',
        js: '',
      },
      'block-42',
    )

    expect(result.transformed).toBe(true)
    expect(result.idMap).toMatchObject({
      heading: 'block-42-heading',
      panel: 'block-42-panel',
      clip: 'block-42-clip',
    })
    expect(result.radioNameMap).toEqual({ tabs: 'block-42-tabs' })
    expect(result.content.html).toContain('aria-labelledby="block-42-heading block-42-description"')
    expect(result.content.html).toContain('for="block-42-tab"')
    expect(result.content.html).toContain('aria-controls="block-42-panel"')
    expect(result.content.html).toContain('href="#block-42-panel"')
    expect(result.content.html).toContain('name="block-42-tabs"')
    expect(result.content.html).toContain('url(#block-42-clip)')
    expect(result.content.html).toContain('fill="url(#block-42-clip)"')
    expect(result.content.html).toContain('#block-42-panel')
    expect(result.content.css).toContain('#block-42-panel')
    expect(result.content.css).toContain('#block-42-heading')
  })

  it('fails without modifying content when references are ambiguous or executable', () => {
    const content = {
      html: '<div id="duplicate"></div><div id="duplicate"></div>',
      css: '.broken { color: red;',
      js: 'document.getElementById("duplicate")',
    }
    const result = namespaceContentIdentifiers(content, 'block-a')

    expect(result.transformed).toBe(false)
    expect(result.content).toEqual(content)
    expect(result.failures.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['custom-javascript', 'duplicate-id', 'invalid-css']),
    )
  })

  it('fails when executable HTML could contain hidden ID references', () => {
    const scriptContent = {
      html: '<div id="panel"></div><script>openPanel("panel")</script>',
      css: '',
      js: '',
    }
    const eventContent = {
      html: '<button id="trigger" onclick="openPanel(\'panel\')">Open</button>',
      css: '',
      js: '',
    }

    expect(namespaceContentIdentifiers(scriptContent, 'block-a')).toMatchObject({
      content: scriptContent,
      transformed: false,
      failures: [{ code: 'executable-html' }],
    })
    expect(namespaceContentIdentifiers(eventContent, 'block-b')).toMatchObject({
      content: eventContent,
      transformed: false,
      failures: [{ code: 'executable-html' }],
    })
  })
})
