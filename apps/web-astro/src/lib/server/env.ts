/**
 * Server-side configuration for the Astro app.
 *
 * PUBLIC_API_BASE_URL is read with process.env at request time, never with import.meta.env: the
 * value must not be baked into the build (03 §7, O-11). API_MODE selects the contract-first
 * dummy dataset so the SSR screens can be built and reviewed before the Worker lands (13 §2,
 * "independent: page/layout/components against a contract-first mock").
 *
 * Local development: `wrangler.jsonc` carries the **production** API origin, because the same file
 * configures the deploy. A `wrangler dev` run therefore reads production unless
 * `PUBLIC_API_BASE_URL` is overridden for that run only — `--var PUBLIC_API_BASE_URL:…` merges over
 * the file. Overriding it in `wrangler.jsonc` itself would ship the local address to production, so
 * it must stay a per-run flag (see `.env.example` and `README.md`).
 */

export type ApiMode = 'live' | 'mock';

export function apiMode(): ApiMode {
  const mode = process.env.API_MODE;
  if (mode === 'live' || mode === 'mock') return mode;
  return process.env.PUBLIC_API_BASE_URL ? 'live' : 'mock';
}

export function apiBaseUrl(): string {
  return (process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787/api/v1').replace(/\/+$/, '');
}

export function appOrigin(): string {
  return process.env.APP_ORIGIN ?? 'http://localhost:4321';
}

/**
 * True for a production build, false under `astro dev`.
 *
 * Derived from the build rather than NODE_ENV: `node ./dist/server/entry.mjs` does not set
 * NODE_ENV, and the CSP and the Secure cookie flag must not silently disappear from the artifact
 * that is actually served (07 §6.5). This is a build-mode switch, not deployment configuration;
 * PUBLIC_API_BASE_URL stays on process.env so a build never bakes it in (O-11).
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}
