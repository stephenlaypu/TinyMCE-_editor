import { describe, expect, it } from 'vitest'
import { applyBasicHtmlChange, extractLegacyStyles } from '../../src/editor/workspaceContent'

const capabilitySample = `
  <style>
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); }
    #sample-tab:checked ~ .sample-panel { display: block; }
    @media (max-width: 40rem) { .cards { grid-template-columns: 1fr; } }
    @keyframes reveal { from { opacity: 0; } to { opacity: 1; } }
  </style>
  <section aria-labelledby="sample-heading">
    <h2 id="sample-heading">能力案例</h2>
    <input id="sample-tab" name="sample-tabs" type="radio" checked>
    <label for="sample-tab">頁籤</label>
    <div class="sample-panel" style="margin-block: 1rem">
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 12h16"></path>
      </svg>
    </div>
  </section>
`

describe('workspace capability samples', () => {
  it('extracts embedded CSS without destroying unrelated HTML capabilities', () => {
    const result = extractLegacyStyles(capabilitySample)

    expect(result.didExtract).toBe(true)
    expect(result.html).not.toContain('<style>')
    expect(result.html).toContain('type="radio"')
    expect(result.html).toContain('for="sample-tab"')
    expect(result.html).toContain('<svg')
    expect(result.html).toContain('style="margin-block: 1rem"')
    expect(result.css).toContain('#sample-tab:checked ~ .sample-panel')
    expect(result.css).toContain('@media (max-width: 40rem)')
    expect(result.css).toContain('@keyframes reveal')
  })

  it('preserves CSS and JavaScript fields when applying a basic HTML edit', () => {
    const extracted = extractLegacyStyles(capabilitySample)
    const result = applyBasicHtmlChange(
      {
        html: capabilitySample,
        css: '.existing { color: currentColor; }',
        js: 'window.customFeature = true',
      },
      extracted.html,
      extracted.css,
    )

    expect(result.html).toBe(extracted.html)
    expect(result.css).toContain('.existing { color: currentColor; }')
    expect(result.css).toContain('.cards { display: grid;')
    expect(result.js).toBe('window.customFeature = true')
  })
})
