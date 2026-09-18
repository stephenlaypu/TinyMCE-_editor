import { describe, expect, it } from 'vitest'
import {
  withoutMediaInsertionContextMenu,
  withoutMediaInsertionPlugins,
  withoutMediaInsertionToolbar,
} from '../../../src/editor/tinymce/mediaInsertionPolicy'

describe('media insertion policy', () => {
  it('removes image and media plugins from string and array configurations', () => {
    expect(withoutMediaInsertionPlugins('lists image,media table')).toBe('lists table')
    expect(withoutMediaInsertionPlugins(['lists', 'IMAGE', 'media', 'table'])).toEqual([
      'lists',
      'table',
    ])
  })

  it('removes media buttons and empty toolbar groups', () => {
    expect(
      withoutMediaInsertionToolbar(
        'undo redo | link image insertvideo embediframe | table | image',
      ),
    ).toBe('undo redo | link | table')
    expect(withoutMediaInsertionToolbar(['link image', 'insertvideo | table'])).toEqual([
      'link',
      'table',
    ])
    expect(
      withoutMediaInsertionToolbar([
        { name: 'content', items: ['link', 'image', 'insertvideo'] },
        { name: 'structure', items: ['table'] },
      ]),
    ).toEqual([
      { name: 'content', items: ['link'] },
      { name: 'structure', items: ['table'] },
    ])
    expect(withoutMediaInsertionToolbar(false)).toBe(false)
  })

  it('removes media context menus without changing unrelated entries', () => {
    expect(withoutMediaInsertionContextMenu('cmsmedia cmslink image table')).toBe('cmslink table')
    expect(withoutMediaInsertionContextMenu(['cmsmedia', 'image', 'cmslink', 'table'])).toEqual([
      'cmslink',
      'table',
    ])
    expect(withoutMediaInsertionContextMenu(false)).toBe(false)
  })
})
