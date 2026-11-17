import {
  api,
  copy,
  fill,
  toCalendarDate,
  uploadTargetSchema,
  validationDetails,
  validationMessage,
  type Attachment,
  type Mime,
  type User,
} from '@taskapp/contracts';
import { Elysia, type HTTPHeaders } from 'elysia';
import type { ZodError } from 'zod';
import { getConfig } from '../../context';
import type { Config } from '../../config';
import { ApiError } from '../../lib/errors';
import {
  MAX_ATTACHMENTS_PER_TARGET,
  MAX_FILE_BYTES,
  inspectImage,
  safeBasename,
} from '../../lib/images';
import { consumeRateLimit, rateLimitError } from '../../lib/rate-limit';
import { resolveSession } from '../auth/session';
import { findNote } from '../notes/repo';
import { findTask } from '../tasks/repo';
import {
  attachmentRowToAttachment,
  attachmentSummariesForTargets,
  attachmentsForNote,
  attachmentsForTask,
  countAttachmentsForTarget,
  deleteAttachmentRow,
  findAttachment,
  insertAttachment,
  storageKeyFor,
  thumbKeyFor,
  type AttachmentRow,
} from './repo';

/**
 * #18-#21 (`.planning/06` §5.18-§5.21, §8). One file per request (D-8); the row is the commit
 * point, so binaries are written first and deleted if the insert fails (06 §8.5).
 */

export const attachmentsRoutes = new Elysia();

const ATTACHMENTS_BUCKET = 'attachments-user';
const ATTACHMENTS_LIMIT = 20;
const ATTACHMENTS_WINDOW_SECONDS = 60;

function validationFailure(error: ZodError): ApiError {
  const details = validationDetails(error);
  return new ApiError('VALIDATION_FAILED', validationMessage(details), { details });
}

async function enforceUserLimit(db: D1Database, userId: string): Promise<void> {
  const outcome = await consumeRateLimit(
    db,
    ATTACHMENTS_BUCKET,
    userId,
    ATTACHMENTS_LIMIT,
    ATTACHMENTS_WINDOW_SECONDS,
  );
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
  if (typeof params === 'object' && params !== null && 'id' in params) {
    const id: unknown = params.id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  throw new ApiError('NOT_FOUND', copy.state.notFound.body);
}

/**
 * Gate 0 of 07 §5.3: `Content-Length` against the per-file cap before the body is buffered. The
 * multipart envelope carries fields too, so the cap is the file limit plus a small allowance.
 */
const MULTIPART_OVERHEAD_BYTES = 8 * 1024;

function enforceContentLength(request: Request): void {
  const raw = request.headers.get('content-length');
  if (raw === null) return;
  const length = Number(raw);
  if (!Number.isFinite(length) || length <= 0) return;
  if (length > MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', copy.upload.reject.sizeShort);
  }
}

/** One `details[]` entry naming the file, as 06 §8.4 requires. */
function rejection(
  code: 'mime_not_allowed' | 'undecodable_image' | 'payload_too_large' | 'attachment_limit',
  message: string,
  filename: string,
): ApiError {
  return new ApiError('VALIDATION_FAILED', message, {
    details: [{ field: 'file', code, message, file: safeBasename(filename) }],
  });
}

/**
 * The file-naming rejection copy. `copy.upload.reject.type` deliberately carries no `{filename}`
 * placeholder — it is the form-level "not an image" sentence — so a rejection that names the file
 * fills one that does. The file is always named in `details[].file` (06 §8.4) regardless.
 */
function typeRejection(filename: string): string {
  return fill(copy.upload.reject.type, { filename: safeBasename(filename) });
}

/** The owner predicate of 06 §8.5 step 1, inside one statement (07 §3.1). */
async function ownedTarget(
  cfg: Config,
  userId: string,
  targetType: 'task' | 'note',
  targetId: string,
): Promise<{ taskId: string | null; noteId: string | null }> {
  if (targetType === 'task') {
    const row = await findTask(cfg.db, userId, targetId);
    return row ? { taskId: row.id, noteId: null } : notFoundTarget();
  }
  const row = await findNote(cfg.db, userId, targetId);
  return row ? { taskId: null, noteId: row.id } : notFoundTarget();
}

function notFoundTarget(): never {
  throw new ApiError('NOT_FOUND', copy.state.notFound.body);
}

/** #18 — attach one image to an owned task or note. */
attachmentsRoutes.post(api.attachments, async ({ request, body, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  enforceContentLength(request);
  withSessionCookie(set, cookie);

  const form = await parseMultipart(request, body);
  const parsedTarget = uploadTargetSchema.safeParse({
    targetType: form.targetType,
    targetId: form.targetId,
  });
  if (!parsedTarget.success) throw validationFailure(parsedTarget.error);

  const file = form.file;
  if (!file) {
    throw new ApiError('VALIDATION_FAILED', copy.upload.reject.type, {
      details: [{ field: 'file', code: 'required', message: copy.upload.reject.type }],
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectImage(bytes);
  if (!inspected.ok) {
    // `copy.upload.reject.type` is the form-level sentence; when the file is known, name it.
    const message = typeRejection(file.name);
    if (inspected.reason === 'unsupported') {
      throw new ApiError('UNSUPPORTED_MEDIA_TYPE', message, {
        details: [
          {
            field: 'file',
            code: 'mime_not_allowed',
            message,
            file: safeBasename(file.name),
          },
        ],
      });
    }
    if (inspected.reason === 'too_large') {
      throw rejection('payload_too_large', copy.upload.reject.size, file.name);
    }
    // `undecodable` and `empty`: the bytes claim to be an image but no frame header parses.
    throw rejection('undecodable_image', message, file.name);
  }

  const target = await ownedTarget(cfg, user.id, parsedTarget.data.targetType, parsedTarget.data.targetId);

  const existing = await countAttachmentsForTarget(cfg.db, user.id, target);
  if (existing >= MAX_ATTACHMENTS_PER_TARGET) {
    throw rejection(
      'attachment_limit',
      copy.upload.reject.count.replace('{target}', parsedTarget.data.targetType),
      file.name,
    );
  }

  const now = new Date(Date.now()).toISOString();
  const id = crypto.randomUUID();
  const storageKey = storageKeyFor(user.id, id, inspected.mime as Mime);
  const thumbKey = thumbKeyFor(user.id, id);

  // 06 §8.5 step 3-4: both objects exist before the row does, so a failed insert can clean up.
  await cfg.bucket.put(storageKey, bytes, {
    httpMetadata: { contentType: inspected.mime, cacheControl: 'private, max-age=86400' },
  });
  try {
    // D-15: no re-encode is possible on this runtime, so the thumb object is the same bytes under a
    // distinct key. The row still records a separate thumb key, so a future codec needs no migration.
    await cfg.bucket.put(thumbKey, bytes, {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'private, max-age=86400' },
    });
  } catch {
    await cfg.bucket.delete(storageKey);
    throw new ApiError('INTERNAL', copy.state.error.body);
  }

  const row = await insertAttachment(cfg.db, {
    userId: user.id,
    taskId: target.taskId,
    noteId: target.noteId,
    storageKey,
    thumbKey,
    mime: inspected.mime,
    sizeBytes: bytes.byteLength,
    width: inspected.width,
    height: inspected.height,
    now,
  }).catch(async (error: unknown) => {
    await Promise.all([
      cfg.bucket.delete(storageKey),
      cfg.bucket.delete(thumbKey),
    ]);
    throw error;
  });

  // A create moves the parent's `updated_at` only through its own endpoint; the attachment set is
  // what changed here, so the list order stays the parent's business (FR-ATT-012).

  set.status = 201;
  set.headers.Location = api.attachment(row.id);
  const attachment: Attachment = attachmentRowToAttachment(row);
  return { data: attachment };
});

/**
 * #19 — attachment metadata for a lightbox that must not re-read the parent. Owner-scoped lookup
 * before anything else, so a foreign id is a plain 404 (FR-ATT-008).
 */
attachmentsRoutes.get(`${api.attachments}/:id`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const row = await findAttachment(cfg.db, user.id, routeId(params));
  if (!row) throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  return { data: attachmentRowToAttachment(row) };
});

/**
 * #20 — the binary. The owner check runs before the object is opened, so an absent, foreign or
 * expired id are all the same 404 with zero bytes (06 §8.7, NFR-SEC-005).
 */
attachmentsRoutes.get(`${api.attachments}/:id/content`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const id = routeId(params);
  const row = await findAttachment(cfg.db, user.id, id);
  if (!row) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  const variant = new URL(request.url).searchParams.get('variant');
  const useThumb = variant === 'thumb';
  const key = useThumb ? row.thumb_key || row.storage_key : row.storage_key;

  const object = await cfg.bucket.get(key);
  // The row exists but the object does not: indistinguishable from an absent attachment.
  if (!object) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  const etag = object.httpEtag;
  const headers: Record<string, string> = {
    'Content-Type': useThumb ? 'image/webp' : row.mime,
    'Content-Length': String(object.size),
    'Cache-Control': 'private, max-age=86400',
    'Content-Disposition': 'inline',
    ETag: etag,
  };

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch === etag) {
    set.status = 304;
    for (const [name, value] of Object.entries(headers)) {
      if (name === 'Content-Length' || name === 'Content-Type') continue;
      set.headers[name] = value;
    }
    return new Response(null, { status: 304 });
  }

  return new Response(object.body, { status: 200, headers });
});

/** #21 — remove: the row goes first, then both objects, so a crash cannot orphan a live row. */
attachmentsRoutes.delete(`${api.attachments}/:id`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await sessionUser(cfg, request);
  await enforceUserLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const row = await deleteAttachmentRow(cfg.db, user.id, routeId(params));
  if (!row) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  await Promise.all([
    cfg.bucket.delete(row.storage_key),
    row.thumb_key ? cfg.bucket.delete(row.thumb_key) : Promise.resolve(),
  ]);
  set.status = 204;
});

/* ---------------------------------------------------------------- multipart */

interface MultipartForm {
  file: UploadFile | null;
  targetType: string | null;
  targetId: string | null;
}

/**
 * The upload form: one file part plus the two target fields (06 §8.1).
 *
 * Elysia reads the body once, before the handler runs, so `request.formData()` would throw "Body
 * has already been used". The app's `onParse` hook therefore returns the raw **bytes** for a
 * multipart request, and this parses those bytes against the boundary from the original
 * `Content-Type`. Nothing is read twice and no byte is re-encoded.
 */
async function parseMultipart(request: Request, raw: unknown): Promise<MultipartForm> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', copy.upload.reject.type);
  }
  // Elysia hands the parsed body back as-is: an ArrayBuffer in this runtime, a Uint8Array in
  // another. Both are the exact bytes read from the request.
  const bytes =
    raw instanceof Uint8Array
      ? raw
      : raw instanceof ArrayBuffer
        ? new Uint8Array(raw)
        : null;
  if (bytes === null || bytes.byteLength === 0) {
    throw new ApiError('VALIDATION_FAILED', copy.upload.reject.type);
  }

  const restored = new Request('https://api.internal/', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: bytes,
  });

  let form: FormData;
  try {
    form = await restored.formData();
  } catch {
    throw new ApiError('VALIDATION_FAILED', copy.upload.reject.type);
  }

  const file = form.get('file');
  const targetType = form.get('targetType');
  const targetId = form.get('targetId');

  return {
    file: await toUploadFile(file),
    targetType: typeof targetType === 'string' ? targetType : null,
    targetId: typeof targetId === 'string' ? targetId : null,
  };
}

interface UploadFile {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Narrows one multipart entry to a file part, or null when it is a field or empty. */
async function toUploadFile(entry: File | string | null): Promise<UploadFile | null> {
  if (entry === null || typeof entry === 'string') return null;
  if (!(entry instanceof Blob) || entry.size === 0) return null;

  const name =
    typeof (entry as File).name === 'string' && (entry as File).name.length > 0
      ? (entry as File).name
      : 'file';

  return {
    name,
    size: entry.size,
    type: entry.type,
    arrayBuffer: () => entry.arrayBuffer(),
  };
}

/* ---------------------------------------------------------------- shared readers */

/**
 * Task and note list rows carry their first three attachment summaries plus an exact count
 * (FR-TASK-017, FR-NOTE-004). One query per target set, never per row.
 */
export async function hydrateAttachments(
  db: D1Database,
  userId: string,
  targetIds: string[],
): Promise<Map<string, { summaries: Attachment[]; count: number }>> {
  const raw = await attachmentSummariesForTargets(db, userId, targetIds);
  const hydrated = new Map<string, { summaries: Attachment[]; count: number }>();
  for (const [id, entry] of raw) {
    hydrated.set(id, { summaries: entry.summaries as Attachment[], count: entry.count });
  }
  return hydrated;
}

/** The full set plus the summaries for one task, for the detail screen and the edit form. */
export async function taskAttachmentSets(db: D1Database, userId: string, taskId: string) {
  return attachmentsForTask(db, userId, taskId);
}

export async function noteAttachmentSets(db: D1Database, userId: string, noteId: string) {
  return attachmentsForNote(db, userId, noteId);
}

export type { AttachmentRow };
export { toCalendarDate };