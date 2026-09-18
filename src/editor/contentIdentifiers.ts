import { cssLanguage } from '@codemirror/lang-css'
import { analyzeCss } from './cssPolicy'
import type { EditorContent } from './types/editorContent'

export interface ContentIdentifierCollision {
  value: string
  blockKeys: string[]
}

export interface ContentIdentifierCollisionReport {
  ids: ContentIdentifierCollision[]
  radioNames: ContentIdentifierCollision[]
}

export type IdentifierNamespaceFailureCode =
  | 'custom-javascript'
  | 'duplicate-id'
  | 'executable-html'
  | 'invalid-css'
  | 'invalid-id'
  | 'invalid-namespace'

export interface IdentifierNamespaceFailure {
  code: IdentifierNamespaceFailureCode
  values?: string[]
}

export interface IdentifierNamespaceResult {
  content: EditorContent
  transformed: boolean
  failures: IdentifierNamespaceFailure[]
  idMap: Record<string, string>
  radioNameMap: Record<string, string>
}

const namespacePattern = /^[A-Za-z][A-Za-z0-9_-]*$/
const singleIdReferenceAttributes = ['aria-activedescendant', 'form', 'for', 'list'] as const
const multipleIdReferenceAttributes = [
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-labelledby',
  'aria-owns',
  'headers',
] as const
const fragmentReferenceAttributes = ['data-bs-target', 'data-target', 'href', 'xlink:href'] as const
const svgUrlReferenceAttributes = [
  'clip-path',
  'fill',
  'filter',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
] as const

const cloneContent = (content: EditorContent): EditorContent => ({ ...content })

const collectIdentifiers = (content: EditorContent) => {
  const template = document.createElement('template')
  template.innerHTML = content.html
  const ids = Array.from(template.content.querySelectorAll<HTMLElement>('[id]'))
    .map((element) => element.id)
    .filter(Boolean)
  const radioNames = Array.from(
    template.content.querySelectorAll<HTMLInputElement>('input[type="radio"][name]'),
  )
    .map((element) => element.name)
    .filter(Boolean)

  return { ids, radioNames }
}

const collectCollisions = (
  blocks: readonly { blockKey: string; values: readonly string[] }[],
): ContentIdentifierCollision[] => {
  const occurrences = new Map<string, Set<string>>()

  blocks.forEach(({ blockKey, values }) => {
    new Set(values).forEach((value) => {
      const blockKeys = occurrences.get(value) ?? new Set<string>()
      blockKeys.add(blockKey)
      occurrences.set(value, blockKeys)
    })
  })

  return Array.from(occurrences.entries())
    .filter(([, blockKeys]) => blockKeys.size > 1)
    .map(([value, blockKeys]) => ({ value, blockKeys: Array.from(blockKeys).sort() }))
    .sort((left, right) => left.value.localeCompare(right.value))
}

export const findContentIdentifierCollisions = (
  blocks: readonly { blockKey: string; content: EditorContent }[],
): ContentIdentifierCollisionReport => {
  const identifiers = blocks.map(({ blockKey, content }) => ({
    blockKey,
    ...collectIdentifiers(content),
  }))

  return {
    ids: collectCollisions(identifiers.map(({ blockKey, ids }) => ({ blockKey, values: ids }))),
    radioNames: collectCollisions(
      identifiers.map(({ blockKey, radioNames }) => ({ blockKey, values: radioNames })),
    ),
  }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const rewriteCssFragmentUrls = (source: string, idMap: Map<string, string>) => {
  let result = source
  idMap.forEach((nextId, previousId) => {
    const escapedId = escapeRegExp(previousId)
    result = result.replace(
      new RegExp(`url\\(\\s*(["']?)#${escapedId}\\1\\s*\\)`, 'g'),
      (_match, quote: string) => `url(${quote}#${nextId}${quote})`,
    )
  })
  return result
}

const rewriteCssIdentifiers = (source: string, idMap: Map<string, string>) => {
  if (!source.trim() || idMap.size === 0) {
    return source
  }

  const tree = cssLanguage.parser.parse(source)
  const replacements: Array<{ from: number; to: number; value: string }> = []

  tree.iterate({
    enter(node) {
      if (node.name !== 'IdSelector') {
        return
      }

      const idName = node.node.getChild('IdName')
      if (!idName) {
        return
      }

      const previousId = source.slice(idName.from, idName.to)
      const nextId = idMap.get(previousId)
      if (nextId) {
        replacements.push({ from: idName.from, to: idName.to, value: nextId })
      }
    },
  })

  let result = source
  replacements
    .sort((left, right) => right.from - left.from)
    .forEach(({ from, to, value }) => {
      result = `${result.slice(0, from)}${value}${result.slice(to)}`
    })

  return rewriteCssFragmentUrls(result, idMap)
}

const rewriteSpaceSeparatedIdReferences = (value: string, idMap: Map<string, string>) =>
  value
    .trim()
    .split(/\s+/)
    .map((id) => idMap.get(id) ?? id)
    .join(' ')

export const namespaceContentIdentifiers = (
  content: EditorContent,
  namespace: string,
): IdentifierNamespaceResult => {
  const original = cloneContent(content)
  const failures: IdentifierNamespaceFailure[] = []
  const normalizedNamespace = namespace.trim()

  if (!namespacePattern.test(normalizedNamespace)) {
    failures.push({ code: 'invalid-namespace' })
  }
  if (content.js.trim()) {
    failures.push({ code: 'custom-javascript' })
  }

  const template = document.createElement('template')
  template.innerHTML = content.html
  const containsExecutableHtml =
    Boolean(template.content.querySelector('script')) ||
    Array.from(template.content.querySelectorAll('*')).some((element) =>
      Array.from(element.attributes).some(({ name }) => name.toLowerCase().startsWith('on')),
    )

  if (containsExecutableHtml) {
    failures.push({ code: 'executable-html' })
  }
  const elementsWithIds = Array.from(template.content.querySelectorAll<HTMLElement>('[id]'))
  const idCounts = new Map<string, number>()
  elementsWithIds.forEach((element) => {
    idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1)
  })
  const duplicateIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
  const invalidIds = Array.from(idCounts.keys()).filter((id) => !id || /\s/.test(id))

  if (duplicateIds.length) {
    failures.push({ code: 'duplicate-id', values: duplicateIds.sort() })
  }
  if (invalidIds.length) {
    failures.push({ code: 'invalid-id', values: invalidIds.sort() })
  }

  const embeddedStyles = Array.from(template.content.querySelectorAll('style'))
  const stylesheets = [
    ...embeddedStyles.map((style) => style.textContent ?? ''),
    content.css,
  ].filter(Boolean)
  if (stylesheets.some((source) => analyzeCss(source).syntaxErrors.length > 0)) {
    failures.push({ code: 'invalid-css' })
  }

  if (failures.length) {
    return {
      content: original,
      transformed: false,
      failures,
      idMap: {},
      radioNameMap: {},
    }
  }

  const idMap = new Map(
    Array.from(idCounts.keys()).map((id) => [id, `${normalizedNamespace}-${id}`]),
  )
  const radioNames = new Set(
    Array.from(template.content.querySelectorAll<HTMLInputElement>('input[type="radio"][name]'))
      .map((element) => element.name)
      .filter(Boolean),
  )
  const radioNameMap = new Map(
    Array.from(radioNames).map((name) => [name, `${normalizedNamespace}-${name}`]),
  )

  elementsWithIds.forEach((element) => {
    element.id = idMap.get(element.id) ?? element.id
  })

  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    singleIdReferenceAttributes.forEach((attributeName) => {
      const value = element.getAttribute(attributeName)
      if (value && idMap.has(value)) {
        element.setAttribute(attributeName, idMap.get(value) ?? value)
      }
    })

    multipleIdReferenceAttributes.forEach((attributeName) => {
      const value = element.getAttribute(attributeName)
      if (value) {
        element.setAttribute(attributeName, rewriteSpaceSeparatedIdReferences(value, idMap))
      }
    })

    fragmentReferenceAttributes.forEach((attributeName) => {
      const value = element.getAttribute(attributeName)
      if (value?.startsWith('#')) {
        const nextId = idMap.get(value.slice(1))
        if (nextId) {
          element.setAttribute(attributeName, `#${nextId}`)
        }
      }
    })

    const style = element.getAttribute('style')
    if (style) {
      element.setAttribute('style', rewriteCssFragmentUrls(style, idMap))
    }

    svgUrlReferenceAttributes.forEach((attributeName) => {
      const value = element.getAttribute(attributeName)
      if (value) {
        element.setAttribute(attributeName, rewriteCssFragmentUrls(value, idMap))
      }
    })
  })

  template.content
    .querySelectorAll<HTMLInputElement>('input[type="radio"][name]')
    .forEach((element) => {
      element.name = radioNameMap.get(element.name) ?? element.name
    })

  embeddedStyles.forEach((style) => {
    style.textContent = rewriteCssIdentifiers(style.textContent ?? '', idMap)
  })

  return {
    content: {
      html: template.innerHTML,
      css: rewriteCssIdentifiers(content.css, idMap),
      js: content.js,
    },
    transformed: true,
    failures,
    idMap: Object.fromEntries(idMap),
    radioNameMap: Object.fromEntries(radioNameMap),
  }
}
