import { describe, expect, it } from 'vitest'
import { accessibilityRuleCatalog } from '../../../src/editor/accessibility/twAa110Catalog'

describe('Taiwan AA editor-content rule catalog', () => {
  it('keeps every rule mapped to at least one success criterion', () => {
    Object.values(accessibilityRuleCatalog).forEach((definition) => {
      expect(definition.standard.successCriteria.length).toBeGreaterThan(0)
    })
  })

  it('contains only automatic checks or explicit human review prompts', () => {
    Object.values(accessibilityRuleCatalog).forEach((definition) => {
      expect(['automatic', 'review']).toContain(definition.assessment)
    })
  })
})
