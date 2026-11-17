import { copy } from '@taskapp/contracts';
import { Elysia } from 'elysia';
import { getConfig } from './context';
import { ApiError } from './lib/errors';
import { DEV_ORIGIN, errorResponse, requestIdFrom } from './lib/http';
import { adminRoutes } from './modules/admin/routes';
import { attachmentsRoutes } from './modules/attachments/routes';
import { authRoutes } from './modules/auth/routes';
import { healthRoutes } from './modules/health/routes';
import { notesRoutes } from './modules/notes/routes';
import { tasksRoutes } from './modules/tasks/routes';
import { usersRoutes } from './modules/users/routes';

const UNSAFE_METHODS: Record<string, true> = { POST: true, PATCH: true, PUT: true, DELETE: true };

/**
 * The Elysia app. The `onBeforeHandle` hook enforces the same-origin rule
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
  // JSON bodies are read once here so handlers never touch the stream twice (`parseJsonBody`).
  // A multipart body must reach the upload route as bytes: it parses the multipart framing itself,
  // and a text decode would corrupt the image payload. Returning `undefined` leaves a bodyless
  // method untouched.
  .onParse(({ request }: { request: Request }) => {
    if (request.method === 'GET' || request.method === 'HEAD') return undefined;
    if ((request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
      return request.arrayBuffer();
    }
    return request.text();
  })
  .onBeforeHandle(async ({ request }: { request: Request }) => {
    const config = getConfig();
    const origin = request.headers.get('origin');

    if (UNSAFE_METHODS[request.method]) {
      // Dev runs two frontends on different ports (Astro :4321, Next :3000); both are same-site here.
      const sameOrigin = origin
        ? origin === config.appOrigin ||
          origin === config.nextOrigin ||
          (!config.isProduction && origin === DEV_ORIGIN)
        : request.headers.get('sec-fetch-site') === 'same-origin';
      if (!sameOrigin) throw new ApiError('UNAUTHENTICATED', copy.auth.error.sessionExpired);
    }
  })
  .use(authRoutes)
  .use(usersRoutes)
  .use(healthRoutes)
  .use(tasksRoutes)
  .use(notesRoutes)
  .use(attachmentsRoutes)
  .use(adminRoutes)
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
