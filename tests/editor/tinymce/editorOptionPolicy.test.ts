import { describe, expect, it } from 'vitest'
import {
  withoutContextMenuItems,
  withoutToolbarItems,
} from '../../../src/editor/tinymce/editorOptionPolicy'

describe('editor option policy', () => {
  const disabledFeatures = new Set(['cmstemplates', 'cmstablestyles'])

  it('removes disabled optional tools from string and row toolbars', () => {
    expect(
      withoutToolbarItems('undo | cmstemplates table cmstablestyles | code', disabledFeatures),
    ).toBe('undo | table | code')
    expect(
      withoutToolbarItems(['cmstemplates link', 'table cmstablestyles'], disabledFeatures),
    ).toEqual(['link', 'table'])
  })

  it('removes disabled optional tools from context menus', () => {
    expect(
      withoutContextMenuItems('cmstemplates cmslink cmstablestyles table', disabledFeatures),
    ).toBe('cmslink table')
  })
})
