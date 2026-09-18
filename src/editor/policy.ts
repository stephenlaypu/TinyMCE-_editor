export type EditorMode = 'strict' | 'normal'
export type AccessibilityProfile = 'content-quality' | 'tw-aa-110'
export type MediaInsertionMode = 'enabled' | 'disabled'

export interface EditorPolicy {
  mode: EditorMode
  accessibilityProfile: AccessibilityProfile
  advancedWorkspaceEnabled: boolean
  customCssEnabled: boolean
  customJavaScriptEnabled: boolean
  mediaInsertion: MediaInsertionMode
  cmsTemplatesEnabled: boolean
  cmsTableStylesEnabled: boolean
}

export type EditorPolicyOverride = Partial<EditorPolicy>

export const defaultEditorPolicy: Readonly<EditorPolicy> = Object.freeze({
  mode: 'strict',
  accessibilityProfile: 'tw-aa-110',
  advancedWorkspaceEnabled: false,
  customCssEnabled: false,
  customJavaScriptEnabled: false,
  mediaInsertion: 'disabled',
  cmsTemplatesEnabled: false,
  cmsTableStylesEnabled: false,
})

export const editorPolicyPresets = Object.freeze({
  managed: Object.freeze<EditorPolicy>({
    mode: 'strict',
    accessibilityProfile: 'tw-aa-110',
    advancedWorkspaceEnabled: false,
    customCssEnabled: false,
    customJavaScriptEnabled: false,
    mediaInsertion: 'disabled',
    cmsTemplatesEnabled: false,
    cmsTableStylesEnabled: false,
  }),
  flexibleContent: Object.freeze<EditorPolicy>({
    mode: 'normal',
    accessibilityProfile: 'tw-aa-110',
    advancedWorkspaceEnabled: true,
    customCssEnabled: true,
    customJavaScriptEnabled: false,
    mediaInsertion: 'disabled',
    cmsTemplatesEnabled: false,
    cmsTableStylesEnabled: false,
  }),
})

export const resolveEditorPolicy = (
  base: EditorPolicy = defaultEditorPolicy,
  override: EditorPolicyOverride = {},
): EditorPolicy => {
  const resolved = { ...base, ...override }

  return {
    ...resolved,
    advancedWorkspaceEnabled: resolved.mode === 'normal' && resolved.advancedWorkspaceEnabled,
  }
}
