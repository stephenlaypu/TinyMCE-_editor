import { describe, expect, it, vi } from 'vitest'
import { installToolbarTooltipDismiss } from '../../../src/editor/tinymce/installToolbarTooltipDismiss'

describe('toolbar tooltip dismissal', () => {
  const createEditor = () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <div class="tox-editor-header">
        <button class="tox-tbtn"><span class="icon"></span></button>
        <button class="tox-tbtn"></button>
      </div>
    `
    const listeners = new Map<string, () => void>()
    const dispatch = vi.fn()
    const editor = {
      getContainer: () => container,
      dispatch,
      on: (eventName: string, callback: () => void) => listeners.set(eventName, callback),
      off: (eventName: string, callback: () => void) => {
        if (listeners.get(eventName) === callback) listeners.delete(eventName)
      },
    }

    return { container, dispatch, editor, listeners }
  }

  it('closes an active tooltip immediately when the pointer leaves a toolbar control', () => {
    const { container, dispatch, editor, listeners } = createEditor()
    installToolbarTooltipDismiss(editor)
    listeners.get('init')?.()

    const [firstButton, secondButton] = container.querySelectorAll('.tox-tbtn')
    firstButton?.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, relatedTarget: secondButton }),
    )

    expect(dispatch).toHaveBeenCalledWith('CloseActiveTooltips')
  })

  it('does not close the tooltip while moving within the same toolbar control', () => {
    const { container, dispatch, editor, listeners } = createEditor()
    installToolbarTooltipDismiss(editor)
    listeners.get('init')?.()

    const button = container.querySelector('.tox-tbtn')
    const icon = container.querySelector('.icon')
    icon?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: button }))

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('removes DOM and editor listeners during cleanup', () => {
    const { container, dispatch, editor, listeners } = createEditor()
    const cleanup = installToolbarTooltipDismiss(editor)
    listeners.get('init')?.()
    cleanup()

    container
      .querySelector('.tox-tbtn')
      ?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))

    expect(dispatch).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })
})
