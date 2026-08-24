import formattingTokens from './cmsFormattingTokens.json'

interface ColorToken {
  value: string
  labelZhTw: string
  labelEnUs: string
  className: string
}

interface BorderStyleToken {
  value: string
  title: string
  className: string
}

interface VerticalAlignmentToken {
  value: string
  className: string
}

interface ListStyleToken {
  value: string
  className: string
}

interface FontFamilyToken {
  title: string
  value: string
  fontFamily: string | null
}

interface FontSizeToken {
  title: string
  className: string
  fontSize: string | null
}

export const editorTextColorPalette = formattingTokens.textColors as ColorToken[]
export const editorBackgroundColorPalette = formattingTokens.backgroundColors as ColorToken[]
export const editorBorderColorPalette = formattingTokens.borderColors as ColorToken[]

export const getColorTokenLabel = (token: ColorToken, locale: string) =>
  locale === 'en-US' ? token.labelEnUs : token.labelZhTw

const toTinyMceColorMap = (palette: ColorToken[], locale: string) =>
  palette.flatMap((token) => [token.value, getColorTokenLabel(token, locale)])

const toTinyMceTableColorMap = (palette: ColorToken[], locale: string) =>
  palette.map((token) => ({ title: getColorTokenLabel(token, locale), value: token.value }))

export const getEditorTextColorMap = (locale: string) =>
  toTinyMceColorMap(editorTextColorPalette, locale)
export const getEditorBackgroundColorMap = (locale: string) =>
  toTinyMceColorMap(editorBackgroundColorPalette, locale)
export const getEditorTableBackgroundColorMap = (locale: string) =>
  toTinyMceTableColorMap(editorBackgroundColorPalette, locale)
export const getEditorTableBorderColorMap = (locale: string) =>
  toTinyMceTableColorMap(editorBorderColorPalette, locale)

export const editorColorClassByValue = new Map<string, string>(
  editorTextColorPalette.map(({ value, className }) => [value, `cms-color-${className}`]),
)
export const editorBackgroundColorClassByValue = new Map<string, string>(
  editorBackgroundColorPalette.map(({ value, className }) => [value, `cms-bg-${className}`]),
)
export const editorBorderColorClassByValue = new Map<string, string>(
  editorBorderColorPalette.map(({ value, className }) => [value, `cms-border-${className}`]),
)

const createElementColorClassMap = (prefix: string, palette: ColorToken[]) =>
  new Map<string, string>(palette.map(({ value, className }) => [value, `${prefix}-${className}`]))

export const tableBackgroundColorClassByValue = createElementColorClassMap(
  'cms-table-bg',
  editorBackgroundColorPalette,
)
export const rowBackgroundColorClassByValue = createElementColorClassMap(
  'cms-row-bg',
  editorBackgroundColorPalette,
)
export const cellBackgroundColorClassByValue = createElementColorClassMap(
  'cms-cell-bg',
  editorBackgroundColorPalette,
)
export const tableBorderColorClassByValue = createElementColorClassMap(
  'cms-table-border',
  editorBorderColorPalette,
)
export const rowBorderColorClassByValue = createElementColorClassMap(
  'cms-row-border',
  editorBorderColorPalette,
)
export const cellBorderColorClassByValue = createElementColorClassMap(
  'cms-cell-border',
  editorBorderColorPalette,
)

export const editorBorderStyleOptions = formattingTokens.borderStyles as BorderStyleToken[]
export const cellVerticalAlignOptions = formattingTokens.verticalAlignments as VerticalAlignmentToken[]
export const editorListStyleOptions = formattingTokens.listStyles as ListStyleToken[]

const createStyleClassMap = (prefix: string, options: BorderStyleToken[]) =>
  new Map<string, string>(options.map(({ value, className }) => [value, `${prefix}-${className}`]))

export const editorBorderStyleClassByValue = createStyleClassMap(
  'cms-border-style',
  editorBorderStyleOptions,
)
export const tableBorderStyleClassByValue = createStyleClassMap(
  'cms-table-border-style',
  editorBorderStyleOptions,
)
export const rowBorderStyleClassByValue = createStyleClassMap(
  'cms-row-border-style',
  editorBorderStyleOptions,
)
export const cellBorderStyleClassByValue = createStyleClassMap(
  'cms-cell-border-style',
  editorBorderStyleOptions,
)
export const cellVerticalAlignClassByValue = new Map<string, string>(
  cellVerticalAlignOptions.map(({ value, className }) => [value, `cms-cell-valign-${className}`]),
)
export const editorListStyleClassByValue = new Map<string, string>(
  editorListStyleOptions.map(({ value, className }) => [value, `cms-list-${className}`]),
)

export const editorColorClasses = [...editorColorClassByValue.values()]
export const editorBackgroundColorClasses = [...editorBackgroundColorClassByValue.values()]
export const editorBorderColorClasses = [...editorBorderColorClassByValue.values()]
export const tableBackgroundColorClasses = [...tableBackgroundColorClassByValue.values()]
export const rowBackgroundColorClasses = [...rowBackgroundColorClassByValue.values()]
export const cellBackgroundColorClasses = [...cellBackgroundColorClassByValue.values()]
export const tableBorderColorClasses = [...tableBorderColorClassByValue.values()]
export const rowBorderColorClasses = [...rowBorderColorClassByValue.values()]
export const cellBorderColorClasses = [...cellBorderColorClassByValue.values()]
export const editorBorderStyleClasses = [...editorBorderStyleClassByValue.values()]
export const tableBorderStyleClasses = [...tableBorderStyleClassByValue.values()]
export const rowBorderStyleClasses = [...rowBorderStyleClassByValue.values()]
export const cellBorderStyleClasses = [...cellBorderStyleClassByValue.values()]
export const cellVerticalAlignClasses = [...cellVerticalAlignClassByValue.values()]
export const editorListStyleClasses = [...editorListStyleClassByValue.values()]

export const preserveExistingTableClassList = [
  { title: '保留既有樣式', value: 'mce-no-match' },
]

export const defaultEditorFontValue = 'cms-font-default'
export const editorFontFamilies = formattingTokens.fontFamilies as FontFamilyToken[]
export const editorFontFamilyFormats = editorFontFamilies
  .map(({ title, value }) => `${title}=${value}`)
  .join(';')
export const editorFontClasses = editorFontFamilies
  .map(({ value }) => value)
  .filter((value) => value !== defaultEditorFontValue)

export const defaultEditorFontSizeValue = 'cms-font-size-default'
export const editorFontSizes = formattingTokens.fontSizes as FontSizeToken[]
export const editorFontSizeFormats = editorFontSizes
  .map(({ title, className }) => `${title}=${className}`)
  .join(' ')
export const editorFontSizeClasses = editorFontSizes
  .map(({ className }) => className)
  .filter((className) => className !== defaultEditorFontSizeValue)
