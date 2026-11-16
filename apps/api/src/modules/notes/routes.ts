import {
  api,
  copy,
  createNoteSchema,
  updateNoteSchema,
  validationDetails,
  type Note,
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
  deleteNote,
  findNote,
  insertNote,
  listNotes,
  noteRowToNote,
  parseNoteListQuery,
  updateNote,
} from './repo';

export const notesRoutes = new Elysia();

const NOTES_BUCKET = 'notes-user';
const NOTES_LIMIT = 300;
const NOTES_WINDOW_SECONDS = 60;

function validationFailure(error: ZodError): ApiError {
  return new ApiError('VALIDATION_FAILED', copy.error.form, { details: validationDetails(error) });
}

async function enforceUserLimit(db: D1Database, userId: string): Promise<void> {
  const outcome = await consumeRateLimit(db, NOTES_BUCKET, userId, NOTES_LIMIT, NOTES_WINDOW_SECONDS);
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

function noteQueryParams(request: Request): Record<string, string | undefined> {
  const params = new URL(request.url).searchParams;
  const pick = (name: string): string | undefined => {
    const values = params.getAll(name);
    // §6.6: a repeated free-text or enum filter is a rejection, not a "last one wins".
    if (values.length > 1 && (name === 'q' || name === 'pinned')) {
      throw new ApiError('VALIDATION_FAILED', copy.error.form, {
        details: [{ field: name, code: 'repeated', message: copy.error.form }],
      });
    }
    return values.pop();
  };
  return {
    q: pick('q'),
    pinned: pick('pinned'),
    limit: pick('limit'),
    cursor: pick('cursor'),
    sort: pick('sort'),
  };
}

/** #13 — paginated, searched, sorted note list, pinned first by default (FR-NOTE-003/004/008). */
notesRoutes.get(api.notes, async ({ request, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const parsed = parseNoteListQuery(noteQueryParams(request));
  if (!parsed.ok) {
    throw new ApiError('VALIDATION_FAILED', copy.error.form, {
      details: [{ field: parsed.failure.field, code: parsed.failure.code, message: parsed.failure.message }],
    });
  }
  const page = await listNotes(cfg.db, user.id, parsed.query);
  return { data: page.items, page: { limit: parsed.query.limit, nextCursor: page.nextCursor } };
});

/** #14 — create a note owned by the session user (FR-NOTE-001/002). */
notesRoutes.post(api.notes, async ({ request, body, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const parsed = createNoteSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const row = await insertNote(cfg.db, {
    userId: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
    pinned: parsed.data.pinned ?? false,
    now: new Date(Date.now()).toISOString(),
  });
  const note: Note = noteRowToNote(row);
  set.status = 201;
  set.headers['Location'] = api.note(note.id);
  return { data: note };
});

/** #15 — note detail; absent or foreign is 404 (FR-NOTE-005). */
notesRoutes.get(`${api.notes}/:id`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const row = await findNote(cfg.db, user.id, routeId(params));
  if (!row) throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  const note: Note = noteRowToNote(row);
  return { data: note };
});

/** #16 — partial update of title/body/pinned; absent/foreign affects 0 rows is 404 (FR-NOTE-006/007). */
notesRoutes.patch(`${api.notes}/:id`, async ({ request, body, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const parsed = updateNoteSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const input = parsed.data;
  const patch: { title?: string; body?: string; pinned?: boolean } = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
  };
  if (Object.keys(patch).length === 0) throw new ApiError('VALIDATION_FAILED', copy.error.form);

  const row = await updateNote(cfg.db, user.id, routeId(params), patch, new Date(Date.now()).toISOString());
  if (!row) throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  const note: Note = noteRowToNote(row);
  return { data: note };
});

/** #17 — hard delete; repeat or foreign is 404 (FR-NOTE-009). */
notesRoutes.delete(`${api.notes}/:id`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const deleted = await deleteNote(cfg.db, user.id, routeId(params));
  if (!deleted) throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  set.status = 204;
});
