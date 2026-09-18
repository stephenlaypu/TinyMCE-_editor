# TinyMCE Editor Project

## 語言

- 專案文件使用繁體中文（zh-TW）。
- 使用者可見文字預設以繁體中文為主，並保留英文（en-US）切換能力。
- 程式碼識別名稱、API、HTML tag、CSS class 與第三方套件名稱維持英文。
- 目前部分 zh-TW 程式文案存在編碼亂碼，文件不可把它描述成已完成的正常繁中體驗。

## 技術棧

- Vue 3
- TypeScript
- Vite
- pnpm
- TinyMCE 8
- `@tinymce/tinymce-vue`
- CodeMirror 6
- `vue-i18n`

## 專案定位

- 這是 TinyMCE 自託管 editor 專案，不使用 Tiny Cloud API Key。
- TinyMCE Vue wrapper 使用 `license-key="gpl"`。
- 目前專案包含 demo 工作區與可直接搬入其他 Vue 3 後台的 `src/editor` 原始碼模組，不發布 npm package。
- 目前主要用途是驗證 TinyMCE 對舊 HTML、媒體、iframe 與 accessibility 檢查的可行性。
- `VITE_EDITOR_MODE` 支援 `strict` 與 `normal`；未設定時使用 `strict`。

## 開發原則

- 以目前程式碼為唯一事實來源。
- 避免新增未實作功能的文件描述。
- 優先使用 TinyMCE 官方設定與 plugin API，不做不必要的魔改。
- 若必須客製化，應集中在 `src/editor/tinymce/*`，並在文件中說明原因。
- TypeScript 應維持可通過 `pnpm typecheck`。
- 變更後優先執行 `pnpm typecheck`；若影響 build 或 assets，執行 `pnpm build`。

## 本地開發

- 安裝：`pnpm install`
- 開發：`pnpm dev`
- 型別檢查：`pnpm typecheck`
- 測試：`pnpm test`
- 建置：`pnpm build`
- Editor 測試集中在 `tests/editor`，依 `src/editor` 的子目錄結構排列；`src/editor` 只保留可搬移 runtime 原始碼。
- Vite dev server 固定使用 `5180` port。
- Vite preview 固定使用 `4180` port。

## TinyMCE 自託管

- TinyMCE core、icons、theme、model 與 plugins 由 npm package import。
- UI skin CSS 由 editor 模組 import；iframe content CSS 由 `public/cms-editor/tinymce` 提供。
- zh-TW 語言包位於 `public/cms-editor/langs/zh_TW.js`。
- help plugin key navigation i18n 位於 `public/cms-editor/tinymce/plugins/help/js/i18n/keynav/`。

## 目前核心功能

- TinyMCE 編輯器。
- zh-TW / en-US 介面切換。
- HTML 原始內容預覽。
- 圖片上傳。
- 影片插入與上傳。
- iframe 嵌入與白名單檢查。
- TinyMCE media plugin。
- CMS 錨點列表範本工具。
- Accessibility Checker 按鈕。
- strict mode 的已管理格式輸出 CMS class；normal mode 使用 TinyMCE 原生格式行為。
- strict mode 的文字、背景、清單與表格色票由 `src/editor/tinymce/cmsFormattingTokens.json` 管理。
- `public/cms-editor/cms-content/formatting.css` 由 token 產生，供 editor 與 CMS 前台共用。
- normal mode 提供一般／進階工作區；進階工作區可分頁編輯 HTML、CSS、JavaScript 並在 sandboxed iframe 即時預覽。
- normal mode 的一般工作區使用 HTML working copy；未實際編輯時切換模式不得以 TinyMCE serialization 覆寫正式 HTML。
- normal mode 會把進階 CSS 套用到 TinyMCE iframe，但不執行進階 JavaScript；舊 HTML 內嵌 `<style>` 可在套用一般模式編輯時遷移到 CSS 欄位。
- normal mode 明確啟用 TinyMCE SVG schema；安全 inline SVG 可進入一般工作區，不安全 SVG 子節點仍由 TinyMCE sanitizer 移除。
- Editor component 的 HTML hardening 與 CMS class 正規化只套用於 strict mode；normal mode 的正式儲存與發布安全須由 CMS 信任邊界負責。

## Accessibility

目前程式碼提供自訂 accessibility checker：

- 檢查圖片 alt。
- 檢查連結文字。
- 檢查 iframe title。
- 檢查 table caption 與 th。
- 檢查 video captions 或文字替代說明。
- 依一般文字與大字門檻，檢查內容文字與實際背景的色彩對比。
- 問題分為「必須修正」、「需要確認」與「改善建議」。
- `VITE_ACCESSIBILITY_PROFILE` 支援 `content-quality` 與 `tw-aa-110`；未設定時使用前者。
- Checker 會定位並高亮目前問題，按修復會開啟對應 TinyMCE 或自訂彈窗。

## Media 與 iframe

- 圖片上傳支援 JPEG、PNG、WebP、GIF，大小上限 5 MB。
- 影片上傳支援 MP4、WebM，大小上限 200 MB。
- demo 未設定 `VITE_UPLOAD_ENDPOINT` 時由 `src/App.vue` 明確傳入 local preview adapter，使用 `blob:` URL 做本地預覽；可重用 component 本身不會自動 fallback。
- 有設定 `VITE_UPLOAD_ENDPOINT` 時使用 `multipart/form-data` 上傳。
- iframe 只允許目前白名單網域。
- trusted iframe 會自動補 title fallback。
- trusted iframe 會保留 sandbox，並移除 `allow-same-origin` token。
- iframe allow attribute 會移除目前會造成 console warning 的 `web-share` feature。
- Upload result 可成對回傳 `fileGuid` 與 `fileState`，Editor 會將新上傳媒體標記為 RichText 檔案庫引用。
- `extractMediaReferenceManifest()` 與 `diffMediaReferenceManifests()` 提供媒體引用擷取、Temp → Active 與解除引用差異；後端仍必須重新驗證。
- `resolveManagedMediaReferences()` 可以建立使用永久公開 URL 的內容副本；缺少解析或非公開 URL 時 fail closed。
- `prepareResolvedPageContentForPublication()` 以固定順序組合整頁媒體解析、發布 policy 與 namespace／render mode 準備。
- 發布預檢會阻擋 `blob:`、temporary、admin-only、invalid 與缺少生命週期的 managed media URL。

## 文件維護

- `AGENTS.md`：開發協作規範。
- `docs/vision.md`：目前產品定位與方向。
- `docs/project-spec.md`：目前程式規格。
- `docs/editor-experience.md`：目前使用體驗。
- 文件更新時不得只向下追加，應刪除過時內容並重組章節。
