# Vue 3 後台整合

本 editor 採原始碼模組同步，不發布公有或私有 npm package。`src/editor` 是唯一可重用程式邊界；`src/App.vue`、`src/main.ts` 與 `src/style.css` 只屬於 demo，不應搬入後台。

## 需要同步的目錄

將下列兩個目錄以 UTF-8 原樣複製到 Vue 3 後台：

```text
src/editor/               -> admin/src/features/cms-editor/
public/cms-editor/        -> admin/public/cms-editor/
```

不要只複製 `CmsContentEditor.vue`。TinyMCE 客製工具、CodeMirror、i18n、upload 型別與 CMS formatting token 都位於同一個 `src/editor` 邊界內。

`tests/editor` 留在此專案作為交接回歸測試，不隨 `src/editor` 搬入 admin；後台只需為自己的接點與儲存流程補整合測試。

## 宿主相依套件

後台需安裝 editor 使用的 runtime dependencies；Vue 3 若已存在，不需重複安裝。對目前 `NcdrClient_2026/admin` 的 `package.json`，尚缺的是：

```powershell
pnpm add tinymce@8.9.1 @tinymce/tinymce-vue@6.3.0 `
  @codemirror/commands@6.10.4 @codemirror/lang-css@6.3.1 `
  @codemirror/lang-html@6.4.12 @codemirror/lang-javascript@6.2.5 `
  @codemirror/language@6.12.4 @codemirror/search@6.7.1
```

admin 已有 Vue、`vue-i18n`、CodeMirror core／lint／state／view 與 Prettier，不應為了 editor 重複加入或任意升級。`vue-i18n` 必須存在於宿主 Vue app；editor 使用 local-scope messages，不會要求宿主把 editor 文案合併到既有 messages。

## 公開入口

- `src/editor/index.ts`／`src/editor/core.ts`：穩定的 editor、policy、upload 與 ContentBlock data adapter；這是後台首批接入邊界。
- `src/editor/publication.ts`：CSS scope、媒體永久 URL、跨區塊 ID 與整頁發布準備工具；只有正式 renderer 已採用對等規則時才引入，不是嵌入 editor 的必要依賴。

## 基本使用

建議由後台 route 或實際需要 editor 的頁面延遲載入：

```vue
<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import {
  editorPolicyPresets,
  readEditorContentFromBlockData,
  writeEditorContentToBlockData,
} from '@/features/cms-editor'

const CmsContentEditor = defineAsyncComponent(
  () => import('@/features/cms-editor/CmsContentEditor.vue'),
)

const blockData = ref<Record<string, unknown>>({
  html: '<p>內容</p>',
  css: '.legacy { font-size: 1rem; }',
  js: 'legacy()',
  futureField: true,
})

// 實際值應由 admin 權限與網站／模板政策提供，不能由 editor 猜測。
const canEditCss = false
const canEditJavaScript = false
const editorPolicy = editorPolicyPresets.managed

const content = computed({
  get: () => readEditorContentFromBlockData(blockData.value, 'html'),
  set: (value) => {
    blockData.value = writeEditorContentToBlockData(blockData.value, value, {
      htmlFieldKey: 'html',
      allowCss: canEditCss,
      allowJavaScript: canEditJavaScript,
    })
  },
})
</script>

<template>
  <CmsContentEditor
    v-model="content"
    locale="zh-TW"
    :editor-policy="editorPolicy"
  />
</template>
```

`v-model` 使用完整 `{ html, css, js }`。`writeEditorContentToBlockData()` 預設只更新 HTML，保留原有 CSS、JavaScript 與其他未知欄位；宿主只有在後端已提供對應欄位授權時，才可把 `allowCss` 或 `allowJavaScript` 設為 `true`。`htmlFieldKey` 應取自 Catalog contract，admin 現有 RichText 預設為 `html`。

## Component contract

必要 prop：

- `modelValue: EditorContent`

可選 props：

- `locale: 'zh-TW' | 'en-US'`，預設 `zh-TW`
- `mode: 'strict' | 'normal'`，預設 `strict`
- `accessibilityProfile: 'content-quality' | 'tw-aa-110'`，預設 `tw-aa-110`
- `editorPolicy: Partial<EditorPolicy>`；集中設定 mode、AA profile、進階工作區、CSS／JavaScript 分頁、媒體、範本與表格能力。Policy 中明確傳入的欄位優先於同名舊 props，未傳入欄位仍沿用舊 props，方便漸進遷移
- `uploadAdapter: UploadAdapter`；正式環境應注入永久儲存 adapter。未傳入時，檔案上傳會明確失敗，不會自動產生 `blob:` URL
- `assetBaseUrl: string`，預設 `/cms-editor`
- `licenseKey: string`，demo 預設 `gpl`
- `height: number`，預設 `620`
- `initialWorkspaceMode: 'basic' | 'advanced'`
- `advancedWorkspaceEnabled: boolean`，預設 `false`；只控制 normal mode 是否顯示及允許進入進階工作區。宿主應傳入 admin 已完成的權限判斷結果，後端仍須獨立驗證 `css`／`js` 修改權限
- `customCssEnabled: boolean`，預設 `false`；控制進階工作區是否顯示 CSS 分頁。關閉時既有 CSS 仍會保存並套用預覽，不會因一般 HTML 編輯而清空
- `customJavaScriptEnabled: boolean`，預設 `false`；控制進階工作區是否顯示 JavaScript 分頁及是否在 sandboxed preview 執行 JavaScript。關閉時既有 JavaScript 仍保存，但不會在預覽執行
- `cmsTemplatesEnabled: boolean`，預設 `false`；控制是否註冊及顯示 CMS 內容範本工具
- `cmsTableStylesEnabled: boolean`，預設 `false`；控制是否註冊及顯示 CMS 特規表格樣式，TinyMCE 基本表格功能不受影響
- `allowedIframeDomains: readonly string[]`；傳入時會取代內建白名單
- `mediaInsertion: 'enabled' | 'disabled'`，預設 `disabled`。設為 `disabled` 時不啟用 image／media plugin、不註冊圖片、影片與 iframe 插入工具、不提供內嵌媒體 upload handler，且會從宿主傳入的 plugin、toolbar 與 context menu 設定再次移除相關項目；既有 HTML 內的媒體節點仍會經 editor schema 與 iframe 白名單處理，不會因關閉插入工具而主動刪除
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
- `getCapabilityReport()`：分析目前 HTML／CSS／JavaScript 使用到的內容能力，不修改內容
- `getMediaReferenceManifest()`：回傳 RichText 內嵌媒體的 URL、`fileGuid`、生命週期狀態與不可發布來源
- `getPublicationReport(policy)`：依宿主傳入的 `PublicationPolicy` 回傳 `canPublish`、violations 與是否需要 sandboxed JavaScript；這是前端預檢，不取代後端驗證
- `setContent(content)`
- `focus()`，依目前 workspace 聚焦 TinyMCE 或 CodeMirror
- `isDirty()`
- `markClean()`，宿主儲存成功後重設 dirty baseline
- `setWorkspaceMode('basic' | 'advanced')`

`mode`、`licenseKey`、`assetBaseUrl`、`editorPolicy`、`advancedWorkspaceEnabled`、`customCssEnabled`、`customJavaScriptEnabled`、`cmsTemplatesEnabled`、`cmsTableStylesEnabled`、`mediaInsertion`、upload adapter 與 iframe 白名單視為 instance 初始化設定；若要在執行期間改變，宿主應以不同 `key` 重新建立 editor。`locale` 支援重新建立 TinyMCE 並熱更新進階 CodeMirror 文案。

`advancedWorkspaceEnabled` 是 UI 能力開關，不是授權邊界。設為 `false` 時，一般工作區仍保留並套用既有 CSS，也不會清空 `css`／`js`；admin 後端必須拒絕未授權使用者修改進階欄位。

模組提供兩個可覆寫的起始 preset：

- `editorPolicyPresets.managed`：strict、台灣 AA profile、停用進階工作區、媒體與站台特規工具。
- `editorPolicyPresets.flexibleContent`：normal、台灣 AA profile、啟用 HTML／CSS、停用 JavaScript、媒體與站台特規工具。

Preset 只是起始設定，不代表所有客戶共用同一政策。宿主應以網站／模板能力加上使用者權限產生最後的 `editorPolicy`；後端仍是欄位授權與發布安全邊界。

## 內容能力與發布預檢

`EditorPolicy` 控制作者目前可使用的編輯能力；`PublicationPolicy` 則判斷既有內容是否符合該網站的發布條件。兩者不能合併成單一開關，因為未授權作者仍可能開啟含有舊 CSS／JavaScript 的內容，而系統必須保存它，不能靜默清空。

```ts
import {
  evaluateContentForPublication,
  publicationPolicyPresets,
} from '@/features/cms-editor/publication'

const report = evaluateContentForPublication(
  content.value,
  publicationPolicyPresets.flexibleContent,
)

if (!report.canPublish) {
  // 將 report.violations 對應成 admin 的在地化訊息並阻擋發布。
}
```

目前能力分析涵蓋：embedded／inline style、SVG、表單控制項、iframe、script、event attributes、危險 active URL、object/embed、CSS `@import`／`url()`、media query、keyframes、fixed positioning、自訂 CSS／JavaScript、片段內 duplicate ID，以及 RichText 媒體引用 manifest。

所有 HTML 中的 `<script>`、`on*` event attribute、危險 active URL 與 object/embed 都會形成發布 blocker。JavaScript 必須保存在獨立 `js` 欄位，且只有 policy 設為 `sandboxed` 時才會回報需要隔離式發布。這個分析器不是 sanitizer，也不會取代 CSS parser、後端 allowlist 或整站弱掃。

### CSS selector scope

模組另提供使用 CodeMirror CSS grammar 的 `analyzeCss()` 與 `scopeCss()`：

```ts
import { scopeCss } from '@/features/cms-editor/publication'

const result = scopeCss(
  content.value.css,
  '.cms-content[data-content-id="content-123"]',
)

if (!result.scoped) {
  // invalid-css、invalid-scope-selector 或 global-selector 必須先處理。
}
```

此轉換會逐一 scope selector list，包含 `@media` 等 at-rule 內的規則；不會錯把 `:is(.a, .b)` 內的逗號拆成兩條 selector，也不會改寫 `@keyframes`。CSS nesting 會保留在已 scope 的外層規則下。

遇到無效 CSS 或 `html`、`body`、`:root` 等全域 selector 時會原樣回傳並標記失敗，不會猜測客戶原意。`@import`、`url()`、fixed positioning 是否能發布仍由 `PublicationPolicy` 決定。正式發布服務必須在後端執行等效或更嚴格的轉換，不能只信任瀏覽器端產物。

### 同頁多內容區塊的 ID 與 radio 衝突

單一編輯器的內容沒有 duplicate ID，不代表多個區塊合併到同一頁後仍然安全。宿主應在頁面發布前以 `findContentIdentifierCollisions()` 檢查跨區塊的 `id` 與 radio `name`：

```ts
import {
  findContentIdentifierCollisions,
  namespaceContentIdentifiers,
} from '@/features/cms-editor/publication'

const collisions = findContentIdentifierCollisions(pageBlocks)

const publishedBlocks = pageBlocks.map(({ blockKey, content }) => {
  const result = namespaceContentIdentifiers(content, `block-${blockKey}`)
  if (!result.transformed) {
    throw new Error(`內容區塊 ${blockKey} 無法安全加入命名空間`)
  }
  return { blockKey, content: result.content }
})
```

`namespaceContentIdentifiers()` 會在發布副本中同步改寫 ID、label `for`、ARIA IDREF(S)、fragment link、SVG `url(#id)`、CSS ID selector 與 radio group name。它不會修改儲存的作者原文，也不能取代後端發布轉換。

若內容含自訂 JavaScript、HTML `<script>` / `on*` event attribute、片段內 duplicate ID、無效 ID，或無法解析的 CSS，轉換會 fail closed 並原樣回傳內容。原因是 JavaScript 可能以字串、selector 或第三方套件參照 ID，無法在不執行程式的情況下保證改寫完整。這類內容應改用每區塊獨立的 sandboxed iframe，或由作者先消除模糊參照。

admin 的頁面發布動作可改用單一入口 `evaluatePageContentForPublication()`，同時取得每個區塊的報告與跨區塊結果：

```ts
import {
  evaluatePageContentForPublication,
  publicationPolicyPresets,
} from '@/features/cms-editor/publication'

const pageReport = evaluatePageContentForPublication(pageBlocks, {
  content: publicationPolicyPresets.flexibleContent,
  identifierCollisions: 'namespace',
})

if (!pageReport.canPublish) {
  // 同時顯示 blocks[].evaluation.violations 與 pageReport.violations。
}
```

`identifierCollisions` 需依網站的正式 renderer 選擇：

- `deny`：同一頁出現重複 ID 或 radio name 就阻擋發布。
- `namespace`：只有當所有受影響區塊都能安全命名空間化時通過；發布器仍必須實際呼叫 `namespaceContentIdentifiers()` 產生發布副本。
- `isolated-document`：只適用於正式 renderer 會將每個區塊放入獨立 document 的客戶；報告的 `requiresIsolatedDocuments` 會固定為 `true`，不能降級成主頁直接渲染。

重複 `blockKey` 會無條件阻擋發布，因為它會使稽核記錄、錯誤定位及命名空間識別變得不明確。頁面預檢仍是純分析，不會改寫任何區塊。

當後端 renderer 已實作對等規則時，前端可以 `preparePageContentForPublication()` 驗證並產生一次性發布副本：

```ts
import { preparePageContentForPublication } from '@/features/cms-editor/publication'

const prepared = preparePageContentForPublication(pageBlocks, pagePolicy)
if (!prepared.ready) {
  // 不可送出 prepared.blocks；顯示 evaluation 與 failures。
  return
}

if (prepared.renderMode === 'isolated-document') {
  // 只能送到獨立 document renderer。
} else {
  // prepared.blocks 是可供同 document renderer 處理的副本。
}
```

namespace 轉換後會再做一次跨區塊衝突檢查。例如 `panel` 改為 `block-a-panel` 後，仍可能與另一個未轉換區塊原有的 `block-a-panel` 衝突；此時整批準備會失敗、撤回轉換結果，並以 `residual-identifier-collision` 回報。

`preparePageContentForPublication()` 仍不是正式 renderer：`isolated-document` 只會回傳必要的 render mode，不會在此模組內產生 iframe、CSP header 或可部署資產。

內容模組首次接入且後端尚未提供 RichText 內嵌資產引用契約時，應固定使用 strict mode 並停用媒體插入：

```vue
<CmsContentEditor
  v-model="content"
  mode="strict"
  media-insertion="disabled"
/>
```

這是避免內容人員透過工具列建立新的暫存媒體 URL，不是儲存端安全邊界。宿主仍須在送出前及後端儲存／發布時驗證 HTML。

### RichText 媒體與檔案庫

正式 upload adapter 可回傳檔案庫識別資料：

```ts
interface UploadResult {
  src: string
  fileGuid?: string
  fileState?: 'temporary' | 'active'
}
```

`fileGuid` 與 `fileState` 必須同時出現；只回傳其中一個會當成 `invalidResponse`。Editor 會將新上傳的識別資料寫入媒體節點的 `data-cms-file-guid`、`data-cms-file-state` 與 `data-cms-file-source`。使用者後來直接改掉 `src` 時，舊的檔案識別資料會移除，避免 URL 與 `fileGuid` 錯置。

```ts
import {
  diffMediaReferenceManifests,
  extractMediaReferenceManifest,
} from '@/features/cms-editor/publication'

const previousManifest = extractMediaReferenceManifest(savedContent)
const nextManifest = extractMediaReferenceManifest(editorContent)
const referenceDelta = diffMediaReferenceManifests(previousManifest, nextManifest)
```

manifest 會將媒體分成 active、temporary、unknown managed state、unmanaged、preview-only `blob:`、admin-only、embedded data 及 invalid。`blob:`、temporary、未知 managed state、admin URL 與 invalid URL 在所有發布 preset 都是 blocker；unmanaged 與 data URL 是否允許則由客戶 `PublicationPolicy` 決定。`srcset` 會拆成每一個 candidate URL；多 candidate 不會錯誤共用單一 `fileGuid`，需後端衍生圖 manifest 或依 unmanaged media 政策處理。

`diffMediaReferenceManifests()` 產生 added、removed、retained 與 temporary `fileGuid`，供後端在同一儲存交易內建立引用、Temp → Active 與解除引用。前端計算結果只供顯示與預檢，後端不得直接信任它。

後端將檔案轉為 active 並取得公開 URL 後，可以等效的 `resolveManagedMediaReferences()` 建立正規化內容副本：

```ts
import { resolveManagedMediaReferences } from '@/features/cms-editor/publication'

const resolved = resolveManagedMediaReferences(content, [
  { fileGuid: '7f5d...', publicUrl: 'https://cdn.example.com/image.jpg' },
])

if (!resolved.resolved) {
  // 缺少解析、非公開 URL、舊 URL 與 GUID 錯置或 managed srcset 都必須中止。
}
```

轉換只接受 HTTP(S) 且不是 admin／temp path 的公開 URL，成功後同步將 state 改為 active。任何一個 `fileGuid` 缺少結果時會原樣回傳內容，不會輸出部分解析副本。多 candidate managed `srcset` 目前也 fail closed，必須由檔案庫提供每個衍生圖的結構化對應。

整頁正式發布建議使用組合入口，固定執行「媒體永久 URL 解析 → 單區塊與整頁政策 → ID namespace／render mode」：

```ts
import { prepareResolvedPageContentForPublication } from '@/features/cms-editor/publication'

const result = prepareResolvedPageContentForPublication(
  pageBlocks,
  pagePolicy,
  fileLibraryResolutions,
)

if (!result.ready) {
  // media.blockFailures 或 publication.evaluation / failures 會指出中止階段。
  return
}

publish(result.blocks, result.publication?.renderMode)
```

此流程以整頁為原子單位。任一區塊的檔案解析失敗時，不會進入後續 namespace，也不會輸出部分已解析的頁面。正式後端必須以同一內容版本與檔案快照執行對等流程。

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
