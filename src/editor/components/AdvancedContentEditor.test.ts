import { createApp, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdvancedContentEditor, { type AdvancedEditorLabels } from './AdvancedContentEditor.vue'

const mountedApps: ReturnType<typeof createApp>[] = []

const labels: AdvancedEditorLabels = {
  html: 'HTML',
  css: 'CSS',
  javascript: 'JavaScript',
  codeEditor: 'Advanced editor',
  codeToolbar: 'Code toolbar',
  undo: 'Undo',
  redo: 'Redo',
  search: 'Search',
  syntaxError: 'Syntax error',
  tabErrorLabel: (tab, count) => `${tab}: ${count}`,
  preview: 'Preview',
  refreshPreview: 'Refresh',
  previewError: 'Preview error',
  runtimeErrorLine: (line) => `Line ${line}`,
  runtimeErrorLineColumn: (line, column) => `Line ${line}, column ${column}`,
  locateError: 'Locate error',
  format: 'Format',
  formatting: 'Formatting',
  formatError: 'Format error',
  collapseCode: 'Collapse',
  expandCode: 'Expand',
  resizePanels: 'Resize panels',
  resizeValue: (code, preview) => `${code}/${preview}`,
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
}

afterEach(() => {
  mountedApps.splice(0).forEach((app) => app.unmount())
  document.body.replaceChildren()
})

describe('AdvancedContentEditor', () => {
  it('creates unique and valid tab relationships for multiple instances', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const props = {
      modelValue: { html: '<p>Content</p>', css: '', js: '' },
      locale: 'en-US' as const,
      labels,
    }
    const app = createApp({
      render: () => h('div', [h(AdvancedContentEditor, props), h(AdvancedContentEditor, props)]),
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'))
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'))
    const ids = [...tabs, ...panels].map((element) => element.id)

    expect(tabs).toHaveLength(6)
    expect(panels).toHaveLength(2)
    expect(new Set(ids).size).toBe(ids.length)
    tabs.forEach((tab) => {
      expect(root.querySelector(`#${CSS.escape(tab.getAttribute('aria-controls') ?? '')}`)).not.toBeNull()
    })
  })

  it('keeps readonly content searchable but prevents editing actions', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const app = createApp(AdvancedContentEditor, {
      modelValue: { html: '<p>Readonly</p>', css: '', js: '' },
      locale: 'en-US',
      labels,
      readonly: true,
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    expect(root.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false')
    expect(root.querySelector<HTMLButtonElement>('[aria-label="Search"]')?.disabled).toBe(false)
    expect(
      Array.from(root.querySelectorAll<HTMLButtonElement>('.advanced-tool-button')).find(
        (button) => button.textContent?.trim() === 'Format',
      )?.disabled,
    ).toBe(true)
  })

  it('disables navigation and tools when the whole editor is disabled', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const app = createApp(AdvancedContentEditor, {
      modelValue: { html: '<p>Disabled</p>', css: '', js: '' },
      locale: 'en-US',
      labels,
      disabled: true,
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    expect(root.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false')
    expect(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).toHaveLength(0)
    expect(root.querySelector('[role="separator"]')?.getAttribute('tabindex')).toBe('-1')
  })

  it('emits focus, blur, content updates, and dirty state from advanced editing', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    const onDirty = vi.fn()
    const onUpdate = vi.fn()
    const app = createApp(AdvancedContentEditor, {
      modelValue: { html: '<div><span>Content</span></div>', css: '', js: '' },
      locale: 'en-US',
      labels,
      onFocus,
      onBlur,
      onDirty,
      'onUpdate:modelValue': onUpdate,
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    const content = root.querySelector<HTMLElement>('.cm-content')
    content?.focus()
    content?.blur()

    const formatButton = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.advanced-tool-button'),
    ).find((button) => button.textContent?.trim() === 'Format')
    formatButton?.click()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(onFocus).toHaveBeenCalledOnce()
    expect(onBlur).toHaveBeenCalledOnce()
    expect(onUpdate).toHaveBeenCalled()
    expect(onDirty).toHaveBeenCalled()
  })
})
