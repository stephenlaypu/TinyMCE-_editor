import tinymce from 'tinymce/tinymce'

let loadPromise: Promise<void> | null = null

export const loadTinyMce = (): Promise<void> => {
  if (loadPromise) {
    return loadPromise
  }

  // Reading the bundled core export executes TinyMCE's UMD factory and creates
  // window.tinymce before any icon, theme, model, or plugin module runs.
  void tinymce

  loadPromise = Promise.all([
    import('tinymce/icons/default'),
    import('tinymce/themes/silver'),
    import('tinymce/models/dom'),
    import('tinymce/plugins/advlist'),
    import('tinymce/plugins/autolink'),
    import('tinymce/plugins/charmap'),
    import('tinymce/plugins/code'),
    import('tinymce/plugins/fullscreen'),
    import('tinymce/plugins/help'),
    import('tinymce/plugins/image'),
    import('tinymce/plugins/link'),
    import('tinymce/plugins/lists'),
    import('tinymce/plugins/media'),
    import('tinymce/plugins/preview'),
    import('tinymce/plugins/searchreplace'),
    import('tinymce/plugins/table'),
    import('tinymce/plugins/visualblocks'),
    import('tinymce/plugins/wordcount'),
  ]).then(() => undefined)

  return loadPromise
}
