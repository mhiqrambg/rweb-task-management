import { apiBaseUrl } from './env';

/**
 * Reverse proxy for `/api/*` from the Astro Worker.
 *
 * Attachment URLs are returned by the API as **relative** paths
 * (`/api/v1/attachments/<id>/content?variant=thumb`, 06 §3.4), so the browser requests them from the
 * page's own origin. In production that origin is this Worker, which therefore has to forward the
 * request to the API Worker; without this every attachment and every client-side fetch 404s.
 *
 * Production uses the `API` service binding (a Worker cannot fetch another Worker on
 * `workers.dev` — Cloudflare error 1042). A local run has no such Worker, so the request goes to the
 * configured base URL instead. Either way the browser's `Cookie` and `Origin` headers are forwarded
 * untouched, so the API's own session and same-origin rules still decide (07 §6.2); this proxy makes
 * no access decision of its own.
 */

const HOP_BY_HOP: Record<string, true> = {
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

interface ApiBinding {
  fetch: typeof fetch;
}

interface WorkerRuntime {
  env: { API?: ApiBinding | undefined };
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!HOP_BY_HOP[name.toLowerCase()]) headers.set(name, value);
  });
  return headers;
}

/** Every `Set-Cookie` survives: one response can refresh the session and clear another. */
function copyResponse(upstream: Response): Response {
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

async function serviceBinding(): Promise<ApiBinding | null> {
  const base = apiBaseUrl();
  const { hostname } = new URL(base);
  // Local dev points at a plain http origin; the binding would still target production.
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  try {
    // Dynamic on purpose: `cloudflare:workers` exists only in the Workers runtime.
    const runtime = (await import('cloudflare:workers')) as unknown as WorkerRuntime;
    return runtime.env.API ?? null;
  } catch {
    return null;
  }
}

export async function proxyApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = `${new URL(apiBaseUrl()).origin}${url.pathname}${url.search}`;
  const init: RequestInit = {
    method: request.method,
    headers: forwardedHeaders(request),
    body: request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer(),
  };

  const service = await serviceBinding();
  const upstream = service
    ? await service.fetch(target, init)
    : await fetch(target, init);
  return copyResponse(upstream);
}