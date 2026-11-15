// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

/**
 * Astro SSR (MPA), .planning/03 §2 and §6.4:
 * - output 'server' + @astrojs/cloudflare: HTML is rendered per navigation, cookie included, on
 *   Cloudflare Workers. Pure Cloudflare free tier — no Node host, no Docker Compose.
 * - dev proxy: /api -> wrangler dev on 8787, so dev is same-origin and no CORS is needed.
 * - no client hydration for page data (R-A5); islands are UI-only (dialog, lightbox, dropzone).
 * - no `server.port`: a Worker has no listen port; `wrangler dev` serves it on 8787.
 */
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true }, imagesBindingName: false }),
  // `imagesBindingName: false` and `session: false` keep this on the Cloudflare free tier: no
  // Images binding (images live in R2, not re-optimised by Astro) and no KV session binding (this
  // app owns its session via the `sid` cookie to the API Worker).
  imageService: 'passthrough',
  session: false,
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
          target: 'http://localhost:8787',
          changeOrigin: false,
        },
      },
    },
  },
});
