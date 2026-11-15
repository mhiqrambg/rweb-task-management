'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  createTaskSchema,
  type ItemResponse,
  type ListResponse,
  type Task,
  type TaskListItem,
  type TaskStatus,
} from '@taskapp/contracts';
import { requestJson } from '@/lib/api';
import styles from './TaskPanel.module.css';
import { TaskFormDialog, TaskDeleteDialog, type TaskDraft } from './TaskDialogs';

type Priority = 'low' | 'medium' | 'high';
type StatusFilter = TaskStatus | 'all';
type PriorityFilter = Priority | 'all';

const STATUS_LABELS: Record<string, string> = {
  todo: 'Belum dikerjakan',
  in_progress: 'Sedang dikerjakan',
  completed: 'Selesai',
};
const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
};

function parseStatus(input: string | null): StatusFilter {
  return input === 'todo' || input === 'in_progress' || input === 'completed' ? input : 'all';
}
function parsePriority(input: string | null): PriorityFilter {
  return input === 'low' || input === 'medium' || input === 'high' ? input : 'all';
}

/** Komponen tampilan bersama: data contoh digunakan HANYA pada halaman task-preview. */
export type TaskCardData = Pick<TaskListItem, 'id' | 'title' | 'status' | 'priority' | 'dueDate'>;
export function TaskCards({
  tasks,
  onOpen,
}: {
  tasks: TaskCardData[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className={styles.cards} aria-label="Daftar tugas">
      {tasks.map((task) => (
        <button
          type="button"
          key={task.id}
          className={`panel ${styles.taskCard}`}
          onClick={() => onOpen(task.id)}
          aria-label={`Buka tugas ${task.title}`}
        >
          <strong className={styles.cardTitle}>{task.title}</strong>
          <span className="pill">{STATUS_LABELS[task.status] ?? task.status}</span>
          <span className="muted">Prioritas: {PRIORITY_LABELS[task.priority as Priority] ?? task.priority}</span>
          <span className="muted">Tenggat: {task.dueDate || 'Belum ditentukan'}</span>
        </button>
      ))}
    </div>
  );
}

type Result =
  | { key: string; kind: 'list'; items: TaskListItem[]; nextCursor: string | null }
  | { key: string; kind: 'detail'; task: Task }
  | { key: string; kind: 'error'; message: string };

type KeyedMessage = { key: string; message: string };

function TaskFilters({
  query,
  status,
  priority,
  onApply,
  onReset,
}: {
  query: string;
  status: StatusFilter;
  priority: PriorityFilter;
  onApply: (updates: { q?: string; status?: StatusFilter; priority?: PriorityFilter }) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(query);
  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply({ q: draft.trim() });
  };
  return (
    <form className={`panel ${styles.filterPanel}`} onSubmit={onSearch} role="search">
      <div className={styles.filters}>
        <label className={styles.field}>
          Cari judul tugas
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Contoh: laporan akhir"
            maxLength={200}
          />
        </label>
        <label className={styles.field}>
          Status
          <select
            value={status}
            onChange={(event) => onApply({ q: draft.trim(), status: event.target.value as StatusFilter })}
          >
            <option value="all">Semua status</option>
            <option value="todo">Belum dikerjakan</option>
            <option value="in_progress">Sedang dikerjakan</option>
            <option value="completed">Selesai</option>
          </select>
        </label>
        <label className={styles.field}>
          Prioritas
          <select
            value={priority}
            onChange={(event) => onApply({ q: draft.trim(), priority: event.target.value as PriorityFilter })}
          >
            <option value="all">Semua prioritas</option>
            <option value="low">Rendah</option>
            <option value="medium">Sedang</option>
            <option value="high">Tinggi</option>
          </select>
        </label>
      </div>
      <div className={styles.filterActions}>
        <button className="button" type="submit">Cari</button>
        <button className="button secondary" type="button" onClick={onReset}>Reset filter</button>
      </div>
    </form>
  );
}

export function TaskPanel({ id, mode }: { id: string | null; mode: string | null }) {
  const router = useRouter();
  const search = useSearchParams();
  const q = search.get('q') ?? '';
  const status = parseStatus(search.get('status'));
  const priorityFilter = parsePriority(search.get('priority'));
  const [reload, setReload] = useState(0);
  const requestKey = JSON.stringify([id, q, status, priorityFilter, reload]);

  const [result, setResult] = useState<Result | null>(null);
  const [actionError, setActionError] = useState<KeyedMessage | null>(null);
  const [moreError, setMoreError] = useState<KeyedMessage | null>(null);
  const [loadingMore, setLoadingMore] = useState<{ key: string; cursor: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteForId, setDeleteForId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = result?.key === requestKey ? result : null;
  const items = current?.kind === 'list' ? current.items : null;
  const task = current?.kind === 'detail' ? current.task : null;
  const nextCursor = current?.kind === 'list' ? current.nextCursor : null;
  const errorMessage = (actionError?.key === requestKey ? actionError.message : '') ||
    (current?.kind === 'error' ? current.message : '');
  const paginationError = moreError?.key === requestKey ? moreError.message : '';
  const isLoadingMore = loadingMore?.key === requestKey;
  const hasFilters = Boolean(q || status !== 'all' || priorityFilter !== 'all');

  function listPath(cursor?: string) {
    const params = new URLSearchParams({ limit: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (status !== 'all') params.set('status', status);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (cursor) params.set('cursor', cursor);
    return `${api.tasks}?${params.toString()}`;
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '20' });
    if (q.trim()) params.set('q', q.trim());
    if (status !== 'all') params.set('status', status);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    const path = id ? api.task(id) : `${api.tasks}?${params.toString()}`;
    if (id) {
      requestJson<ItemResponse<Task>>(path, { signal: controller.signal })
        .then((response) => {
          if (active) setResult({ key: requestKey, kind: 'detail', task: response.data });
        })
        .catch((cause: unknown) => {
          if (active) setResult({ key: requestKey, kind: 'error', message: cause instanceof Error ? cause.message : 'Gagal memuat tugas.' });
        });
    } else {
      requestJson<ListResponse<TaskListItem>>(path, { signal: controller.signal })
        .then((response) => {
          if (active) setResult({ key: requestKey, kind: 'list', items: response.data, nextCursor: response.page?.nextCursor ?? null });
        })
        .catch((cause: unknown) => {
          if (active) setResult({ key: requestKey, kind: 'error', message: cause instanceof Error ? cause.message : 'Gagal memuat daftar tugas.' });
        });
    }
    return () => { active = false; controller.abort(); };
  }, [id, q, status, priorityFilter, requestKey]);

  function setErr(message: string) {
    setActionError({ key: requestKey, message });
  }

  function applyFilters(updates: { q?: string; status?: StatusFilter; priority?: PriorityFilter }) {
    const params = new URLSearchParams(search.toString());
    params.set('view', 'tasks');
    params.delete('id');
    params.delete('mode');
    const patch = { q, status, priority: priorityFilter, ...updates };
    if (patch.q?.trim()) params.set('q', patch.q.trim()); else params.delete('q');
    if (patch.status !== 'all') params.set('status', patch.status); else params.delete('status');
    if (patch.priority !== 'all') params.set('priority', patch.priority); else params.delete('priority');
    router.replace(`/app/?${params.toString()}`);
  }

  async function create(draft: TaskDraft) {
    const parsed = createTaskSchema.safeParse({
      title: draft.title, description: draft.description || undefined,
      priority: draft.priority, dueDate: draft.dueDate || undefined,
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Data tugas tidak valid.');
    setBusy(true);
    try {
      await requestJson(api.tasks, { method: 'POST', body: JSON.stringify(parsed.data) });
      setCreateOpen(false);
      setReload((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Gagal membuat tugas.';
      setErr(message);
      throw new Error(message);
    } finally { setBusy(false); }
  }

  async function saveEdit(draft: TaskDraft) {
    if (!id) return;
    setBusy(true);
    try {
      await requestJson(api.task(id), {
        method: 'PATCH',
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          dueDate: draft.dueDate || null,
        }),
      });
      setReload((value) => value + 1);
      router.replace(`/app/?view=tasks&id=${encodeURIComponent(id)}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Gagal memperbarui tugas.';
      setErr(message);
      throw new Error(message);
    } finally { setBusy(false); }
  }

  async function updateStatus(nextStatus: TaskStatus) {
    if (!id) return;
    setBusy(true);
    try {
      await requestJson(api.task(id), { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      setReload((value) => value + 1);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : 'Gagal memperbarui status.');
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!id) return;
    setBusy(true);
    try {
      await requestJson(api.task(id), { method: 'DELETE' });
      setDeleteForId(null);
      router.push('/app/?view=tasks');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Gagal menghapus tugas.';
      setErr(message);
      throw new Error(message);
    } finally { setBusy(false); }
  }

  async function loadMore() {
    if (!nextCursor || isLoadingMore || !items) return;
    const cursor = nextCursor;
    setMoreError(null);
    setLoadingMore({ key: requestKey, cursor });
    try {
      const response = await requestJson<ListResponse<TaskListItem>>(listPath(cursor));
      setResult((previous) => {
        if (!previous || previous.key !== requestKey || previous.kind !== 'list') return previous;
        const ids = new Set(previous.items.map((item) => item.id));
        const additional = response.data.filter((item) => !ids.has(item.id));
        return {
          key: requestKey,
          kind: 'list',
          items: [...previous.items, ...additional],
          nextCursor: response.page?.nextCursor ?? null,
        };
      });
    } catch (cause) {
      setMoreError({ key: requestKey, message: cause instanceof Error ? cause.message : 'Gagal memuat halaman berikutnya.' });
    } finally {
      setLoadingMore((previous) => previous?.key === requestKey && previous.cursor === cursor ? null : previous);
    }
  }

  return (
    <section aria-label="Manajemen tugas">
      <div className="section-heading">
        <div><p className="eyebrow">MANAJEMEN TUGAS</p><h1>{id ? 'Detail tugas' : 'Daftar tugas'}</h1></div>
        {id && <button type="button" className="button secondary" onClick={() => router.push('/app/?view=tasks')}>Kembali</button>}
      </div>

      {errorMessage && (
        <div className="panel" role="alert">
          <p className="error">{errorMessage}</p>
          <button className="button secondary" type="button" onClick={() => setReload((value) => value + 1)}>Coba lagi</button>
        </div>
      )}

      {!id ? (
        <>
          <div className="actions" style={{ marginBottom: 16 }}>
            <button type="button" className="button" onClick={() => setCreateOpen(true)}>
              + Tambah tugas
            </button>
          </div>
          <TaskFilters
            key={q}
            query={q}
            status={status}
            priority={priorityFilter}
            onApply={applyFilters}
            onReset={() => applyFilters({ q: '', status: 'all', priority: 'all' })}
          />

          {items === null && !errorMessage ? (
            <div role="status" className={styles.cards} aria-label="Sedang memuat tugas">
              {[1, 2, 3].map((item) => <div className="skeleton tall" key={item} />)}
            </div>
          ) : items?.length === 0 ? (
            <div className="panel" role="status">
              <h2>{hasFilters ? 'Tidak ada tugas yang cocok' : 'Belum ada tugas'}</h2>
              <p className="muted">{hasFilters ? 'Coba ubah kata kunci atau filter.' : 'Tambahkan tugas pertama Anda melalui formulir di atas.'}</p>
              {hasFilters && <button type="button" className="button secondary" onClick={() => applyFilters({ q: '', status: 'all', priority: 'all' })}>Hapus filter</button>}
            </div>
          ) : items && (
            <>
              <p className="muted" aria-live="polite">Menampilkan {items.length} tugas{nextCursor ? ' (masih ada halaman berikutnya)' : ''}.</p>
              <TaskCards tasks={items} onOpen={(taskId) => router.push(`/app/?view=tasks&id=${encodeURIComponent(taskId)}`)} />
              {paginationError && <p role="alert" className="error">{paginationError}</p>}
              {nextCursor && (
                <div className={styles.moreRow}>
                  <button type="button" className="button secondary" disabled={isLoadingMore} onClick={() => void loadMore()}>
                    {isLoadingMore ? 'Memuat…' : 'Muat lebih banyak'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : !task && !errorMessage ? (
        <div className="skeleton tall" role="status" aria-label="Memuat detail tugas" />
      ) : task && (
        <div className="panel">
          <h2>{task.title}</h2>
          <p className="muted">{task.description || 'Belum ada deskripsi'}</p>
          <p>Prioritas: <span className="pill">{PRIORITY_LABELS[task.priority as Priority] ?? task.priority}</span></p>
          <p>Tenggat: {task.dueDate || 'Belum ditentukan'}</p>
          <label className={styles.field}>Ubah status
            <select value={task.status} onChange={(event) => void updateStatus(event.target.value as TaskStatus)} disabled={busy}>
              <option value="todo">Belum dikerjakan</option>
              <option value="in_progress">Sedang dikerjakan</option>
              <option value="completed">Selesai</option>
            </select>
          </label>
          <div className="actions">
            <button type="button" className="button secondary" onClick={() => router.push(`/app/?view=tasks&id=${encodeURIComponent(id)}&mode=edit`)}>Edit</button>
            <button type="button" className="button danger" disabled={busy} onClick={() => setDeleteForId(id)}>Hapus</button>
          </div>

        </div>
      )}
      {createOpen && !id && (
        <TaskFormDialog
          kind="create"
          onSave={create}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {id && task && mode === 'edit' && (
        <TaskFormDialog
          key={task.id}
          kind="edit"
          initial={{
            title: task.title,
            description: task.description ?? '',
            priority: task.priority as Priority,
            dueDate: task.dueDate ?? '',
          }}
          onSave={saveEdit}
          onClose={() => router.replace(`/app/?view=tasks&id=${encodeURIComponent(id)}`)}
        />
      )}
      {id && task && deleteForId === id && (
        <TaskDeleteDialog
          title={task.title}
          onConfirm={remove}
          onClose={() => setDeleteForId(null)}
        />
      )}
    </section>
  );
}
