import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'tinymce-core',
              test: /node_modules[\\/]tinymce[\\/]tinymce\.js$/,
            },
            {
              name: 'tinymce-theme',
              test: /node_modules[\\/]tinymce[\\/]themes[\\/]/,
            },
            {
              name: 'tinymce-model',
              test: /node_modules[\\/]tinymce[\\/]models[\\/]/,
            },
            {
              name: 'tinymce-icons',
              test: /node_modules[\\/]tinymce[\\/]icons[\\/]/,
            },
            {
              name: 'tinymce-plugins',
              test: /node_modules[\\/]tinymce[\\/]plugins[\\/]/,
            },
            {
              name: 'codemirror-core',
              test: /node_modules[\\/]@codemirror[\\/](?:state|view)[\\/]/,
            },
            {
              name: 'codemirror-language',
              test: /node_modules[\\/](?:@codemirror|@lezer|codemirror)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 4180,
    strictPort: true,
  },
})
