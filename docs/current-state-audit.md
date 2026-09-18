# Editor 現況與缺口盤點

版本核對日：2026-09-18。TinyMCE Community 目前穩定版為 8.9.1，Vue wrapper 穩定版為 6.3.0；專案已使用這兩個版本，不需要為了追版再升級。8.9.1 對 Community core 沒有額外變更，但仍是目前正式 latest tag。

更新日期：2026-09-18

本文件以目前程式碼為事實來源，區分「已實作」、「確認缺口」與「需由 CMS／前台處理」。它不是網站無障礙認證報告，也不以 Editor 的內容預檢取代整站軟體檢測、人工稽核或標章申請。

官方基準：[網站無障礙規範（110.07）](https://accessibility.moda.gov.tw/Accessible/Guide/68)、[CS2140401C 檢測碼說明](https://accessibility.moda.gov.tw/Download/Detail/1528?Category=63)

## 模式與資料模型

### 已實作

- `EditorContent` 固定包含 `html`、`css`、`js` 三個欄位。
- `strict` mode 固定使用 TinyMCE 一般工作區，將已管理格式正規化成 CMS class；合法的舊內容 inline style 仍可能保留，因此不是完整 sanitizer。
- `normal` mode 提供一般／進階工作區。進階工作區使用 CodeMirror 6 分頁編輯 HTML、CSS、JavaScript。
- normal mode 的一般工作區會套用進階 CSS，但不執行進階 JavaScript。
- 進階預覽使用 `sandbox="allow-scripts"`，未加入 `allow-same-origin`；預覽 CSP 的 style／script 使用每次重建產生的 nonce，不使用 `'unsafe-inline'`。
- 一般工作區使用 working copy。沒有實際編輯時，切換工作區不會用 TinyMCE serialization 覆寫正式 HTML。
- 舊 HTML 內的 `<style>` 可抽出並在套用一般模式變更時遷移至 `css` 欄位。

### 確認缺口

- `advancedWorkspaceEnabled` 可接收 admin 已完成的權限判斷結果，控制 normal mode 是否顯示及允許進入進階工作區；它不是授權邊界。
- `EditorPolicy` 已集中目前可配置能力；CSS 與 JavaScript 分頁可分開停用。JavaScript 停用後仍保存既有資料，但不會在 advanced preview 執行。
- 已提供不修改內容的 capability report 與 `PublicationPolicy` 預檢，可區分內容保存和正式發布；目前是前端 guard，不是後端 sanitizer。
- CSS selector scope 已改用正式 CSS grammar；可處理 selector list、at-rule、keyframes 與 nesting，遇到全域 selector或語法錯誤會 fail closed。後端等效實作仍是導入門檻。
- 已提供跨內容區塊 ID／radio name 衝突檢查與發布副本命名空間轉換；含 JavaScript、duplicate ID 或無效 CSS 時會 fail closed。後端發布管線尚未接入。
- 已提供頁面層發布預檢，可同時整合單區塊 blocker、重複 block key 與跨區塊衝突，並區分 deny、namespace 與 isolated-document renderer 策略。
- 已提供發布副本準備工具；namespace 轉換後會重新檢查全頁衝突，失敗時不輸出部分轉換結果。正式 iframe／CSP renderer 仍屬後端與前台導入工作。
- 尚未提供角色權限模型。權限判斷應由 CMS 宿主及後端執行，不能只隱藏前端按鈕。
- admin OpenAPI 的 `ContentBlockDto.data` 是開放 JSON，前端 payload 管線會保留未知欄位；但後端資料庫對 `html`、`css`、`js` 的寫入後讀回仍需實際 API round-trip 驗證。
- `NcdrClient_2026/client` 目前尚未找到 RichText content block renderer，進階內容尚無正式前台發布路徑。
- TinyMCE 官方目前仍要求 host page 與 content iframe 允許 inline style 才能完整運作，因此 admin 無法宣稱符合完全不含 `'unsafe-inline'` 的 strict CSP；script CSP 不需要也不應放寬。

## 字級輸出

### 已實作

- strict mode 的字級選單顯示 `8px`、`12px`、`14px`、`16px`、`18px`、`24px`、`32px`、`48px`。
- 實際輸出使用 `cms-font-size-*px` class，不輸出對應的 px inline style。
- `public/cms-editor/cms-content/formatting.css` 以 rem 定義上述 class，例如 `.cms-font-size-18px { font-size: 1.125rem; }`。
- normal mode 的字級選單沿用相同 px 標示，實際 inline style 輸出 rem；直接輸入字級時預設單位也是 rem。
- 前台必須載入與 Editor 同版的 `formatting.css`，否則 strict mode class 不會有正確視覺效果。

### 已補強、仍需前台驗證

- 先前作者直接輸入 HTML 時，內容預檢不會找出 `font-size: 18px`、`12pt` 等固定單位；目前已補上此缺口。
- `font-size-absolute-unit` 檢查內容 HTML 的 inline style；normal mode 進階 CSS 分頁也會在 `tw-aa-110` profile 標示固定字級單位。這項規則對應官方 `CS2140401C`。
- 200% 文字放大、流動排版、裁切與重疊必須在實際前台版型測試，不能只由 Editor DOM 判定。

## 內容無障礙預檢

目前工具的定位是「內容預檢」，不是完整台灣 AA 檢測器。

| 成功準則／領域 | 目前狀態 | Editor 現有規則或責任邊界 |
| --- | --- | --- |
| 1.1.1 非文字內容 | 部分實作 | `image-alt`、裝飾圖片人工確認 |
| 1.2.2、1.2.3 預錄媒體 | 部分實作 | `video-captions`、`video-text-alternative`；媒體內容品質仍需人工確認 |
| 1.3.1 資訊與關連性 | 部分實作 | 標題、表格、表單 label；複雜語意仍需人工確認 |
| 1.4.3 對比值 | 部分實作 | 依 Editor 目前計算樣式檢查文字對比；前台 CSS 覆寫後需重測 |
| 1.4.4 調整文字尺寸 | 部分實作 | 新增 inline `font-size` 固定單位檢查；200% 實際呈現屬前台測試 |
| 1.4.10 流動排版 | 前台責任 | 必須用實際 viewport、版型及前台 CSS 測試 |
| 1.4.11 非文字對比 | 未實作 | Editor 尚未檢查元件、邊界與圖示對比 |
| 1.4.12 文字間距 | 前台責任 | 必須套用指定文字間距後確認沒有內容或功能損失 |
| 2.1 鍵盤操作 | 分層處理 | Editor 本身與最終前台互動元件需各自測試 |
| 2.4.4 連結目的 | 部分實作 | 缺少名稱為 required；泛用或 URL 文字為 suggestion |
| 2.4.6 標題和標籤 | 部分實作 | 空標題、跳級、表單 label、按鈕名稱 |
| 2.4.7 焦點可視 | 前台責任 | Editor 內容片段無法證明整站焦點呈現 |
| 3.1.1、3.1.2 語言 | 未實作 | 尚未檢查頁面與局部語言；頁面語言主要屬 CMS shell |
| 3.3 輸入協助 | 前台責任 | 需依實際表單流程、錯誤訊息與送出行為測試 |
| 4.1.1 語法分析 | 部分實作 | `duplicate-id`；HTML parser 正規化不等於完整規範檢查 |
| 4.1.2 名稱、角色和值 | 部分實作 | 表單、按鈕、iframe 名稱；自訂 widget 仍需個別測試 |
| 4.1.3 狀態訊息 | 前台責任 | 需依正式互動流程測試 live region／status message |

### 已實作規則清單

- `duplicate-id`
- `heading-empty`
- `heading-order`
- `form-label`
- `button-name`
- `text-contrast`
- `image-alt`
- `image-decorative-review`
- `link-text`
- `iframe-title`
- `table-caption`
- `table-header`
- `table-header-empty`
- `table-header-association`
- `video-captions`
- `video-text-alternative`
- `font-size-absolute-unit`

## 範本、表格與媒體

### 已實作

- 可重用 component 預設停用 CMS 錨點列表範本與自訂表格樣式；demo 會明確啟用供驗證。宿主可分別以 `cmsTemplatesEnabled`、`cmsTableStylesEnabled` 開啟註冊與入口。
- 圖片、影片與 iframe 插入工具目前可由 `mediaInsertion="disabled"` 一次停用。
- 停用媒體插入不會主動刪除既有 HTML 媒體節點。
- Upload result 已支援 `fileGuid` 與 temporary／active state，新上傳的 image／video source 可標記對應檔案識別。
- 已提供 RichText media manifest、新舊引用 delta 與發布 blocker；`blob:`、temporary、admin-only、invalid 與缺少生命週期的 managed media 不可發布。
- 已提供 `fileGuid` 到永久公開 URL 的 fail-closed 副本轉換，供後端實作對等規則。
- 已將整頁媒體解析、內容 policy 與 namespace／render mode 整合為固定順序的原子發布準備 API。
- 已提供 admin ContentBlock data adapter；預設只更新 Catalog 指定的 HTML 欄位，並保留既有 CSS、JavaScript 與未知 JSON 欄位。CSS／JavaScript 只有宿主明確授權時才寫回。

### 確認缺口

- Editor 端已定義 RichText `fileGuid` manifest 與 delta；admin API 後端尚未實作 manifest 重算、Temp → Active 交易、解除引用及永久發布 URL 解析。
- 有檔案庫只能證明檔案可保存；影片仍需確認公開 URL、MIME type、Range Requests、字幕、poster 與可能的轉檔策略。

## 導入 admin 前的處理順序

1. 為現有內容預檢規則建立測試基線，先涵蓋新加入的固定字級規則。
2. 擴充 basic／advanced round-trip 整合測試，涵蓋 TinyMCE 實際 parser 對更多舊 HTML 的處理；目前已有 legacy `<style>` 遷移及一般 HTML 修改保留 CSS／JavaScript 的單元測試。
3. 確認 admin 的 `{ html, css, js }` 儲存及前台發布契約。
4. 媒體引用契約完成前，admin 維持停用新增圖片、影片與 iframe。
