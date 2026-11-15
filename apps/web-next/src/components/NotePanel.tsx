'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api, createNoteSchema,
  type ItemResponse, type ListResponse, type Note, type NoteListItem,
} from '@taskapp/contracts';
import { requestJson } from '@/lib/api';
import { NoteDeleteDialog, NoteFormDialog, type NoteDraft } from './NoteDialogs';
import styles from './NotePanel.module.css';

type Result =
  | { key: string; kind: 'list'; items: NoteListItem[]; nextCursor: string | null }
  | { key: string; kind: 'detail'; note: Note }
  | { key: string; kind: 'error'; message: string };

function listUrl(cursor?: string) {
  const qs = new URLSearchParams({ limit: '20' });
  if (cursor) qs.set('cursor', cursor);
  return `${api.notes}?${qs.toString()}`;
}

export function NotePanel({ id }: { id: string | null }) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([id, revision]);
  const [result, setResult] = useState<Result | null>(null);
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');

  const current = result?.key === requestKey ? result : null;
  const items = current?.kind === 'list' ? current.items : null;
  const nextCursor = current?.kind === 'list' ? current.nextCursor : null;
  const note = current?.kind === 'detail' ? current.note : null;
  const error = (actionError?.key === requestKey ? actionError.message : '') ||
    (current?.kind === 'error' ? current.message : '');
  const visible = items?.filter((item) => (`${item.title} ${item.excerpt ?? ''}`).toLocaleLowerCase('id-ID')
    .includes(search.trim().toLocaleLowerCase('id-ID'))).sort((a, b) => Number(b.pinned) - Number(a.pinned)) ?? [];

  // Effects only synchronize with the external API. No synchronous state reset here.
  useEffect(() => {
    const controller = new AbortController();
    if (id) {
      requestJson<ItemResponse<Note>>(api.note(id), { signal: controller.signal })
        .then((response) => { if (!controller.signal.aborted) setResult({ key: requestKey, kind: 'detail', note: response.data }); })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setResult({ key: requestKey, kind: 'error', message: cause instanceof Error ? cause.message : 'Gagal memuat catatan.' });
        });
    } else {
      requestJson<ListResponse<NoteListItem>>(listUrl(), { signal: controller.signal })
        .then((response) => {
          if (!controller.signal.aborted) setResult({ key: requestKey, kind: 'list', items: response.data, nextCursor: response.page?.nextCursor ?? null });
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setResult({ key: requestKey, kind: 'error', message: cause instanceof Error ? cause.message : 'Gagal memuat catatan.' });
        });
    }
    return () => controller.abort();
  }, [id, requestKey]);

  function showError(cause: unknown, fallback: string) {
    setActionError({ key: requestKey, message: cause instanceof Error ? cause.message : fallback });
  }
  function refresh() { setRevision((value) => value + 1); }
  async function create(draft: NoteDraft) {
    const parsed = createNoteSchema.safeParse(draft);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Data catatan tidak valid.');
    try {
      await requestJson(api.notes, { method: 'POST', body: JSON.stringify(parsed.data) });
      setCreateOpen(false);
      refresh();
    } catch (cause) { showError(cause, 'Gagal menyimpan catatan.'); throw cause; }
  }
  async function edit(draft: NoteDraft) {
    if (!note) return;
    const parsed = createNoteSchema.safeParse(draft);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Data catatan tidak valid.');
    try {
      await requestJson(api.note(note.id), { method: 'PATCH', body: JSON.stringify(parsed.data) });
      setEditOpen(false);
      refresh();
    } catch (cause) { showError(cause, 'Gagal memperbarui catatan.'); throw cause; }
  }
  async function togglePin(noteId: string, pinned: boolean) {
    if (busyId) return;
    setBusyId(noteId);
    try {
      await requestJson(api.note(noteId), { method: 'PATCH', body: JSON.stringify({ pinned: !pinned }) });
      refresh();
    } catch (cause) { showError(cause, 'Gagal mengubah status pin.'); }
    finally { setBusyId(null); }
  }
  async function remove() {
    if (!note) return;
    try {
      await requestJson(api.note(note.id), { method: 'DELETE' });
      setDeleteOpen(false);
      router.push('/app/?view=notes');
    } catch (cause) { showError(cause, 'Gagal menghapus catatan.'); throw cause; }
  }
  async function more() {
    if (current?.kind !== 'list' || !nextCursor || loadingMore) return;
    const cursor = nextCursor;
    setMoreError(''); setLoadingMore(true);
    try {
      const response = await requestJson<ListResponse<NoteListItem>>(listUrl(cursor));
      setResult((before) => {
        if (before?.kind !== 'list' || before.key !== requestKey) return before;
        const oldIds = new Set(before.items.map((item) => item.id));
        return {
          key: requestKey, kind: 'list',
          items: [...before.items, ...response.data.filter((item) => !oldIds.has(item.id))],
          nextCursor: response.page?.nextCursor ?? null,
        };
      });
    } catch (cause) { setMoreError(cause instanceof Error ? cause.message : 'Gagal memuat catatan berikutnya.'); }
    finally { setLoadingMore(false); }
  }
  return (
    <section aria-label="Manajemen catatan">
      <div className="section-heading">
        <div><p className="eyebrow">CATATAN PRIBADI</p><h1>{id ? 'Detail catatan' : 'Daftar catatan'}</h1></div>
        {id && <button className="button secondary" type="button" onClick={() => router.push('/app/?view=notes')}>Kembali</button>}
      </div>
      {error && <div className="panel" role="alert"><p className="error">{error}</p>
        <button className="button secondary" type="button" onClick={refresh}>Coba lagi</button></div>}
      {!id ? (
        <>
          <div className={styles.toolbar}>
            <label className={styles.search}>Cari pada catatan yang sudah dimuat
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari judul atau ringkasan" />
            </label>
            <button className="button" type="button" onClick={() => setCreateOpen(true)}>+ Tambah catatan</button>
          </div>
          {!current && !error ? <div className="skeleton tall" role="status" aria-label="Memuat catatan" /> :
            items && visible.length === 0 ? <div className={`panel ${styles.empty}`} role="status">
              <h2>{search ? 'Tidak ada catatan yang cocok' : 'Belum ada catatan'}</h2>
              <p className="muted">{search ? 'Ubah kata kunci pencarian.' : 'Tambahkan catatan pertama Anda.'}</p>
            </div> : items && <>
              <p className="muted" aria-live="polite">Menampilkan {visible.length} dari {items.length} catatan yang dimuat.</p>
              <div className={styles.grid}>
                {visible.map((item) => <article className={`panel ${styles.card}`} key={item.id}>
                  <p className={styles.cardTitle}>{item.title}</p>
                  {item.pinned && <span className={styles.pin}>📌 Disematkan</span>}
                  <p className={styles.excerpt}>{item.excerpt || 'Tidak ada ringkasan'}</p>
                  <div className={styles.cardActions}>
                    <button className="button secondary" type="button" onClick={() => router.push(`/app/?view=notes&id=${encodeURIComponent(item.id)}`)}>Buka</button>
                    <button className="button secondary" type="button" disabled={busyId !== null}
                      onClick={() => void togglePin(item.id, item.pinned)}>{busyId === item.id ? 'Menyimpan…' : item.pinned ? 'Lepas pin' : 'Pin'}</button>
                  </div>
                </article>)}
              </div>
              {moreError && <p className="error" role="alert">{moreError}</p>}
              {nextCursor && <div className={styles.more}><button className="button secondary" type="button" disabled={loadingMore}
                onClick={() => void more()}>{loadingMore ? 'Memuat…' : 'Muat lebih banyak'}</button></div>}
            </>}
        </>
      ) : !note && !error ? <div className="skeleton tall" role="status" aria-label="Memuat detail catatan" /> : note && (
        <div className="panel">
          <h2>{note.title}</h2>
          {note.pinned && <span className={styles.pin}>📌 Disematkan</span>}
          <p className={styles.detail}>{note.body}</p>
          <div className="actions">
            <button className="button secondary" type="button" disabled={busyId !== null} onClick={() => void togglePin(note.id, note.pinned)}>
              {note.pinned ? 'Lepas pin' : 'Sematkan'}
            </button>
            <button className="button secondary" type="button" onClick={() => setEditOpen(true)}>Edit</button>
            <button className="button danger" type="button" onClick={() => setDeleteOpen(true)}>Hapus</button>
          </div>
        </div>
      )}
      {createOpen && !id && <NoteFormDialog kind="create" onSave={create} onClose={() => setCreateOpen(false)} />}
      {editOpen && note && <NoteFormDialog key={note.id} kind="edit" initial={{ title: note.title, body: note.body }}
        onSave={edit} onClose={() => setEditOpen(false)} />}
      {deleteOpen && note && <NoteDeleteDialog title={note.title} onConfirm={remove} onClose={() => setDeleteOpen(false)} />}
    </section>
  );
}
