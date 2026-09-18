import {
  withoutContextMenuItems,
  withoutPluginItems,
  withoutToolbarItems,
  type ContextMenuConfig,
  type ToolbarConfig,
} from './editorOptionPolicy'

const mediaPluginNames = new Set(['image', 'media'])
const mediaToolbarNames = new Set(['image', 'insertvideo', 'embediframe'])
const mediaContextMenuNames = new Set(['cmsmedia', 'image'])

export const withoutMediaInsertionPlugins = (value: string | string[]): string | string[] =>
  withoutPluginItems(value, mediaPluginNames)

export const withoutMediaInsertionToolbar = (value: ToolbarConfig): ToolbarConfig =>
  withoutToolbarItems(value, mediaToolbarNames)

export const withoutMediaInsertionContextMenu = (value: ContextMenuConfig): ContextMenuConfig =>
  withoutContextMenuItems(value, mediaContextMenuNames)
