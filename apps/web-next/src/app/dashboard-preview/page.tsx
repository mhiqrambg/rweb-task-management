'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardContent, DashboardError, DashboardHeader, LoadingDashboard, type DashboardDisplayData } from '@/components/DashboardPanel';

/**
 * Halaman contoh khusus pemeriksaan visual. BUKAN halaman privat dan tidak membaca API.
 * Hapus folder dashboard-preview sebelum build final / uji parity produksi.
 */
const previewData: DashboardDisplayData = {
  tasks: { total: 9, active: 6, completed: 3, overdue: 2 },
  byStatus: { todo: 4, in_progress: 2, completed: 3 },
  byPriority: { low: 3, medium: 4, high: 2 },
  recentTasks: [
    { id: 'sample-1', title: 'Prepare sprint review', status: 'in_progress', priority: 'high', dueDate: '2026-11-12', isOverdue: false, attachments: [], attachmentCount: 3, updatedAt: '2026-11-15T08:00:00.000Z' },
    { id: 'sample-2', title: 'Draft Q4 roadmap', status: 'todo', priority: 'low', dueDate: null, isOverdue: false, attachments: [], attachmentCount: 0, updatedAt: '2026-11-14T08:00:00.000Z' },
  ],
  recentNotes: [
    { id: 'sample-n1', title: 'Launch checklist', excerpt: 'Confirm the agenda and owners before Friday.', pinned: true, attachments: [], attachmentCount: 1, updatedAt: '2026-11-15T07:00:00.000Z' },
    { id: 'sample-n2', title: 'Reading notes', excerpt: 'Two chapters on measurement remain.', pinned: false, attachments: [], attachmentCount: 0, updatedAt: '2026-11-13T08:00:00.000Z' },
  ],
};
const emptyData: DashboardDisplayData = {
  tasks: { total: 0, active: 0, completed: 0, overdue: 0 },
  byStatus: { todo: 0, in_progress: 0, completed: 0 },
  byPriority: { low: 0, medium: 0, high: 0 },
  recentTasks: [],
  recentNotes: [],
};
type PreviewState = 'populated' | 'empty' | 'loading' | 'error';

export default function DashboardPreview() {
  const [state, setState] = useState<PreviewState>('populated');
  const states: { key: PreviewState; label: string }[] = [
    { key: 'populated', label: 'Populated' },
    { key: 'empty', label: 'Empty' },
    { key: 'loading', label: 'Loading' },
    { key: 'error', label: 'API error' },
  ];
  return (
    <main style={{ maxWidth: 1152, padding: 24, margin: '0 auto' }}>
      <div className="panel" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-accent)' }}>
        <strong>FRONTEND PREVIEW — SAMPLE DATA</strong>
        <p className="muted" style={{ marginTop: 8, marginBottom: 8 }}>
          This page only checks the design while the ElysiaJS API is unavailable.
          No login, database, or user data access.
        </p>
        <div className="actions">
          {states.map((option) => (
            <button
              className={`button ${state === option.key ? '' : 'secondary'}`}
              key={option.key}
              type="button"
              onClick={() => setState(option.key)}
              aria-pressed={state === option.key}
            >{option.label}</button>
          ))}
        </div>
        <Link href="/login">Back to login</Link>
      </div>
      {state === 'populated' || state === 'empty' ? <DashboardContent dashboard={state === 'empty' ? emptyData : previewData} /> : (
        <>
          <DashboardHeader />
          {state === 'loading' ? <LoadingDashboard /> :
            <DashboardError message="Example: the API cannot be reached." onRetry={() => setState('populated')} />}
        </>
      )}
    </main>
  );
}
