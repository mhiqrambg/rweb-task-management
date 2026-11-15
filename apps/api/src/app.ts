import { copy } from '@taskapp/contracts';
import { Hono } from 'hono';
import { loadConfig } from './config';
import type { AppEnv } from './context';
import { ApiError } from './lib/errors';
import { errorResponse } from './lib/http';
import { authRoutes } from './modules/auth/routes';
import { healthRoutes } from './modules/health/routes';

export const app = new Hono<AppEnv>();

const UNSAFE_METHODS: Record<string, true> = { POST: true, PATCH: true, PUT: true, DELETE: true };
const DEV_ORIGIN = 'http://localhost:3000';

/** Config and request identity first, so every later failure can answer with an envelope. */
app.use('*', async (c, next) => {
  const started = performance.now();
  c.set('config', loadConfig(c.env));
  c.set('requestId', c.req.header('x-request-id') ?? crypto.randomUUID());
  c.set('userId', null);

  await next();

  console.log(
    JSON.stringify({
      level: 'info',
      requestId: c.get('requestId'),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Math.round(performance.now() - started),
      userId: c.get('userId'),
    }),
  );
});

/**
 * §2.5: unsafe methods need a same-origin `Origin`, or `Sec-Fetch-Site: same-origin` when the
 * browser omits it. A refusal is `401 UNAUTHENTICATED`, deliberately identical to no session.
 */
app.use('*', async (c, next) => {
  const cfg = c.get('config');
  const origin = c.req.header('origin');

  if (!cfg.isProduction && origin === DEV_ORIGIN) {
    c.header('Access-Control-Allow-Origin', DEV_ORIGIN);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
    c.header('Vary', 'Origin');
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
  }

  if (UNSAFE_METHODS[c.req.method]) {
    const sameOrigin = origin
      ? origin === cfg.appOrigin
      : c.req.header('sec-fetch-site') === 'same-origin';
    if (!sameOrigin) throw new ApiError('UNAUTHENTICATED', copy.auth.error.sessionExpired);
  }

  await next();
});

app.route('/', authRoutes);
app.route('/', healthRoutes);

app.notFound((c) => errorResponse(c, 'NOT_FOUND', copy.state.notFound.body));

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return errorResponse(c, error.code, error.message, error.details, error.headers);
  }
  console.error(
    JSON.stringify({
      level: 'error',
      requestId: c.get('requestId') ?? 'unknown',
      message: error instanceof Error ? error.message : 'unknown',
    }),
  );
  return errorResponse(c, 'INTERNAL', copy.state.error.body);
});
