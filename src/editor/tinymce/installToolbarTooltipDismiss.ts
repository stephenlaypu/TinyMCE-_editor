interface ToolbarTooltipEditor {
  getContainer: () => HTMLElement
  dispatch: (eventName: string) => unknown
  on: (eventNames: string, callback: () => void) => unknown
  off: (eventNames: string, callback: () => void) => unknown
}

const toolbarControlSelector = '.tox-tbtn, .tox-mbtn, .tox-split-button'

const closestToolbarControl = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target.closest(toolbarControlSelector) : null

export const installToolbarTooltipDismiss = (editor: ToolbarTooltipEditor): (() => void) => {
  let editorHeader: HTMLElement | null = null

  const closeTooltips = () => {
    editor.dispatch('CloseActiveTooltips')
  }

  const onControlLeave = (event: MouseEvent | FocusEvent) => {
    const currentControl = closestToolbarControl(event.target)
    if (!currentControl || !editorHeader?.contains(currentControl)) {
      return
    }

    if (event.relatedTarget instanceof Node && currentControl.contains(event.relatedTarget)) {
      return
    }

    closeTooltips()
  }

  const bind = () => {
    editorHeader = editor.getContainer().querySelector<HTMLElement>('.tox-editor-header')
    editorHeader?.addEventListener('mouseout', onControlLeave)
    editorHeader?.addEventListener('focusout', onControlLeave)
  }

  const cleanup = () => {
    editorHeader?.removeEventListener('mouseout', onControlLeave)
    editorHeader?.removeEventListener('focusout', onControlLeave)
    editorHeader = null
    editor.off('init', bind)
    editor.off('remove', cleanup)
  }

  editor.on('init', bind)
  editor.on('remove', cleanup)

  return cleanup
}
