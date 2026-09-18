# Editor Experience

## 工作區

App 是單頁 TinyMCE editor 工作區，畫面包含：

- 頁首
- 語言切換
- 載入範例內容
- 清空內容
- TinyMCE editor
- HTML 預覽面板

當 `VITE_EDITOR_MODE=normal` 時，editor 上方另提供「一般／進階」切換；strict mode 維持單一 TinyMCE 工作區。

## 一般與進階工作區

一般工作區維持既有 TinyMCE toolbar、內容編輯、媒體、表格、CMS 範本與 Accessibility Checker 體驗。

進階工作區提供：

- HTML / CSS / JavaScript Tab。
- 目前分頁專用的復原、重做與搜尋／取代工具；復原與重做會依該分頁的 CodeMirror history 自動啟用或停用。
- 單一 CodeMirror 6 程式碼編輯區。
- 右側 sandboxed iframe 即時預覽。
- 中間可用滑鼠拖曳或左右方向鍵操作的寬度調整線。
- 程式碼區收合／展開。
- 網頁內全螢幕，可用 toolbar 按鈕或 `Escape` 離開。
- 目前 Tab 的手動程式碼格式化，快捷鍵為 `Shift + Alt + F`。
- 手動「重新執行」按鈕。
- JavaScript runtime error 與未處理 Promise rejection 顯示來源、行號與欄位；有位置時可點擊錯誤切換至 JavaScript 並定位。

一般／進階模式列整合在 editor card 頂端，與進階 toolbar 都採接近 TinyMCE Oxide 的淺灰底、緊湊按鈕與淡藍 selected / focus 狀態，不依賴目前 App 的品牌色。進階工作區桌面高度預設為 `620px` 並跟隨 component `height` prop，預設為程式碼 `45%`、即時預覽 `55%`；兩側各自在區塊內捲動，不會隨程式碼長度持續增加頁面高度。程式碼最小寬度為 `320px`，preview 最小寬度為 `400px`。

全螢幕會讓進階工作區覆蓋整個瀏覽器 viewport，並暫停外層頁面的捲動；它不會改用瀏覽器 Fullscreen API，因此不會跳出網頁或要求瀏覽器權限。離開後回到原本 editor card，內容、目前 Tab、收合狀態與左右比例都會保留。

收合程式碼後，preview 使用全部寬度；重新展開時恢復先前比例。窄螢幕時工作區高度固定為 `720px`，程式碼編輯區與即時預覽改為上下排列。

桌面 splitter 會持續捕捉同一次滑鼠或觸控筆操作，即使游標跨入 preview iframe 也不會中斷。鍵盤可用左右方向鍵微調，或用 `Home` / `End` 移至目前版面允許的最小／最大比例；ARIA min、max 與 value text 會反映程式碼 `320px`、preview `400px` 的實際限制。CodeMirror 長行使用水平捲動，不在拖曳改變寬度時反覆重新折行。

格式化使用 browser 端 Prettier，只改寫目前 Tab 並保留在 CodeMirror undo history。格式化期間若切換 Tab 或內容已變更，會丟棄過期結果，不覆寫新的 editor state；程式碼區收合時停用格式化。HTML、CSS、JavaScript 分別使用對應 parser；格式化失敗時保持原內容並顯示錯誤，不會自動在輸入或切換 Tab 時格式化。

HTML、CSS、JavaScript 分頁支援 `ArrowLeft` / `ArrowRight` 循環切換，並支援 `Home` / `End` 移至第一個或最後一個分頁。程式碼 toolbar 提供可見的復原、重做與搜尋按鈕，並支援方向鍵循環、`Home` / `End` 定位，操作時會跳過 disabled 按鈕；鍵盤快捷鍵仍沿用 CodeMirror 的 `Ctrl` / `Cmd` 組合。

CodeMirror 會在停止輸入後檢查 parser 明確產生的 HTML、CSS、JavaScript 語法錯誤，顯示內容底線、gutter marker 與各 Tab 的錯誤數。這是輕量語法診斷，不包含 ESLint、Stylelint、程式碼風格或 accessibility 規則。

切換行為：

- 進階切回一般時，TinyMCE 會載入一份 HTML working copy；進階 CSS 同步顯示在內容 iframe，但 JavaScript 不會在 TinyMCE 執行。
- 一般模式出現進階內容時會顯示提示，可前往 CSS 分頁或暫停／啟用進階 CSS。
- 只切換、未編輯時，切回進階會保留原始 HTML，不使用 TinyMCE 序列化結果覆寫內容。
- 在一般模式實際編輯後才會套用 TinyMCE HTML；若載入時已偵測到 parser round-trip 差異，切回進階前會顯示 TinyMCE 原生確認彈窗。取消套用仍會切換，但保留進階模式原始 HTML。
- 舊 CKEditor 型內容若把 `<style>` 與 HTML 放在一起，一般模式會暫時抽出 style 並套用；套用一般模式編輯時會把這段樣式遷移到 CSS 欄位。`<script>` 不會交給 TinyMCE。
- normal mode 的一般工作區可保留並顯示 inline SVG；SVG 會經 TinyMCE 內建 sanitizer，因此其中的不安全節點仍可能被移除。
- 載入範例與清空內容會一併清除 CSS 與 JavaScript。

即時預覽在停止輸入 `400ms` 後更新。HTML 分頁不執行內嵌 `script` 或 event attribute；舊內容的內嵌 `<style>` 會與 CSS Tab 合併後套用，互動則只從 JavaScript Tab 執行。預覽 iframe 允許 script，但不授予 same-origin 權限，並以 CSP 禁止 fetch 等網路連線。

預覽隔離只用於目前 editor 工作區。正式前台如何保存及執行 CSS、JavaScript 尚未在本專案實作，不能把 editor 預覽視為完整發布安全機制。

## 語言切換

支援語言：

- `zh-TW`
- `en-US`

切換語言時會：

- 更新 Vue i18n locale
- 更新 `document.documentElement.lang`
- 透過 `:key="locale"` 重建 TinyMCE editor
- zh-TW TinyMCE UI 預設載入 `/cms-editor/langs/zh_TW.js`
- 重新配置 CodeMirror 介面字串；zh-TW 會顯示繁體中文搜尋、取代、跳至行、程式碼摺疊與自動完成輔助文字，en-US 維持英文

CodeMirror 6 不使用獨立語言包；進階工作區透過 `EditorState.phrases` 提供 zh-TW 翻譯。切換語言時保留 HTML、CSS、JavaScript 內容、選取範圍與 undo history。

目前部分 zh-TW 程式文案仍有編碼亂碼，不能視為完整繁中體驗。

## Toolbar

目前關閉 menubar，主要操作集中在 toolbar。

Toolbar 提供：

- undo / redo
- bold / italic / strikethrough
- blocks
- font family
- font size
- align left / center / right / justify
- bullet list / numbered list / blockquote
- text color / background color
- link
- image
- insert video
- embed iframe
- table
- CMS table styles
- content templates
- accessibility check
- code
- preview
- fullscreen

## HTML 預覽

Editor 下方以 `<details>` 顯示目前 `content` HTML。

strict mode 的 HTML 由 TinyMCE `getContent()` 輸出，會經過 hardening 與 CMS class 正規化：

- 移除高風險元素、事件屬性、不安全 URL 與非白名單 iframe
- 白名單 iframe 會補 title、保留 sandbox，並移除 `allow-same-origin`
- 合併純 CMS class nested `span`
- 將已管理的 `color`、`background-color`、`border-color`、`border-style` 轉成 class
- 從 `style` 移除已轉成 class 的屬性

normal mode 顯示正式資料模型中的 HTML。一般模式只在使用者實際編輯並確認套用時以 TinyMCE working copy 取代它，editor component 不再額外執行 destructive hardening；正式儲存與前台仍必須依 CMS 的信任邊界執行驗證或 sanitizer。

## Help 快捷鍵

App 支援 `Alt + 0`。

當焦點位於目前 editor 的一般工作區且 TinyMCE instance 存在時，會執行該 instance 的 `mceHelp` command。同頁有多個 editor 時，不會由其他 instance 攔截快捷鍵；進階工作區不開啟 TinyMCE help。

## 格式體驗

部署時可用 `VITE_EDITOR_MODE` 選擇格式策略：

- `strict`：預設；已管理格式輸出 CMS class，使用受限制的 AA 安全色票。
- `normal`：保留 TinyMCE 原生格式與色票，並提供一般／進階工作區；字級選單顯示熟悉的 px 尺寸、實際輸出 rem。CMS 範本、媒體與 Accessibility Checker 仍可使用。

strict mode 並非目前就會移除所有 inline style。未管理但合法的舊內容 style 仍可能保留，正式儲存與前台仍需搭配 CMS sanitizer policy。

## CMS 內容範本

Toolbar 的內容範本按鈕目前提供「錨點列表」。

錨點列表會插入一段可直接編輯的 HTML scaffold：

```html
<ul class="anchor_list nomargin">
  <li><a href="#section-1" title="錨點一">錨點一</a></li>
  <li><a href="#section-2" title="錨點二">錨點二</a></li>
  <li><a href="#section-3" title="錨點三">錨點三</a></li>
</ul>
<p class="cms-clear">&nbsp;</p>
```

使用者可直接在 editor 中修改文字、複製或新增 `<li>`，並使用 TinyMCE 原生 link dialog 設定錨點位置或連結。輸出 HTML 只包含元素、attribute 與 class，不包含 inline style。

Editor 內容區會透過 `/cms-editor/cms-content/templates.css` 載入內容範本樣式，讓範本在編輯器中接近前台顯示。`anchor_list` 樣式可依客戶前台 CSS 替換或擴充，不寫在 component 的 TinyMCE init 字串內。

## 表格樣式

Toolbar 與 table context toolbar 提供「表格樣式」工具。使用者需先選取或將游標放在 table 內，再開啟 dialog。

Dialog 提供：

- 響應式呈現：無 / 水平捲動
- 顯示邊框
- 斑馬紋列
- 滑過高亮

輸出行為：

- table 會保留或補上 `cms-table`
- 顯示邊框會輸出 `is-bordered`
- 選擇「無」時不輸出 responsive wrapper 或 `is-card`
- 水平捲動會以 `<div class="cms-table-scroll">` 包住 table
- 斑馬紋列與滑過高亮分別輸出 `is-striped`、`is-hover`
- 卡片式 class 轉換仍保留在實作中，但目前未在 dialog UI 開放

### 尺寸與間距

strict mode 保留 TinyMCE 原生 Table Properties 與 Cell Properties，不新增另一個 dialog。原生彈窗內的寬度、內邊距與邊框寬度會顯示為下拉選單。

彈窗會在欄位處理完成後一次顯示，不會先顯示原始輸入框再跳成下拉選單。

可選項目：

- 表格寬度：預設、25%、50%、75%、100%
- 儲存格寬度：自動、20%、25%、33%、40%、50%、60%、66%、75%、80%、100%
- 儲存格內邊距：預設、0px、4px、8px、12px、16px
- 邊框寬度：無邊框、1px、2px、4px

這些選項直接輸出 `cms-table-width-*`、`cms-cell-width-*`、`cms-table-padding-*`、`cms-table-border-width-*` 與 `is-bordered`；其中儲存格寬度的 `cms-cell-width-*` 會套用於對應的 `<col>`。切換選項只更新同一組 class，並移除同屬性的舊 inline style；其他 CMS class 與自訂 class 會保留。

原始 input 仍留在 TinyMCE dialog 內並與 select 同步，因此儲存、取消與 undo 維持原生流程。既有 HTML 若使用清單外的值，例如 `63%`，下拉會顯示目前值；未明確改選時不會重寫內容。

### 對齊

對齊工具輸出 class：

- 一般內容、圖片與 figure：`cms-align-*`
- table：`cms-table-align-*`
- tr：`cms-row-align-*`
- td / th：`cms-cell-align-*`
- td / th 垂直對齊：`cms-cell-valign-*`

對齊樣式由 editor 與前台共用的 `/cms-editor/cms-content/formatting.css` 即時顯示。

### 清單樣式

無序列表與數字清單沿用 TinyMCE 原生 toolbar 操作。

strict mode 會將 TinyMCE 產生的 `list-style-type` 轉為 CMS class：

- 無序列表：`cms-list-disc`、`cms-list-circle`、`cms-list-square`
- 數字清單：`cms-list-decimal`、`cms-list-lower-alpha`、`cms-list-upper-alpha`、`cms-list-lower-roman`、`cms-list-upper-roman`、`cms-list-lower-greek`

輸出時會移除已轉換的 inline `list-style-type`。

### 字體

字體選單只提供指定字體。

包含：

- 預設字體
- 思源黑體
- 微軟正黑體
- 新細明體
- 等寬字型
- Arial
- Comic Sans MS
- Courier New
- Georgia
- Helvetica
- Lucida Sans Unicode
- Tahoma
- Times New Roman
- Trebuchet MS
- Verdana

選擇「預設字體」會移除 `cms-font-*` class。

### 字體大小

字體大小選單提供：

- 預設大小
- 8px
- 12px
- 14px
- 16px
- 18px
- 24px
- 32px
- 48px

選擇「預設大小」會移除 `cms-font-size-*` class。

輸出 class 使用 px 命名，例如 `cms-font-size-16px`；CSS 實際使用 rem。

### 顏色

strict mode 將色票拆成 8 個深色文字色、8 個淺色背景色與 8 個 border 色，不提供自訂顏色。任一建議文字色搭配任一建議背景色，對比均不低於一般文字的 `4.5:1` 門檻。

strict mode 的 Table / Row / Cell Properties 進階頁籤保留原生色碼輸入欄位與色票按鈕。背景欄位顯示 8 個背景色，框線欄位顯示 8 個框線色；選色仍走 TinyMCE 原生表格儲存流程，輸出時轉成對應層級的 CMS class。normal mode 維持 TinyMCE 預設色票。

色票不取代客戶品牌確認。正式導入時可在相同 token 結構中替換品牌色，但新增的文字色與背景色需重新驗證所有允許組合；normal mode 則維持 TinyMCE 一般色彩行為。

輸出 class：

- 文字顏色：`cms-color-*`
- 一般背景顏色：`cms-bg-*`
- 一般 border 顏色：`cms-border-*`
- table 背景與 border 顏色：`cms-table-bg-*` / `cms-table-border-*`
- tr 背景與 border 顏色：`cms-row-bg-*` / `cms-row-border-*`
- td / th 背景與 border 顏色：`cms-cell-bg-*` / `cms-cell-border-*`
- 一般 border 樣式：`cms-border-style-*`
- table border 樣式：`cms-table-border-style-*`
- tr border 樣式：`cms-row-border-style-*`
- td / th border 樣式：`cms-cell-border-style-*`
- td / th 垂直對齊：`cms-cell-valign-*`

文字顏色與背景顏色工具中的「移除顏色」會移除對應 class。

表格、列、儲存格若使用 palette 內的背景色、border 色或支援的 border 樣式，輸出時會依 table / row / cell 層級轉為對應 class。

色彩、字體、字級、對齊與邊框 class 集中在 `/cms-editor/cms-content/formatting.css`。Editor 與 CMS 前台載入同一份 CSS，避免後台看得到但前台缺少樣式。

Table / Row / Cell Properties 會保留既有多 class。當使用者只修改背景色、border 色或 border 樣式時，App 只更新對應層級與屬性的 CMS class，不會覆蓋對齊、背景或其他自訂 class。

Properties dialog 的 Class 欄位使用「保留既有樣式」選項，讓 TinyMCE 在既有 class 不符合單一預設 class 時不要重寫整個 `class` attribute。

當原始碼含有自訂 class 與 CMS class，例如 `ee cms-cell-bg-yellow cms-cell-border-red`，editor component 會在內部暫時補回 dialog 可讀的 style，讓背景色、border 色、border 樣式與儲存格垂直對齊仍可在 Properties dialog 顯示；正式 HTML 預覽仍輸出 class。

## 標題尺寸

Blocks 工具選擇 H1-H6 時，editor 內容區使用以下尺寸：

- H1：40px
- H2：32px
- H3：28px
- H4：24px
- H5：20px
- H6：16px

尺寸只影響 editor 顯示與前台 CSS 對齊，不會輸出 inline style。

## 圖片體驗

圖片使用 TinyMCE image plugin。

行為：

- 走 TinyMCE image flow
- 使用 `images_upload_handler`
- 允許 JPEG、PNG、WebP、GIF
- 大小上限 5 MB
- 上傳完成後回填 `src`

## 影片體驗

影片由 `insertvideo` 工具提供。

使用者可：

- 輸入影片 URL
- 上傳 MP4 / WebM
- 輸入 poster URL
- 設定 width / height
- 設定 controls
- 設定 autoplay
- 選擇 accessibility mode

Accessibility mode：

- 含音訊內容：需要 captions URL
- 無音訊但有重要畫面內容：需要文字替代說明
- 裝飾影片：輸出 `aria-hidden` 與 `tabindex="-1"`

影片與 iframe 在 editor 中以 TinyMCE preview object 呈現，可拖曳與調整尺寸。

## iframe 體驗

iframe 由 `embediframe` 工具提供。

使用者可：

- 輸入 iframe source URL
- 貼上 iframe HTML
- 輸入 title
- 設定 width / height
- 設定 allow fullscreen

插入前會檢查白名單網域。trusted iframe 若缺少 title，會以 URL hostname 產生 fallback title。

## Context Menu

目前 context menu 包含：

- `cmstablestyles`
- `cmsmedia`
- `cmslink`
- TinyMCE `image`
- TinyMCE `table`

media context menu 行為：

- 對 video 開啟自訂 video dialog
- 對 iframe 開啟自訂 iframe dialog

## Media Preview Object

TinyMCE 會將 video / iframe 包成 `span.mce-preview-object`。

Editor setup 會在 `init`、`SetContent`、`NodeChange` 時：

- 設定 preview object 可 draggable
- 補 `data-mce-resize="true"`
- 補 `tabindex="0"`
- 讓 preview object 內的 iframe/video 不直接接收 pointer event
- 讓 shim 可接收 pointer event，以維持 resize 操作

## Accessibility Checker

Toolbar 的 Checker 按鈕位於原始碼、預覽與全螢幕的 utility 群組，以低調膠囊樣式顯示「檢查 ✓」、「檢查 N」或「檢查 99+」。按鈕依內容撐寬，空間不足時跟隨整個群組換行；按下後才開啟自訂 Accessibility Checker dialog。

問題依處理優先序顯示為「必須修正」、「需要確認」與「改善建議」，並先排列必須修正項目。

Dialog 會顯示：

- issue 順序
- 三種問題類別的數量
- 使用中的檢查 profile
- rule
- message
- snippet
- 對應成功準則、檢測碼與稽核評量碼（規則有對應資料時）
- 上一個 / 下一個 issue
- 忽略目前 issue
- 重新檢查
- 修復入口

Checker Dialog 桌面寬度為 `580px`，小螢幕會縮至視窗寬度減 `32px`。每次開啟時會定位在 editor 內容區右上角並保留 `16px` 間距；使用者可從標題列拖曳，本次開啟期間切換問題或重新檢查不會重設位置。關閉後再開啟時會回到預設位置。

Checker 專用 modal backdrop 使用 `rgba(255, 255, 255, 0.25)`，讓 editor iframe 內目前高亮的問題在 Dialog 開啟時仍可辨識；其他 TinyMCE Dialog 維持原本遮罩。

直接點擊 Checker backdrop 會關閉 Dialog，但事件不會穿透到 editor；點擊 Dialog 本體或拖曳標題列不會觸發關閉。此行為僅套用 Checker。

Editor 啟用 TinyMCE 原生 `draggable_modal`，因此圖片、連結與其他 modal dialog 同樣可拖曳。

目前檢查包含：

- 圖片 alt
- 連結文字
- iframe title
- table caption / th / 空 th
- heading 空白與階層跳級
- duplicate id
- form label
- button accessible name
- 清單 `ul` / `ol` / `li` 結構
- ARIA ID 參照是否存在
- 文字與有效背景的色彩對比（一般文字 `4.5:1`；大字 `3:1`）
- video captions / text alternative

部署時可用 `VITE_ACCESSIBILITY_PROFILE` 選擇：

- `content-quality`：預設，供所有網站使用。
- `tw-aa-110`：增加固定字級單位、局部語言標籤、圖片 alt 品質、正數 `tabindex`、自動播放聲音、移動／閃爍內容、裝飾圖片與複雜表格關聯等內容預檢或人工確認提醒。

定位行為：

- 開啟 checker 時會定位目前 issue
- 目前 issue 會加上 `cms-a11y-active-issue` class
- 關閉 dialog 時會清除高亮

Checker 只處理使用者能在 TinyMCE 新增或修改的內容，不負責 admin shell 或前台整頁行為，也不代表完整網站已通過台灣 AA 標章人工檢測。

## 通知體驗

自訂 media 工具使用 TinyMCE `notificationManager`。

通知情境：

- upload success
- upload error
- invalid URL
- captions required
- text alternative required
- iframe domain not allowed

通知 timeout：

- 5 秒

## 目前限制

- zh-TW UI 仍有部分程式文案亂碼
- Accessibility Checker 是自訂預檢，不是 TinyMCE premium Accessibility Checker
- `/cms-editor/cms-content/templates.css` 目前提供 editor 預覽與可複用的 CMS 內容樣式；正式前台仍可依客戶樣式覆蓋或替換
