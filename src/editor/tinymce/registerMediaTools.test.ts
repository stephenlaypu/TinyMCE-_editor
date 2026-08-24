import { describe, expect, it } from 'vitest'
import {
  isAllowedIframeUrl,
  normalizeIframeAllowAttribute,
  normalizeIframeSandboxAttribute,
  normalizeTrustedIframeElement,
} from './registerMediaTools'

describe('iframe hardening', () => {
  it('matches iframe hosts exactly instead of accepting lookalike domains', () => {
    expect(isAllowedIframeUrl('https://www.youtube.com/embed/video')).toBe(true)
    expect(isAllowedIframeUrl('https://www.youtube.com.evil.example/embed/video')).toBe(false)
    expect(isAllowedIframeUrl('javascript:alert(1)')).toBe(false)
  })

  it('removes unsafe sandbox and allow tokens from trusted embeds', () => {
    const iframe = document.createElement('iframe')
    iframe.src = 'https://www.youtube.com/embed/video'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    iframe.setAttribute('allow', 'autoplay; web-share; fullscreen')

    normalizeTrustedIframeElement(iframe)

    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe.getAttribute('allow')).toBe('autoplay; fullscreen')
    expect(iframe.title).toBe('YouTube embedded video')
  })

  it('supplies a restricted sandbox when the source has none', () => {
    expect(normalizeIframeSandboxAttribute(null)).not.toContain('allow-same-origin')
    expect(normalizeIframeAllowAttribute('web-share')).toBe('')
  })
})
