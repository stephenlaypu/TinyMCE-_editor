import type { Editor } from 'tinymce'

const resizeHandleSelector = '[data-mce-name="resize-handle"]'

export const installEditorAccessibilityFixes = (editor: Editor) => {
  let animationFrameId: number | null = null

  const syncResizeHandleValue = () => {
    const resizeHandle = editor.getContainer()?.querySelector<HTMLElement>(resizeHandleSelector)

    if (!resizeHandle) {
      return
    }

    const editorHeight = Math.round(editor.getContainer().getBoundingClientRect().height)
    resizeHandle.setAttribute('aria-valuemin', '100')
    resizeHandle.setAttribute('aria-valuemax', '10000')
    resizeHandle.setAttribute('aria-valuenow', String(editorHeight))
  }

  const scheduleSync = () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId)
    }

    animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null
      syncResizeHandleValue()
    })
  }

  editor.on('init SkinLoaded ResizeEditor FullscreenStateChanged', scheduleSync)
  editor.on('remove', () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId)
    }
  })
}
