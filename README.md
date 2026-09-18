# TinyMCE Editor

使用 Vue 3、TypeScript、Vite 與 TinyMCE 8.9.1 建立的自託管 CMS 編輯器。專案包含 demo，以及可搬入其他 Vue 3 後台的 `src/editor` 原始碼模組。

可重用 component 採保守預設：strict、台灣 AA profile，並停用進階工作區、媒體插入、測試範本及特規表格。`src/App.vue` 是功能驗證 demo，會明確開啟這些能力；demo 行為不可直接當成 admin 上線設定。

## 環境需求

- Node.js 22 LTS（最低需求：`^20.19.0` 或 `>=22.12.0`）
- pnpm 9 以上

## 安裝與啟動

```powershell
pnpm install
pnpm dev
```

開發網址：<http://localhost:5180>

## 環境設定

需要調整 demo 設定時，將 `.env.example` 複製為 `.env`：

```powershell
Copy-Item .env.example .env
```

| 變數 | 可用值 | 預設值 |
| --- | --- | --- |
| `VITE_EDITOR_MODE` | `strict`、`normal` | `strict` |
| `VITE_ACCESSIBILITY_PROFILE` | `content-quality`、`tw-aa-110` | `content-quality` |
| `VITE_UPLOAD_ENDPOINT` | 上傳 API URL | 使用本機預覽 adapter |

- `strict`：使用受管理的 CMS 格式與 class。
- `normal`：提供一般／進階工作區，可編輯 HTML、CSS、JavaScript。

修改 `.env` 後需重新啟動 `pnpm dev`。

## Demo 圖片與影片上傳

未設定 `VITE_UPLOAD_ENDPOINT` 時，demo 使用 `blob:` URL 做本機預覽，重新整理後不會保留。

內建通用 HTTP adapter 使用 `multipart/form-data`：

- `file`：圖片或影片檔案
- `kind`：`image` 或 `video`

後端需回傳：

```json
{
  "src": "https://example.com/uploads/file.jpg",
  "fileGuid": "7f5d...",
  "fileState": "temporary"
}
```

`fileGuid` 與 `fileState` 若提供就必須成對回傳。正式檔案庫整合還必須在發布前將 temporary 檔案轉為 active，並以 `fileGuid` 解析永久公開 URL；不可直接發布 `blob:`、`/temp/` 或 admin download URL。

目前 admin 的 Message asset endpoint 回傳 ContentBlock 資料，不符合這個通用 adapter 的 response contract，也尚未證實 RichText 多媒體引用與永久公開 URL 流程；正式接入前應維持 `mediaInsertion="disabled"`，不可直接填入 endpoint 就宣稱完成。

檔案限制：

- 圖片：JPEG、PNG、WebP、GIF，最大 5 MB
- 影片：MP4、WebM，最大 200 MB

## 開發指令

```powershell
pnpm dev        # 啟動開發伺服器
pnpm typecheck  # 型別檢查
pnpm test       # 執行測試
pnpm build      # 建置 production 版本
pnpm preview    # 預覽 production build，使用 4180 port
```

修改後請至少執行：

```powershell
pnpm typecheck
pnpm test
```

## 專案結構

```text
src/App.vue          demo 頁面
src/editor/          可重用的 editor 原始碼
tests/editor/        editor 測試（依 src/editor 結構排列，不隨 runtime 搬移）
public/cms-editor/   語言包與自託管靜態資源
docs/                規格與整合文件
```

將 editor 搬入其他 Vue 3 後台時，需同時搬移 `src/editor` 與 `public/cms-editor`，詳細方式請參閱 [Vue 3 專案整合說明](docs/integration.md)。

## 相關文件

- [Editor 現況與缺口盤點](docs/current-state-audit.md)
- [admin RichText 整合契約盤點](docs/admin-integration-contract.md)
- [專案規格](docs/project-spec.md)
- [Editor 使用體驗](docs/editor-experience.md)
- [Vue 3 專案整合說明](docs/integration.md)
- [產品定位與方向](docs/vision.md)
