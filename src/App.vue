<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppLocale } from './editor/i18n'
import type { EditorContent } from './editor/types/editorContent'
import { createHttpUploadAdapter, localPreviewUploadAdapter } from './editor/uploads/adapters'

const editorLoadError = ref('')
const CmsContentEditor = defineAsyncComponent(
  async () => {
    try {
      return await import('./editor/CmsContentEditor.vue')
    } catch (error) {
      editorLoadError.value = error instanceof Error ? error.message : String(error)
      throw error
    }
  },
)

const { locale, t } = useI18n()
const editorMode = import.meta.env.VITE_EDITOR_MODE === 'normal' ? 'normal' : 'strict'
const accessibilityProfile =
  import.meta.env.VITE_ACCESSIBILITY_PROFILE === 'tw-aa-110'
    ? 'tw-aa-110'
    : 'content-quality'
const uploadAdapter = import.meta.env.VITE_UPLOAD_ENDPOINT
  ? createHttpUploadAdapter(import.meta.env.VITE_UPLOAD_ENDPOINT)
  : localPreviewUploadAdapter

const sampleContent = computed(
  () => `
    <h2>${t('app.sampleTitle')}</h2>
    <p>${t('app.sampleBody')}</p>
    <p>${t('app.sampleHint')}</p>
  `,
)

const content = ref<EditorContent>({
  html: sampleContent.value,
  css: '',
  js: '',
})

const changeLocale = (event: Event) => {
  const target = event.target as HTMLSelectElement
  locale.value = target.value as AppLocale
  document.documentElement.lang = locale.value
}

const loadSample = () => {
  content.value = { html: sampleContent.value, css: '', js: '' }
}

const clearContent = () => {
  content.value = { html: '', css: '', js: '' }
}
</script>

<template>
  <main class="page-shell">
    <header class="page-header">
      <div class="header-controls">
        <label class="locale-control">
          <span>{{ t('app.language') }}</span>
          <select id="editor-locale" name="editor-locale" :value="locale" @change="changeLocale">
            <option value="zh-TW">繁體中文</option>
            <option value="en-US">English</option>
          </select>
        </label>

        <div class="actions" :aria-label="t('app.actionsLabel')">
          <button type="button" class="secondary" @click="loadSample">
            {{ t('app.loadSample') }}
          </button>
          <button type="button" class="danger" @click="clearContent">
            {{ t('app.clear') }}
          </button>
        </div>
      </div>
    </header>

    <p v-if="editorLoadError" class="editor-load-error" role="alert">
      {{ editorLoadError }}
    </p>
    <CmsContentEditor
      :key="locale"
      v-model="content"
      :locale="locale as AppLocale"
      :mode="editorMode"
      :accessibility-profile="accessibilityProfile"
      :upload-adapter="uploadAdapter"
    />

    <details class="html-panel">
      <summary>{{ t('app.showHtml') }}</summary>
      <pre><code>{{ content.html }}</code></pre>
    </details>
  </main>
</template>
