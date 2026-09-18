# admin RichText 整合契約盤點

更新日期：2026-09-18

本文件依據下列專案的目前程式碼整理：

- Editor：`TinyMCE _editor`
- CMS 後台：`NcdrClient_2026/admin`
- CMS 前台：`NcdrClient_2026/client`

它區分「程式碼已證實」、「仍需 API 驗證」與「尚未實作」，避免把 OpenAPI 的寬鬆型別誤認為後端已完整支援。

## 目前接入判定

| 項目 | 狀態 | 判定 |
| --- | --- | --- |
| TinyMCE 核心與 Vue wrapper | 可交接 | `tinymce` 8.9.1、`@tinymce/tinymce-vue` 6.3.0；本專案 typecheck、test、build 已通過 |
| admin RichText HTML 欄位 | 首批已接入 | `ContentBlockNodeEditor` 依 Catalog field key 讀寫既有 `ContentBlockDto.data`，目前只回寫 HTML |
| 保留既有 CSS／JavaScript／未知 data | Editor 端已準備 | data adapter 預設只更新 HTML，不會用空字串覆蓋其他欄位 |
| strict 與台灣 AA 內容檢查 | 首批已接入 | admin 使用 managed policy（strict、`tw-aa-110`）；完整 AA 仍需搭配實際前台版型驗收 |
| normal 與進階 HTML／CSS／JavaScript | 等待宿主契約 | 需後端 round-trip、正式 permission code、欄位級授權與前台 renderer |
| RichText 圖片／影片／iframe 新增 | 暫不可開啟 | admin 現有單一 `fileGuid` asset block 不等於 RichText 多媒體引用契約 |
| CMS 內容範本與特規表格 | 不列入首批 | 可重用 component 預設關閉，待客戶網站設計確認後再由宿主開啟 |
| 整頁 namespace／媒體解析／發布 pipeline | 參考工具 | 已移到 `src/editor/publication.ts` 公開入口，不是 admin 嵌入 editor 的必要依賴 |
| 正式寫入 admin | 首批已完成 | 已替換 RichText textarea，採 lazy load；typecheck、lint、production build 與實際 Drawer smoke test 已通過 |

首批接入只替換 admin `ContentBlockNodeEditor.vue` 原有 RichText textarea，保留 Catalog、`data[fieldKey]`、`update:modelValue`、payload validation 與既有儲存流程。媒體插入、進階工作區、內容範本及特規表格仍維持關閉；這些能力要等各自契約完成後才可由宿主開啟。

訊息模組既有 API 資料可能把整段 HTML 以 entity 編碼（例如 `&lt;p&gt;...`）。admin 僅在 RichText 顯示邊界確認內容為完整的 encoded HTML document 後解碼一次；一般純文字與已是 HTML 的內容不解碼。訊息編輯 Drawer 使用 `min(1120px, 96vw)`，TinyMCE 的 body portal 則由 editor 共用樣式提高層級，避免選單與對話框被宿主 Drawer 遮住。

## 已證實的 admin 現況

### ContentBlock 資料結構

OpenAPI 的 `ContentBlockDto` 為：

```ts
interface ContentBlockDto {
  blockKey?: string | null
  fieldKey?: string | null
  type?: string
  sort?: number | string
  enabled?: boolean
  data?: unknown
  children?: ContentBlockDto[]
  settings?: Record<string, never>
}
```

`data` 是開放 JSON，前端產生 payload 時會 clone 完整 data object，不會依 block type contract 刪除未知欄位。`MessageContentCreateRequest` 與 `MessageContentUpdateRequest` 都直接攜帶 `ContentBlockDto[]`。

因此 admin 前端現有資料管線可以攜帶：

```json
{
  "type": "richtext",
  "data": {
    "html": "<p>內容</p>",
    "css": ".example { font-size: 1rem; }",
    "js": ""
  }
}
```

這只證明前端 payload 不會主動刪除 `css`、`js`，不代表後端資料庫已通過 round-trip 驗證。

Editor 核心入口已提供 `readEditorContentFromBlockData()` 與 `writeEditorContentToBlockData()` 對接此扁平資料。寫回函式預設只更新 Catalog 指定的 HTML 欄位，保留既有 `css`、`js` 與未知欄位；只有 admin 已完成權限判斷且後端能驗證欄位授權時，才傳入 `allowCss` 或 `allowJavaScript`。

### RichText 現有 UI

- `ContentBlockNodeEditor.vue` 對 `richtext` 顯示的是示意 toolbar。
- 實際輸入仍由 block contract 的欄位走通用 `ElInput textarea`。
- RichText 的預設 scalar key 是 `html`。
- 尚未載入 `CmsContentEditor`。
- 尚未把 `data.html`、`data.css`、`data.js` 映射成 `EditorContent`。

### 權限

- admin auth store 已提供 `hasPermission(permissionCode)` 與 wildcard `*`。
- block template 本身已有 `permissionCode`，但它控制模板／操作存取，不等同進階 HTML、CSS、JavaScript 權限。
- 目前沒有在程式碼或 OpenAPI 中找到專屬的進階內容編輯權限碼。
- Editor 的 `advancedWorkspaceEnabled` 只能接收 admin 判斷結果，不能取代後端授權。

### 前台

目前 `NcdrClient_2026/client` 尚未找到 content block／richtext renderer，因此尚未具備以下已驗證能力：

- 輸出 `data.html`。
- 載入 Editor strict mode 的 `formatting.css`。
- 隔離並套用 `data.css`。
- 依安全政策執行 `data.js`。
- 渲染檔案庫的永久媒體 URL。

## 建議固定資料契約

為相容現有 admin 對 `data.html` 的使用方式，RichText 採扁平欄位：

```ts
interface RichTextBlockData {
  html: string
  css: string
  js: string
}
```

規則：

- 三個欄位永遠存在；沒有內容時使用空字串，不使用 `null`。
- 一般工作區只能更新 `html`，必須原樣保留 `css`、`js`。
- 進階工作區一次更新完整 `{ html, css, js }`。
- strict／normal 是站台或模板的格式政策，不由內容作者任意切換。
- 是否看得到進階入口，由 admin 權限結果傳入 `advancedWorkspaceEnabled`。

## 建議的模板設定來源

`BlockTemplateItemDto.meta` 是開放 JSON，而且既有 UI 更新函式會保留未知 meta keys。可在 RichText template item 的 meta 中加入 editor policy：

```json
{
  "editor": {
    "mode": "strict",
    "accessibilityProfile": "tw-aa-110",
    "advancedWorkspace": false,
    "customCss": false,
    "customJavaScript": false,
    "mediaInsertion": "disabled",
    "cmsTemplatesEnabled": false,
    "cmsTableStylesEnabled": false
  },
  "publication": {
    "embeddedStyles": "deny",
    "inlineStyles": "deny",
    "inlineSvg": "deny",
    "formControls": "deny",
    "iframes": "deny",
    "customCss": "deny",
    "customJavaScript": "disabled",
    "externalCssResources": "deny",
    "fixedPositioning": "deny",
    "globalCssSelectors": "deny"
  }
}
```

normal 客戶可改成：

```json
{
  "editor": {
    "mode": "normal",
    "accessibilityProfile": "tw-aa-110",
    "advancedWorkspace": true,
    "customCss": true,
    "customJavaScript": false,
    "mediaInsertion": "disabled",
    "cmsTemplatesEnabled": false,
    "cmsTableStylesEnabled": false
  },
  "publication": {
    "embeddedStyles": "deny",
    "inlineStyles": "allow",
    "inlineSvg": "allow",
    "formControls": "allow",
    "iframes": "deny",
    "customCss": "allow",
    "customJavaScript": "disabled",
    "externalCssResources": "deny",
    "fixedPositioning": "deny",
    "globalCssSelectors": "deny"
  }
}
```

`advancedWorkspace` 表示該模板允許此能力；實際顯示仍必須同時滿足使用者權限：

```ts
const advancedWorkspaceEnabled =
  editorPolicy.advancedWorkspace && auth.hasPermission(advancedEditorPermissionCode)
```

專屬 permission code 尚未存在，必須由後端權限目錄正式定義，不能在 Editor 專案自行命名後視為完成。

`customCss` 與 `customJavaScript` 必須分開授權。允許檢視或修改 HTML 不代表自動允許 JavaScript；未授權欄位必須保留原值，且 JavaScript 關閉時不得在 admin preview 執行。

`editor` 是作者操作能力，`publication` 是內容發布條件。admin 儲存草稿可以保留超出目前作者權限的既有欄位，但發布前必須呼叫同等規則並顯示 blocker；後端必須使用相同或更嚴格的正式政策重新驗證，不能信任前端回傳的 `canPublish`。

## 後端必須確認的行為

### JSON round trip

用測試內容建立或更新 richtext block：

```json
{
  "html": "<p data-round-trip=\"html\">HTML</p>",
  "css": ".round-trip { font-size: 1.125rem; }",
  "js": "window.__cmsRoundTrip = true"
}
```

重新呼叫內容查詢 API，三個欄位必須逐字存在。還要驗證：

- 儲存草稿後讀回。
- 發布後讀回。
- 建立新版本後讀回。
- 從舊版本還原後讀回。
- 一般編輯者只修改 HTML 後，CSS／JavaScript 不變。

### 欄位權限

後端收到沒有進階權限者的完整 PUT 時，必須比較既有資料：

- `css`、`js` 未變：允許一般 HTML 更新。
- `css` 或 `js` 改變：拒絕請求，或由專用 endpoint 處理。
- 不可只依前端隱藏頁籤。

若現有 PUT 不適合欄位級授權，可新增只更新 RichText HTML 的命令；不可用空字串覆蓋進階欄位。

## 前台發布契約

### strict mode

- 渲染已完成儲存端 sanitizer 的 `html`。
- 載入與 Editor 相同版本的 `cms-content/formatting.css`。
- 不依賴 Editor demo 樣式。

### normal／advanced mode

- HTML、CSS、JavaScript 必須以同一內容版本發布。
- CSS 必須決定作用域，避免污染 header、footer、其他內容區塊與後台。
- 同頁所有內容區塊必須合併檢查 ID 與 radio name；不可只根據單一編輯器報告判定可發布。
- 若以命名空間解決衝突，必須同步改寫 HTML IDREF、ARIA、fragment link、SVG reference、CSS selector 與 radio group，並只產生發布副本。
- JavaScript 必須定義信任角色、CSP、外部來源白名單及錯誤隔離。
- Editor 的 sandboxed preview 不代表正式前台執行就是安全的。

在前台契約完成前，admin 可以保存 `html/css/js` 草稿，但不能宣稱進階內容已能正式發布。

### 頁面層發布預檢

admin 不應在每個 editor 各自通過後就直接發布。它必須將同頁所有 RichText 區塊送入 `evaluatePageContentForPublication()` 的等效後端規則，並保存穩定且唯一的 `blockKey`。

- `deny` 適用於直接渲染且不做轉換的網站。
- `namespace` 適用於後端已實作對應轉換的網站；前端預檢通過不代表轉換已執行。
- `isolated-document` 適用於區塊確實以獨立 iframe document 發布的網站；宿主必須將 `requiresIsolatedDocuments` 當成 renderer 必要條件。

發布 API 不得接收瀏覽器回傳的 `canPublish=true` 就略過驗證；後端必須重新計算單區塊與頁面層規則。

若使用 `namespace` 策略，後端應在不可變的內容版本上執行 `preparePageContentForPublication()` 的等效流程，並在轉換後再檢查一次全頁 ID 與 radio name。任何轉換失敗或殘留衝突都必須使整次發布中止，不可發布已轉換與未轉換的混合結果。

## CSP、弱掃與滲透測試契約

### admin 主頁與 TinyMCE

- CSP 必須由伺服器以 HTTP response header 發送；不得只依賴 HTML `<meta>`。
- TinyMCE 為自託管，`script-src` 不需開放 Tiny Cloud 網域。
- [TinyMCE 官方 CSP 文件](https://www.tiny.cloud/docs/tinymce/latest/tinymce-and-csp/)目前仍要求 `style-src 'unsafe-inline'` 才能呈現完整 UI 與內容格式，並明確表示尚不支援完全移除 `unsafe-inline` 的 strict CSP。這是第三方元件限制，必須列入弱掃例外、風險接受與升級追蹤，不能誤報為已修正。
- `script-src` 不得加入 `'unsafe-inline'` 或 `'unsafe-eval'`；Vue／Editor 程式碼與 TinyMCE scripts 應由同源靜態檔載入。
- admin 頁面至少應評估 `object-src 'none'`、`base-uri 'self'`、`frame-ancestors`、`form-action 'self'`，並由部署層設定 `X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy` 與 HSTS。
- Editor 的 TinyMCE content iframe 另有自己的 CSP；它會禁止 script、object、base、form action 與網路連線，但因 TinyMCE inline 格式及 `content_style`，其 `style-src` 仍需 `'unsafe-inline'`。

### advanced 預覽

- 預覽 iframe 固定使用 `sandbox="allow-scripts"`，不得加入 `allow-same-origin`、`allow-forms`、`allow-popups` 或 top-navigation 權限。
- 預覽文件的 style 與 script 使用每次重建都重新產生的 nonce，不使用 `'unsafe-inline'`。
- HTML 分頁中的 `<script>`、event attributes、`srcdoc`、`nonce`、object/embed 等內容不直接進入預覽；inline style 只在預覽文件內轉成產生的 class。
- 預覽 CSP 維持 `connect-src 'none'`、`object-src 'none'`、`base-uri 'none'` 與 `form-action 'none'`。
- iframe 與 `postMessage` 接收端必須同時核對 `event.source` 及本次 editor instance 的 message id。

### 正式前台執行 advanced 內容

- 不得把 `data.js` 串成主頁 inline script，也不得為此在主站 CSP 加入 `'unsafe-inline'` 或 `'unsafe-eval'`。
- 若客戶確實啟用 JavaScript，內容必須在獨立 origin 的 sandboxed iframe 執行；該 origin 不得共享主站 cookie、localStorage、登入 token 或管理 API 權限。
- 含 JavaScript 的區塊不可由發布器猜測並改寫 ID 字串參照；應使用獨立 iframe 的 document scope，或在內容進入系統前建立可驗證的元件 schema。
- 發布服務應產生不可變版本資產，使用 response-header CSP、嚴格來源 allowlist、稽核紀錄、版本回復與緊急停用機制。
- 後端必須先做 HTML allowlist sanitization、URL protocol／domain 驗證及欄位級權限檢查；TinyMCE parser 與前端預覽 sanitizer 不能取代儲存端安全控制。
- CSS 必須限制在內容容器或隔離 iframe，避免覆蓋主站登入介面、同意視窗或安全提示。
- 弱掃需分開掃描 admin shell、TinyMCE content iframe、advanced preview 與正式發布 renderer；掃描報告中的第三方限制、可修正問題與已接受風險不可混為同一項。

## 媒體契約

圖片／檔案 block 已使用 `fileGuid` 與檔案庫；RichText 可重用同一套檔案生命週期，但因一段 HTML 可同時引用多個檔案，仍需獨立的 manifest 與差異比對，不能只沿用單一 `fileGuid` 欄位。

Editor 端已實作：

- Upload result 支援成對的 `fileGuid` 與 `fileState: temporary | active`。
- 新上傳媒體會在 HTML 保留檔案識別與當時 URL；直接改掉 URL 會移除錯置的舊識別。
- `extractMediaReferenceManifest()` 產生 HTML 內所有媒體引用與唯一 `fileGuid` 集合。
- `diffMediaReferenceManifests()` 產生 added、removed、retained 與 temporary GUID。
- 發布預檢會阻擋 `blob:`、temporary、未知 managed state、admin URL 與 invalid URL。

後端儲存必須在同一交易或可補償 workflow 中：

1. 重新從提交的 HTML 擷取 manifest，不信任前端回傳的 delta。
2. 檢查每個 `fileGuid` 存在、檔案類型符合、使用者有權引用，且 temporary 檔案屬於本次編輯會話或內容。
3. 儲存內容版本與引用 manifest，建立 added reference，並將可用的 temporary 檔案轉為 active。
4. 只在新版本可回讀後解除 removed reference；檔案仍被其他內容引用時不得刪除實體。
5. 回傳正規化後的 HTML，使 temporary state 與 URL 不會長期留在 admin working copy。

正式發布時必須以 `fileGuid` 重新解析永久公開 URL，不得相信 HTML 原有 `src`。Editor 模組已提供 `resolveManagedMediaReferences()` 作為對等規則參考；缺少任一 GUID 解析、解析成 admin／temp／blob URL、同 GUID 出現衝突 URL，或無法安全表示多候選 `srcset` 時必須中止整次轉換。公開讀取端點不可要求 admin token，並需確認圖片 MIME、影片 Range Requests、poster、字幕與可能的轉檔規則。

後端應以 `prepareResolvedPageContentForPublication()` 的等效順序處理整頁：先在同一檔案快照解析所有 `fileGuid`，再執行內容與頁面 policy，最後產生 namespace 副本或交給 isolated renderer。不可先轉換一部分區塊後再逐個發布。

在後端完成上述交易、回讀與公開 URL 解析前，RichText 仍應使用 `mediaInsertion="disabled"`。

## 實際導入前驗收門檻

1. 後端完成 `{ html, css, js }` API round-trip 測試。
2. 正式定義進階編輯 permission code 與後端欄位授權。
3. admin 可寫入 RichText HTML，且一般儲存不覆蓋 CSS／JavaScript。
4. strict 與 normal 各完成一份舊內容 round-trip 測試樣本。
5. 前台完成 strict formatting CSS 載入。
6. 若要發布 advanced 內容，前台完成 CSS scope 與 JavaScript 執行政策。
7. 後端完成 RichText manifest 重算、引用交易、Temp → Active、解除引用與公開 URL 解析前，維持關閉新增媒體。
