/**
 * Production host for the Next.js static export on a Cloudflare Worker with Static Assets.
 *
 * Routing truth (Workers Static Assets `routing/static-site-generation`): a request that
 * matches a file in `out/` is served directly and this entry never runs — that includes `/`
 * (`out/index.html`) and every page/asset at the export root, for navigations and `fetch`
 * alike. Only requests with no asset match reach this entry:
 *
 * - `/api/*`: the static export fetches the API same-origin (`NEXT_PUBLIC_API_ORIGIN` is empty in
 *   `build:prod`), so every browser request lands here. It is forwarded over the `API` service
 *   binding — Worker-to-Worker `fetch` between `*.workers.dev` hosts is blocked by Cloudflare
 *   (error 1042) — with the session cookie and the `Origin` header untouched, so the API's own
 *   same-origin guard (`07` §6.2) still decides.
 * - anything else: served through the ASSETS binding as-is (the export writes `app/`, `login/` … at
 *   the asset root). A path with no matching file falls back to `404.html` via `not_found_handling`.
 *
 * There is no mount prefix: the export is built without `basePath`, so asset and RSC payload URLs
 * carry no prefix and the worker must not strip one.
 *
 * No SSR, no middleware, no per-request HTML (`.planning/14` §10): the Worker is a transparent file
 * server plus an API hop. It owns no authorisation decision, no cache and no body rewriting.
 */

interface Env {
  ASSETS: Fetcher;
  /** `rweb-api-production`. Absent only under `wrangler dev` without remote bindings. */
  API?: Fetcher;
}

const API_PREFIX = '/api/';
/** Fallback for `wrangler dev` preview: the ElysiaJS dev server on :8787. */
const DEV_API = 'http://localhost:8787';

/** Hop-by-hop headers must not be forwarded; `host` comes from the upstream URL. */
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

/** Keeps every `Set-Cookie`: one response can refresh the session and clear it. */
function forwardResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers);
  const cookies =
    typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
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

/**
 * `/api/*` hop. Two transports, one contract:
 *
 * - **Production** uses the `API` service binding: `fetch` between `*.workers.dev` Workers is blocked
 *   by Cloudflare (error 1042), so the binding is the only path.
 * - **Local `wrangler dev --local`** resolves the binding but has no `rweb-api` Worker to forward to,
 *   so it answers a gateway error. A gateway error therefore retries against the ElysiaJS dev server
 *   on `DEV_API`. In production that retry cannot succeed (nothing listens on localhost:8787), so the
 *   original binding response is returned and a genuine outage is never masked.
 *
 * Neither branch makes an access decision: the API's own session and same-origin checks decide, and
 * `Cookie` / `Origin` are forwarded untouched (07 §6.2).
 */
const GATEWAY_STATUS: Record<number, true> = { 502: true, 503: true, 504: true };

async function proxyApi(request: Request, url: URL, api: Fetcher | undefined): Promise<Response> {
  const pathAndQuery = `${url.pathname}${url.search}`;
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer();
  const init: RequestInit = {
    method: request.method,
    headers: forwardedHeaders(request),
    body,
  };

  const target = new URL(pathAndQuery, api ? 'https://api.internal' : DEV_API).toString();
  const upstream = await (api ?? fakeFetcher()).fetch(target, init);

  if (api && GATEWAY_STATUS[upstream.status]) {
    try {
      const local = await fakeFetcher().fetch(new URL(pathAndQuery, DEV_API).toString(), init);
      return forwardResponse(local);
    } catch {
      return forwardResponse(upstream);
    }
  }
  return forwardResponse(upstream);
}

/** `wrangler dev` preview without remote bindings reaches the ElysiaJS dev server directly. */
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

    // Without `basePath` the export writes `app/`, `login/` … at the asset root, so serve the path
    // as-is; the client's RSC payload URLs carry no prefix either.
    return env.ASSETS.fetch(new Request(`${url.origin}${url.pathname}${url.search}`, request));
  },
} satisfies ExportedHandler<Env>;
