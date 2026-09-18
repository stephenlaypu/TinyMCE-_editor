import type { PageContentBlock } from './pageContentPolicy'
import {
  extractMediaReferenceManifest,
  resolveManagedMediaReferences,
  type ManagedMediaResolution,
  type ManagedMediaResolutionFailure,
} from './mediaReferences'

export interface PageMediaResolutionFailure {
  blockKey: string
  failures: ManagedMediaResolutionFailure[]
}

export interface PageMediaResolutionResult {
  resolved: boolean
  blocks: PageContentBlock[]
  resolvedFileGuids: string[]
  blockFailures: PageMediaResolutionFailure[]
}

const cloneBlocks = (blocks: readonly PageContentBlock[]): PageContentBlock[] =>
  blocks.map(({ blockKey, content }) => ({ blockKey, content: { ...content } }))

export const resolvePageManagedMediaReferences = (
  blocks: readonly PageContentBlock[],
  resolutions: readonly ManagedMediaResolution[],
): PageMediaResolutionResult => {
  const originalCopies = cloneBlocks(blocks)
  const blockFailures: PageMediaResolutionFailure[] = []
  const resolvedFileGuids = new Set<string>()
  const resolvedBlocks = originalCopies.map(({ blockKey, content }) => {
    const manifest = extractMediaReferenceManifest(content)
    const managedGuids = new Set(manifest.fileGuids)
    const hasManagedMetadata = /data-cms-(?:file|poster-file|srcset-file)-guid\s*=/i.test(
      content.html,
    )
    if (!managedGuids.size && !hasManagedMetadata) {
      return { blockKey, content }
    }

    const relevantResolutions = resolutions.filter(({ fileGuid }) =>
      managedGuids.has(fileGuid.trim()),
    )
    const result = resolveManagedMediaReferences(content, relevantResolutions)
    if (!result.resolved) {
      blockFailures.push({ blockKey, failures: result.failures })
      return { blockKey, content }
    }
    result.resolvedFileGuids.forEach((fileGuid) => resolvedFileGuids.add(fileGuid))
    return { blockKey, content: result.content }
  })

  if (blockFailures.length) {
    return {
      resolved: false,
      blocks: originalCopies,
      resolvedFileGuids: [],
      blockFailures,
    }
  }

  return {
    resolved: true,
    blocks: resolvedBlocks,
    resolvedFileGuids: Array.from(resolvedFileGuids).sort(),
    blockFailures: [],
  }
}
