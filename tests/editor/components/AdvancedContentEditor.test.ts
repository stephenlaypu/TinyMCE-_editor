/* eslint-disable vue/one-component-per-file */
import { createApp, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdvancedContentEditor, {
  type AdvancedEditorLabels,
} from '../../../src/editor/components/AdvancedContentEditor.vue'

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
  absoluteFontSizeUnit: (value) => `Fixed font-size unit: ${value}`,
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
      expect(
        root.querySelector(`#${CSS.escape(tab.getAttribute('aria-controls') ?? '')}`),
      ).not.toBeNull()
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

  it('reports absolute font-size units in CSS for the Taiwan AA profile', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const app = createApp(AdvancedContentEditor, {
      modelValue: { html: '<p>Content</p>', css: '.content { font-size: 18px; }', js: '' },
      locale: 'en-US',
      labels,
      accessibilityProfile: 'tw-aa-110',
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    const cssTab = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === 'CSS',
    )
    cssTab?.click()
    await new Promise((resolve) => setTimeout(resolve, 650))

    expect(cssTab?.getAttribute('aria-label')).toBe('CSS: 1')
    expect(root.querySelector('.cm-lintRange-error')).not.toBeNull()
  })

  it('uses nonce-based CSP for the isolated preview', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const app = createApp(AdvancedContentEditor, {
      modelValue: {
        html: '<p style="color: red" onclick="alert(1)">Preview</p><iframe srcdoc="<script>alert(1)</script>"></iframe>',
        css: '.preview { font-size: 1rem; }',
        js: 'document.body.dataset.ready = "true"',
      },
      locale: 'en-US',
      labels,
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    const previewDocument =
      root.querySelector<HTMLIFrameElement>('.live-preview-frame')?.srcdoc ?? ''
    const nonce = /style-src 'nonce-([a-f0-9]+)'/.exec(previewDocument)?.[1]

    expect(nonce).toMatch(/^[a-f0-9]{36}$/)
    expect(previewDocument).not.toContain("'unsafe-inline'")
    expect(previewDocument).toContain(`script-src 'nonce-${nonce}'`)
    expect(previewDocument).toContain(`<style nonce="${nonce}">`)
    expect(previewDocument).toContain(`<script nonce="${nonce}">`)
    expect(previewDocument).toContain('cms-preview-inline-style-1')
    expect(previewDocument).not.toContain('style="color: red"')
    expect(previewDocument).not.toContain('onclick=')
    expect(previewDocument).not.toContain('srcdoc=')
  })

  it('can expose HTML without granting CSS or JavaScript editing and execution', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const onUpdate = vi.fn()
    const app = createApp(AdvancedContentEditor, {
      modelValue: {
        html: '<p>Restricted source editing</p>',
        css: '.preserved { color: red; }',
        js: 'window.shouldNotRun = true',
      },
      locale: 'en-US',
      labels,
      enabledTabs: ['html'],
      javascriptEnabled: false,
      'onUpdate:modelValue': onUpdate,
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'))
    const previewDocument =
      root.querySelector<HTMLIFrameElement>('.live-preview-frame')?.srcdoc ?? ''

    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['HTML'])
    expect(previewDocument).toContain('.preserved { color: red; }')
    expect(previewDocument).not.toContain('window.shouldNotRun')

    const formatButton = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.advanced-tool-button'),
    ).find((button) => button.textContent?.trim() === 'Format')
    formatButton?.click()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(onUpdate).toHaveBeenCalled()
    expect(onUpdate.mock.lastCall?.[0]).toMatchObject({
      css: '.preserved { color: red; }',
      js: 'window.shouldNotRun = true',
    })
  })

  it('syncs JavaScript by field name when the CSS tab is absent', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const modelValue = ref({
      html: '<p>Initial</p>',
      css: '.must-not-enter-js { color: red; }',
      js: 'window.version = 1',
    })
    const app = createApp({
      render: () =>
        h(AdvancedContentEditor, {
          modelValue: modelValue.value,
          locale: 'en-US',
          labels,
          enabledTabs: ['html', 'js'],
          javascriptEnabled: true,
        }),
    })
    mountedApps.push(app)
    app.mount(root)
    await nextTick()

    modelValue.value = {
      ...modelValue.value,
      js: 'window.version = 2',
    }
    await nextTick()

    const jsTab = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === 'JavaScript',
    )
    jsTab?.click()
    await nextTick()

    expect(root.querySelector('.cm-content')?.textContent).toContain('window.version = 2')
    expect(root.querySelector('.cm-content')?.textContent).not.toContain('must-not-enter-js')
  })
})
