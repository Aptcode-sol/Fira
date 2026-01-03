import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3001,
    allowedHosts: ['admin.letsfira.com'],
  },
  preview: {
    host: true,
    port: 3001,
    allowedHosts: ['admin.letsfira.com'],
  }
})