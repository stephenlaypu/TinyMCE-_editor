let uniqueIdSequence = 0

export const createUniqueId = (prefix: string): string => {
  uniqueIdSequence += 1

  const timestamp = Date.now().toString(36)
  const sequence = uniqueIdSequence.toString(36)
  const random = Math.random().toString(36).slice(2, 10)

  return `${prefix}-${timestamp}-${sequence}-${random}`
}
