import type { UploadResult } from './uploads/types'

export const applyUploadedMediaMetadata = (
  html: string,
  uploadedMediaBySource: ReadonlyMap<string, UploadResult>,
): string => {
  if (uploadedMediaBySource.size === 0 && !html.includes('data-cms-file-source')) {
    return html
  }

  const template = document.createElement('template')
  template.innerHTML = html
  let didChange = false

  template.content
    .querySelectorAll<HTMLElement>('img[src],video[src],audio[src],source[src],track[src]')
    .forEach((element) => {
      const source = element.getAttribute('src')?.trim()
      if (!source) {
        return
      }

      const declaredSource = element.getAttribute('data-cms-file-source')?.trim()
      if (declaredSource && declaredSource !== source) {
        element.removeAttribute('data-cms-file-guid')
        element.removeAttribute('data-cms-file-state')
        element.removeAttribute('data-cms-file-source')
        didChange = true
      }

      const upload = uploadedMediaBySource.get(source)
      if (!upload?.fileGuid || !upload.fileState) {
        return
      }

      element.setAttribute('data-cms-file-guid', upload.fileGuid)
      element.setAttribute('data-cms-file-state', upload.fileState)
      element.setAttribute('data-cms-file-source', source)
      didChange = true
    })

  return didChange ? template.innerHTML : html
}
