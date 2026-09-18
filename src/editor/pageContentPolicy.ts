import type { EditorContent } from './types/editorContent'
import {
  evaluateContentForPublication,
  type PublicationEvaluation,
  type PublicationPolicy,
} from './contentPolicy'
import {
  findContentIdentifierCollisions,
  namespaceContentIdentifiers,
  type ContentIdentifierCollisionReport,
  type IdentifierNamespaceFailure,
} from './contentIdentifiers'

export interface PageContentBlock {
  blockKey: string
  content: EditorContent
}

export type IdentifierCollisionStrategy = 'deny' | 'namespace' | 'isolated-document'

export interface PagePublicationPolicy {
  content: PublicationPolicy
  identifierCollisions: IdentifierCollisionStrategy
}

export type PagePublicationViolationCode =
  | 'duplicate-block-key'
  | 'cross-block-id'
  | 'cross-block-radio-name'
  | 'identifier-namespace-failed'

export interface PagePublicationViolation {
  code: PagePublicationViolationCode
  count: number
  values?: string[]
  blockKeys?: string[]
}

export interface BlockPublicationEvaluation {
  blockKey: string
  evaluation: PublicationEvaluation
}

export interface BlockNamespaceFailure {
  blockKey: string
  failures: IdentifierNamespaceFailure[]
}

export interface PagePublicationEvaluation {
  canPublish: boolean
  requiresSandboxedJavaScript: boolean
  requiresIsolatedDocuments: boolean
  blocks: BlockPublicationEvaluation[]
  collisions: ContentIdentifierCollisionReport
  namespaceFailures: BlockNamespaceFailure[]
  violations: PagePublicationViolation[]
}

export type PagePublicationRenderMode = 'same-document' | 'isolated-document'

export type PagePublicationPreparationFailureCode =
  'publication-policy-failed' | 'identifier-namespace-failed' | 'residual-identifier-collision'

export interface PagePublicationPreparationFailure {
  code: PagePublicationPreparationFailureCode
  blockKeys?: string[]
  values?: string[]
}

export interface PagePublicationPreparation {
  ready: boolean
  renderMode: PagePublicationRenderMode
  blocks: PageContentBlock[]
  transformedBlockKeys: string[]
  evaluation: PagePublicationEvaluation
  residualCollisions: ContentIdentifierCollisionReport
  failures: PagePublicationPreparationFailure[]
}

const duplicateValues = (values: readonly string[]) => {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

const collisionBlockKeys = (collisions: ContentIdentifierCollisionReport) =>
  new Set([...collisions.ids, ...collisions.radioNames].flatMap(({ blockKeys }) => blockKeys))

export const evaluatePageContentForPublication = (
  pageBlocks: readonly PageContentBlock[],
  policy: PagePublicationPolicy,
): PagePublicationEvaluation => {
  const blocks = pageBlocks.map(({ blockKey, content }) => ({
    blockKey,
    evaluation: evaluateContentForPublication(content, policy.content),
  }))
  const collisions = findContentIdentifierCollisions(pageBlocks)
  const violations: PagePublicationViolation[] = []
  const namespaceFailures: BlockNamespaceFailure[] = []
  const duplicateBlockKeys = duplicateValues(pageBlocks.map(({ blockKey }) => blockKey))

  if (duplicateBlockKeys.length) {
    violations.push({
      code: 'duplicate-block-key',
      count: duplicateBlockKeys.length,
      values: duplicateBlockKeys,
      blockKeys: duplicateBlockKeys,
    })
  }

  if (policy.identifierCollisions === 'deny') {
    if (collisions.ids.length) {
      violations.push({
        code: 'cross-block-id',
        count: collisions.ids.length,
        values: collisions.ids.map(({ value }) => value),
        blockKeys: Array.from(collisionBlockKeys({ ids: collisions.ids, radioNames: [] })).sort(),
      })
    }
    if (collisions.radioNames.length) {
      violations.push({
        code: 'cross-block-radio-name',
        count: collisions.radioNames.length,
        values: collisions.radioNames.map(({ value }) => value),
        blockKeys: Array.from(
          collisionBlockKeys({ ids: [], radioNames: collisions.radioNames }),
        ).sort(),
      })
    }
  }

  if (
    policy.identifierCollisions === 'namespace' &&
    (collisions.ids.length > 0 || collisions.radioNames.length > 0)
  ) {
    const affectedBlockKeys = collisionBlockKeys(collisions)
    pageBlocks.forEach(({ blockKey, content }) => {
      if (!affectedBlockKeys.has(blockKey)) {
        return
      }
      const result = namespaceContentIdentifiers(content, `block-${blockKey}`)
      if (!result.transformed) {
        namespaceFailures.push({ blockKey, failures: result.failures })
      }
    })

    if (namespaceFailures.length) {
      violations.push({
        code: 'identifier-namespace-failed',
        count: namespaceFailures.length,
        blockKeys: namespaceFailures.map(({ blockKey }) => blockKey).sort(),
      })
    }
  }

  const blockCanPublish = blocks.every(({ evaluation }) => evaluation.canPublish)
  const requiresSandboxedJavaScript = blocks.some(
    ({ evaluation }) => evaluation.requiresSandboxedJavaScript,
  )
  return {
    canPublish: blockCanPublish && violations.length === 0,
    requiresSandboxedJavaScript,
    requiresIsolatedDocuments:
      policy.identifierCollisions === 'isolated-document' && pageBlocks.length > 0,
    blocks,
    collisions,
    namespaceFailures,
    violations,
  }
}

const emptyCollisionReport = (): ContentIdentifierCollisionReport => ({
  ids: [],
  radioNames: [],
})

const cloneBlocks = (pageBlocks: readonly PageContentBlock[]): PageContentBlock[] =>
  pageBlocks.map(({ blockKey, content }) => ({
    blockKey,
    content: { ...content },
  }))

export const preparePageContentForPublication = (
  pageBlocks: readonly PageContentBlock[],
  policy: PagePublicationPolicy,
): PagePublicationPreparation => {
  const evaluation = evaluatePageContentForPublication(pageBlocks, policy)
  const renderMode: PagePublicationRenderMode =
    policy.identifierCollisions === 'isolated-document' ? 'isolated-document' : 'same-document'
  const originalCopies = cloneBlocks(pageBlocks)

  if (!evaluation.canPublish) {
    return {
      ready: false,
      renderMode,
      blocks: originalCopies,
      transformedBlockKeys: [],
      evaluation,
      residualCollisions: emptyCollisionReport(),
      failures: [
        {
          code: evaluation.namespaceFailures.length
            ? 'identifier-namespace-failed'
            : 'publication-policy-failed',
          ...(evaluation.namespaceFailures.length
            ? { blockKeys: evaluation.namespaceFailures.map(({ blockKey }) => blockKey).sort() }
            : {}),
        },
      ],
    }
  }

  if (policy.identifierCollisions !== 'namespace') {
    return {
      ready: true,
      renderMode,
      blocks: originalCopies,
      transformedBlockKeys: [],
      evaluation,
      residualCollisions: emptyCollisionReport(),
      failures: [],
    }
  }

  const affectedBlockKeys = collisionBlockKeys(evaluation.collisions)
  const transformedBlockKeys: string[] = []
  const blocks = originalCopies.map(({ blockKey, content }) => {
    if (!affectedBlockKeys.has(blockKey)) {
      return { blockKey, content }
    }

    const result = namespaceContentIdentifiers(content, `block-${blockKey}`)
    if (!result.transformed) {
      return { blockKey, content }
    }
    transformedBlockKeys.push(blockKey)
    return { blockKey, content: result.content }
  })
  const residualCollisions = findContentIdentifierCollisions(blocks)
  const residualValues = [
    ...residualCollisions.ids.map(({ value }) => value),
    ...residualCollisions.radioNames.map(({ value }) => value),
  ].sort()

  if (residualValues.length) {
    return {
      ready: false,
      renderMode,
      blocks: originalCopies,
      transformedBlockKeys: [],
      evaluation,
      residualCollisions,
      failures: [
        {
          code: 'residual-identifier-collision',
          values: residualValues,
          blockKeys: Array.from(collisionBlockKeys(residualCollisions)).sort(),
        },
      ],
    }
  }

  return {
    ready: true,
    renderMode,
    blocks,
    transformedBlockKeys: transformedBlockKeys.sort(),
    evaluation,
    residualCollisions,
    failures: [],
  }
}
