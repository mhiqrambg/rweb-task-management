'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardContent, DashboardError, LoadingDashboard, type DashboardDisplayData } from '@/components/DashboardPanel';

/**
 * Halaman contoh khusus pemeriksaan visual. BUKAN halaman privat dan tidak membaca API.
 * Hapus folder dashboard-preview sebelum build final / uji parity produksi.
 */
const previewData: DashboardDisplayData = {
  tasks: { total: 12, active: 5, completed: 6, overdue: 1 },
  recentTasks: [
    { id: 'contoh-1', title: 'Menyelesaikan tampilan dashboard', status: 'in_progress' },
    { id: 'contoh-2', title: 'Menguji tampilan responsif', status: 'todo' },
    { id: 'contoh-3', title: 'Menyiapkan komponen UI', status: 'completed' },
  ],
};
const emptyData: DashboardDisplayData = {
  tasks: { total: 0, active: 0, completed: 0, overdue: 0 },
  recentTasks: [],
};
type PreviewState = 'populated' | 'empty' | 'loading' | 'error';

export default function DashboardPreview() {
  const [state, setState] = useState<PreviewState>('populated');
  const states: { key: PreviewState; label: string }[] = [
    { key: 'populated', label: 'Berisi data' },
    { key: 'empty', label: 'Data kosong' },
    { key: 'loading', label: 'Loading' },
    { key: 'error', label: 'Error API' },
  ];
  return (
    <main style={{ maxWidth: 1152, padding: 24, margin: '0 auto' }}>
      <div className="panel" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-accent)' }}>
        <strong>PRATINJAU FRONTEND — DATA CONTOH</strong>
        <p className="muted" style={{ marginTop: 8, marginBottom: 8 }}>
          Halaman ini hanya untuk memeriksa desain ketika Fastify belum tersedia.
          Tidak ada login, database, atau akses ke data pengguna.
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
        <Link href="/login">Kembali ke Login</Link>
      </div>
      <h1>Ringkasan aktivitas</h1>
      {state === 'loading' ? <LoadingDashboard /> :
        state === 'error' ? <DashboardError message="Contoh: API tidak dapat dihubungi." onRetry={() => setState('populated')} /> :
          <DashboardContent dashboard={state === 'empty' ? emptyData : previewData} />}
    </main>
  );
}
