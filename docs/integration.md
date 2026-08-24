# Vue 3 後台整合

本 editor 採原始碼模組同步，不發布公有或私有 npm package。`src/editor` 是唯一可重用程式邊界；`src/App.vue`、`src/main.ts` 與 `src/style.css` 只屬於 demo，不應搬入後台。

## 需要同步的目錄

將下列兩個目錄以 UTF-8 原樣複製到 Vue 3 後台：

```text
src/editor/               -> 後台的 src/modules/cms-editor/
public/cms-editor/        -> 後台的 public/cms-editor/
```

不要只複製 `CmsContentEditor.vue`。TinyMCE 客製工具、CodeMirror、i18n、upload 型別與 CMS formatting token 都位於同一個 `src/editor` 邊界內。

## 宿主相依套件

後台需安裝 editor 使用的 runtime dependencies；Vue 3 若已存在，不需重複安裝：

```powershell
pnpm add vue vue-i18n tinymce @tinymce/tinymce-vue codemirror prettier `
  @codemirror/commands @codemirror/lang-css @codemirror/lang-html `
  @codemirror/lang-javascript @codemirror/language @codemirror/lint `
  @codemirror/search @codemirror/state @codemirror/view
```

`vue-i18n` 必須安裝到宿主 Vue app；editor 使用 local-scope messages，不會要求宿主把 editor 文案合併到既有 messages。

## 基本使用

建議由後台 route 或實際需要 editor 的頁面延遲載入：

```vue
<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import {
  createHttpUploadAdapter,
  type EditorContent,
} from '@/modules/cms-editor'

const CmsContentEditor = defineAsyncComponent(
  () => import('@/modules/cms-editor/CmsContentEditor.vue'),
)

const content = ref<EditorContent>({
  html: '',
  css: '',
  js: '',
})

const uploadAdapter = createHttpUploadAdapter('/api/cms/uploads')
</script>

<template>
  <CmsContentEditor
    v-model="content"
    locale="zh-TW"
    mode="strict"
    :upload-adapter="uploadAdapter"
  />
</template>
```

`v-model` 使用完整 `{ html, css, js }`，避免 normal mode 的 HTML、CSS、JavaScript 被拆成不同且不同步的表單欄位。

## Component contract

必要 prop：

- `modelValue: EditorContent`

可選 props：

- `locale: 'zh-TW' | 'en-US'`，預設 `zh-TW`
- `mode: 'strict' | 'normal'`，預設 `strict`
- `accessibilityProfile: 'content-quality' | 'tw-aa-110'`
- `uploadAdapter: UploadAdapter`；正式環境應注入永久儲存 adapter。未傳入時，檔案上傳會明確失敗，不會自動產生 `blob:` URL
- `assetBaseUrl: string`，預設 `/cms-editor`
- `licenseKey: string`，demo 預設 `gpl`
- `height: number`，預設 `620`
- `initialWorkspaceMode: 'basic' | 'advanced'`
- `allowedIframeDomains: readonly string[]`；傳入時會取代內建白名單
- `tinymceOptions: Partial<RawEditorOptions>`；補充宿主設定，核心資產、安全、upload 與 setup lifecycle 仍由 component 保護
- `disabled: boolean`：停用 TinyMCE、進階 CodeMirror、模式切換與進階控制項
- `readonly: boolean`：TinyMCE 與 CodeMirror 均不可修改；仍可切換模式、分頁、搜尋及查看預覽

事件：

- `update:modelValue`：內容異動
- `ready`：TinyMCE instance 初始化完成
- `focus` / `blur`：目前一般或進階編輯區的焦點事件；一般模式參數為 TinyMCE instance，進階模式為 `null`
- `dirty`：一般或進階內容進入 dirty 狀態；呼叫 `markClean()` 後送出 `false`

template ref 可呼叫：

- `getContent()`
- `setContent(content)`
- `focus()`，依目前 workspace 聚焦 TinyMCE 或 CodeMirror
- `isDirty()`
- `markClean()`，宿主儲存成功後重設 dirty baseline
- `setWorkspaceMode('basic' | 'advanced')`

`mode`、`licenseKey`、`assetBaseUrl`、upload adapter 與 iframe 白名單視為 instance 初始化設定；若要在執行期間改變，宿主應以不同 `key` 重新建立 editor。`locale` 支援重新建立 TinyMCE 並熱更新進階 CodeMirror 文案。

## 靜態資產

預設 URL：

```text
/cms-editor/langs/zh_TW.js
/cms-editor/tinymce/...
/cms-editor/cms-content/templates.css
/cms-editor/cms-content/formatting.css
```

若後台部署於子路徑或 CDN，可傳入：

```vue
<CmsContentEditor asset-base-url="/admin-assets/cms-editor" />
```

此時 `public/cms-editor` 的內容也必須部署到對應 URL。正式 CMS 前台若要顯示 strict mode 產生的 class，需載入同一版 `cms-content/templates.css` 與 `cms-content/formatting.css`。

## Vite chunk 建議

Editor route 應先使用 `defineAsyncComponent` 或 router lazy import。若後台使用 Vite 8，可再將本專案 [vite.config.ts](../vite.config.ts) 的 `build.rolldownOptions.output.codeSplitting.groups` 合併到後台設定，分離 TinyMCE core、theme、model、icons、plugins 與 CodeMirror。這些 groups 配合 `loadTinyMce.ts` 的「先 core、後動態載入其他模組」順序使用，不應只複製 chunk groups 而保留舊的同步 TinyMCE imports。

不要只提高 `chunkSizeWarningLimit`；那只會隱藏警告，不會改善 route lazy loading、瀏覽器快取或更新時的下載範圍。

## 上傳與安全邊界

- `localPreviewUploadAdapter` 只產生目前瀏覽器工作階段可用的 `blob:` URL，不可儲存成正式內容。
- 可重用 component 不會自行啟用 `localPreviewUploadAdapter`；只有 demo 應明確傳入它。
- 正式後台應注入自己的 `UploadAdapter`，並由後端執行 MIME、檔案內容、權限與容量驗證。
- editor 的 hardening、iframe 白名單與預覽 sandbox 不能取代儲存端 sanitizer、CSP、稽核與發布權限。
- normal mode 允許受信任作者編輯 CSS／JavaScript；正式前台不得直接在主站執行未受信任程式碼。

## 不使用 package 時的更新規則

原始碼同步不會自動更新，因此必須維持一個唯一來源：

1. 本 repository 是 editor canonical source。
2. 後台不得直接修改同步後的 editor 內部；差異一律透過 props、adapter 或 canonical source 修正。
3. 更新時同一個 commit 內同步完整 `src/editor` 與 `public/cms-editor`，不可只挑單一檔案。
4. 後台 commit message 應記錄來源 repository 的 commit id，方便確認目前使用版本。
5. 同步後執行後台自己的 typecheck、test、build 與 editor smoke test。

這套規則保留直接搬原始碼的簡單性，也避免多個後台逐漸產生互不相容的 editor 分支。
