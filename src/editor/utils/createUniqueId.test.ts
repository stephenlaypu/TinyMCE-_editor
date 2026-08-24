import { describe, expect, it } from 'vitest'
import { createUniqueId } from './createUniqueId'

describe('createUniqueId', () => {
  it('creates stable prefixes and unique values without secure-context APIs', () => {
    const first = createUniqueId('cms-editor')
    const second = createUniqueId('cms-editor')

    expect(first).toMatch(/^cms-editor-/)
    expect(second).toMatch(/^cms-editor-/)
    expect(first).not.toBe(second)
  })
})
