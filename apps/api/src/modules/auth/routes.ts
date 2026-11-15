import {
  api,
  copy,
  defaultDisplayName,
  loginSchema,
  registerSchema,
  validationDetails,
  type SessionProbe,
} from '@taskapp/contracts';
import { Hono } from 'hono';
import type { ZodError } from 'zod';
import type { AppEnv } from '../../context';
import { clearedSessionCookie, sessionCookie } from '../../lib/cookie';
import { ApiError } from '../../lib/errors';
import { clientIp, readJson } from '../../lib/http';
import { base64Url, newUuid, sha256 } from '../../lib/ids';
import { consumeRateLimit, peekRateLimit, rateLimitError } from '../../lib/rate-limit';
import { isoFrom } from '../../lib/time';
import { burnPasswordCheck, hashPassword, verifyPassword } from './password';
import { createUserWithSession, deleteSessionById, findUserByEmail, type UserRow } from './repo';
import { issueSession, persistSession, resolveSession, userFromRow } from './session';

export const authRoutes = new Hono<AppEnv>();

const AUTH_IP_BUCKET = 'auth-ip';
const AUTH_IP_LIMIT = 10;
const AUTH_IP_WINDOW_SECONDS = 60;

const LOGIN_FAIL_BUCKET = 'login-fail';
const LOGIN_FAIL_LIMIT = 5;
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;

async function enforceAuthIpLimit(db: D1Database, request: Request): Promise<void> {
  const outcome = await consumeRateLimit(
    db,
    AUTH_IP_BUCKET,
    clientIp(request),
    AUTH_IP_LIMIT,
    AUTH_IP_WINDOW_SECONDS,
  );
  if (!outcome.allowed) throw rateLimitError(outcome.window);
}

function validationFailure(error: ZodError): ApiError {
  return new ApiError('VALIDATION_FAILED', copy.error.form, {
    details: validationDetails(error),
  });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/u.test(error.message);
}

/** #1 — register, then auto-login in the same transaction (A-17). */
authRoutes.post(api.auth.register, async (c) => {
  const cfg = c.get('config');
  await enforceAuthIpLimit(cfg.db, c.req.raw);

  const parsed = registerSchema.safeParse(await readJson(c.req.raw));
  if (!parsed.success) throw validationFailure(parsed.error);

  const now = Date.now();
  const user: UserRow = {
    id: newUuid(),
    email: parsed.data.email,
    password_hash: await hashPassword(parsed.data.password),
    display_name: parsed.data.displayName ?? defaultDisplayName(parsed.data.email),
    created_at: isoFrom(now),
    updated_at: isoFrom(now),
  };
  const session = await issueSession(cfg, c.req.raw, user.id);

  try {
    await createUserWithSession(cfg.db, user, session.insert);
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError('CONFLICT', copy.auth.error.emailTaken);
    throw error;
  }

  c.header('Set-Cookie', sessionCookie(session.token, session.maxAgeSeconds, cfg.cookieSecure));
  return c.json(
    { data: { user: userFromRow(user), expiresAt: session.expiresAt } },
    201,
    { Location: api.users.me },
  );
});

/** #2 — login. One generic failure for unknown email and wrong password (FR-AUTH-005). */
authRoutes.post(api.auth.login, async (c) => {
  const cfg = c.get('config');
  await enforceAuthIpLimit(cfg.db, c.req.raw);

  const existing = await resolveSession(cfg, c.req.raw, 'peek');
  if (existing.active) throw new ApiError('CONFLICT', copy.error.form);

  const parsed = loginSchema.safeParse(await readJson(c.req.raw));
  if (!parsed.success) throw validationFailure(parsed.error);

  const { email, password } = parsed.data;
  const failureKey = `${clientIp(c.req.raw)}:${base64Url(await sha256(email))}`;
  const gate = await peekRateLimit(
    cfg.db,
    LOGIN_FAIL_BUCKET,
    failureKey,
    LOGIN_FAIL_LIMIT,
    LOGIN_FAIL_WINDOW_SECONDS,
  );
  if (!gate.allowed) throw rateLimitError(gate.window);

  const user = await findUserByEmail(cfg.db, email);
  if (!user) {
    await burnPasswordCheck(password);
    await consumeRateLimit(
      cfg.db,
      LOGIN_FAIL_BUCKET,
      failureKey,
      LOGIN_FAIL_LIMIT,
      LOGIN_FAIL_WINDOW_SECONDS,
    );
    throw new ApiError('UNAUTHENTICATED', copy.auth.error.invalidCredentials);
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    await consumeRateLimit(
      cfg.db,
      LOGIN_FAIL_BUCKET,
      failureKey,
      LOGIN_FAIL_LIMIT,
      LOGIN_FAIL_WINDOW_SECONDS,
    );
    throw new ApiError('UNAUTHENTICATED', copy.auth.error.invalidCredentials);
  }

  const session = await issueSession(cfg, c.req.raw, user.id);
  await persistSession(cfg, session);

  c.header('Set-Cookie', sessionCookie(session.token, session.maxAgeSeconds, cfg.cookieSecure));
  return c.json({ data: { user: userFromRow(user), expiresAt: session.expiresAt } }, 200);
});

/** #3 — logout: revoke the presented row, clear the cookie; a repeat is still logged out. */
authRoutes.post(api.auth.logout, async (c) => {
  const cfg = c.get('config');
  await enforceAuthIpLimit(cfg.db, c.req.raw);

  const cleared = clearedSessionCookie(cfg.cookieSecure);
  const resolved = await resolveSession(cfg, c.req.raw, 'peek');
  if (!resolved.active) {
    throw new ApiError('UNAUTHENTICATED', copy.auth.error.sessionExpired, {
      headers: { 'Set-Cookie': cleared },
    });
  }

  await deleteSessionById(cfg.db, resolved.active.sessionId);
  c.header('Set-Cookie', cleared);
  return c.body(null, 204);
});

/** #4 — the session probe both frontends bootstrap from; never 403 (O-6). */
authRoutes.get(api.auth.me, async (c) => {
  const cfg = c.get('config');
  const resolved = await resolveSession(cfg, c.req.raw, 'refresh');

  if (!resolved.active) {
    throw new ApiError(
      'UNAUTHENTICATED',
      copy.auth.error.sessionExpired,
      resolved.cookie ? { headers: { 'Set-Cookie': resolved.cookie } } : {},
    );
  }

  c.set('userId', resolved.active.user.id);
  if (resolved.cookie) c.header('Set-Cookie', resolved.cookie);

  const probe: SessionProbe = {
    user: resolved.active.user,
    expiresAt: resolved.active.expiresAt,
  };
  return c.json({ data: probe }, 200);
});
