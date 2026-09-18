<script setup lang="ts">
import { basicSetup } from 'codemirror'
import { redo, redoDepth, undo, undoDepth } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { ensureSyntaxTree } from '@codemirror/language'
import { diagnosticCount, linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { openSearchPanel } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { AppLocale } from '../i18n'
import type { AccessibilityProfile } from '../accessibility/checker'
import { findAbsoluteFontSizeUnit } from '../accessibility/fontSizeUnits'
import type { EditorContent } from '../types/editorContent'
import { createUniqueId } from '../utils/createUniqueId'

export type CodeTab = keyof EditorContent

export interface AdvancedEditorLabels {
  html: string
  css: string
  javascript: string
  codeEditor: string
  codeToolbar: string
  undo: string
  redo: string
  search: string
  syntaxError: string
  absoluteFontSizeUnit: (value: string) => string
  tabErrorLabel: (tab: string, count: number) => string
  preview: string
  refreshPreview: string
  previewError: string
  runtimeErrorLine: (line: number) => string
  runtimeErrorLineColumn: (line: number, column: number) => string
  locateError: string
  format: string
  formatting: string
  formatError: string
  collapseCode: string
  expandCode: string
  resizePanels: string
  resizeValue: (code: number, preview: number) => string
  fullscreen: string
  exitFullscreen: string
}

interface PreviewRuntimeError {
  message: string
  line: number | null
  column: number | null
}

const props = defineProps<{
  modelValue: EditorContent
  initialTab?: CodeTab
  locale: AppLocale
  labels: AdvancedEditorLabels
  accessibilityProfile?: AccessibilityProfile
  enabledTabs?: readonly CodeTab[]
  javascriptEnabled?: boolean
  disabled?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EditorContent]
  dirty: []
  focus: []
  blur: []
}>()

const tabs: CodeTab[] = Array.from(
  new Set<CodeTab>([
    'html',
    ...(props.enabledTabs ?? ['css', 'js']).filter((tab) => tab !== 'html'),
  ]),
)
const canExecuteJavaScript = props.javascriptEnabled !== false && tabs.includes('js')
const activeTab = ref<CodeTab>(
  props.initialTab && tabs.includes(props.initialTab) ? props.initialTab : 'html',
)
const editorHost = ref<HTMLDivElement | null>(null)
const editorGrid = ref<HTMLDivElement | null>(null)
const previewFrame = ref<HTMLIFrameElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)
const editorStates = new Map<CodeTab, EditorState>()
const previewDocument = ref('')
const previewError = ref<PreviewRuntimeError | null>(null)
const formatError = ref('')
const isFormatting = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const isCodeCollapsed = ref(false)
const isResizing = ref(false)
const isFullscreen = ref(false)
const codePanePercent = ref(45)
const codePaneMinPercent = ref(0)
const codePaneMaxPercent = ref(100)
const tabDiagnosticCounts = ref<Record<CodeTab, number>>({ html: 0, css: 0, js: 0 })
const previewRevision = ref(0)
const instanceId = createUniqueId('cms-advanced-editor')
const panelId = `${instanceId}-panel`
const previewMessageId = createUniqueId('cms-advanced-preview')
const splitterWidth = 12
const localeCompartment = new Compartment()
const editabilityCompartment = new Compartment()
let previewTimer: ReturnType<typeof setTimeout> | null = null
let isSyncingFromProps = false
let resizePointerId: number | null = null
let resizeHandle: HTMLElement | null = null
let pendingResizeClientX: number | null = null
let resizeAnimationFrame: number | null = null
let editorInteractionRevision = 0

const editorGridStyle = computed(() =>
  isCodeCollapsed.value
    ? undefined
    : {
        gridTemplateColumns: `${codePanePercent.value}fr ${splitterWidth}px ${100 - codePanePercent.value}fr`,
      },
)

const tabLabels = computed<Record<CodeTab, string>>(() => ({
  html: props.labels.html,
  css: props.labels.css,
  js: props.labels.javascript,
}))

const isEditingDisabled = computed(() => Boolean(props.disabled || props.readonly))

const getTabId = (tab: CodeTab) => `${instanceId}-tab-${tab}`

const splitterValueText = computed(() =>
  props.labels.resizeValue(
    Math.round(codePanePercent.value),
    Math.round(100 - codePanePercent.value),
  ),
)

const previewErrorLocation = computed(() => {
  const error = previewError.value
  if (!error?.line) {
    return tabLabels.value.js
  }

  const location = error.column
    ? props.labels.runtimeErrorLineColumn(error.line, error.column)
    : props.labels.runtimeErrorLine(error.line)
  return `${tabLabels.value.js} · ${location}`
})

const languageExtension: Record<CodeTab, Extension> = {
  html: html(),
  css: css(),
  js: javascript(),
}

const zhTwCodeMirrorPhrases: Record<string, string> = {
  'Selection deleted': '選取內容已刪除',
  Diagnostics: '診斷',
  'No diagnostics': '沒有診斷訊息',
  'Folded lines': '已摺疊行',
  'Unfolded lines': '已展開行',
  to: '至',
  'folded code': '已摺疊的程式碼',
  unfold: '展開',
  'Fold line': '摺疊此行',
  'Unfold line': '展開此行',
  Completions: '自動完成建議',
  'Control character': '控制字元',
  'Go to line': '前往指定行',
  go: '前往',
  Find: '尋找',
  Replace: '取代',
  next: '下一個',
  previous: '上一個',
  all: '全部',
  'match case': '區分大小寫',
  regexp: '正規表示式',
  'by word': '全字匹配',
  replace: '取代',
  'replace all': '全部取代',
  close: '關閉',
  'replaced match on line $': '已取代第 $ 行的符合項目',
  'replaced $ matches': '已取代 $ 個符合項目',
  'current match': '目前符合項目',
  'on line': '位於第',
}

const codeMirrorPhrases = () =>
  EditorState.phrases.of(props.locale === 'zh-TW' ? zhTwCodeMirrorPhrases : {})

const codeMirrorEditability = (): Extension => [
  EditorState.readOnly.of(isEditingDisabled.value),
  EditorView.editable.of(!isEditingDisabled.value),
  EditorView.contentAttributes.of({
    'aria-disabled': props.disabled ? 'true' : 'false',
    'aria-readonly': isEditingDisabled.value ? 'true' : 'false',
    tabindex: props.disabled ? '-1' : '0',
  }),
]

const getTabAriaLabel = (tab: CodeTab) => {
  const count = tabDiagnosticCounts.value[tab]
  if (count === 0) {
    return tabLabels.value[tab]
  }

  return props.labels.tabErrorLabel(tabLabels.value[tab], count)
}

const createSyntaxDiagnostics = (tab: CodeTab, state: EditorState): Diagnostic[] => {
  const tree = ensureSyntaxTree(state, state.doc.length, 100)
  if (!tree) {
    return []
  }

  const diagnostics: Diagnostic[] = []
  const ranges = new Set<string>()
  tree.iterate({
    enter(node) {
      if (!node.type.isError) {
        return
      }

      let from = Math.min(node.from, state.doc.length)
      let to = Math.min(node.to, state.doc.length)
      if (from === to) {
        if (to < state.doc.length) {
          to += 1
        } else if (from > 0) {
          from -= 1
        }
      }

      const rangeKey = `${from}:${to}`
      if (!ranges.has(rangeKey)) {
        ranges.add(rangeKey)
        diagnostics.push({
          from,
          to,
          severity: 'error',
          source: tabLabels.value[tab],
          message: props.labels.syntaxError,
        })
      }

      return false
    },
  })

  if (tab === 'css' && props.accessibilityProfile === 'tw-aa-110') {
    tree.iterate({
      enter(node) {
        if (node.name !== 'Declaration') {
          return
        }

        const declaration = state.doc.sliceString(node.from, node.to)
        const propertyMatch = /^\s*font-size\s*:\s*/i.exec(declaration)

        if (!propertyMatch) {
          return
        }

        const value = declaration.slice(propertyMatch[0].length)
        const match = findAbsoluteFontSizeUnit(value)

        if (!match) {
          return
        }

        const from = node.from + propertyMatch[0].length + match.index
        diagnostics.push({
          from,
          to: from + match.value.length,
          severity: 'error',
          source: 'Taiwan AA 1.4.4',
          message: props.labels.absoluteFontSizeUnit(match.value),
        })
      },
    })
  }

  return diagnostics
}

const syntaxDiagnosticsExtension = (tab: CodeTab) =>
  linter((view) => createSyntaxDiagnostics(tab, view.state), {
    delay: 500,
    needsRefresh: (update) => update.transactions.some((transaction) => transaction.reconfigured),
  })

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '1rem 0',
  },
})

const emitDocumentUpdate = (tab: CodeTab, value: string) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [tab]: value,
  })
  emit('dirty')
}

const syncHistoryControls = (state?: EditorState) => {
  canUndo.value = Boolean(!isEditingDisabled.value && state && undoDepth(state) > 0)
  canRedo.value = Boolean(!isEditingDisabled.value && state && redoDepth(state) > 0)
}

const syncDiagnosticCount = (tab: CodeTab, state: EditorState) => {
  const count = diagnosticCount(state)
  if (tabDiagnosticCounts.value[tab] !== count) {
    tabDiagnosticCounts.value = {
      ...tabDiagnosticCounts.value,
      [tab]: count,
    }
  }
}

const createEditorState = (tab: CodeTab, doc: string) =>
  EditorState.create({
    doc,
    extensions: [
      basicSetup,
      localeCompartment.of(codeMirrorPhrases()),
      editabilityCompartment.of(codeMirrorEditability()),
      languageExtension[tab],
      syntaxDiagnosticsExtension(tab),
      lintGutter(),
      editorTheme,
      keymap.of([
        {
          key: 'Shift-Alt-f',
          run: () => {
            if (isEditingDisabled.value) {
              return false
            }
            void formatActiveDocument()
            return true
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        editorStates.set(tab, update.state)
        syncDiagnosticCount(tab, update.state)
        if (activeTab.value === tab) {
          syncHistoryControls(update.state)
        }
        if (!update.docChanged) {
          return
        }

        formatError.value = ''
        editorInteractionRevision += 1
        if (!isSyncingFromProps) {
          emitDocumentUpdate(tab, update.state.doc.toString())
        }
      }),
      EditorView.domEventHandlers({
        focus: () => {
          emit('focus')
          return false
        },
        blur: () => {
          emit('blur')
          return false
        },
      }),
    ],
  })

const selectTab = (tab: CodeTab, focusEditor = true) => {
  if (tab === activeTab.value || !editorView.value) {
    return
  }

  formatError.value = ''
  editorInteractionRevision += 1
  activeTab.value = tab
  const state = editorStates.get(tab)
  if (state) {
    editorView.value.setState(state)
    syncHistoryControls(state)
    if (focusEditor) {
      nextTick(() => editorView.value?.focus())
    }
  }
}

const handleTabKeydown = (event: KeyboardEvent, tab: CodeTab) => {
  const currentIndex = tabs.indexOf(tab)
  let nextIndex: number | null = null

  if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
  } else if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % tabs.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = tabs.length - 1
  }

  if (nextIndex === null) {
    return
  }

  event.preventDefault()
  const nextTab = tabs[nextIndex]
  selectTab(nextTab, false)
  nextTick(() => document.getElementById(getTabId(nextTab))?.focus())
}

const handleToolbarKeydown = (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return
  }

  const toolbar = event.currentTarget as HTMLElement
  const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
  if (buttons.length === 0) {
    return
  }

  const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (currentIndex === -1) {
    return
  }

  event.preventDefault()
  let nextIndex = currentIndex
  if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
  } else if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % buttons.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = buttons.length - 1
  }
  buttons[nextIndex]?.focus()
}

const undoActiveDocument = () => {
  const view = editorView.value
  if (!isEditingDisabled.value && view && !isCodeCollapsed.value && undo(view)) {
    view.focus()
  }
}

const redoActiveDocument = () => {
  const view = editorView.value
  if (!isEditingDisabled.value && view && !isCodeCollapsed.value && redo(view)) {
    view.focus()
  }
}

const openCodeSearch = () => {
  const view = editorView.value
  if (!props.disabled && view && !isCodeCollapsed.value) {
    openSearchPanel(view)
  }
}

const formatActiveDocument = async () => {
  const view = editorView.value
  if (!view || isEditingDisabled.value || isFormatting.value || isCodeCollapsed.value) {
    return
  }

  const tab = activeTab.value
  const source = view.state.doc.toString()
  const interactionRevision = editorInteractionRevision
  isFormatting.value = true
  formatError.value = ''

  try {
    const { format } = await import('prettier/standalone')
    let parser: 'html' | 'css' | 'babel'
    let plugins: object[]

    if (tab === 'html') {
      parser = 'html'
      plugins = [await import('prettier/plugins/html')]
    } else if (tab === 'css') {
      parser = 'css'
      plugins = [await import('prettier/plugins/postcss')]
    } else {
      parser = 'babel'
      plugins = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ])
    }

    const formatted = await format(source, {
      parser,
      plugins,
      printWidth: 100,
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      useTabs: false,
    })

    if (
      activeTab.value !== tab ||
      editorView.value !== view ||
      editorInteractionRevision !== interactionRevision ||
      view.state.doc.toString() !== source
    ) {
      return
    }

    if (formatted !== source) {
      const cursor = Math.min(view.state.selection.main.head, formatted.length)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: formatted },
        selection: { anchor: cursor },
      })
    }
  } catch (error) {
    formatError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isFormatting.value = false
  }
}

const getPaneBounds = () => {
  const availableWidth = Math.max((editorGrid.value?.clientWidth ?? 0) - splitterWidth, 1)
  return {
    min: Math.min(45, (320 / availableWidth) * 100),
    max: Math.max(45, ((availableWidth - 400) / availableWidth) * 100),
  }
}

const setCodePanePercent = (value: number) => {
  const { min, max } = getPaneBounds()
  codePaneMinPercent.value = min
  codePaneMaxPercent.value = max
  codePanePercent.value = Math.min(max, Math.max(min, value))
}

const applyResizeClientX = (clientX: number) => {
  const grid = editorGrid.value
  if (!grid) {
    return
  }

  const rect = grid.getBoundingClientRect()
  const availableWidth = Math.max(rect.width - splitterWidth, 1)
  setCodePanePercent(((clientX - rect.left) / availableWidth) * 100)
}

const handleResizeMove = (event: PointerEvent) => {
  if (!isResizing.value || resizePointerId === null || event.pointerId !== resizePointerId) {
    return
  }

  event.preventDefault()
  pendingResizeClientX = event.clientX

  if (resizeAnimationFrame !== null) {
    return
  }

  resizeAnimationFrame = requestAnimationFrame(() => {
    resizeAnimationFrame = null
    if (pendingResizeClientX === null) {
      return
    }

    applyResizeClientX(pendingResizeClientX)
  })
}

const stopResize = (event?: PointerEvent) => {
  if (event && resizePointerId !== null && event.pointerId !== resizePointerId) {
    return
  }

  if (resizeAnimationFrame !== null) {
    cancelAnimationFrame(resizeAnimationFrame)
    resizeAnimationFrame = null
  }

  if (pendingResizeClientX !== null) {
    applyResizeClientX(pendingResizeClientX)
  }

  const pointerId = resizePointerId
  const handle = resizeHandle
  resizePointerId = null
  resizeHandle = null
  pendingResizeClientX = null
  isResizing.value = false

  if (pointerId !== null && handle?.hasPointerCapture(pointerId)) {
    handle.releasePointerCapture(pointerId)
  }

  window.removeEventListener('pointermove', handleResizeMove)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
}

const startResize = (event: PointerEvent) => {
  if (
    props.disabled ||
    event.button !== 0 ||
    !event.isPrimary ||
    isCodeCollapsed.value ||
    window.matchMedia('(max-width: 760px)').matches
  ) {
    return
  }

  event.preventDefault()
  const handle = event.currentTarget as HTMLElement
  resizePointerId = event.pointerId
  resizeHandle = handle
  pendingResizeClientX = event.clientX
  handle.setPointerCapture(event.pointerId)
  isResizing.value = true
  window.addEventListener('pointermove', handleResizeMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}

const handleResizeKeydown = (event: KeyboardEvent) => {
  if (props.disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return
  }

  event.preventDefault()
  if (event.key === 'Home') {
    setCodePanePercent(codePaneMinPercent.value)
  } else if (event.key === 'End') {
    setCodePanePercent(codePaneMaxPercent.value)
  } else {
    setCodePanePercent(codePanePercent.value + (event.key === 'ArrowLeft' ? -2 : 2))
  }
}

const toggleCodePane = () => {
  if (props.disabled) {
    return
  }

  isCodeCollapsed.value = !isCodeCollapsed.value
  if (!isCodeCollapsed.value) {
    nextTick(() => {
      setCodePanePercent(codePanePercent.value)
      editorView.value?.requestMeasure()
    })
  }
}

const setFullscreen = (value: boolean) => {
  isFullscreen.value = value
  document.documentElement.classList.toggle('cms-advanced-fullscreen-open', value)
  nextTick(() => {
    setCodePanePercent(codePanePercent.value)
    editorView.value?.requestMeasure()
  })
}

const toggleFullscreen = () => {
  if (props.disabled) {
    return
  }

  setFullscreen(!isFullscreen.value)
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isFullscreen.value) {
    event.preventDefault()
    setFullscreen(false)
  }
}

const handleViewportResize = () => {
  if (!isCodeCollapsed.value && !window.matchMedia('(max-width: 760px)').matches) {
    setCodePanePercent(codePanePercent.value)
  }
}

const preparePreviewHtml = (source: string) => {
  const template = document.createElement('template')
  template.innerHTML = source

  const embeddedCss = Array.from(template.content.querySelectorAll('style'))
    .map((style) => style.textContent?.trim() || '')
    .filter(Boolean)
    .join('\n\n')
  const inlineCss: string[] = []

  template.content
    .querySelectorAll('script,style,object,embed,applet,base,meta,link')
    .forEach((element) => element.remove())

  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        name === 'nonce' ||
        /^(?:javascript|data|vbscript):/i.test(value)
      ) {
        element.removeAttribute(attribute.name)
      }
    })

    const style = element.getAttribute('style')?.trim()
    if (style) {
      const className = `cms-preview-inline-style-${inlineCss.length + 1}`
      element.classList.add(className)
      element.removeAttribute('style')
      inlineCss.push(`.${className} { ${style} }`)
    }
  })

  return {
    html: template.innerHTML,
    css: [embeddedCss, inlineCss.join('\n')].filter(Boolean).join('\n\n'),
  }
}

const escapeRawTextEndTag = (source: string, tagName: 'style' | 'script') =>
  source.replace(new RegExp(`</${tagName}`, 'gi'), `<\\/${tagName}`)

const createPreviewNonce = () => {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

const buildPreviewDocument = () => {
  const previewContent = preparePreviewHtml(props.modelValue.html)
  const safeHtml = previewContent.html
  const safeCss = escapeRawTextEndTag(
    [previewContent.css, props.modelValue.css].filter(Boolean).join('\n\n'),
    'style',
  )
  const safeJavaScript = escapeRawTextEndTag(
    canExecuteJavaScript ? props.modelValue.js : '',
    'script',
  )
  const messageId = JSON.stringify(previewMessageId)
  const userJavaScript = JSON.stringify(safeJavaScript)
  const language = props.locale === 'zh-TW' ? 'zh-TW' : 'en-US'
  const nonce = createPreviewNonce()
  const serializedNonce = JSON.stringify(nonce)

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; media-src https: data: blob:; frame-src https:; style-src 'nonce-${nonce}'; style-src-attr 'none'; script-src 'nonce-${nonce}'; connect-src 'none'; font-src data:; object-src 'none'; base-uri 'none'; form-action 'none'">
  <style nonce="${nonce}">
    :root { color: #17231d; background: #fff; font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; line-height: 1.7; overflow-wrap: anywhere; }
    img, video, iframe { max-width: 100%; }
    ${safeCss}
  </style>
</head>
<body>
  ${safeHtml}
  <script nonce="${nonce}">
    const previewMessageId = ${messageId};
    const previewSource = 'cms-advanced-preview.js';
    const previewNonce = ${serializedNonce};
    const userJavaScript = ${userJavaScript};
    const readStackLocation = (value) => {
      const stack = value && typeof value === 'object' && 'stack' in value ? String(value.stack || '') : '';
      const match = /cms-advanced-preview\\.js:(\\d+):(\\d+)/.exec(stack);
      return match ? { line: Number(match[1]), column: Number(match[2]) } : { line: null, column: null };
    };
    const reportPreviewError = (message, line, column) => parent.postMessage({
      previewMessageId,
      error: { message, line, column },
    }, '*');
    window.addEventListener('error', (event) => {
      const stackLocation = readStackLocation(event.error);
      const isUserScript = String(event.filename || '').includes(previewSource);
      reportPreviewError(
        event.message || 'JavaScript error',
        isUserScript ? event.lineno || null : stackLocation.line,
        isUserScript ? event.colno || null : stackLocation.column,
      );
    });
    window.addEventListener('unhandledrejection', (event) => {
      const location = readStackLocation(event.reason);
      const message = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason || 'Unhandled promise rejection');
      reportPreviewError(message, location.line, location.column);
    });
    const userScript = document.createElement('script');
    userScript.nonce = previewNonce;
    userScript.textContent = userJavaScript + '\\n//# sourceURL=' + previewSource;
    document.body.append(userScript);
  ${'</scr' + 'ipt>'}
</body>
</html>`
}

const refreshPreview = () => {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  previewError.value = null
  previewRevision.value += 1
  previewDocument.value = buildPreviewDocument()
}

const schedulePreview = () => {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }
  previewError.value = null
  previewTimer = setTimeout(refreshPreview, 400)
}

const reconfigureCodeMirrorLocale = () => {
  tabs.forEach((tab) => {
    const state = editorStates.get(tab)
    if (!state) {
      return
    }

    const transaction = state.update({
      effects: localeCompartment.reconfigure(codeMirrorPhrases()),
    })
    editorStates.set(tab, transaction.state)
    if (activeTab.value === tab && editorView.value) {
      editorView.value.setState(transaction.state)
      syncHistoryControls(transaction.state)
    }
  })
}

const reconfigureCodeMirrorEditability = () => {
  tabs.forEach((tab) => {
    const state = editorStates.get(tab)
    if (!state) {
      return
    }

    const transaction = state.update({
      effects: editabilityCompartment.reconfigure(codeMirrorEditability()),
    })
    editorStates.set(tab, transaction.state)
    if (activeTab.value === tab && editorView.value) {
      editorView.value.setState(transaction.state)
      syncHistoryControls(transaction.state)
    }
  })
}

const handlePreviewMessage = (event: MessageEvent) => {
  if (
    event.source !== previewFrame.value?.contentWindow ||
    !event.data ||
    event.data.previewMessageId !== previewMessageId
  ) {
    return
  }

  const error = event.data.error
  if (!error || typeof error !== 'object') {
    return
  }

  const line = Number(error.line)
  const column = Number(error.column)
  previewError.value = {
    message: String(error.message || ''),
    line: Number.isInteger(line) && line > 0 ? line : null,
    column: Number.isInteger(column) && column > 0 ? column : null,
  }
}

const locatePreviewError = () => {
  const error = previewError.value
  if (!error?.line) {
    return
  }

  isCodeCollapsed.value = false
  if (activeTab.value !== 'js') {
    selectTab('js', false)
  }

  const view = editorView.value
  if (!view) {
    return
  }

  const line = view.state.doc.line(Math.min(error.line, view.state.doc.lines))
  const columnOffset = Math.min(Math.max((error.column ?? 1) - 1, 0), line.length)
  const position = line.from + columnOffset
  view.dispatch({
    selection: { anchor: position },
    effects: EditorView.scrollIntoView(position, { y: 'center' }),
  })
  nextTick(() => {
    setCodePanePercent(codePanePercent.value)
    view.requestMeasure()
    view.focus()
  })
}

watch(
  () => [props.modelValue.html, props.modelValue.css, props.modelValue.js] as const,
  () => {
    formatError.value = ''
    tabs.forEach((tab) => {
      const state = editorStates.get(tab)
      const nextValue = props.modelValue[tab]
      if (!state || state.doc.toString() === nextValue) {
        return
      }

      isSyncingFromProps = true
      const transaction = state.update({
        changes: { from: 0, to: state.doc.length, insert: nextValue },
      })
      editorStates.set(tab, transaction.state)
      if (activeTab.value === tab && editorView.value) {
        editorView.value.setState(transaction.state)
        syncHistoryControls(transaction.state)
      }
      isSyncingFromProps = false
    })
    schedulePreview()
  },
)

watch(
  () => props.locale,
  () => {
    reconfigureCodeMirrorLocale()
    schedulePreview()
  },
)

watch(
  () => [props.disabled, props.readonly] as const,
  () => reconfigureCodeMirrorEditability(),
)

onMounted(() => {
  tabs.forEach((tab) => editorStates.set(tab, createEditorState(tab, props.modelValue[tab])))
  const initialState = editorStates.get(activeTab.value)
  if (editorHost.value && initialState) {
    editorView.value = new EditorView({ state: initialState, parent: editorHost.value })
    syncHistoryControls(initialState)
  }
  nextTick(() => setCodePanePercent(codePanePercent.value))
  window.addEventListener('message', handlePreviewMessage)
  window.addEventListener('resize', handleViewportResize)
  document.addEventListener('keydown', handleDocumentKeydown)
  refreshPreview()
})

onBeforeUnmount(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }
  window.removeEventListener('message', handlePreviewMessage)
  window.removeEventListener('resize', handleViewportResize)
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.documentElement.classList.remove('cms-advanced-fullscreen-open')
  stopResize()
  editorView.value?.destroy()
  editorView.value = null
})

defineExpose({
  focus: () => editorView.value?.focus(),
})
</script>

<template>
  <section
    class="advanced-editor"
    :class="{ 'is-fullscreen': isFullscreen }"
    :aria-label="labels.codeEditor"
    :aria-disabled="disabled || undefined"
    :aria-readonly="readonly || undefined"
  >
    <div class="advanced-toolbar">
      <div class="code-tabs" role="tablist" :aria-label="labels.codeEditor">
        <button
          v-for="tab in tabs"
          :id="getTabId(tab)"
          :key="tab"
          type="button"
          role="tab"
          class="code-tab"
          :class="{ 'is-active': activeTab === tab }"
          :aria-label="getTabAriaLabel(tab)"
          :aria-controls="panelId"
          :aria-selected="activeTab === tab"
          :tabindex="activeTab === tab ? 0 : -1"
          :disabled="disabled"
          @click="selectTab(tab)"
          @keydown="handleTabKeydown($event, tab)"
        >
          <span>{{ tabLabels[tab] }}</span>
          <span v-if="tabDiagnosticCounts[tab] > 0" class="code-tab-error-count" aria-hidden="true">
            {{ tabDiagnosticCounts[tab] > 99 ? '99+' : tabDiagnosticCounts[tab] }}
          </span>
        </button>
      </div>

      <div
        class="code-actions"
        role="toolbar"
        :aria-label="labels.codeToolbar"
        @keydown="handleToolbarKeydown"
      >
        <button
          type="button"
          class="advanced-tool-button advanced-icon-button"
          :disabled="isEditingDisabled || isCodeCollapsed || !canUndo"
          :aria-label="labels.undo"
          :title="labels.undo"
          @click="undoActiveDocument"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M7.4 7.4V4L2 9.4l5.4 5.4v-3.5h5.1a5 5 0 0 1 4.8 6.4l2.8.9a8 8 0 0 0-7.6-10.3H7.4Z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="advanced-tool-button advanced-icon-button"
          :disabled="isEditingDisabled || isCodeCollapsed || !canRedo"
          :aria-label="labels.redo"
          :title="labels.redo"
          @click="redoActiveDocument"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M16.6 7.4V4L22 9.4l-5.4 5.4v-3.5h-5.1a5 5 0 0 0-4.8 6.4l-2.8.9a8 8 0 0 1 7.6-10.3h5.1Z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="advanced-tool-button advanced-icon-button"
          :disabled="disabled || isCodeCollapsed"
          :aria-label="labels.search"
          :title="labels.search"
          @click="openCodeSearch"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M10.5 4a6.5 6.5 0 1 0 3.98 11.64L19.84 21 22 18.84l-5.36-5.36A6.5 6.5 0 0 0 10.5 4Zm0 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
            />
          </svg>
        </button>
        <span class="advanced-toolbar-separator" aria-hidden="true"></span>
        <button
          type="button"
          class="advanced-tool-button"
          :disabled="isEditingDisabled || isFormatting || isCodeCollapsed"
          @click="formatActiveDocument"
        >
          {{ isFormatting ? labels.formatting : labels.format }}
        </button>
        <button
          type="button"
          class="advanced-tool-button"
          :disabled="disabled"
          :aria-expanded="!isCodeCollapsed"
          @click="toggleCodePane"
        >
          {{ isCodeCollapsed ? labels.expandCode : labels.collapseCode }}
        </button>
        <button
          type="button"
          class="advanced-tool-button advanced-icon-button"
          :class="{ 'is-active': isFullscreen }"
          :aria-label="isFullscreen ? labels.exitFullscreen : labels.fullscreen"
          :title="isFullscreen ? labels.exitFullscreen : labels.fullscreen"
          :aria-pressed="isFullscreen"
          :disabled="disabled"
          @click="toggleFullscreen"
        >
          <svg v-if="!isFullscreen" aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M7 3H3v4h2V5h2V3Zm14 4V3h-4v2h2v2h2ZM5 17H3v4h4v-2H5v-2Zm16 0h-2v2h-2v2h4v-4Z"
            />
          </svg>
          <svg v-else aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M3 8h5V3H6v3H3v2Zm13-5v5h5V6h-3V3h-2ZM8 21v-5H3v2h3v3h2Zm13-5h-5v5h2v-3h3v-2Z"
            />
          </svg>
        </button>
      </div>
    </div>

    <p v-if="formatError" class="code-format-error" role="alert">
      <strong>{{ labels.formatError }}</strong> {{ formatError }}
    </p>

    <div
      ref="editorGrid"
      class="advanced-editor-grid"
      :class="{ 'is-code-collapsed': isCodeCollapsed, 'is-resizing': isResizing }"
      :style="editorGridStyle"
    >
      <div
        v-show="!isCodeCollapsed"
        :id="panelId"
        class="code-editor-panel"
        role="tabpanel"
        :aria-labelledby="getTabId(activeTab)"
      >
        <div ref="editorHost" class="code-editor-host"></div>
      </div>

      <div
        v-show="!isCodeCollapsed"
        class="editor-splitter"
        role="separator"
        aria-orientation="vertical"
        :aria-label="labels.resizePanels"
        :aria-valuenow="Math.round(codePanePercent)"
        :aria-valuemin="Math.round(codePaneMinPercent)"
        :aria-valuemax="Math.round(codePaneMaxPercent)"
        :aria-valuetext="splitterValueText"
        :aria-disabled="disabled || undefined"
        :tabindex="disabled ? -1 : 0"
        @pointerdown="startResize"
        @keydown="handleResizeKeydown"
      >
        <span aria-hidden="true"></span>
      </div>

      <section class="live-preview-panel" :aria-label="labels.preview">
        <header class="live-preview-header">
          <h2>{{ labels.preview }}</h2>
          <button
            type="button"
            class="preview-refresh"
            :disabled="disabled"
            @click="refreshPreview"
          >
            {{ labels.refreshPreview }}
          </button>
        </header>
        <iframe
          :key="previewRevision"
          ref="previewFrame"
          class="live-preview-frame"
          sandbox="allow-scripts"
          :srcdoc="previewDocument"
          :title="labels.preview"
        ></iframe>
        <p v-if="previewError" class="preview-error" role="alert">
          <button
            v-if="previewError.line"
            type="button"
            class="preview-error-location"
            :title="labels.locateError"
            @click="locatePreviewError"
          >
            <strong>{{ labels.previewError }}</strong>
            {{ previewErrorLocation }}：{{ previewError.message }}
          </button>
          <template v-else>
            <strong>{{ labels.previewError }}</strong>
            {{ previewErrorLocation }}：{{ previewError.message }}
          </template>
        </p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.advanced-editor {
  --advanced-border: #c5c5c5;
  --advanced-surface: #fff;
  --advanced-toolbar: #f0f0f0;
  --advanced-hover: #e2e2e2;
  --advanced-selected: #cce2fa;
  --advanced-text: #222f3e;
  --advanced-muted-text: #5c6670;
  display: flex;
  flex-direction: column;
  height: var(--cms-editor-height, 620px);
  min-height: 0;
  overflow: hidden;
  border-radius: 0 0 9px 9px;
  color: var(--advanced-text);
  background: var(--advanced-surface);
}

.advanced-editor.is-fullscreen {
  position: fixed;
  z-index: 16000;
  inset: 0;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  background: var(--advanced-surface);
}

.advanced-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--advanced-border);
  background: var(--advanced-toolbar);
}

.code-tabs,
.code-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.code-actions {
  align-items: center;
  gap: 4px;
}

.code-tab,
.advanced-tool-button,
.preview-refresh {
  border: 1px solid transparent;
  color: var(--advanced-muted-text);
  background: transparent;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.code-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  border-radius: 4px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
}

.code-tab-error-count {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 999px;
  color: #fff;
  background: #b42318;
  font-size: 0.7rem;
  line-height: 1.4;
  text-align: center;
}

.code-tab:hover,
.advanced-tool-button:hover,
.preview-refresh:hover {
  background: var(--advanced-hover);
}

.code-tab:focus-visible,
.advanced-tool-button:focus-visible,
.preview-refresh:focus-visible {
  outline: 2px solid #2276d2;
  outline-offset: -2px;
}

.code-tab.is-active {
  border-color: transparent;
  color: var(--advanced-text);
  background: var(--advanced-selected);
}

.advanced-tool-button,
.preview-refresh {
  min-height: 34px;
  border-color: transparent;
  border-radius: 4px;
  padding: 0.4rem 0.65rem;
  color: var(--advanced-text);
  background: transparent;
  font-size: 0.8rem;
}

.advanced-tool-button.is-active {
  background: var(--advanced-selected);
}

.advanced-icon-button {
  display: inline-grid;
  width: 34px;
  min-width: 34px;
  padding: 0;
  place-items: center;
}

.advanced-icon-button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.code-tab:disabled,
.advanced-tool-button:disabled,
.preview-refresh:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.editor-splitter[aria-disabled='true'] {
  cursor: not-allowed;
  opacity: 0.45;
}

.advanced-toolbar-separator {
  align-self: center;
  width: 1px;
  height: 24px;
  margin: 0 2px;
  background: var(--advanced-border);
}

.code-format-error,
.preview-error {
  flex: 0 0 auto;
  margin: 0;
  padding: 8px 12px;
  color: #842029;
  background: #f8d7da;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.preview-error-location {
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.preview-error-location:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.advanced-editor-grid {
  position: relative;
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.advanced-editor-grid.is-code-collapsed {
  grid-template-columns: minmax(0, 1fr) !important;
}

.code-editor-panel,
.code-editor-host,
.live-preview-panel {
  min-width: 0;
  min-height: 0;
}

.code-editor-panel,
.code-editor-host {
  height: 100%;
  overflow: hidden;
}

.editor-splitter {
  position: relative;
  z-index: 11;
  display: grid;
  width: 12px;
  min-width: 12px;
  cursor: col-resize;
  place-items: center;
  touch-action: none;
  background: var(--advanced-toolbar);
}

.editor-splitter::before {
  position: absolute;
  inset: 0 4px;
  content: '';
  background: var(--advanced-border);
}

.editor-splitter span {
  position: relative;
  width: 3px;
  height: 36px;
  border-right: 1px solid #777;
  border-left: 1px solid #777;
}

.editor-splitter:hover,
.editor-splitter:focus-visible,
.is-resizing .editor-splitter {
  outline: 2px solid #6b7280;
  outline-offset: -2px;
}

.is-resizing,
.is-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}

.advanced-editor-grid.is-resizing::after {
  position: absolute;
  z-index: 10;
  inset: 0;
  cursor: col-resize;
  content: '';
}

.is-resizing .live-preview-frame {
  pointer-events: none;
}

.live-preview-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: var(--advanced-surface);
}

.live-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--advanced-border);
  background: var(--advanced-toolbar);
}

.live-preview-header h2 {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.2;
}

.live-preview-frame {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: var(--advanced-surface);
}

@media (max-width: 760px) {
  .advanced-editor {
    height: 720px;
  }

  .advanced-editor.is-fullscreen {
    height: 100vh;
  }

  .advanced-toolbar {
    flex-wrap: wrap;
    padding-bottom: 6px;
  }

  .advanced-editor-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }

  .advanced-editor-grid.is-code-collapsed {
    grid-template-rows: minmax(0, 1fr);
  }

  .editor-splitter {
    display: none !important;
  }

  .live-preview-panel {
    border-top: 1px solid var(--advanced-border);
  }
}
</style>
