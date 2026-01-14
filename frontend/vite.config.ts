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
    // Cloudflare Quick Tunnel(https://xxxxx.trycloudflare.com) 등 외부 호스트로 접속 시
    // Vite의 host 체크에 의해 차단될 수 있으므로 허용 목록에 추가
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        // 프론트는 IP로 접속하더라도, 프록시는 로컬 백엔드로 보내면 됨
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  }
})


