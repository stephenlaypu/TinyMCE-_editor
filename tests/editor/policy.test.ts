import { describe, expect, it } from 'vitest'
import {
  defaultEditorPolicy,
  editorPolicyPresets,
  resolveEditorPolicy,
} from '../../src/editor/policy'

describe('editor policy', () => {
  it('uses a conservative host default', () => {
    expect(resolveEditorPolicy()).toEqual(defaultEditorPolicy)
    expect(defaultEditorPolicy).toMatchObject({
      mode: 'strict',
      accessibilityProfile: 'tw-aa-110',
      advancedWorkspaceEnabled: false,
      customCssEnabled: false,
      customJavaScriptEnabled: false,
      mediaInsertion: 'disabled',
      cmsTemplatesEnabled: false,
      cmsTableStylesEnabled: false,
    })
  })

  it('lets the host override independent editor capabilities', () => {
    expect(
      resolveEditorPolicy(defaultEditorPolicy, {
        mode: 'normal',
        accessibilityProfile: 'tw-aa-110',
        mediaInsertion: 'disabled',
        cmsTemplatesEnabled: false,
      }),
    ).toEqual({
      mode: 'normal',
      accessibilityProfile: 'tw-aa-110',
      advancedWorkspaceEnabled: false,
      customCssEnabled: false,
      customJavaScriptEnabled: false,
      mediaInsertion: 'disabled',
      cmsTemplatesEnabled: false,
      cmsTableStylesEnabled: false,
    })
  })

  it('never enables the advanced workspace in strict mode', () => {
    expect(
      resolveEditorPolicy(editorPolicyPresets.flexibleContent, {
        mode: 'strict',
        advancedWorkspaceEnabled: true,
      }).advancedWorkspaceEnabled,
    ).toBe(false)
  })

  it('provides conservative reusable presets without enabling JavaScript implicitly', () => {
    expect(editorPolicyPresets.managed).toMatchObject({
      mode: 'strict',
      mediaInsertion: 'disabled',
      advancedWorkspaceEnabled: false,
      customCssEnabled: false,
      customJavaScriptEnabled: false,
    })
    expect(editorPolicyPresets.flexibleContent).toMatchObject({
      mode: 'normal',
      mediaInsertion: 'disabled',
      advancedWorkspaceEnabled: true,
      customCssEnabled: true,
      customJavaScriptEnabled: false,
    })
  })
})
