import type { ManagedMediaResolution } from './mediaReferences'
import {
  resolvePageManagedMediaReferences,
  type PageMediaResolutionResult,
} from './pageMediaReferences'
import {
  preparePageContentForPublication,
  type PageContentBlock,
  type PagePublicationPolicy,
  type PagePublicationPreparation,
} from './pageContentPolicy'

export type PagePublicationPipelineFailureCode =
  'media-resolution-failed' | 'publication-preparation-failed'

export interface PagePublicationPipelineResult {
  ready: boolean
  blocks: PageContentBlock[]
  media: PageMediaResolutionResult
  publication?: PagePublicationPreparation
  failures: PagePublicationPipelineFailureCode[]
}

export const prepareResolvedPageContentForPublication = (
  blocks: readonly PageContentBlock[],
  policy: PagePublicationPolicy,
  mediaResolutions: readonly ManagedMediaResolution[],
): PagePublicationPipelineResult => {
  const media = resolvePageManagedMediaReferences(blocks, mediaResolutions)
  if (!media.resolved) {
    return {
      ready: false,
      blocks: media.blocks,
      media,
      failures: ['media-resolution-failed'],
    }
  }

  const publication = preparePageContentForPublication(media.blocks, policy)
  if (!publication.ready) {
    return {
      ready: false,
      blocks: media.blocks,
      media,
      publication,
      failures: ['publication-preparation-failed'],
    }
  }

  return {
    ready: true,
    blocks: publication.blocks,
    media,
    publication,
    failures: [],
  }
}
