import type { RawEditorOptions } from 'tinymce'

export type ToolbarConfig = NonNullable<RawEditorOptions['toolbar']>
export type ContextMenuConfig = NonNullable<RawEditorOptions['contextmenu']>

const filterTokenString = (
  value: string,
  blocked: ReadonlySet<string>,
  groupSeparators: boolean,
) => {
  if (!groupSeparators) {
    return value
      .split(/[\s,]+/)
      .filter((token) => token && !blocked.has(token.toLowerCase()))
      .join(' ')
  }

  return value
    .split('|')
    .map((group) =>
      group
        .trim()
        .split(/\s+/)
        .filter((token) => token && !blocked.has(token.toLowerCase()))
        .join(' '),
    )
    .filter(Boolean)
    .join(' | ')
}

export const withoutToolbarTokenItems = (value: string, blocked: ReadonlySet<string>): string =>
  filterTokenString(value, blocked, true)

export const withoutPluginItems = (
  value: string | string[],
  blocked: ReadonlySet<string>,
): string | string[] =>
  Array.isArray(value)
    ? value.filter((token) => !blocked.has(token.toLowerCase()))
    : filterTokenString(value, blocked, false)

export const withoutToolbarItems = (
  value: ToolbarConfig,
  blocked: ReadonlySet<string>,
): ToolbarConfig => {
  if (typeof value === 'boolean') return value
  if (!Array.isArray(value)) return filterTokenString(value, blocked, true)
  if (value.every((row) => typeof row === 'string')) {
    return (value as string[]).map((row) => filterTokenString(row, blocked, true)).filter(Boolean)
  }

  return (value as Array<{ name?: string; label?: string; items: string[] }>).map((group) => ({
    ...group,
    items: group.items.filter((item) => !blocked.has(item.toLowerCase())),
  }))
}

export const withoutContextMenuItems = (
  value: ContextMenuConfig,
  blocked: ReadonlySet<string>,
): ContextMenuConfig => {
  if (value === false) return false
  return Array.isArray(value)
    ? value.filter((item) => !blocked.has(item.toLowerCase()))
    : filterTokenString(value, blocked, false)
}
