
/**
 * Cloudflare Worker for Next.js Static Site Generation (SSG).
 *
 * Static Assets configuration in wrangler.jsonc:
 *
 * "assets": {
 *   "directory": "./out",
 *   "binding": "ASSETS",
 *   "base_path": "/b",
 *   "not_found_handling": "404-page"
 * }
 *
 * Routing:
 * - /b/*   : Next.js static assets and pages
 * - /api/* : Proxy to the backend API service binding
 * - Others : HTTP 404
 *
 * The Worker does not implement SSR or authentication.
 * Authentication remains the responsibility of the API.
 */

interface Env {
  ASSETS: Fetcher;

  /** Cloudflare service binding for rweb-api-production. */
  API?: Fetcher;
}

const MOUNT = '/b';
const API_PREFIX = '/api';

/**
 * Local development API.
 * Used only when the API service binding is unavailable.
 */
const DEV_API = 'http://localhost:8787';

/**
 * HTTP hop-by-hop headers must not be forwarded.
 */
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

/**
 * Prepare request headers for forwarding to the API.
 *
 * Preserves authorization, cookies, origin,
 * content-type, and other end-to-end headers.
 */
function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();

  request.headers.forEach((value, name) => {
    if (!SKIPPED_HEADERS[name.toLowerCase()]) {
      headers.set(name, value);
    }
  });

  return headers;
}

/**
 * Forward the API response to the browser.
 *
 * Preserves HTTP status, body, and response headers,
 * including multiple Set-Cookie headers.
 */
function forwardResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers);

  const cookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [];

  if (cookies.length > 1) {
    headers.delete('set-cookie');

    for (const cookie of cookies) {
      headers.append('set-cookie', cookie);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

/**
 * Proxy API requests through a Cloudflare service binding.
 *
 * Requests are forwarded without changing their API path,
 * query parameters, authentication cookies, or Origin header.
 */
async function proxyApi(
  request: Request,
  url: URL,
  api: Fetcher | undefined
): Promise<Response> {
  const pathAndQuery = `${url.pathname}${url.search}`;

  const target = new URL(
    pathAndQuery,
    api ? 'https://api.internal' : DEV_API
  ).toString();

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? null
      : await request.arrayBuffer();

  const upstream = await (api ?? fakeFetcher()).fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    body,
  });

  return forwardResponse(upstream);
}

/**
 * Local development fallback.
 *
 * Used when running Wrangler without a configured
 * remote API service binding.
 */
function fakeFetcher(): Fetcher {
  return {
    fetch: (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => fetch(input, init),
  } as unknown as Fetcher;
}

/**
 * Main Cloudflare Worker entry point.
 */
export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ----------------------------------------
    // 1. API ROUTING
    // ----------------------------------------

    if (
      pathname === API_PREFIX ||
      pathname.startsWith(`${API_PREFIX}/`)
    ) {
      return proxyApi(request, url, env.API);
    }

    // ----------------------------------------
    // 2. NEXT.JS ROUTING
    // ----------------------------------------

    if (
      pathname !== MOUNT &&
      !pathname.startsWith(`${MOUNT}/`)
    ) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // ----------------------------------------
    // 3. STATIC ASSETS
    // ----------------------------------------

    /**
     * With assets.base_path = "/b", the public path
     * must be preserved when calling ASSETS.fetch().
     *
     * Example:
     * /b/login/ -> out/login/index.html
     *
     * Do not strip the /b prefix here.
     */

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
