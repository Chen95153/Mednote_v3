# MediScribe AI

Transform Medical Records with AI. Generate professional, academic-grade admission notes from structured inputs using Gemini 1.5 Pro.

## 🚀 快速開始 (Development)

1.  **安裝依賴**:
    ```bash
    npm install
    ```

2.  **啟動開發伺服器**:
    ```bash
    npm run dev
    ```

3.  **建置專案**:
    ```bash
    npm run build
    ```

## 🌐 部署 (Deployment)

本專案已設定 GitHub Actions 自動部署到 GitHub Pages。

### 設定步驟

1.  將程式碼推送到 GitHub 的 `main` 分支。
2.  前往 GitHub Repository 的 **Settings** > **Pages**。
3.  在 **Build and deployment** 區塊：
    - **Source**: 選擇 `GitHub Actions`
4.  之後每次推送到 `main` 分支，GitHub Actions 將會自動建置並部署最新版本。

### 手動部署 (Optional)

若需手動建置：

```bash
npm run build
```

建置產物位於 `dist` 資料夾。

## ⚠️ Firebase 設定提醒

部署後，請記得：
1. 開啟您的網站 (e.g., `https://username.github.io/repo-name/`).
2. 查看登入畫面右下角的 **Detected Domain**。
3. 將該網域加入 Firebase Console 的 Authorized Domains 白名單中。
