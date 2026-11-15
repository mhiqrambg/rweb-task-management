import { app } from './app';
import type { Env } from './config';
import { requestIdFrom, securityHeaders } from './lib/http';

/**
 * Worker entry. The wrapper is the single place every response — success, error, 204, 404 —
 * receives the platform headers, so no handler can forget them (§1.6, §6.5 of `.planning/07`).
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = requestIdFrom(request);

    const headers = new Headers(request.headers);
    headers.set('x-request-id', requestId);
    const upstream = new Request(request, { headers });

    const response = await app.fetch(upstream, env, ctx);
    return withPlatformHeaders(response, env, requestId);
  },
} satisfies ExportedHandler<Env>;

function withPlatformHeaders(response: Response, env: Env, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  if (headers.get('Content-Type') === 'application/json') {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  for (const [name, value] of Object.entries(securityHeaders(env.ENVIRONMENT === 'production'))) {
    if (!headers.has(name)) headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
