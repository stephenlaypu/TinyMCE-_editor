<script setup lang="ts">
import Editor from '@tinymce/tinymce-vue'
import type { RawEditorOptions } from 'tinymce'

defineProps<{
  modelValue: string
  init: RawEditorOptions
  licenseKey: string
  disabled?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="editor-host">
    <Editor
      :model-value="modelValue"
      :license-key="licenseKey"
      :init="init"
      :disabled="disabled"
      :readonly="readonly"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
