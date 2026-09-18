import { beforeEach, describe, expect, it } from 'vitest'
import { checkAccessibility } from '../../../src/editor/accessibility/checker'

const getRules = (profile: 'content-quality' | 'tw-aa-110' = 'tw-aa-110') =>
  checkAccessibility(document.body, { profile }).map((issue) => issue.rule)

describe('accessibility checker font-size units', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it.each(['18px', '12pt', '1pc', '1in', '1cm', '1mm', '1q'])(
    'flags the absolute font-size unit %s for the Taiwan AA profile',
    (fontSize) => {
      document.body.innerHTML = `<p style="font-size: ${fontSize}">測試文字</p>`

      const issue = checkAccessibility(document.body, { profile: 'tw-aa-110' }).find(
        (candidate) => candidate.rule === 'font-size-absolute-unit',
      )

      expect(issue).toMatchObject({
        kind: 'required',
        standard: {
          successCriteria: ['1.4.4'],
          detectionCodes: ['CS2140401C'],
        },
      })
      expect(issue?.message).toContain(fontSize)
    },
  )

  it.each(['1rem', '1.125em', '112.5%', 'larger', 'calc(1rem + 2%)'])(
    'allows the relative or named font-size value %s',
    (fontSize) => {
      document.body.innerHTML = `<p style="font-size: ${fontSize}">測試文字</p>`

      expect(getRules()).not.toContain('font-size-absolute-unit')
    },
  )

  it('flags an absolute unit nested in a calc expression', () => {
    document.body.innerHTML = '<p style="font-size: calc(1rem + 1px)">測試文字</p>'

    expect(getRules()).toContain('font-size-absolute-unit')
  })

  it('keeps the general content-quality profile independent from the Taiwan unit rule', () => {
    document.body.innerHTML = '<p style="font-size: 18px">測試文字</p>'

    expect(getRules('content-quality')).not.toContain('font-size-absolute-unit')
  })
})

describe('accessibility checker editor content rules', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('reports broken ARIA id references', () => {
    document.body.innerHTML = '<button aria-describedby="missing-help">送出</button>'

    const issue = checkAccessibility(document.body, { profile: 'tw-aa-110' }).find(
      (candidate) => candidate.rule === 'aria-reference',
    )

    expect(issue).toMatchObject({ kind: 'required' })
    expect(issue?.message).toContain('missing-help')
  })

  it('accepts ARIA id references that exist in the editor content', () => {
    document.body.innerHTML =
      '<p id="help">欄位說明</p><button aria-describedby="help">送出</button>'

    expect(getRules()).not.toContain('aria-reference')
  })

  it('asks for review when positive tabindex changes focus order', () => {
    document.body.innerHTML = '<a href="/one" tabindex="2">第一個連結</a>'

    const issue = checkAccessibility(document.body, { profile: 'tw-aa-110' }).find(
      (candidate) => candidate.rule === 'positive-tabindex',
    )

    expect(issue).toMatchObject({ kind: 'review' })
  })

  it('reports autoplaying audible media without controls', () => {
    document.body.innerHTML = '<audio autoplay src="notice.mp3"></audio>'

    expect(getRules()).toContain('media-autoplay')
  })

  it('allows muted autoplay media', () => {
    document.body.innerHTML = '<video autoplay muted src="decorative.mp4"></video>'

    expect(getRules()).not.toContain('media-autoplay')
  })

  it('reports deprecated moving content', () => {
    document.body.innerHTML = '<marquee>重要消息</marquee>'

    expect(getRules()).toContain('moving-content')
  })

  it('reports invalid local language tags', () => {
    document.body.innerHTML = '<span lang="zh_TW">中文</span>'

    expect(getRules()).toContain('language-tag')
  })

  it('accepts valid BCP 47 local language tags', () => {
    document.body.innerHTML = '<span lang="zh-TW">中文</span>'

    expect(getRules()).not.toContain('language-tag')
  })

  it('reports list items outside a semantic list', () => {
    document.body.innerHTML = '<div><li>錯誤項目</li></div>'

    expect(getRules()).toContain('list-structure')
  })

  it('reports generic or filename-like image alt text for review', () => {
    document.body.innerHTML = '<img src="hero.jpg" alt="圖片"><img src="chart.png" alt="chart.png">'

    const issues = checkAccessibility(document.body, { profile: 'tw-aa-110' }).filter(
      (candidate) => candidate.rule === 'image-alt-quality',
    )

    expect(issues).toHaveLength(2)
    expect(issues.every((issue) => issue.kind === 'review')).toBe(true)
  })

  it('does not enable Taiwan-specific review rules in the general profile', () => {
    document.body.innerHTML = '<img src="hero.jpg" alt="圖片"><a href="/one" tabindex="2">連結</a>'

    const rules = getRules('content-quality')
    expect(rules).not.toContain('image-alt-quality')
    expect(rules).not.toContain('positive-tabindex')
  })
})
