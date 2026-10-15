import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * chrome.scripting.executeScript accepts a classic script, not an ES module.
 * Keep the on-demand content bundle self-contained so no page injection can
 * silently fail on unresolved import statements.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/content/index.ts', import.meta.url)),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
  },
})
