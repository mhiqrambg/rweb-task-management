'use client';

import { useState } from 'react';
import { TaskFormDialog, TaskDeleteDialog, type TaskDraft } from '@/components/TaskDialogs';

type ExampleTask = TaskDraft & { id: number; status: 'todo' | 'in_progress' | 'completed' };
const INITIAL_TASKS: ExampleTask[] = [
  { id: 1, title: 'Menuntaskan UI tugas', description: 'Uji dialog edit dan penyimpanan', priority: 'high', dueDate: '2026-11-18', status: 'in_progress' },
  { id: 2, title: 'Uji konfirmasi hapus', description: 'Pastikan batal tidak menghapus', priority: 'medium', dueDate: '', status: 'todo' },
];

export default function TaskActionsPreviewPage() {
  const [tasks, setTasks] = useState<ExampleTask[]>(INITIAL_TASKS);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const selected = tasks.find((task) => task.id === editing) ?? null;
  const toDelete = tasks.find((task) => task.id === deleting) ?? null;

  async function create(draft: TaskDraft) {
    setTasks((old) => [{ ...draft, id: Date.now(), status: 'todo' }, ...old]);
    setCreating(false);
  }
  async function edit(draft: TaskDraft) {
    setTasks((old) => old.map((item) => item.id === editing ? { ...item, ...draft } : item));
    setEditing(null);
  }
  async function remove() {
    setTasks((old) => old.filter((item) => item.id !== deleting));
    setDeleting(null);
  }

  return (
    <main className="content" style={{ maxWidth: 980, margin: '30px auto' }}>
      <section className="panel">
        <p className="eyebrow">PRATINJAU — DATA FIKTIF, TIDAK TERHUBUNG API</p>
        <h1>Task Detail, Form Modal & Delete Confirm</h1>
        <p className="muted">Semua perubahan hanya tersimpan selama halaman ini terbuka. Refresh untuk mengembalikan data awal.</p>
        <button className="button" type="button" onClick={() => setCreating(true)}>+ Tambah tugas</button>
      </section>
      <div className="card-grid" style={{ marginTop: 18 }}>
        {tasks.length === 0 && <p role="status">Belum ada tugas. Coba tambah tugas.</p>}
        {tasks.map((task) => (
          <article key={task.id} className="panel">
            <h2>{task.title}</h2>
            <p className="muted">{task.description || 'Tanpa deskripsi'}</p>
            <p>Prioritas: <span className="pill">{task.priority}</span></p>
            <p>Tenggat: {task.dueDate || 'Tidak ditentukan'}</p>
            <label>Status
              <select value={task.status} onChange={(event) => setTasks((old) => old.map((item) => item.id === task.id ? { ...item, status: event.target.value as ExampleTask['status'] } : item))}>
                <option value="todo">Belum dikerjakan</option>
                <option value="in_progress">Sedang dikerjakan</option>
                <option value="completed">Selesai</option>
              </select>
            </label>
            <div className="actions" style={{ marginTop: 14 }}>
              <button type="button" className="button secondary" onClick={() => setEditing(task.id)}>Edit</button>
              <button type="button" className="button danger" onClick={() => setDeleting(task.id)}>Hapus</button>
            </div>
          </article>
        ))}
      </div>
      {creating && <TaskFormDialog kind="create" onSave={create} onClose={() => setCreating(false)} />}
      {selected && <TaskFormDialog key={selected.id} kind="edit" initial={selected} onSave={edit} onClose={() => setEditing(null)} />}
      {toDelete && <TaskDeleteDialog title={toDelete.title} onConfirm={remove} onClose={() => setDeleting(null)} />}
    </main>
  );
}
