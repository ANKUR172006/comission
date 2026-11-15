import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // the API server runs separately on port 4000
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
