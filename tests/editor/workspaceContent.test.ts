import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyBasicHtmlChange,
  extractLegacyStyles,
  mergeCss,
} from '../../src/editor/workspaceContent'

describe('workspace content round trip', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('extracts legacy style elements without changing the remaining body markup', () => {
    const result = extractLegacyStyles(
      '<style>.legacy { color: red; }</style><p class="legacy">內容</p>',
    )

    expect(result).toEqual({
      html: '<p class="legacy">內容</p>',
      css: '.legacy { color: red; }',
      didExtract: true,
    })
  })

  it('preserves advanced CSS and JavaScript when basic HTML changes', () => {
    const original = {
      html: '<section class="feature">原始內容</section>',
      css: '.feature { font-size: 1rem; }',
      js: 'document.querySelector(".feature")?.classList.add("ready")',
    }

    expect(applyBasicHtmlChange(original, '<section class="feature">更新內容</section>')).toEqual({
      ...original,
      html: '<section class="feature">更新內容</section>',
    })
  })

  it('migrates legacy CSS without duplicating an existing stylesheet', () => {
    const css = '.feature { color: blue; }'

    expect(mergeCss(css, '', css)).toBe(css)
  })
})
