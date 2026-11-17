/** Explicit SQL only (ADR-03); snake_case rows, camelCase at the boundary. */
import { isoFrom } from '../../lib/time';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SessionInsert {
  id: string;
  userId: string;
  tokenHash: Uint8Array;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  ip: string | null;
}

export interface SessionWithUserRow {
  session_id: string;
  expires_at: string;
  last_used_at: string;
  email: string;
  display_name: string;
  user_role: string;
  user_status: string;
  user_created_at: string;
  user_updated_at: string;
  user_id: string;
}

const USER_COLUMNS =
  'id, email, password_hash, display_name, role, status, created_at, updated_at';

const INSERT_USER =
  'INSERT INTO users (id, email, password_hash, display_name, role, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)';


const INSERT_SESSION =
  'INSERT INTO sessions (id, user_id, token_hash, created_at, last_used_at, expires_at, user_agent, ip) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)';

function bindSession(db: D1Database, session: SessionInsert): D1PreparedStatement {
  return db
    .prepare(INSERT_SESSION)
    .bind(
      session.id,
      session.userId,
      session.tokenHash,
      session.createdAt,
      session.lastUsedAt,
      session.expiresAt,
      session.userAgent,
      session.ip,
    );
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?1`).bind(email).first<UserRow>();
}

/**
 * Rehash-on-login (§Argon2→PBKDF2 ADR): upgrades a legacy `$argon2id$…` row to the current
 * PBKDF2 format once the user has proven the password. Best-effort is wrong here — a failed
 * upgrade is logged at the call site, never swallowed, so the row is retried next login.
 */
export async function updateUserPasswordHash(
  db: D1Database,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .prepare('UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3')
    .bind(passwordHash, isoFrom(Date.now()), userId)
    .run();
}

/** Registration writes the user and its first session atomically (§2.1: user + session). */
export async function createUserWithSession(
  db: D1Database,
  user: UserRow,
  session: SessionInsert,
): Promise<void> {
  await db.batch([
    db
      .prepare(INSERT_USER)
      .bind(
        user.id,
        user.email,
        user.password_hash,
        user.display_name,
        user.role,
        user.status,
        user.created_at,
        user.updated_at,
      ),
    bindSession(db, session),
  ]);
}

export async function insertSession(db: D1Database, session: SessionInsert): Promise<void> {
  await bindSession(db, session).run();
}

export async function findSessionWithUser(
  db: D1Database,
  tokenHash: Uint8Array,
): Promise<SessionWithUserRow | null> {
  return db
    .prepare(
      `SELECT s.id AS session_id, s.user_id AS user_id, s.expires_at AS expires_at,
              s.last_used_at AS last_used_at, u.email AS email, u.display_name AS display_name,
              u.role AS user_role, u.status AS user_status,
              u.created_at AS user_created_at, u.updated_at AS user_updated_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1`,
    )
    .bind(tokenHash)
    .first<SessionWithUserRow>();
}

/** FR-ADMIN-004: disabling a member invalidates every outstanding session immediately. */
export async function deleteSessionsForUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(userId).run();
}

/** T-511: expired rows are dead weight; the sweep runs on the maintenance cron. */
export async function deleteExpiredSessions(db: D1Database, before: string): Promise<number> {
  const result = await db
    .prepare('DELETE FROM sessions WHERE expires_at <= ?1')
    .bind(before)
    .run();
  return result.meta.changes ?? 0;
}

/** Idempotent hourly refresh; it cannot move `expires_at` (ADR-06). */
export async function touchSession(
  db: D1Database,
  sessionId: string,
  lastUsedAt: string,
  staleBefore: string,
): Promise<void> {
  await db
    .prepare(
      'UPDATE sessions SET last_used_at = ?2 WHERE id = ?1 AND last_used_at < ?3',
    )
    .bind(sessionId, lastUsedAt, staleBefore)
    .run();
}

export async function deleteSessionById(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?1').bind(sessionId).run();
}
