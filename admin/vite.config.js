import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // In a monorepo/workspace setup, deps get hoisted to root node_modules.
    // Tell Vite to look there too.
    dedupe: ['framer-motion', 'react', 'react-dom'],
  },
  server: {
    host: true,
    port: 3001,
    allowedHosts: ['admin.letsfira.com'],
    fs: {
      // Allow serving files from the root node_modules (hoisted deps)
      allow: [path.resolve(__dirname, '..')],
    },
  },
  preview: {
    host: true,
    port: 3001,
    allowedHosts: ['admin.letsfira.com'],
  }
})