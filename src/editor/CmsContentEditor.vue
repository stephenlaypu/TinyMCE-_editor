<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import type { AstNode, Editor as TinyMCEEditor, RawEditorOptions } from 'tinymce'
import type { AdvancedEditorLabels, CodeTab } from './components/AdvancedContentEditor.vue'
import TinyMceEditor from './components/TinyMceEditor.vue'
import { editorMessages, type AppLocale } from './i18n'
import {
  defaultEditorPolicy,
  resolveEditorPolicy,
  type EditorPolicy,
  type EditorPolicyOverride,
} from './policy'
import type { EditorContent } from './types/editorContent'
import {
  analyzeContentCapabilities,
  evaluateContentForPublication,
  type PublicationPolicy,
} from './contentPolicy'
import { applyBasicHtmlChange, extractLegacyStyles } from './workspaceContent'
import type { UploadAdapter, UploadResult } from './uploads/types'
import { applyUploadedMediaMetadata } from './mediaUploadMetadata'
import { extractMediaReferenceManifest } from './mediaReferences'
import {
  allowedIframeDomains as defaultAllowedIframeDomains,
  iframeSandboxExclusions,
  isAllowedIframeUrl,
  normalizeMediaDimensionNode,
  normalizeTrustedIframeElement,
  normalizeTrustedIframeNode,
  registerMediaTools,
  type MediaToolLabels,
} from './tinymce/registerMediaTools'
import { createIframeTemplate } from './tinymce/createIframeTemplate'
import { registerCmsTemplates, type CmsTemplateLabels } from './tinymce/registerCmsTemplates'
import { registerCmsTableStyles, type CmsTableStyleLabels } from './tinymce/registerCmsTableStyles'
import { registerAccessibilityCheck } from './tinymce/registerAccessibilityCheck'
import { installTableDialogFieldGuard } from './tinymce/installTableDialogFieldGuard'
import { installEditorAccessibilityFixes } from './tinymce/installEditorAccessibilityFixes'
import { installToolbarTooltipDismiss } from './tinymce/installToolbarTooltipDismiss'
import { normalizeCmsTableSizing } from './tinymce/cmsTableSizing'
import { loadTinyMce } from './tinymce/loadTinyMce'
import {
  withoutContextMenuItems,
  withoutToolbarItems,
  withoutToolbarTokenItems,
} from './tinymce/editorOptionPolicy'
import {
  withoutMediaInsertionContextMenu,
  withoutMediaInsertionPlugins,
  withoutMediaInsertionToolbar,
} from './tinymce/mediaInsertionPolicy'
import {
  cellBackgroundColorClassByValue,
  cellBackgroundColorClasses,
  cellBorderColorClassByValue,
  cellBorderColorClasses,
  cellBorderStyleClassByValue,
  cellBorderStyleClasses,
  cellVerticalAlignClassByValue,
  cellVerticalAlignClasses,
  cellVerticalAlignOptions,
  defaultEditorFontSizeValue,
  defaultEditorFontValue,
  editorBackgroundColorClassByValue,
  editorBackgroundColorClasses,
  editorBorderColorClassByValue,
  editorBorderColorClasses,
  editorBorderStyleClassByValue,
  editorBorderStyleClasses,
  editorBorderStyleOptions,
  editorColorClassByValue,
  editorColorClasses,
  editorFontClasses,
  editorFontFamilyFormats,
  editorFontSizeClasses,
  editorFontSizeFormats,
  relativeEditorFontSizeFormats,
  editorListStyleClassByValue,
  editorListStyleClasses,
  getEditorBackgroundColorMap,
  getEditorTableBackgroundColorMap,
  getEditorTableBorderColorMap,
  getEditorTextColorMap,
  preserveExistingTableClassList,
  rowBackgroundColorClassByValue,
  rowBackgroundColorClasses,
  rowBorderColorClassByValue,
  rowBorderColorClasses,
  rowBorderStyleClassByValue,
  rowBorderStyleClasses,
  tableBackgroundColorClassByValue,
  tableBackgroundColorClasses,
  tableBorderColorClassByValue,
  tableBorderColorClasses,
  tableBorderStyleClassByValue,
  tableBorderStyleClasses,
} from './tinymce/cmsFormatting'
import { uploadFile, imageUploadPolicy } from './uploads/upload'
import { UploadValidationError } from './uploads/types'

import 'tinymce/skins/ui/oxide/skin.css'
import './styles/editor.css'

const props = withDefaults(
  defineProps<{
    modelValue: EditorContent
    locale?: AppLocale
    mode?: EditorPolicy['mode']
    accessibilityProfile?: EditorPolicy['accessibilityProfile']
    editorPolicy?: EditorPolicyOverride
    uploadAdapter?: UploadAdapter
    assetBaseUrl?: string
    licenseKey?: string
    height?: number
    initialWorkspaceMode?: 'basic' | 'advanced'
    advancedWorkspaceEnabled?: boolean
    customCssEnabled?: boolean
    customJavaScriptEnabled?: boolean
    cmsTemplatesEnabled?: boolean
    cmsTableStylesEnabled?: boolean
    allowedIframeDomains?: readonly string[]
    mediaInsertion?: EditorPolicy['mediaInsertion']
    tinymceOptions?: Partial<RawEditorOptions>
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    locale: 'zh-TW',
    mode: defaultEditorPolicy.mode,
    accessibilityProfile: defaultEditorPolicy.accessibilityProfile,
    editorPolicy: undefined,
    uploadAdapter: undefined,
    assetBaseUrl: '/cms-editor',
    licenseKey: 'gpl',
    height: 620,
    initialWorkspaceMode: 'basic',
    advancedWorkspaceEnabled: defaultEditorPolicy.advancedWorkspaceEnabled,
    customCssEnabled: defaultEditorPolicy.customCssEnabled,
    customJavaScriptEnabled: defaultEditorPolicy.customJavaScriptEnabled,
    cmsTemplatesEnabled: defaultEditorPolicy.cmsTemplatesEnabled,
    cmsTableStylesEnabled: defaultEditorPolicy.cmsTableStylesEnabled,
    allowedIframeDomains: () => [...defaultAllowedIframeDomains],
    mediaInsertion: defaultEditorPolicy.mediaInsertion,
    tinymceOptions: undefined,
    disabled: false,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: EditorContent]
  ready: [editor: TinyMCEEditor]
  focus: [editor: TinyMCEEditor | null]
  blur: [editor: TinyMCEEditor | null]
  dirty: [value: boolean]
}>()

const { locale, t } = useI18n({
  useScope: 'local',
  inheritLocale: false,
  locale: props.locale,
  fallbackLocale: 'en-US',
  messages: editorMessages,
})
const resolvedEditorPolicy = resolveEditorPolicy(
  {
    mode: props.mode,
    accessibilityProfile: props.accessibilityProfile,
    advancedWorkspaceEnabled: props.advancedWorkspaceEnabled,
    customCssEnabled: props.customCssEnabled,
    customJavaScriptEnabled: props.customJavaScriptEnabled,
    mediaInsertion: props.mediaInsertion,
    cmsTemplatesEnabled: props.cmsTemplatesEnabled,
    cmsTableStylesEnabled: props.cmsTableStylesEnabled,
  },
  props.editorPolicy,
)
const editorMode = resolvedEditorPolicy.mode
const isStrictEditorMode = editorMode === 'strict'
const isAdvancedWorkspaceEnabled = resolvedEditorPolicy.advancedWorkspaceEnabled
const advancedCodeTabs: CodeTab[] = [
  'html',
  ...(resolvedEditorPolicy.customCssEnabled ? (['css'] as const) : []),
  ...(resolvedEditorPolicy.customJavaScriptEnabled ? (['js'] as const) : []),
]
const AdvancedContentEditor = defineAsyncComponent(
  () => import('./components/AdvancedContentEditor.vue'),
)
const workspaceMode = ref<'basic' | 'advanced'>(
  isAdvancedWorkspaceEnabled ? props.initialWorkspaceMode : 'basic',
)
const activeAccessibilityProfile = resolvedEditorPolicy.accessibilityProfile
const uploadAdapter = props.uploadAdapter
const mediaInsertionEnabled = resolvedEditorPolicy.mediaInsertion === 'enabled'
const areCmsTemplatesEnabled = resolvedEditorPolicy.cmsTemplatesEnabled
const areCmsTableStylesEnabled = resolvedEditorPolicy.cmsTableStylesEnabled
const disabledOptionalToolbarItems = new Set([
  ...(areCmsTemplatesEnabled ? [] : ['cmstemplates']),
  ...(areCmsTableStylesEnabled ? [] : ['cmstablestyles']),
])
const disabledOptionalContextMenuItems = new Set(disabledOptionalToolbarItems)

const defaultPlugins = [
  'advlist',
  'autolink',
  'charmap',
  'code',
  'fullscreen',
  'help',
  'image',
  'link',
  'lists',
  'media',
  'preview',
  'searchreplace',
  'table',
  'visualblocks',
  'wordcount',
]
const defaultToolbar =
  'undo redo | bold italic strikethrough | blocks fontfamily fontsize | alignleft aligncenter alignright alignjustify | bullist numlist blockquote | forecolor backcolor | link image insertvideo embediframe table cmstablestyles cmstemplates | code preview fullscreen a11ycheck'
const defaultContextMenu = 'cmstablestyles cmstemplates cmsmedia cmslink image table'
const defaultTableToolbar =
  'tableprops tablecellprops cmstablestyles tablecaption | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tabledelete'
const editorContentSecurityPolicy = [
  "default-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: data: blob:",
  'frame-src https:',
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const cloneContent = (value: EditorContent): EditorContent => ({ ...value })
const resolveAssetUrl = (path: string): string => {
  const normalizedPath = path.replace(/^\/+/, '')
  const base = props.assetBaseUrl.trim().replace(/\/+$/, '')
  return base ? `${base}/${normalizedPath}` : `/${normalizedPath}`
}
const content = ref<EditorContent>(cloneContent(props.modelValue))
const cleanContent = ref<EditorContent>(cloneContent(content.value))
const basicOriginalContent = ref<EditorContent>(cloneContent(content.value))
const basicHtml = ref(content.value.html)
const basicSourceBodyHtml = ref(content.value.html)
const basicLegacyCss = ref('')
const basicHasUserChanges = ref(false)
const basicHasRoundTripRisk = ref(false)
const uploadedMediaBySource = new Map<string, UploadResult>()

const rememberUploadedMedia = (result: UploadResult) => {
  uploadedMediaBySource.set(result.src, result)
}

const isAdvancedCssEnabledInBasic = ref(true)
const advancedInitialTab = ref<'html' | 'css' | 'js'>('html')
const editorRoot = ref<HTMLElement | null>(null)
const editorInstance = shallowRef<TinyMCEEditor | null>(null)
const advancedEditorInstance = shallowRef<{ focus: () => void } | null>(null)
const isTinyMceReady = ref(false)
const tinyMceLoadError = ref('')
let emittedDirtyState = false

const emitDirtyState = (value: boolean, force = false) => {
  if (!force && emittedDirtyState === value) {
    return
  }

  emittedDirtyState = value
  emit('dirty', value)
}

const ensureTinyMceReady = async () => {
  if (isTinyMceReady.value || tinyMceLoadError.value) {
    return
  }

  try {
    await loadTinyMce()
    isTinyMceReady.value = true
  } catch (error) {
    tinyMceLoadError.value = error instanceof Error ? error.message : String(error)
  }
}

const hasAdvancedContent = computed(() =>
  Boolean(content.value.css.trim() || basicLegacyCss.value.trim() || content.value.js.trim()),
)

const advancedCssForBasic = computed(() =>
  [content.value.css.trim(), basicLegacyCss.value.trim()].filter(Boolean).join('\n\n'),
)

const normalizeHtmlForComparison = (source: string) => {
  const template = document.createElement('template')
  template.innerHTML = source
  return template.innerHTML
}

const syncAdvancedCssToTinyMce = (editor = editorInstance.value) => {
  if (!editor || workspaceMode.value !== 'basic') {
    return
  }

  const doc = editor.getDoc()
  const styleId = 'cms-advanced-content-style'
  let style = doc.getElementById(styleId) as HTMLStyleElement | null

  if (!style) {
    style = doc.createElement('style')
    style.id = styleId
    style.setAttribute('data-mce-bogus', 'all')
    doc.head.append(style)
  }

  style.textContent = isAdvancedCssEnabledInBasic.value ? advancedCssForBasic.value : ''
}

const advancedEditorLabels = computed<AdvancedEditorLabels>(() => ({
  html: t('app.advanced.html'),
  css: t('app.advanced.css'),
  javascript: t('app.advanced.javascript'),
  codeEditor: t('app.advanced.codeEditor'),
  codeToolbar: t('app.advanced.codeToolbar'),
  undo: t('app.advanced.undo'),
  redo: t('app.advanced.redo'),
  search: t('app.advanced.search'),
  syntaxError: t('app.advanced.syntaxError'),
  absoluteFontSizeUnit: (value: string) => t('app.advanced.absoluteFontSizeUnit', { value }),
  tabErrorLabel: (tab: string, count: number) =>
    t(count === 1 ? 'app.advanced.tabErrorLabelSingle' : 'app.advanced.tabErrorLabelMultiple', {
      tab,
      count,
    }),
  preview: t('app.advanced.preview'),
  refreshPreview: t('app.advanced.refreshPreview'),
  previewError: t('app.advanced.previewError'),
  runtimeErrorLine: (line: number) => t('app.advanced.runtimeErrorLine', { line }),
  runtimeErrorLineColumn: (line: number, column: number) =>
    t('app.advanced.runtimeErrorLineColumn', { line, column }),
  locateError: t('app.advanced.locateError'),
  format: t('app.advanced.format'),
  formatting: t('app.advanced.formatting'),
  formatError: t('app.advanced.formatError'),
  collapseCode: t('app.advanced.collapseCode'),
  expandCode: t('app.advanced.expandCode'),
  resizePanels: t('app.advanced.resizePanels'),
  resizeValue: (code: number, preview: number) => t('app.advanced.resizeValue', { code, preview }),
  fullscreen: t('app.advanced.fullscreen'),
  exitFullscreen: t('app.advanced.exitFullscreen'),
}))

const mediaToolLabels = computed<MediaToolLabels>(() => ({
  insertVideo: t('app.mediaTools.insertVideo'),
  embedIframe: t('app.mediaTools.embedIframe'),
  sourceUrl: t('app.mediaTools.sourceUrl'),
  posterUrl: t('app.mediaTools.posterUrl'),
  videoAccessibilityMode: t('app.mediaTools.videoAccessibilityMode'),
  videoAccessibilityModeAudio: t('app.mediaTools.videoAccessibilityModeAudio'),
  videoAccessibilityModeVisual: t('app.mediaTools.videoAccessibilityModeVisual'),
  videoAccessibilityModeDecorative: t('app.mediaTools.videoAccessibilityModeDecorative'),
  captionsUrl: t('app.mediaTools.captionsUrl'),
  captionsLanguage: t('app.mediaTools.captionsLanguage'),
  captionsLabel: t('app.mediaTools.captionsLabel'),
  textAlternative: t('app.mediaTools.textAlternative'),
  captionsRequired: t('app.mediaTools.captionsRequired'),
  textAlternativeRequired: t('app.mediaTools.textAlternativeRequired'),
  iframeTitle: t('app.mediaTools.iframeTitle'),
  width: t('app.mediaTools.width'),
  height: t('app.mediaTools.height'),
  controls: t('app.mediaTools.controls'),
  autoplay: t('app.mediaTools.autoplay'),
  allowFullscreen: t('app.mediaTools.allowFullscreen'),
  cancel: t('app.mediaTools.cancel'),
  insert: t('app.mediaTools.insert'),
  invalidUrl: t('app.mediaTools.invalidUrl'),
  iframeTitleRequired: t('app.mediaTools.iframeTitleRequired'),
  iframeDomainNotAllowed: t('app.mediaTools.iframeDomainNotAllowed'),
  videoFile: t('app.mediaTools.videoFile'),
  uploading: t('app.mediaTools.uploading'),
  uploadInvalidType: t('app.mediaTools.uploadInvalidType'),
  uploadTooLarge: t('app.mediaTools.uploadTooLarge'),
  uploadMissingAdapter: t('app.mediaTools.uploadMissingAdapter'),
  uploadFailed: t('app.mediaTools.uploadFailed'),
  uploadComplete: t('app.mediaTools.uploadComplete'),
}))

const cmsTemplateLabels = computed<CmsTemplateLabels>(() => ({
  templates: t('app.cmsTemplates.templates'),
  anchorList: t('app.cmsTemplates.anchorList'),
  anchorListItem: t('app.cmsTemplates.anchorListItem'),
  anchorListText: t('app.cmsTemplates.anchorListText'),
  anchorListHref: t('app.cmsTemplates.anchorListHref'),
  addItem: t('app.cmsTemplates.addItem'),
  removeItem: t('app.cmsTemplates.removeItem'),
  moveItemUp: t('app.cmsTemplates.moveItemUp'),
  moveItemDown: t('app.cmsTemplates.moveItemDown'),
  cancel: t('app.cmsTemplates.cancel'),
  insert: t('app.cmsTemplates.insert'),
  update: t('app.cmsTemplates.update'),
  invalidAnchorList: t('app.cmsTemplates.invalidAnchorList'),
}))

const cmsTableStyleLabels = computed<CmsTableStyleLabels>(() => ({
  button: t('app.cmsTableStyles.button'),
  title: t('app.cmsTableStyles.title'),
  layout: t('app.cmsTableStyles.layout'),
  layoutNone: t('app.cmsTableStyles.layoutNone'),
  layoutScroll: t('app.cmsTableStyles.layoutScroll'),
  layoutCard: t('app.cmsTableStyles.layoutCard'),
  bordered: t('app.cmsTableStyles.bordered'),
  striped: t('app.cmsTableStyles.striped'),
  hover: t('app.cmsTableStyles.hover'),
  cancel: t('app.cmsTableStyles.cancel'),
  apply: t('app.cmsTableStyles.apply'),
  tableRequired: t('app.cmsTableStyles.tableRequired'),
}))

const isAltZero = (event: KeyboardEvent) =>
  event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey &&
  (event.code === 'Digit0' || event.code === 'Numpad0' || event.key === '0')

const openHelp = (event: KeyboardEvent) => {
  const activeElement = document.activeElement
  if (
    !isAltZero(event) ||
    workspaceMode.value !== 'basic' ||
    !editorInstance.value ||
    !activeElement ||
    !editorRoot.value?.contains(activeElement)
  ) {
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  editorInstance.value.execCommand('mceHelp')
}

onMounted(() => {
  window.addEventListener('keydown', openHelp)
  if (!isStrictEditorMode && workspaceMode.value === 'basic') {
    prepareBasicWorkspace()
  }
  if (workspaceMode.value === 'basic') {
    void ensureTinyMceReady()
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', openHelp))

const normalizeColorValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  const hexMatch = trimmedValue.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)

  if (hexMatch) {
    const hex = hexMatch[1]

    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase()
    }

    return `#${hex}`.toUpperCase()
  }

  const rgbMatch = trimmedValue.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/i)

  if (!rgbMatch) {
    return null
  }

  return `#${rgbMatch
    .slice(1, 4)
    .map((colorPart) => Number(colorPart).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

const normalizeBorderStyleValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()

  if (editorBorderStyleOptions.some((option) => option.value === normalizedValue)) {
    return normalizedValue
  }

  return null
}

const normalizeVerticalAlignValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()

  if (cellVerticalAlignOptions.some((option) => option.value === normalizedValue)) {
    return normalizedValue
  }

  return null
}

const normalizeListStyleTypeValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()

  return editorListStyleClassByValue.has(normalizedValue) ? normalizedValue : null
}

const removeClasses = (element: Element, classNames: string[]) => {
  element.classList.remove(...classNames)
}

const cleanEmptyStyleAttribute = (element: HTMLElement) => {
  if (!element.getAttribute('style')?.trim()) {
    element.removeAttribute('style')
  }
}

const cleanEmptyClassAttribute = (element: Element) => {
  if (!element.getAttribute('class')?.trim()) {
    element.removeAttribute('class')
  }
}

const unsafeUrlProtocolPattern = /^(?:javascript|data|vbscript):/i
const blockedContentSelector = [
  'script',
  'style',
  'object',
  'embed',
  'applet',
  'svg',
  'math',
  'base',
  'meta',
  'link',
].join(',')

const isSafeUrlValue = (value: string, options: { allowBlob?: boolean } = {}) => {
  const trimmedValue = value.trim()

  if (!trimmedValue || unsafeUrlProtocolPattern.test(trimmedValue)) {
    return false
  }

  if (trimmedValue.startsWith('#')) {
    return true
  }

  try {
    const url = new URL(trimmedValue, window.location.href)
    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:' ||
      url.protocol === 'mailto:' ||
      url.protocol === 'tel:' ||
      (options.allowBlob === true && url.protocol === 'blob:')
    )
  } catch {
    return false
  }
}

const isUrlAttribute = (attributeName: string) =>
  ['href', 'src', 'poster', 'action', 'formaction', 'xlink:href'].includes(attributeName)

const allowsBlobUrl = (elementName: string, attributeName: string) =>
  attributeName === 'src' && (elementName === 'video' || elementName === 'source')

const sanitizeElementAttributes = (element: HTMLElement) => {
  const elementName = element.tagName.toLowerCase()

  Array.from(element.attributes).forEach((attribute) => {
    const attributeName = attribute.name.toLowerCase()
    const attributeValue = attribute.value

    if (attributeName.startsWith('on')) {
      element.removeAttribute(attribute.name)
      return
    }

    if (attributeName === 'srcdoc' || attributeName.startsWith('data-mce-')) {
      element.removeAttribute(attribute.name)
      return
    }

    if (attributeName === 'style' && /url\s*\(/i.test(attributeValue)) {
      element.removeAttribute(attribute.name)
      element.removeAttribute('data-mce-style')
      return
    }

    if (
      isUrlAttribute(attributeName) &&
      !isSafeUrlValue(attributeValue, {
        allowBlob: allowsBlobUrl(elementName, attributeName),
      })
    ) {
      element.removeAttribute(attribute.name)
    }
  })
}

const hardenCmsHtml = (html: string): string => {
  if (!html.trim()) {
    return html
  }

  const template = document.createElement('template')
  template.innerHTML = html
  let didChange = false

  template.content.querySelectorAll(blockedContentSelector).forEach((element) => {
    element.remove()
    didChange = true
  })

  template.content.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!isAllowedIframeUrl(iframe.getAttribute('src'), props.allowedIframeDomains)) {
      iframe.remove()
      didChange = true
      return
    }

    const before = iframe.outerHTML
    normalizeTrustedIframeElement(iframe, props.allowedIframeDomains)
    if (iframe.outerHTML !== before) {
      didChange = true
    }
  })

  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const before = element.outerHTML
    sanitizeElementAttributes(element)
    if (element.outerHTML !== before) {
      didChange = true
    }
  })

  return didChange ? template.innerHTML : html
}

const managedInlineClassNames = [
  ...editorFontClasses,
  ...editorFontSizeClasses,
  ...editorColorClasses,
  ...editorBackgroundColorClasses,
  ...editorBorderColorClasses,
  ...editorBorderStyleClasses,
  ...cellVerticalAlignClasses,
]

const isManagedInlineClassName = (className: string) => managedInlineClassNames.includes(className)

const hasManagedInlineClass = (element: Element) =>
  Array.from(element.classList).some(isManagedInlineClassName)

const normalizeManagedInlineSpanAttributes = (element: Element) => {
  if (!hasManagedInlineClass(element)) {
    return
  }

  if (element instanceof HTMLElement) {
    cleanEmptyStyleAttribute(element)
  }

  if (!element.getAttribute('style')) {
    element.removeAttribute('data-mce-style')
  }
}

const hasOnlyManagedClassAttribute = (element: Element) => {
  normalizeManagedInlineSpanAttributes(element)

  const attributes = Array.from(element.attributes)

  if (attributes.length === 0) {
    return true
  }

  if (attributes.length !== 1 || attributes[0].name !== 'class') {
    return false
  }

  return Array.from(element.classList).every(isManagedInlineClassName)
}

const unwrapEmptySpan = (editor: TinyMCEEditor, element: Element) => {
  if (element.tagName.toLowerCase() === 'span' && element.attributes.length === 0) {
    editor.dom.remove(element, true)
  }
}

const applyEditorColorClass = (
  element: Element,
  value: string | null | undefined,
  classByValue: Map<string, string>,
  classNames: string[],
  cssProperty: string,
) => {
  const normalizedValue = normalizeColorValue(value)
  const className = normalizedValue ? classByValue.get(normalizedValue) : null

  removeClasses(element, classNames)

  if (className) {
    element.classList.add(className)
  }

  if (element instanceof HTMLElement) {
    element.style.removeProperty(cssProperty)
    cleanEmptyStyleAttribute(element)

    if (!element.getAttribute('style')) {
      element.removeAttribute('data-mce-style')
    }
  }
}

interface ManagedClassConfig {
  classByValue: Map<string, string>
  classNames: string[]
}

interface ManagedStyleClassConfig extends ManagedClassConfig {
  cssProperty: string
}

const getManagedStyleValueFromClasses = (
  classNames: Set<string>,
  classByValue: Map<string, string>,
): string | null => {
  for (const [value, className] of classByValue.entries()) {
    if (classNames.has(className)) {
      return value
    }
  }

  return null
}

const getBackgroundColorClassConfig = (elementName: string): ManagedClassConfig => {
  if (elementName === 'table') {
    return {
      classByValue: tableBackgroundColorClassByValue,
      classNames: tableBackgroundColorClasses,
    }
  }

  if (elementName === 'tr') {
    return {
      classByValue: rowBackgroundColorClassByValue,
      classNames: rowBackgroundColorClasses,
    }
  }

  if (elementName === 'td' || elementName === 'th') {
    return {
      classByValue: cellBackgroundColorClassByValue,
      classNames: cellBackgroundColorClasses,
    }
  }

  return {
    classByValue: editorBackgroundColorClassByValue,
    classNames: editorBackgroundColorClasses,
  }
}

const getBorderColorClassConfig = (elementName: string): ManagedClassConfig => {
  if (elementName === 'table') {
    return {
      classByValue: tableBorderColorClassByValue,
      classNames: tableBorderColorClasses,
    }
  }

  if (elementName === 'tr') {
    return {
      classByValue: rowBorderColorClassByValue,
      classNames: rowBorderColorClasses,
    }
  }

  if (elementName === 'td' || elementName === 'th') {
    return {
      classByValue: cellBorderColorClassByValue,
      classNames: cellBorderColorClasses,
    }
  }

  return {
    classByValue: editorBorderColorClassByValue,
    classNames: editorBorderColorClasses,
  }
}

const getBorderStyleClassConfig = (elementName: string): ManagedClassConfig => {
  if (elementName === 'table') {
    return {
      classByValue: tableBorderStyleClassByValue,
      classNames: tableBorderStyleClasses,
    }
  }

  if (elementName === 'tr') {
    return {
      classByValue: rowBorderStyleClassByValue,
      classNames: rowBorderStyleClasses,
    }
  }

  if (elementName === 'td' || elementName === 'th') {
    return {
      classByValue: cellBorderStyleClassByValue,
      classNames: cellBorderStyleClasses,
    }
  }

  return {
    classByValue: editorBorderStyleClassByValue,
    classNames: editorBorderStyleClasses,
  }
}

const getTableDialogManagedStyleConfigs = (elementName: string): ManagedStyleClassConfig[] => [
  {
    ...getBackgroundColorClassConfig(elementName),
    cssProperty: 'background-color',
  },
  {
    ...getBorderColorClassConfig(elementName),
    cssProperty: 'border-color',
  },
  {
    ...getBorderStyleClassConfig(elementName),
    cssProperty: 'border-style',
  },
  ...(elementName === 'td' || elementName === 'th'
    ? [
        {
          classByValue: cellVerticalAlignClassByValue,
          classNames: cellVerticalAlignClasses,
          cssProperty: 'vertical-align',
        },
      ]
    : []),
]

const removeEditorClassesInSelection = (editor: TinyMCEEditor, classNames: string[]) => {
  const selection = editor.selection
  const range = selection.getRng()
  const body = editor.getBody()
  const selector = classNames.map((className) => `.${className}`).join(',')
  const elements = new Set<HTMLElement>()
  const bookmark = selection.getBookmark(2, true)

  if (!selector) {
    return
  }

  if (selection.isCollapsed()) {
    const startElement =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement
    const coloredAncestor = startElement?.closest(selector)

    if (coloredAncestor instanceof HTMLElement && body.contains(coloredAncestor)) {
      elements.add(coloredAncestor)
    }
  } else {
    editor.dom.select<HTMLElement>(selector).forEach((element) => {
      if (range.intersectsNode(element)) {
        elements.add(element)
      }
    })
  }

  elements.forEach((element) => {
    removeClasses(element, classNames)
    cleanEmptyClassAttribute(element)
    unwrapEmptySpan(editor, element)
  })

  if (elements.size > 0) {
    selection.moveToBookmark(bookmark)
    editor.nodeChanged()
  }
}

const removeEditorFontClasses = (editor: TinyMCEEditor) => {
  editorFontClasses.forEach((className) => {
    editor.formatter.remove('fontname', { value: className }, undefined, true)
  })
  editor.nodeChanged()
}

const removeEditorFontSizeClasses = (editor: TinyMCEEditor) => {
  editorFontSizeClasses.forEach((className) => {
    editor.formatter.remove('fontsize', { value: className }, undefined, true)
  })
  editor.nodeChanged()
}

const removeEditorColorClassesByFormat = (editor: TinyMCEEditor, format: string) => {
  if (format === 'forecolor') {
    removeEditorClassesInSelection(editor, editorColorClasses)
  }

  if (format === 'hilitecolor') {
    removeEditorClassesInSelection(editor, editorBackgroundColorClasses)
  }
}

const getOnlyNestedManagedSpan = (element: Element): HTMLSpanElement | null => {
  const childNodes = Array.from(element.childNodes).filter(
    (node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.length,
  )

  if (childNodes.length !== 1) {
    return null
  }

  const child = childNodes[0]

  if (!(child instanceof HTMLSpanElement) || !hasOnlyManagedClassAttribute(child)) {
    return null
  }

  return child
}

const normalizeCmsInlineSpanElement = (span: HTMLSpanElement): boolean => {
  if (!hasOnlyManagedClassAttribute(span)) {
    return false
  }

  let didChange = false
  let child = getOnlyNestedManagedSpan(span)

  while (child) {
    child.classList.forEach((className) => span.classList.add(className))
    cleanEmptyClassAttribute(span)

    while (child.firstChild) {
      span.insertBefore(child.firstChild, child)
    }

    child.remove()
    didChange = true
    child = getOnlyNestedManagedSpan(span)
  }

  return didChange
}

const normalizeManagedColorStyleElement = (element: HTMLElement): boolean => {
  const elementName = element.tagName.toLowerCase()
  const backgroundConfig = getBackgroundColorClassConfig(elementName)
  const borderConfig = getBorderColorClassConfig(elementName)
  const borderStyleConfig = getBorderStyleClassConfig(elementName)
  const colorValue = normalizeColorValue(element.style.color)
  const backgroundColorValue = normalizeColorValue(element.style.backgroundColor)
  const borderColorValue = normalizeColorValue(element.style.borderColor)
  const borderStyleValue = normalizeBorderStyleValue(element.style.borderStyle)
  const verticalAlignValue = normalizeVerticalAlignValue(element.style.verticalAlign)
  const listStyleTypeValue = normalizeListStyleTypeValue(element.style.listStyleType)
  const colorClassName = colorValue ? editorColorClassByValue.get(colorValue) : null
  const backgroundColorClassName = backgroundColorValue
    ? backgroundConfig.classByValue.get(backgroundColorValue)
    : null
  const borderColorClassName = borderColorValue
    ? borderConfig.classByValue.get(borderColorValue)
    : null
  const borderStyleClassName = borderStyleValue
    ? borderStyleConfig.classByValue.get(borderStyleValue)
    : null
  const verticalAlignClassName =
    elementName === 'td' || elementName === 'th'
      ? verticalAlignValue
        ? cellVerticalAlignClassByValue.get(verticalAlignValue)
        : null
      : null
  const listStyleTypeClassName =
    elementName === 'ul' || elementName === 'ol' || elementName === 'li'
      ? listStyleTypeValue
        ? editorListStyleClassByValue.get(listStyleTypeValue)
        : null
      : null
  let didChange = false

  if (colorValue) {
    removeClasses(element, editorColorClasses)
  }

  if (colorClassName) {
    element.classList.add(colorClassName)
    element.style.removeProperty('color')
    didChange = true
  }

  if (backgroundColorValue) {
    removeClasses(element, backgroundConfig.classNames)
  }

  if (backgroundColorClassName) {
    element.classList.add(backgroundColorClassName)
    element.style.removeProperty('background-color')
    didChange = true
  }

  if (borderColorValue) {
    removeClasses(element, borderConfig.classNames)
  }

  if (borderColorClassName) {
    element.classList.add(borderColorClassName)
    element.style.removeProperty('border-color')
    didChange = true
  }

  if (borderStyleValue) {
    removeClasses(element, borderStyleConfig.classNames)
  }

  if (borderStyleClassName) {
    element.classList.add(borderStyleClassName)
    element.style.removeProperty('border-style')
    didChange = true
  }

  if (verticalAlignValue && (elementName === 'td' || elementName === 'th')) {
    removeClasses(element, cellVerticalAlignClasses)
  }

  if (verticalAlignClassName) {
    element.classList.add(verticalAlignClassName)
    element.style.removeProperty('vertical-align')
    didChange = true
  }

  if (
    listStyleTypeValue &&
    (elementName === 'ul' || elementName === 'ol' || elementName === 'li')
  ) {
    removeClasses(element, editorListStyleClasses)
  }

  if (listStyleTypeClassName) {
    element.classList.add(listStyleTypeClassName)
    element.style.removeProperty('list-style-type')
    didChange = true
  }

  cleanEmptyClassAttribute(element)
  cleanEmptyStyleAttribute(element)

  return didChange
}

const canonicalizeCmsHtml = (html: string): string => {
  if (
    !html.includes('<span') &&
    !html.includes('style=') &&
    !html.includes(' width=') &&
    !html.includes(' cellpadding=') &&
    !html.includes(' border=')
  ) {
    return html
  }

  const template = document.createElement('template')
  template.innerHTML = html
  let didChange = false
  let shouldScan = true

  template.content.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (normalizeCmsTableSizing(table)) {
      didChange = true
    }
  })

  template.content.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    if (normalizeManagedColorStyleElement(element)) {
      didChange = true
    }
  })

  while (shouldScan) {
    shouldScan = false

    Array.from(template.content.querySelectorAll('span'))
      .reverse()
      .forEach((span) => {
        if (normalizeCmsInlineSpanElement(span)) {
          didChange = true
          shouldScan = true
        }
      })
  }

  return didChange ? template.innerHTML : html
}

const prepareOutputHtml = (html: string): string => {
  if (!isStrictEditorMode) {
    return html
  }

  return canonicalizeCmsHtml(hardenCmsHtml(html))
}

const normalizeEditorColorNode = (node: AstNode) => {
  const style = node.attr('style')

  if (!style) {
    return
  }

  const backgroundConfig = getBackgroundColorClassConfig(node.name)
  const borderConfig = getBorderColorClassConfig(node.name)
  const borderStyleConfig = getBorderStyleClassConfig(node.name)
  const element = document.createElement('span')
  element.setAttribute('style', style)

  const colorValue = normalizeColorValue(element.style.color)
  const backgroundColorValue = normalizeColorValue(element.style.backgroundColor)
  const borderColorValue = normalizeColorValue(element.style.borderColor)
  const borderStyleValue = normalizeBorderStyleValue(element.style.borderStyle)
  const verticalAlignValue = normalizeVerticalAlignValue(element.style.verticalAlign)
  const listStyleTypeValue = normalizeListStyleTypeValue(element.style.listStyleType)
  const colorClassName = colorValue ? editorColorClassByValue.get(colorValue) : null
  const backgroundColorClassName = backgroundColorValue
    ? backgroundConfig.classByValue.get(backgroundColorValue)
    : null
  const borderColorClassName = borderColorValue
    ? borderConfig.classByValue.get(borderColorValue)
    : null
  const borderStyleClassName = borderStyleValue
    ? borderStyleConfig.classByValue.get(borderStyleValue)
    : null
  const verticalAlignClassName =
    node.name === 'td' || node.name === 'th'
      ? verticalAlignValue
        ? cellVerticalAlignClassByValue.get(verticalAlignValue)
        : null
      : null
  const listStyleTypeClassName =
    node.name === 'ul' || node.name === 'ol' || node.name === 'li'
      ? listStyleTypeValue
        ? editorListStyleClassByValue.get(listStyleTypeValue)
        : null
      : null

  if (
    !colorValue &&
    !backgroundColorValue &&
    !borderColorValue &&
    !borderStyleValue &&
    !verticalAlignValue &&
    !listStyleTypeValue
  ) {
    return
  }

  const classNames = new Set((node.attr('class') ?? '').split(/\s+/).filter(Boolean))

  if (colorValue) {
    editorColorClasses.forEach((className) => classNames.delete(className))
  }

  if (colorClassName) {
    classNames.add(colorClassName)
    element.style.removeProperty('color')
  }

  if (backgroundColorValue) {
    backgroundConfig.classNames.forEach((className) => classNames.delete(className))
  }

  if (backgroundColorClassName) {
    classNames.add(backgroundColorClassName)
    element.style.removeProperty('background-color')
  }

  if (borderColorValue) {
    borderConfig.classNames.forEach((className) => classNames.delete(className))
  }

  if (borderColorClassName) {
    classNames.add(borderColorClassName)
    element.style.removeProperty('border-color')
  }

  if (borderStyleValue) {
    borderStyleConfig.classNames.forEach((className) => classNames.delete(className))
  }

  if (borderStyleClassName) {
    classNames.add(borderStyleClassName)
    element.style.removeProperty('border-style')
  }

  if (verticalAlignValue && (node.name === 'td' || node.name === 'th')) {
    cellVerticalAlignClasses.forEach((className) => classNames.delete(className))
  }

  if (verticalAlignClassName) {
    classNames.add(verticalAlignClassName)
    element.style.removeProperty('vertical-align')
  }

  if (listStyleTypeValue && (node.name === 'ul' || node.name === 'ol' || node.name === 'li')) {
    editorListStyleClasses.forEach((className) => classNames.delete(className))
  }

  if (listStyleTypeClassName) {
    classNames.add(listStyleTypeClassName)
    element.style.removeProperty('list-style-type')
  }

  node.attr('class', [...classNames].join(' ') || null)
  node.attr('style', element.getAttribute('style')?.trim() || null)
}

const hydrateTableDialogStyleNode = (node: AstNode) => {
  const classNames = new Set((node.attr('class') ?? '').split(/\s+/).filter(Boolean))
  const isTableCell = node.name === 'td' || node.name === 'th'

  if (classNames.size === 0 && !isTableCell) {
    return
  }

  const element = document.createElement('span')
  const style = node.attr('style')

  if (style) {
    element.setAttribute('style', style)
  }

  let didChange = false

  getTableDialogManagedStyleConfigs(node.name).forEach((config) => {
    if (element.style.getPropertyValue(config.cssProperty)) {
      return
    }

    const value = getManagedStyleValueFromClasses(classNames, config.classByValue)

    if (value) {
      element.style.setProperty(config.cssProperty, value)
      didChange = true
    }
  })

  if (isTableCell) {
    const verticalAlignValue = normalizeVerticalAlignValue(element.style.verticalAlign)
    const verticalAlignClassName = verticalAlignValue
      ? cellVerticalAlignClassByValue.get(verticalAlignValue)
      : null

    if (verticalAlignClassName && !classNames.has(verticalAlignClassName)) {
      cellVerticalAlignClasses.forEach((className) => classNames.delete(className))
      classNames.add(verticalAlignClassName)
      node.attr('class', [...classNames].join(' '))
    }
  }

  if (didChange) {
    node.attr('style', element.getAttribute('style')?.trim() || null)
  }
}

const editorConfig = computed<RawEditorOptions>(() => ({
  ...props.tinymceOptions,
  height: props.height,
  base_url: resolveAssetUrl('tinymce'),
  language: locale.value === 'zh-TW' ? 'zh_TW' : 'en',
  iframe_attrs: {
    title: t('app.editorFrameTitle'),
  },
  // menubar: 'file edit view insert format tools table help',
  menubar: props.tinymceOptions?.menubar ?? false,
  plugins: mediaInsertionEnabled
    ? (props.tinymceOptions?.plugins ?? defaultPlugins)
    : withoutMediaInsertionPlugins(props.tinymceOptions?.plugins ?? defaultPlugins),
  toolbar: withoutToolbarItems(
    mediaInsertionEnabled
      ? (props.tinymceOptions?.toolbar ?? defaultToolbar)
      : withoutMediaInsertionToolbar(props.tinymceOptions?.toolbar ?? defaultToolbar),
    disabledOptionalToolbarItems,
  ),
  toolbar_mode: props.tinymceOptions?.toolbar_mode ?? 'wrap',
  advlist_bullet_styles: 'default,circle,square',
  advlist_number_styles: 'default,lower-alpha,lower-greek,lower-roman,upper-alpha,upper-roman',
  invalid_elements: isStrictEditorMode
    ? 'script,style,object,embed,applet,svg,math,base,meta,link'
    : 'script,object,embed,applet,base,meta,link',
  ...(!isStrictEditorMode
    ? {
        extended_valid_elements: 'style[type|media],svg[*]',
        valid_children:
          '+body[style|svg],+div[svg],+p[svg],+span[svg],+a[svg],+figure[svg],+li[svg],+td[svg],+th[svg]',
      }
    : {}),
  convert_unsafe_embeds: true,
  // table_advtab: false,
  // table_cell_advtab: false,
  // table_row_advtab: false,
  // table_appearance_options: false,
  // table_grid: false,
  table_toolbar: withoutToolbarTokenItems(
    props.tinymceOptions?.table_toolbar ?? defaultTableToolbar,
    disabledOptionalToolbarItems,
  ),
  table_default_header_rows: 1,
  table_header_type: 'sectionCells',
  ...(isStrictEditorMode
    ? {
        table_default_attributes: {
          class: 'cms-table',
        },
        table_default_styles: {},
        table_class_list: preserveExistingTableClassList,
        table_row_class_list: preserveExistingTableClassList,
        table_cell_class_list: preserveExistingTableClassList,
        table_border_styles: editorBorderStyleOptions.map(({ title, value }) => ({ title, value })),
        table_background_color_map: getEditorTableBackgroundColorMap(locale.value),
        table_border_color_map: getEditorTableBorderColorMap(locale.value),
        formats: {
          alignleft: [
            { selector: 'table', classes: 'cms-table-align-left' },
            { selector: 'tr', classes: 'cms-row-align-left' },
            { selector: 'td,th', classes: 'cms-cell-align-left' },
            { selector: 'p,h1,h2,h3,h4,h5,h6,div,ul,ol,li,img,figure', classes: 'cms-align-left' },
          ],
          aligncenter: [
            { selector: 'table', classes: 'cms-table-align-center' },
            { selector: 'tr', classes: 'cms-row-align-center' },
            { selector: 'td,th', classes: 'cms-cell-align-center' },
            {
              selector: 'p,h1,h2,h3,h4,h5,h6,div,ul,ol,li,img,figure',
              classes: 'cms-align-center',
            },
          ],
          alignright: [
            { selector: 'table', classes: 'cms-table-align-right' },
            { selector: 'tr', classes: 'cms-row-align-right' },
            { selector: 'td,th', classes: 'cms-cell-align-right' },
            { selector: 'p,h1,h2,h3,h4,h5,h6,div,ul,ol,li,img,figure', classes: 'cms-align-right' },
          ],
          alignjustify: [
            { selector: 'tr', classes: 'cms-row-align-justify' },
            { selector: 'td,th', classes: 'cms-cell-align-justify' },
            { selector: 'p,h1,h2,h3,h4,h5,h6,div,ul,ol,li', classes: 'cms-align-justify' },
          ],
          valigntop: { selector: 'td,th', classes: 'cms-cell-valign-top' },
          valignmiddle: { selector: 'td,th', classes: 'cms-cell-valign-middle' },
          valignbottom: { selector: 'td,th', classes: 'cms-cell-valign-bottom' },
          forecolor: {
            inline: 'span',
            styles: { color: '%value' },
            links: true,
            remove_similar: true,
            clear_child_styles: true,
            exact: true,
            onformat: (
              element: Element,
              _format: unknown,
              vars?: Record<string, string | null>,
            ) => {
              applyEditorColorClass(
                element,
                vars?.value,
                editorColorClassByValue,
                editorColorClasses,
                'color',
              )
            },
          },
          hilitecolor: {
            inline: 'span',
            styles: { backgroundColor: '%value' },
            links: true,
            remove_similar: true,
            clear_child_styles: true,
            exact: true,
            onformat: (
              element: Element,
              _format: unknown,
              vars?: Record<string, string | null>,
            ) => {
              applyEditorColorClass(
                element,
                vars?.value,
                editorBackgroundColorClassByValue,
                editorBackgroundColorClasses,
                'background-color',
              )
            },
          },
          fontname: {
            inline: 'span',
            toggle: false,
            classes: '%value',
            remove_similar: true,
            clear_child_styles: true,
            exact: true,
          },
          fontsize: {
            inline: 'span',
            toggle: false,
            classes: '%value',
            remove_similar: true,
            clear_child_styles: true,
            exact: true,
          },
        },
        font_family_formats: editorFontFamilyFormats,
        font_size_formats: editorFontSizeFormats,
        color_map_foreground: getEditorTextColorMap(locale.value),
        color_map_background: getEditorBackgroundColorMap(locale.value),
        custom_colors: false,
        color_picker_callback: null,
      }
    : {
        font_size_formats: relativeEditorFontSizeFormats,
        font_size_input_default_unit: 'rem',
      }),
  contextmenu: withoutContextMenuItems(
    mediaInsertionEnabled
      ? (props.tinymceOptions?.contextmenu ?? defaultContextMenu)
      : withoutMediaInsertionContextMenu(props.tinymceOptions?.contextmenu ?? defaultContextMenu),
    disabledOptionalContextMenuItems,
  ),
  skin: false,
  content_css: [
    resolveAssetUrl('tinymce/skins/ui/oxide/content.css'),
    resolveAssetUrl('tinymce/skins/content/default/content.css'),
    resolveAssetUrl('cms-content/templates.css'),
    resolveAssetUrl('cms-content/formatting.css'),
  ],
  content_security_policy: editorContentSecurityPolicy,
  // object_resizing: 'table'
  object_resizing: mediaInsertionEnabled
    ? 'img,figure.image,div,video,iframe,span.mce-preview-object'
    : 'table',
  resize_img_proportional: true,
  draggable_modal: true,
  promotion: false,
  branding: false,
  automatic_uploads: mediaInsertionEnabled,
  images_file_types: 'jpg,jpeg,png,gif,webp',
  ...(mediaInsertionEnabled
    ? {
        images_upload_handler: async (blobInfo, progress) => {
          try {
            const blob = blobInfo.blob()
            const file = new File([blob], blobInfo.filename(), { type: blob.type })
            const result = await uploadFile(
              uploadAdapter,
              file,
              {
                kind: 'image',
                source: 'editor',
                acceptedMimeTypes: imageUploadPolicy.acceptedMimeTypes,
                maxFileSize: imageUploadPolicy.maxFileSize,
                locale: locale.value as AppLocale,
              },
              progress,
            )
            rememberUploadedMedia(result)
            return result.src
          } catch (error) {
            if (error instanceof UploadValidationError) {
              if (error.code === 'invalidType') {
                throw new Error(mediaToolLabels.value.uploadInvalidType, { cause: error })
              }
              if (error.code === 'tooLarge') {
                throw new Error(mediaToolLabels.value.uploadTooLarge, { cause: error })
              }
              if (error.code === 'missingAdapter') {
                throw new Error(mediaToolLabels.value.uploadMissingAdapter, { cause: error })
              }
            }
            throw new Error(mediaToolLabels.value.uploadFailed, { cause: error })
          }
        },
      }
    : {}),
  sandbox_iframes: true,
  sandbox_iframes_exclusions: iframeSandboxExclusions,
  iframe_template_callback: createIframeTemplate,
  content_style: `${props.tinymceOptions?.content_style ?? ''}
    body {
      font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
      font-size: 1rem;
      line-height: 1.7;
      margin: 24px;
    }
    h1 { font-size: 2.5rem; }
    h2 { font-size: 2rem; }
    h3 { font-size: 1.75rem; }
    h4 { font-size: 1.5rem; }
    h5 { font-size: 1.25rem; }
    h6 { font-size: 1rem; }
    img { max-width: 100%; height: auto; }
    .mce-preview-object {
      max-width: 100%;
      cursor: move;
    }
    .mce-preview-object > iframe,
    .mce-preview-object > video {
      pointer-events: none !important;
    }
    .mce-preview-object .mce-shim,
    .mce-preview-object[data-mce-selected="2"] .mce-shim {
      display: block !important;
      cursor: move;
      pointer-events: auto;
    }
    .cms-a11y-active-issue {
      outline: 5px solid #d89525 !important;
      outline-offset: 5px !important;
      box-shadow:
        0 0 0 10px rgba(216, 149, 37, 0.24),
        0 12px 34px rgba(23, 35, 29, 0.28) !important;
      border-radius: 8px !important;
    }
  `,
  setup: (editor: TinyMCEEditor) => {
    editorInstance.value = editor
    installEditorAccessibilityFixes(editor)
    installToolbarTooltipDismiss(editor)
    if (isStrictEditorMode) {
      installTableDialogFieldGuard(editor)
    }
    if (mediaInsertionEnabled) {
      registerMediaTools(editor, mediaToolLabels.value, {
        uploadAdapter,
        locale: locale.value as AppLocale,
        allowedIframeDomains: props.allowedIframeDomains,
        onUploadComplete: rememberUploadedMedia,
      })
    }
    if (areCmsTemplatesEnabled) {
      registerCmsTemplates(editor, cmsTemplateLabels.value)
    }
    if (areCmsTableStylesEnabled) {
      registerCmsTableStyles(editor, cmsTableStyleLabels.value)
    }
    registerAccessibilityCheck(editor, mediaToolLabels.value, {
      profile: activeAccessibilityProfile,
    })
    const prepareMediaObjects = () => {
      if (mediaInsertionEnabled) {
        editor.dom.select<HTMLElement>('span.mce-preview-object').forEach((element) => {
          element.draggable = true
          element.setAttribute('data-mce-resize', 'true')
          element.setAttribute('tabindex', '0')
        })
      }
      editor.dom
        .select<HTMLIFrameElement>('iframe')
        .forEach((iframe) => normalizeTrustedIframeElement(iframe, props.allowedIframeDomains))
    }
    editor.on('PreInit', () => {
      if (isStrictEditorMode) {
        editor.parser.addNodeFilter('table,tr,td,th', (nodes) => {
          nodes.forEach((node) => hydrateTableDialogStyleNode(node))
        })
      }
      editor.parser.addNodeFilter('iframe', (nodes) => {
        nodes.forEach((node) => normalizeTrustedIframeNode(node, props.allowedIframeDomains))
      })
      editor.serializer.addNodeFilter('iframe', (nodes) => {
        nodes.forEach((node) => {
          normalizeTrustedIframeNode(node, props.allowedIframeDomains)
          normalizeMediaDimensionNode(node)
        })
      })
      editor.serializer.addNodeFilter('video', (nodes) => {
        nodes.forEach((node) => normalizeMediaDimensionNode(node))
      })
      if (isStrictEditorMode) {
        editor.serializer.addNodeFilter(
          'span,a,p,h1,h2,h3,h4,h5,h6,table,tr,td,th,div,ul,ol,li',
          (nodes) => {
            nodes.forEach((node) => {
              normalizeEditorColorNode(node)
            })
          },
        )
      }
    })
    editor.on('GetContent', (event) => {
      if (event.format === 'html') {
        event.content = prepareOutputHtml(event.content)
      }
    })
    editor.on('init', () => {
      emit('ready', editor)
      if (!isStrictEditorMode && workspaceMode.value === 'basic') {
        syncAdvancedCssToTinyMce(editor)
        basicHasRoundTripRisk.value =
          basicHasRoundTripRisk.value ||
          normalizeHtmlForComparison(editor.getContent()) !==
            normalizeHtmlForComparison(basicSourceBodyHtml.value)
        editor.setDirty(false)
      }
    })
    editor.on('Dirty', () => {
      emitDirtyState(true)
      if (!isStrictEditorMode && workspaceMode.value === 'basic') {
        basicHasUserChanges.value = true
      }
    })
    editor.on('input change undo redo', () => {
      if (!isStrictEditorMode && workspaceMode.value === 'basic') {
        basicHasUserChanges.value = true
      }
    })
    editor.on('init SetContent NodeChange', prepareMediaObjects)
    editor.on('BeforeExecCommand', (event) => {
      if (!isStrictEditorMode) {
        return
      }

      const commandUi = String(event.ui)

      if (event.command === 'FontName' && event.value === defaultEditorFontValue) {
        removeEditorFontClasses(editor)
        event.preventDefault()
        return
      }

      if (event.command === 'FontSize' && event.value === defaultEditorFontSizeValue) {
        removeEditorFontSizeClasses(editor)
        event.preventDefault()
        return
      }

      if (event.command === 'FontName') {
        removeEditorFontClasses(editor)
      }

      if (event.command === 'FontSize') {
        removeEditorFontSizeClasses(editor)
      }

      if (event.command === 'mceApplyTextcolor' && commandUi === 'forecolor') {
        removeEditorClassesInSelection(editor, editorColorClasses)
      }

      if (event.command === 'mceApplyTextcolor' && commandUi === 'hilitecolor') {
        removeEditorClassesInSelection(editor, editorBackgroundColorClasses)
      }

      if (event.command === 'ForeColor') {
        removeEditorClassesInSelection(editor, editorColorClasses)
      }

      if (event.command === 'HiliteColor' || event.command === 'BackColor') {
        removeEditorClassesInSelection(editor, editorBackgroundColorClasses)
      }

      if (event.command === 'mceRemoveTextcolor') {
        removeEditorColorClassesByFormat(editor, commandUi)
      }
    })
    editor.on('ExecCommand', (event) => {
      if (event.command !== 'mceRemoveTextcolor') {
        return
      }

      removeEditorColorClassesByFormat(editor, String(event.ui))
    })
    editor.on('keydown', openHelp)
    editor.on('focus', () => emit('focus', editor))
    editor.on('blur', () => emit('blur', editor))
    props.tinymceOptions?.setup?.(editor)
    editor.on('remove', () => {
      if (editorInstance.value === editor) {
        editorInstance.value = null
      }
    })
  },
  ...(locale.value === 'zh-TW'
    ? {
        language_url: resolveAssetUrl('langs/zh_TW.js'),
      }
    : {}),
}))

const prepareBasicWorkspace = () => {
  basicOriginalContent.value = cloneContent(content.value)
  const legacyContent = extractLegacyStyles(content.value.html)
  basicHtml.value = legacyContent.html
  basicSourceBodyHtml.value = legacyContent.html
  basicLegacyCss.value = legacyContent.css
  basicHasUserChanges.value = false
  basicHasRoundTripRisk.value = legacyContent.didExtract
}

const changeWorkspaceMode = (mode: 'basic' | 'advanced') => {
  if (
    mode === workspaceMode.value ||
    isStrictEditorMode ||
    (mode === 'advanced' && !isAdvancedWorkspaceEnabled)
  ) {
    return
  }

  if (mode === 'basic') {
    prepareBasicWorkspace()
    workspaceMode.value = 'basic'
    void ensureTinyMceReady()
    return
  }

  const editor = editorInstance.value
  if (editor && basicHasUserChanges.value) {
    const editedContent = extractLegacyStyles(editor.getContent())
    const enterAdvancedWorkspace = (shouldApply: boolean) => {
      if (shouldApply) {
        content.value = applyBasicHtmlChange(
          content.value,
          editedContent.html,
          basicLegacyCss.value,
          editedContent.css,
        )
      } else {
        content.value = cloneContent(basicOriginalContent.value)
      }

      workspaceMode.value = mode
    }

    if (basicHasRoundTripRisk.value) {
      editor.windowManager.confirm(
        t('app.advanced.applyBasicChangesConfirm'),
        enterAdvancedWorkspace,
      )
    } else {
      enterAdvancedWorkspace(true)
    }
    return
  }

  workspaceMode.value = mode
}

const openAdvancedCss = () => {
  advancedInitialTab.value = 'css'
  changeWorkspaceMode('advanced')
}

const toggleAdvancedCssInBasic = () => {
  isAdvancedCssEnabledInBasic.value = !isAdvancedCssEnabledInBasic.value
  syncAdvancedCssToTinyMce()
}

const updateBasicHtml = (value: string) => {
  const annotatedValue = applyUploadedMediaMetadata(value, uploadedMediaBySource)
  basicHtml.value = annotatedValue
  if (editorInstance.value?.isDirty()) {
    basicHasUserChanges.value = true
    content.value = applyBasicHtmlChange(content.value, annotatedValue)
  }
}

const updateAdvancedContent = (value: EditorContent) => {
  content.value = cloneContent(value)
}

const handleAdvancedDirty = () => {
  if (JSON.stringify(content.value) !== JSON.stringify(cleanContent.value)) {
    emitDirtyState(true)
  }
}

const setContent = (value: EditorContent) => {
  uploadedMediaBySource.clear()
  content.value = cloneContent(value)
  cleanContent.value = cloneContent(value)
  basicOriginalContent.value = cloneContent(value)
  basicLegacyCss.value = ''
  basicHasUserChanges.value = false
  basicHasRoundTripRisk.value = false
  emittedDirtyState = false

  if (workspaceMode.value === 'basic') {
    prepareBasicWorkspace()
  }

  void nextTick(() => editorInstance.value?.setDirty(false))
}

const getContent = (): EditorContent => {
  if (workspaceMode.value === 'basic' && editorInstance.value?.isDirty()) {
    return {
      ...content.value,
      html: applyUploadedMediaMetadata(editorInstance.value.getContent(), uploadedMediaBySource),
    }
  }

  return cloneContent(content.value)
}

const focus = () => {
  if (workspaceMode.value === 'advanced') {
    advancedEditorInstance.value?.focus()
    return
  }

  editorInstance.value?.focus()
}
const isDirty = () =>
  Boolean(
    editorInstance.value?.isDirty() ||
    basicHasUserChanges.value ||
    JSON.stringify(getContent()) !== JSON.stringify(cleanContent.value),
  )

const markClean = () => {
  cleanContent.value = getContent()
  basicHasUserChanges.value = false
  editorInstance.value?.setDirty(false)
  emitDirtyState(false, true)
}

const getCapabilityReport = () => analyzeContentCapabilities(getContent())
const getMediaReferenceManifest = () => extractMediaReferenceManifest(getContent())
const getPublicationReport = (policy: PublicationPolicy) =>
  evaluateContentForPublication(getContent(), policy)

defineExpose({
  focus,
  getCapabilityReport,
  getContent,
  getMediaReferenceManifest,
  getPublicationReport,
  isDirty,
  markClean,
  setContent,
  setWorkspaceMode: changeWorkspaceMode,
})

watch(
  () => props.modelValue,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(content.value)) {
      setContent(value)
    }
  },
  { deep: true },
)

watch(content, (value) => emit('update:modelValue', cloneContent(value)), { deep: true })

watch(
  () => props.locale,
  (value) => {
    locale.value = value
  },
)

watch(
  [advancedCssForBasic, isAdvancedCssEnabledInBasic, workspaceMode],
  () => syncAdvancedCssToTinyMce(),
  { flush: 'post' },
)
</script>

<template>
  <div
    ref="editorRoot"
    class="cms-content-editor"
    :style="{ '--cms-editor-height': `${height}px` }"
  >
    <section class="editor-card" :aria-label="t('app.editorLabel')">
      <nav
        v-if="isAdvancedWorkspaceEnabled"
        class="workspace-mode-switcher"
        :aria-label="t('app.editorModeLabel')"
      >
        <button
          type="button"
          class="workspace-mode-button"
          :class="{ 'is-active': workspaceMode === 'basic' }"
          :aria-pressed="workspaceMode === 'basic'"
          :disabled="disabled"
          @click="changeWorkspaceMode('basic')"
        >
          {{ t('app.basicMode') }}
        </button>
        <button
          type="button"
          class="workspace-mode-button"
          :class="{ 'is-active': workspaceMode === 'advanced' }"
          :aria-pressed="workspaceMode === 'advanced'"
          :disabled="disabled"
          @click="changeWorkspaceMode('advanced')"
        >
          {{ t('app.advancedMode') }}
        </button>
      </nav>

      <div
        v-if="isAdvancedWorkspaceEnabled && workspaceMode === 'basic' && hasAdvancedContent"
        class="advanced-content-tip"
        role="status"
      >
        <span>{{ t('app.advanced.basicModeTip') }}</span>
        <div class="advanced-content-tip__actions">
          <button type="button" :disabled="disabled" @click="openAdvancedCss">
            {{ t('app.advanced.openCss') }}
          </button>
          <button
            v-if="advancedCssForBasic.trim()"
            type="button"
            :disabled="disabled"
            @click="toggleAdvancedCssInBasic"
          >
            {{
              isAdvancedCssEnabledInBasic ? t('app.advanced.pauseCss') : t('app.advanced.enableCss')
            }}
          </button>
        </div>
      </div>

      <div class="editor-surface">
        <TinyMceEditor
          v-if="workspaceMode === 'basic' && isTinyMceReady"
          :key="locale"
          :model-value="basicHtml"
          :init="editorConfig"
          :license-key="licenseKey"
          :disabled="disabled"
          :readonly="readonly"
          @update:model-value="updateBasicHtml"
        />
        <p
          v-else-if="workspaceMode === 'basic' && tinyMceLoadError"
          class="editor-load-state is-error"
          role="alert"
        >
          {{ t('app.editorLoadFailed') }} {{ tinyMceLoadError }}
        </p>
        <p v-else-if="workspaceMode === 'basic'" class="editor-load-state" role="status">
          {{ t('app.editorLoading') }}
        </p>
        <AdvancedContentEditor
          v-else
          ref="advancedEditorInstance"
          :model-value="content"
          :initial-tab="advancedInitialTab"
          :locale="locale as AppLocale"
          :labels="advancedEditorLabels"
          :accessibility-profile="activeAccessibilityProfile"
          :enabled-tabs="advancedCodeTabs"
          :javascript-enabled="resolvedEditorPolicy.customJavaScriptEnabled"
          :disabled="disabled"
          :readonly="readonly"
          @update:model-value="updateAdvancedContent"
          @dirty="handleAdvancedDirty"
          @focus="emit('focus', null)"
          @blur="emit('blur', null)"
        />
      </div>
    </section>
  </div>
</template>
