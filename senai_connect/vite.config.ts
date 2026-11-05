import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    // Tudo que começa com /api vai para a API Node (pasta server)
    proxy: { '/api': 'http://localhost:3001' },
  },
})
