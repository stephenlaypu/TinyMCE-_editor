import { getElementTextContrastRatio } from './contrast'
import { findAbsoluteFontSizeUnit } from './fontSizeUnits'
import {
  getAccessibilityRuleDefinition,
  type AccessibilityRuleId,
  type AccessibilityStandardReference,
} from './twAa110Catalog'

export type AccessibilityProfile = 'content-quality' | 'tw-aa-110'
export type AccessibilityIssueKind = 'required' | 'review' | 'suggestion'

export interface AccessibilityTarget {
  selector: string
  index: number
}

export interface AccessibilityIssue {
  id: string
  rule: AccessibilityRuleId
  kind: AccessibilityIssueKind
  message: string
  target: AccessibilityTarget
  snippet: string
  standard?: AccessibilityStandardReference
}

export interface AccessibilityCheckOptions {
  profile?: AccessibilityProfile
}

type VideoAccessibilityMode = 'audio' | 'visual' | 'decorative'

const genericLinkTexts = new Set([
  'click here',
  'here',
  'more',
  'read more',
  'learn more',
  'details',
  'more details',
  '詳細',
  '更多',
  '點此',
  '點這裡',
  '閱讀更多',
])

const getText = (element: Element): string => element.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const getAccessibleName = (element: Element): string => {
  const labelledBy = element.getAttribute('aria-labelledby')?.trim()

  if (labelledBy) {
    const root = element.getRootNode()
    const labelText = labelledBy
      .split(/\s+/)
      .map((id) => {
        if (root instanceof Document || root instanceof ShadowRoot) {
          return root.getElementById(id)?.textContent ?? ''
        }

        return ''
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (labelText) {
      return labelText
    }
  }

  const ariaLabel = element.getAttribute('aria-label')?.trim()

  if (ariaLabel) {
    return ariaLabel
  }

  const title = element.getAttribute('title')?.trim()

  if (title) {
    return title
  }

  const text = getText(element)

  if (text) {
    return text
  }

  return Array.from(element.querySelectorAll('img[alt]'))
    .map((image) => image.getAttribute('alt')?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

const getSnippet = (element: Element): string => {
  const text = getText(element)

  if (text) {
    return text.length > 80 ? `${text.slice(0, 80)}...` : text
  }

  const src =
    element.getAttribute('src') ?? element.getAttribute('href') ?? element.tagName.toLowerCase()
  return src.length > 80 ? `${src.slice(0, 80)}...` : src
}

const createIssue = (
  issues: AccessibilityIssue[],
  rule: AccessibilityRuleId,
  kind: AccessibilityIssueKind,
  message: string,
  target: AccessibilityTarget,
  element: Element,
) => {
  issues.push({
    id: `${rule}-${target.selector}-${target.index}`,
    rule,
    kind,
    message,
    target,
    snippet: getSnippet(element),
    standard: getAccessibilityRuleDefinition(rule).standard,
  })
}

const forEachTarget = (
  root: ParentNode,
  selector: string,
  callback: (element: Element, target: AccessibilityTarget) => void,
) => {
  Array.from(root.querySelectorAll(selector)).forEach((element, index) => {
    callback(element, { selector, index })
  })
}

const getTarget = (root: ParentNode, selector: string, element: Element): AccessibilityTarget => ({
  selector,
  index: Array.from(root.querySelectorAll(selector)).indexOf(element),
})

const hasDirectText = (element: Element): boolean =>
  Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  )

const checkFontSizeUnits = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(root, '[style]', (element, target) => {
    const declarations = element.getAttribute('style') ?? ''
    const fontSize = Array.from(
      declarations.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;]+)/gi),
      (match) => match[1]?.trim() ?? '',
    ).find((value) => findAbsoluteFontSizeUnit(value))

    if (!fontSize) {
      return
    }

    createIssue(
      issues,
      'font-size-absolute-unit',
      'required',
      `字級使用固定單位「${fontSize}」，請改用 rem、em、百分比、具名字級或受管理的 CMS 字級 class。`,
      target,
      element,
    )
  })
}

const checkTextContrast = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(root, '*', (element, target) => {
    if (!hasDirectText(element) || element.closest('[aria-hidden="true"]')) {
      return
    }

    const view = element.ownerDocument.defaultView
    const style = view?.getComputedStyle(element)

    if (
      !style ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      return
    }

    const ratio = getElementTextContrastRatio(element)
    const fontSize = Number.parseFloat(style.fontSize)
    const fontWeight = Number.parseInt(style.fontWeight, 10)
    const isBold = Number.isFinite(fontWeight) ? fontWeight >= 700 : style.fontWeight === 'bold'
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold)
    const minimumRatio = isLargeText ? 3 : 4.5

    if (ratio !== null && ratio < minimumRatio) {
      createIssue(
        issues,
        'text-contrast',
        'required',
        `文字與背景對比為 ${ratio.toFixed(2)}:1，需至少達到 ${minimumRatio}:1。`,
        target,
        element,
      )
    }
  })
}

const isUrlLikeText = (value: string): boolean => {
  return /^(https?:\/\/|www\.)/i.test(value)
}

const getIframeTitleFromPreview = (previewObject: Element): string => {
  const storedTitle = previewObject.getAttribute('data-mce-p-title')?.trim()

  if (storedTitle) {
    return storedTitle
  }

  const previewTitle = previewObject.querySelector('iframe')?.getAttribute('title')?.trim()

  if (previewTitle) {
    return previewTitle
  }

  const html = previewObject.getAttribute('data-mce-html')

  if (!html) {
    return ''
  }

  const container = document.createElement('div')
  container.innerHTML = unescape(html)
  return container.querySelector('iframe')?.getAttribute('title')?.trim() ?? ''
}

const getVideoAccessibilityMode = (video: Element): VideoAccessibilityMode => {
  const mode = video.getAttribute('data-cms-video-a11y-mode')

  if (mode === 'visual' || mode === 'decorative') {
    return mode
  }

  return 'audio'
}

const hasVideoCaptions = (video: Element): boolean => {
  return Boolean(video.querySelector('track[kind="captions"], track[kind="subtitles"]'))
}

const hasVideoTextAlternative = (video: Element): boolean => {
  const figure = video.closest('figure.cms-video')

  if (!figure) {
    return false
  }

  return Boolean(figure.querySelector('figcaption [data-cms-video-text-alternative]'))
}

const hasAssociatedLabel = (root: ParentNode, control: Element): boolean => {
  if (getAccessibleName(control)) {
    return true
  }

  const id = control.getAttribute('id')

  if (id && root.querySelector(`label[for="${CSS.escape(id)}"]`)) {
    return true
  }

  return Boolean(control.closest('label'))
}

const checkHeadingStructure = (root: ParentNode, issues: AccessibilityIssue[]) => {
  const selector = 'h1,h2,h3,h4,h5,h6'
  const headings = Array.from(root.querySelectorAll(selector))
  let previousLevel = 0

  headings.forEach((heading) => {
    const target = getTarget(root, selector, heading)
    const level = Number(heading.tagName.slice(1))

    if (!getText(heading)) {
      createIssue(issues, 'heading-empty', 'required', '標題不可為空白。', target, heading)
      return
    }

    if (previousLevel > 0 && level > previousLevel + 1) {
      createIssue(
        issues,
        'heading-order',
        'required',
        `標題階層不可從 h${previousLevel} 直接跳到 h${level}。`,
        target,
        heading,
      )
    }

    previousLevel = level
  })
}

const checkDuplicateIds = (root: ParentNode, issues: AccessibilityIssue[]) => {
  const selector = '[id]'
  const seenIds = new Set<string>()

  forEachTarget(root, selector, (element, target) => {
    const id = element.getAttribute('id')?.trim()

    if (!id) {
      return
    }

    if (seenIds.has(id)) {
      createIssue(
        issues,
        'duplicate-id',
        'required',
        `id "${id}" 重複，頁面中 id 必須唯一。`,
        target,
        element,
      )
      return
    }

    seenIds.add(id)
  })
}

const checkFormControlNames = (root: ParentNode, issues: AccessibilityIssue[]) => {
  const selector =
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]),select,textarea'

  forEachTarget(root, selector, (control, target) => {
    if (!hasAssociatedLabel(root, control)) {
      createIssue(
        issues,
        'form-label',
        'required',
        '表單欄位缺少可辨識的 label 或 ARIA 名稱。',
        target,
        control,
      )
    }
  })
}

const checkButtonNames = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(root, 'button,[role="button"]', (button, target) => {
    if (!getAccessibleName(button)) {
      createIssue(issues, 'button-name', 'required', '按鈕缺少可辨識名稱。', target, button)
    }
  })
}

const checkAriaReferences = (root: ParentNode, issues: AccessibilityIssue[]) => {
  const attributes = [
    'aria-activedescendant',
    'aria-controls',
    'aria-describedby',
    'aria-details',
    'aria-errormessage',
    'aria-flowto',
    'aria-labelledby',
    'aria-owns',
  ]
  const selector = attributes.map((attribute) => `[${attribute}]`).join(',')
  const existingIds = new Set(
    Array.from(root.querySelectorAll('[id]'))
      .map((element) => element.getAttribute('id')?.trim() ?? '')
      .filter(Boolean),
  )

  forEachTarget(root, selector, (element, target) => {
    attributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) {
        return
      }

      const references = (element.getAttribute(attribute) ?? '').trim().split(/\s+/).filter(Boolean)
      const missing = references.filter((id) => !existingIds.has(id))

      if (references.length === 0 || missing.length > 0) {
        createIssue(
          issues,
          'aria-reference',
          'required',
          references.length === 0
            ? `${attribute} 不可為空白。`
            : `${attribute} 參照了不存在的 id：${missing.join('、')}。`,
          target,
          element,
        )
      }
    })
  })
}

const checkFocusOrderHints = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(root, '[tabindex]', (element, target) => {
    const tabindex = Number(element.getAttribute('tabindex'))

    if (Number.isInteger(tabindex) && tabindex > 0) {
      createIssue(
        issues,
        'positive-tabindex',
        'review',
        `tabindex="${tabindex}" 會改變自然焦點順序，請確認鍵盤操作順序。`,
        target,
        element,
      )
    }
  })
}

const checkMediaPlayback = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(root, 'audio[autoplay],video[autoplay]', (media, target) => {
    if (!media.hasAttribute('muted') && !media.hasAttribute('controls')) {
      createIssue(
        issues,
        'media-autoplay',
        'review',
        '媒體會自動播放聲音且沒有 controls，請提供暫停、停止或音量控制。',
        target,
        media,
      )
    }
  })

  forEachTarget(root, 'blink,marquee', (element, target) => {
    createIssue(
      issues,
      'moving-content',
      'review',
      '移動或閃爍內容可能無法暫停，也可能造成閃爍風險，請改用可控制的呈現方式。',
      target,
      element,
    )
  })
}

const checkLanguageTags = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(root, '[lang]', (element, target) => {
    const language = element.getAttribute('lang')?.trim() ?? ''
    let valid = Boolean(language)

    if (valid) {
      try {
        Intl.getCanonicalLocales(language)
      } catch {
        valid = false
      }
    }

    if (!valid) {
      createIssue(
        issues,
        'language-tag',
        'required',
        `lang="${language}" 不是有效的語言標籤。`,
        target,
        element,
      )
    }
  })
}

const checkListStructure = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(root, 'li', (item, target) => {
    if (!item.parentElement?.matches('ul,ol,menu')) {
      createIssue(
        issues,
        'list-structure',
        'required',
        '清單項目 li 必須直接放在 ul、ol 或 menu 內。',
        target,
        item,
      )
    }
  })

  forEachTarget(root, 'ul,ol,menu', (list, target) => {
    const invalidChild = Array.from(list.children).find(
      (child) => !child.matches('li,script,template'),
    )

    if (invalidChild) {
      createIssue(
        issues,
        'list-structure',
        'required',
        '清單容器只能直接包含 li 清單項目。',
        target,
        list,
      )
    }
  })
}

const suspiciousAltPattern = /^(image|img|photo|picture|圖片|影像|照片|圖示|icon|spacer)$/i
const filenameAltPattern = /(?:^|[/\\])[^/\\]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i

const checkImageAltQuality = (root: ParentNode, issues: AccessibilityIssue[]) => {
  forEachTarget(
    root,
    'img[alt]:not([alt=""]):not([data-mce-object]):not([data-mce-placeholder])',
    (image, target) => {
      const alt = image.getAttribute('alt')?.trim() ?? ''

      if (suspiciousAltPattern.test(alt) || filenameAltPattern.test(alt)) {
        createIssue(
          issues,
          'image-alt-quality',
          'review',
          '替代文字看起來是通用詞或檔名，請確認它有描述圖片傳達的資訊或功能。',
          target,
          image,
        )
      }
    },
  )
}

export const findAccessibilityTarget = (
  root: ParentNode,
  target: AccessibilityTarget,
): Element | null => {
  return Array.from(root.querySelectorAll(target.selector))[target.index] ?? null
}

export const checkAccessibility = (
  root: ParentNode,
  options: AccessibilityCheckOptions = {},
): AccessibilityIssue[] => {
  const issues: AccessibilityIssue[] = []
  const profile = options.profile ?? 'content-quality'

  checkDuplicateIds(root, issues)
  checkHeadingStructure(root, issues)
  checkFormControlNames(root, issues)
  checkButtonNames(root, issues)
  checkListStructure(root, issues)
  checkAriaReferences(root, issues)
  checkTextContrast(root, issues)

  if (profile === 'tw-aa-110') {
    checkFontSizeUnits(root, issues)
    checkFocusOrderHints(root, issues)
    checkMediaPlayback(root, issues)
    checkLanguageTags(root, issues)
    checkImageAltQuality(root, issues)
  }

  forEachTarget(root, 'img:not([data-mce-object]):not([data-mce-placeholder])', (image, target) => {
    if (!image.hasAttribute('alt')) {
      createIssue(issues, 'image-alt', 'required', '圖片缺少替代文字 alt。', target, image)
      return
    }

    if (profile === 'tw-aa-110' && image.getAttribute('alt') === '') {
      createIssue(
        issues,
        'image-decorative-review',
        'review',
        '此圖片使用空白 alt，請確認它確實不傳達資訊或功能。',
        target,
        image,
      )
    }
  })

  forEachTarget(root, 'a[href]', (link, target) => {
    const text = getAccessibleName(link).toLowerCase()

    if (!text) {
      createIssue(issues, 'link-text', 'required', '連結缺少可辨識文字。', target, link)
      return
    }

    if (genericLinkTexts.has(text) || isUrlLikeText(text)) {
      createIssue(
        issues,
        'link-text',
        'suggestion',
        '連結文字不夠明確，建議描述目的地。',
        target,
        link,
      )
    }
  })

  forEachTarget(
    root,
    'span.mce-preview-object[data-mce-object="iframe"]',
    (previewObject, target) => {
      if (!getIframeTitleFromPreview(previewObject)) {
        createIssue(
          issues,
          'iframe-title',
          'required',
          'iframe 缺少 title，螢幕閱讀器無法辨識內容。',
          target,
          previewObject,
        )
      }
    },
  )

  forEachTarget(root, 'iframe', (iframe, target) => {
    if (iframe.closest('span.mce-preview-object[data-mce-object="iframe"]')) {
      return
    }

    if (!iframe.getAttribute('title')?.trim()) {
      createIssue(
        issues,
        'iframe-title',
        'required',
        'iframe 缺少 title，螢幕閱讀器無法辨識內容。',
        target,
        iframe,
      )
    }
  })

  forEachTarget(root, 'table', (table, target) => {
    if (!table.querySelector('caption')) {
      createIssue(
        issues,
        'table-caption',
        'review',
        '表格缺少 caption，請確認是否需要表格標題或目的說明。',
        target,
        table,
      )
    }

    if (!table.querySelector('th')) {
      createIssue(issues, 'table-header', 'required', '資料表格缺少 th 表頭。', target, table)
    }

    table.querySelectorAll('th').forEach((header) => {
      if (!getText(header)) {
        createIssue(
          issues,
          'table-header-empty',
          'required',
          '表格 th 表頭不可為空白。',
          getTarget(root, 'th', header),
          header,
        )
      }
    })

    if (
      profile === 'tw-aa-110' &&
      table.querySelector('th') &&
      table.querySelector('[rowspan]:not([rowspan="1"]),[colspan]:not([colspan="1"])') &&
      table.querySelector('th:not([scope]):not([headers])')
    ) {
      createIssue(
        issues,
        'table-header-association',
        'review',
        '此表格含合併儲存格，請人工確認每個資料格與多層表頭的關聯。',
        target,
        table,
      )
    }
  })

  forEachTarget(root, 'video', (video, target) => {
    const mode = getVideoAccessibilityMode(video)

    if (mode === 'decorative') {
      return
    }

    if (mode === 'audio' && !hasVideoCaptions(video)) {
      createIssue(
        issues,
        'video-captions',
        'required',
        '含音訊內容的影片缺少字幕檔，請提供 WebVTT captions。',
        target,
        video,
      )
      return
    }

    if (mode === 'visual' && !hasVideoTextAlternative(video)) {
      createIssue(
        issues,
        'video-text-alternative',
        'required',
        '無音訊但有重要畫面內容的影片需要文字替代說明。',
        target,
        video,
      )
    }
  })

  return issues
}
