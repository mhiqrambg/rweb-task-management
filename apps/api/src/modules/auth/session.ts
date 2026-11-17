import type { User } from '@taskapp/contracts';
import type { Config } from '../../config';
import { clearedSessionCookie, readSessionCookie, sessionCookie } from '../../lib/cookie';
import { clientIp } from '../../lib/http';
import { newSessionToken, newUuid, sha256 } from '../../lib/ids';
import { isoFrom } from '../../lib/time';
import {
  findSessionWithUser,
  insertSession,
  touchSession,
  type SessionInsert,
  type SessionWithUserRow,
  type UserRow,
} from './repo';

export interface ActiveSession {
  sessionId: string;
  user: User;
  expiresAt: string;
  /** D-12. Derived from the users row on every request, never from the cookie. */
  role: MemberRole;
  status: MemberStatus;
}

export interface SessionResolution {
  active: ActiveSession | null;
  /** A `Set-Cookie` value to emit: the cleared cookie after an invalid presentation, or a refresh. */
  cookie: string | null;
}

export function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userFromSessionRow(row: SessionWithUserRow): User {
  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.user_created_at,
    updatedAt: row.user_updated_at,
  };
}

/**
 * The admin extension's role (D-12). It rides on the resolved session so every admin route makes
 * one check, and it is never accepted from a request.
 */
export type MemberRole = 'member' | 'admin';
export type MemberStatus = 'active' | 'disabled';

export function roleOf(row: SessionWithUserRow): MemberRole {
  return row.user_role === 'admin' ? 'admin' : 'member';
}

export function statusOf(row: SessionWithUserRow): MemberStatus {
  return row.user_status === 'disabled' ? 'disabled' : 'active';
}

/**
 * §2.2: absolute expiry from the row, idle expiry from `last_used_at`, hourly conditional refresh.
 * `peek` never refreshes and never clears, so a login cannot be raced by a cookie rewrite.
 */
export async function resolveSession(
  cfg: Config,
  request: Request,
  mode: 'refresh' | 'peek',
): Promise<SessionResolution> {
  const token = readSessionCookie(request.headers.get('cookie'));
  if (!token) return { active: null, cookie: null };

  const row = await findSessionWithUser(cfg.db, await sha256(token));
  const cleared = mode === 'refresh' ? clearedSessionCookie(cfg.cookieSecure) : null;
  if (!row) return { active: null, cookie: cleared };

  const now = Date.now();
  const expiresAtMs = Date.parse(row.expires_at);
  const lastUsedMs = Date.parse(row.last_used_at);
  const unusable =
    Number.isNaN(expiresAtMs) ||
    Number.isNaN(lastUsedMs) ||
    expiresAtMs <= now ||
    lastUsedMs <= now - cfg.sessionIdleMs ||
    // FR-ADMIN-004: a disabled member is treated exactly like an expired session, so an existing
    // cookie stops working on the request it arrives on and the cookie is cleared.
    statusOf(row) === 'disabled';
  if (unusable) return { active: null, cookie: cleared };

  const active: ActiveSession = {
    sessionId: row.session_id,
    user: userFromSessionRow(row),
    expiresAt: row.expires_at,
    role: roleOf(row),
    status: statusOf(row),
  };

  if (mode === 'peek' || lastUsedMs > now - cfg.sessionRefreshMs) {
    return { active, cookie: null };
  }

  const nowIso = isoFrom(now);
  await touchSession(cfg.db, row.session_id, nowIso, isoFrom(now - cfg.sessionRefreshMs));
  const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
  return { active, cookie: sessionCookie(token, remainingSeconds, cfg.cookieSecure) };
}

export interface IssuedSession {
  insert: SessionInsert;
  token: string;
  expiresAt: string;
  maxAgeSeconds: number;
}

/** New token, new row. A client-supplied `sid` is never adopted (S-12, session fixation). */
export async function issueSession(
  cfg: Config,
  request: Request,
  userId: string,
): Promise<IssuedSession> {
  const now = Date.now();
  const token = newSessionToken();
  const expiresAt = isoFrom(now + cfg.sessionTtlMs);
  const ip = clientIp(request);
  const userAgent = request.headers.get('user-agent');

  const insert: SessionInsert = {
    id: newUuid(),
    userId,
    tokenHash: await sha256(token),
    createdAt: isoFrom(now),
    lastUsedAt: isoFrom(now),
    expiresAt,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
    ip: ip === 'unknown' ? null : ip,
  };

  return {
    insert,
    token,
    expiresAt,
    maxAgeSeconds: Math.floor(cfg.sessionTtlMs / 1000),
  };
}

export async function persistSession(cfg: Config, session: IssuedSession): Promise<void> {
  await insertSession(cfg.db, session.insert);
}
