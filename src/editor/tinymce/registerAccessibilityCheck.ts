import type { Editor } from 'tinymce'
import {
  checkAccessibility,
  findAccessibilityTarget,
  type AccessibilityIssue,
  type AccessibilityIssueKind,
  type AccessibilityProfile,
} from '../accessibility/checker'
import type { MediaToolLabels } from './registerMediaTools'

type AccessibilityDialogData = Record<string, never>

export interface AccessibilityCheckOptions {
  profile?: AccessibilityProfile
}

const activeIssueClass = 'cms-a11y-active-issue'
const accessibilityDialogClass = 'cms-a11y-window'
const accessibilityDialogWrapClass = 'cms-a11y-dialog-wrap'
const accessibilityDialogViewportGap = 16
let activeSessionId = 0

const escapeHtml = (value: string): string => {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}

const isElementNode = (value: unknown): value is HTMLElement =>
  typeof value === 'object' &&
  value !== null &&
  'nodeType' in value &&
  (value as { nodeType: number }).nodeType === 1

const getIssueCounts = (issues: AccessibilityIssue[]) => ({
  required: issues.filter((issue) => issue.kind === 'required').length,
  review: issues.filter((issue) => issue.kind === 'review').length,
  suggestions: issues.filter((issue) => issue.kind === 'suggestion').length,
})

const issueKindOrder: Record<AccessibilityIssueKind, number> = {
  required: 0,
  review: 1,
  suggestion: 2,
}

const sortIssues = (issues: AccessibilityIssue[]): AccessibilityIssue[] =>
  [...issues].sort((left, right) => issueKindOrder[left.kind] - issueKindOrder[right.kind])

const getIssueLabel = (issue: AccessibilityIssue): string => {
  if (issue.kind === 'required') {
    return '必須修正'
  }

  return issue.kind === 'review' ? '需要確認' : '改善建議'
}

const getProfileLabel = (profile: AccessibilityProfile): string =>
  profile === 'tw-aa-110' ? '台灣 AA（110.07）內容預檢' : '內容品質基礎檢查'

const getToolbarStatusText = (issueCount: number): string => {
  if (issueCount === 0) {
    return '檢查 ✓'
  }

  return `檢查 ${issueCount > 99 ? '99+' : issueCount}`
}

const clearActiveIssue = (editor: Editor, endSession = false) => {
  if (endSession) {
    activeSessionId += 1
  }

  editor.dom.select<HTMLElement>(`.${activeIssueClass}`).forEach((element) => {
    editor.dom.removeClass(element, activeIssueClass)
    editor.dom.setAttrib(element, 'data-cms-a11y-active', null)
  })
}

const getIssueElement = (editor: Editor, issue: AccessibilityIssue): HTMLElement | null => {
  const target = findAccessibilityTarget(editor.getBody(), issue.target)
  return isElementNode(target) ? target : null
}

const getSelectionTarget = (editor: Editor, issue: AccessibilityIssue): HTMLElement | null => {
  const issueElement = getIssueElement(editor, issue)

  if (!issueElement) {
    return null
  }

  const previewObject = editor.dom.getParent<HTMLElement>(issueElement, 'span.mce-preview-object')
  const selectionTarget = previewObject ?? issueElement
  return isElementNode(selectionTarget) ? selectionTarget : null
}

const highlightIssueTarget = (
  editor: Editor,
  issue: AccessibilityIssue,
  sessionId = activeSessionId,
): boolean => {
  const selectionTarget = getSelectionTarget(editor, issue)

  clearActiveIssue(editor)

  if (!selectionTarget) {
    return false
  }

  editor.dom.addClass(selectionTarget, activeIssueClass)
  editor.dom.setAttrib(selectionTarget, 'data-cms-a11y-active', 'true')
  selectionTarget.scrollIntoView({ block: 'center', inline: 'nearest' })
  editor.selection.select(selectionTarget)
  window.requestAnimationFrame(() => {
    if (sessionId === activeSessionId) {
      editor.dom.addClass(selectionTarget, activeIssueClass)
    }
  })
  editor.nodeChanged()
  return true
}

const selectForRepair = (editor: Editor, issue: AccessibilityIssue): boolean => {
  const issueElement = getIssueElement(editor, issue)

  if (!issueElement) {
    return false
  }

  editor.focus()

  if (issue.rule === 'image-alt' && issueElement.tagName.toLowerCase() === 'img') {
    editor.selection.select(issueElement)
    editor.nodeChanged()
    return true
  }

  if (issue.rule === 'link-text') {
    const link = issueElement.closest('a[href]')
    if (link) {
      editor.selection.select(link, true)
      editor.nodeChanged()
      return true
    }
  }

  if (
    issue.rule === 'iframe-title' ||
    issue.rule === 'video-captions' ||
    issue.rule === 'video-text-alternative'
  ) {
    const previewObject = editor.dom.getParent<HTMLElement>(issueElement, 'span.mce-preview-object')
    editor.selection.select(previewObject ?? issueElement)
    editor.nodeChanged()
    return true
  }

  if (issue.rule === 'table-caption' || issue.rule === 'table-header') {
    const table = issueElement.closest('table')
    const firstCell = table?.querySelector<HTMLElement>('td,th')
    editor.selection.select(firstCell ?? issueElement)
    editor.nodeChanged()
    return true
  }

  editor.selection.select(issueElement)
  editor.nodeChanged()
  return true
}

const repairIssue = (editor: Editor, issue: AccessibilityIssue): boolean => {
  clearActiveIssue(editor, true)

  if (!selectForRepair(editor, issue)) {
    return false
  }

  if (issue.rule === 'iframe-title') {
    editor.execCommand('cmsEmbedIframe')
    return true
  }

  if (issue.rule === 'image-alt') {
    editor.execCommand('mceImage')
    return true
  }

  if (issue.rule === 'link-text') {
    editor.execCommand('mceLink', false, { dialog: true })
    return true
  }

  if (issue.rule === 'video-captions' || issue.rule === 'video-text-alternative') {
    editor.execCommand('cmsInsertVideo')
    return true
  }

  if (issue.rule === 'table-caption') {
    editor.execCommand('mceTableToggleCaption')
    return true
  }

  if (issue.rule === 'table-header') {
    editor.execCommand('mceTableRowType', false, { type: 'header' })
    return true
  }

  return true
}

const getFilteredIssues = (
  editor: Editor,
  ignoredIssueIds: Set<string>,
  profile: AccessibilityProfile,
): AccessibilityIssue[] =>
  sortIssues(
    checkAccessibility(editor.getBody(), { profile }).filter(
      (issue) => !ignoredIssueIds.has(issue.id),
    ),
  )

const renderStandardReference = (issue: AccessibilityIssue): string => {
  if (!issue.standard) {
    return ''
  }

  const rows = [
    `成功準則 ${issue.standard.successCriteria.join('、')}`,
    issue.standard.detectionCodes?.length
      ? `檢測碼 ${issue.standard.detectionCodes.join('、')}`
      : '',
    issue.standard.auditCodes?.length ? `稽核評量碼 ${issue.standard.auditCodes.join('、')}` : '',
  ].filter(Boolean)

  return `<p class="cms-a11y-standard">${escapeHtml(rows.join('｜'))}</p>`
}

const renderDialogHtml = (
  issues: AccessibilityIssue[],
  index: number,
  profile: AccessibilityProfile,
): string => {
  const counts = getIssueCounts(issues)

  if (issues.length === 0) {
    return `
      <div class="cms-a11y-dialog">
        <div class="cms-a11y-topline">
          <span class="cms-a11y-step">${getProfileLabel(profile)}</span>
        </div>
        <section class="cms-a11y-empty">
          <h2>目前沒有找到明顯的可及性問題</h2>
          <p>此結果只涵蓋編輯器內容片段，不代表完整網站已通過台灣 AA 標章檢測。</p>
        </section>
      </div>
    `
  }

  const issue = issues[index]
  const kindClass = `is-${issue.kind}`

  return `
    <div class="cms-a11y-dialog">
      <div class="cms-a11y-topline">
        <span class="cms-a11y-step">${getProfileLabel(profile)}｜${index + 1} / ${issues.length}</span>
        <span class="cms-a11y-pill is-required">${counts.required} 必須修正</span>
        <span class="cms-a11y-pill is-review">${counts.review} 需要確認</span>
        <span class="cms-a11y-pill is-suggestion">${counts.suggestions} 改善建議</span>
      </div>

      <section class="cms-a11y-issue ${kindClass}">
        <div class="cms-a11y-issue-head">
          <span class="cms-a11y-severity">${getIssueLabel(issue)}</span>
          <code>${escapeHtml(issue.rule)}</code>
        </div>
        <h2>${escapeHtml(issue.message)}</h2>
        <p class="cms-a11y-snippet">${escapeHtml(issue.snippet)}</p>
        ${renderStandardReference(issue)}
      </section>

    </div>
  `
}

const prepareAccessibilityDialog = (editor: Editor, closeDialog: () => void) => {
  window.requestAnimationFrame(() => {
    const dialog = Array.from(document.querySelectorAll<HTMLElement>('.tox-dialog')).find(
      (element) => element.querySelector('.cms-a11y-dialog'),
    )

    if (!dialog) {
      return
    }

    dialog.classList.add(accessibilityDialogClass)
    const dialogWrap = dialog.closest<HTMLElement>('.tox-dialog-wrap')
    dialogWrap?.classList.add(accessibilityDialogWrapClass)

    const backdrop = dialogWrap?.querySelector<HTMLElement>('.tox-dialog-wrap__backdrop')
    backdrop?.addEventListener(
      'click',
      (event) => {
        if (event.target === event.currentTarget) {
          closeDialog()
        }
      },
      { once: true },
    )

    const contentRect = editor.getContentAreaContainer().getBoundingClientRect()
    const dialogRect = dialog.getBoundingClientRect()
    const maximumLeft = Math.max(
      accessibilityDialogViewportGap,
      window.innerWidth - dialogRect.width - accessibilityDialogViewportGap,
    )
    const maximumTop = Math.max(
      accessibilityDialogViewportGap,
      window.innerHeight - dialogRect.height - accessibilityDialogViewportGap,
    )
    const left = Math.min(
      Math.max(
        accessibilityDialogViewportGap,
        contentRect.right - dialogRect.width - accessibilityDialogViewportGap,
      ),
      maximumLeft,
    )
    const top = Math.min(
      Math.max(accessibilityDialogViewportGap, contentRect.top + accessibilityDialogViewportGap),
      maximumTop,
    )

    Object.assign(dialog.style, {
      left: `${left}px`,
      margin: '0',
      position: 'fixed',
      top: `${top}px`,
    })
  })
}

export const registerAccessibilityCheck = (
  editor: Editor,
  _labels: MediaToolLabels,
  options: AccessibilityCheckOptions = {},
) => {
  const profile = options.profile ?? 'content-quality'

  const openDialog = () => {
    activeSessionId += 1
    const sessionId = activeSessionId
    const ignoredIssueIds = new Set<string>()
    let issues = getFilteredIssues(editor, ignoredIssueIds, profile)
    let currentIndex = 0

    const clampIndex = () => {
      currentIndex = Math.min(Math.max(currentIndex, 0), Math.max(issues.length - 1, 0))
    }

    const syncActiveIssue = () => {
      if (issues[currentIndex]) {
        highlightIssueTarget(editor, issues[currentIndex], sessionId)
      } else {
        clearActiveIssue(editor)
      }
    }

    const refreshIssues = () => {
      issues = getFilteredIssues(editor, ignoredIssueIds, profile)
      clampIndex()
      syncActiveIssue()
    }

    const buildDialog = (): Parameters<
      typeof editor.windowManager.open<AccessibilityDialogData>
    >[0] => ({
      title: 'Accessibility Checker',
      size: 'medium',
      body: {
        type: 'panel',
        items: [
          {
            type: 'htmlpanel',
            presets: 'document',
            html: renderDialogHtml(issues, currentIndex, profile),
          },
        ],
      },
      buttons: [
        { type: 'custom', name: 'previous', text: '上一個', enabled: issues.length > 1 },
        { type: 'custom', name: 'next', text: '下一個', enabled: issues.length > 1 },
        { type: 'custom', name: 'repair', text: '修復', primary: true, enabled: issues.length > 0 },
        { type: 'custom', name: 'ignore', text: '忽略', enabled: issues.length > 0 },
        { type: 'custom', name: 'recheck', text: '重新檢查' },
        { type: 'cancel', text: '關閉' },
      ],
      onAction: (api, details) => {
        if (details.name === 'previous' && issues.length > 0) {
          currentIndex = currentIndex === 0 ? issues.length - 1 : currentIndex - 1
          syncActiveIssue()
          api.redial(buildDialog())
          return
        }

        if (details.name === 'next' && issues.length > 0) {
          currentIndex = currentIndex === issues.length - 1 ? 0 : currentIndex + 1
          syncActiveIssue()
          api.redial(buildDialog())
          return
        }

        if (details.name === 'repair' && issues[currentIndex]) {
          const issue = issues[currentIndex]
          api.close()
          clearActiveIssue(editor, true)
          window.setTimeout(() => repairIssue(editor, issue), 120)
          return
        }

        if (details.name === 'ignore' && issues[currentIndex]) {
          ignoredIssueIds.add(issues[currentIndex].id)
          refreshIssues()
          api.redial(buildDialog())
          return
        }

        if (details.name === 'recheck') {
          refreshIssues()
          api.redial(buildDialog())
        }
      },
      onClose: () => clearActiveIssue(editor, true),
      onCancel: () => clearActiveIssue(editor, true),
    })

    syncActiveIssue()
    const dialogApi = editor.windowManager.open(buildDialog())
    prepareAccessibilityDialog(editor, dialogApi.close)
  }

  editor.ui.registry.addButton('a11ycheck', {
    text: '檢查 ✓',
    tooltip: '檢查可及性',
    onAction: openDialog,
    onSetup: (api) => {
      let updateTimer: number | undefined

      const updateStatus = () => {
        window.clearTimeout(updateTimer)
        updateTimer = window.setTimeout(() => {
          const issues = checkAccessibility(editor.getBody(), { profile })
          api.setText(getToolbarStatusText(issues.length))
        }, 250)
      }

      editor.on('init SetContent Change Undo Redo', updateStatus)
      updateStatus()

      return () => {
        window.clearTimeout(updateTimer)
        editor.off('init SetContent Change Undo Redo', updateStatus)
      }
    },
  })
  editor.ui.registry.addMenuItem('a11ycheck', {
    text: '檢查可及性',
    onAction: openDialog,
  })
}
