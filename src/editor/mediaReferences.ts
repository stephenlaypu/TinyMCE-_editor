import type { EditorContent } from './types/editorContent'

export type ManagedMediaState = 'active' | 'temporary'

export type MediaReferenceStatus =
  | 'active'
  | 'temporary'
  | 'unknown-managed-state'
  | 'unmanaged'
  | 'preview-only'
  | 'admin-only'
  | 'embedded-data'
  | 'invalid'

export type MediaReferenceKind =
  'image' | 'video' | 'audio' | 'poster' | 'track' | 'source' | 'responsive-image-set'

export interface MediaReference {
  index: number
  kind: MediaReferenceKind
  element: string
  attribute: 'src' | 'srcset' | 'poster'
  url: string
  fileGuid?: string
  managedState?: ManagedMediaState
  status: MediaReferenceStatus
}

export interface MediaReferenceManifest {
  references: MediaReference[]
  fileGuids: string[]
  counts: Record<MediaReferenceStatus, number>
}

export interface MediaReferenceDelta {
  addedFileGuids: string[]
  removedFileGuids: string[]
  retainedFileGuids: string[]
  temporaryFileGuids: string[]
}

export interface ManagedMediaResolution {
  fileGuid: string
  publicUrl: string
}

export type ManagedMediaResolutionFailureCode =
  | 'duplicate-resolution'
  | 'invalid-public-url'
  | 'invalid-managed-element'
  | 'missing-resolution'
  | 'stale-managed-source'
  | 'unsupported-managed-srcset'

export interface ManagedMediaResolutionFailure {
  code: ManagedMediaResolutionFailureCode
  fileGuids?: string[]
}

export interface ManagedMediaResolutionResult {
  content: EditorContent
  resolved: boolean
  resolvedFileGuids: string[]
  failures: ManagedMediaResolutionFailure[]
}

interface ReferenceDescriptor {
  selector: string
  kind: MediaReferenceKind
  attribute: 'src' | 'srcset' | 'poster'
  guidAttribute: string
  stateAttribute: string
  sourceAttribute: string
}

const referenceDescriptors: readonly ReferenceDescriptor[] = [
  {
    selector: 'img[src]',
    kind: 'image',
    attribute: 'src',
    guidAttribute: 'data-cms-file-guid',
    stateAttribute: 'data-cms-file-state',
    sourceAttribute: 'data-cms-file-source',
  },
  {
    selector: 'img[srcset],source[srcset]',
    kind: 'responsive-image-set',
    attribute: 'srcset',
    guidAttribute: 'data-cms-srcset-file-guid',
    stateAttribute: 'data-cms-srcset-file-state',
    sourceAttribute: 'data-cms-srcset-file-source',
  },
  {
    selector: 'video[src]',
    kind: 'video',
    attribute: 'src',
    guidAttribute: 'data-cms-file-guid',
    stateAttribute: 'data-cms-file-state',
    sourceAttribute: 'data-cms-file-source',
  },
  {
    selector: 'audio[src]',
    kind: 'audio',
    attribute: 'src',
    guidAttribute: 'data-cms-file-guid',
    stateAttribute: 'data-cms-file-state',
    sourceAttribute: 'data-cms-file-source',
  },
  {
    selector: 'video[poster]',
    kind: 'poster',
    attribute: 'poster',
    guidAttribute: 'data-cms-poster-file-guid',
    stateAttribute: 'data-cms-poster-file-state',
    sourceAttribute: 'data-cms-poster-file-source',
  },
  {
    selector: 'video source[src],audio source[src],picture source[src]',
    kind: 'source',
    attribute: 'src',
    guidAttribute: 'data-cms-file-guid',
    stateAttribute: 'data-cms-file-state',
    sourceAttribute: 'data-cms-file-source',
  },
  {
    selector: 'track[src]',
    kind: 'track',
    attribute: 'src',
    guidAttribute: 'data-cms-file-guid',
    stateAttribute: 'data-cms-file-state',
    sourceAttribute: 'data-cms-file-source',
  },
] as const

const emptyCounts = (): Record<MediaReferenceStatus, number> => ({
  active: 0,
  temporary: 0,
  'unknown-managed-state': 0,
  unmanaged: 0,
  'preview-only': 0,
  'admin-only': 0,
  'embedded-data': 0,
  invalid: 0,
})

const normalizeManagedState = (value: string | null): ManagedMediaState | undefined => {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'active' || normalized === 'temporary' ? normalized : undefined
}

const parseSrcsetCandidates = (value: string): string[] => {
  const candidates: string[] = []
  let position = 0

  while (position < value.length) {
    while (position < value.length && /[\s,]/.test(value[position] ?? '')) {
      position += 1
    }
    if (position >= value.length) {
      break
    }

    const start = position
    const isDataUrl = value.slice(position).toLowerCase().startsWith('data:')
    while (
      position < value.length &&
      !/\s/.test(value[position] ?? '') &&
      (isDataUrl || value[position] !== ',')
    ) {
      position += 1
    }

    let url = value.slice(start, position)
    if (!isDataUrl && value[position] === ',') {
      position += 1
    } else {
      let parentheses = 0
      while (position < value.length) {
        const character = value[position]
        if (character === '(') parentheses += 1
        if (character === ')') parentheses = Math.max(0, parentheses - 1)
        if (character === ',' && parentheses === 0) {
          position += 1
          break
        }
        position += 1
      }
    }

    url = url.replace(/,+$/, '').trim()
    if (url) {
      candidates.push(url)
    }
  }

  return candidates
}

const classifyReference = (
  url: string,
  fileGuid: string | undefined,
  managedState: ManagedMediaState | undefined,
): MediaReferenceStatus => {
  const normalized = url.trim()
  if (/^blob:/i.test(normalized)) {
    return 'preview-only'
  }
  if (/^data:/i.test(normalized)) {
    return 'embedded-data'
  }

  try {
    const parsed = new URL(normalized, window.location.href)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'invalid'
    }
    const path = parsed.pathname.toLowerCase()
    if (/(^|\/)webadmin(\/|$)/.test(path) || /(^|\/)admin(\/|$)/.test(path)) {
      return 'admin-only'
    }
    if (/(^|\/)temp(?:orary)?(\/|$)/.test(path)) {
      return 'temporary'
    }
    return fileGuid ? (managedState ?? 'unknown-managed-state') : 'unmanaged'
  } catch {
    return 'invalid'
  }
}

export const extractMediaReferenceManifest = (
  content: Pick<EditorContent, 'html'>,
): MediaReferenceManifest => {
  const template = document.createElement('template')
  template.innerHTML = content.html
  const references: MediaReference[] = []

  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    referenceDescriptors.forEach((descriptor) => {
      if (!element.matches(descriptor.selector)) {
        return
      }
      const url = element.getAttribute(descriptor.attribute)?.trim()
      if (!url) {
        return
      }
      const urls = descriptor.attribute === 'srcset' ? parseSrcsetCandidates(url) : [url]
      const mayUseSingleManagedIdentity = urls.length === 1
      urls.forEach((candidateUrl) => {
        const fileGuid = mayUseSingleManagedIdentity
          ? element.getAttribute(descriptor.guidAttribute)?.trim() || undefined
          : undefined
        const managedState = mayUseSingleManagedIdentity
          ? normalizeManagedState(element.getAttribute(descriptor.stateAttribute))
          : undefined
        const declaredSource = mayUseSingleManagedIdentity
          ? element.getAttribute(descriptor.sourceAttribute)?.trim()
          : undefined
        references.push({
          index: references.length,
          kind: descriptor.kind,
          element: element.tagName.toLowerCase(),
          attribute: descriptor.attribute,
          url: candidateUrl,
          ...(fileGuid ? { fileGuid } : {}),
          ...(managedState ? { managedState } : {}),
          status:
            fileGuid && declaredSource && declaredSource !== candidateUrl
              ? 'invalid'
              : classifyReference(candidateUrl, fileGuid, managedState),
        })
      })
    })
  })

  const counts = emptyCounts()
  references.forEach(({ status }) => {
    counts[status] += 1
  })

  return {
    references,
    fileGuids: Array.from(
      new Set(references.flatMap(({ fileGuid }) => (fileGuid ? [fileGuid] : []))),
    ).sort(),
    counts,
  }
}

export const diffMediaReferenceManifests = (
  previous: MediaReferenceManifest,
  next: MediaReferenceManifest,
): MediaReferenceDelta => {
  const previousGuids = new Set(previous.fileGuids)
  const nextGuids = new Set(next.fileGuids)

  return {
    addedFileGuids: next.fileGuids.filter((guid) => !previousGuids.has(guid)),
    removedFileGuids: previous.fileGuids.filter((guid) => !nextGuids.has(guid)),
    retainedFileGuids: next.fileGuids.filter((guid) => previousGuids.has(guid)),
    temporaryFileGuids: Array.from(
      new Set(
        next.references.flatMap(({ fileGuid, status }) =>
          fileGuid && status === 'temporary' ? [fileGuid] : [],
        ),
      ),
    ).sort(),
  }
}

const isPermanentPublicMediaUrl = (value: string): boolean =>
  classifyReference(value, undefined, undefined) === 'unmanaged'

export const resolveManagedMediaReferences = (
  content: EditorContent,
  resolutions: readonly ManagedMediaResolution[],
): ManagedMediaResolutionResult => {
  const original = { ...content }
  const failures: ManagedMediaResolutionFailure[] = []
  const resolutionMap = new Map<string, string>()
  const duplicateResolutions = new Set<string>()
  const invalidPublicUrls = new Set<string>()

  resolutions.forEach(({ fileGuid, publicUrl }) => {
    const normalizedGuid = fileGuid.trim()
    const normalizedUrl = publicUrl.trim()
    if (!normalizedGuid || !isPermanentPublicMediaUrl(normalizedUrl)) {
      if (normalizedGuid) invalidPublicUrls.add(normalizedGuid)
      return
    }
    const current = resolutionMap.get(normalizedGuid)
    if (current && current !== normalizedUrl) {
      duplicateResolutions.add(normalizedGuid)
      return
    }
    resolutionMap.set(normalizedGuid, normalizedUrl)
  })

  if (duplicateResolutions.size) {
    failures.push({
      code: 'duplicate-resolution',
      fileGuids: Array.from(duplicateResolutions).sort(),
    })
  }
  if (invalidPublicUrls.size) {
    failures.push({
      code: 'invalid-public-url',
      fileGuids: Array.from(invalidPublicUrls).sort(),
    })
  }

  const template = document.createElement('template')
  template.innerHTML = content.html
  const missingResolutions = new Set<string>()
  const staleManagedSources = new Set<string>()
  const invalidManagedElements = new Set<string>()
  const resolvedFileGuids = new Set<string>()

  const resolveElementReference = (
    element: HTMLElement,
    attribute: 'src' | 'poster',
    guidAttribute: string,
    stateAttribute: string,
    sourceAttribute: string,
  ) => {
    const fileGuid = element.getAttribute(guidAttribute)?.trim()
    if (!fileGuid) return

    const currentUrl = element.getAttribute(attribute)?.trim() ?? ''
    const declaredSource = element.getAttribute(sourceAttribute)?.trim()
    if (declaredSource && declaredSource !== currentUrl) {
      staleManagedSources.add(fileGuid)
      return
    }

    const publicUrl = resolutionMap.get(fileGuid)
    if (!publicUrl) {
      missingResolutions.add(fileGuid)
      return
    }

    element.setAttribute(attribute, publicUrl)
    element.setAttribute(stateAttribute, 'active')
    element.setAttribute(sourceAttribute, publicUrl)
    resolvedFileGuids.add(fileGuid)
  }

  template.content.querySelectorAll<HTMLElement>('[data-cms-file-guid]').forEach((element) => {
    if (!element.matches('img,video,audio,source,track')) {
      const fileGuid = element.getAttribute('data-cms-file-guid')?.trim()
      if (fileGuid) invalidManagedElements.add(fileGuid)
    }
  })
  template.content
    .querySelectorAll<HTMLElement>(
      'img[data-cms-file-guid],video[data-cms-file-guid],audio[data-cms-file-guid],source[data-cms-file-guid],track[data-cms-file-guid]',
    )
    .forEach((element) =>
      resolveElementReference(
        element,
        'src',
        'data-cms-file-guid',
        'data-cms-file-state',
        'data-cms-file-source',
      ),
    )
  template.content
    .querySelectorAll<HTMLElement>('[data-cms-poster-file-guid]')
    .forEach((element) => {
      if (!element.matches('video')) {
        const fileGuid = element.getAttribute('data-cms-poster-file-guid')?.trim()
        if (fileGuid) invalidManagedElements.add(fileGuid)
      }
    })
  template.content
    .querySelectorAll<HTMLElement>('video[data-cms-poster-file-guid]')
    .forEach((element) =>
      resolveElementReference(
        element,
        'poster',
        'data-cms-poster-file-guid',
        'data-cms-poster-file-state',
        'data-cms-poster-file-source',
      ),
    )

  const managedSrcsetGuids = Array.from(
    template.content.querySelectorAll<HTMLElement>('[data-cms-srcset-file-guid]'),
  ).flatMap((element) => {
    const fileGuid = element.getAttribute('data-cms-srcset-file-guid')?.trim()
    return fileGuid ? [fileGuid] : []
  })
  if (managedSrcsetGuids.length) {
    failures.push({
      code: 'unsupported-managed-srcset',
      fileGuids: Array.from(new Set(managedSrcsetGuids)).sort(),
    })
  }
  if (invalidManagedElements.size) {
    failures.push({
      code: 'invalid-managed-element',
      fileGuids: Array.from(invalidManagedElements).sort(),
    })
  }
  if (missingResolutions.size) {
    failures.push({
      code: 'missing-resolution',
      fileGuids: Array.from(missingResolutions).sort(),
    })
  }
  if (staleManagedSources.size) {
    failures.push({
      code: 'stale-managed-source',
      fileGuids: Array.from(staleManagedSources).sort(),
    })
  }

  if (failures.length) {
    return {
      content: original,
      resolved: false,
      resolvedFileGuids: [],
      failures,
    }
  }

  return {
    content: { ...content, html: template.innerHTML },
    resolved: true,
    resolvedFileGuids: Array.from(resolvedFileGuids).sort(),
    failures: [],
  }
}
