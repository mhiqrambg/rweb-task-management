// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

/**
 * Astro SSR (MPA), .planning/03 §2 and §6.4:
 * - output 'server' + @astrojs/node standalone: HTML is rendered per navigation, cookie included.
 * - dev proxy: /api -> Fastify on 3001, so dev is same-origin and no CORS is needed.
 * - no client hydration for page data (R-A5); islands are UI-only (dialog, lightbox, dropzone).
 */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321, host: true },
  devToolbar: { enabled: false },
  // CSP is `style-src 'self'` (07 §6.5): no stylesheet may be inlined into the document.
  build: { inlineStylesheets: 'never' },
  security: {
    // Form actions post multipart uploads; the API still enforces 5 MB per file (06 §8.2).
    actionBodySizeLimit: 64 * 1024 * 1024,
  },
  vite: {
    build: {
      // CSP is `script-src 'self'` (07 §6.5): Astro must emit every script as a file, never
      // inline it. Inlining is governed by assetsInlineLimit, not by inlineStylesheets.
      assetsInlineLimit: 0,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: false,
        },
      },
    },
  },
});
