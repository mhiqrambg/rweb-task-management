/**
 * Production host for the Next.js static export on a Cloudflare Worker with Static Assets.
 *
 * ADR-04/ADR-05/ADR-15: both member frontends share one origin; the zone routes `/b/*` to this
 * Worker while Astro owns `/`. The static export (`out/`, `basePath: '/b'`) has no `/b` directory
 * and its asset URLs start with `/b/`, so this entry strips the mount prefix and lets the ASSETS
 * binding serve the file underneath. Anything outside `/b` that reaches the Worker is not ours:
 * 404, never a fallback page. (With the default assets-first order, exact file hits such as the
 * bare `/` landing on the Worker's own dev domain are served without invoking this entry; the zone
 * never sends those paths here.)
 *
 * No SSR, no middleware, no per-request HTML (`.planning/14` §10): the Worker is a prefix strip
 * in front of static files. Session and data stay in the browser via the same-origin API.
 */

interface Env {
  ASSETS: Fetcher;
}

const MOUNT = '/b';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== MOUNT && !url.pathname.startsWith(`${MOUNT}/`)) {
      return new Response('Not Found', { status: 404 });
    }
    const stripped = url.pathname.slice(MOUNT.length) || '/';
    return env.ASSETS.fetch(new Request(`${url.origin}${stripped}${url.search}`, request));
  },
} satisfies ExportedHandler<Env>;
