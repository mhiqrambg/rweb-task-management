'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api,
  copy,
  fill,
  formatDate,
  formatRelative,
  type Dashboard,
  type ItemResponse,
} from '@taskapp/contracts';
import { requestJson } from '@/lib/api';
import { AttachmentLightbox, AttachmentStrip, type AttachmentView } from './AttachmentLightbox';

type RequestResult =
  | { requestId: number; status: 'success'; dashboard: Dashboard }
  | { requestId: number; status: 'error'; message: string };

/** Guard ringan: hindari crash UI jika endpoint API mengirim bentuk data yang salah. */
function isDashboard(value: unknown): value is Dashboard {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  const counts = data.tasks as Record<string, unknown> | null;
  if (typeof counts !== 'object' || counts === null) return false;
  if (!['total', 'active', 'completed', 'overdue'].every((key) =>
    typeof counts[key] === 'number' && Number.isFinite(counts[key]) && (counts[key] as number) >= 0
  )) return false;
  for (const key of ['byStatus', 'byPriority'] as const) {
    const group = data[key] as Record<string, unknown> | null;
    if (typeof group !== 'object' || group === null) return false;
    if (!Object.values(group).every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  }
  if (!Array.isArray(data.recentTasks) || !Array.isArray(data.recentNotes)) return false;
  return true;
}

export function LoadingDashboard() {
  return (
    <section aria-label={copy.dash.loading} role="status" aria-live="polite">
      <span className="visually-hidden">{copy.dash.loading}</span>
      <div className="grid-3" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className="panel stat" key={item}>
            <div className="skeleton" style={{ width: '62%', height: 16 }} />
            <div className="skeleton" style={{ width: '45%', height: 42 }} />
            <div className="skeleton" style={{ width: '80%', height: 14 }} />
          </div>
        ))}
      </div>
      <div className="grid-3" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className="panel" key={item}>
            <div className="skeleton" style={{ width: '40%', height: 22 }} />
            {[0, 1, 2].map((row) => <div className="skeleton" style={{ height: 30 }} key={row} />)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="panel" role="alert">
      <h2>{copy.state.error.title}</h2>
      <p className="inline-error">{message}</p>
      <button className="btn" data-variant="secondary" type="button" onClick={onRetry}>
        {copy.action.retry}
      </button>
    </section>
  );
}

/** Bentuk data minimum untuk tampilan Dashboard: kontrak Dashboard penuh. */
export type DashboardDisplayData = Dashboard;

function Breakdown({ id, title, rows }: { id: string; title: string; rows: Array<[string, number]> }) {
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel__head">
        <h2 className="section__title" id={id}>{title}</h2>
      </div>
      <div className="breakdown">
        {rows.map(([label, value]) => (
          <div className="breakdown__row" key={label}>
            <span>{label}</span>
            <span className="breakdown__value">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardHeader() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  return (
    <div className="page-head">
      <div className="page-head__row">
        <h1 className="page-head__title" id="dashboard-heading">{copy.dash.title}</h1>
        <form
          className="search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const q = query.trim();
            router.push(`/app/?view=tasks${q ? `&q=${encodeURIComponent(q)}` : ''}`);
          }}
        >
          <label className="visually-hidden" htmlFor="dashboard-search">{copy.dash.search.label}</label>
          <input
            id="dashboard-search"
            className="field__input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.dash.search.label}
          />
        </form>
        <Link className="btn" data-variant="primary" href="/app/?view=tasks">{copy.task.new}</Link>
      </div>
    </div>
  );
}

export function DashboardContent({ dashboard }: { dashboard: DashboardDisplayData }) {
  const stats = [
    { label: copy.dash.stat.total, hint: copy.dash.stat.totalHint, value: dashboard.tasks.total },
    { label: copy.dash.stat.active, hint: copy.dash.stat.activeHint, value: dashboard.tasks.active },
    { label: copy.dash.stat.completed, hint: copy.dash.stat.completedHint, value: dashboard.tasks.completed },
  ] as const;
  // d-01 caps each list at two cards.
  const recentTasks = dashboard.recentTasks.slice(0, 2);
  const recentNotes = dashboard.recentNotes.slice(0, 2);
  const [openAt, setOpenAt] = useState<number | null>(null);

  // One lightbox over both lists, so a thumbnail on either card opens (Astro's counterpart does the
  // same). `attachments` is the flat slide list; each strip passes its own offset into it.
  const slides: AttachmentView[] = [
    ...recentTasks.flatMap((task) => task.attachments),
    ...recentNotes.flatMap((note) => note.attachments),
  ];
  const noteOffset = recentTasks.reduce((total, task) => total + task.attachments.length, 0);

  return (
    <>
      <DashboardHeader />

      <div className="grid-3" aria-label={copy.dash.title}>
        {stats.map((stat) => (
          <div className="panel stat" key={stat.label}>
            <span className="stat__label">{stat.label}</span>
            <strong className="stat__value">{stat.value}</strong>
            <span className="stat__hint">{stat.hint}</span>
          </div>
        ))}
      </div>

      <div className="grid-3">
        <Breakdown
          id="dash-status"
          title={copy.dash.breakdown.status}
          rows={[
            [copy.task.status.todo, dashboard.byStatus.todo],
            [copy.task.status.in_progress, dashboard.byStatus.in_progress],
            [copy.task.status.completed, dashboard.byStatus.completed],
          ]}
        />
        <Breakdown
          id="dash-priority"
          title={copy.dash.breakdown.priority}
          rows={[
            [copy.task.priority.low, dashboard.byPriority.low],
            [copy.task.priority.medium, dashboard.byPriority.medium],
            [copy.task.priority.high, dashboard.byPriority.high],
          ]}
        />
        <section className="panel" aria-labelledby="dash-overdue">
          <div className="panel__head">
            <h2 className="section__title" id="dash-overdue">{copy.dash.breakdown.overdue}</h2>
          </div>
          <div className="breakdown">
            <div className="breakdown__row">
              <strong
                className="breakdown__value"
                data-tone={dashboard.tasks.overdue > 0 ? 'danger' : undefined}
              >
                {dashboard.tasks.overdue}
              </strong>
            </div>
          </div>
          <p className="muted stat__hint">{copy.dash.breakdown.overdueHint}</p>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel" aria-labelledby="dash-recent-tasks">
          <div className="panel__head">
            <h2 className="section__title" id="dash-recent-tasks">{copy.dash.recentTasks}</h2>
            <Link className="btn btn--sm" data-variant="ghost" href="/app/?view=tasks">
              {copy.dash.viewAll}
            </Link>
          </div>
          {recentTasks.length === 0 ? (
            <div className="empty-state">
              <p><strong>{copy.dash.empty.tasks}</strong></p>
              <p className="muted">{copy.dash.empty.tasksHint}</p>
              <Link className="btn" data-variant="primary" href="/app/?view=tasks">{copy.task.new}</Link>
            </div>
          ) : (
            <ul className="panel__list">
              {recentTasks.map((task) => (
                <li className="card card--hoverable task-card" key={task.id}>
                  <h3 className="task-card__title">
                    <Link href={`/app/?view=tasks&id=${encodeURIComponent(task.id)}`}>{task.title}</Link>
                  </h3>
                  <div className="task-card__meta">
                    <span className="badge" data-kind="status" data-value={task.status}>
                      {copy.task.status[task.status]}
                    </span>
                    <span className="badge" data-kind="priority" data-value={task.priority}>
                      {copy.task.priority[task.priority]}
                    </span>
                  </div>
                  {task.dueDate ? (
                    <p className="task-card__due" data-overdue={task.isOverdue ? '' : undefined}>
                      {task.isOverdue ? `${copy.task.overdue} · ` : ''}
                      {formatDate(task.dueDate)}
                    </p>
                  ) : null}
                  {task.attachments.length > 0 ? (
                    <AttachmentStrip
                      attachments={task.attachments}
                      overflow={Math.max(0, task.attachmentCount - task.attachments.length)}
                      onOpen={(index) => setOpenAt(index)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="dash-recent-notes">
          <div className="panel__head">
            <h2 className="section__title" id="dash-recent-notes">{copy.dash.recentNotes}</h2>
            <Link className="btn btn--sm" data-variant="ghost" href="/app/?view=notes">
              {copy.dash.viewAll}
            </Link>
          </div>
          {recentNotes.length === 0 ? (
            <div className="empty-state">
              <p><strong>{copy.dash.empty.notes}</strong></p>
              <p className="muted">{copy.note.empty.body}</p>
              <Link className="btn" data-variant="primary" href="/app/?view=notes">{copy.note.new}</Link>
            </div>
          ) : (
            <ul className="panel__list">
              {recentNotes.map((note) => (
                <li className="card card--hoverable note-card" key={note.id}>
                  <h3 className="note-card__title">
                    <Link href={`/app/?view=notes&id=${encodeURIComponent(note.id)}`}>{note.title}</Link>
                  </h3>
                  {note.pinned ? <span className="badge" data-kind="pin">{copy.note.pinned}</span> : null}
                  <p className="note-card__body">{note.excerpt}</p>
                  <div className="task-card__meta">
                    <span>{fill(copy.note.updatedAt, { relative: formatRelative(note.updatedAt) })}</span>
                  </div>
                  {note.attachments.length > 0 ? (
                    <AttachmentStrip
                      attachments={note.attachments}
                      overflow={Math.max(0, note.attachmentCount - note.attachments.length)}
                      onOpen={(index) => setOpenAt(noteOffset + index)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {openAt !== null && slides[openAt] ? (
        <AttachmentLightbox
          label={copy.task.attachments.open}
          attachments={slides}
          index={openAt}
          onChange={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </>
  );
}

/** Data pengguna selalu diambil dari browser; file HTML static export tidak mengandung data privat. */
export function DashboardPanel() {
  const [requestId, setRequestId] = useState(0);
  const [result, setResult] = useState<RequestResult | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    requestJson<ItemResponse<unknown>>(api.dashboard, { signal: controller.signal })
      .then((response) => {
        if (!active) return;
        if (!isDashboard(response.data)) {
          setResult({ requestId, status: 'error', message: copy.state.error.body });
          return;
        }
        setResult({ requestId, status: 'success', dashboard: response.data });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setResult({
          requestId,
          status: 'error',
          message: cause instanceof Error ? cause.message : copy.state.error.body,
        });
      });
    return () => { active = false; controller.abort(); };
  }, [requestId]);

  const current = result?.requestId === requestId ? result : null;

  return (
    <section aria-labelledby="dashboard-heading">
      {!current ? (
        <LoadingDashboard />
      ) : current.status === 'error' ? (
        <DashboardError message={current.message} onRetry={() => setRequestId((id) => id + 1)} />
      ) : (
        <DashboardContent dashboard={current.dashboard} />
      )}
    </section>
  );
}
