import {
  api,
  copy,
  defaultDisplayName,
  loginSchema,
  registerSchema,
  validationDetails,
  validationMessage,
  type SessionProbe,
} from '@taskapp/contracts';
import { Elysia } from 'elysia';
import { clearedSessionCookie, sessionCookie } from '../../lib/cookie';
import { getConfig } from '../../context';
import type { ZodError } from 'zod';
import { ApiError } from '../../lib/errors';
import { clientIp, parseJsonBody } from '../../lib/http';
import { base64Url, newUuid, sha256 } from '../../lib/ids';
import { consumeRateLimit, peekRateLimit, rateLimitError } from '../../lib/rate-limit';
import { isoFrom } from '../../lib/time';
import {
  burnPasswordCheck,
  hashPassword,
  needsRehash,
  verifyPassword,
} from './password';
import {
  createUserWithSession,
  deleteSessionById,
  findUserByEmail,
  type UserRow,
  updateUserPasswordHash,
} from './repo';
import { issueSession, persistSession, resolveSession, userFromRow } from './session';

export const authRoutes = new Elysia();

const AUTH_IP_BUCKET = 'auth-ip';
const AUTH_IP_LIMIT = 10;
const AUTH_IP_WINDOW_SECONDS = 60;

const LOGIN_FAIL_BUCKET = 'login-fail';
const LOGIN_FAIL_LIMIT = 5;
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;

function json(data: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

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
  const details = validationDetails(error);
  return new ApiError('VALIDATION_FAILED', validationMessage(details), { details });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/u.test(error.message);
}

/** #1 — register, then auto-login in the same transaction (A-17). */
authRoutes.post(api.auth.register, async ({ request, body, set }) => {
  const cfg = getConfig();
  await enforceAuthIpLimit(cfg.db, request);

  const parsed = registerSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const now = Date.now();
  const user: UserRow = {
    id: newUuid(),
    email: parsed.data.email,
    password_hash: await hashPassword(parsed.data.password),
    display_name: parsed.data.displayName ?? defaultDisplayName(parsed.data.email),
    // D-12: a self-registered account is always a plain member. The role is never client-settable.
    role: 'member',
    status: 'active',
    created_at: isoFrom(now),
    updated_at: isoFrom(now),
  };
  const session = await issueSession(cfg, request, user.id);

  try {
    await createUserWithSession(cfg.db, user, session.insert);
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError('CONFLICT', copy.auth.error.emailTaken);
    throw error;
  }

  set.headers['Set-Cookie'] = sessionCookie(session.token, session.maxAgeSeconds, cfg.cookieSecure);
  set.status = 201;
  set.headers.Location = api.users.me;
  return { data: { user: userFromRow(user), expiresAt: session.expiresAt } };
});

/** #2 — login. One generic failure for unknown email and wrong password (FR-AUTH-005). */
authRoutes.post(api.auth.login, async ({ request, body, set }) => {
  const cfg = getConfig();
  await enforceAuthIpLimit(cfg.db, request);

  const existing = await resolveSession(cfg, request, 'peek');
  if (existing.active) throw new ApiError('CONFLICT', copy.error.form);

  const parsed = loginSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const { email, password } = parsed.data;
  const failureKey = `${clientIp(request)}:${base64Url(await sha256(email))}`;
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
    await consumeRateLimit(cfg.db, LOGIN_FAIL_BUCKET, failureKey, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_SECONDS);
    throw new ApiError('UNAUTHENTICATED', copy.auth.error.invalidCredentials);
  }

  // FR-ADMIN-004: a disabled member is refused exactly like a wrong password. The message stays
  // generic, so the refusal does not reveal that the account exists or that it was disabled.
  const verified = await verifyPassword(password, user.password_hash);
  if (user.status === 'disabled' || !verified.ok) {
    await consumeRateLimit(cfg.db, LOGIN_FAIL_BUCKET, failureKey, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_SECONDS);
    throw new ApiError('UNAUTHENTICATED', copy.auth.error.invalidCredentials);
  }

  // Rehash-on-login: a legacy `$argon2id$…` row is upgraded to the current PBKDF2 format now that
  // the password is proven. Never blocks the login — a failed upgrade is logged and retried on the
  // next successful login, so the user is never locked out by the migration.
  if (needsRehash(user.password_hash)) {
    try {
      const upgraded = await hashPassword(password);
      await updateUserPasswordHash(cfg.db, user.id, upgraded);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'password rehash-on-login failed',
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  const session = await issueSession(cfg, request, user.id);
  await persistSession(cfg, session);

  set.headers['Set-Cookie'] = sessionCookie(session.token, session.maxAgeSeconds, cfg.cookieSecure);
  return { data: { user: userFromRow(user), expiresAt: session.expiresAt } };
});

/** #3 — logout: revoke the presented row, clear the cookie; a repeat is still logged out. */
authRoutes.post(api.auth.logout, async ({ request, set }) => {
  const cfg = getConfig();
  await enforceAuthIpLimit(cfg.db, request);

  const cleared = clearedSessionCookie(cfg.cookieSecure);
  const resolved = await resolveSession(cfg, request, 'peek');
  if (!resolved.active) {
    throw new ApiError('UNAUTHENTICATED', copy.auth.error.sessionExpired, {
      headers: { 'Set-Cookie': cleared },
    });
  }

  await deleteSessionById(cfg.db, resolved.active.sessionId);
  set.headers['Set-Cookie'] = cleared;
  set.status = 204;
});

/** #4 — the session probe both frontends bootstrap from; never 403 (O-6). */
authRoutes.get(api.auth.me, async ({ request, set }) => {
  const cfg = getConfig();
  const resolved = await resolveSession(cfg, request, 'refresh');

  if (!resolved.active) {
    throw new ApiError(
      'UNAUTHENTICATED',
      copy.auth.error.sessionExpired,
      resolved.cookie ? { headers: { 'Set-Cookie': resolved.cookie } } : {},
    );
  }

  if (resolved.cookie) set.headers['Set-Cookie'] = resolved.cookie;

  const probe: SessionProbe = {
    user: resolved.active.user,
    expiresAt: resolved.active.expiresAt,
  };
  return { data: probe };
});
