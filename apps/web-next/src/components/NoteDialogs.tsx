'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import styles from './NotePanel.module.css';

export type NoteDraft = { title: string; body: string };

function useDialogFocus() {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    return () => previousFocus?.focus();
  }, []);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, close: () => void) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return { dialogRef, onKeyDown };
}

export function NoteFormDialog({
  kind, initial, onSave, onClose,
}: {
  kind: 'create' | 'edit';
  initial?: NoteDraft;
  onSave: (draft: NoteDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<NoteDraft>(initial ?? { title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingId = useId();
  const { dialogRef, onKeyDown } = useDialogFocus();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleaned = { title: draft.title.trim(), body: draft.body.trim() };
    if (!cleaned.title || cleaned.title.length > 200) {
      setError('Judul harus berisi 1–200 karakter.'); return;
    }
    if (!cleaned.body || cleaned.body.length > 20000) {
      setError('Isi catatan harus berisi 1–20000 karakter.'); return;
    }
    setError(''); setBusy(true);
    try { await onSave(cleaned); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyimpan catatan.'); }
    finally { setBusy(false); }
  }
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} ref={dialogRef}
        onKeyDown={(event) => onKeyDown(event, () => { if (!busy) onClose(); })}>
        <div className={styles.dialogHeader}>
          <h2 id={headingId}>{kind === 'create' ? 'Tambah catatan' : 'Edit catatan'}</h2>
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Tutup</button>
        </div>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label>Judul <input required maxLength={200} value={draft.title}
            onChange={(event) => setDraft((v) => ({ ...v, title: event.target.value }))} /></label>
          <label>Isi catatan <textarea required rows={7} maxLength={20000} value={draft.body}
            onChange={(event) => setDraft((v) => ({ ...v, body: event.target.value }))} /></label>
          <span className={styles.hint}>{draft.body.length.toLocaleString('id-ID')} / 20.000 karakter</span>
          {error && <p className="error" role="alert">{error}</p>}
          <div className={styles.dialogActions}>
            <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Batal</button>
            <button type="submit" className="button" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan catatan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NoteDeleteDialog({ title, onConfirm, onClose }: {
  title: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingId = useId();
  const { dialogRef, onKeyDown } = useDialogFocus();
  async function confirm() {
    if (busy) return;
    setError(''); setBusy(true);
    try { await onConfirm(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menghapus catatan.'); }
    finally { setBusy(false); }
  }
  return (
    <div className={styles.overlay}>
      <div className={`${styles.dialog} ${styles.smallDialog}`} role="alertdialog" aria-modal="true"
        aria-labelledby={headingId} ref={dialogRef}
        onKeyDown={(event) => onKeyDown(event, () => { if (!busy) onClose(); })}>
        <h2 id={headingId}>Hapus catatan?</h2>
        <p>Catatan <strong>{title}</strong> akan dihapus permanen.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className={styles.dialogActions}>
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>Batal</button>
          <button className="button danger" type="button" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Menghapus…' : 'Ya, hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}
