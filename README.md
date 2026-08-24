# TinyMCE Editor

使用 Vue 3、TypeScript、Vite 與 TinyMCE 8 建立的自託管 CMS 編輯器。專案包含 demo，以及可搬入其他 Vue 3 後台的 `src/editor` 原始碼模組。

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

## 圖片與影片上傳

未設定 `VITE_UPLOAD_ENDPOINT` 時，demo 使用 `blob:` URL 做本機預覽，重新整理後不會保留。

正式上傳使用 `multipart/form-data`：

- `file`：圖片或影片檔案
- `kind`：`image` 或 `video`

後端需回傳：

```json
{
  "src": "https://example.com/uploads/file.jpg"
}
```

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
public/cms-editor/   語言包與自託管靜態資源
docs/                規格與整合文件
```

將 editor 搬入其他 Vue 3 後台時，需同時搬移 `src/editor` 與 `public/cms-editor`，詳細方式請參閱 [Vue 3 專案整合說明](docs/integration.md)。

## 相關文件

- [專案規格](docs/project-spec.md)
- [Editor 使用體驗](docs/editor-experience.md)
- [Vue 3 專案整合說明](docs/integration.md)
- [產品定位與方向](docs/vision.md)
