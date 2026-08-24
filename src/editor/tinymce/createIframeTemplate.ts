interface TinyMceIframeTemplateData {
  source: string
  width?: string
  height?: string
  allowfullscreen?: boolean
}

const escapeAttribute = (value: string): string => {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML.replace(/"/g, '&quot;')
}

const getFallbackIframeTitle = (source: string): string => {
  try {
    const url = new URL(source, window.location.href)
    return `Embedded content from ${url.hostname}`
  } catch {
    return 'Embedded content'
  }
}

export const createIframeTemplate = (data: TinyMceIframeTemplateData): string => {
  const width = data.width || '560'
  const height = data.height || '314'
  const allowFullscreen = data.allowfullscreen ? ' allowfullscreen="allowfullscreen"' : ''

  return `<iframe src="${escapeAttribute(data.source)}" title="${escapeAttribute(
    getFallbackIframeTitle(data.source),
  )}" width="${escapeAttribute(width)}" height="${escapeAttribute(height)}"${allowFullscreen}></iframe>`
}
