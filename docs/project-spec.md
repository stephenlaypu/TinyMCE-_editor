# Project Specification

## 專案概覽

- 專案名稱：TinyMCE editor workspace
- Runtime：Vue 3
- Editor：TinyMCE 8
- Code editor：CodeMirror 6
- Code formatter：Prettier 3 browser standalone
- 語言：TypeScript
- Build tool：Vite
- Package manager：pnpm
- 型態：demo 工作區加上可直接搬入其他 Vue 3 後台的原始碼模組，不發布 npm package
- TinyMCE 使用自託管資源，不使用 Tiny Cloud API Key
- demo 預設以 `license-key="gpl"` 運作；整合後可透過 `license-key` prop 注入 GPL 或商用 self-hosted license

## Scripts

- `pnpm dev`：啟動 Vite dev server
- `pnpm generate:cms-css`：由 CMS formatting token 產生前台共用 CSS
- `pnpm typecheck`：執行 `vue-tsc -b`
- `pnpm build`：先產生 CMS formatting CSS，再執行 `vue-tsc -b && vite build`
- `pnpm preview`：啟動 Vite preview

Vite port：

- dev：`5180`
- preview：`4180`
- `strictPort: true`

## 主要檔案

- `src/App.vue`：demo shell，只負責範例內容、語系切換與環境變數轉接
- `src/editor/CmsContentEditor.vue`：可重用 editor 入口、TinyMCE init、工作區狀態與公開 API
- `src/editor/index.ts`：供其他 Vue 3 後台引用的元件、型別與 upload helper 匯出
- `src/editor/components/TinyMceEditor.vue`：`@tinymce/tinymce-vue` wrapper
- `src/editor/components/AdvancedContentEditor.vue`：normal mode 的 CodeMirror 6 HTML / CSS / JavaScript 編輯與隔離預覽
- `src/editor/types/editorContent.ts`：一般與進階工作區共用的 `{ html, css, js }` 資料模型
- `src/editor/tinymce/*`：TinyMCE 客製化註冊、CMS formatter 與內容正規化
- `src/editor/accessibility/*`：accessibility issue 檢查規則與 contrast 計算
- `src/editor/uploads/*`：上傳 policy、adapter、共用型別
- `src/editor/i18n.ts`：editor 內建 zh-TW / en-US 文案
- `src/i18n.ts`：只供 demo app 使用的 vue-i18n instance
- `src/editor/styles/editor.css`：editor、TinyMCE UI 覆寫與 a11y dialog 樣式
- `src/style.css`：僅供 demo shell 使用的頁面樣式
- `public/cms-editor/langs/zh_TW.js`：TinyMCE zh-TW 語言包
- `public/cms-editor/tinymce/*`：TinyMCE iframe content 與 help i18n assets
- `public/cms-editor/cms-content/templates.css`：CMS 內容範本樣式入口
- `public/cms-editor/cms-content/formatting.css`：由 token 產生、供 editor 與 CMS 前台共用的格式 class

## TinyMCE 設定

主要設定位於 `src/editor/CmsContentEditor.vue` 的 `editorConfig`。demo 的環境變數只在 `src/App.vue` 轉換成 component props；可重用模組本身不直接讀取 `import.meta.env`。

部署模式由 `VITE_EDITOR_MODE` 決定：

- `strict`：預設值；已管理的字體、字級、對齊、清單樣式、顏色與表格樣式使用 CMS class，色票限制為 AA 安全組合。
- `normal`：提供一般／進階工作區。一般工作區使用 TinyMCE 原生格式設定與色票，不套用 strict mode 的 class 正規化；進階工作區使用 CodeMirror 6 編輯 HTML、CSS、JavaScript。CMS 範本、媒體與可及性工具仍保留在一般工作區。

strict mode 的 Editor 輸出會做基本 HTML hardening，再進行 CMS class 正規化。normal mode 不執行 component 層的 destructive hardening，以保留受信任作者輸入的 HTML；TinyMCE parser 仍可能在使用者實際套用一般模式編輯時正規化 markup。兩種模式都不能取代儲存端 / 前台 sanitizer，normal mode 尤其需要由 CMS 權限與發布環境界定可信內容。

核心設定：

- `height: 620`
- `base_url` 預設為 `/cms-editor/tinymce`，可由 `asset-base-url` prop 改為後台子路徑或 CDN 根目錄
- `menubar: false`
- `toolbar_mode: 'wrap'`
- `skin: false`
- `promotion: false`
- `branding: false`
- `automatic_uploads: true`
- `resize_img_proportional: true`
- `object_resizing: 'img,table,figure.image,div,video,iframe,span.mce-preview-object'`
- `table_class_list` / `table_row_class_list` / `table_cell_class_list`：提供 `mce-no-match` 選項「保留既有樣式」，避免 Table / Row / Cell Properties 在未明確修改 class 時覆寫既有多 class

啟用 plugins：

- `advlist`
- `autolink`
- `charmap`
- `code`
- `fullscreen`
- `help`
- `image`
- `link`
- `lists`
- `media`
- `preview`
- `searchreplace`
- `table`
- `visualblocks`
- `wordcount`

Toolbar：

```text
undo redo | bold italic strikethrough | blocks fontfamily fontsize | alignleft aligncenter alignright alignjustify | bullist numlist blockquote | forecolor backcolor | link image insertvideo embediframe table cmstablestyles cmstemplates | a11ycheck | code preview fullscreen
```

自訂 toolbar button：

- `insertvideo`
- `embediframe`
- `cmstablestyles`
- `cmstemplates`
- `a11ycheck`

## Normal mode 進階工作區

可重用 component 只有在 `mode="normal"` 時顯示「一般／進階」切換；demo 才使用 `VITE_EDITOR_MODE` 決定傳入值。進階元件使用 dynamic import，在使用者切換前不載入 CodeMirror chunk。

TinyMCE core 會先初始化，再以 dynamic import 載入 icons、theme、DOM model 與 plugins，避免第三方 UMD modules 在 core 建立 `window.tinymce` 前執行。demo 的整個 `CmsContentEditor` 也使用 async component，宿主後台應在 editor route 採用相同 lazy-loading 邊界。

共用資料模型：

```ts
interface EditorContent {
  html: string
  css: string
  js: string
}
```

- `content` 是 `{ html, css, js }` 的正式資料；一般工作區另使用 `basicHtml` 作為 TinyMCE working copy，避免只切換模式就讓 TinyMCE parser 覆寫正式 HTML。
- 進階切回一般時，TinyMCE 以目前 HTML 建立 working copy；CSS 會注入 TinyMCE iframe 的 `<head>` 供視覺編輯，JavaScript 不會在 TinyMCE 執行。
- 一般工作區有進階內容時顯示提示，可直接前往 CSS 分頁，亦可暫停或重新啟用 CSS 顯示。
- 若一般工作區沒有實際編輯，切回進階時保留正式 HTML 原文，不採用 TinyMCE 的序列化結果。
- 若一般工作區已編輯，切回進階時才以 TinyMCE `getContent()` 更新正式 HTML。偵測到 parser round-trip 差異時會先確認；確認套用才更新，取消則保留原 HTML 並切換。
- normal mode 接受舊內容中的 `<style>`。進入一般工作區時會把它從 working copy 暫時抽出並與 CSS 欄位一起顯示；套用一般模式編輯時，舊 `<style>` 會遷移到 `css` 欄位。
- normal mode 明確啟用 TinyMCE 的 SVG schema，讓一般工作區保留並顯示安全的 inline SVG。SVG 仍經 TinyMCE 內建 sanitizer，`script`、`foreignObject` 等不安全 SVG 內容不予保留。
- `<script>` 不會進入 TinyMCE；互動程式只保存在 `js` 欄位及進階預覽中執行。
- 載入範例與清空內容會同時重設 HTML、CSS、JavaScript。
- HTML、CSS、JavaScript 使用單一 CodeMirror view 與 Tab 切換，不同時建立三個可見 editor。
- CodeMirror 提供基本行號、各 Tab 獨立的 undo / redo、搜尋、括號配對、自動縮排與對應語言 highlighting；toolbar 提供復原、重做與搜尋入口。
- HTML、CSS、JavaScript parser 明確產生的 error node 會轉為 CodeMirror lint diagnostic，顯示內容 marker、gutter marker 與各 Tab 錯誤數；不執行 ESLint、Stylelint 或程式碼風格規則。
- 一般／進階模式列放在 editor card 內，使用中性色與邊框表示目前模式，不綁定特定後台品牌色。
- 一般／進階模式列與進階 toolbar 採接近 TinyMCE Oxide 的淺灰 toolbar、緊湊圓角按鈕、淡藍 selected / focus 狀態。
- 進階工作區桌面高度預設為 `620px`，可由 component `height` prop 調整；CodeMirror 與 preview 各自在區塊內捲動，不依內容長度增加頁面高度。窄螢幕改成上下排列。
- 桌面預設寬度比例為程式碼 `45%`、preview `55%`。中間 splitter 可用 pointer 拖曳、方向鍵微調，或用 `Home` / `End` 移至目前可用最小／最大比例；ARIA min、max 與 value text 依實際寬度更新。程式碼最小寬度 `320px`、preview 最小寬度 `400px`。
- Splitter 使用 pointer capture，拖曳期間以透明 overlay 隔離 preview iframe，避免游標跨入 iframe 後遺失事件。寬度更新以 animation frame 合併；CodeMirror 不啟用自動折行，改用水平捲動，避免拖曳時因大量重新排版造成卡頓。
- 程式碼區可收合；重新展開時沿用收合前比例，內容與目前 Tab 不變。
- 進階 toolbar 提供網頁內全螢幕。全螢幕以固定定位覆蓋 viewport、鎖定外層頁面捲動，可用同一按鈕或 `Escape` 離開；CodeMirror、preview、splitter 與目前資料不會重建或重設。
- 「格式化」只處理目前 Tab，也支援 `Shift + Alt + F`。Prettier 與對應 HTML / PostCSS / Babel / Estree plugin 於第一次格式化時 dynamic import；格式化失敗不改寫內容並顯示錯誤。若 dynamic import 或格式化期間切換 Tab、修改內容或替換 editor state，過期結果會被丟棄；程式碼區收合時停用格式化。
- HTML / CSS / JavaScript Tab 支援左右方向鍵循環與 `Home` / `End`；進階 toolbar 支援方向鍵循環與 `Home` / `End`，並跳過 disabled 按鈕。
- `readonly` 同時鎖定 TinyMCE 與 CodeMirror 的內容修改，但保留模式／分頁切換、搜尋與預覽；`disabled` 會再停用模式切換、進階 toolbar 與 splitter。
- 一般與進階工作區都會向宿主送出 `dirty`、`focus`、`blur`；公開 `focus()` 依目前工作區聚焦 TinyMCE 或 CodeMirror。
- 進階工作區的 layout 與操作樣式集中在 `AdvancedContentEditor.vue` scoped style，並以 CSS variables 保留後台覆寫入口。

即時預覽：

- 編輯停止 `400ms` 後重建 iframe `srcdoc`，也可手動重新執行。
- iframe 使用 `sandbox="allow-scripts"`，不使用 `allow-same-origin`。
- HTML 分頁內的 `script` 與既有 blocked element 不進入預覽；事件 attribute 與不安全 protocol 也會從預覽副本移除，原始編輯資料不會因此被改寫。
- HTML 內嵌 `<style>` 會從預覽 body 移除，但其 CSS 會與 CSS 分頁內容合併後注入預覽文件；JavaScript 只從 JavaScript 分頁注入。
- 預覽 CSP 禁止網路連線，允許 HTTPS / data / blob 圖片與媒體，以及 HTTPS iframe。
- JavaScript runtime error 與未處理 Promise rejection 會以固定 preview source 名稱回報訊息、行號與欄位並顯示在預覽區下方；有位置時可點擊錯誤切換至 JavaScript Tab、展開程式碼區並定位。

此 iframe 是 editor 端預覽隔離，不等同正式發布環境的完整不受信任程式碼沙箱。正式 CMS 若要執行使用者 JavaScript，仍需設計權限、儲存端驗證、發布隔離、CSP、稽核與版本回復。

## CMS 內容範本

CMS 內容範本由 `registerCmsTemplates` 註冊。範本只插入 class-based HTML scaffold，後續編輯沿用 TinyMCE 原生文字、清單與 link 操作。

目前提供：

- 錨點列表：插入舊 CMS 相容的 `<ul class="anchor_list nomargin">`

輸出限制：

- 不輸出 inline style。
- 視覺樣式由 `content_css` 載入 `/cms-editor/cms-content/templates.css` 顯示。
- 範本後方會補 `<p class="cms-clear">&nbsp;</p>`，讓使用者能在浮動錨點列表後繼續輸入內容。
- 使用者可直接編輯文字、複製或新增 `<li>`，並使用 TinyMCE 原生 link dialog 設定錨點或連結。

`anchor_list` 是舊 CMS / 客戶前台樣式 contract，不屬於 App UI。若不同客戶有不同錨點列表樣式，應替換或新增對應的 template CSS 檔，並由 `/cms-editor/cms-content/templates.css` 統一管理，而不是把客戶樣式寫回 component init。

## 表格樣式

表格樣式由 `registerCmsTableStyles` 註冊。此工具獨立於 TinyMCE 原生 Table Properties，避免修改原生 table dialog。

功能：

- Toolbar button / context toolbar：`cmstablestyles`
- Command：`cmsTableStyles`
- Context menu：選取 table 時顯示「表格樣式」

Dialog 欄位：

- Responsive layout：目前 UI 提供 `none` / `scroll`
- Bordered：輸出 `is-bordered`
- Striped rows：輸出 `is-striped`
- Hover highlight：輸出 `is-hover`

輸出 contract：

- 基礎 table class：`cms-table`
- Bordered：勾選時輸出 `is-bordered`
- None layout：不輸出 responsive wrapper 或 `is-card`
- Scroll layout：以 `<div class="cms-table-scroll">` 包住 `<table class="cms-table ...">`
- Card layout：實作仍保留 `is-card` / `data-label` 轉換能力，但目前未在 dialog UI 開放

`none`、`cms-table-scroll` 與 `is-card` 是互斥的 responsive strategy。切換到 none 時會移除直接包住 table 的 `cms-table-scroll` wrapper、`is-card` 與 cell `data-label`；切換到 scroll 時會移除 `is-card` 與 cell `data-label`；切換到 card 時會移除直接包住 table 的 `cms-table-scroll` wrapper。

## 表格尺寸與間距

strict mode 保留 TinyMCE 原生 Table Properties 與 Cell Properties。`installTableDialogFieldGuard` 會在 dialog 開啟後，將指定的原生文字輸入框原地替換成受控 select；原 input 仍保留在 dialog 內並接收同步的 `input` / `change` event，不另開自訂 dialog。

表格 dialog 建立時會先以 `visibility: hidden` 保留排版計算，完成欄位隱藏與 select 注入後於下一個 animation frame 顯示，避免原始欄位短暫閃現；若 dialog 未成功建立，`500ms` fallback 會自動解除 preparing 狀態。

受控選項：

- table width：預設、`25%`、`50%`、`75%`、`100%`
- cell width：自動、`20%`、`25%`、`33%`、`40%`、`50%`、`60%`、`66%`、`75%`、`80%`、`100%`
- cell padding：預設、`0px`、`4px`、`8px`、`12px`、`16px`
- border width：無邊框、`1px`、`2px`、`4px`

輸出 contract：

- table width：`cms-table-width-*`
- cell width：對應 `<col>` 輸出 `cms-cell-width-*`
- cell padding：`cms-table-padding-*`；預設值不輸出額外 class，內容 CSS 使用既有 `8px`
- border width：輸出 `cms-table-border-width-*`；非 `0px` 同時輸出 `is-bordered`
- 套用選項時只移除同組 class，保留其他 CMS class 與自訂 class
- 套用選項時會移除同屬性的舊 inline style 與 HTML presentational attribute，避免覆蓋 CMS class
- 既有值若不在受控清單內，select 會顯示「目前值」並保留；只有使用者明確選擇受控值時才轉換

class 與 inline style 的轉換規則集中在 `src/editor/tinymce/cmsTableSizing.ts`。dialog 儲存後立即轉換，`GetContent` 時也會再正規化支援的既有值。

## 格式輸出策略

strict mode 的 Editor 內容輸出以 CMS class 為主，避免已管理格式殘留 inline style。normal mode 則沿用 TinyMCE 原生格式輸出。

對齊格式：

- 一般內容、圖片與 figure：`cms-align-*`
- table：`cms-table-align-*`
- tr：`cms-row-align-*`
- td / th：`cms-cell-align-*`
- td / th 垂直對齊：`cms-cell-valign-*`

`cms-table-align-*` 用於整張表格位置；`cms-row-align-*` 與 `cms-cell-align-*` 用於表格內容對齊。
`cms-cell-valign-*` 用於儲存格內容垂直對齊。

字體格式：

- toolbar 只提供指定字體清單
- `預設字體` 會移除 `cms-font-*`
- 其餘字體輸出 `cms-font-*`

字體大小：

- toolbar 提供 `預設大小`、`8px`、`12px`、`14px`、`16px`、`18px`、`24px`、`32px`、`48px`
- `預設大小` 會移除 `cms-font-size-*`
- 其餘字級輸出 `cms-font-size-*`
- CSS 實際使用 rem，例如 `16px` 對應 `1rem`

顏色格式：

- 文字、背景與 border 各使用 8 色獨立 palette
- 8 個文字色與 8 個背景色任意搭配，對比均不低於 WCAG AA 一般文字門檻 `4.5:1`
- strict mode 的 Table / Row / Cell Properties 保留原生色碼輸入欄位與色票按鈕；背景欄位只提供 8 個背景 token，框線欄位只提供 8 個框線 token，不顯示 TinyMCE 預設色票
- `custom_colors: false`
- `advlist_bullet_styles: 'default,circle,square'`
- `advlist_number_styles: 'default,lower-alpha,lower-greek,lower-roman,upper-alpha,upper-roman'`
- 文字顏色輸出 `cms-color-*`
- 一般背景顏色輸出 `cms-bg-*`
- 一般 border 顏色輸出 `cms-border-*`
- table 背景與 border 顏色輸出 `cms-table-bg-*` / `cms-table-border-*`
- tr 背景與 border 顏色輸出 `cms-row-bg-*` / `cms-row-border-*`
- td / th 背景與 border 顏色輸出 `cms-cell-bg-*` / `cms-cell-border-*`
- border 樣式輸出 `cms-border-style-*`
- table border 樣式輸出 `cms-table-border-style-*`
- tr border 樣式輸出 `cms-row-border-style-*`
- td / th border 樣式輸出 `cms-cell-border-style-*`
- td / th 垂直對齊輸出 `cms-cell-valign-*`
- ul / ol / li 清單樣式輸出 `cms-list-*`
- 文字顏色與背景顏色的「移除顏色」會移除對應 class
- Table / Row / Cell Properties 使用 TinyMCE class list 的 `mce-no-match` 保護既有 class
- 背景色、border 色與 border 樣式正規化採分層 class 群組；table / tr / td / th 只移除同元素層級、同屬性的 CMS class，例如 row border 色只移除 `cms-row-border-*`，不移除 `cms-row-align-*`、`cms-row-bg-*` 或自訂 class

格式 token 的唯一來源是 `src/editor/tinymce/cmsFormattingTokens.json`。`pnpm generate:cms-css` 會產生 `public/cms-editor/cms-content/formatting.css`，TinyMCE `content_css` 與 CMS 前台應載入同一份檔案，避免 editor 預覽與正式顯示使用不同 class 定義。

strict mode 輸出正規化：

- 輸出前執行基本 HTML hardening：移除 `script` / `style` / `object` / `embed` / `applet` / `base` / `meta` / `link`
- 移除 `on*` event attribute 與含 `javascript:` / `data:` / `vbscript:` 的不安全 URL
- 移除非白名單 iframe，保留白名單 iframe 時補 title、sandbox 與 allow attribute 正規化
- `GetContent` 時執行 `canonicalizeCmsHtml`
- 合併純 CMS class 的 nested `span`
- 將已管理的 `color`、`background-color`、`border-color`、`border-style`、`vertical-align`、`list-style-type` 轉成對應 CMS class
- 從 `style` 移除已轉成 class 的屬性
- 轉換 table / tr / td / th 的背景色、border 色與 border 樣式時，只更新目前屬性的 class 群組，保留其他 CMS class 與自訂 class
- 支援的 table / cell width、cell padding 與 table border width 會轉成尺寸 class；清單外的既有值繼續保留
- 尚未納入 class system 的 style 先保留，例如 `height`、`border-collapse`

Editor 內部讀入 table / tr / td / th 時，會依既有 CMS class 暫時補回 `background-color`、`border-color`、`border-style` inline style，並在 td / th 補回 `vertical-align` inline style，讓 TinyMCE Table / Row / Cell Properties dialog 可以回填欄位；正式輸出時仍會再轉回 class。

Heading 顯示尺寸在 editor `content_style` 中定義：

- `h1`: 40px / `2.5rem`
- `h2`: 32px / `2rem`
- `h3`: 28px / `1.75rem`
- `h4`: 24px / `1.5rem`
- `h5`: 20px / `1.25rem`
- `h6`: 16px / `1rem`

## 圖片上傳

TinyMCE image plugin 使用 `images_upload_handler` 串接 `uploadFile`。

允許格式：

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

大小上限：

- 5 MB

上傳 context：

- `kind: 'image'`
- `source: 'editor'`

## 影片工具

影片工具由 `registerMediaTools` 註冊。

功能：

- Toolbar button：`insertvideo`
- Menu item：`insertvideo`
- Command：`cmsInsertVideo`
- Context menu：編輯既有 video

影片 dialog 欄位：

- Source URL
- Choose video file
- Poster URL
- Accessibility mode
- Captions URL
- Captions language
- Captions label
- Text alternative description
- Width
- Height
- Controls
- Autoplay

允許影片上傳格式：

- `video/mp4`
- `video/webm`

大小上限：

- 200 MB

影片 accessibility mode：

- `audio`：含音訊內容，需要 captions/subtitles track
- `visual`：無音訊但有重要畫面內容，需要文字替代說明
- `decorative`：裝飾影片，輸出 `aria-hidden="true"` 與 `tabindex="-1"`

影片輸出：

- 使用 `<video>` 與 `<source>`
- captions 使用 `<track kind="captions">`
- 文字替代說明使用 `<figure class="cms-video">` 與 `<figcaption>`

## iframe 工具

iframe 工具由 `registerMediaTools` 註冊。

功能：

- Toolbar button：`embediframe`
- Menu item：`embediframe`
- Command：`cmsEmbedIframe`
- Context menu：編輯既有 iframe

iframe dialog 欄位：

- Source URL
- Iframe HTML
- Title
- Width
- Height
- Allow fullscreen

白名單網域：

- `www.youtube.com`
- `youtube.com`
- `youtu.be`
- `www.youtube-nocookie.com`
- `youtube-nocookie.com`
- `www.google.com`
- `google.com`
- `maps.google.com`
- `www.google.com.tw`
- `google.com.tw`
- `player.vimeo.com`

iframe normalization：

- 不允許白名單外 URL
- trusted iframe 自動補 title fallback
- trusted iframe 會保留 sandbox，並移除 `allow-same-origin` token
- `allow` attribute 會移除 `web-share`
- 預設補 `loading="lazy"`

## Media Dimension Normalization

Serializer 會針對 `iframe` 與 `video` 同步尺寸：

- 從 `style` 中解析 `width` / `height`
- 補到 `width` / `height` attribute
- 保留編輯器需要的 media resize 行為

正式輸出若由 CMS sanitizer 移除 inline style，仍可依 `width` / `height` attribute 保留基本尺寸。

## Accessibility Checker

自訂 accessibility checker 由以下檔案組成：

- `src/editor/accessibility/checker.ts`：檢查規則
- `src/editor/tinymce/registerAccessibilityCheck.ts`：TinyMCE UI、定位、高亮、修復入口

App 設定：

```ts
registerAccessibilityCheck(editor, mediaToolLabels.value, {
  profile: accessibilityProfile,
})
```

`VITE_ACCESSIBILITY_PROFILE` 可選：

- `content-quality`：預設；所有網站共用的低干擾內容品質檢查。
- `tw-aa-110`：沿用共用檢查，並增加台灣現行「網站無障礙規範（110.07）」中需要人工判斷的內容片段提醒。

Checker 依處理優先序分成「必須修正」、「需要確認」與「改善建議」。目前必須修正规則：

- `image-alt`
- `link-text`
- `iframe-title`
- `table-header`
- `table-header-empty`
- `heading-empty`
- `heading-order`
- `duplicate-id`
- `form-label`
- `button-name`
- `text-contrast`
- `video-captions`
- `video-text-alternative`

目前需要確認：

- table caption 是否需要補充表格目的。
- `tw-aa-110` profile 下，空白圖片 alt 是否確實為裝飾圖。
- `tw-aa-110` profile 下，含合併儲存格的表格是否正確建立多層表頭關聯。

目前改善建議：

- generic 或直接使用 URL 的 link text。

Toolbar 按鈕與原始碼、預覽、全螢幕同屬 utility 群組，並以低調膠囊顯示「檢查 ✓」、「檢查 N」或「檢查 99+」。按鈕依內容撐寬，空間不足時跟隨整個群組換行。完整問題只在使用者開啟 dialog 後呈現，不常駐側欄或持續高亮。

Checker Dialog 桌面寬度為 `580px`，小螢幕使用 `calc(100vw - 32px)`；開啟時會依 editor content area 的位置計算右上角座標，並限制在 viewport 內。`draggable_modal` 使用 TinyMCE 原生實作，拖曳後的座標在目前 dialog 開啟期間保留，關閉後不保存。

Checker 專用 backdrop 會攔截直接點擊並透過 Dialog API 關閉視窗，點擊事件不穿透至 editor；其他 TinyMCE Dialog 不套用此行為。

修復入口：

- `image-alt`：開啟 TinyMCE image dialog
- `link-text`：開啟 TinyMCE link dialog
- `iframe-title`：開啟自訂 iframe dialog
- `video-captions` / `video-text-alternative`：開啟自訂 video dialog
- `table-caption`：執行 TinyMCE table caption command
- `table-header`：執行 TinyMCE table row header command
- `text-contrast`：定位並高亮文字，提示使用文字／背景色票調整後重新檢查

Checker 是編輯器內容片段的預檢，不檢查完整頁面的語言、landmark、頁面 title、導覽與前台執行結果，也不代表已通過台灣 AA 標章人工檢測。

## 上傳架構

上傳由 `uploadFile` 統一處理。

Upload adapter interface：

```ts
interface UploadAdapter {
  upload(
    file: File,
    context: UploadContext,
    onProgress?: (percent: number) => void,
  ): Promise<UploadResult>
}
```

Adapter：

- `localPreviewUploadAdapter`：使用 `URL.createObjectURL(file)`
- `createHttpUploadAdapter(endpoint)`：使用 XMLHttpRequest POST 到 endpoint

環境變數：

- demo 未設定 `VITE_UPLOAD_ENDPOINT`：由 `src/App.vue` 明確使用 local preview adapter
- 有設定 `VITE_UPLOAD_ENDPOINT`：使用 HTTP upload adapter
- 可重用 component 未傳入 `uploadAdapter`：檔案上傳明確失敗，不自動產生 blob preview
- 未設定 `VITE_ACCESSIBILITY_PROFILE`：使用 `content-quality`
- 設為 `tw-aa-110`：增加台灣現行 AA 內容人工確認項目

HTTP upload request：

- method：`POST`
- body：`multipart/form-data`
- field：`file`
- field：`kind`

HTTP response：

```json
{
  "src": "https://example.com/uploads/file.jpg"
}
```

## i18n

使用 `vue-i18n`。

支援 locale：

- `zh-TW`
- `en-US`

TinyMCE 語言：

- `zh-TW` 預設使用 `/cms-editor/langs/zh_TW.js`
- `en-US` 使用 TinyMCE `en`

目前部分 zh-TW 程式文案仍有編碼亂碼，尚未視為完整繁中體驗。

## 目前限制

- `pnpm test` 目前覆蓋 upload 驗證、iframe hardening、非安全來源可用的唯一 ID，以及同頁多個進階 editor 的 DOM ID／ARIA 關係
- 不發布 npm package；跨後台整合採同步 `src/editor` 與 `public/cms-editor` 原始碼／資產目錄
- 沒有內建正式 upload API；HTTP 上傳透過 adapter 抽象，local preview 只由 demo 明確啟用
- 沒有 TinyMCE premium Accessibility Checker
- Accessibility Checker 只檢查 editor 內容片段，不檢查完整頁面的 `<html lang>`、`title`、landmark 等
