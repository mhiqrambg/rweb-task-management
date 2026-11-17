import {
  api,
  toApiNoteQuery,
  toApiTaskQuery,
  type Dashboard,
  type Note,
  type NoteListItem,
  type NoteListQuery,
  type PageMeta,
  type Task,
  type TaskListQuery,
  type TaskListItem,
} from '@taskapp/contracts';
import { request as apiRequest, toListResult, toResult } from './api';
import type { Result } from './types';

/**
 * The reads each screen needs, server-side only (R-A5: no client re-fetch of SSR data).
 *
 * Every function takes the browser's cookie and returns a `Result`, so a page can render the
 * loading/empty/error state the design asks for without knowing where the data came from.
 */

export async function getDashboard(cookie: string | null): Promise<Result<Dashboard>> {
  const raw = await apiRequest({ method: 'GET', path: api.dashboard, cookie });
  return toResult<Dashboard>(raw);
}

export async function getTasks(
  cookie: string | null,
  query: TaskListQuery,
): Promise<Result<{ items: TaskListItem[]; page: PageMeta }>> {
  const search = toApiTaskQuery(query).toString();
  const raw = await apiRequest({
    method: 'GET',
    path: search ? `${api.tasks}?${search}` : api.tasks,
    cookie,
  });
  return toListResult<TaskListItem>(raw);
}

export async function getTask(cookie: string | null, id: string): Promise<Result<Task>> {
  const raw = await apiRequest({ method: 'GET', path: api.task(id), cookie });
  return toResult<Task>(raw);
}

export async function getNotes(
  cookie: string | null,
  query: NoteListQuery,
): Promise<Result<{ items: NoteListItem[]; page: PageMeta }>> {
  const search = toApiNoteQuery(query).toString();
  const raw = await apiRequest({
    method: 'GET',
    path: search ? `${api.notes}?${search}` : api.notes,
    cookie,
  });
  return toListResult<NoteListItem>(raw);
}

export async function getNote(cookie: string | null, id: string): Promise<Result<Note>> {
  const raw = await apiRequest({ method: 'GET', path: api.note(id), cookie });
  return toResult<Note>(raw);
}

export type ListResult<T> = { items: T[]; page: PageMeta };
export type { Dashboard, Note, NoteListItem, Task, TaskListItem };

/** A failed read: the page shows `copy.state.error.*` and a retry, never a blank region. */
export type ReadFailure = Extract<Result<unknown>, { ok: false }>;