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
import styles from './DashboardPanel.module.css';

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
      <span className={styles.srOnly}>{copy.dash.loading}</span>
      <div className={styles.stats} aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className={`panel ${styles.statCard}`} key={item}>
            <div className="skeleton" style={{ width: '62%', height: 16 }} />
            <div className="skeleton" style={{ width: '45%', height: 42 }} />
            <div className="skeleton" style={{ width: '80%', height: 14 }} />
          </div>
        ))}
      </div>
      <div className={styles.columns} aria-hidden="true">
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
    <section className={`panel ${styles.errorPanel}`} role="alert">
      <h2>{copy.state.error.title}</h2>
      <p>{message}</p>
      <button className="button secondary" type="button" onClick={onRetry}>{copy.action.retry}</button>
    </section>
  );
}

/** Bentuk data minimum untuk tampilan Dashboard: kontrak Dashboard penuh. */
export type DashboardDisplayData = Dashboard;

function Breakdown({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <section className="panel" aria-label={title}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <dl className={styles.breakdown}>
        {rows.map(([label, value]) => (
          <div className={styles.breakdownRow} key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function DashboardHeader() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  return (
    <div className={styles.titleRow}>
      <h1 id="dashboard-heading">{copy.dash.title}</h1>
      <form
        className={styles.searchRow}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/app/?view=tasks${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`);
        }}
      >
        <label className={styles.srOnly} htmlFor="dashboard-search">{copy.dash.search.label}</label>
        <input
          id="dashboard-search"
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.dash.search.label}
        />
        <Link className="btn" data-variant="primary" href="/app/?view=tasks">{copy.task.new}</Link>
      </form>
    </div>
  );
}

export function DashboardContent({ dashboard }: { dashboard: DashboardDisplayData }) {
  const stats = [
    { label: copy.dash.stat.total, hint: copy.dash.stat.totalHint, value: dashboard.tasks.total },
    { label: copy.dash.stat.active, hint: copy.dash.stat.activeHint, value: dashboard.tasks.active },
    { label: copy.dash.stat.completed, hint: copy.dash.stat.completedHint, value: dashboard.tasks.completed },
  ] as const;
  const recentTasks = dashboard.recentTasks.slice(0, 2);
  const recentNotes = dashboard.recentNotes.slice(0, 2);

  return (
    <>
      <DashboardHeader />
      <div className={styles.stats} aria-label={copy.dash.title}>
        {stats.map((stat) => (
          <div className={`panel ${styles.statCard}`} key={stat.label}>
            <span className={styles.statLabel}>{stat.label}</span>
            <strong className={styles.statNumber}>{stat.value}</strong>
            <span className={styles.statDetail}>{stat.hint}</span>
          </div>
        ))}
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <Breakdown
            title={copy.dash.breakdown.status}
            rows={[
              [copy.task.status.todo, dashboard.byStatus.todo],
              [copy.task.status.in_progress, dashboard.byStatus.in_progress],
              [copy.task.status.completed, dashboard.byStatus.completed],
            ]}
          />
          <section className="panel" aria-labelledby="recent-tasks-heading">
            <div className={styles.panelHeading}>
              <h2 id="recent-tasks-heading" className={styles.panelTitle}>{copy.dash.recentTasks}</h2>
              <Link href="/app/?view=tasks" className={styles.inlineLink}>{copy.dash.viewAll}</Link>
            </div>
            {recentTasks.length === 0 ? (
              <div role="status">
                <p><strong>{copy.dash.empty.tasks}</strong></p>
                <p className="muted">{copy.dash.empty.tasksHint}</p>
                <p><Link className="btn" data-variant="primary" href="/app/?view=tasks">{copy.task.new}</Link></p>
              </div>
            ) : (
              <ul className={styles.recentList}>
                {recentTasks.map((task) => (
                  <li className={styles.recentCard} key={task.id}>
                    <Link className={styles.taskLink} href={`/app/?view=tasks&id=${encodeURIComponent(task.id)}`}>
                      {task.title}
                    </Link>
                    <div className={styles.badges}>
                      <span className="badge" data-kind="status" data-value={task.status}>
                        {copy.task.status[task.status]}
                      </span>
                      <span className="badge" data-kind="priority" data-value={task.priority}>
                        {copy.task.priority[task.priority]}
                      </span>
                    </div>
                    <p className={styles.cardMeta}>
                      {task.isOverdue && task.dueDate
                        ? <span className={styles.dangerText}>{`${copy.task.overdue} · ${formatDate(task.dueDate)}`}</span>
                        : task.dueDate ? formatDate(task.dueDate) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={styles.column}>
          <Breakdown
            title={copy.dash.breakdown.priority}
            rows={[
              [copy.task.priority.low, dashboard.byPriority.low],
              [copy.task.priority.medium, dashboard.byPriority.medium],
              [copy.task.priority.high, dashboard.byPriority.high],
            ]}
          />
          <section className="panel" aria-labelledby="recent-notes-heading">
            <div className={styles.panelHeading}>
              <h2 id="recent-notes-heading" className={styles.panelTitle}>{copy.dash.recentNotes}</h2>
              <Link href="/app/?view=notes" className={styles.inlineLink}>{copy.dash.viewAll}</Link>
            </div>
            {recentNotes.length === 0 ? (
              <div role="status">
                <p><strong>{copy.dash.empty.notes}</strong></p>
                <p className="muted">{copy.note.empty.body}</p>
                <p><Link className="btn" data-variant="primary" href="/app/?view=notes">{copy.note.new}</Link></p>
              </div>
            ) : (
              <ul className={styles.recentList}>
                {recentNotes.map((note) => (
                  <li className={styles.recentCard} key={note.id}>
                    <Link className={styles.taskLink} href={`/app/?view=notes&id=${encodeURIComponent(note.id)}`}>
                      {note.title}
                    </Link>
                    {note.pinned ? <span className="badge" data-kind="pin">{copy.note.pinned}</span> : null}
                    <p className={styles.excerpt}>{note.excerpt}</p>
                    <p className={styles.cardMeta}>
                      {fill(copy.note.updatedAt, { relative: formatRelative(note.updatedAt) })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={styles.column}>
          <section className="panel" aria-labelledby="overdue-heading">
            <h2 id="overdue-heading" className={styles.panelTitle}>{copy.dash.breakdown.overdue}</h2>
            <strong className={`${styles.statNumber} ${dashboard.tasks.overdue > 0 ? styles.dangerText : ''}`}>
              {dashboard.tasks.overdue}
            </strong>
            <p className="muted">{copy.dash.breakdown.overdueHint}</p>
          </section>
        </div>
      </div>
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
