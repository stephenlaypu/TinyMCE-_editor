import type { Editor } from 'tinymce'
import { cmsTableBorderWidthClasses } from './cmsTableSizing'

export interface CmsTableStyleLabels {
  button: string
  title: string
  layout: string
  layoutNone: string
  layoutScroll: string
  layoutCard: string
  bordered: string
  striped: string
  hover: string
  cancel: string
  apply: string
  tableRequired: string
}

type CmsTableLayout = 'none' | 'scroll' | 'card'

interface CmsTableStyleDialogData {
  layout: CmsTableLayout
  bordered: boolean
  striped: boolean
  hover: boolean
}

const cmsTableBaseClass = 'cms-table'
const cmsTableBorderedClass = 'is-bordered'
const cmsTableCardClass = 'is-card'
const cmsTableStripedClass = 'is-striped'
const cmsTableHoverClass = 'is-hover'
const cmsTableScrollClass = 'cms-table-scroll'

const isTableElement = (element: Element | null): element is HTMLTableElement =>
  element?.tagName.toLowerCase() === 'table'

const findCmsTableFromElement = (element: Element | null): HTMLTableElement | null => {
  if (!element) {
    return null
  }

  if (isTableElement(element)) {
    return element
  }

  const closestTable = element.closest?.('table')

  if (isTableElement(closestTable)) {
    return closestTable
  }

  const wrapper = element.closest?.(`.${cmsTableScrollClass}`)
  const wrappedTable = wrapper?.querySelector('table') ?? null

  return isTableElement(wrappedTable) ? wrappedTable : null
}

const findCmsTableFromSelection = (editor: Editor): HTMLTableElement | null => {
  const selectedNode = editor.selection.getNode()
  const startNode = editor.selection.getStart()
  const endNode = editor.selection.getEnd()

  return (
    findCmsTableFromElement(selectedNode) ??
    findCmsTableFromElement(startNode) ??
    findCmsTableFromElement(endNode)
  )
}

const getScrollWrapper = (table: HTMLTableElement): HTMLElement | null => {
  const parent = table.parentElement

  return parent?.classList.contains(cmsTableScrollClass) ? parent : null
}

const readCmsTableStyleData = (table: HTMLTableElement): CmsTableStyleDialogData => ({
  layout: getScrollWrapper(table) ? 'scroll' : 'none',
  bordered: table.classList.contains(cmsTableBorderedClass),
  striped: table.classList.contains(cmsTableStripedClass),
  hover: table.classList.contains(cmsTableHoverClass),
})

const unwrapScrollTable = (table: HTMLTableElement) => {
  const wrapper = getScrollWrapper(table)

  if (!wrapper || !wrapper.parentNode) {
    return
  }

  wrapper.parentNode.insertBefore(table, wrapper)
  wrapper.remove()
}

const wrapScrollTable = (table: HTMLTableElement) => {
  if (getScrollWrapper(table) || !table.parentNode) {
    return
  }

  const wrapper = table.ownerDocument.createElement('div')
  wrapper.className = cmsTableScrollClass
  table.parentNode.insertBefore(wrapper, table)
  wrapper.appendChild(table)
}

const getHeaderLabels = (table: HTMLTableElement): string[] => {
  const headerRow =
    table.tHead?.rows.item(table.tHead.rows.length - 1) ??
    table.querySelector<HTMLTableRowElement>('tr')

  if (!headerRow) {
    return []
  }

  return Array.from(headerRow.cells).map((cell) => cell.textContent?.trim() ?? '')
}

const applyCardLabels = (table: HTMLTableElement) => {
  const labels = getHeaderLabels(table)

  Array.from(table.tBodies).forEach((section) => {
    Array.from(section.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell, index) => {
        const label = labels[index]

        if (label) {
          cell.setAttribute('data-label', label)
        } else {
          cell.removeAttribute('data-label')
        }
      })
    })
  })
}

const clearCardLabels = (table: HTMLTableElement) => {
  table.querySelectorAll<HTMLTableCellElement>('td[data-label], th[data-label]').forEach((cell) => {
    cell.removeAttribute('data-label')
  })
}

const applyCmsTableStyles = (
  editor: Editor,
  table: HTMLTableElement,
  data: CmsTableStyleDialogData,
) => {
  editor.undoManager.transact(() => {
    table.classList.add(cmsTableBaseClass)
    table.classList.toggle(cmsTableBorderedClass, data.bordered)
    if (!data.bordered) {
      table.classList.remove(...cmsTableBorderWidthClasses)
    }
    table.classList.toggle(cmsTableStripedClass, data.striped)
    table.classList.toggle(cmsTableHoverClass, data.hover)

    if (data.layout === 'none') {
      unwrapScrollTable(table)
      table.classList.remove(cmsTableCardClass)
      clearCardLabels(table)
    } else if (data.layout === 'scroll') {
      table.classList.remove(cmsTableCardClass)
      clearCardLabels(table)
      wrapScrollTable(table)
    } else {
      unwrapScrollTable(table)
      table.classList.add(cmsTableCardClass)
      applyCardLabels(table)
    }
  })

  editor.selection.select(table)
  editor.nodeChanged()
}

const openCmsTableStylesDialog = (
  editor: Editor,
  labels: CmsTableStyleLabels,
  fallbackTable: HTMLTableElement | null = null,
) => {
  const table = findCmsTableFromSelection(editor) ?? (fallbackTable?.isConnected ? fallbackTable : null)

  if (!table) {
    editor.notificationManager.open({
      text: labels.tableRequired,
      type: 'warning',
      timeout: 5000,
    })
    return
  }

  editor.windowManager.open<CmsTableStyleDialogData>({
    title: labels.title,
    body: {
      type: 'panel',
      items: [
        {
          type: 'selectbox',
          name: 'layout',
          label: labels.layout,
          items: [
            { text: labels.layoutNone, value: 'none' },
            { text: labels.layoutScroll, value: 'scroll' },
            // Card layout is kept in the implementation but hidden from the current UI.
            // { text: labels.layoutCard, value: 'card' },
          ],
        },
        {
          type: 'checkbox',
          name: 'bordered',
          label: labels.bordered,
        },
        {
          type: 'checkbox',
          name: 'striped',
          label: labels.striped,
        },
        {
          type: 'checkbox',
          name: 'hover',
          label: labels.hover,
        },
      ],
    },
    initialData: readCmsTableStyleData(table),
    buttons: [
      { type: 'cancel', text: labels.cancel },
      { type: 'submit', text: labels.apply, primary: true },
    ],
    onSubmit: (api) => {
      applyCmsTableStyles(editor, table, api.getData())
      api.close()
    },
  })
}

export const registerCmsTableStyles = (editor: Editor, labels: CmsTableStyleLabels) => {
  let lastSelectedTable: HTMLTableElement | null = null

  const rememberTable = (table: HTMLTableElement | null) => {
    if (table?.isConnected) {
      lastSelectedTable = table
    }
  }

  const rememberCurrentTable = () => {
    rememberTable(findCmsTableFromSelection(editor))
  }

  const openSelectedTableDialog = () => openCmsTableStylesDialog(editor, labels, lastSelectedTable)

  editor.addCommand('cmsTableStyles', openSelectedTableDialog)

  editor.ui.registry.addButton('cmstablestyles', {
    icon: 'table',
    tooltip: labels.button,
    onAction: openSelectedTableDialog,
  })

  editor.ui.registry.addMenuItem('cmstablestyles', {
    icon: 'table',
    text: labels.button,
    onAction: openSelectedTableDialog,
  })

  editor.ui.registry.addContextMenu('cmstablestyles', {
    update: (element) => {
      const table = findCmsTableFromElement(element) ?? findCmsTableFromSelection(editor)
      rememberTable(table)

      return table
        ? [
            {
              type: 'item',
              icon: 'table',
              text: labels.button,
              onAction: () => {
                rememberTable(table)
                editor.selection.select(table)
                openCmsTableStylesDialog(editor, labels, table)
              },
            },
          ]
        : []
    },
  })

  editor.on('NodeChange click keyup TableSelectorChange', rememberCurrentTable)
}
