import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// PWA plugin will be added after vite-plugin-pwa finishes installing
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
