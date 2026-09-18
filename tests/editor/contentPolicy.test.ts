import { describe, expect, it } from 'vitest'
import {
  analyzeContentCapabilities,
  evaluateContentForPublication,
  publicationPolicyPresets,
} from '../../src/editor/contentPolicy'

describe('content publication policy', () => {
  it('reports reusable content capabilities without rewriting content', () => {
    const content = {
      html: `
        <style>@media (max-width: 40rem) { .panel { position: fixed; } }</style>
        <section id="duplicate" style="margin: 1rem">
          <input id="tab" type="radio"><label for="tab">Tab</label>
          <svg viewBox="0 0 10 10"><path d="M0 0h10"></path></svg>
        </section>
        <div id="duplicate"></div>
      `,
      css: '@keyframes reveal { from { opacity: 0; } to { opacity: 1; } }',
      js: '',
    }

    const report = analyzeContentCapabilities(content)

    expect(report.counts).toMatchObject({
      embeddedStyles: 1,
      inlineStyles: 1,
      inlineSvg: 1,
      formControls: 1,
      cssMediaQueries: 1,
      cssKeyframes: 1,
      fixedPositioning: 1,
    })
    expect(report.duplicateIds).toEqual(['duplicate'])
    expect(report.cssSyntaxErrorCount).toBe(0)
    expect(report.globalCssSelectors).toEqual([])
    expect(content.html).toContain('<style>')
  })

  it('blocks dangerous active HTML regardless of flexible formatting policy', () => {
    const result = evaluateContentForPublication(
      {
        html: `
          <a href="javascript:alert(1)" onclick="alert(1)">Unsafe</a>
          <script>alert(1)</script>
          <object data="/legacy.swf"></object>
        `,
        css: '',
        js: '',
      },
      publicationPolicyPresets.flexibleContent,
    )

    expect(result.canPublish).toBe(false)
    expect(result.violations.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'script-elements-in-html',
        'event-handlers-in-html',
        'unsafe-active-url',
        'object-embed-elements',
      ]),
    )
  })

  it('distinguishes preserved JavaScript from JavaScript allowed only in a sandbox', () => {
    const content = {
      html: '<p>Interactive content</p>',
      css: '',
      js: 'document.body.dataset.ready = "true"',
    }

    const disabled = evaluateContentForPublication(
      content,
      publicationPolicyPresets.flexibleContent,
    )
    const sandboxed = evaluateContentForPublication(content, {
      ...publicationPolicyPresets.flexibleContent,
      customJavaScript: 'sandboxed',
    })

    expect(disabled.canPublish).toBe(false)
    expect(disabled.violations).toContainEqual({
      code: 'custom-javascript-disabled',
      count: 1,
    })
    expect(sandboxed.canPublish).toBe(true)
    expect(sandboxed.requiresSandboxedJavaScript).toBe(true)
  })

  it('blocks external CSS resources while allowing responsive CSS itself', () => {
    const result = evaluateContentForPublication(
      {
        html: '<div class="card">Card</div>',
        css: '@import url("https://example.com/site.css"); @media (max-width: 40rem) { .card { display: block; } }',
        js: '',
      },
      publicationPolicyPresets.flexibleContent,
    )

    expect(result.canPublish).toBe(false)
    expect(result.capabilities.counts.cssMediaQueries).toBe(1)
    expect(result.violations).toContainEqual({
      code: 'external-css-resources-denied',
      count: 2,
    })
  })

  it('does not treat documentation inside CSS comments as an active capability', () => {
    const report = analyzeContentCapabilities({
      html: '<p>CSS documentation</p>',
      css: '/* Example only: @import url("https://example.com/site.css"); position: fixed; */',
      js: '',
    })

    expect(report.counts).toMatchObject({
      cssImports: 0,
      cssUrls: 0,
      fixedPositioning: 0,
    })
  })

  it('blocks invalid CSS and selectors that can affect the document shell', () => {
    const global = evaluateContentForPublication(
      { html: '<p>Content</p>', css: 'body .notice { color: red; }', js: '' },
      publicationPolicyPresets.flexibleContent,
    )
    const invalid = evaluateContentForPublication(
      { html: '<p>Content</p>', css: '.notice { color: red;', js: '' },
      publicationPolicyPresets.flexibleContent,
    )

    expect(global.violations).toContainEqual({
      code: 'global-css-selectors-denied',
      count: 1,
      values: ['body .notice'],
    })
    expect(invalid.violations).toContainEqual({ code: 'invalid-css', count: 1 })
  })

  it('blocks preview, temporary, admin and unresolved managed media in every preset', () => {
    const result = evaluateContentForPublication(
      {
        html: `
          <img src="blob:https://admin.example/id">
          <img src="/temp/image.png" data-cms-file-guid="temp-guid" data-cms-file-state="temporary">
          <img src="/media/image.png" data-cms-file-guid="unknown-guid">
          <video src="/webadmin/files/download/video"></video>
        `,
        css: '',
        js: '',
      },
      publicationPolicyPresets.flexibleContent,
    )

    expect(result.canPublish).toBe(false)
    expect(result.violations.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'preview-media-url',
        'temporary-media-asset',
        'unknown-managed-media-state',
        'admin-media-url',
      ]),
    )
  })

  it('allows active file-library media and applies the unmanaged media policy', () => {
    const active = evaluateContentForPublication(
      {
        html: '<img src="/media/image.png" data-cms-file-guid="image-guid" data-cms-file-state="active">',
        css: '',
        js: '',
      },
      publicationPolicyPresets.managed,
    )
    const unmanaged = evaluateContentForPublication(
      { html: '<img src="https://cdn.example.com/image.png">', css: '', js: '' },
      publicationPolicyPresets.managed,
    )

    expect(active.canPublish).toBe(true)
    expect(active.capabilities.media.fileGuids).toEqual(['image-guid'])
    expect(unmanaged.violations).toContainEqual({
      code: 'unmanaged-media-denied',
      count: 1,
      values: ['https://cdn.example.com/image.png'],
    })
  })
})
