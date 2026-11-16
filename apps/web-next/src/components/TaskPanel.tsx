'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  copy,
  createTaskSchema,
  fill,
  formatDate,
  formatRelative,
  hasTaskFilters,
  parseTaskListQuery,
  taskListHref,
  taskPriorityLabel,
  taskStatusLabel,
  toApiTaskQuery,
  updateTaskSchema,
  type ItemResponse,
  type ListResponse,
  type Task,
  type TaskListQuery,
  type TaskListItem,
  type TaskPriority,
  type TaskStatus,
} from '@taskapp/contracts';
import { requestJson } from '@/lib/api';
import { TaskFormDialog, TaskDeleteDialog, type TaskDraft } from './TaskDialogs';

const LIST_BASE = '/app/?view=tasks';

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : copy.state.error.body;
}

function isOverdue(task: TaskCardData): boolean {
  if (task.isOverdue !== undefined) return task.isOverdue;
  if (!task.dueDate) return false;
  return task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'completed';
}

export type TaskCardData = Pick<
  TaskListItem,
  'id' | 'title' | 'status' | 'priority' | 'dueDate'
> & { isOverdue?: boolean };

function TaskCard({ task, onOpen }: { task: TaskCardData; onOpen?: (id: string) => void }) {
  const overdue = isOverdue(task);
  return (
    <article className="card card--hoverable task-card" data-overdue={overdue || undefined}>
      <h3 className="task-card__title">
        <Link
          href={`${LIST_BASE}&id=${encodeURIComponent(task.id)}`}
          onClick={(event) => {
            if (!onOpen) return;
            event.preventDefault();
            onOpen(task.id);
          }}
        >
          {task.title}
        </Link>
      </h3>
      <div className="task-card__meta">
        <span className="badge" data-kind="status" data-value={task.status}>
          {taskStatusLabel(task.status)}
        </span>
        <span className="badge" data-kind="priority" data-value={task.priority}>
          {taskPriorityLabel(task.priority)}
        </span>
      </div>
      <p className="task-card__due">
        {overdue && task.dueDate
          ? `${copy.task.overdue} · ${formatDate(task.dueDate)}`
          : task.dueDate
            ? formatDate(task.dueDate)
            : null}
      </p>
    </article>
  );
}

/** Shared card grid markup: the task list and the component preview render the same cards. */
export function TaskCards({
  tasks,
  onOpen,
}: {
  tasks: TaskCardData[];
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="card-grid">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onOpen={onOpen} />
      ))}
    </div>
  );
}

type ListState = { key: string; items: TaskListItem[]; nextCursor: string | null };
type DetailState = { key: string; task: Task };
type KeyedMessage = { key: string; message: string };

function TaskListSkeleton() {
  return (
    <div className="card-grid">
      <span className="visually-hidden" role="status">
        {copy.task.list.loading}
      </span>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div className="skeleton skeleton--card" key={item} aria-hidden="true" />
      ))}
    </div>
  );
}

function TaskDetailSkeleton() {
  return (
    <div className="stack">
      <span className="visually-hidden" role="status">
        {copy.state.loading}
      </span>
      <div className="skeleton skeleton--text" aria-hidden="true" />
      <div className="skeleton skeleton--text" aria-hidden="true" />
      <div className="skeleton skeleton--text" aria-hidden="true" />
    </div>
  );
}

export function TaskPanel({ id, mode }: { id: string | null; mode: string | null }) {
  const router = useRouter();
  const search = useSearchParams();
  const urlParams = new URLSearchParams(search.toString());
  const query = parseTaskListQuery(urlParams);
  const [reload, setReload] = useState(0);
  const requestKey = JSON.stringify([
    id,
    query.q,
    query.status,
    query.priority,
    query.due,
    query.hasImages,
    query.sort,
    query.limit,
    reload,
  ]);

  const [list, setList] = useState<ListState | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [readError, setReadError] = useState<KeyedMessage | null>(null);
  const [moreError, setMoreError] = useState<KeyedMessage | null>(null);
  const [loadingMore, setLoadingMore] = useState<{ key: string; cursor: string } | null>(null);
  const [searchEdit, setSearchEdit] = useState<{ forQ: string; value: string } | null>(null);
  const [createFor, setCreateFor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);

  // The URL is the source of truth for q (back/forward included); the draft only outlives it while typing.
  const searchDraft = searchEdit?.forQ === query.q ? searchEdit.value : query.q;
  // A request-key mismatch means the view moved on, so its dialog is closed without an effect reset.
  const createOpen = createFor === requestKey;

  const items = list?.key === requestKey ? list.items : null;
  const nextCursor = list?.key === requestKey ? list.nextCursor : null;
  const task = detail?.key === requestKey ? detail.task : null;
  const errorMessage = readError?.key === requestKey ? readError.message : '';
  const paginationError = moreError?.key === requestKey ? moreError.message : '';
  const isLoadingMore = loadingMore?.key === requestKey;
  const hasFilters = hasTaskFilters(query);

  const replaceQuery = useCallback(
    (patch: Partial<TaskListQuery>) => {
      router.replace(
        taskListHref(
          {
            q: query.q,
            status: query.status,
            priority: query.priority,
            due: query.due,
            hasImages: query.hasImages,
            sort: query.sort,
            limit: query.limit,
            cursor: null,
            ...patch,
          },
          LIST_BASE,
        ),
      );
    },
    [router, query.q, query.status, query.priority, query.due, query.hasImages, query.sort, query.limit],
  );

  useEffect(() => {
    const trimmed = searchDraft.trim();
    if (trimmed === query.q) return;
    const timer = setTimeout(() => replaceQuery({ q: trimmed }), 300);
    return () => clearTimeout(timer);
  }, [searchDraft, query.q, replaceQuery]);

  const listPath = `${api.tasks}?${toApiTaskQuery(query).toString()}`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    if (id) {
      requestJson<ItemResponse<Task>>(api.task(id), { signal: controller.signal })
        .then((response) => {
          if (active) setDetail({ key: requestKey, task: response.data });
        })
        .catch((cause: unknown) => {
          if (active) setReadError({ key: requestKey, message: messageOf(cause) });
        });
    } else {
      requestJson<ListResponse<TaskListItem>>(listPath, { signal: controller.signal })
        .then((response) => {
          if (active) {
            setList({
              key: requestKey,
              items: response.data,
              nextCursor: response.page?.nextCursor ?? null,
            });
          }
        })
        .catch((cause: unknown) => {
          if (active) setReadError({ key: requestKey, message: messageOf(cause) });
        });
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, requestKey, listPath]);

  function clearFilters() {
    setSearchEdit(null);
    replaceQuery({ q: '', status: '', priority: '', due: '', hasImages: false });
  }

  async function create(draft: TaskDraft) {
    const parsed = createTaskSchema.safeParse({
      title: draft.title,
      description: draft.description,
      status: draft.status,
      priority: draft.priority,
      dueDate: draft.dueDate || undefined,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? copy.error.form);
    }
    try {
      await requestJson(api.tasks, { method: 'POST', body: JSON.stringify(parsed.data) });
      setCreateFor(null);
      setReload((value) => value + 1);
    } catch (cause) {
      throw new Error(messageOf(cause));
    }
  }

  async function saveEdit(draft: TaskDraft) {
    if (!id) return;
    const parsed = updateTaskSchema.safeParse({
      title: draft.title,
      description: draft.description,
      status: draft.status,
      priority: draft.priority,
      dueDate: draft.dueDate || null,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? copy.error.form);
    }
    try {
      await requestJson(api.task(id), { method: 'PATCH', body: JSON.stringify(parsed.data) });
      setReload((value) => value + 1);
      router.replace(`${LIST_BASE}&id=${encodeURIComponent(id)}`);
    } catch (cause) {
      throw new Error(messageOf(cause));
    }
  }

  async function remove() {
    if (!id) return;
    try {
      await requestJson(api.task(id), { method: 'DELETE' });
      setDeleteFor(null);
      router.replace(LIST_BASE);
    } catch (cause) {
      throw new Error(messageOf(cause));
    }
  }

  async function loadMore() {
    if (!nextCursor || isLoadingMore || !items) return;
    const cursor = nextCursor;
    setMoreError(null);
    setLoadingMore({ key: requestKey, cursor });
    try {
      const response = await requestJson<ListResponse<TaskListItem>>(
        `${api.tasks}?${toApiTaskQuery({ ...query, cursor }).toString()}`,
      );
      setList((previous) => {
        if (!previous || previous.key !== requestKey) return previous;
        const seen = new Set(previous.items.map((item) => item.id));
        const additional = response.data.filter((item) => !seen.has(item.id));
        return {
          key: requestKey,
          items: [...previous.items, ...additional],
          nextCursor: response.page?.nextCursor ?? null,
        };
      });
    } catch (cause) {
      setMoreError({ key: requestKey, message: messageOf(cause) });
    } finally {
      setLoadingMore((previous) =>
        previous?.key === requestKey && previous.cursor === cursor ? null : previous,
      );
    }
  }

  const listView = (
    <>
      <div className="page-head">
        <div className="page-head__row">
          <h1 className="page-head__title">{copy.task.title}</h1>
          <form
            className="search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              replaceQuery({ q: searchDraft.trim() });
            }}
          >
            <label className="visually-hidden" htmlFor="task-search">
              {copy.task.search.label}
            </label>
            <input
              id="task-search"
              className="field__input"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchEdit({ forQ: query.q, value: event.target.value })}
              placeholder={copy.task.search.label}
              maxLength={200}
            />
          </form>
          <button className="btn" data-variant="primary" type="button" onClick={() => setCreateFor(requestKey)}>
            {copy.task.new}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <label className="field toolbar__field">
          <span className="field__label">{copy.filter.status}</span>
          <select
            className="field__input"
            value={query.status}
            onChange={(event) => replaceQuery({ status: event.target.value as TaskStatus | '' })}
          >
            <option value="">{copy.filter.all}</option>
            <option value="todo">{taskStatusLabel('todo')}</option>
            <option value="in_progress">{taskStatusLabel('in_progress')}</option>
            <option value="completed">{taskStatusLabel('completed')}</option>
          </select>
        </label>
        <label className="field toolbar__field">
          <span className="field__label">{copy.filter.priority}</span>
          <select
            className="field__input"
            value={query.priority}
            onChange={(event) => replaceQuery({ priority: event.target.value as TaskPriority | '' })}
          >
            <option value="">{copy.filter.all}</option>
            <option value="low">{taskPriorityLabel('low')}</option>
            <option value="medium">{taskPriorityLabel('medium')}</option>
            <option value="high">{taskPriorityLabel('high')}</option>
          </select>
        </label>
        <label className="field toolbar__field">
          <span className="field__label">{copy.filter.due}</span>
          <select
            className="field__input"
            value={query.due}
            onChange={(event) => replaceQuery({ due: event.target.value as TaskListQuery['due'] })}
          >
            <option value="">{copy.filter.dueValue.any}</option>
            <option value="overdue">{copy.filter.dueValue.overdue}</option>
            <option value="today">{copy.filter.dueValue.today}</option>
            <option value="next7">{copy.filter.dueValue.next7}</option>
            <option value="none">{copy.filter.dueValue.none}</option>
          </select>
        </label>
        <button
          className="btn"
          data-variant="secondary"
          type="button"
          aria-pressed={query.hasImages}
          onClick={() => replaceQuery({ hasImages: !query.hasImages })}
        >
          {copy.filter.hasImages}
        </button>
        <button className="btn" data-variant="ghost" type="button" onClick={clearFilters}>
          {copy.filter.clear}
        </button>
        {hasFilters && <p className="toolbar__note">{copy.filter.applied}</p>}
      </div>

      {errorMessage ? (
        <div className="error-state" role="alert">
          <h2>{copy.state.error.title}</h2>
          <p className="error-state__body">{errorMessage}</p>
          <button
            className="btn"
            data-variant="secondary"
            type="button"
            onClick={() => setReload((value) => value + 1)}
          >
            {copy.action.retry}
          </button>
        </div>
      ) : items === null ? (
        <TaskListSkeleton />
      ) : items.length === 0 ? (
        hasFilters ? (
          <div className="empty-state">
            <h2>{copy.task.noResults.title}</h2>
            <p className="empty-state__body">{copy.task.noResults.body}</p>
            <button className="btn" data-variant="ghost" type="button" onClick={clearFilters}>
              {copy.task.noResults.clear}
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <h2>{copy.task.empty.title}</h2>
            <p className="empty-state__body">{copy.task.empty.body}</p>
            <button className="btn" data-variant="primary" type="button" onClick={() => setCreateFor(requestKey)}>
              {copy.task.new}
            </button>
          </div>
        )
      ) : (
        <>
          <TaskCards tasks={items} />
          {paginationError && (
            <p className="inline-error" role="alert">
              {paginationError}
            </p>
          )}
          {nextCursor && (
            <div className="pagination">
              <button
                className="btn"
                data-variant="secondary"
                type="button"
                disabled={isLoadingMore}
                aria-busy={isLoadingMore || undefined}
                onClick={() => void loadMore()}
              >
                {copy.pagination.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  const detailView = errorMessage ? (
    <div className="error-state" role="alert">
      <h2>{copy.state.error.title}</h2>
      <p className="error-state__body">{errorMessage}</p>
      <button
        className="btn"
        data-variant="secondary"
        type="button"
        onClick={() => setReload((value) => value + 1)}
      >
        {copy.action.retry}
      </button>
    </div>
  ) : !task ? (
    <TaskDetailSkeleton />
  ) : (
    <>
      <div className="detail-head">
        <h1 className="detail-head__title">{task.title}</h1>
        <div className="detail-head__actions">
          <button
            className="btn"
            data-variant="secondary"
            type="button"
            onClick={() =>
              router.replace(
                `${LIST_BASE}&id=${encodeURIComponent(task.id)}&mode=edit`,
              )
            }
          >
            {copy.action.edit}
          </button>
          <button
            className="btn"
            data-variant="danger"
            type="button"
            onClick={() => setDeleteFor(task.id)}
          >
            {copy.action.delete}
          </button>
        </div>
      </div>
      <div className="detail-meta">
        <span className="badge" data-kind="status" data-value={task.status}>
          {taskStatusLabel(task.status)}
        </span>
        <span className="badge" data-kind="priority" data-value={task.priority}>
          {taskPriorityLabel(task.priority)}
        </span>
        {task.dueDate ? (
          <span>{task.isOverdue ? `${copy.task.overdue} · ${formatDate(task.dueDate)}` : formatDate(task.dueDate)}</span>
        ) : null}
      </div>
      {task.description?.trim() ? <p className="detail-body">{task.description}</p> : null}
      <hr className="divider" />
      <p className="muted">
        {fill(copy.task.updatedAt, { relative: formatRelative(task.updatedAt) })}
      </p>
    </>
  );

  return (
    <section aria-label={copy.task.title}>
      {id ? detailView : listView}

      {createOpen && !id && (
        <TaskFormDialog kind="create" onSave={create} onClose={() => setCreateFor(null)} />
      )}

      {id && task && mode === 'edit' && (
        <TaskFormDialog
          key={task.id}
          kind="edit"
          initial={{
            title: task.title,
            description: task.description ?? '',
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ?? '',
          }}
          onSave={saveEdit}
          onClose={() => router.replace(`${LIST_BASE}&id=${encodeURIComponent(task.id)}`)}
        />
      )}

      {id && task && deleteFor === task.id && (
        <TaskDeleteDialog title={task.title} onConfirm={remove} onClose={() => setDeleteFor(null)} />
      )}
    </section>
  );
}
