import { describe, expect, it } from 'vitest'
import {
  editorFontSizeFormats,
  relativeEditorFontSizeFormats,
} from '../../../src/editor/tinymce/cmsFormatting'

describe('CMS font-size formats', () => {
  it('uses managed classes for strict mode', () => {
    expect(editorFontSizeFormats).toContain('18px=cms-font-size-18px')
  })

  it('keeps familiar pixel labels but emits relative values for normal mode', () => {
    expect(relativeEditorFontSizeFormats).toContain('14px=0.875rem')
    expect(relativeEditorFontSizeFormats).toContain('18px=1.125rem')
    expect(relativeEditorFontSizeFormats).not.toMatch(/=[\d.]+(?:px|pt)\b/)
  })
})
