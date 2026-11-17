import {
  api,
  copy,
  emailField,
  passwordField,
  validationDetails,
  validationMessage,
  type User,
} from '@taskapp/contracts';
import { Elysia, type HTTPHeaders } from 'elysia';
import type { ZodError } from 'zod';
import { z } from 'zod';
import { getConfig } from '../../context';
import type { Config } from '../../config';
import { ApiError } from '../../lib/errors';
import { parseJsonBody } from '../../lib/http';
import { newUuid } from '../../lib/ids';
import { consumeRateLimit, rateLimitError } from '../../lib/rate-limit';
import { isoFrom } from '../../lib/time';
import { hashPassword } from '../auth/password';
import { deleteSessionsForUser } from '../auth/repo';
import { resolveSession } from '../auth/session';
import { attachmentKeysForUser } from '../attachments/repo';
import {
  deleteMember,
  findMember,
  insertMember,
  listMembers,
  parseMemberListQuery,
  updateMember,
} from './repo';

/**
 * #23-#26, the admin extension (D-12, `design/09-admin-console.md` §3).
 *
 * Three rules define this module:
 *
 * 1. A caller without `role = 'admin'` gets `404`, never `403` (06 §1.9). The route's existence is
 *    not disclosed, so a member session cannot probe for the admin surface.
 * 2. An admin cannot demote, disable or delete its own account: `409` (FR-ADMIN-007).
 * 3. This module reads `users` rows only. No task, note or attachment content is reachable here.
 */

export const adminRoutes = new Elysia();

const ADMIN_LIST_BUCKET = 'admin-members-read';
const ADMIN_WRITE_BUCKET = 'admin-members-write';
const ADMIN_READ_LIMIT = 60;
const ADMIN_WRITE_LIMIT = 20;
const ADMIN_WINDOW_SECONDS = 60;

const createMemberSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(100),
  email: emailField,
  temporaryPassword: passwordField,
  role: z.enum(['member', 'admin'], { message: copy.error.form }).default('member'),
  status: z.enum(['active', 'disabled'], { message: copy.error.form }).default('active'),
});

const updateMemberSchema = z
  .strictObject({
    displayName: z.string().trim().min(1).max(100).optional(),
    role: z.enum(['member', 'admin'], { message: copy.error.form }).optional(),
    status: z.enum(['active', 'disabled'], { message: copy.error.form }).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, copy.error.form);

function validationFailure(error: ZodError): ApiError {
  const details = validationDetails(error);
  return new ApiError('VALIDATION_FAILED', validationMessage(details), { details });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/u.test(error.message);
}

interface AdminContext {
  user: User;
  cookie: string | null;
}

/**
 * The gate. Order matters: no session is `401`, a member session is `404` with the same envelope a
 * non-existent admin route would produce (06 §1.9).
 */
async function requireAdmin(cfg: Config, request: Request): Promise<AdminContext> {
  const resolved = await resolveSession(cfg, request, 'refresh');
  if (!resolved.active) {
    throw new ApiError(
      'UNAUTHENTICATED',
      copy.auth.error.sessionExpired,
      resolved.cookie ? { headers: { 'Set-Cookie': resolved.cookie } } : {},
    );
  }
  if (resolved.active.role !== 'admin') {
    throw new ApiError('NOT_FOUND', copy.state.notFound.body);
  }
  return { user: resolved.active.user, cookie: resolved.cookie };
}

async function enforceReadLimit(db: D1Database, userId: string): Promise<void> {
  const outcome = await consumeRateLimit(db, ADMIN_LIST_BUCKET, userId, ADMIN_READ_LIMIT, ADMIN_WINDOW_SECONDS);
  if (!outcome.allowed) throw rateLimitError(outcome.window);
}

async function enforceWriteLimit(db: D1Database, userId: string): Promise<void> {
  const outcome = await consumeRateLimit(db, ADMIN_WRITE_BUCKET, userId, ADMIN_WRITE_LIMIT, ADMIN_WINDOW_SECONDS);
  if (!outcome.allowed) throw rateLimitError(outcome.window);
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

/** #23 — a cursor page of `users` rows, plus the total for the console's summary line. */
adminRoutes.get(`${api.admin.members}`, async ({ request, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await requireAdmin(cfg, request);
  await enforceReadLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const params = new URL(request.url).searchParams;
  const parsed = parseMemberListQuery(params);
  if (!parsed.ok) {
    throw new ApiError('VALIDATION_FAILED', copy.error.form, {
      details: [
        { field: parsed.failure.field, code: parsed.failure.code, message: parsed.failure.message },
      ],
    });
  }

  const page = await listMembers(cfg.db, parsed.query);
  return {
    data: { items: page.items, nextCursor: page.nextCursor, total: page.total },
  };
});

/** #24 — create a member with a temporary password that is never echoed back. */
adminRoutes.post(api.admin.members, async ({ request, body, set }) => {
  const cfg = getConfig();
  const { user, cookie } = await requireAdmin(cfg, request);
  await enforceWriteLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const parsed = createMemberSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const now = isoFrom(Date.now());
  const member = {
    id: newUuid(),
    email: parsed.data.email,
    display_name: parsed.data.displayName,
    password_hash: await hashPassword(parsed.data.temporaryPassword),
    role: parsed.data.role,
    status: parsed.data.status,
    created_at: now,
    updated_at: now,
  };

  try {
    await insertMember(cfg.db, member);
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError('CONFLICT', copy.auth.error.emailTaken);
    throw error;
  }

  set.status = 201;
  set.headers.Location = `${api.admin.members}/${member.id}`;
  // The temporary password exists only in the create request; nothing reads it back.
  return { data: memberResponse(member) };
});

/** #25 — edit a member. Email is immutable, so it is absent from the schema. */
adminRoutes.patch(`${api.admin.members}/:id`, async ({ request, body, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await requireAdmin(cfg, request);
  await enforceWriteLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const id = routeId(params);
  const parsed = updateMemberSchema.safeParse(
    parseJsonBody(
      typeof body === 'string' ? body : '',
      request.headers.get('content-type'),
      request.headers.get('content-length'),
    ),
  );
  if (!parsed.success) throw validationFailure(parsed.error);

  const existing = await findMember(cfg.db, id);
  if (!existing) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  // FR-ADMIN-007: the self-lockout guard. A demotion or a disable of the caller's own account is
  // refused with 409, so the last admin can never remove their own access.
  const targetIsSelf = existing.id === user.id;
  const demotes = parsed.data.role !== undefined && parsed.data.role !== existing.role;
  const disables = parsed.data.status === 'disabled' && existing.status !== 'disabled';
  if (targetIsSelf && (demotes || disables)) {
    throw new ApiError('CONFLICT', copy.error.form);
  }

  const disabling = parsed.data.status === 'disabled' && existing.status !== 'disabled';
  const updated = await updateMember(cfg.db, id, {
    ...(parsed.data.displayName === undefined ? {} : { displayName: parsed.data.displayName }),
    ...(parsed.data.role === undefined ? {} : { role: parsed.data.role }),
    ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
    now: isoFrom(Date.now()),
  });
  if (!updated) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  // FR-ADMIN-004: disabling takes effect immediately, so every outstanding session goes with it.
  if (disabling) await deleteSessionsForUser(cfg.db, id);

  return { data: memberResponse(updated) };
});

/** #26 — delete a member and their workspace, then the R2 objects that backed it. */
adminRoutes.delete(`${api.admin.members}/:id`, async ({ request, set, params }) => {
  const cfg = getConfig();
  const { user, cookie } = await requireAdmin(cfg, request);
  await enforceWriteLimit(cfg.db, user.id);
  withSessionCookie(set, cookie);

  const id = routeId(params);
  const existing = await findMember(cfg.db, id);
  if (!existing) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  // FR-ADMIN-007: an admin cannot delete its own account.
  if (existing.id === user.id) {
    throw new ApiError('CONFLICT', copy.error.form);
  }

  // Collect the keys before the cascade, because the rows that name them are about to disappear.
  const keys = await attachmentKeysForUser(cfg.db, id);
  const removed = await deleteMember(cfg.db, id);
  if (!removed) throw new ApiError('NOT_FOUND', copy.state.notFound.body);

  // 05 §1.2: the row cascade is authoritative; the objects are swept afterwards. A failure here
  // leaves an unreachable object that the maintenance cron collects.
  await Promise.all(
    keys.flatMap((entry) => [
      cfg.bucket.delete(entry.storage_key),
      cfg.bucket.delete(entry.thumb_key),
    ]),
  );

  set.status = 204;
});

/* ---------------------------------------------------------------- list query */

interface MemberItem {
  id: string;
  displayName: string;
  email: string;
  role: 'member' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
}

function memberResponse(row: {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}): MemberItem {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'member',
    status: row.status === 'disabled' ? 'disabled' : 'active',
    createdAt: row.created_at,
  };
}

export { memberResponse as adminMemberResponse };
export type { MemberItem as AdminMemberItem };