import type { Editor } from 'tinymce'

export interface CmsTemplateLabels {
  templates: string
  anchorList: string
  anchorListItem: string
  anchorListText: string
  anchorListHref: string
  addItem: string
  removeItem: string
  moveItemUp: string
  moveItemDown: string
  cancel: string
  insert: string
  update: string
  invalidAnchorList: string
}

interface AnchorListItem {
  text: string
  href: string
}

interface AnchorListDialogApi {
  close: () => void
}

interface AnchorListDialogSpec {
  title: string
  size: 'large'
  body: {
    type: 'panel'
    items: Array<{
      type: 'htmlpanel'
      html: string
      onInit: (element: HTMLElement) => void
    }>
  }
  buttons: Array<
    | { type: 'cancel'; text: string }
    | { type: 'submit'; text: string; primary: true }
  >
  onSubmit: (api: AnchorListDialogApi) => void
}

const defaultAnchorListItems: AnchorListItem[] = [
  { text: '錨點一', href: '#section-1' },
  { text: '錨點二', href: '#section-2' },
  { text: '錨點三', href: '#section-3' },
]

const unsafeHrefPattern = /^(?:javascript|data|vbscript):/i

const escapeHtml = (value: string): string => {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}

const escapeAttribute = (value: string): string => escapeHtml(value).replace(/"/g, '&quot;')

const normalizeHref = (value: string): string | null => {
  const href = value.trim()

  if (!href || unsafeHrefPattern.test(href)) {
    return null
  }

  return href
}

const openTimedError = (editor: Editor, text: string) => {
  editor.notificationManager.open({ text, type: 'error', timeout: 5000 })
}

const isAnchorList = (element: Element | null): element is HTMLUListElement =>
  element instanceof HTMLUListElement && element.classList.contains('anchor_list')

const findAnchorList = (editor: Editor, element: Element | null): HTMLUListElement | null => {
  const selectedNode = element ?? editor.selection.getNode()

  if (isAnchorList(selectedNode)) {
    return selectedNode
  }

  return selectedNode.closest?.('ul.anchor_list') ?? null
}

const readAnchorListItems = (anchorList: HTMLUListElement | null): AnchorListItem[] => {
  if (!anchorList) {
    return defaultAnchorListItems
  }

  const items = Array.from(anchorList.querySelectorAll<HTMLElement>(':scope > li')).map((listItem) => {
    const link = listItem.querySelector<HTMLAnchorElement>(':scope > a')
    const text = (link?.textContent ?? listItem.textContent ?? '').trim()
    const href = link?.getAttribute('href')?.trim() || `#${text || 'section'}`

    return { text, href }
  })

  return items.length > 0 ? items : defaultAnchorListItems
}

const renderAnchorList = (items: AnchorListItem[]): string => {
  const itemHtml = items
    .map((item) => {
      const text = escapeHtml(item.text)

      return `<li><a href="${escapeAttribute(item.href)}" title="${escapeAttribute(
        item.text,
      )}">${text}</a></li>`
    })
    .join('')

  return `<ul class="anchor_list nomargin">${itemHtml}</ul>`
}

const replaceElementHtml = (target: HTMLElement, html: string) => {
  const template = target.ownerDocument.createElement('template')
  template.innerHTML = html
  target.replaceWith(template.content)
}

const anchorListDialogIcons = {
  moveUp: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 19V5"></path>
      <path d="m5 12 7-7 7 7"></path>
    </svg>
  `,
  moveDown: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14"></path>
      <path d="m19 12-7 7-7-7"></path>
    </svg>
  `,
  remove: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M19 6l-1 14H6L5 6"></path>
      <path d="M10 11v5"></path>
      <path d="M14 11v5"></path>
    </svg>
  `,
} as const

const getDialogHtml = (labels: CmsTemplateLabels): string => `
  <style>
    .tox-dialog:has(.cms-anchor-list-dialog).tox-dialog--width-lg {
      height: unset;
    }
    .tox .cms-anchor-list-dialog {
      display: grid;
      gap: 12px;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 4px;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-editor {
      display: grid;
      gap: 12px;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-row {
      display: grid;
      grid-template-columns: 34px minmax(160px, 0.9fr) minmax(220px, 1.35fr) 216px;
      gap: 12px;
      align-items: center;
      padding: 14px;
      border: 1px solid #d7dde5;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(34, 47, 62, 0.06);
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-row:hover {
      border-color: #b7c3d0;
      background: #fbfcfe;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: #e8eef6;
      color: #405166;
      font-size: 13px;
      font-weight: 700;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-field label {
      color: #2f3f50;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-row input {
      box-sizing: border-box;
      width: 100%;
      min-height: 38px;
      padding: 8px 10px;
      border: 1px solid #c5cbd3;
      border-radius: 3px;
      background: #fff;
      color: #17212b;
      box-shadow: inset 0 1px 1px rgba(34, 47, 62, 0.06);
      font: inherit;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-row input:focus {
      border-color: #207ab7;
      box-shadow:
        inset 0 1px 1px rgba(34, 47, 62, 0.06),
        0 0 0 2px rgba(32, 122, 183, 0.22);
      outline: 0;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      min-height: 38px;
      padding: 0;
      border: 1px solid #c5cbd3;
      border-radius: 3px;
      background: #f7f7f7;
      color: #222f3e;
      cursor: pointer;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-button svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-button:hover:not(:disabled),
    .tox .cms-anchor-list-dialog .cms-anchor-list-button:focus-visible {
      border-color: #a6b0bd;
      background: #eef1f4;
      outline: 0;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-button[data-anchor-action="remove"] {
      color: #a61b1b;
    }
    .tox .cms-anchor-list-dialog .cms-anchor-list-button[data-anchor-action="remove"]:hover:not(:disabled),
    .tox .cms-anchor-list-dialog .cms-anchor-list-button[data-anchor-action="remove"]:focus-visible {
      border-color: #d7a3a3;
      background: #fff1f1;
    }
    @media (max-width: 860px) {
      .tox .cms-anchor-list-dialog .cms-anchor-list-row {
        grid-template-columns: 34px 1fr;
      }
      .tox .cms-anchor-list-dialog .cms-anchor-list-actions {
        grid-column: 2;
      }
    }
    @media (max-width: 560px) {
      .tox .cms-anchor-list-dialog .cms-anchor-list-row {
        grid-template-columns: 1fr;
      }
      .tox .cms-anchor-list-dialog .cms-anchor-list-actions {
        grid-column: auto;
        justify-content: flex-start;
      }
    }
  </style>
  <div class="cms-anchor-list-dialog">
    <div class="cms-anchor-list-toolbar">
      <button type="button" class="tox-button" data-anchor-action="add">${escapeHtml(labels.addItem)}</button>
    </div>
    <div class="cms-anchor-list-editor" data-anchor-list-editor></div>
  </div>
`

const readItemsFromRoot = (root: HTMLElement): AnchorListItem[] | null => {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-anchor-list-row]'))
  const items: AnchorListItem[] = []

  for (const row of rows) {
    const text = row.querySelector<HTMLInputElement>('[data-anchor-text]')?.value.trim() ?? ''
    const href = normalizeHref(row.querySelector<HTMLInputElement>('[data-anchor-href]')?.value ?? '')

    if (!text && !href) {
      continue
    }

    if (!text || !href) {
      return null
    }

    items.push({ text, href })
  }

  return items.length > 0 ? items : null
}

const renderDialogRows = (
  root: HTMLElement,
  labels: CmsTemplateLabels,
  currentItems: AnchorListItem[],
) => {
  const list = root.querySelector<HTMLElement>('[data-anchor-list-editor]')

  if (!list) {
    return
  }

  list.innerHTML = currentItems
    .map(
      (item, index) => `
        <div class="cms-anchor-list-row" data-anchor-list-row>
          <span class="cms-anchor-list-index" aria-hidden="true">${index + 1}</span>
          <div class="cms-anchor-list-field">
            <label for="cms-anchor-text-${index}">${escapeHtml(labels.anchorListText)}</label>
            <input id="cms-anchor-text-${index}" type="text" value="${escapeAttribute(
              item.text,
            )}" placeholder="${escapeAttribute(labels.anchorListText)}" data-anchor-text>
          </div>
          <div class="cms-anchor-list-field">
            <label for="cms-anchor-href-${index}">${escapeHtml(labels.anchorListHref)}</label>
            <input id="cms-anchor-href-${index}" type="text" value="${escapeAttribute(
              item.href,
            )}" placeholder="${escapeAttribute(labels.anchorListHref)}" data-anchor-href>
          </div>
          <div class="cms-anchor-list-actions">
            <button type="button" class="cms-anchor-list-button" title="${escapeAttribute(
              labels.moveItemUp,
            )}" aria-label="${escapeAttribute(labels.moveItemUp)}" data-anchor-action="moveUp" data-anchor-index="${index}"${
              index === 0 ? ' disabled' : ''
            }>${anchorListDialogIcons.moveUp}</button>
            <button type="button" class="cms-anchor-list-button" title="${escapeAttribute(
              labels.moveItemDown,
            )}" aria-label="${escapeAttribute(labels.moveItemDown)}" data-anchor-action="moveDown" data-anchor-index="${index}"${
              index === currentItems.length - 1 ? ' disabled' : ''
            }>${anchorListDialogIcons.moveDown}</button>
            <button type="button" class="cms-anchor-list-button" title="${escapeAttribute(
              labels.removeItem,
            )}" aria-label="${escapeAttribute(labels.removeItem)}" data-anchor-action="remove" data-anchor-index="${index}"${
              currentItems.length === 1 ? ' disabled' : ''
            }>${anchorListDialogIcons.remove}</button>
          </div>
        </div>
      `,
    )
    .join('')
}

const createAnchorListDialog = (
  editor: Editor,
  labels: CmsTemplateLabels,
  anchorList: HTMLUListElement | null,
  items: AnchorListItem[],
): AnchorListDialogSpec => {
  let rootElement: HTMLElement | null = null
  let currentItems = [...items]

  const syncItems = () => {
    if (!rootElement) {
      return false
    }

    const nextItems = readItemsFromRoot(rootElement)

    if (!nextItems) {
      openTimedError(editor, labels.invalidAnchorList)
      return false
    }

    currentItems = nextItems
    return true
  }

  return {
    title: labels.anchorList,
    size: 'large',
    body: {
      type: 'panel',
      items: [
        {
          type: 'htmlpanel',
          html: getDialogHtml(labels),
          onInit: (element) => {
            rootElement = element
            renderDialogRows(element, labels, currentItems)
            element.addEventListener('click', (event) => {
              const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-anchor-action]')

              if (!button || button.disabled || !syncItems()) {
                return
              }

              const action = button.dataset.anchorAction
              const index = Number(button.dataset.anchorIndex)

              if (action === 'add') {
                currentItems.push({
                  text: `${labels.anchorListItem} ${currentItems.length + 1}`,
                  href: `#section-${currentItems.length + 1}`,
                })
              }

              if (action === 'remove' && Number.isInteger(index) && currentItems.length > 1) {
                currentItems.splice(index, 1)
              }

              if (action === 'moveUp' && Number.isInteger(index) && index > 0) {
                ;[currentItems[index - 1], currentItems[index]] = [currentItems[index], currentItems[index - 1]]
              }

              if (action === 'moveDown' && Number.isInteger(index) && index < currentItems.length - 1) {
                ;[currentItems[index], currentItems[index + 1]] = [currentItems[index + 1], currentItems[index]]
              }

              renderDialogRows(element, labels, currentItems)
            })
          },
        },
      ],
    },
    buttons: [
      { type: 'cancel', text: labels.cancel },
      { type: 'submit', text: anchorList ? labels.update : labels.insert, primary: true },
    ],
    onSubmit: (api) => {
      if (!syncItems()) {
        return
      }

      const html = renderAnchorList(currentItems)

      editor.undoManager.transact(() => {
        if (anchorList) {
          replaceElementHtml(anchorList, html)
        } else {
          editor.insertContent(`${html}<p class="cms-clear">&nbsp;</p>`)
        }
      })
      editor.nodeChanged()
      api.close()
    },
  }
}

const openAnchorListDialog = (
  editor: Editor,
  labels: CmsTemplateLabels,
  anchorList: HTMLUListElement | null,
) => {
  const items = readAnchorListItems(anchorList)
  editor.windowManager.open(createAnchorListDialog(editor, labels, anchorList, items))
}

export const registerCmsTemplates = (editor: Editor, labels: CmsTemplateLabels) => {
  const openSelectedAnchorListDialog = () => openAnchorListDialog(editor, labels, findAnchorList(editor, null))

  editor.addCommand('cmsAnchorListTemplate', openSelectedAnchorListDialog)

  editor.ui.registry.addMenuButton('cmstemplates', {
    icon: 'template',
    tooltip: labels.templates,
    fetch: (callback) => {
      callback([
        {
          type: 'menuitem',
          text: labels.anchorList,
          onAction: openSelectedAnchorListDialog,
        },
      ])
    },
  })

  editor.ui.registry.addMenuItem('cmsanchorlist', {
    icon: 'template',
    text: labels.anchorList,
    onAction: openSelectedAnchorListDialog,
  })

  editor.ui.registry.addContextMenu('cmstemplates', {
    update: (element) => {
      const anchorList = findAnchorList(editor, element)

      if (!anchorList) {
        return []
      }

      return [
        {
          type: 'item',
          icon: 'template',
          text: labels.anchorList,
          onAction: () => {
            editor.selection.select(anchorList)
            openAnchorListDialog(editor, labels, anchorList)
          },
        },
      ]
    },
  })
}
