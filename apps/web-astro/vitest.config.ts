import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the server layer: the session cookie mirror and the contract-first mock.
 * No DOM, no Astro runtime: the app's pages are verified against the production build (09 §4).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
