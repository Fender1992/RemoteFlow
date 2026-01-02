import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

// Custom plugin to copy popup HTML to correct location
function copyPopupHtml() {
  return {
    name: 'copy-popup-html',
    writeBundle() {
      const srcHtml = resolve(__dirname, 'src/popup/index.html')
      const distDir = resolve(__dirname, 'dist/popup')
      const destHtml = resolve(distDir, 'index.html')

      // Update HTML to reference correct JS path
      let html = readFileSync(srcHtml, 'utf-8')
      html = html.replace('src="main.tsx"', 'src="index.js"')
      html = html.replace('href="styles.css"', 'href="../content/styles/popup.css"')

      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true })
      }
      writeFileSync(destHtml, html)
    },
  }
}

export default defineConfig({
  plugins: [react(), copyPopupHtml()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        popup: resolve(__dirname, 'src/popup/main.tsx'),
      },
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'shared/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'content/styles/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  publicDir: 'public',
})
