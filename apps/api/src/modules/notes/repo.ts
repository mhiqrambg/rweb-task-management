import type { Note, NoteListItem } from '@taskapp/contracts';
import { newUuid } from '../../lib/ids';
import {
  cursorPredicate,
  decodeCursor,
  encodeCursor,
  escapeLike,
  queryFailure as fail,
  type CursorValue,
  type QueryFailure,
} from '../../lib/list';

/** Explicit SQL only (ADR-03); snake_case rows, camelCase at the boundary. */

export interface NoteRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

const NOTE_COLUMNS = 'id, user_id, title, body, pinned, created_at, updated_at';

/** §3.6: first 160 chars of the body, whitespace-collapsed, server-computed (Q-10). */
const EXCERPT_CHARS = 160;

export function noteExcerpt(body: string): string {
  return body.slice(0, EXCERPT_CHARS).replace(/\s+/g, ' ').trim();
}

function toListItem(row: NoteRow): NoteListItem {
  return {
    id: row.id,
    title: row.title,
    excerpt: noteExcerpt(row.body),
    pinned: row.pinned === 1,
    // Attachments arrive with T-507; the shape is already final.
    attachments: [],
    attachmentCount: 0,
    updatedAt: row.updated_at,
  };
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: row.pinned === 1,
    // No attachment row can exist before T-507, so the full-attachment list is empty.
    attachments: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertNote(
  db: D1Database,
  note: { userId: string; title: string; body: string; pinned: boolean; now: string },
): Promise<NoteRow> {
  const row: NoteRow = {
    id: newUuid(),
    user_id: note.userId,
    title: note.title,
    body: note.body,
    pinned: note.pinned ? 1 : 0,
    created_at: note.now,
    updated_at: note.now,
  };
  await db
    .prepare(
      `INSERT INTO notes (id, user_id, title, body, pinned, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(row.id, row.user_id, row.title, row.body, row.pinned, row.created_at, row.updated_at)
    .run();
  return row;
}

export async function findNote(db: D1Database, userId: string, id: string): Promise<NoteRow | null> {
  return db
    .prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .first<NoteRow>();
}

/**
 * §5.16: only the supplied fields change. `updated_at` always moves, so a pin toggle reorders the
 * list (FR-NOTE-007); a title/body edit never touches `pinned` (FR-NOTE-006).
 */
export async function updateNote(
  db: D1Database,
  userId: string,
  id: string,
  patch: { title?: string; body?: string; pinned?: boolean },
  now: string,
): Promise<NoteRow | null> {
  const sets: string[] = ['updated_at = ?'];
  const binds: Array<string | number> = [now];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    binds.push(patch.title);
  }
  if (patch.body !== undefined) {
    sets.push('body = ?');
    binds.push(patch.body);
  }
  if (patch.pinned !== undefined) {
    sets.push('pinned = ?');
    binds.push(patch.pinned ? 1 : 0);
  }
  const updated = await db
    .prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND user_id = ? RETURNING ${NOTE_COLUMNS}`)
    .bind(...binds, id, userId)
    .first<NoteRow>();
  return updated;
}

export async function deleteNote(db: D1Database, userId: string, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM notes WHERE id = ?1 AND user_id = ?2')
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/* ------------------------------------------------------------------ list query */

const NOTE_SORT_KEYS = ['pinned', 'updated_at', 'created_at'] as const;
type NoteSortKey = (typeof NOTE_SORT_KEYS)[number];

export interface NoteListParams {
  q?: string;
  pinned?: string;
  limit?: string;
  cursor?: string;
  sort?: string;
}

export interface ParsedNoteList {
  where: string;
  binds: Array<string | number | null>;
  orderBy: string;
  /** Key expressions in ORDER BY order, for cursor checks. */
  keyIds: string[];
  sortId: string;
  limit: number;
}

/** §6.1 per-key typing: `pinned` is the stored 0/1 flag, timestamps are opaque ISO strings. */
function noteCursorKeyCheck(keyId: string, value: unknown): CursorValue | undefined {
  if (keyId === 'pinned') return value === 0 || value === 1 ? value : undefined;
  if (keyId === 'id') return typeof value === 'string' && value.length > 0 ? value : undefined;
  return typeof value === 'string' ? value : undefined;
}

function noteCursorKeyFor(row: NoteRow, keyId: string): CursorValue {
  if (keyId === 'pinned') return row.pinned;
  if (keyId === 'id') return row.id;
  return keyId === 'created_at' ? row.created_at : row.updated_at;
}

/** Validates §6.6 note grammar; returns the failure instead of throwing so routes stay thin. */
export function parseNoteListQuery(
  params: NoteListParams,
): { ok: true; query: ParsedNoteList } | { ok: false; failure: QueryFailure } {
  const where: string[] = ['user_id = ?1'];
  const binds: Array<string | number | null> = [];
  // user_id is bound by the caller at ?1; filters start at ?2.
  let nextIndex = 2;
  const useBind = (value: string | number | null): string => {
    binds.push(value);
    return `?${nextIndex++}`;
  };

  if (params.q !== undefined) {
    const q = params.q.trim();
    if (q.length > 200) {
      return { ok: false, failure: fail('q', 'too_long', 'Keep the search to 200 characters or fewer.') };
    }
    if (q.length > 0) {
      const like = `%${escapeLike(q)}%`;
      const a = useBind(like);
      const b = useBind(like);
      where.push(`(title LIKE ${a} ESCAPE '\\' OR body LIKE ${b} ESCAPE '\\')`);
    }
  }
  if (params.pinned !== undefined) {
    if (params.pinned === 'true') {
      where.push('pinned = 1');
    } else if (params.pinned === 'false') {
      where.push('pinned = 0');
    } else {
      return { ok: false, failure: fail('pinned', 'enum', 'Choose true or false.') };
    }
  }

  let limit = 20;
  if (params.limit !== undefined) {
    if (!/^\d+$/.test(params.limit)) {
      return { ok: false, failure: fail('limit', 'range', 'Choose between 1 and 100.') };
    }
    limit = Number(params.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return { ok: false, failure: fail('limit', 'range', 'Choose between 1 and 100.') };
    }
  }

  // §5.13: pinned first by default, then most recently updated.
  const rawSort = params.sort ?? '-pinned,-updated_at';
  const segments = rawSort.split(',');
  if (segments.length > 2 || segments.some((s) => s.length === 0)) {
    return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
  }
  const seen = new Set<string>();
  const orderExprs: Array<{ sql: string; dir: 'ASC' | 'DESC' }> = [];
  const keyOrderIds: string[] = [];
  for (const segment of segments) {
    const descending = segment.startsWith('-');
    const key = (descending ? segment.slice(1) : segment) as NoteSortKey;
    if (!(NOTE_SORT_KEYS as readonly string[]).includes(key) || seen.has(key)) {
      return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
    }
    seen.add(key);
    orderExprs.push({ sql: key, dir: descending ? 'DESC' : 'ASC' });
    keyOrderIds.push(key);
  }
  const lastDir = orderExprs[orderExprs.length - 1]?.dir;
  if (lastDir === undefined) {
    return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
  }
  const sortId = `n:${segments.join(',')}`;

  // `id` closes every sort and is never sent by the client (§6.4).
  orderExprs.push({ sql: 'id', dir: lastDir });
  keyOrderIds.push('id');
  const orderBy = `ORDER BY ${orderExprs.map((e) => `${e.sql} ${e.dir}`).join(', ')}`;

  if (params.cursor !== undefined) {
    const decoded = decodeCursor(params.cursor, sortId, keyOrderIds, noteCursorKeyCheck);
    if (!decoded.ok) return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    where.push(cursorPredicate(orderExprs, decoded.keys, useBind));
  }

  return {
    ok: true,
    query: {
      where: where.join(' AND '),
      binds,
      orderBy,
      keyIds: keyOrderIds,
      sortId,
      limit,
    },
  };
}

export interface NotePage {
  items: NoteListItem[];
  nextCursor: string | null;
}

export async function listNotes(
  db: D1Database,
  userId: string,
  parsed: ParsedNoteList,
): Promise<NotePage> {
  const rows = await db
    .prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE ${parsed.where} ${parsed.orderBy} LIMIT ?`)
    .bind(userId, ...parsed.binds, parsed.limit + 1)
    .all<NoteRow>();
  const results = rows.results ?? [];
  const page = results.slice(0, parsed.limit);
  let nextCursor: string | null = null;
  if (results.length > parsed.limit) {
    const last = page[page.length - 1];
    if (last !== undefined) {
      nextCursor = encodeCursor(
        parsed.sortId,
        parsed.keyIds.map((id) => noteCursorKeyFor(last, id)),
      );
    }
  }
  return { items: page.map(toListItem), nextCursor };
}

export { toListItem as noteRowToListItem, toNote as noteRowToNote };

/* ------------------------------------------------------------------ dashboard */

/**
 * §3.7: the 5 most recently updated notes regardless of pin, as list items. The projection cuts
 * the body to the excerpt length in SQL so a dashboard read never transfers a 20 KB body; the
 * `body` field of those rows therefore holds the excerpt prefix, not the stored note body.
 */
const NOTE_EXCERPT_COLUMNS =
  `id, user_id, title, substr(body, 1, ${EXCERPT_CHARS}) AS body, pinned, created_at, updated_at`;

export async function recentNotePreviews(db: D1Database, userId: string): Promise<NoteListItem[]> {
  const rows = await db
    .prepare(
      `SELECT ${NOTE_EXCERPT_COLUMNS} FROM notes WHERE user_id = ?1 ORDER BY updated_at DESC, id DESC LIMIT 5`,
    )
    .bind(userId)
    .all<NoteRow>();
  return (rows.results ?? []).map(toListItem);
}

