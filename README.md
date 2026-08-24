# TinyMCE Editor

使用 Vue 3、TypeScript、Vite 與 TinyMCE 8 建立的自託管編輯器。

## 開發

```powershell
pnpm install
pnpm dev
```

開發網址為 `http://localhost:5180`。

## 引用至其他 Vue 3 後台

本專案不發布 npm package。可重用程式集中於 `src/editor`，self-hosted 靜態資產集中於 `public/cms-editor`；整合與更新方式請參閱 [Vue 3 後台整合](docs/integration.md)。

## 圖片與影片上傳

Editor 使用可替換的 `UploadAdapter`，不綁定特定後端服務。

- 圖片：JPEG、PNG、WebP、GIF，最大 5 MB。
- 影片：MP4、WebM，最大 200 MB。
- 圖片支援工具列選檔、拖放與貼上。
- 影片支援檔案選擇或直接輸入 URL。

demo 未設定 `VITE_UPLOAD_ENDPOINT` 時會明確使用 `localPreviewUploadAdapter` 產生 `blob:` 本機預覽網址。可重用 component 本身不會自動 fallback；後台若未傳入 adapter，上傳會顯示設定錯誤，避免把暫存網址存入正式內容。

正式環境請複製 `.env.example` 為 `.env`，並設定：

```dotenv
VITE_UPLOAD_ENDPOINT=/api/uploads
```

上傳請求使用 `multipart/form-data`：

- `file`：圖片或影片檔案。
- `kind`：`image` 或 `video`。

後端成功時應回傳：

```json
{
  "src": "https://example.com/uploads/file.jpg"
}
```

`src` 必須是可永久存取的檔案 URL。

## 驗證

```powershell
pnpm typecheck
pnpm test
pnpm build
```
