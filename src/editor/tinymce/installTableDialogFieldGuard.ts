import type { Editor as TinyMCEEditor } from 'tinymce'
import { createUniqueId } from '../utils/createUniqueId'
import {
  editorBackgroundColorPalette,
  editorBorderColorPalette,
  getColorTokenLabel,
} from './cmsFormatting'
import {
  applyCmsTableSizingValues,
  cmsCellWidthClassByValue,
  cmsTableBorderWidthClassByValue,
  cmsTablePaddingClassByValue,
  cmsTableWidthClassByValue,
  readCmsTableSizingValue,
  type CmsTableSizingField,
  type CmsTableSizingValues,
} from './cmsTableSizing'

const tableDialogBlockedLabelsByCommand = new Map<string, string[]>([
  ['mceTableProps', ['Height', '高度', 'Cell spacing', '儲存格外間距', 'Class', '類型']],
  ['mceTableRowProps', ['Height', '高度', 'Class', '類型']],
  ['mceTableCellProps', ['Border width', '邊框寬度', 'Class', '類型']],
])

const backgroundColorLabels = new Set(['Background color', '背景顏色'])
const borderColorLabels = new Set(['Border color', '框線顏色'])
const tableDialogPreparingClass = 'cms-table-dialog-preparing'
const tableDialogRevealFallbackMs = 500

interface DialogSizingFieldConfig {
  field: CmsTableSizingField
  labels: string[]
}

interface ActiveTableDialog {
  command: string
  dialog: HTMLElement
  table: HTMLTableElement
  cells: HTMLTableCellElement[]
  values: CmsTableSizingValues
}

const tableDialogSizingFieldsByCommand = new Map<string, DialogSizingFieldConfig[]>([
  [
    'mceTableProps',
    [
      { field: 'tableWidth', labels: ['Width', '寬度'] },
      { field: 'cellPadding', labels: ['Cell padding', '儲存格內邊距'] },
      { field: 'borderWidth', labels: ['Border width', '邊框寬度'] },
    ],
  ],
  ['mceTableCellProps', [{ field: 'cellWidth', labels: ['Width', '寬度'] }]],
])

type ColorPalette = typeof editorBackgroundColorPalette

export const installTableDialogFieldGuard = (editor: TinyMCEEditor) => {
  let pendingTableDialogCommand: string | null = null
  let tableDialogObserver: MutationObserver | null = null
  let activeTableDialog: ActiveTableDialog | null = null
  let activeColorMenu: HTMLElement | null = null
  let removeColorMenuListeners: (() => void) | null = null
  let revealTableDialogFrame: number | null = null
  let revealTableDialogFallback: number | null = null

  const locale = editor.options.get('language') === 'en' ? 'en-US' : 'zh-TW'

  const clearRevealTimers = () => {
    if (revealTableDialogFrame !== null) {
      window.cancelAnimationFrame(revealTableDialogFrame)
      revealTableDialogFrame = null
    }

    if (revealTableDialogFallback !== null) {
      window.clearTimeout(revealTableDialogFallback)
      revealTableDialogFallback = null
    }
  }

  const clearTableDialogPreparingState = () => {
    clearRevealTimers()
    document.body.classList.remove(tableDialogPreparingClass)
  }

  const beginTableDialogPreparingState = () => {
    clearRevealTimers()
    document.body.classList.add(tableDialogPreparingClass)
    revealTableDialogFallback = window.setTimeout(() => {
      revealTableDialogFallback = null
      document.body.classList.remove(tableDialogPreparingClass)
    }, tableDialogRevealFallbackMs)
  }

  const focusFirstVisibleDialogControl = (dialog: HTMLElement) => {
    const activeElement = document.activeElement

    if (
      activeElement instanceof HTMLElement &&
      dialog.contains(activeElement) &&
      !activeElement.hidden &&
      activeElement.style.display !== 'none' &&
      !activeElement.hasAttribute('disabled') &&
      !activeElement.closest('[hidden]')
    ) {
      return
    }

    const controls = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'select[data-cms-sizing-field], input, select, textarea, button',
      ),
    )
    const firstVisibleControl = controls.find(
      (control) =>
        !control.hidden &&
        control.style.display !== 'none' &&
        !control.hasAttribute('disabled') &&
        !control.closest('[hidden]'),
    )

    firstVisibleControl?.focus()
  }

  const revealPreparedTableDialog = (dialog: HTMLElement) => {
    clearRevealTimers()
    revealTableDialogFrame = window.requestAnimationFrame(() => {
      revealTableDialogFrame = null
      document.body.classList.remove(tableDialogPreparingClass)

      if (dialog.isConnected) {
        focusFirstVisibleDialogControl(dialog)
      }
    })
  }

  const closeColorMenu = (returnFocus = false) => {
    const trigger = activeColorMenu?.dataset.triggerId
      ? document.getElementById(activeColorMenu.dataset.triggerId)
      : null

    activeColorMenu?.remove()
    activeColorMenu = null
    removeColorMenuListeners?.()
    removeColorMenuListeners = null

    if (returnFocus && trigger instanceof HTMLElement) {
      trigger.focus()
    }
  }

  const disconnectTableDialogObserver = () => {
    tableDialogObserver?.disconnect()
    tableDialogObserver = null
    activeTableDialog = null
    closeColorMenu()
  }

  const getCurrentDialog = () => {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('.tox-dialog'))

    return dialogs[dialogs.length - 1] ?? null
  }

  const findTableFromElement = (element: Element | null) =>
    element?.tagName.toLowerCase() === 'table'
      ? (element as HTMLTableElement)
      : (element?.closest?.('table') as HTMLTableElement | null)

  const findTableFromSelection = () =>
    findTableFromElement(editor.selection.getNode()) ??
    findTableFromElement(editor.selection.getStart()) ??
    findTableFromElement(editor.selection.getEnd())

  const getSelectedCells = (table: HTMLTableElement) => {
    const selectedCells = editor.model.table
      .getSelectedCells()
      .filter((cell) => cell.closest('table') === table)

    if (selectedCells.length > 0) {
      return selectedCells
    }

    const selectedElement = editor.selection.getNode()
    const cell =
      selectedElement.tagName.toLowerCase() === 'td' || selectedElement.tagName.toLowerCase() === 'th'
        ? (selectedElement as HTMLTableCellElement)
        : (selectedElement.closest?.('td,th') as HTMLTableCellElement | null)

    return cell?.closest('table') === table ? [cell] : []
  }

  const getSizingOptions = (field: CmsTableSizingField) => {
    if (field === 'tableWidth' || field === 'cellWidth') {
      const widthValues = [
        ...(field === 'cellWidth'
          ? cmsCellWidthClassByValue.keys()
          : cmsTableWidthClassByValue.keys()),
      ]

      return [
        {
          value: '',
          label:
            field === 'tableWidth'
              ? locale === 'en-US'
                ? 'Default'
                : '預設'
              : locale === 'en-US'
                ? 'Auto'
                : '自動',
        },
        ...widthValues.map((value) => ({ value, label: value })),
      ]
    }

    if (field === 'cellPadding') {
      return [
        { value: '', label: locale === 'en-US' ? 'Default' : '預設' },
        ...[...cmsTablePaddingClassByValue.keys()].map((value) => ({
          value,
          label: `${value} px`,
        })),
      ]
    }

    return [...cmsTableBorderWidthClassByValue.keys()].map((value) => ({
      value,
      label:
        value === '0' ? (locale === 'en-US' ? 'No border' : '無邊框') : `${value} px`,
    }))
  }

  const updateDialogInput = (input: HTMLInputElement, value: string) => {
    input.value = value
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: value ? 'insertText' : 'deleteContentBackward',
        data: value || null,
      }),
    )
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const installSizingSelects = (state: ActiveTableDialog) => {
    const fieldConfigs = tableDialogSizingFieldsByCommand.get(state.command) ?? []

    fieldConfigs.forEach(({ field, labels }) => {
      const label = Array.from(state.dialog.querySelectorAll<HTMLLabelElement>('.tox-label')).find(
        (candidate) => labels.includes(candidate.textContent?.trim() ?? ''),
      )
      const group = label?.closest<HTMLElement>('.tox-form__group')
      const input = group?.querySelector<HTMLInputElement>('input:not([type="hidden"])')

      if (!label || !group || !input || group.querySelector(`[data-cms-sizing-field="${field}"]`)) {
        return
      }

      const select = document.createElement('select')
      select.id = createUniqueId(`cms-table-dialog-${field}`)
      select.className = 'tox-textfield cms-table-dialog-select'
      select.dataset.cmsSizingField = field
      select.setAttribute('aria-label', label.textContent?.trim() ?? '')

      const pendingValue = state.values[field]
      const currentValue =
        pendingValue !== undefined
          ? pendingValue
          : readCmsTableSizingValue(state.table, state.cells, field) || input.value
      const options = getSizingOptions(field)

      if (currentValue && !options.some((option) => option.value === currentValue)) {
        options.unshift({
          value: currentValue,
          label:
            locale === 'en-US'
              ? `Current value: ${currentValue}`
              : `目前值：${currentValue}`,
        })
      }

      options.forEach((option) => {
        const optionElement = document.createElement('option')
        optionElement.value = option.value
        optionElement.textContent = option.label
        select.appendChild(optionElement)
      })

      select.value = currentValue
      input.hidden = true
      input.style.display = 'none'
      input.tabIndex = -1
      input.setAttribute('aria-hidden', 'true')
      label.htmlFor = select.id
      group.appendChild(select)

      if (currentValue !== input.value) {
        updateDialogInput(input, currentValue)
      }

      select.addEventListener('change', () => {
        state.values[field] = select.value
        updateDialogInput(input, select.value)
      })
    })
  }

  const blockDialogFields = (dialog: HTMLElement, labels: string[]) => {
    const labelSet = new Set(labels)

    dialog.querySelectorAll<HTMLElement>('.tox-label').forEach((label) => {
      if (!labelSet.has(label.textContent?.trim() ?? '')) {
        return
      }

      const field = label.closest<HTMLElement>('.tox-form__group')
      const control = field?.querySelector<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('button,input,select,textarea')

      if (!field) {
        return
      }

      if (control) {
        if ('value' in control) {
          control.value = ''
        }

        control.disabled = true
        control.setAttribute('aria-disabled', 'true')
      }

      field.hidden = true
      field.style.display = 'none'
    })
  }

  const getPaletteForGroup = (group: HTMLElement): ColorPalette | null => {
    const label = group.querySelector<HTMLElement>('.tox-label')?.textContent?.trim() ?? ''

    if (backgroundColorLabels.has(label)) {
      return editorBackgroundColorPalette
    }

    if (borderColorLabels.has(label)) {
      return editorBorderColorPalette
    }

    return null
  }

  const updateColorInput = (group: HTMLElement, value: string) => {
    const input = group.querySelector<HTMLInputElement>('.tox-color-input input')

    if (!input) {
      return
    }

    input.value = value
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: value ? 'insertText' : 'deleteContentBackward',
        data: value || null,
      }),
    )
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.focus()
  }

  const openColorMenu = (trigger: HTMLElement, group: HTMLElement, palette: ColorPalette) => {
    closeColorMenu()

    if (!trigger.id) {
      trigger.id = createUniqueId('cms-table-color-trigger')
    }

    const menu = document.createElement('div')
    menu.className = 'cms-table-color-menu'
    menu.setAttribute('role', 'menu')
    menu.setAttribute('aria-label', locale === 'en-US' ? 'Choose color' : '選擇顏色')
    menu.dataset.triggerId = trigger.id

    const currentValue = group
      .querySelector<HTMLInputElement>('.tox-color-input input')
      ?.value.trim()
      .toUpperCase()

    const choices = [
      ...palette.map((token) => ({
        value: token.value,
        label: getColorTokenLabel(token, locale),
      })),
      { value: '', label: locale === 'en-US' ? 'Remove color' : '移除顏色' },
    ]

    choices.forEach(({ value, label }) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = value
        ? 'cms-table-color-menu__swatch'
        : 'cms-table-color-menu__swatch is-remove'
      button.setAttribute('role', 'menuitemradio')
      button.setAttribute('aria-label', label)
      button.setAttribute('aria-checked', String(Boolean(value) && value === currentValue))
      button.title = label

      if (value) {
        button.style.backgroundColor = value
      } else {
        button.textContent = '×'
      }

      button.addEventListener('click', () => {
        updateColorInput(group, value)
        closeColorMenu()
      })
      menu.appendChild(button)
    })

    menu.addEventListener('keydown', (event) => {
      const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
      let nextIndex: number | null = null

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % buttons.length
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
      } else if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = buttons.length - 1
      } else if (event.key === 'Escape') {
        event.preventDefault()
        closeColorMenu(true)
        return
      }

      if (nextIndex !== null) {
        event.preventDefault()
        buttons[nextIndex]?.focus()
      }
    })

    document.body.appendChild(menu)
    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const left = Math.min(triggerRect.left, window.innerWidth - menuRect.width - 8)
    const belowTop = triggerRect.bottom + 4
    const top =
      belowTop + menuRect.height <= window.innerHeight
        ? belowTop
        : Math.max(8, triggerRect.top - menuRect.height - 4)

    menu.style.left = `${Math.max(8, left)}px`
    menu.style.top = `${top}px`
    activeColorMenu = menu
    const closeOnOutsideInteraction = (event: Event) => {
      const target = event.target

      if (target instanceof Node && !menu.contains(target) && !trigger.contains(target)) {
        closeColorMenu()
      }
    }
    const closeOnViewportChange = () => closeColorMenu()

    document.addEventListener('pointerdown', closeOnOutsideInteraction, true)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    removeColorMenuListeners = () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction, true)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
    menu.querySelector<HTMLButtonElement>('button')?.focus()
  }

  const installColorPaletteHandler = (dialog: HTMLElement) => {
    if (dialog.dataset.cmsColorPaletteInstalled === 'true') {
      return
    }

    dialog.dataset.cmsColorPaletteInstalled = 'true'
    dialog.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target : null
        const trigger = target?.closest<HTMLElement>('.tox-color-input > span')
        const group = trigger?.closest<HTMLElement>('.tox-form__group')
        const palette = group ? getPaletteForGroup(group) : null

        if (!trigger || !group || !palette) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        openColorMenu(trigger, group, palette)
      },
      true,
    )
  }

  const observeCurrentTableDialog = (command: string, labels: string[]) => {
    disconnectTableDialogObserver()

    const dialog = getCurrentDialog()
    const table = findTableFromSelection()

    if (!dialog || !table) {
      return
    }

    const state: ActiveTableDialog = {
      command,
      dialog,
      table,
      cells: getSelectedCells(table),
      values: {},
    }
    activeTableDialog = state

    blockDialogFields(dialog, labels)
    installSizingSelects(state)
    installColorPaletteHandler(dialog)
    revealPreparedTableDialog(dialog)

    tableDialogObserver = new MutationObserver(() => {
      if (!dialog.isConnected) {
        disconnectTableDialogObserver()
        return
      }

      blockDialogFields(dialog, labels)
      installSizingSelects(state)
      installColorPaletteHandler(dialog)
    })
    tableDialogObserver.observe(dialog, {
      childList: true,
      subtree: true,
    })
  }

  editor.on('BeforeExecCommand', (event) => {
    const labels = tableDialogBlockedLabelsByCommand.get(event.command)

    if (!labels) {
      return
    }

    beginTableDialogPreparingState()
    pendingTableDialogCommand = event.command
    window.setTimeout(() => {
      if (pendingTableDialogCommand === event.command) {
        pendingTableDialogCommand = null
      }
    }, 0)
  })

  editor.on('ExecCommand', (event) => {
    if (pendingTableDialogCommand !== event.command) {
      return
    }

    const labels = tableDialogBlockedLabelsByCommand.get(event.command)
    pendingTableDialogCommand = null

    if (labels) {
      window.setTimeout(() => observeCurrentTableDialog(event.command, labels), 0)
    }
  })

  editor.on('TableModified', (event) => {
    const state = activeTableDialog

    if (!state || Object.keys(state.values).length === 0) {
      return
    }

    const table = event.table instanceof HTMLTableElement ? event.table : state.table
    const cells = state.command === 'mceTableCellProps' ? getSelectedCells(table) : state.cells

    applyCmsTableSizingValues(table, cells.length > 0 ? cells : state.cells, state.values)
    state.values = {}
    editor.nodeChanged()
  })

  editor.on('remove', () => {
    disconnectTableDialogObserver()
    clearTableDialogPreparingState()
  })
}
