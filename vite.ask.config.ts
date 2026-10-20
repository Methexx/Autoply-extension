import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', emptyOutDir: false, minify: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/content/ask/index.tsx', import.meta.url)),
      output: { format: 'iife', entryFileNames: 'ask.js', inlineDynamicImports: true },
    },
  },
})
