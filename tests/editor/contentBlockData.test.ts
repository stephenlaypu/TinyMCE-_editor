import { describe, expect, it } from 'vitest'

import {
  decodeLegacyEncodedHtmlDocument,
  normalizeContentBlockHtmlFieldKey,
  readEditorContentFromBlockData,
  writeEditorContentToBlockData,
} from '../../src/editor/contentBlockData'

describe('content block data adapter', () => {
  it('reads the admin richtext flat data contract', () => {
    expect(
      readEditorContentFromBlockData({
        html: '<p>內容</p>',
        css: '.content { font-size: 1rem; }',
        js: 'initialize()',
        extension: true,
      }),
    ).toEqual({
      html: '<p>內容</p>',
      css: '.content { font-size: 1rem; }',
      js: 'initialize()',
    })
  })

  it('supports a catalog-defined HTML field key', () => {
    expect(readEditorContentFromBlockData({ value: '<p>內容</p>' }, 'value').html).toBe(
      '<p>內容</p>',
    )
  })

  it('updates HTML while preserving protected CSS, JavaScript, and unknown fields by default', () => {
    const current = {
      html: '<p>舊內容</p>',
      css: '.legacy { color: red; }',
      js: 'legacy()',
      futureField: { enabled: true },
    }

    expect(
      writeEditorContentToBlockData(current, {
        html: '<p>新內容</p>',
        css: '.changed { color: blue; }',
        js: 'changed()',
      }),
    ).toEqual({
      html: '<p>新內容</p>',
      css: '.legacy { color: red; }',
      js: 'legacy()',
      futureField: { enabled: true },
    })
  })

  it('updates CSS and JavaScript only when the host explicitly allows them', () => {
    expect(
      writeEditorContentToBlockData(
        { html: '', css: 'old-css', js: 'old-js' },
        { html: '<p>內容</p>', css: 'new-css', js: 'new-js' },
        { allowCss: true, allowJavaScript: true },
      ),
    ).toEqual({ html: '<p>內容</p>', css: 'new-css', js: 'new-js' })
  })

  it('does not allow the HTML field key to collide with protected advanced fields', () => {
    expect(normalizeContentBlockHtmlFieldKey('css')).toBe('html')
    expect(normalizeContentBlockHtmlFieldKey('js')).toBe('html')
  })

  it('decodes one layer of a legacy entity-encoded HTML document', () => {
    expect(
      decodeLegacyEncodedHtmlDocument(
        '&lt;p style=&quot;font-size: 12pt&quot;&gt;舊內容 &amp;amp; 說明&lt;/p&gt;',
      ),
    ).toBe('<p style="font-size: 12pt">舊內容 &amp; 說明</p>')
  })

  it.each([
    '<p>已是 HTML</p>',
    '說明文字含有 &lt;strong&gt; 標記',
    '&amp;lt;p&amp;gt;不得重複解碼&amp;lt;/p&amp;gt;',
    '',
  ])('does not rewrite non-legacy input: %s', (value) => {
    expect(decodeLegacyEncodedHtmlDocument(value)).toBe(value)
  })

  it('supports a complete encoded void element', () => {
    expect(
      decodeLegacyEncodedHtmlDocument(
        '&lt;img src=&quot;/image.jpg&quot; alt=&quot;說明&quot;&gt;',
      ),
    ).toBe('<img src="/image.jpg" alt="說明">')
  })

  it('keeps legacy storage untouched until the host explicitly writes edited HTML', () => {
    const current = {
      html: '&lt;p&gt;舊內容&lt;/p&gt;',
      futureField: { enabled: true },
    }
    const editorHtml = decodeLegacyEncodedHtmlDocument(current.html)

    expect(editorHtml).toBe('<p>舊內容</p>')
    expect(current.html).toBe('&lt;p&gt;舊內容&lt;/p&gt;')
    expect(
      writeEditorContentToBlockData(current, { html: '<p>已編輯</p>', css: '', js: '' }),
    ).toEqual({ html: '<p>已編輯</p>', futureField: { enabled: true } })
  })
})
