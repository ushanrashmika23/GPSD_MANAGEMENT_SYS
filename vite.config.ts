import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Pinned dev/preview port. The browser origin is part of the R2 bucket's CORS
// policy, so a silently-changing port breaks direct uploads with an opaque
// preflight error. Vite's default behaviour is to increment the port when one
// is busy (5173 → 5174 → ...), which is exactly how the upload origin drifts
// out of the allowed list — so pin it, and fail loudly instead of drifting.
const DEV_PORT = 5174


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  // Firebase signInWithPopup needs to poll the cross-origin Google popup
  // (window.closed). COOP "same-origin-allow-popups" keeps that working —
  // "same-origin" would isolate the page and block access to the popup.
  server: {
    port: DEV_PORT,
    strictPort: true, // never fall back to another origin — see DEV_PORT above
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    // Forward API calls to the backend so dev requests are same-origin
    // (no CORS involved at all).
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: DEV_PORT,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
