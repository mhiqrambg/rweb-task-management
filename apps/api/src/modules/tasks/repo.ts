import type { Attachment, AttachmentSummary, Dashboard, Task, TaskListItem } from '@taskapp/contracts';
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

function toListItem(
  row: TaskRow,
  today: string,
  attachments: AttachmentSummary[] = [],
  attachmentCount = attachments.length,
): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    status: toStatus(row.status),
    priority: toPriority(row.priority),
    dueDate: row.due_date,
    isOverdue: isOverdue(row.status, row.due_date, today),
    // The caller hydrates the first three of the stable order (FR-TASK-017) plus the exact total,
    // so a fourth attachment shows as `+N` without a second read.
    attachments,
    attachmentCount,
    updatedAt: row.updated_at,
  };
}

function toTask(
  row: TaskRow,
  today: string,
  attachments: Attachment[] = [],
): Task {
  return {
    ...toListItem(row, today, attachments),
    attachments,
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
  sortId: string;
  limit: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  let cursorKeys: CursorValue[] | null = null;
  if (params.cursor !== undefined) {
    const decoded = decodeCursor(params.cursor, sortId, keyOrderIds, taskCursorKeyCheck);
    if (!decoded.ok) return { ok: false, failure: fail('cursor', 'cursor', 'That link is no longer valid.') };
    cursorKeys = decoded.keys;
    where.push(cursorPredicate(orderExprs, cursorKeys, useBind));
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

export interface TaskPage {
  items: TaskListItem[];
  nextCursor: string | null;
}

/** §6.1 per-key typing: each ORDER BY expression's cursor value must parse to its declared type. */
function taskCursorKeyCheck(keyId: string, value: unknown): CursorValue | undefined {
  if (keyId === 'due_date_is_null') return value === 0 || value === 1 ? value : undefined;
  if (keyId === 'due_date') {
    if (value === null) return null;
    return typeof value === 'string' && isCalendarDate(value) ? value : undefined;
  }
  if (keyId === 'id') return typeof value === 'string' && value.length > 0 ? value : undefined;
  return typeof value === 'string' ? value : undefined;
}

function cursorKeyFor(row: TaskRow, keyId: string): CursorValue {
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
  attachments?: Map<string, { summaries: AttachmentSummary[]; count: number }>,
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
  return {
    items: page.map((row) => {
      const entry = attachments?.get(row.id);
      return toListItem(row, today, entry?.summaries ?? [], entry?.count ?? 0);
    }),
    nextCursor,
  };
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
