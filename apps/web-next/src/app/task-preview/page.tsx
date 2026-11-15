'use client';

import { useMemo, useState } from 'react';
import { TaskCards, type TaskCardData } from '@/components/TaskPanel';

type PreviewStatus = 'all' | 'todo' | 'in_progress' | 'completed';
type PreviewPriority = 'all' | 'low' | 'medium' | 'high';

const DEMO_TASKS: TaskCardData[] = [
  { id: 'demo-01', title: 'Menyelesaikan Dashboard Next.js', status: 'completed', priority: 'high', dueDate: '2026-11-17' },
  { id: 'demo-02', title: 'Menguji filter daftar tugas', status: 'in_progress', priority: 'medium', dueDate: '2026-11-18' },
  { id: 'demo-03', title: 'Menyamakan tampilan Astro dan Next.js', status: 'todo', priority: 'high', dueDate: '2026-11-18' },
  { id: 'demo-04', title: 'Menyiapkan pengujian performa', status: 'todo', priority: 'low', dueDate: '2026-11-20' },
];

export default function TaskPreviewPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('all');
  const [priority, setPriority] = useState<PreviewPriority>('all');
  const [activeTask, setActiveTask] = useState('');
  const items = useMemo(() => DEMO_TASKS.filter((task) =>
    task.title.toLowerCase().includes(q.toLowerCase().trim()) &&
    (status === 'all' || task.status === status) &&
    (priority === 'all' || task.priority === priority)
  ), [q, status, priority]);

  return (
    <main className="content" style={{ maxWidth: 1100, margin: '40px auto' }}>
      <section className="panel">
        <p className="eyebrow">PRATINJAU KOMPONEN — DATA CONTOH</p>
        <h1>Daftar tugas dan filter</h1>
        <p className="muted">Halaman ini untuk pengujian antarmuka tanpa login dan tanpa API. Data tidak disimpan.</p>
        <div className="inline-form">
          <label>Cari tugas
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ketik judul tugas" />
          </label>
          <label>Status
            <select value={status} onChange={(event) => setStatus(event.target.value as PreviewStatus)}>
              <option value="all">Semua status</option><option value="todo">Belum dikerjakan</option>
              <option value="in_progress">Sedang dikerjakan</option><option value="completed">Selesai</option>
            </select>
          </label>
          <label>Prioritas
            <select value={priority} onChange={(event) => setPriority(event.target.value as PreviewPriority)}>
              <option value="all">Semua prioritas</option><option value="low">Rendah</option>
              <option value="medium">Sedang</option><option value="high">Tinggi</option>
            </select>
          </label>
          <button type="button" className="button secondary" onClick={() => { setQ(''); setStatus('all'); setPriority('all'); setActiveTask(''); }}>Reset</button>
        </div>
      </section>
      {items.length === 0 ? <section className="panel" role="status">Tidak ada tugas yang cocok dengan filter.</section> : (
        <TaskCards tasks={items} onOpen={(id) => setActiveTask(DEMO_TASKS.find((task) => task.id === id)?.title ?? '')} />
      )}
      {activeTask && <section className="panel" role="status" style={{ marginTop: 16 }}>Tugas dipilih: <strong>{activeTask}</strong></section>}
    </main>
  );
}
