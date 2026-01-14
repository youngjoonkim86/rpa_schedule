import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // 0.0.0.0 바인딩 (IP로 접속 가능)
    proxy: {
      '/api': {
        // 프론트는 IP로 접속하더라도, 프록시는 로컬 백엔드로 보내면 됨
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  }
})


