# TinyMCE Editor Vision

## 產品定位

本專案是一個 Vue 3、TypeScript、TinyMCE 8 建立的自託管 CMS editor 工作區。

目前目標不是建立完整 design system 或 npm package，而是提供可驗證 TinyMCE 舊 CMS HTML 能力、並可直接搬入其他 Vue 3 後台的 editor 原始碼模組。

## 核心方向

- 使用 TinyMCE 官方 editor 能力作為主體。
- 以自託管方式運作，不依賴 Tiny Cloud API Key。
- 儘量保留 TinyMCE 原生互動，不用不必要的魔改取代官方流程。
- 對必要的 CMS 情境提供小範圍客製化，例如影片、iframe、上傳與 accessibility check。
- 對常見舊 CMS 區塊提供 class-based HTML scaffold 範本，讓編輯仍沿用 TinyMCE 原生流程。
- 以 accessibility error 作為目前最優先檢查目標。
- 以 strict／normal 兩種部署模式區隔「受控 CMS 輸出」與「一般 TinyMCE 編輯」。
- normal mode 可進一步切換到 HTML、CSS、JavaScript 程式碼工作區，用於製作需要自訂樣式與互動的圖文內容區塊。
- editor 核心集中於 `src/editor`，宿主後台透過 props、emits、exposed methods 與 upload adapter 整合，不直接修改 editor 內部程式。
- 不發布公有或私有 npm package；多後台更新以單一來源同步完整 editor 原始碼與靜態資產。

## 適用情境

目前專案適合：

- 本地測試 TinyMCE 編輯既有 HTML。
- 驗證 TinyMCE 對圖片、表格、連結、影片、iframe 的處理方式。
- 測試自託管 zh-TW 語言包。
- 測試上傳 adapter 與本地 blob preview。
- 測試基本 WCAG AA 相關 authoring 提醒。

目前專案不宣稱提供：

- 完整 CMS 後台。
- npm package 或自動版本分發服務。
- 完整商業版 TinyMCE Accessibility Checker 等同功能。
- TinyMCE premium plugins。
- 完整端對端與跨瀏覽器自動化測試套件；目前只有關鍵工具與多實例 DOM 行為的基礎測試。

## 編輯策略

格式策略分為兩種部署模式：

- `strict` 為預設，將已管理格式轉為 CMS class，並限制為可預先驗證的文字、背景與 border 色票。
- `normal` 沿用 TinyMCE 原生格式行為，適用於不要求禁止內容 inline style 的客戶。

兩種模式都保留 CMS 範本、媒體與 Accessibility Checker。strict mode 的 class CSS 由共同 token 產生，editor 與 CMS 前台應載入同一份內容樣式 contract。

normal mode 的一般工作區維持 TinyMCE；進階工作區採 CodeMirror 6 分頁編輯 HTML、CSS、JavaScript，並以 sandboxed iframe 提供即時預覽。正式資料仍以三個欄位保存。為相容舊 CKEditor 內容，可讀取 HTML 內嵌的 `<style>` 並在一般工作區顯示；使用者套用一般模式編輯時會將它遷移到 CSS 欄位。JavaScript 始終不交給 TinyMCE 執行。

進階預覽不代表已完成正式發布執行環境。若 CMS 前台允許使用者 JavaScript，應優先使用與主頁面隔離的執行環境，並另行處理角色權限、CSP、儲存端驗證、稽核與版本回復；不應直接把 editor 端預覽機制視為可安全執行任意程式碼的保證。

專案目前採用 TinyMCE 內建 plugin 與 command 作為主要操作方式：

- Toolbar 放置高頻操作。
- 影片與 iframe 使用自訂 TinyMCE button、command 與 context menu。
- 圖片、連結、表格等功能優先沿用 TinyMCE 原生 dialog。
- 舊 CMS 區塊以自訂 TinyMCE button 插入 scaffold，目前先支援錨點列表；插入後由使用者用 TinyMCE 原生文字、清單與 link 操作維護。
- 舊 CMS 區塊樣式視為內容樣式 contract，可依客戶前台 CSS 拆檔管理；App 不應把客戶特定樣式混入主要 UI 程式碼。
- Accessibility Checker 以單一低干擾狀態按鈕顯示問題數，使用者開啟 dialog 後再顯示細節與修復流程。

## Accessibility 方向

所有網站預設使用 `content-quality` profile，先處理內容片段中可自動判斷的高信心問題；需要申請台灣 AA 標章的專案可在部署設定改用 `tw-aa-110`，增加現行規範的人工確認提醒。這樣不會讓一般使用者持續受到大量 AA 提示干擾，也保留日後轉為 AA 專案的內容基礎。

Checker 將結果分成「必須修正」、「需要確認」與「改善建議」，主要協助內容編輯者處理：

- 圖片缺少 alt。
- 連結沒有可辨識文字。
- iframe 缺少 title。
- 表格缺少 header cell。
- 文字與實際背景色的對比低於一般文字 `4.5:1` 或大字 `3:1`。
- 含音訊影片缺少 captions。
- 無音訊但有重要視覺內容的影片缺少文字替代說明。

Checker 的責任邊界是編輯器產出的 HTML 內容片段；完整頁面的語言、landmark、導覽、前台 CSS 與實際操作仍由網站層及最終人工檢測負責。

## Media 方向

目前媒體功能聚焦在 CMS 常見內容：

- 圖片上傳與插入。
- 影片 URL 或檔案插入。
- 影片 captions 與文字替代說明。
- iframe URL 或整段 iframe HTML 貼入。
- iframe 網域白名單。
- 編輯器內避免 iframe/video 直接吃掉滑鼠操作，讓媒體物件仍可被選取與拖拉。

## 國際化方向

目前支援語系型別：

- `zh-TW`
- `en-US`

TinyMCE zh-TW 使用本地語言包：

- `public/cms-editor/langs/zh_TW.js`

目前程式中的部分 zh-TW 文案已有編碼亂碼，後續若要正式使用，應先修復 i18n 文案來源。

## 技術方向

目前專案維持兩個清楚邊界：

- `src/App.vue` 與 `src/style.css` 是 Vite demo shell。
- `src/editor` 是可直接搬入 Vue 3 後台的 editor 原始碼模組。
- `src/editor/tinymce` 放 TinyMCE 客製化註冊。
- `src/editor/uploads` 放上傳 adapter。
- `src/editor/accessibility` 放 accessibility checker。
- `src/editor/tinymce/cmsFormattingTokens.json` 作為 strict mode 格式 token 來源。
- `public/cms-editor` 是整合時需一併同步的 self-hosted assets。
- `public/cms-editor/cms-content/formatting.css` 作為 editor 與 CMS 前台共用的 class contract。
