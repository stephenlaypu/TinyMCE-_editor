import { describe, expect, it } from 'vitest'
import { analyzeCss, scopeCss } from '../../src/editor/cssPolicy'

describe('CSS policy', () => {
  it('uses the CSS grammar to scope selector lists and nested at-rules', () => {
    const result = scopeCss(
      `
        .card, :is(.primary, .secondary) > p { color: currentColor; }
        @media (max-width: 40rem) { .card { display: block; } }
        @keyframes reveal { from { opacity: 0; } to { opacity: 1; } }
      `,
      '.cms-content[data-content-id="sample"]',
    )

    expect(result.scoped).toBe(true)
    expect(result.css).toContain(':where(.cms-content[data-content-id="sample"]) .card,')
    expect(result.css).toContain(
      ':where(.cms-content[data-content-id="sample"])  :is(.primary, .secondary) > p',
    )
    expect(result.css).toContain(
      '@media (max-width: 40rem) { :where(.cms-content[data-content-id="sample"]) .card',
    )
    expect(result.css).toContain('@keyframes reveal')
    expect(result.css).not.toContain(
      '@keyframes reveal { :where(.cms-content[data-content-id="sample"]) from',
    )
  })

  it('keeps CSS nesting relative to the scoped outer selector', () => {
    const result = scopeCss('.card { & .title { color: red; } }', '.cms-content')

    expect(result.scoped).toBe(true)
    expect(result.css).toBe(':where(.cms-content) .card { & .title { color: red; } }')
  })

  it('fails closed for global selectors and invalid CSS', () => {
    const global = scopeCss('body .dialog { display: block; }', '.cms-content')
    const invalid = scopeCss('.card { color: red;', '.cms-content')

    expect(global).toMatchObject({ scoped: false, failures: ['global-selector'] })
    expect(global.css).toBe('body .dialog { display: block; }')
    expect(invalid.scoped).toBe(false)
    expect(invalid.failures).toContain('invalid-css')
  })

  it('reports source locations for global selectors', () => {
    const source = ':root { color: black; } @media (width > 10rem) { html body { margin: 0; } }'
    const analysis = analyzeCss(source)

    expect(analysis.syntaxErrors).toHaveLength(0)
    expect(analysis.globalSelectors.map(({ selector }) => selector)).toEqual([':root', 'html body'])
  })
})
