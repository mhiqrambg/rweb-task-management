import { api, type Attachment, type AttachmentSummary, type Mime } from '@taskapp/contracts';
import { newUuid } from '../../lib/ids';
import { extensionFor } from '../../lib/images';

/**
 * Attachment rows and the storage keys that back them (`.planning/05` §3.5, `.planning/06` §3.4,
 * §8). Explicit SQL only (ADR-03); the owner predicate is inside every statement (07 §3.1).
 *
 * The row is the commit point (06 §8.5): binaries are written to R2 before the row is inserted, and
 * deleted when the insert fails. A crash between the two leaves an unreachable object, which the
 * maintenance sweep collects.
 */

export interface AttachmentRow {
  id: string;
  user_id: string;
  task_id: string | null;
  note_id: string | null;
  storage_key: string;
  thumb_key: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

const COLUMNS =
  'id, user_id, task_id, note_id, storage_key, thumb_key, mime, size_bytes, width, height, created_at';

/**
 * 07 §1.2 B5: keys are `<user_id>/<attachment_id>.<ext>` and the `<user_id>/` prefix is asserted
 * before every write. Nothing in the system builds a key from a client-supplied name.
 */
export function storageKeyFor(userId: string, attachmentId: string, mime: Mime): string {
  return `${userId}/${attachmentId}.${extensionFor(mime)}`;
}

/** Thumbnails are a separate key even when the bytes match, so a variant can be cached separately. */
export function thumbKeyFor(userId: string, attachmentId: string): string {
  return `${userId}/${attachmentId}.thumb.webp`;
}

function toMime(value: string): Mime {
  if (value === 'image/jpeg' || value === 'image/png' || value === 'image/webp') return value;
  throw new Error(`defect: attachments.mime holds ${JSON.stringify(value)}`);
}

/** §3.4 list shape: URLs, never storage keys. `userId` is the caller's own session id. */
function toSummary(row: AttachmentRow): AttachmentSummary {
  return {
    id: row.id,
    mime: toMime(row.mime),
    width: row.width,
    height: row.height,
    thumbUrl: api.attachmentContent(row.id, 'thumb'),
    fullUrl: api.attachmentContent(row.id, 'full'),
  };
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    ...toSummary(row),
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export async function findAttachment(
  db: D1Database,
  userId: string,
  id: string,
): Promise<AttachmentRow | null> {
  return db
    .prepare(`SELECT ${COLUMNS} FROM attachments WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .first<AttachmentRow>();
}

export async function insertAttachment(
  db: D1Database,
  attachment: {
    userId: string;
    taskId: string | null;
    noteId: string | null;
    storageKey: string;
    thumbKey: string;
    mime: Mime;
    sizeBytes: number;
    width: number;
    height: number;
    now: string;
  },
): Promise<AttachmentRow> {
  const row: AttachmentRow = {
    id: newUuid(),
    user_id: attachment.userId,
    task_id: attachment.taskId,
    note_id: attachment.noteId,
    storage_key: attachment.storageKey,
    thumb_key: attachment.thumbKey,
    mime: attachment.mime,
    size_bytes: attachment.sizeBytes,
    width: attachment.width,
    height: attachment.height,
    created_at: attachment.now,
  };
  await db
    .prepare(
      `INSERT INTO attachments
         (id, user_id, task_id, note_id, storage_key, thumb_key, mime, size_bytes, width, height, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.task_id,
      row.note_id,
      row.storage_key,
      row.thumb_key,
      row.mime,
      row.size_bytes,
      row.width,
      row.height,
      row.created_at,
    )
    .run();
  return row;
}

export async function deleteAttachmentRow(
  db: D1Database,
  userId: string,
  id: string,
): Promise<AttachmentRow | null> {
  return db
    .prepare(`DELETE FROM attachments WHERE id = ?1 AND user_id = ?2 RETURNING ${COLUMNS}`)
    .bind(id, userId)
    .first<AttachmentRow>();
}

/** Every key belonging to one target, so a target delete can sweep its objects after the cascade. */
export async function attachmentKeysForTarget(
  db: D1Database,
  userId: string,
  target: { taskId: string | null; noteId: string | null },
): Promise<Array<{ storage_key: string; thumb_key: string }>> {
  if (target.taskId) {
    const rows = await db
      .prepare(
        `SELECT storage_key, thumb_key FROM attachments
          WHERE task_id = ?1 AND user_id = ?2`,
      )
      .bind(target.taskId, userId)
      .all<{ storage_key: string; thumb_key: string }>();
    return rows.results ?? [];
  }
  if (target.noteId) {
    const rows = await db
      .prepare(
        `SELECT storage_key, thumb_key FROM attachments
          WHERE note_id = ?1 AND user_id = ?2`,
      )
      .bind(target.noteId, userId)
      .all<{ storage_key: string; thumb_key: string }>();
    return rows.results ?? [];
  }
  return [];
}

export async function attachmentKeysForUser(
  db: D1Database,
  userId: string,
): Promise<Array<{ storage_key: string; thumb_key: string }>> {
  const rows = await db
    .prepare(`SELECT storage_key, thumb_key FROM attachments WHERE user_id = ?1`)
    .bind(userId)
    .all<{ storage_key: string; thumb_key: string }>();
  return rows.results ?? [];
}

/**
 * §8.6 stable order (`created_at ASC, id ASC`) for the detail screens, and the first three plus an
 * exact count for list rows.
 */
export async function attachmentsForTask(db: D1Database, userId: string, taskId: string) {
  const rows = await db
    .prepare(
      `SELECT ${COLUMNS} FROM attachments
        WHERE task_id = ?1 AND user_id = ?2
        ORDER BY created_at ASC, id ASC`,
    )
    .bind(taskId, userId)
    .all<AttachmentRow>();
  const all = rows.results ?? [];
  return { all: all.map(toAttachment), summaries: all.map(toSummary) };
}

export async function attachmentsForNote(db: D1Database, userId: string, noteId: string) {
  const rows = await db
    .prepare(
      `SELECT ${COLUMNS} FROM attachments
        WHERE note_id = ?1 AND user_id = ?2
        ORDER BY created_at ASC, id ASC`,
    )
    .bind(noteId, userId)
    .all<AttachmentRow>();
  const all = rows.results ?? [];
  return { all: all.map(toAttachment), summaries: all.map(toSummary) };
}

/**
 * One statement per target set: summaries for the rows on a page, plus the count. The count and the
 * first three must come from the same snapshot, so a single query returns both.
 */
export async function attachmentSummariesForTargets(
  db: D1Database,
  userId: string,
  targetIds: string[],
): Promise<Map<string, { summaries: AttachmentSummary[]; count: number }>> {
  const result = new Map<string, { summaries: AttachmentSummary[]; count: number }>();
  if (targetIds.length === 0) return result;

  const taskRows = await db
    .prepare(
      `SELECT ${COLUMNS} FROM attachments
        WHERE task_id IN (${targetIds.map((_, index) => `?${index + 2}`).join(', ')}) AND user_id = ?1
        ORDER BY task_id ASC, created_at ASC, id ASC`,
    )
    .bind(userId, ...targetIds)
    .all<AttachmentRow>();
  const noteRows = await db
    .prepare(
      `SELECT ${COLUMNS} FROM attachments
        WHERE note_id IN (${targetIds.map((_, index) => `?${index + 2}`).join(', ')}) AND user_id = ?1
        ORDER BY note_id ASC, created_at ASC, id ASC`,
    )
    .bind(userId, ...targetIds)
    .all<AttachmentRow>();

  const collect = (rows: AttachmentRow[], key: 'task_id' | 'note_id'): void => {
    for (const row of rows) {
      const id = row[key];
      if (id === null) continue;
      const entry = result.get(id) ?? { summaries: [], count: 0 };
      entry.count += 1;
      if (entry.summaries.length < 3) entry.summaries.push(toSummary(row));
      result.set(id, entry);
    }
  };
  collect(taskRows.results ?? [], 'task_id');
  collect(noteRows.results ?? [], 'note_id');
  return result;
}

/** The count guard of 06 §8.5 step 5, read inside the same statement as the target. */
export async function countAttachmentsForTarget(
  db: D1Database,
  userId: string,
  target: { taskId: string | null; noteId: string | null },
): Promise<number> {
  if (target.taskId) {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM attachments WHERE task_id = ?1 AND user_id = ?2`,
      )
      .bind(target.taskId, userId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }
  if (target.noteId) {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM attachments WHERE note_id = ?1 AND user_id = ?2`,
      )
      .bind(target.noteId, userId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }
  return 0;
}

export { toAttachment as attachmentRowToAttachment, toSummary as attachmentRowToSummary };