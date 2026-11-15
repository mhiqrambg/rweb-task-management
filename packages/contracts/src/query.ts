import { NOTE_QUERY_KEYS, TASK_QUERY_KEYS } from './routes';
import { toCalendarDate } from './format';
import type {
  DueFilter,
  NoteListQuery,
  NoteSort,
  TaskListQuery,
  TaskPriority,
  TaskSort,
  TaskStatus,
} from './types/index';

/**
 * List URL state, shared by both frontends: the screen keeps filters, sort and cursor in the URL
 * so a copied link reloads the same view (FR-TASK-014, FR-NOTE-003, design/05 §5).
 *
 * The screen grammar (q, status, priority, due, hasImages, sort, limit, cursor) is the documented
 * one from DESIGN.md §7; the API grammar (q, status, priority, dueState, dueFrom, dueTo,
 * hasAttachments, sort, limit, cursor) lives in 06 §6.6. `toApi*Query` is the only translation.
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

const STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'completed'];
const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];
const TASK_SORTS: readonly TaskSort[] = ['updated', 'created', 'due', 'priority'];
const NOTE_SORTS: readonly NoteSort[] = ['updated', 'created', 'pinned'];
const DUES: readonly DueFilter[] = ['', 'overdue', 'today', 'next7', 'none'];

export const TASK_SORT_OPTIONS: readonly TaskSort[] = TASK_SORTS;
export const NOTE_SORT_OPTIONS: readonly NoteSort[] = NOTE_SORTS;
export const DUE_OPTIONS: readonly DueFilter[] = DUES;

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function clampLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

export function parseTaskListQuery(params: URLSearchParams): TaskListQuery {
  const q = (params.get('q') ?? '').trim().slice(0, 200);
  return {
    q,
    status: pick(params.get('status'), STATUSES, '' as TaskStatus | ''),
    priority: pick(params.get('priority'), PRIORITIES, '' as TaskPriority | ''),
    due: pick(params.get('due'), DUES, ''),
    hasImages: params.get('hasImages') === '1',
    sort: pick(params.get('sort'), TASK_SORTS, 'updated'),
    limit: clampLimit(params.get('limit')),
    cursor: params.get('cursor'),
  };
}

export function parseNoteListQuery(params: URLSearchParams): NoteListQuery {
  return {
    q: (params.get('q') ?? '').trim().slice(0, 200),
    pinned: params.get('pinned') === '1' ? true : null,
    sort: pick(params.get('sort'), NOTE_SORTS, 'updated'),
    limit: clampLimit(params.get('limit')),
    cursor: params.get('cursor'),
  };
}

/** URL for a task list state. Key order is fixed, defaults are omitted, empty values never appear. */
export function taskListHref(query: TaskListQuery, base = '/tasks'): string {
  const values: Array<[string, string]> = [...TASK_QUERY_KEYS].map((key) => [key, '']);
  const byKey = new Map(values);

  if (query.q) byKey.set('q', query.q);
  if (query.status) byKey.set('status', query.status);
  if (query.priority) byKey.set('priority', query.priority);
  if (query.due) byKey.set('due', query.due);
  if (query.hasImages) byKey.set('hasImages', '1');
  if (query.sort !== 'updated') byKey.set('sort', query.sort);
  if (query.limit !== DEFAULT_LIMIT) byKey.set('limit', String(query.limit));
  if (query.cursor) byKey.set('cursor', query.cursor);

  const search = new URLSearchParams(
    [...byKey].filter(([, value]) => value !== '') as Array<[string, string]>,
  ).toString();
  return search ? `${base}?${search}` : base;
}

export function noteListHref(query: NoteListQuery, base = '/notes'): string {
  const byKey = new Map<string, string>([...NOTE_QUERY_KEYS].map((key) => [key, '']));

  if (query.q) byKey.set('q', query.q);
  if (query.pinned) byKey.set('pinned', '1');
  if (query.sort !== 'updated') byKey.set('sort', query.sort);
  if (query.limit !== DEFAULT_LIMIT) byKey.set('limit', String(query.limit));
  if (query.cursor) byKey.set('cursor', query.cursor);

  const search = new URLSearchParams(
    [...byKey].filter(([, value]) => value !== '') as Array<[string, string]>,
  ).toString();
  return search ? `${base}?${search}` : base;
}

export function hasTaskFilters(query: TaskListQuery): boolean {
  return Boolean(query.q || query.status || query.priority || query.due || query.hasImages);
}

/** Query for `GET /api/v1/tasks` (06 §6.6). `next7` is today .. today + 6. */
export function toApiTaskQuery(query: TaskListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  if (query.due === 'overdue' || query.due === 'today' || query.due === 'none') {
    params.set('dueState', query.due);
  }
  if (query.due === 'next7') {
    const from = new Date();
    const to = new Date(from.getTime() + 6 * 24 * 60 * 60 * 1000);
    params.set('dueState', 'range');
    params.set('dueFrom', toCalendarDate(from));
    params.set('dueTo', toCalendarDate(to));
  }
  if (query.hasImages) params.set('hasAttachments', 'true');
  params.set('sort', taskSortToApi(query.sort));
  params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  return params;
}

export function toApiNoteQuery(query: NoteListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.pinned) params.set('pinned', 'true');
  const sort = noteSortToApi(query.sort);
  if (sort) params.set('sort', sort);
  params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  return params;
}

function taskSortToApi(sort: TaskSort): string {
  switch (sort) {
    case 'created':
      return '-created_at';
    case 'due':
      return 'due_date';
    case 'priority':
      return '-priority';
    case 'updated':
      return '-updated_at';
  }
}

/** `updated` keeps the endpoint default (pinned first, then updated) by sending no sort at all. */
function noteSortToApi(sort: NoteSort): string | null {
  switch (sort) {
    case 'created':
      return '-created_at';
    case 'pinned':
      return '-pinned,-updated_at';
    case 'updated':
      return null;
  }
}
