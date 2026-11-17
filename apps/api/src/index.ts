import { app } from './app';
import type { Env } from './config';
import { getConfig, setEnv } from './context';
import { DEV_ORIGIN, devPreflightResponse, requestIdFrom, securityHeaders } from './lib/http';
import { isoFrom } from './lib/time';
import { attachmentKeysForUser } from './modules/attachments/repo';
import { deleteExpiredSessions } from './modules/auth/repo';

/**
 * Worker entry. Cloudflare calls `fetch(request, env, ctx)`; Elysia only sees the `Request`, so
 * `setEnv(env)` stashes the D1 binding for handlers before delegating to `app.handle`.
 *
 * This wrapper is the single place every response — success, error, 204, 404 — receives the
 * platform headers, so no handler can forget them (§1.6, §6.5 of `.planning/07`).
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    setEnv(env);
    const requestId = requestIdFrom(request);

    const headers = new Headers(request.headers);
    headers.set('x-request-id', requestId);
    const upstream = new Request(request, { headers });

    // Preflight is answered here: Elysia has no OPTIONS route, so a hook would never run.
    const preflight = devPreflightResponse(
      request.method,
      request.headers.get('origin'),
      env.ENVIRONMENT === 'production',
    );
    if (preflight) return withPlatformHeaders(preflight, env, requestId, request.headers.get('origin'));

    const response = await app.handle(upstream);
    return withPlatformHeaders(response, env, requestId, request.headers.get('origin'));
  },

  /**
   * T-511 maintenance. Both sweeps are idempotent and neither is an enforcement path:
   *
   * 1. Expired session rows. Resolution already refuses them (07 §2.4), so deleting them is
   *    hygiene — no security decision depends on this running.
   * 2. Orphan R2 objects. 06 §8.5 writes the binaries before the row and deletes them when the
   *    insert fails, so a crash in between leaves an object no row names. Those keys are
   *    unreachable and are removed here.
   */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    setEnv(env);
    const { db, bucket } = getConfig();
    await deleteExpiredSessions(db, isoFrom(Date.now()));
    await sweepOrphanObjects(db, bucket);
  },
} satisfies ExportedHandler<Env>;

/**
 * Deletes bucket objects that no `attachments` row references. Only keys under a `<uuid>/` prefix
 * are considered, so an object written outside the attachment namespace is never touched.
 */
async function sweepOrphanObjects(db: D1Database, bucket: R2Bucket): Promise<void> {
  const referenced = new Set<string>();
  const users = await db
    .prepare('SELECT DISTINCT user_id FROM attachments')
    .all<{ user_id: string }>();

  for (const { user_id } of users.results ?? []) {
    for (const entry of await attachmentKeysForUser(db, user_id)) {
      referenced.add(entry.storage_key);
      referenced.add(entry.thumb_key);
    }
  }

  const listed = await bucket.list();
  const orphans = listed.objects.filter(
    (object) => !referenced.has(object.key) && /^[0-9a-f-]{36}\//u.test(object.key),
  );
  await Promise.all(orphans.map((object) => bucket.delete(object.key)));
}

function withPlatformHeaders(
  response: Response,
  env: Env,
  requestId: string,
  origin: string | null,
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  if (headers.get('Content-Type') === 'application/json') {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  // Dev only: the Next dev server is a different port, so every response needs the CORS pair.
  if (env.ENVIRONMENT !== 'production' && origin === DEV_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', DEV_ORIGIN);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }
  for (const [name, value] of Object.entries(securityHeaders(env.ENVIRONMENT === 'production'))) {
    if (!headers.has(name)) headers.set(name, value);
  }

  return new Response(response.status === 204 || response.status === 304 ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
