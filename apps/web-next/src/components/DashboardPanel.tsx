'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Dashboard, type ItemResponse } from '@taskapp/contracts';
import { requestJson } from '@/lib/api';
import styles from './DashboardPanel.module.css';

type RequestResult =
  | { requestId: number; status: 'success'; dashboard: Dashboard }
  | { requestId: number; status: 'error'; message: string };

const taskStatusLabels: Record<string, string> = {
  todo: 'Belum dikerjakan',
  in_progress: 'Sedang dikerjakan',
  completed: 'Selesai',
};

/** Guard ringan: hindari crash UI jika endpoint API mengirim bentuk data yang salah. */
function isDashboard(value: unknown): value is Dashboard {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  if (typeof data.tasks !== 'object' || data.tasks === null) return false;
  const tasks = data.tasks as Record<string, unknown>;
  if (!['total', 'active', 'completed', 'overdue'].every((key) =>
    typeof tasks[key] === 'number' && Number.isFinite(tasks[key]) && (tasks[key] as number) >= 0
  )) return false;
  if (!Array.isArray(data.recentTasks)) return false;
  return data.recentTasks.every((task: unknown) => {
    if (typeof task !== 'object' || task === null) return false;
    const row = task as Record<string, unknown>;
    return typeof row.id === 'string' && typeof row.title === 'string' && typeof row.status === 'string';
  });
}

export function LoadingDashboard() {
  return (
    <section aria-label="Dashboard sedang dimuat" role="status" aria-live="polite">
      <span className={styles.srOnly}>Memuat ringkasan tugas...</span>
      <div className={styles.stats} aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div className={`panel ${styles.statCard}`} key={item}>
            <div className="skeleton" style={{ width: '62%', height: 16 }} />
            <div className="skeleton" style={{ width: '45%', height: 42 }} />
          </div>
        ))}
      </div>
      <div className={`panel ${styles.recentPanel}`} aria-hidden="true">
        <div className="skeleton" style={{ width: '40%', height: 22 }} />
        {[0, 1, 2].map((item) => <div className="skeleton" style={{ height: 30 }} key={item} />)}
      </div>
    </section>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className={`panel ${styles.errorPanel}`} role="alert">
      <h2>Dashboard belum dapat dimuat</h2>
      <p>{message}</p>
      <button className="button" type="button" onClick={onRetry}>Coba lagi</button>
    </section>
  );
}

/** Komponen presentasional: dapat diuji tanpa sesi maupun koneksi API. */
/** Bentuk data minimum untuk tampilan Dashboard; kontrak API Dashboard boleh lebih lengkap. */
export type DashboardDisplayData = {
  tasks: { total: number; active: number; completed: number; overdue: number };
  recentTasks: Array<{ id: string; title: string; status: string }>;
};

export function DashboardContent({ dashboard }: { dashboard: DashboardDisplayData }) {
  const stats = [
    { label: 'Total tugas', value: dashboard.tasks.total, detail: 'Seluruh tugas Anda', type: 'total' },
    { label: 'Sedang aktif', value: dashboard.tasks.active, detail: 'Memerlukan tindak lanjut', type: 'active' },
    { label: 'Selesai', value: dashboard.tasks.completed, detail: 'Tugas yang dituntaskan', type: 'completed' },
    { label: 'Terlambat', value: dashboard.tasks.overdue, detail: 'Sudah melewati tenggat', type: 'overdue' },
  ] as const;

  return (
    <>
      <div className={styles.stats} aria-label="Statistik tugas">
        {stats.map((stat) => (
          <div className={`panel ${styles.statCard}`} key={stat.type}>
            <span className={styles.statLabel}>{stat.label}</span>
            <strong className={`${styles.statNumber} ${stat.type === 'overdue' && stat.value > 0 ? styles.dangerText : ''}`}>
              {stat.value.toLocaleString('id-ID')}
            </strong>
            <span className={styles.statDetail}>{stat.detail}</span>
          </div>
        ))}
      </div>

      {dashboard.tasks.total === 0 && (
        <section className={`panel ${styles.emptyPanel}`} aria-label="Belum ada tugas">
          <h2>Mulai dengan tugas pertama</h2>
          <p className="muted">Daftar tugas Anda masih kosong. Buat tugas untuk mulai mengatur pekerjaan.</p>
          <Link className="button" href="/app/?view=tasks">Buat tugas</Link>
        </section>
      )}

      <div className={styles.grid}>
        <section className={`panel ${styles.recentPanel}`} aria-labelledby="recent-tasks-heading">
          <div className={styles.panelHeading}>
            <h2 id="recent-tasks-heading">Tugas terbaru</h2>
            <Link href="/app/?view=tasks" className={styles.inlineLink}>Lihat semua</Link>
          </div>
          {dashboard.recentTasks.length === 0 ? (
            <p className="muted" role="status">Belum ada tugas terbaru untuk ditampilkan.</p>
          ) : (
            <ul className={styles.recentList}>
              {dashboard.recentTasks.map((task) => (
                <li className={styles.recentItem} key={task.id}>
                  <Link className={styles.taskLink} href={`/app/?view=tasks&id=${encodeURIComponent(task.id)}`}>
                    {task.title}
                  </Link>
                  <span className="pill">{taskStatusLabels[task.status] ?? task.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`panel ${styles.quickPanel}`} aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading">Akses cepat</h2>
          <p className="muted">Buka fitur penting untuk melanjutkan aktivitas Anda.</p>
          <div className={styles.quickActions}>
            <Link href="/app/?view=tasks" className="button">Kelola tugas</Link>
            <Link href="/app/?view=notes" className="button secondary">Buka catatan</Link>
          </div>
        </section>
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
          setResult({ requestId, status: 'error', message: 'Format respons dashboard tidak sesuai kontrak API.' });
          return;
        }
        setResult({ requestId, status: 'success', dashboard: response.data });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setResult({
          requestId,
          status: 'error',
          message: cause instanceof Error ? cause.message : 'Dashboard gagal dimuat.',
        });
      });
    return () => { active = false; controller.abort(); };
  }, [requestId]);

  const current = result?.requestId === requestId ? result : null;

  return (
    <section aria-labelledby="dashboard-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GAMBARAN UMUM</p>
          <h1 id="dashboard-heading">Ringkasan aktivitas</h1>
          <p className="muted">Pantau kemajuan tugas Anda dalam satu tempat.</p>
        </div>
        <button type="button" className="button secondary" onClick={() => setRequestId((id) => id + 1)}>
          Muat ulang
        </button>
      </div>
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
