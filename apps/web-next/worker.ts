/**
 * Production host for the Next.js static export on Cloudflare Workers.
 *
 * Wrangler Static Assets is configured with:
 *   directory: ./out
 *   base_path: /b
 *   not_found_handling: 404-page
 *
 * Requests to /b/ and /b/<page>/ are resolved from the root of ./out.
 * Cloudflare normally serves matching assets directly, before invoking this Worker.
 *
 * Requests that reach this Worker:
 * - /api/*: proxy to the API service binding with headers and session cookies preserved.
 * - /b/*: forward the original public URL to the ASSETS binding (do not strip /b).
 * - anything else: return 404. In particular, / is not a mounted asset URL.
 *
 * No SSR, no dynamic HTML rendering, and no authorization decision in this Worker.
 */

interface Env {
  ASSETS: Fetcher;
  /** Service binding for `rweb-api-production`; may be absent in local preview. */
  API?: Fetcher;
}

const MOUNT = '/b';
const API_PREFIX = '/api/';
/** Local fallback for Wrangler dev without remote service bindings. */
const DEV_API = 'http://localhost:8787';

/** Hop-by-hop headers must not be forwarded; host is set by the upstream URL. */
const SKIPPED_HEADERS: Record<string, true> = {
  host: true,
  connection: true,
  'content-length': true,
  'keep-alive': true,
  'proxy-authenticate': true,
  'proxy-authorization': true,
  te: true,
  trailer: true,
  'transfer-encoding': true,
  upgrade: true,
};

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!SKIPPED_HEADERS[name.toLowerCase()]) headers.set(name, value);
  });
  return headers;
}

/** Preserve multiple Set-Cookie headers when the upstream returns them. */
function forwardResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers);
  const cookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  if (cookies.length > 1) {
    headers.delete('set-cookie');
    for (const cookie of cookies) headers.append('set-cookie', cookie);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function proxyApi(request: Request, url: URL, api: Fetcher | undefined): Promise<Response> {
  const pathAndQuery = `${url.pathname}${url.search}`;
  const target = new URL(pathAndQuery, api ? 'https://api.internal' : DEV_API).toString();
  const body = request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer();
  const upstream = await (api ?? fakeFetcher()).fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    body,
  });
  return forwardResponse(upstream);
}

/** Local preview fallback if an API service binding is not configured. */
function fakeFetcher(): Fetcher {
  return {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  } as unknown as Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === API_PREFIX || url.pathname.startsWith(API_PREFIX)) {
      return proxyApi(request, url, env.API);
    }

    if (url.pathname !== MOUNT && !url.pathname.startsWith(`${MOUNT}/`)) {
      return new Response('Not Found', { status: 404 });
    }

    // base_path=/b: keep the public path intact when fetching static assets.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
