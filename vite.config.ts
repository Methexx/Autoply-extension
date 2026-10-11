import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    // Keep output readable during development review
    minify: false,
    rollupOptions: {
      // chrome.scripting can inject only packaged JavaScript files. This entry is
      // deliberately not declared as an always-on manifest content script.
      input: {
        content: fileURLToPath(new URL('./src/content/index.ts', import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'content' ? 'content.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
})
