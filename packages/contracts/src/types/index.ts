/**
 * Wire types, verbatim from .planning/06-api-contracts.md §3.
 * These are shapes only: no behaviour, no framework (ADR-09).
 */

export type UUID = string;
export type ISODateTime = string;
export type CalendarDate = string;

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type Mime = 'image/jpeg' | 'image/png' | 'image/webp';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface User {
  id: UUID;
  email: string;
  displayName: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Response of #1, #2 and #4. */
export interface SessionProbe {
  user: User;
  expiresAt: ISODateTime;
}

export interface AttachmentSummary {
  id: UUID;
  mime: Mime;
  width: number | null;
  height: number | null;
  thumbUrl: string;
  fullUrl: string;
}

export interface Attachment extends AttachmentSummary {
  sizeBytes: number;
  createdAt: ISODateTime;
}

export interface Task {
  id: UUID;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: CalendarDate | null;
  isOverdue: boolean;
  attachments: Attachment[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TaskListItem {
  id: UUID;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: CalendarDate | null;
  isOverdue: boolean;
  attachments: AttachmentSummary[];
  attachmentCount: number;
  updatedAt: ISODateTime;
}

export interface Note {
  id: UUID;
  title: string;
  body: string;
  pinned: boolean;
  attachments: Attachment[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface NoteListItem {
  id: UUID;
  title: string;
  excerpt: string;
  pinned: boolean;
  attachments: AttachmentSummary[];
  attachmentCount: number;
  updatedAt: ISODateTime;
}

export interface Dashboard {
  tasks: { total: number; active: number; completed: number; overdue: number };
  byStatus: { todo: number; in_progress: number; completed: number };
  byPriority: { low: number; medium: number; high: number };
  recentTasks: TaskListItem[];
  recentNotes: NoteListItem[];
}

export interface PageMeta {
  limit: number;
  nextCursor: string | null;
}

export interface ValidationDetail {
  field: string;
  code: string;
  message: string;
  file?: string;
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details: ValidationDetail[];
  };
}

export interface ItemResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  page: PageMeta;
}

export type HealthResponse = ItemResponse<{
  status: 'ok' | 'degraded';
  db: 'ok' | 'down';
  storage: 'ok' | 'down';
}>;

/** Filters accepted by the task list screen, in the URL key order of DESIGN.md §7. */
export interface TaskListQuery {
  q: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  due: DueFilter;
  hasImages: boolean;
  sort: TaskSort;
  limit: number;
  cursor: string | null;
}

export interface NoteListQuery {
  q: string;
  pinned: boolean | null;
  sort: NoteSort;
  limit: number;
  cursor: string | null;
}

export type DueFilter = '' | 'overdue' | 'today' | 'next7' | 'none';
export type TaskSort = 'updated' | 'created' | 'due' | 'priority';
export type NoteSort = 'updated' | 'created' | 'pinned';
