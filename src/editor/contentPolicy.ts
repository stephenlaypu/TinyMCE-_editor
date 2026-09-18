import type { EditorContent } from './types/editorContent'
import { analyzeCss } from './cssPolicy'
import { extractMediaReferenceManifest, type MediaReferenceManifest } from './mediaReferences'

export interface ContentCapabilityCounts {
  embeddedStyles: number
  inlineStyles: number
  inlineSvg: number
  formControls: number
  iframes: number
  scriptElements: number
  eventHandlers: number
  unsafeActiveUrls: number
  objectEmbeds: number
  cssImports: number
  cssUrls: number
  cssMediaQueries: number
  cssKeyframes: number
  fixedPositioning: number
}

export interface ContentCapabilityReport {
  counts: ContentCapabilityCounts
  duplicateIds: string[]
  cssSyntaxErrorCount: number
  globalCssSelectors: string[]
  hasCustomCss: boolean
  hasCustomJavaScript: boolean
  media: MediaReferenceManifest
}

export type ContentPolicyDecision = 'allow' | 'deny'
export type JavaScriptPublicationPolicy = 'disabled' | 'sandboxed'

export interface PublicationPolicy {
  embeddedStyles: ContentPolicyDecision
  inlineStyles: ContentPolicyDecision
  inlineSvg: ContentPolicyDecision
  formControls: ContentPolicyDecision
  iframes: ContentPolicyDecision
  customCss: ContentPolicyDecision
  customJavaScript: JavaScriptPublicationPolicy
  externalCssResources: ContentPolicyDecision
  fixedPositioning: ContentPolicyDecision
  globalCssSelectors: ContentPolicyDecision
  unmanagedMedia: ContentPolicyDecision
  dataMediaUrls: ContentPolicyDecision
}

export type PublicationViolationCode =
  | 'embedded-styles-denied'
  | 'inline-styles-denied'
  | 'inline-svg-denied'
  | 'form-controls-denied'
  | 'iframes-denied'
  | 'custom-css-denied'
  | 'custom-javascript-disabled'
  | 'external-css-resources-denied'
  | 'fixed-positioning-denied'
  | 'global-css-selectors-denied'
  | 'invalid-css'
  | 'script-elements-in-html'
  | 'event-handlers-in-html'
  | 'unsafe-active-url'
  | 'object-embed-elements'
  | 'duplicate-id'
  | 'preview-media-url'
  | 'temporary-media-asset'
  | 'unknown-managed-media-state'
  | 'admin-media-url'
  | 'invalid-media-url'
  | 'unmanaged-media-denied'
  | 'data-media-url-denied'

export interface PublicationViolation {
  code: PublicationViolationCode
  count: number
  values?: string[]
}

export interface PublicationEvaluation {
  canPublish: boolean
  requiresSandboxedJavaScript: boolean
  capabilities: ContentCapabilityReport
  violations: PublicationViolation[]
}

export const publicationPolicyPresets = Object.freeze({
  managed: Object.freeze<PublicationPolicy>({
    embeddedStyles: 'deny',
    inlineStyles: 'deny',
    inlineSvg: 'deny',
    formControls: 'deny',
    iframes: 'deny',
    customCss: 'deny',
    customJavaScript: 'disabled',
    externalCssResources: 'deny',
    fixedPositioning: 'deny',
    globalCssSelectors: 'deny',
    unmanagedMedia: 'deny',
    dataMediaUrls: 'deny',
  }),
  flexibleContent: Object.freeze<PublicationPolicy>({
    embeddedStyles: 'deny',
    inlineStyles: 'allow',
    inlineSvg: 'allow',
    formControls: 'allow',
    iframes: 'deny',
    customCss: 'allow',
    customJavaScript: 'disabled',
    externalCssResources: 'deny',
    fixedPositioning: 'deny',
    globalCssSelectors: 'deny',
    unmanagedMedia: 'allow',
    dataMediaUrls: 'deny',
  }),
})

const emptyCounts = (): ContentCapabilityCounts => ({
  embeddedStyles: 0,
  inlineStyles: 0,
  inlineSvg: 0,
  formControls: 0,
  iframes: 0,
  scriptElements: 0,
  eventHandlers: 0,
  unsafeActiveUrls: 0,
  objectEmbeds: 0,
  cssImports: 0,
  cssUrls: 0,
  cssMediaQueries: 0,
  cssKeyframes: 0,
  fixedPositioning: 0,
})

const countMatches = (source: string, pattern: RegExp): number =>
  Array.from(source.matchAll(pattern)).length

const stripCssComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '')

const unsafeActiveUrlPattern =
  /^\s*(?:javascript|vbscript|data\s*:\s*(?:text\/html|image\/svg\+xml))/i
const urlAttributeNames = new Set(['action', 'formaction', 'href', 'poster', 'src', 'xlink:href'])

export const analyzeContentCapabilities = (content: EditorContent): ContentCapabilityReport => {
  const template = document.createElement('template')
  template.innerHTML = content.html
  const elements = Array.from(template.content.querySelectorAll<HTMLElement>('*'))
  const embeddedCss = Array.from(template.content.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n')
  const inlineCss = elements
    .map((element) => element.getAttribute('style') ?? '')
    .filter(Boolean)
    .join('\n')
  const stylesheetCss = [embeddedCss, content.css].filter(Boolean).join('\n')
  const cssAnalysis = analyzeCss(stylesheetCss)
  const media = extractMediaReferenceManifest(content)
  const css = stripCssComments([stylesheetCss, inlineCss].filter(Boolean).join('\n'))
  const idCounts = new Map<string, number>()
  let eventHandlers = 0
  let unsafeActiveUrls = 0

  elements.forEach((element) => {
    if (element.id) {
      idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1)
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) {
        eventHandlers += 1
      }
      if (urlAttributeNames.has(name) && unsafeActiveUrlPattern.test(attribute.value)) {
        unsafeActiveUrls += 1
      }
    })
  })

  const counts = emptyCounts()
  counts.embeddedStyles = template.content.querySelectorAll('style').length
  counts.inlineStyles = elements.filter((element) => element.hasAttribute('style')).length
  counts.inlineSvg = template.content.querySelectorAll('svg').length
  counts.formControls = template.content.querySelectorAll(
    'form,input,button,select,textarea,fieldset',
  ).length
  counts.iframes = template.content.querySelectorAll('iframe').length
  counts.scriptElements = template.content.querySelectorAll('script').length
  counts.eventHandlers = eventHandlers
  counts.unsafeActiveUrls = unsafeActiveUrls
  counts.objectEmbeds = template.content.querySelectorAll('object,embed,applet').length
  counts.cssImports = countMatches(css, /@import\b/gi)
  counts.cssUrls = countMatches(css, /url\s*\(/gi)
  counts.cssMediaQueries = countMatches(css, /@media\b/gi)
  counts.cssKeyframes = countMatches(css, /@(?:-webkit-)?keyframes\b/gi)
  counts.fixedPositioning = countMatches(css, /\bposition\s*:\s*fixed\b/gi)

  return {
    counts,
    duplicateIds: Array.from(idCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id)
      .sort(),
    cssSyntaxErrorCount: cssAnalysis.syntaxErrors.length,
    globalCssSelectors: cssAnalysis.globalSelectors.map(({ selector }) => selector),
    hasCustomCss: Boolean(content.css.trim()),
    hasCustomJavaScript: Boolean(content.js.trim()),
    media,
  }
}

const addViolation = (
  violations: PublicationViolation[],
  code: PublicationViolationCode,
  count: number,
  values?: string[],
) => {
  if (count > 0) {
    violations.push({ code, count, ...(values?.length ? { values } : {}) })
  }
}

export const evaluateContentForPublication = (
  content: EditorContent,
  policy: PublicationPolicy,
): PublicationEvaluation => {
  const capabilities = analyzeContentCapabilities(content)
  const { counts } = capabilities
  const violations: PublicationViolation[] = []

  if (policy.embeddedStyles === 'deny') {
    addViolation(violations, 'embedded-styles-denied', counts.embeddedStyles)
  }
  if (policy.inlineStyles === 'deny') {
    addViolation(violations, 'inline-styles-denied', counts.inlineStyles)
  }
  if (policy.inlineSvg === 'deny') {
    addViolation(violations, 'inline-svg-denied', counts.inlineSvg)
  }
  if (policy.formControls === 'deny') {
    addViolation(violations, 'form-controls-denied', counts.formControls)
  }
  if (policy.iframes === 'deny') {
    addViolation(violations, 'iframes-denied', counts.iframes)
  }
  if (policy.customCss === 'deny' && capabilities.hasCustomCss) {
    addViolation(violations, 'custom-css-denied', 1)
  }
  if (policy.customJavaScript === 'disabled' && capabilities.hasCustomJavaScript) {
    addViolation(violations, 'custom-javascript-disabled', 1)
  }
  if (policy.externalCssResources === 'deny') {
    addViolation(violations, 'external-css-resources-denied', counts.cssImports + counts.cssUrls)
  }
  if (policy.fixedPositioning === 'deny') {
    addViolation(violations, 'fixed-positioning-denied', counts.fixedPositioning)
  }
  if (policy.globalCssSelectors === 'deny') {
    addViolation(
      violations,
      'global-css-selectors-denied',
      capabilities.globalCssSelectors.length,
      capabilities.globalCssSelectors,
    )
  }

  addViolation(
    violations,
    'preview-media-url',
    capabilities.media.counts['preview-only'],
    capabilities.media.references
      .filter(({ status }) => status === 'preview-only')
      .map(({ url }) => url),
  )
  addViolation(
    violations,
    'temporary-media-asset',
    capabilities.media.counts.temporary,
    capabilities.media.references
      .filter(({ status }) => status === 'temporary')
      .map(({ fileGuid, url }) => fileGuid ?? url),
  )
  addViolation(
    violations,
    'unknown-managed-media-state',
    capabilities.media.counts['unknown-managed-state'],
    capabilities.media.references
      .filter(({ status }) => status === 'unknown-managed-state')
      .map(({ fileGuid, url }) => fileGuid ?? url),
  )
  addViolation(
    violations,
    'admin-media-url',
    capabilities.media.counts['admin-only'],
    capabilities.media.references
      .filter(({ status }) => status === 'admin-only')
      .map(({ url }) => url),
  )
  addViolation(
    violations,
    'invalid-media-url',
    capabilities.media.counts.invalid,
    capabilities.media.references
      .filter(({ status }) => status === 'invalid')
      .map(({ url }) => url),
  )
  if (policy.unmanagedMedia === 'deny') {
    addViolation(
      violations,
      'unmanaged-media-denied',
      capabilities.media.counts.unmanaged,
      capabilities.media.references
        .filter(({ status }) => status === 'unmanaged')
        .map(({ url }) => url),
    )
  }
  if (policy.dataMediaUrls === 'deny') {
    addViolation(violations, 'data-media-url-denied', capabilities.media.counts['embedded-data'])
  }

  addViolation(violations, 'invalid-css', capabilities.cssSyntaxErrorCount)

  addViolation(violations, 'script-elements-in-html', counts.scriptElements)
  addViolation(violations, 'event-handlers-in-html', counts.eventHandlers)
  addViolation(violations, 'unsafe-active-url', counts.unsafeActiveUrls)
  addViolation(violations, 'object-embed-elements', counts.objectEmbeds)
  addViolation(
    violations,
    'duplicate-id',
    capabilities.duplicateIds.length,
    capabilities.duplicateIds,
  )

  return {
    canPublish: violations.length === 0,
    requiresSandboxedJavaScript:
      capabilities.hasCustomJavaScript && policy.customJavaScript === 'sandboxed',
    capabilities,
    violations,
  }
}
