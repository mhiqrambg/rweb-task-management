import {
  api,
  copy,
  createTaskSchema,
  toCalendarDate,
  updateTaskSchema,
  validationDetails,
  validationMessage,
  type Task,
  type TaskListItem,
  type User,
} from '@taskapp/contracts';
import { Elysia, type HTTPHeaders } from 'elysia';
import type { ZodError } from 'zod';
import { getConfig } from '../../context';
import type { Config } from '../../config';
import { resolveSession } from '../auth/session';
import { parseJsonBody } from '../../lib/http';
import { consumeRateLimit, rateLimitError } from '../../lib/rate-limit';
import { ApiError } from '../../lib/errors';
import {
  dashboardFigures,
  deleteTask,
  findTask,
  insertTask,
  listTasks,
  parseTaskListQuery,
  recentTasks,
  taskRowToListItem,
  taskRowToTask,
  updateTask,
} from './repo';
import { recentNotePreviews } from '../notes/repo';
import { hydrateAttachments, taskAttachmentSets } from '../attachments/routes';
import { attachmentKeysForTarget } from '../attachments/repo';

export const tasksRoutes = new Elysia();

const TASKS_BUCKET = 'tasks-user';
const TASKS_LIMIT = 300;
const TASKS_WINDOW_SECONDS = 60;

function validationFailure(error: ZodError): ApiError {
  const details = validationDetails(error);
  return new ApiError('VALIDATION_FAILED', validationMessage(details), { details });
}

async function enforceUserLimit(db: D1Database, userId: string): Promise<void> {
  const outcome = await consumeRateLimit(db, TASKS_BUCKET, userId, TASKS_LIMIT, TASKS_WINDOW_SECONDS);
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

function routeId(params: unknown): string {
  // Elysia parses `:id` from the registered string at runtime; the string is computed so its
  // static type is `string` and params arrive untyped — hence the narrowing below.
  if (typeof params === 'object' && params !== null && 'id' in params) {
    const id: unknown = params.id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  throw new ApiError('NOT_FOUND', copy.state.notFound.body);
}

function taskQueryParams(request: Request): Record<string, string | undefined> {
  const params = new URL(request.url).searchParams;
  const pick = (name: string): string | undefined => {
    const values = params.getAll(name);
    if (values.length > 1 && (name === 'q' || name === 'status')) {
      throw new ApiError('VALIDATION_FAILED', copy.error.form, {
        details: [{ field: name, code: 'repeated', message: copy.error.form }],
      });
    }
    return values.pop();
  };
  return {
    q: pick('q'),
    status: pick('status'),
    priority: pick('priority'),
    dueState: pick('dueState'),
    dueFrom: pick('dueFrom'),
    dueTo: pick('dueTo'),
    hasAttachments: pick('hasAttachments'),
    limit: pick('limit'),
    cursor: pick('cursor'),
    sort: pick('sort'),
  };
}

/** #8 — paginated, filtered, sorted task list (FR-TASK-003/004/011..015). */
tasksRoutes.get(api.tasks, async ({ request, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const today = toCalendarDate(new Date());
  const parsed = parseTaskListQuery(taskQueryParams(request), today);
  if (!parsed.ok) {
    throw new ApiError('VALIDATION_FAILED', copy.error.form, {
      details: [{ field: parsed.failure.field, code: parsed.failure.code, message: parsed.failure.message }],
    });
  }
  // FR-TASK-017: the first three thumbnails plus the exact count, from one query for the page.
  const page = await listTasks(cfg.db, user.id, parsed.query, today);
  const hydrated = await hydrateAttachments(
    cfg.db,
    user.id,
    page.items.map((item) => item.id),
  );
  const items = page.items.map((item) => {
    const entry = hydrated.get(item.id);
    return { ...item, attachments: entry?.summaries ?? [], attachmentCount: entry?.count ?? 0 };
  });
  return { data: items, page: { limit: parsed.query.limit, nextCursor: page.nextCursor } };
});

/** #9 — create a task owned by the session user (FR-TASK-001/002). */
tasksRoutes.post(api.tasks, async ({ request, body, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const parsed = createTaskSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const now = new Date(Date.now()).toISOString();
  const row = await insertTask(cfg.db, {
    userId: user.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: parsed.data.status ?? 'todo',
    priority: parsed.data.priority ?? 'medium',
    dueDate: parsed.data.dueDate ?? null,
    now,
  });
  const task: Task = taskRowToTask(row, toCalendarDate(new Date()));
  set.status = 201;
  set.headers['Location'] = api.task(task.id);
  return { data: task };
});

/** #10 — task detail; absent or foreign is 404 (FR-TASK-005). */
tasksRoutes.get(`${api.tasks}/:id`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const row = await findTask(cfg.db, user.id, routeId(params));
  if (!row) throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  const { all } = await taskAttachmentSets(cfg.db, user.id, row.id);
  const task: Task = taskRowToTask(row, toCalendarDate(new Date()), all);
  return { data: task };
});

/** #11 — partial update; absent/foreign affects 0 rows is 404 (FR-TASK-006/007). */
tasksRoutes.patch(`${api.tasks}/:id`, async ({ request, body, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const parsed = updateTaskSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const input = parsed.data;
  const patch: { title?: string; description?: string | null; status?: string; priority?: string; dueDate?: string | null } = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
  };
  if (Object.keys(patch).length === 0) throw new ApiError('VALIDATION_FAILED', copy.error.form);

  const row = await updateTask(cfg.db, user.id, routeId(params), patch, new Date(Date.now()).toISOString());
  if (!row) throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  const { all } = await taskAttachmentSets(cfg.db, user.id, row.id);
  const task: Task = taskRowToTask(row, toCalendarDate(new Date()), all);
  return { data: task };
});

/** #12 — hard delete; repeat or foreign is 404 (FR-TASK-021). */
tasksRoutes.delete(`${api.tasks}/:id`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const id = routeId(params);
  // FR-ATT-011: read the keys before the cascade deletes the rows that name them, then sweep.
  const keys = await attachmentKeysForTarget(cfg.db, user.id, { taskId: id, noteId: null });
  const deleted = await deleteTask(cfg.db, user.id, id);
  if (!deleted) throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  await Promise.all(
    keys.flatMap((entry) => [
      cfg.bucket.delete(entry.storage_key),
      entry.thumb_key ? cfg.bucket.delete(entry.thumb_key) : Promise.resolve(),
    ]),
  );
  set.status = 204;
});

/** #7 — dashboard aggregate: figures in one statement, recents alongside (FR-DASH-001..006). */

tasksRoutes.get(api.dashboard, async ({ request, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const today = toCalendarDate(new Date());
  const [figures, taskRows, noteRows] = await Promise.all([
    dashboardFigures(cfg.db, user.id, today),
    recentTasks(cfg.db, user.id),
    recentNotePreviews(cfg.db, user.id),
  ]);
  // FR-DASH-004/005: each recent row carries its first three thumbnails plus the exact count.
  const recent = await hydrateAttachments(
    cfg.db,
    user.id,
    [...taskRows.map((row) => row.id), ...noteRows.map((row) => row.id)],
  );
  const items: TaskListItem[] = taskRows.map((row) => {
    const entry = recent.get(row.id);
    return taskRowToListItem(row, today, entry?.summaries ?? [], entry?.count ?? 0);
  });
  const recentNotes = noteRows.map((row) => {
    const entry = recent.get(row.id);
    return { ...row, attachments: entry?.summaries ?? [], attachmentCount: entry?.count ?? 0 };
  });

  return {
    data: {
      tasks: figures.tasks,
      byStatus: figures.byStatus,
      byPriority: figures.byPriority,
      recentTasks: items,
      recentNotes,
    },
  };
});
