import type { AstNode, Editor } from 'tinymce'
import type { AppLocale } from '../i18n'
import type { UploadAdapter } from '../uploads/types'
import { UploadValidationError } from '../uploads/types'
import { uploadFile, videoUploadPolicy } from '../uploads/upload'

export interface MediaToolLabels {
  insertVideo: string
  embedIframe: string
  sourceUrl: string
  posterUrl: string
  videoAccessibilityMode: string
  videoAccessibilityModeAudio: string
  videoAccessibilityModeVisual: string
  videoAccessibilityModeDecorative: string
  captionsUrl: string
  captionsLanguage: string
  captionsLabel: string
  textAlternative: string
  captionsRequired: string
  textAlternativeRequired: string
  iframeTitle: string
  width: string
  height: string
  controls: string
  autoplay: string
  allowFullscreen: string
  cancel: string
  insert: string
  invalidUrl: string
  iframeTitleRequired: string
  iframeDomainNotAllowed: string
  videoFile: string
  uploading: string
  uploadInvalidType: string
  uploadTooLarge: string
  uploadMissingAdapter: string
  uploadFailed: string
  uploadComplete: string
}

export interface MediaToolOptions {
  uploadAdapter?: UploadAdapter
  locale: AppLocale
  allowedIframeDomains?: readonly string[]
}

export const allowedIframeDomains = [
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'www.google.com',
  'google.com',
  'maps.google.com',
  'www.google.com.tw',
  'google.com.tw',
  'player.vimeo.com',
] as const

// TinyMCE strips a leading "www." before matching sandbox exclusions.
export const iframeSandboxExclusions = [
  // Keep trusted embeds sandboxed as well. The whitelist only decides whether an
  // iframe can be kept; it does not opt the iframe out of browser sandboxing.
]

export const trustedIframeSandbox =
  'allow-scripts allow-presentation allow-popups allow-popups-to-escape-sandbox'

const iframeAllowWarningFeatures = new Set(['web-share'])
const notificationTimeout = 5000

type VideoAccessibilityMode = 'audio' | 'visual' | 'decorative'
type NotificationType = 'success' | 'error'

type VideoDialogData = Record<string, unknown> & {
  sourceUrl: string
  posterUrl: string
  accessibilityMode: VideoAccessibilityMode
  captionsUrl: string
  captionsLanguage: string
  captionsLabel: string
  textAlternative: string
  width: string
  height: string
  controls: boolean
  autoplay: boolean
}

type IframeDialogData = Record<string, unknown> & {
  sourceUrl: string
  embedCode: string
  title: string
  width: string
  height: string
  allowFullscreen: boolean
}

interface EditableIframe {
  iframe: HTMLIFrameElement
  previewObject: HTMLElement | null
}

interface EditableVideo {
  video: HTMLVideoElement
  previewObject: HTMLElement | null
  figure: HTMLElement | null
}

const openTimedNotification = (editor: Editor, text: string, type: NotificationType) => {
  editor.notificationManager.open({ text, type, timeout: notificationTimeout })
}

const normalizeWebUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim(), window.location.href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const getAllowedIframeUrl = (
  value: string,
  domains: readonly string[] = allowedIframeDomains,
): URL | null => {
  const normalizedUrl = normalizeWebUrl(value)

  if (!normalizedUrl) {
    return null
  }

  const url = new URL(normalizedUrl)
  const allowedDomainSet = new Set(domains.map((domain) => domain.toLowerCase()))
  return allowedDomainSet.has(url.hostname.toLowerCase()) ? url : null
}

export const getFallbackIframeTitle = (source: string | null | undefined): string => {
  if (!source) {
    return 'Embedded content'
  }

  try {
    const url = new URL(source, window.location.href)
    const hostname = url.hostname.replace(/^www\./, '')

    if (hostname.includes('youtube')) {
      return 'YouTube embedded video'
    }

    if (hostname === 'youtu.be') {
      return 'YouTube embedded video'
    }

    if (hostname === 'player.vimeo.com') {
      return 'Vimeo embedded video'
    }

    if (hostname.includes('google.com') || hostname.includes('google.com.tw')) {
      return 'Google embedded content'
    }

    return `Embedded content from ${hostname}`
  } catch {
    return 'Embedded content'
  }
}

const ensureIframeTitleElement = (iframe: HTMLIFrameElement) => {
  if (!iframe.getAttribute('title')?.trim()) {
    iframe.title = getFallbackIframeTitle(iframe.getAttribute('src'))
  }
}

const ensureIframeTitleNode = (iframe: AstNode) => {
  if (!iframe.attr('title')?.trim()) {
    iframe.attr('title', getFallbackIframeTitle(iframe.attr('src')))
  }
}

export const normalizeIframeAllowAttribute = (value: string): string => {
  return value
    .split(';')
    .map((feature) => feature.trim())
    .filter((feature) => {
      const featureName = feature.split(/\s+/, 1)[0]?.toLowerCase()
      return featureName ? !iframeAllowWarningFeatures.has(featureName) : false
    })
    .join('; ')
}

export const isAllowedIframeUrl = (
  value: string | null | undefined,
  domains: readonly string[] = allowedIframeDomains,
): boolean => {
  return value ? getAllowedIframeUrl(value, domains) !== null : false
}

export const normalizeIframeSandboxAttribute = (value: string | null | undefined): string => {
  if (!value) {
    return trustedIframeSandbox
  }

  const sandboxTokens = new Set(value.toLowerCase().split(/\s+/).filter(Boolean))
  sandboxTokens.delete('allow-same-origin')

  if (sandboxTokens.size === 0) {
    return trustedIframeSandbox
  }

  return [...sandboxTokens].join(' ')
}

export const normalizeTrustedIframeElement = (
  iframe: HTMLIFrameElement,
  domains: readonly string[] = allowedIframeDomains,
) => {
  if (!isAllowedIframeUrl(iframe.getAttribute('src'), domains)) {
    return
  }

  ensureIframeTitleElement(iframe)

  iframe.setAttribute('sandbox', normalizeIframeSandboxAttribute(iframe.getAttribute('sandbox')))

  const allow = iframe.getAttribute('allow')
  if (allow) {
    const normalizedAllow = normalizeIframeAllowAttribute(allow)
    if (normalizedAllow) {
      iframe.setAttribute('allow', normalizedAllow)
    } else {
      iframe.removeAttribute('allow')
    }
  }
}

export const normalizeTrustedIframeNode = (
  iframe: AstNode,
  domains: readonly string[] = allowedIframeDomains,
) => {
  if (!isAllowedIframeUrl(iframe.attr('src'), domains)) {
    return
  }

  ensureIframeTitleNode(iframe)

  iframe.attr('sandbox', normalizeIframeSandboxAttribute(iframe.attr('sandbox')))

  const allow = iframe.attr('allow')
  if (allow) {
    const normalizedAllow = normalizeIframeAllowAttribute(allow)
    iframe.attr('allow', normalizedAllow || null)
  }
}

const removeStyleDimensionProperties = (style: string): string => {
  return style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const propertyName = declaration.split(':', 1)[0]?.trim().toLowerCase()
      return propertyName !== 'width' && propertyName !== 'height'
    })
    .join('; ')
}

export const normalizeMediaDimensionNode = (media: AstNode) => {
  const style = media.attr('style')

  if (!style) {
    return
  }

  const styleElement = document.createElement('span')
  styleElement.setAttribute('style', style)
  const width = normalizeDimension(styleElement.style.width, 0)
  const height = normalizeDimension(styleElement.style.height, 0)

  if (width !== '0') {
    media.attr('width', width)
  }

  if (height !== '0') {
    media.attr('height', height)
  }

  const normalizedStyle = removeStyleDimensionProperties(style)
  media.attr('style', normalizedStyle || null)
}

const normalizeMediaUrl = (value: string): string | null => {
  const trimmedValue = value.trim()
  return trimmedValue.startsWith('blob:') ? trimmedValue : normalizeWebUrl(trimmedValue)
}

const pickVideoFile = (onSelect: (file: File) => void) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = videoUploadPolicy.acceptedMimeTypes.join(',')
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0]
      if (file) {
        onSelect(file)
      }
    },
    { once: true },
  )
  input.click()
}

const normalizeIframeUrl = (value: string, domains: readonly string[]): string | null => {
  return getAllowedIframeUrl(value, domains)?.href ?? null
}

const parseIframeEmbedCode = (
  editor: Editor,
  value: string,
  domains: readonly string[],
): HTMLIFrameElement | null => {
  const template = editor.getDoc().createElement('template')
  template.innerHTML = value.trim()
  const iframe = template.content.querySelector('iframe')

  if (!iframe) {
    return null
  }

  const sourceUrl = normalizeIframeUrl(iframe.getAttribute('src') ?? '', domains)

  if (!sourceUrl) {
    return null
  }

  iframe.src = sourceUrl
  normalizeTrustedIframeElement(iframe, domains)
  return iframe
}

const normalizeDimension = (value: string, fallback: number): string => {
  const dimension = Number.parseInt(value, 10)
  return Number.isInteger(dimension) && dimension > 0 && dimension <= 5000
    ? String(dimension)
    : String(fallback)
}

const getUploadErrorMessage = (error: unknown, labels: MediaToolLabels): string => {
  if (error instanceof UploadValidationError) {
    if (error.code === 'invalidType') {
      return labels.uploadInvalidType
    }

    if (error.code === 'tooLarge') {
      return labels.uploadTooLarge
    }

    if (error.code === 'missingAdapter') {
      return labels.uploadMissingAdapter
    }
  }

  return labels.uploadFailed
}

const escapeText = (value: string): string => {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}

const findMediaPreviewObject = (editor: Editor, element: Element): HTMLElement | null => {
  return editor.dom.getParent<HTMLElement>(element, 'span.mce-preview-object')
}

const isMediaPreviewObject = (element: HTMLElement): boolean => {
  const objectType = element.getAttribute('data-mce-object')
  return objectType === 'video' || objectType === 'iframe'
}

const getMediaObjectType = (element: HTMLElement): 'video' | 'iframe' | null => {
  const previewObjectType = element.getAttribute('data-mce-object')

  if (previewObjectType === 'video' || previewObjectType === 'iframe') {
    return previewObjectType
  }

  const tagName = element.tagName.toLowerCase()
  return tagName === 'video' || tagName === 'iframe' ? tagName : null
}

const findContextMediaObject = (editor: Editor, element: Element): HTMLElement | null => {
  const previewObject = findMediaPreviewObject(editor, element)

  if (previewObject && isMediaPreviewObject(previewObject)) {
    return previewObject
  }

  let currentElement: HTMLElement | null = element as HTMLElement

  while (currentElement) {
    if (getMediaObjectType(currentElement)) {
      return currentElement
    }

    currentElement = currentElement.parentElement
  }

  return null
}

const selectMediaObject = (editor: Editor, element: HTMLElement) => {
  editor.selection.select(element)

  if (isMediaPreviewObject(element)) {
    editor.dom.setAttrib(element, 'data-mce-selected', '2')
  }

  editor.nodeChanged()
}

const isInsideMediaObject = (editor: Editor, element: Element): boolean => {
  return Boolean(
    findContextMediaObject(editor, element) ||
    element.closest('figure.cms-video'),
  )
}

const findEditableIframe = (editor: Editor): EditableIframe | null => {
  const selectedNode = editor.selection.getNode()
  const selectedElement = selectedNode as HTMLElement
  const previewObject = isMediaPreviewObject(selectedElement)
    ? selectedElement
    : editor.dom.getParent<HTMLElement>(selectedNode, 'span.mce-preview-object')
  const iframeFromPreview = previewObject?.querySelector<HTMLIFrameElement>('iframe')

  if (iframeFromPreview) {
    return { iframe: iframeFromPreview, previewObject }
  }

  if (selectedNode.tagName?.toLowerCase() === 'iframe') {
    return {
      iframe: selectedNode as HTMLIFrameElement,
      previewObject: editor.dom.getParent<HTMLElement>(selectedNode, 'span.mce-preview-object'),
    }
  }

  return null
}

const getIframeSourceHtml = (target: EditableIframe | null): string => {
  const html = target?.previewObject?.getAttribute('data-mce-html')
  return html ? unescape(html) : target?.iframe.outerHTML ?? ''
}

const updateIframePreviewHtml = (target: EditableIframe, iframe: HTMLIFrameElement) => {
  if (!target.previewObject) {
    target.iframe.replaceWith(iframe)
    return
  }

  target.previewObject.setAttribute('data-mce-p-src', iframe.src)
  target.previewObject.setAttribute('data-mce-p-title', iframe.title)
  target.previewObject.setAttribute('data-mce-p-width', iframe.width)
  target.previewObject.setAttribute('data-mce-p-height', iframe.height)
  target.previewObject.setAttribute('data-mce-html', escape(iframe.outerHTML))

  const previewIframe = target.previewObject.querySelector<HTMLIFrameElement>('iframe')
  previewIframe?.replaceWith(iframe)
}

const findVideoFigure = (element: Element | null): HTMLElement | null => {
  return element?.closest<HTMLElement>('figure.cms-video') ?? null
}

const findEditableVideo = (editor: Editor): EditableVideo | null => {
  const selectedNode = editor.selection.getNode()
  const selectedElement = selectedNode as HTMLElement
  const previewObject = isMediaPreviewObject(selectedElement)
    ? selectedElement
    : editor.dom.getParent<HTMLElement>(selectedNode, 'span.mce-preview-object')
  const videoFromPreview = previewObject?.querySelector<HTMLVideoElement>('video')
  const figure = findVideoFigure(previewObject ?? selectedNode)

  if (videoFromPreview) {
    return {
      video: videoFromPreview,
      previewObject,
      figure,
    }
  }

  if (selectedNode.tagName?.toLowerCase() === 'video') {
    const previewObject = editor.dom.getParent<HTMLElement>(selectedNode, 'span.mce-preview-object')

    return {
      video: selectedNode as HTMLVideoElement,
      previewObject,
      figure: findVideoFigure(selectedNode),
    }
  }

  return null
}

const getVideoSourceUrl = (video: HTMLVideoElement | undefined): string => {
  return video?.querySelector('source')?.getAttribute('src') ?? video?.getAttribute('src') ?? ''
}

const getVideoAccessibilityMode = (video: HTMLVideoElement | undefined): VideoAccessibilityMode => {
  const mode = video?.getAttribute('data-cms-video-a11y-mode')

  if (mode === 'visual' || mode === 'decorative') {
    return mode
  }

  return 'audio'
}

const getVideoCaptionsTrack = (video: HTMLVideoElement | undefined): HTMLTrackElement | null => {
  return video?.querySelector<HTMLTrackElement>('track[kind="captions"], track[kind="subtitles"]') ?? null
}

const getVideoTextAlternative = (figure: HTMLElement | null): string => {
  const textAlternative = figure?.querySelector<HTMLElement>('[data-cms-video-text-alternative]')
  return textAlternative?.textContent?.trim() ?? ''
}

const buildVideoHtml = (
  editor: Editor,
  data: VideoDialogData,
  sourceUrl: string,
  posterUrl: string | null,
  captionsUrl: string | null,
): string => {
  const video = editor.getDoc().createElement('video')
  video.setAttribute('data-cms-video-a11y-mode', data.accessibilityMode)
  video.width = Number(normalizeDimension(data.width, 640))
  video.height = Number(normalizeDimension(data.height, 360))
  video.controls = data.controls
  video.autoplay = data.autoplay
  video.preload = 'metadata'

  if (posterUrl) {
    video.poster = posterUrl
  }

  const source = editor.getDoc().createElement('source')
  source.src = sourceUrl
  video.append(source)

  if (data.accessibilityMode === 'audio' && captionsUrl) {
    const track = editor.getDoc().createElement('track')
    track.kind = 'captions'
    track.src = captionsUrl
    track.srclang = data.captionsLanguage.trim() || 'zh-TW'
    track.label = data.captionsLabel.trim() || '繁體中文字幕'
    track.default = true
    video.append(track)
  }

  const textAlternative = data.textAlternative.trim()

  if (data.accessibilityMode === 'decorative') {
    video.controls = false
    video.muted = true
    video.setAttribute('playsinline', '')
    video.setAttribute('aria-hidden', 'true')
    video.setAttribute('tabindex', '-1')
    return video.outerHTML
  }

  if (data.accessibilityMode === 'visual' && textAlternative) {
    video.setAttribute('aria-label', textAlternative)
  }

  if (!textAlternative) {
    return video.outerHTML
  }

  return `<figure class="cms-video">${video.outerHTML}<figcaption><p data-cms-video-text-alternative>${escapeText(
    textAlternative,
  )}</p></figcaption></figure>`
}

const replaceHtml = (target: HTMLElement, html: string) => {
  const template = target.ownerDocument.createElement('template')
  template.innerHTML = html
  target.replaceWith(template.content)
}

const updateVideoPreviewHtml = (target: EditableVideo, html: string) => {
  if (target.figure) {
    replaceHtml(target.figure, html)
    return
  }

  if (!target.previewObject) {
    replaceHtml(target.video, html)
    return
  }

  replaceHtml(target.previewObject, html)
}

const insertVideo = (editor: Editor, labels: MediaToolLabels, options: MediaToolOptions) => {
  const editableVideo = findEditableVideo(editor)
  const initialVideo = editableVideo?.video
  const initialCaptions = getVideoCaptionsTrack(initialVideo)

  editor.windowManager.open<VideoDialogData>({
    title: labels.insertVideo,
    body: {
      type: 'panel',
      items: [
        { type: 'input', name: 'sourceUrl', label: labels.sourceUrl },
        {
          type: 'button',
          name: 'chooseVideo',
          text: labels.videoFile,
          buttonType: 'secondary',
        },
        {
          type: 'grid',
          columns: 2,
          items: [
            { type: 'input', name: 'posterUrl', label: labels.posterUrl },
            {
              type: 'selectbox',
              name: 'accessibilityMode',
              label: labels.videoAccessibilityMode,
              items: [
                { text: labels.videoAccessibilityModeAudio, value: 'audio' },
                { text: labels.videoAccessibilityModeVisual, value: 'visual' },
                { text: labels.videoAccessibilityModeDecorative, value: 'decorative' },
              ],
            },
          ],
        },
        {
          type: 'input',
          name: 'captionsUrl',
          label: labels.captionsUrl ,
          
        },
        {
          type: 'grid',
          columns: 2,
          items: [
            { type: 'input', name: 'captionsLanguage', label: labels.captionsLanguage },
            { type: 'input', name: 'captionsLabel', label: labels.captionsLabel },
          ],
        },
        { type: 'textarea', name: 'textAlternative', label: labels.textAlternative },
        {
          type: 'grid',
          columns: 2,
          items: [
            { type: 'input', name: 'width', label: labels.width },
            { type: 'input', name: 'height', label: labels.height },
          ],
        },
        { 
          type: 'checkbox',
          name: 'controls',
          label: labels.controls
        },
        { 
          type: 'checkbox',
          name: 'autoplay',
          label: labels.autoplay
        },
      ],
    },
    initialData: {
      sourceUrl: getVideoSourceUrl(initialVideo),
      posterUrl: initialVideo?.poster ?? '',
      accessibilityMode: getVideoAccessibilityMode(initialVideo),
      captionsUrl: initialCaptions?.getAttribute('src') ?? '',
      captionsLanguage: initialCaptions?.getAttribute('srclang') ?? 'zh-TW',
      captionsLabel: initialCaptions?.getAttribute('label') ?? '繁體中文字幕',
      textAlternative: getVideoTextAlternative(editableVideo?.figure ?? null),
      width: initialVideo?.width ? String(initialVideo.width) : '640',
      height: initialVideo?.height ? String(initialVideo.height) : '360',
      controls: initialVideo?.controls ?? true,
      autoplay: initialVideo?.autoplay ?? false,
    },
    buttons: [
      { type: 'cancel', text: labels.cancel },
      { type: 'submit', text: labels.insert, primary: true },
    ],
    onAction: (api, details) => {
      if (details.name !== 'chooseVideo') {
        return
      }

      pickVideoFile(async (file) => {
        api.block(labels.uploading)

        try {
          const result = await uploadFile(options.uploadAdapter, file, {
            kind: 'video',
            source: 'picker',
            acceptedMimeTypes: videoUploadPolicy.acceptedMimeTypes,
            maxFileSize: videoUploadPolicy.maxFileSize,
            locale: options.locale,
          })
          api.setData({ sourceUrl: result.src })
          openTimedNotification(editor, labels.uploadComplete, 'success')
        } catch (error) {
          openTimedNotification(editor, getUploadErrorMessage(error, labels), 'error')
        } finally {
          api.unblock()
        }
      })
    },
    onSubmit: (api) => {
      const data = api.getData()
      const sourceUrl = normalizeMediaUrl(data.sourceUrl)
      const posterUrl = data.posterUrl.trim() ? normalizeWebUrl(data.posterUrl) : null
      const captionsUrl = data.captionsUrl.trim() ? normalizeWebUrl(data.captionsUrl) : null

      if (
        !sourceUrl ||
        (data.posterUrl.trim() && !posterUrl) ||
        (data.captionsUrl.trim() && !captionsUrl)
      ) {
        openTimedNotification(editor, labels.invalidUrl, 'error')
        return
      }

      if (data.accessibilityMode === 'audio' && !captionsUrl) {
        openTimedNotification(editor, labels.captionsRequired, 'error')
        return
      }

      if (data.accessibilityMode === 'visual' && !data.textAlternative.trim()) {
        openTimedNotification(editor, labels.textAlternativeRequired, 'error')
        return
      }

      const videoHtml = buildVideoHtml(editor, data, sourceUrl, posterUrl, captionsUrl)

      editor.undoManager.transact(() => {
        if (editableVideo) {
          updateVideoPreviewHtml(editableVideo, videoHtml)
        } else {
          editor.insertContent(videoHtml)
        }
      })
      editor.nodeChanged()
      api.close()
    },
  })
}

export const openEmbedIframeDialog = (
  editor: Editor,
  labels: MediaToolLabels,
  domains: readonly string[] = allowedIframeDomains,
) => {
  const editableIframe = findEditableIframe(editor)
  const initialIframe = editableIframe?.iframe

  editor.windowManager.open<IframeDialogData>({
    title: labels.embedIframe,
    body: {
      type: 'panel',
      items: [
        { type: 'input', name: 'sourceUrl', label: labels.sourceUrl },
        {
          type: 'textarea',
          name: 'embedCode',
          label: 'Iframe HTML（可貼整段 iframe 程式碼）',
        },
        { type: 'input', name: 'title', label: labels.iframeTitle },
        { type: 'input', name: 'width', label: labels.width },
        { type: 'input', name: 'height', label: labels.height },
        { type: 'checkbox', name: 'allowFullscreen', label: labels.allowFullscreen },
      ],
    },
    initialData: {
      sourceUrl: initialIframe?.src ?? '',
      embedCode: getIframeSourceHtml(editableIframe),
      title: initialIframe?.title ?? editableIframe?.previewObject?.getAttribute('data-mce-p-title') ?? '',
      width: initialIframe?.width || '640',
      height: initialIframe?.height || '360',
      allowFullscreen: initialIframe?.hasAttribute('allowfullscreen') ?? true,
    },
    buttons: [
      { type: 'cancel', text: labels.cancel },
      { type: 'submit', text: labels.insert, primary: true },
    ],
    onSubmit: (api) => {
      const data = api.getData()
      const pastedIframe = data.embedCode.trim()
        ? parseIframeEmbedCode(editor, data.embedCode, domains)
        : null
      const sourceUrl = pastedIframe ? pastedIframe.src : normalizeIframeUrl(data.sourceUrl, domains)

      if (!sourceUrl) {
        openTimedNotification(editor, labels.iframeDomainNotAllowed, 'error')
        return
      }

      const iframeTitle =
        data.title.trim() ||
        pastedIframe?.getAttribute('title')?.trim() ||
        getFallbackIframeTitle(sourceUrl)

      const iframe = pastedIframe ?? editor.getDoc().createElement('iframe')
      iframe.src = sourceUrl
      iframe.title = iframeTitle

      if (!pastedIframe || data.width.trim()) {
        iframe.width = normalizeDimension(data.width, 640)
      }

      if (!pastedIframe || data.height.trim()) {
        iframe.height = normalizeDimension(data.height, 360)
      }

      if (!iframe.getAttribute('loading')) {
        iframe.loading = 'lazy'
      }

      if (data.allowFullscreen) {
        iframe.setAttribute('allowfullscreen', '')
      } else {
        iframe.removeAttribute('allowfullscreen')
      }

      normalizeTrustedIframeElement(iframe, domains)
      editor.undoManager.transact(() => {
        if (editableIframe) {
          updateIframePreviewHtml(editableIframe, iframe)
        } else {
          editor.insertContent(iframe.outerHTML)
        }
      })
      editor.nodeChanged()
      api.close()
    },
  })
}

export const registerMediaTools = (
  editor: Editor,
  labels: MediaToolLabels,
  options: MediaToolOptions,
) => {
  const openVideoDialog = () => insertVideo(editor, labels, options)
  const openIframeDialog = () =>
    openEmbedIframeDialog(editor, labels, options.allowedIframeDomains ?? allowedIframeDomains)

  editor.addCommand('cmsInsertVideo', openVideoDialog)
  editor.addCommand('cmsEmbedIframe', openIframeDialog)

  editor.ui.registry.addButton('insertvideo', {
    icon: 'embed',
    tooltip: labels.insertVideo,
    onAction: openVideoDialog,
  })
  editor.ui.registry.addMenuItem('insertvideo', {
    icon: 'embed',
    text: labels.insertVideo,
    onAction: openVideoDialog,
  })
  editor.ui.registry.addButton('embediframe', {
    icon: 'embed-page',
    tooltip: labels.embedIframe,
    onAction: openIframeDialog,
  })
  editor.ui.registry.addMenuItem('embediframe', {
    icon: 'embed-page',
    text: labels.embedIframe,
    onAction: openIframeDialog,
  })
  editor.ui.registry.addContextMenu('cmslink', {
    update: (element) => {
      if (isInsideMediaObject(editor, element)) {
        return []
      }

      const link = element.closest('a[href]')

      return [
        {
          type: 'item',
          icon: 'link',
          text: link ? '編輯連結' : '插入連結',
          onAction: () => {
            if (link) {
              editor.selection.select(link)
            }

            editor.execCommand('mceLink', false, { dialog: true })
          },
        },
        ...(link
          ? [
              {
                type: 'item' as const,
                icon: 'unlink',
                text: '移除連結',
                onAction: () => {
                  editor.selection.select(link)
                  editor.execCommand('unlink')
                },
              },
            ]
          : []),
      ]
    },
  })
  editor.ui.registry.addContextMenu('cmsmedia', {
    update: (element) => {
      const mediaObject = findContextMediaObject(editor, element)
      const mediaObjectType = mediaObject ? getMediaObjectType(mediaObject) : null

      if (!mediaObject || !mediaObjectType) {
        return []
      }

      return [
        {
          type: 'item',
          icon: 'embed',
          text: mediaObjectType === 'video' ? labels.insertVideo : labels.embedIframe,
          onAction: () => {
            selectMediaObject(editor, mediaObject)
            if (mediaObjectType === 'video') {
              openVideoDialog()
            } else {
              openIframeDialog()
            }
          },
        },
      ]
    },
  })
}
