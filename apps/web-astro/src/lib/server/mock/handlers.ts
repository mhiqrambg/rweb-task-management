import {
  api,
  copy,
  createNoteSchema,
  createTaskSchema,
  loginSchema,
  parseForm,
  registerSchema,
  updateNoteSchema,
  updateTaskSchema,
  uploadTargetSchema,
  type ErrorCode,
  type PageMeta,
  type ValidationDetail,
} from '@taskapp/contracts';
import { isProduction } from '../env';
import type { ApiRaw, ApiRequestInput } from '../types';
import {
  MOCK_PASSWORD,
  findSessionUser,
  getStore,
  isOverdue,
  newToken,
  toAttachment,
  toAttachmentSummary,
  toNote,
  toNoteListItem,
  toTask,
  toTaskListItem,
  toUser,
  type MockAttachmentRow,
  type MockNoteRow,
  type MockStore,
  type MockTaskRow,
  type MockUserRow,
} from './store';

/**
 * The 22 endpoints of .planning/06 §5, implemented against the in-memory store.
 * Same envelopes, same status codes, same owner predicate (`id AND user_id`), same 404 for a
 * foreign row. Anything that would need D1, sharp or R2 is simplified and marked.
 */

const PREFIX = '/api/v1';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function mockRequest(input: ApiRequestInput): Promise<ApiRaw> {
  const [rawPath = '', rawQuery = ''] = input.path.split('?');
  const path = rawPath.startsWith(PREFIX) ? rawPath.slice(PREFIX.length) : rawPath;
  const query = new URLSearchParams(rawQuery);
  const store = getStore();
  const user = findSessionUser(store, input.cookie);

  if (input.method === 'GET' && path === '/health') {
    return ok(200, { status: 'ok', db: 'ok', storage: 'ok' });
  }

  if (input.method === 'POST' && path === '/auth/register') {
    return register(store, input.body);
  }

  if (input.method === 'POST' && path === '/auth/login') {
    return login(store, input.body, user);
  }

  if (input.method === 'POST' && path === '/auth/logout') {
    return logout(store, input.cookie);
  }

  if (input.method === 'GET' && path === '/auth/me') {
    // An expired or unknown token is cleared on the same answer, so the browser stops sending it
    // (06 §2.1). A request with no cookie at all has nothing to clear.
    if (!user) {
      return input.cookie ? { ...unauthenticated(), setCookie: clearedCookie() } : unauthenticated();
    }
    const session = store.sessions.find((row) => row.userId === user.id);
    return ok(200, { user: toUser(user), expiresAt: session?.expiresAt ?? expiresIn() });
  }

  if (!user) return unauthenticated();

  if (input.method === 'GET' && path === '/users/me') return ok(200, toUser(user));

  if (input.method === 'GET' && path === '/dashboard') return dashboard(store, user);

  if (path === '/tasks') {
    if (input.method === 'GET') return listTasks(store, user, query);
    if (input.method === 'POST') return createTask(store, user, input.body);
    return notFound();
  }

  const taskMatch = /^\/tasks\/([^/]+)$/.exec(path);
  if (taskMatch?.[1]) {
    const id = taskMatch[1];
    if (input.method === 'GET') return readTask(store, user, id);
    if (input.method === 'PATCH') return patchTask(store, user, id, input.body);
    if (input.method === 'DELETE') return deleteTask(store, user, id);
    return notFound();
  }

  if (path === '/notes') {
    if (input.method === 'GET') return listNotes(store, user, query);
    if (input.method === 'POST') return createNote(store, user, input.body);
    return notFound();
  }

  const noteMatch = /^\/notes\/([^/]+)$/.exec(path);
  if (noteMatch?.[1]) {
    const id = noteMatch[1];
    if (input.method === 'GET') return readNote(store, user, id);
    if (input.method === 'PATCH') return patchNote(store, user, id, input.body);
    if (input.method === 'DELETE') return deleteNote(store, user, id);
    return notFound();
  }

  if (input.method === 'POST' && path === '/attachments') {
    return uploadAttachment(store, user, input.form);
  }

  const attachmentMatch = /^\/attachments\/([^/]+)(\/content)?$/.exec(path);
  if (attachmentMatch?.[1]) {
    const id = attachmentMatch[1];
    if (attachmentMatch[2]) {
      // The mock serves placeholders from /mock-media/:id.svg, so this route is unused.
      return notFound();
    }
    if (input.method === 'GET') return readAttachment(store, user, id);
    if (input.method === 'DELETE') return deleteAttachment(store, user, id);
  }

  return notFound();
}

/* ---------------------------------------------------------------- auth */

function register(store: MockStore, body: unknown): ApiRaw {
  const parsed = parseForm(registerSchema, asRecord(body));
  if (!parsed.ok) return invalid(parsed.errors);

  const { email, password } = parsed.value;
  if (store.users.some((row) => row.email.toLowerCase() === email.toLowerCase())) {
    return fail(409, 'CONFLICT', copy.auth.error.emailTaken, [
      { field: 'email', code: 'conflict', message: copy.auth.error.emailTaken },
    ]);
  }

  const now = new Date().toISOString();
  const displayName =
    parsed.value.displayName?.trim() || email.split('@')[0]?.slice(0, 100) || email.slice(0, 100);
  const user: MockUserRow = {
    id: crypto.randomUUID(),
    email,
    displayName,
    createdAt: now,
    updatedAt: now,
    password,
  };
  store.users.push(user);

  const token = startSession(store, user);
  return {
    status: 201,
    data: { user: toUser(user), expiresAt: expiresIn() },
    page: null,
    setCookie: sessionCookie(token),
    error: null,
  };
}

function login(store: MockStore, body: unknown, currentUser: MockUserRow | null): ApiRaw {
  const parsed = parseForm(loginSchema, asRecord(body));
  if (!parsed.ok) return invalid(parsed.errors);
  if (currentUser) {
    return fail(409, 'CONFLICT', copy.error.form);
  }

  const { email, password } = parsed.value;
  const user = store.users.find((row) => row.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password || password !== MOCK_PASSWORD) {
    return fail(401, 'UNAUTHENTICATED', copy.auth.error.invalidCredentials);
  }

  const token = startSession(store, user);
  return {
    status: 200,
    data: { user: toUser(user), expiresAt: expiresIn() },
    page: null,
    setCookie: sessionCookie(token),
    error: null,
  };
}

function logout(store: MockStore, cookie: string | null): ApiRaw {
  const token = cookieValueOf(cookie);
  if (!token) return { ...unauthenticated(), setCookie: clearedCookie() };
  const before = store.sessions.length;
  store.sessions = store.sessions.filter((row) => row.token !== token);
  if (store.sessions.length === before) {
    return { ...unauthenticated(), setCookie: clearedCookie() };
  }
  return { status: 204, data: null, page: null, setCookie: clearedCookie(), error: null };
}

function startSession(store: MockStore, user: MockUserRow): string {
  const token = newToken();
  store.sessions.push({ token, userId: user.id, expiresAt: expiresIn() });
  return token;
}

/* ---------------------------------------------------------------- dashboard */

function dashboard(store: MockStore, user: MockUserRow): ApiRaw {
  const mine = store.tasks.filter((row) => row.userId === user.id);
  const notes = store.notes.filter((row) => row.userId === user.id);

  const byStatus = { todo: 0, in_progress: 0, completed: 0 };
  const byPriority = { low: 0, medium: 0, high: 0 };
  let overdue = 0;
  for (const task of mine) {
    byStatus[task.status] += 1;
    byPriority[task.priority] += 1;
    if (isOverdue(task)) overdue += 1;
  }

  const recentTasks = sortRows(mine, '-updated_at').slice(0, 5).map(toTaskListItem);
  const recentNotes = sortRows(notes, '-updated_at').slice(0, 5).map(toNoteListItem);

  return ok(200, {
    tasks: {
      total: mine.length,
      active: byStatus.todo + byStatus.in_progress,
      completed: byStatus.completed,
      overdue,
    },
    byStatus,
    byPriority,
    recentTasks,
    recentNotes,
  });
}

/* ---------------------------------------------------------------- tasks */

function listTasks(store: MockStore, user: MockUserRow, query: URLSearchParams): ApiRaw {
  let rows = store.tasks.filter((row) => row.userId === user.id);

  const term = query.get('q')?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(term) ||
        (row.description ?? '').toLowerCase().includes(term),
    );
  }

  const status = query.get('status');
  if (status) rows = rows.filter((row) => row.status === status);

  const priority = query.get('priority');
  if (priority) rows = rows.filter((row) => row.priority === priority);

  const dueState = query.get('dueState');
  const today = todayCalendar();
  if (dueState === 'overdue') rows = rows.filter((row) => isOverdue(row));
  if (dueState === 'today') rows = rows.filter((row) => row.dueDate === today);
  if (dueState === 'none') rows = rows.filter((row) => row.dueDate === null);
  if (dueState === 'range') {
    const from = query.get('dueFrom') ?? today;
    const to = query.get('dueTo') ?? today;
    rows = rows.filter((row) => row.dueDate !== null && row.dueDate >= from && row.dueDate <= to);
  }

  if (query.get('hasAttachments') === 'true') {
    rows = rows.filter((row) => row.attachments.length > 0);
  }

  const sort = query.get('sort') ?? '-updated_at';
  rows = sortRows(rows, sort);

  const limit = clampLimit(query.get('limit'));
  const cursor = readCursor(query.get('cursor'), sort);
  if (cursor === null) {
    return fail(422, 'VALIDATION_FAILED', copy.error.form, [
      { field: 'cursor', code: 'invalid_cursor', message: copy.error.form },
    ]);
  }

  const pageRows = rows.slice(cursor, cursor + limit);
  const nextCursor =
    rows.length > cursor + limit ? writeCursor(sort, cursor + limit) : null;

  return {
    status: 200,
    data: pageRows.map(toTaskListItem),
    page: { limit, nextCursor } satisfies PageMeta,
    setCookie: null,
    error: null,
  };
}

function createTask(store: MockStore, user: MockUserRow, body: unknown): ApiRaw {
  const parsed = parseForm(createTaskSchema, asRecord(body));
  if (!parsed.ok) return invalid(parsed.errors);

  const now = new Date().toISOString();
  const row: MockTaskRow = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: parsed.value.title,
    description: parsed.value.description ?? null,
    status: parsed.value.status ?? 'todo',
    priority: parsed.value.priority ?? 'medium',
    dueDate: parsed.value.dueDate ?? null,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
  store.tasks.push(row);
  return { status: 201, data: toTask(row), page: null, setCookie: null, error: null };
}

function readTask(store: MockStore, user: MockUserRow, id: string): ApiRaw {
  const row = ownedTask(store, user, id);
  if (!row) return notFound();
  return ok(200, toTask(row));
}

function patchTask(store: MockStore, user: MockUserRow, id: string, body: unknown): ApiRaw {
  const row = ownedTask(store, user, id);
  if (!row) return notFound();

  const parsed = parseForm(updateTaskSchema, asRecord(body));
  if (!parsed.ok) return invalid(parsed.errors);

  const patch = parsed.value;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.dueDate !== undefined) row.dueDate = patch.dueDate;
  row.updatedAt = new Date().toISOString();

  return ok(200, toTask(row));
}

function deleteTask(store: MockStore, user: MockUserRow, id: string): ApiRaw {
  const row = ownedTask(store, user, id);
  if (!row) return notFound();
  store.tasks = store.tasks.filter((task) => task.id !== row.id);
  return { status: 204, data: null, page: null, setCookie: null, error: null };
}

/* ---------------------------------------------------------------- notes */

function listNotes(store: MockStore, user: MockUserRow, query: URLSearchParams): ApiRaw {
  let rows = store.notes.filter((row) => row.userId === user.id);

  const term = query.get('q')?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(term) || row.body.toLowerCase().includes(term),
    );
  }

  const pinned = query.get('pinned');
  if (pinned === 'true') rows = rows.filter((row) => row.pinned);
  if (pinned === 'false') rows = rows.filter((row) => !row.pinned);

  const sort = query.get('sort') ?? '-pinned,-updated_at';
  rows = sortRows(rows, sort);

  const limit = clampLimit(query.get('limit'));
  const cursor = readCursor(query.get('cursor'), sort);
  if (cursor === null) {
    return fail(422, 'VALIDATION_FAILED', copy.error.form, [
      { field: 'cursor', code: 'invalid_cursor', message: copy.error.form },
    ]);
  }

  const pageRows = rows.slice(cursor, cursor + limit);
  const nextCursor = rows.length > cursor + limit ? writeCursor(sort, cursor + limit) : null;

  return {
    status: 200,
    data: pageRows.map(toNoteListItem),
    page: { limit, nextCursor } satisfies PageMeta,
    setCookie: null,
    error: null,
  };
}

function createNote(store: MockStore, user: MockUserRow, body: unknown): ApiRaw {
  const parsed = parseForm(createNoteSchema, asRecord(body));
  if (!parsed.ok) return invalid(parsed.errors);

  const now = new Date().toISOString();
  const row: MockNoteRow = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: parsed.value.title,
    body: parsed.value.body,
    pinned: parsed.value.pinned ?? false,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
  store.notes.push(row);
  return { status: 201, data: toNote(row), page: null, setCookie: null, error: null };
}

function readNote(store: MockStore, user: MockUserRow, id: string): ApiRaw {
  const row = ownedNote(store, user, id);
  if (!row) return notFound();
  return ok(200, toNote(row));
}

function patchNote(store: MockStore, user: MockUserRow, id: string, body: unknown): ApiRaw {
  const row = ownedNote(store, user, id);
  if (!row) return notFound();

  const parsed = parseForm(updateNoteSchema, asRecord(body));
  if (!parsed.ok) return invalid(parsed.errors);

  const patch = parsed.value;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.pinned !== undefined) row.pinned = patch.pinned;
  row.updatedAt = new Date().toISOString();

  return ok(200, toNote(row));
}

function deleteNote(store: MockStore, user: MockUserRow, id: string): ApiRaw {
  const row = ownedNote(store, user, id);
  if (!row) return notFound();
  store.notes = store.notes.filter((note) => note.id !== row.id);
  return { status: 204, data: null, page: null, setCookie: null, error: null };
}

/* ---------------------------------------------------------------- attachments */

function uploadAttachment(
  store: MockStore,
  user: MockUserRow,
  form: FormData | undefined,
): ApiRaw {
  if (!form) return invalid({ form: copy.error.form });

  const target = parseForm(uploadTargetSchema, {
    targetType: form.get('targetType'),
    targetId: form.get('targetId'),
  });
  if (!target.ok) return invalid(target.errors);

  const { targetType, targetId } = target.value;
  const parent =
    targetType === 'task' ? ownedTask(store, user, targetId) : ownedNote(store, user, targetId);

  if (!parent) return notFound();
  if (parent.attachments.length >= MAX_ATTACHMENTS) {
    return fail(422, 'VALIDATION_FAILED', copy.upload.reject.count, [
      { field: 'file', code: 'attachment_limit', message: copy.upload.reject.sizeShort },
    ]);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return fail(415, 'UNSUPPORTED_MEDIA_TYPE', copy.error.form, [
      { field: 'file', code: 'mime_not_allowed', message: copy.error.form },
    ]);
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return fail(415, 'UNSUPPORTED_MEDIA_TYPE', copy.error.form, [
      { field: 'file', code: 'mime_not_allowed', message: copy.error.form, file: file.name },
    ]);
  }

  if (file.size > MAX_BYTES) {
    return fail(413, 'PAYLOAD_TOO_LARGE', copy.upload.reject.sizeShort, [
      { field: 'file', code: 'too_large', message: copy.upload.reject.sizeShort, file: file.name },
    ]);
  }

  const id = crypto.randomUUID();
  const row: MockAttachmentRow = {
    id,
    userId: user.id,
    targetType,
    targetId,
    mime: file.type as MockAttachmentRow['mime'],
    // The mock cannot decode bytes; the real API reads dimensions with sharp (06 §8.3).
    width: 1600,
    height: 1200,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
    thumbUrl: `/mock-media/${id}.svg?variant=thumb`,
    fullUrl: `/mock-media/${id}.svg?variant=full`,
  };
  parent.attachments.push(row);
  parent.updatedAt = row.createdAt;

  return { status: 201, data: toAttachment(row), page: null, setCookie: null, error: null };
}

function readAttachment(store: MockStore, user: MockUserRow, id: string): ApiRaw {
  const row = store.tasks
    .flatMap((task) => task.attachments)
    .concat(store.notes.flatMap((note) => note.attachments))
    .find((attachment) => attachment.id === id && attachment.userId === user.id);
  if (!row) return notFound();
  return ok(200, toAttachment(row));
}

function deleteAttachment(store: MockStore, user: MockUserRow, id: string): ApiRaw {
  const task = store.tasks.find(
    (row) => row.userId === user.id && row.attachments.some((item) => item.id === id),
  );
  const note = store.notes.find(
    (row) => row.userId === user.id && row.attachments.some((item) => item.id === id),
  );
  const parent = task ?? note;
  if (!parent) return notFound();

  const removed = parent.attachments.find((item) => item.id === id);
  if (!removed) return notFound();
  parent.attachments = parent.attachments.filter((item) => item.id !== id);
  parent.updatedAt = new Date().toISOString();

  return { status: 204, data: null, page: null, setCookie: null, error: null };
}

/* ---------------------------------------------------------------- sorting + cursor */

interface SortableRow {
  id: string;
  updatedAt: string;
  createdAt: string;
  dueDate?: string | null;
  priority?: MockTaskRow['priority'];
  pinned?: boolean;
}

const PRIORITY_RANK: Record<MockTaskRow['priority'], number> = { low: 0, medium: 1, high: 2 };

export function sortRows<T extends SortableRow>(rows: T[], sort: string): T[] {
  const keys = sort
    .split(',')
    .filter(Boolean)
    .map((token) => ({
      key: token.startsWith('-') ? token.slice(1) : token,
      desc: token.startsWith('-'),
    }));

  return [...rows].sort((a, b) => {
    for (const { key, desc } of keys) {
      const diff = compareKey(a, b, key);
      if (diff !== 0) return desc ? -diff : diff;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function compareKey(a: SortableRow, b: SortableRow, key: string): number {
  if (key === 'due_date') {
    // NULL is not a date: it sorts last in both directions (06 §6.3).
    const aDate = a.dueDate ?? null;
    const bDate = b.dueDate ?? null;
    if (aDate === null && bDate === null) return 0;
    if (aDate === null) return 1;
    if (bDate === null) return -1;
    return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
  }
  if (key === 'priority') {
    return (PRIORITY_RANK[a.priority ?? 'low'] ?? 0) - (PRIORITY_RANK[b.priority ?? 'low'] ?? 0);
  }
  if (key === 'pinned') {
    return Number(a.pinned ?? false) - Number(b.pinned ?? false);
  }
  if (key === 'created_at') {
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  }
  return a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0;
}

function readCursor(cursor: string | null, sort: string): number | null {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      v?: number;
      s?: string;
      o?: number;
    };
    if (parsed.v !== 1 || parsed.s !== sort || !Number.isInteger(parsed.o) || parsed.o! < 0) {
      return null;
    }
    return parsed.o!;
  } catch {
    return null;
  }
}

function writeCursor(sort: string, offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, s: sort, o: offset }), 'utf8').toString('base64url');
}

/* ---------------------------------------------------------------- envelopes */

function ok(status: number, data: unknown): ApiRaw {
  return { status, data, page: null, setCookie: null, error: null };
}

function fail(
  status: number,
  code: ErrorCode,
  message: string,
  details: ValidationDetail[] = [],
): ApiRaw {
  return {
    status,
    data: null,
    page: null,
    setCookie: null,
    error: { code, message, requestId: `mock-${crypto.randomUUID()}`, details },
  };
}

function invalid(errors: Record<string, string>): ApiRaw {
  const details: ValidationDetail[] = Object.entries(errors).map(([field, message]) => ({
    field,
    code: 'invalid',
    message,
  }));
  return fail(422, 'VALIDATION_FAILED', copy.error.form, details);
}

function notFound(): ApiRaw {
  return fail(404, 'NOT_FOUND', copy.state.notFound.body);
}

function unauthenticated(): ApiRaw {
  return fail(401, 'UNAUTHENTICATED', copy.auth.error.sessionExpired);
}

/* ---------------------------------------------------------------- owner lookups */

function ownedTask(store: MockStore, user: MockUserRow, id: string): MockTaskRow | null {
  if (!UUID.test(id)) return null;
  return store.tasks.find((row) => row.id === id && row.userId === user.id) ?? null;
}

function ownedNote(store: MockStore, user: MockUserRow, id: string): MockNoteRow | null {
  if (!UUID.test(id)) return null;
  return store.notes.find((row) => row.id === id && row.userId === user.id) ?? null;
}

/* ---------------------------------------------------------------- small helpers */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function clampLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 20;
  return Math.min(100, Math.max(1, parsed));
}

function todayCalendar(): string {
  return new Date().toISOString().slice(0, 10);
}

function cookieValueOf(cookie: string | null): string | null {
  if (!cookie) return null;
  return /(?:^|;\s*)sid=([^;]+)/.exec(cookie)?.[1] ?? null;
}

function expiresIn(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function sessionCookie(token: string): string {
  const secure = isProduction() ? '; Secure' : '';
  return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

function clearedCookie(): string {
  const secure = isProduction() ? '; Secure' : '';
  return `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export { api, copy, toAttachmentSummary };
