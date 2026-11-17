import { api, copy, validationDetails, validationMessage, type User } from '@taskapp/contracts';
import { Elysia, type HTTPHeaders } from 'elysia';
import type { ZodError } from 'zod';
import { z } from 'zod';
import { getConfig } from '../../context';
import type { Config } from '../../config';
import { ApiError } from '../../lib/errors';
import { parseJsonBody } from '../../lib/http';
import { consumeRateLimit, rateLimitError } from '../../lib/rate-limit';
import { isoFrom } from '../../lib/time';
import { resolveSession } from '../auth/session';

/**
 * #5 and #6 (`.planning/06` §5.5-§5.6). The profile is the session's own row and nothing else:
 * `WHERE id = ?` with the id taken from the verified session, never from the request. Email and
 * credentials are read-only here (01 §8).
 */

export const usersRoutes = new Elysia();

const USERS_BUCKET = 'users-me';
const USERS_LIMIT = 300;
const USERS_WINDOW_SECONDS = 60;

/** #6 accepts `displayName` only; the strict object is the mass-assignment guard (07 §3.3). */
const updateMeSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(100),
});

function validationFailure(error: ZodError): ApiError {
  const details = validationDetails(error);
  return new ApiError('VALIDATION_FAILED', validationMessage(details), { details });
}

async function enforceUserLimit(db: D1Database, userId: string): Promise<void> {
  const outcome = await consumeRateLimit(db, USERS_BUCKET, userId, USERS_LIMIT, USERS_WINDOW_SECONDS);
  if (!outcome.allowed) throw rateLimitError(outcome.window);
}

async function sessionUser(cfg: Config, request: Request): Promise<{ user: User; cookie: string | null }> {
  const resolved = await resolveSession(cfg, request, 'refresh');
  if (!resolved.active) {
    throw new ApiError(
      'UNAUTHENTICATED',
      copy.auth.error.sessionExpired,
      resolved.cookie ? { headers: { 'Set-Cookie': resolved.cookie } } : {},
    );
  }
  return { user: resolved.active.user, cookie: resolved.cookie };
}

function withSessionCookie(set: { headers: HTTPHeaders }, cookie: string | null): void {
  if (cookie) set.headers['Set-Cookie'] = cookie;
}

/** #5 — the profile behind the account screen and the nav identity. */
usersRoutes.get(api.users.me, async ({ request, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);
  return { data: user };
});

/** #6 — display name only. A body naming any other field is a 422, not a silent no-op. */
usersRoutes.patch(api.users.me, async ({ request, body, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const parsed = updateMeSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const updated = await cfg.db
    .prepare(
      `UPDATE users SET display_name = ?2, updated_at = ?3
        WHERE id = ?1
        RETURNING id, email, display_name, role, status, created_at, updated_at`,
    )
    .bind(user.id, parsed.data.displayName, isoFrom(Date.now()))
    .first<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>();

  if (!updated) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  const profile: User = {
    id: updated.id,
    email: updated.email,
    displayName: updated.display_name,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
  return { data: profile };
});