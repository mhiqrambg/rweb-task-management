import {
  cursorPredicate,
  decodeCursor,
  encodeCursor,
  escapeLike,
  queryFailure as fail,
  type CursorValue,
  type QueryFailure,
} from '../../lib/list';

/**
 * Admin member listing (`.planning/06` §5.23, D-12). Reads `users` rows and nothing else — no task,
 * note or attachment column is reachable from here (07 §3.4).
 *
 * Explicit SQL only (ADR-03); the sort id is `u:created` and the tiebreak is always `id`.
 */

export interface MemberRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const MEMBER_COLUMNS = 'id, email, display_name, role, status, created_at, updated_at';

/** Create form of #24. `password_hash` is written here but never selected back. */
export interface NewMember {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const INSERT_MEMBER =
  `INSERT INTO users (id, email, password_hash, display_name, role, status, created_at, updated_at)
   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`;

export async function insertMember(db: D1Database, member: NewMember): Promise<void> {
  await db
    .prepare(INSERT_MEMBER)
    .bind(
      member.id,
      member.email,
      member.password_hash,
      member.display_name,
      member.role,
      member.status,
      member.created_at,
      member.updated_at,
    )
    .run();
}

export async function findMember(db: D1Database, id: string): Promise<MemberRow | null> {
  return db
    .prepare(`SELECT ${MEMBER_COLUMNS} FROM users WHERE id = ?1`)
    .bind(id)
    .first<MemberRow>();
}

/** #25: only the supplied fields change; `updated_at` moves with every accepted patch. */
export async function updateMember(
  db: D1Database,
  id: string,
  patch: { displayName?: string; role?: string; status?: string; now: string },
): Promise<MemberRow | null> {
  const sets = ['updated_at = ?'];
  const binds: string[] = [patch.now];
  if (patch.displayName !== undefined) {
    sets.push('display_name = ?');
    binds.push(patch.displayName);
  }
  if (patch.role !== undefined) {
    sets.push('role = ?');
    binds.push(patch.role);
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    binds.push(patch.status);
  }
  return db
    .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ? RETURNING ${MEMBER_COLUMNS}`)
    .bind(...binds, id)
    .first<MemberRow>();
}

/**
 * #26. The workspace cascade is the database's job: `users` → `tasks` → `notes` → `attachments`,
 * each with `ON DELETE CASCADE` (05 §1.2). The R2 objects are swept by the caller, which reads the
 * keys before this runs because the rows that name them disappear with it.
 */
export async function deleteMember(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM users WHERE id = ?1').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

/* ------------------------------------------------------------------ list query */

const MEMBER_SORT_ID = 'u:created';
const MEMBER_SORT_KEYS = ['created_at', 'id'] as const;
type MemberSortKey = (typeof MEMBER_SORT_KEYS)[number];

export interface ParsedMemberList {
  where: string;
  binds: string[];
  orderBy: string;
  keyIds: string[];
  limit: number;
}

export interface MemberPage {
  items: MemberRow[];
  nextCursor: string | null;
  total: number;
}

/** §6.1 per-key typing: both keys are opaque ISO strings / ids. */
function memberCursorKeyCheck(keyId: string, value: unknown): CursorValue | undefined {
  if (keyId === 'id') return typeof value === 'string' && value.length > 0 ? value : undefined;
  return typeof value === 'string' ? value : undefined;
}

function memberCursorKeyFor(row: MemberRow, keyId: string): CursorValue {
  return keyId === 'id' ? row.id : row.created_at;
}

/** Validates §5.23 `?q&role&status&cursor`; returns the failure so routes stay thin. */
export function parseMemberListQuery(params: URLSearchParams): {
  ok: true;
  query: ParsedMemberList;
} | {
  ok: false;
  failure: QueryFailure;
} {
  const where: string[] = ['1 = 1'];
  const binds: string[] = [];

  const q = params.get('q');
  if (q !== null) {
    const trimmed = q.trim();
    if (trimmed.length > 200) {
      return { ok: false, failure: fail('q', 'too_long', 'Keep the search to 200 characters or fewer.') };
    }
    if (trimmed.length > 0) {
      const pattern = `%${escapeLike(trimmed)}%`;
      where.push(`(display_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')`);
      binds.push(pattern, pattern);
    }
  }

  const role = params.get('role');
  if (role !== null && role !== '') {
    if (role !== 'member' && role !== 'admin') {
      return { ok: false, failure: fail('role', 'enum', 'Choose member or admin.') };
    }
    where.push('role = ?');
    binds.push(role);
  }

  const status = params.get('status');
  if (status !== null && status !== '') {
    if (status !== 'active' && status !== 'disabled') {
      return { ok: false, failure: fail('status', 'enum', 'Choose active or disabled.') };
    }
    where.push('status = ?');
    binds.push(status);
  }

  let limit = 20;
  const rawLimit = params.get('limit');
  if (rawLimit !== null && rawLimit !== '') {
    if (!/^\d+$/u.test(rawLimit)) {
      return { ok: false, failure: fail('limit', 'range', 'Use a number between 1 and 100.') };
    }
    limit = Number(rawLimit);
    if (limit < 1 || limit > 100) {
      return { ok: false, failure: fail('limit', 'range', 'Use a number between 1 and 100.') };
    }
  }

  // One sort only: newest first, the order `design/09` §4 shows.
  const orderBy = 'ORDER BY created_at DESC, id DESC';
  const rawCursor = params.get('cursor');
  if (rawCursor !== null && rawCursor !== '') {
    const decoded = decodeCursor(rawCursor, MEMBER_SORT_ID, [...MEMBER_SORT_KEYS], memberCursorKeyCheck);
    if (!decoded.ok) {
      return { ok: false, failure: fail('cursor', 'malformed', 'That page link is not valid.') };
    }
    const predicate = cursorPredicate(
      [
        { sql: 'created_at', dir: 'DESC' },
        { sql: 'id', dir: 'DESC' },
      ],
      decoded.keys,
      (value) => `?${binds.push(String(value))}`,
    );
    where.push(predicate);
  }

  return {
    ok: true,
    query: {
      where: where.join(' AND '),
      binds,
      orderBy,
      keyIds: [...MEMBER_SORT_KEYS],
      limit,
    },
  };
}

export async function listMembers(db: D1Database, parsed: ParsedMemberList): Promise<MemberPage> {
  const rows = await db
    .prepare(
      `SELECT ${MEMBER_COLUMNS} FROM users WHERE ${parsed.where} ${parsed.orderBy} LIMIT ?`,
    )
    .bind(...parsed.binds, parsed.limit + 1)
    .all<MemberRow>();
  const results = rows.results ?? [];
  const page = results.slice(0, parsed.limit);

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS count FROM users WHERE ${parsed.where}`)
    .bind(...parsed.binds)
    .first<{ count: number }>();

  let nextCursor: string | null = null;
  if (results.length > parsed.limit) {
    const last = page[page.length - 1];
    if (last !== undefined) {
      nextCursor = encodeCursor(
        MEMBER_SORT_ID,
        parsed.keyIds.map((id) => memberCursorKeyFor(last, id)),
      );
    }
  }

  return { items: page, nextCursor, total: countRow?.count ?? page.length };
}

export { MEMBER_SORT_ID };