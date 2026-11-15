import type { Dashboard, Task, TaskListItem } from '@taskapp/contracts';
import { base64UrlDecodeText, base64UrlEncodeText, newUuid } from '../../lib/ids';

/** Explicit SQL only (ADR-03); snake_case rows, camelCase at the boundary. */

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

const TASK_COLUMNS =
  'id, user_id, title, description, status, priority, due_date, created_at, updated_at';

export function isOverdue(status: string, dueDate: string | null, today: string): boolean {
  return dueDate !== null && dueDate < today && status !== 'completed';
}

function toStatus(value: string): TaskListItem['status'] {
  if (value === 'todo' || value === 'in_progress' || value === 'completed') return value;
  throw new Error(`defect: tasks.status holds ${JSON.stringify(value)}`);
}

function toPriority(value: string): TaskListItem['priority'] {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  throw new Error(`defect: tasks.priority holds ${JSON.stringify(value)}`);
}

function toListItem(row: TaskRow, today: string): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    status: toStatus(row.status),
    priority: toPriority(row.priority),
    dueDate: row.due_date,
    isOverdue: isOverdue(row.status, row.due_date, today),
    // Attachments arrive with T-507; the shape is already final.
    attachments: [],
    attachmentCount: 0,
    updatedAt: row.updated_at,
  };
}

function toTask(row: TaskRow, today: string): Task {
  return {
    ...toListItem(row, today),
    // No attachment row can exist before T-507, so the full-attachment list is empty.
    attachments: [],
    description: row.description,
    createdAt: row.created_at,
  };
}

export async function insertTask(
  db: D1Database,
  task: {
    userId: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    now: string;
  },
): Promise<TaskRow> {
  const row: TaskRow = {
    id: newUuid(),
    user_id: task.userId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate,
    created_at: task.now,
    updated_at: task.now,
  };
  await db
    .prepare(
      `INSERT INTO tasks (id, user_id, title, description, status, priority, due_date, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.title,
      row.description,
      row.status,
      row.priority,
      row.due_date,
      row.created_at,
      row.updated_at,
    )
    .run();
  return row;
}

export async function findTask(
  db: D1Database,
  userId: string,
  id: string,
): Promise<TaskRow | null> {
  return db
    .prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .first<TaskRow>();
}

export async function updateTask(
  db: D1Database,
  userId: string,
  id: string,
  patch: { title?: string; description?: string | null; status?: string; priority?: string; dueDate?: string | null },
  now: string,
): Promise<TaskRow | null> {
  const sets: string[] = ['updated_at = ?'];
  const binds: Array<string | null> = [now];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    binds.push(patch.title);
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    binds.push(patch.description);
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    binds.push(patch.status);
  }
  if (patch.priority !== undefined) {
    sets.push('priority = ?');
    binds.push(patch.priority);
  }
  if (patch.dueDate !== undefined) {
    sets.push('due_date = ?');
    binds.push(patch.dueDate);
  }
  const updated = await db
    .prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_id = ? RETURNING ${TASK_COLUMNS}`)
    .bind(...binds, id, userId)
    .first<TaskRow>();
  return updated;
}

export async function deleteTask(db: D1Database, userId: string, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM tasks WHERE id = ?1 AND user_id = ?2')
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/* ------------------------------------------------------------------ list query */

const TASK_SORT_KEYS = ['updated_at', 'created_at', 'due_date', 'priority'] as const;
type TaskSortKey = (typeof TASK_SORT_KEYS)[number];

export interface TaskListParams {
  q?: string;
  status?: string;
  priority?: string;
  dueState?: string;
  dueFrom?: string;
  dueTo?: string;
  hasAttachments?: string;
  limit?: string;
  cursor?: string;
  sort?: string;
}

export interface ParsedTaskList {
  where: string;
  binds: Array<string | number | null>;
  orderBy: string;
  /** Key expressions in ORDER BY order (due_date expands to two), for cursor checks. */
  keyIds: string[];
  directions: Array<'ASC' | 'DESC'>;
  sortId: string;
  limit: number;
  cursorKeys: Array<string | number | null> | null;
}

export interface QueryFailure {
  field: string;
  code: string;
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURSOR_RE = /^[A-Za-z0-9_-]{16,512}$/;

function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parts = value.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function fail(field: string, code: string, message: string): QueryFailure {
  return { field, code, message };
}

/** Validates §6.6 task grammar; returns the failure instead of throwing so routes stay thin. */
export function parseTaskListQuery(
  params: TaskListParams,
  today: string,
): { ok: true; query: ParsedTaskList } | { ok: false; failure: QueryFailure } {
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
    if (q.length > 200) return { ok: false, failure: fail('q', 'too_long', 'Keep the search to 200 characters or fewer.') };
    if (q.length > 0) {
      const like = `%${escapeLike(q)}%`;
      const a = useBind(like);
      const b = useBind(like);
      where.push(`(title LIKE ${a} ESCAPE '\\' OR description LIKE ${b} ESCAPE '\\')`);
    }
  }
  if (params.status !== undefined) {
    if (!['todo', 'in_progress', 'completed'].includes(params.status)) {
      return { ok: false, failure: fail('status', 'enum', 'Choose to do, in progress, or completed.') };
    }
    where.push(`status = ${useBind(params.status)}`);
  }
  if (params.priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(params.priority)) {
      return { ok: false, failure: fail('priority', 'enum', 'Choose low, medium, or high.') };
    }
    where.push(`priority = ${useBind(params.priority)}`);
  }
  if (params.dueState !== undefined) {
    const state = params.dueState;
    if (state === 'overdue') {
      where.push(`due_date IS NOT NULL AND due_date < ${useBind(today)} AND status <> 'completed'`);
    } else if (state === 'today') {
      where.push(`due_date = ${useBind(today)}`);
    } else if (state === 'none') {
      where.push('due_date IS NULL');
    } else if (state === 'range') {
      const from = params.dueFrom ?? '';
      const to = params.dueTo ?? '';
      if (!isCalendarDate(from) || !isCalendarDate(to) || to < from) {
        return { ok: false, failure: fail('dueFrom', 'date_format', 'Enter a real date or clear the field.') };
      }
      where.push(`due_date >= ${useBind(from)} AND due_date <= ${useBind(to)}`);
    } else {
      return { ok: false, failure: fail('dueState', 'enum', 'Enter a real date or clear the field.') };
    }
  } else if (params.dueFrom !== undefined || params.dueTo !== undefined) {
    return { ok: false, failure: fail('dueState', 'enum', 'Enter a real date or clear the field.') };
  }
  if (params.hasAttachments !== undefined) {
    if (params.hasAttachments === 'true') {
      where.push('EXISTS (SELECT 1 FROM attachments WHERE task_id = tasks.id)');
    } else if (params.hasAttachments === 'false') {
      where.push('NOT EXISTS (SELECT 1 FROM attachments WHERE task_id = tasks.id)');
    } else {
      return { ok: false, failure: fail('hasAttachments', 'enum', 'Choose true or false.') };
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

  const rawSort = params.sort ?? '-updated_at';
  const segments = rawSort.split(',');
  if (segments.length > 2 || segments.some((s) => s.length === 0)) {
    return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
  }
  const seen = new Set<string>();
  const keyIds: string[] = [];
  const directions: Array<'ASC' | 'DESC'> = [];
  for (const segment of segments) {
    const descending = segment.startsWith('-');
    const key = (descending ? segment.slice(1) : segment) as TaskSortKey;
    if (!(TASK_SORT_KEYS as readonly string[]).includes(key) || seen.has(key)) {
      return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
    }
    seen.add(key);
    keyIds.push(key);
    directions.push(descending ? 'DESC' : 'ASC');
  }
  if (directions.length === 0) {
    return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
  }
  const lastDir = directions[directions.length - 1];
  if (lastDir === undefined) {
    return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
  }
  const sortId = `t:${segments.join(',')}`;

  // ORDER BY expressions: due_date carries the NULL-last flag first (§6.3); id always closes.
  const orderExprs: Array<{ sql: string; dir: 'ASC' | 'DESC' }> = [];
  const keyOrderIds: string[] = [];
  for (let i = 0; i < keyIds.length; i++) {
    const key = keyIds[i];
    const dir = directions[i];
    if (key === undefined || dir === undefined) {
      return { ok: false, failure: fail('sort', 'sort_key', 'Unknown sort key.') };
    }
    if (key === 'due_date') {
      orderExprs.push({ sql: '(due_date IS NULL)', dir: 'ASC' });
      orderExprs.push({ sql: 'due_date', dir });
      keyOrderIds.push('due_date_is_null', 'due_date');
    } else {
      orderExprs.push({ sql: key, dir });
      keyOrderIds.push(key);
    }
  }
  orderExprs.push({ sql: 'id', dir: lastDir });
  keyOrderIds.push('id');
  const orderBy = `ORDER BY ${orderExprs.map((e) => `${e.sql} ${e.dir}`).join(', ')}`;

  let cursorKeys: Array<string | number | null> | null = null;
  if (params.cursor !== undefined) {
    if (!CURSOR_RE.test(params.cursor)) {
      return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    }
    let payload: unknown;
    try {
      const json = base64UrlDecodeText(params.cursor);
      payload = JSON.parse(json);
    } catch {
      return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    }
    if (typeof payload !== 'object' || payload === null) {
      return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    }
    if (!('v' in payload) || !('s' in payload) || !('k' in payload)) {
      return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    }
    const version: unknown = payload.v;
    const sort: unknown = payload.s;
    const keys: unknown = payload.k;
    if (version !== 1 || sort !== sortId || !Array.isArray(keys)) {
      return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    }
    if (keys.length !== keyOrderIds.length) {
      return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    }
    const checked: Array<string | number | null> = [];
    for (let i = 0; i < keys.length; i++) {
      const id = keyOrderIds[i];
      const value: unknown = keys[i];
      if (id === 'due_date_is_null') {
        if (value !== 0 && value !== 1) {
          return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
        }
        checked.push(value);
      } else if (id === 'due_date') {
        if (value !== null && (typeof value !== 'string' || !isCalendarDate(value))) {
          return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
        }
        checked.push(value);
      } else if (id === 'id') {
        if (typeof value !== 'string' || value.length === 0) {
          return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
        }
        checked.push(value);
      } else if (typeof value !== 'string') {
        return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
      } else {
        checked.push(value);
      }
    }
    cursorKeys = checked;

    // Keyset predicate over the ORDER BY expressions in order.
    const branches: string[] = [];
    for (let i = 0; i < keyOrderIds.length; i++) {
      const expr = orderExprs[i];
      const leaf = cursorKeys[i];
      if (expr === undefined || leaf === undefined) {
        return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
      }
      const parts: string[] = [];
      for (let j = 0; j < i; j++) {
        const prefix = orderExprs[j];
        const prefixKey = cursorKeys[j];
        if (prefix === undefined || prefixKey === undefined) {
          return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
        }
        parts.push(`${prefix.sql} IS ${useBind(prefixKey)}`);
      }
      if (leaf === null) {
        parts.push('1 = 0');
      } else {
        const op = expr.dir === 'ASC' ? '>' : '<';
        parts.push(`${expr.sql} ${op} ${useBind(leaf)}`);
      }
      branches.push(`(${parts.join(' AND ')})`);
    }
    where.push(`(${branches.join(' OR ')})`);
  }

  return {
    ok: true,
    query: {
      where: where.join(' AND '),
      binds,
      orderBy,
      keyIds: keyOrderIds,
      directions: [...orderExprs.map((e) => e.dir)],
      sortId,
      limit,
      cursorKeys,
    },
  };
}

export interface TaskPage {
  items: TaskListItem[];
  nextCursor: string | null;
}

export function encodeCursor(sortId: string, keys: Array<string | number | null>): string {
  return base64UrlEncodeText(JSON.stringify({ v: 1, s: sortId, k: keys }));
}

function cursorKeyFor(row: TaskRow, keyId: string): string | number | null {
  if (keyId === 'due_date_is_null') return row.due_date === null ? 1 : 0;
  if (keyId === 'due_date') return row.due_date;
  if (keyId === 'id') return row.id;
  const value = row[keyId as 'updated_at' | 'created_at' | 'status' | 'priority' | 'title'];
  return typeof value === 'string' ? value : null;
}

export async function listTasks(
  db: D1Database,
  userId: string,
  parsed: ParsedTaskList,
  today: string,
): Promise<TaskPage> {
  const rows = await db
    .prepare(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE ${parsed.where} ${parsed.orderBy} LIMIT ?`,
    )
    .bind(userId, ...parsed.binds, parsed.limit + 1)
    .all<TaskRow>();
  const results = rows.results ?? [];
  const page = results.slice(0, parsed.limit);
  let nextCursor: string | null = null;
  if (results.length > parsed.limit) {
    const last = page[page.length - 1];
    if (last !== undefined) {
      nextCursor = encodeCursor(
        parsed.sortId,
        parsed.keyIds.map((id) => cursorKeyFor(last, id)),
      );
    }
  }
  return { items: page.map((row) => toListItem(row, today)), nextCursor };
}

export { toListItem as taskRowToListItem, toTask as taskRowToTask };

/* ------------------------------------------------------------------ dashboard */

export async function dashboardFigures(
  db: D1Database,
  userId: string,
  today: string,
): Promise<{ tasks: Dashboard['tasks']; byStatus: Dashboard['byStatus']; byPriority: Dashboard['byPriority'] }> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1) AS total,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND status <> 'completed') AS active,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND status = 'completed') AS completed,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND due_date IS NOT NULL AND due_date < ?2 AND status <> 'completed') AS overdue,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND status = 'todo') AS todo,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND status = 'in_progress') AS in_progress,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND priority = 'low') AS low,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND priority = 'medium') AS medium,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ?1 AND priority = 'high') AS high`,
    )
    .bind(userId, today)
    .first<{
      total: number;
      active: number;
      completed: number;
      overdue: number;
      todo: number;
      in_progress: number;
      low: number;
      medium: number;
      high: number;
    }>();
  return {
    tasks: {
      total: row?.total ?? 0,
      active: row?.active ?? 0,
      completed: row?.completed ?? 0,
      overdue: row?.overdue ?? 0,
    },
    byStatus: { todo: row?.todo ?? 0, in_progress: row?.in_progress ?? 0, completed: row?.completed ?? 0 },
    byPriority: { low: row?.low ?? 0, medium: row?.medium ?? 0, high: row?.high ?? 0 },
  };
}

export async function recentTasks(db: D1Database, userId: string): Promise<TaskRow[]> {
  const rows = await db
    .prepare(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = ?1 ORDER BY updated_at DESC, id DESC LIMIT 5`,
    )
    .bind(userId)
    .all<TaskRow>();
  return rows.results ?? [];
}

export interface NotePreview {
  id: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  attachments: never[];
  attachmentCount: 0;
  updatedAt: string;
}

interface NotePreviewRow {
  id: string;
  title: string;
  excerpt: string;
  pinned: number;
  updated_at: string;
}

export async function recentNotePreviews(db: D1Database, userId: string): Promise<NotePreview[]> {
  const rows = await db
    .prepare(
      'SELECT id, title, substr(body, 1, 200) AS excerpt, pinned, updated_at FROM notes WHERE user_id = ?1 ORDER BY updated_at DESC, id DESC LIMIT 5'
    )
    .bind(userId)
    .all<NotePreviewRow>();
  return (rows.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    pinned: row.pinned === 1,
    attachments: [],
    attachmentCount: 0,
    updatedAt: row.updated_at,
  }));
}
