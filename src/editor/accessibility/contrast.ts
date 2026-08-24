interface RgbaColor {
  red: number
  green: number
  blue: number
  alpha: number
}

const white: RgbaColor = { red: 255, green: 255, blue: 255, alpha: 1 }

const parseRgbColor = (value: string): RgbaColor | null => {
  const channels = value.match(/[\d.]+/g)?.map(Number)

  if (!channels || channels.length < 3) {
    return null
  }

  return {
    red: channels[0],
    green: channels[1],
    blue: channels[2],
    alpha: channels[3] ?? 1,
  }
}

const compositeColor = (foreground: RgbaColor, background: RgbaColor): RgbaColor => {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha)

  if (alpha === 0) {
    return { red: 0, green: 0, blue: 0, alpha: 0 }
  }

  return {
    red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
    green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
    blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
    alpha,
  }
}

const linearizeChannel = (channel: number): number => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

const getRelativeLuminance = (color: RgbaColor): number =>
  0.2126 * linearizeChannel(color.red) +
  0.7152 * linearizeChannel(color.green) +
  0.0722 * linearizeChannel(color.blue)

const getEffectiveBackground = (element: Element, view: Window): RgbaColor | null => {
  const ancestors: Element[] = []
  let current: Element | null = element

  while (current) {
    ancestors.unshift(current)
    current = current.parentElement
  }

  let background = white

  for (const ancestor of ancestors) {
    const style = view.getComputedStyle(ancestor)

    if (style.backgroundImage !== 'none') {
      return null
    }

    const color = parseRgbColor(style.backgroundColor)
    if (color && color.alpha > 0) {
      background = compositeColor(color, background)
    }
  }

  return background
}

export const getElementTextContrastRatio = (element: Element): number | null => {
  const view = element.ownerDocument.defaultView

  if (!view) {
    return null
  }

  const style = view.getComputedStyle(element)
  const foreground = parseRgbColor(style.color)
  const background = getEffectiveBackground(element, view)

  if (!foreground || !background) {
    return null
  }

  const opaqueForeground = compositeColor(foreground, background)
  const foregroundLuminance = getRelativeLuminance(opaqueForeground)
  const backgroundLuminance = getRelativeLuminance(background)

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}
