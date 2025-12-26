import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 設定為 './' 代表使用相對路徑
  // 這能讓網站無論部署在 https://user.github.io/repo/ 還是根目錄都能正常運作
  // 解決 GitHub Pages 常見的白屏或資源 404 問題
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})