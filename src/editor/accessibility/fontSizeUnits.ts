export interface AbsoluteFontSizeMatch {
  index: number
  value: string
}

const absoluteFontSizeUnitPattern =
  /(^|[^a-z0-9_-])((?:\d+(?:\.\d+)?|\.\d+)(?:px|pt|pc|in|cm|mm|q)\b)/i

export const findAbsoluteFontSizeUnit = (value: string): AbsoluteFontSizeMatch | null => {
  const match = absoluteFontSizeUnitPattern.exec(value)

  if (!match || match.index === undefined) {
    return null
  }

  const prefix = match[1] ?? ''
  const unitValue = match[2] ?? ''

  return {
    index: match.index + prefix.length,
    value: unitValue,
  }
}
