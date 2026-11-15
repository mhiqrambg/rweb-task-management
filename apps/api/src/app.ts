import { copy } from '@taskapp/contracts';
import { Elysia } from 'elysia';
import { getConfig } from './context';
import { ApiError } from './lib/errors';
import { errorResponse, requestIdFrom } from './lib/http';
import { authRoutes } from './modules/auth/routes';
import { healthRoutes } from './modules/health/routes';

const UNSAFE_METHODS: Record<string, true> = { POST: true, PATCH: true, PUT: true, DELETE: true };
const DEV_ORIGIN = 'http://localhost:3000';

/**
 * The Elysia app. The `onBeforeHandle` hook replicates the old Hono same-origin middleware
 * (`.planning/07` §6.2): unsafe methods need a same-origin `Origin` (or `Sec-Fetch-Site` when the
 * browser omits it); a refusal is `401 UNAUTHENTICATED`, identical to an absent session.
 *
 * Request-id, platform/security headers, error handling and structured logging live in the Worker
 * entry (`index.ts`), which is the only place a response leaves the Worker.
 */
export const app = new Elysia({
  // Workers block `new Function` at runtime, so Elysia must build its handlers with the
  // dynamic (non-AoT) composer. See the docs' Cloudflare Worker 'Limitations' section.
  aot: false,
})
  // Elysia reads the body once here; handlers then parse that text themselves (`parseJsonBody`),
  // so a request stream is never consumed twice. Returning `undefined` for a bodyless method
  // leaves the default behaviour untouched.
  .onParse(({ request }: { request: Request }) => {
    if (request.method === 'GET' || request.method === 'HEAD') return undefined;
    return request.text();
  })
  .onBeforeHandle(async ({ request }: { request: Request }) => {
    const config = getConfig();
    const origin = request.headers.get('origin');

    if (!config.isProduction && origin === DEV_ORIGIN) {
      // CORS is dev-only (`origin: localhost:3000`); the production origin needs no CORS headers.
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': DEV_ORIGIN,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Request-Id',
            Vary: 'Origin',
          },
        });
      }
    }

    if (UNSAFE_METHODS[request.method]) {
      const sameOrigin = origin
        ? origin === config.appOrigin
        : request.headers.get('sec-fetch-site') === 'same-origin';
      if (!sameOrigin) throw new ApiError('UNAUTHENTICATED', copy.auth.error.sessionExpired);
    }
  })
  .use(authRoutes)
  .use(healthRoutes)
  // Let Elysia infer the handler's context type; annotating it defeats the inference.
  .onError(({ request, code, error, set }) => {
    // Unmatched route → `NOT_FOUND` envelope, identical to a foreign-owned resource (§1.9).
    const requestId = requestIdFrom(request);
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return errorResponse(requestId, 'NOT_FOUND', copy.state.notFound.body);
    }
    return handleApiError(error, requestId);
  })

export function handleApiError(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) {
    return errorResponse(requestId, error.code, error.message, error.details, error.headers);
  }
  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'unknown',
    }),
  );
  return errorResponse(requestId, 'INTERNAL', copy.state.error.body);
}
