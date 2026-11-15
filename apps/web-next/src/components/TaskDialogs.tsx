'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import styles from './TaskDialogs.module.css';

export type TaskDraft = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
};

const EMPTY_TASK: TaskDraft = {
  title: '', description: '', priority: 'medium', dueDate: '',
};

/** Focus management without React state changes inside effects. */
function useModalFocus() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const beforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>('input, button, select, textarea')?.focus();
    return () => beforeOpen?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, close: () => void) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
    if (focusable.length === 0) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };
  return { ref, onKeyDown };
}

export function TaskFormDialog({
  kind, initial, onSave, onClose,
}: {
  kind: 'create' | 'edit';
  initial?: TaskDraft;
  onSave: (value: TaskDraft) => Promise<void>;
  onClose: () => void;
}) {
  // The caller provides a key when switching between different tasks.
  const [draft, setDraft] = useState<TaskDraft>(initial ?? EMPTY_TASK);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const { ref, onKeyDown } = useModalFocus();

  function patch<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleaned: TaskDraft = { ...draft, title: draft.title.trim(), description: draft.description.trim() };
    if (!cleaned.title || cleaned.title.length > 200) {
      setError('Judul harus berisi 1–200 karakter.'); return;
    }
    if (cleaned.description.length > 2000) {
      setError('Deskripsi maksimal 2000 karakter.'); return;
    }
    if (cleaned.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned.dueDate)) {
      setError('Format tanggal tenggat tidak valid.'); return;
    }
    setError(''); setBusy(true);
    try { await onSave(cleaned); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyimpan tugas.'); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        onKeyDown={(event) => onKeyDown(event, () => { if (!busy) onClose(); })}
      >
        <header className={styles.header}>
          <h2 id={titleId}>{kind === 'create' ? 'Tambah tugas' : 'Edit tugas'}</h2>
          <button type="button" className="button secondary" onClick={onClose} disabled={busy} aria-label="Tutup formulir tugas">Tutup</button>
        </header>
        <form onSubmit={(event) => void submit(event)} className={styles.form}>
          <label className={styles.field}>Judul <span aria-hidden="true">*</span>
            <input value={draft.title} onChange={(event) => patch('title', event.target.value)} maxLength={200} required autoComplete="off" />
          </label>
          <label className={styles.field}>Deskripsi
            <textarea value={draft.description} onChange={(event) => patch('description', event.target.value)} maxLength={2000} rows={4} />
          </label>
          <div className={styles.twoColumns}>
            <label className={styles.field}>Prioritas
              <select value={draft.priority} onChange={(event) => patch('priority', event.target.value as TaskDraft['priority'])}>
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
              </select>
            </label>
            <label className={styles.field}>Tenggat
              <input type="date" value={draft.dueDate} onChange={(event) => patch('dueDate', event.target.value)} />
            </label>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <footer className={styles.footer}>
            <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Batal</button>
            <button className="button" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan tugas'}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function TaskDeleteDialog({
  title, onConfirm, onClose,
}: {
  title: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const { ref, onKeyDown } = useModalFocus();

  async function confirm() {
    if (busy) return;
    setError(''); setBusy(true);
    try { await onConfirm(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menghapus tugas.'); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.dialog} ${styles.smallDialog}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        onKeyDown={(event) => onKeyDown(event, () => { if (!busy) onClose(); })}
      >
        <h2 id={titleId}>Hapus tugas?</h2>
        <p>Anda akan menghapus <strong>{title}</strong>. Tindakan ini tidak dapat dibatalkan.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.footer}>
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Batal</button>
          <button type="button" className="button danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Menghapus…' : 'Ya, hapus'}</button>
        </div>
      </div>
    </div>
  );
}
