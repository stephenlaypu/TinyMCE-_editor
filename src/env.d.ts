/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EDITOR_MODE?: 'strict' | 'normal'
  readonly VITE_ACCESSIBILITY_PROFILE?: 'content-quality' | 'tw-aa-110'
  readonly VITE_UPLOAD_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
