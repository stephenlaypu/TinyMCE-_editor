export type CmsTableSizingField =
  | 'tableWidth'
  | 'cellWidth'
  | 'cellPadding'
  | 'borderWidth'

export type CmsTableSizingValues = Partial<Record<CmsTableSizingField, string>>

export const cmsTableWidthClassByValue = new Map(
  [25, 50, 75, 100].map((value) => [`${value}%`, `cms-table-width-${value}`]),
)

export const cmsCellWidthClassByValue = new Map(
  [20, 25, 33, 40, 50, 60, 66, 75, 80, 100].map((value) => [`${value}%`, `cms-cell-width-${value}`]),
)

export const cmsTablePaddingClassByValue = new Map(
  [0, 4, 8, 12, 16].map((value) => [String(value), `cms-table-padding-${value}`]),
)

export const cmsTableBorderWidthClassByValue = new Map(
  [0, 1, 2, 4].map((value) => [String(value), `cms-table-border-width-${value}`]),
)

export const cmsTableWidthClasses = [...cmsTableWidthClassByValue.values()]
export const cmsCellWidthClasses = [...cmsCellWidthClassByValue.values()]
export const cmsTablePaddingClasses = [...cmsTablePaddingClassByValue.values()]
export const cmsTableBorderWidthClasses = [...cmsTableBorderWidthClassByValue.values()]

const cmsTableBaseClass = 'cms-table'
const cmsTableBorderedClass = 'is-bordered'

const normalizePercentageValue = (
  value: string | null | undefined,
  classByValue: Map<string, string>,
) => {
  const normalizedValue = value?.trim() ?? ''

  return classByValue.has(normalizedValue) ? normalizedValue : null
}

const normalizePixelValue = (value: string | null | undefined) => {
  const match = value?.trim().match(/^(\d+)(?:px)?$/i)

  if (!match) {
    return null
  }

  return String(Number(match[1]))
}

const normalizeManagedPixelValue = (
  value: string | null | undefined,
  classByValue: Map<string, string>,
) => {
  const normalizedValue = normalizePixelValue(value)

  return normalizedValue && classByValue.has(normalizedValue) ? normalizedValue : null
}

const getClassValue = (element: Element, classByValue: Map<string, string>) => {
  for (const [value, className] of classByValue) {
    if (element.classList.contains(className)) {
      return value
    }
  }

  return null
}

const setManagedClass = (
  element: Element,
  classNames: string[],
  className: string | null,
) => {
  element.classList.remove(...classNames)

  if (className) {
    element.classList.add(className)
  }
}

const cleanEmptyAttributes = (element: HTMLElement) => {
  if (!element.getAttribute('style')?.trim()) {
    element.removeAttribute('style')
  }

  if (!element.getAttribute('class')?.trim()) {
    element.removeAttribute('class')
  }
}

const removeStyleProperty = (element: HTMLElement, property: string) => {
  element.style.removeProperty(property)

  const dataMceStyle = element.getAttribute('data-mce-style')

  if (dataMceStyle) {
    const styleElement = document.createElement('span')
    styleElement.setAttribute('style', dataMceStyle)
    styleElement.style.removeProperty(property)
    const nextDataMceStyle = styleElement.getAttribute('style')?.trim()

    if (nextDataMceStyle) {
      element.setAttribute('data-mce-style', nextDataMceStyle)
    } else {
      element.removeAttribute('data-mce-style')
    }
  }

  cleanEmptyAttributes(element)
}

interface CellColumnRange {
  start: number
  end: number
}

const getCellColumnRanges = (table: HTMLTableElement) => {
  const rows = Array.from(table.rows)
  const occupiedUntilRow: number[] = []
  const ranges = new Map<HTMLTableCellElement, CellColumnRange>()

  rows.forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell) => {
      const colSpan = Math.max(1, cell.colSpan)
      let start = 0

      while (
        Array.from({ length: colSpan }, (_, offset) => occupiedUntilRow[start + offset] ?? 0).some(
          (occupiedUntil) => occupiedUntil > rowIndex,
        )
      ) {
        start += 1
      }

      const end = start + colSpan
      const occupiedUntil = cell.rowSpan === 0 ? rows.length : rowIndex + Math.max(1, cell.rowSpan)

      for (let column = start; column < end; column += 1) {
        occupiedUntilRow[column] = Math.max(occupiedUntilRow[column] ?? 0, occupiedUntil)
      }

      ranges.set(cell, { start, end })
    })
  })

  return ranges
}

const getExplicitTableColumns = (table: HTMLTableElement, requiredCount: number) => {
  let columnGroups = Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup'))

  if (columnGroups.length === 0) {
    const columnGroup = table.ownerDocument.createElement('colgroup')
    const firstSection = Array.from(table.children).find(
      (child) => child.tagName.toLowerCase() !== 'caption',
    )
    table.insertBefore(columnGroup, firstSection ?? null)
    columnGroups = [columnGroup]
  }

  columnGroups.forEach((columnGroup) => {
    Array.from(columnGroup.children).forEach((child) => {
      if (child.tagName.toLowerCase() !== 'col') {
        return
      }

      const column = child as HTMLTableColElement
      const span = Math.max(1, column.span)

      if (span === 1) {
        return
      }

      const columns = Array.from({ length: span }, () => {
        const clone = column.cloneNode(true) as HTMLTableColElement
        clone.removeAttribute('span')
        return clone
      })
      column.replaceWith(...columns)
    })
  })

  const lastColumnGroup = columnGroups[columnGroups.length - 1]
  let columns = Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))

  while (columns.length < requiredCount) {
    lastColumnGroup?.appendChild(table.ownerDocument.createElement('col'))
    columns = Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
  }

  return columns
}

const getColumnClassValueForCell = (cell: HTMLTableCellElement) => {
  const table = cell.closest('table')

  if (!table) {
    return null
  }

  const range = getCellColumnRanges(table).get(cell)
  const columns = Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))

  if (!range || columns.length < range.end) {
    return null
  }

  const values = columns.slice(range.start, range.end).map((column) =>
    getClassValue(column, cmsCellWidthClassByValue),
  )
  const firstValue = values[0] ?? null

  return firstValue && values.every((value) => value === firstValue) ? firstValue : null
}

const getSharedStyleValue = (cells: HTMLTableCellElement[], property: string) => {
  if (cells.length === 0) {
    return ''
  }

  const values = cells.map((cell) => cell.style.getPropertyValue(property).trim())
  const firstValue = values[0] ?? ''

  return values.every((value) => value === firstValue) ? firstValue : ''
}

const getSharedCellWidthValue = (cells: HTMLTableCellElement[]) => {
  if (cells.length === 0) {
    return ''
  }

  const values = cells.map(
    (cell) =>
      getColumnClassValueForCell(cell) ||
      getClassValue(cell, cmsCellWidthClassByValue) ||
      cell.style.width.trim() ||
      cell.getAttribute('width') ||
      '',
  )
  const firstValue = values[0] ?? ''

  return values.every((value) => value === firstValue) ? firstValue : ''
}

export const readCmsTableSizingValue = (
  table: HTMLTableElement,
  cells: HTMLTableCellElement[],
  field: CmsTableSizingField,
) => {
  if (field === 'tableWidth') {
    return (
      getClassValue(table, cmsTableWidthClassByValue) ||
      table.style.width.trim() ||
      table.getAttribute('width') ||
      ''
    )
  }

  if (field === 'cellWidth') {
    return getSharedCellWidthValue(cells)
  }

  if (field === 'cellPadding') {
    const value =
      getClassValue(table, cmsTablePaddingClassByValue) ||
      table.getAttribute('cellpadding') ||
      getSharedStyleValue(Array.from(table.querySelectorAll('td,th')), 'padding')

    return normalizeManagedPixelValue(value, cmsTablePaddingClassByValue) ?? value
  }

  const managedBorderWidth = getClassValue(table, cmsTableBorderWidthClassByValue)

  if (managedBorderWidth) {
    return managedBorderWidth
  }

  if (table.classList.contains(cmsTableBorderedClass)) {
    return '1'
  }

  const value =
    table.style.borderWidth.trim() ||
    table.getAttribute('border') ||
    getSharedStyleValue(Array.from(table.querySelectorAll('td,th')), 'border-width') ||
    '0'

  return normalizeManagedPixelValue(value, cmsTableBorderWidthClassByValue) ?? value
}

const applyTableWidth = (table: HTMLTableElement, value: string) => {
  const className = value ? cmsTableWidthClassByValue.get(value) : null

  if (value && !className) {
    return
  }

  table.classList.add(cmsTableBaseClass)
  setManagedClass(table, cmsTableWidthClasses, className ?? null)
  removeStyleProperty(table, 'width')
  table.removeAttribute('width')
}

const applyCellWidth = (cells: HTMLTableCellElement[], value: string) => {
  const className = value ? cmsCellWidthClassByValue.get(value) : null

  if (value && !className) {
    return
  }

  const cellsByTable = new Map<HTMLTableElement, HTMLTableCellElement[]>()

  cells.forEach((cell) => {
    const table = cell.closest('table')

    if (table) {
      cellsByTable.set(table, [...(cellsByTable.get(table) ?? []), cell])
    }
  })

  cellsByTable.forEach((selectedCells, table) => {
    const ranges = getCellColumnRanges(table)
    const selectedColumns = new Set<number>()

    selectedCells.forEach((cell) => {
      const range = ranges.get(cell)

      if (range) {
        for (let column = range.start; column < range.end; column += 1) {
          selectedColumns.add(column)
        }
      }
    })

    const requiredCount = Math.max(0, ...Array.from(ranges.values(), (range) => range.end))
    const columns = getExplicitTableColumns(table, requiredCount)

    selectedColumns.forEach((columnIndex) => {
      const column = columns[columnIndex]

      if (column) {
        setManagedClass(column, cmsCellWidthClasses, className ?? null)
        removeStyleProperty(column, 'width')
        column.removeAttribute('width')
      }
    })

    ranges.forEach((range, cell) => {
      const overlapsSelectedColumn = Array.from(selectedColumns).some(
        (column) => column >= range.start && column < range.end,
      )

      if (overlapsSelectedColumn) {
        setManagedClass(cell, cmsCellWidthClasses, null)
        removeStyleProperty(cell, 'width')
        cell.removeAttribute('width')
      }
    })
  })
}

const applyCellPadding = (table: HTMLTableElement, value: string) => {
  const className = value ? cmsTablePaddingClassByValue.get(value) : null

  if (value && !className) {
    return
  }

  table.classList.add(cmsTableBaseClass)
  setManagedClass(table, cmsTablePaddingClasses, className ?? null)
  table.removeAttribute('cellpadding')
  removeStyleProperty(table, 'padding')
  table.querySelectorAll<HTMLTableCellElement>('td,th').forEach((cell) => {
    removeStyleProperty(cell, 'padding')
  })
}

const applyBorderWidth = (table: HTMLTableElement, value: string) => {
  const className = cmsTableBorderWidthClassByValue.get(value) ?? null

  if (!className) {
    return
  }

  table.classList.add(cmsTableBaseClass)
  table.classList.toggle(cmsTableBorderedClass, value !== '0')
  setManagedClass(table, cmsTableBorderWidthClasses, className)
  table.removeAttribute('border')
  removeStyleProperty(table, 'border-width')
  table.querySelectorAll<HTMLTableCellElement>('td,th').forEach((cell) => {
    removeStyleProperty(cell, 'border-width')
  })
}

export const applyCmsTableSizingValues = (
  table: HTMLTableElement,
  cells: HTMLTableCellElement[],
  values: CmsTableSizingValues,
) => {
  if (values.tableWidth !== undefined) {
    applyTableWidth(table, values.tableWidth)
  }

  if (values.cellWidth !== undefined) {
    applyCellWidth(cells, values.cellWidth)
  }

  if (values.cellPadding !== undefined) {
    applyCellPadding(table, values.cellPadding)
  }

  if (values.borderWidth !== undefined) {
    applyBorderWidth(table, values.borderWidth)
  }
}

export const normalizeCmsTableSizing = (table: HTMLTableElement) => {
  let didChange = false
  const tableWidth = normalizePercentageValue(
    table.style.width || table.getAttribute('width'),
    cmsTableWidthClassByValue,
  )

  if (tableWidth) {
    applyTableWidth(table, tableWidth)
    didChange = true
  }

  const cells = Array.from(table.querySelectorAll<HTMLTableCellElement>('td,th'))

  table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col').forEach((column) => {
    const columnWidth = normalizePercentageValue(
      column.style.width || column.getAttribute('width'),
      cmsCellWidthClassByValue,
    )

    if (columnWidth) {
      setManagedClass(column, cmsCellWidthClasses, cmsCellWidthClassByValue.get(columnWidth) ?? null)
      removeStyleProperty(column, 'width')
      column.removeAttribute('width')
      didChange = true
    }
  })

  const cellPadding = normalizePixelValue(
    table.getAttribute('cellpadding') || getSharedStyleValue(cells, 'padding'),
  )

  if (cellPadding !== null && cmsTablePaddingClassByValue.has(cellPadding)) {
    applyCellPadding(table, cellPadding)
    didChange = true
  }

  const borderWidth = normalizePixelValue(
    table.style.borderWidth ||
      table.getAttribute('border') ||
      getSharedStyleValue(cells, 'border-width'),
  )

  if (borderWidth !== null && cmsTableBorderWidthClassByValue.has(borderWidth)) {
    applyBorderWidth(table, borderWidth)
    didChange = true
  }

  cells.forEach((cell) => {
    const cellWidth =
      getClassValue(cell, cmsCellWidthClassByValue) ||
      normalizePercentageValue(
        cell.style.width || cell.getAttribute('width'),
        cmsCellWidthClassByValue,
      )

    if (cellWidth) {
      applyCellWidth([cell], cellWidth)
      didChange = true
    }
  })

  return didChange
}
