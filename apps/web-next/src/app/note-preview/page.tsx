'use client';

import { useState } from 'react';
import { NoteDeleteDialog, NoteFormDialog, type NoteDraft } from '@/components/NoteDialogs';
import styles from '@/components/NotePanel.module.css';

type PreviewNote = NoteDraft & { id: string; pinned: boolean };
const INITIAL: PreviewNote[] = [
  { id: 'demo-1', title: 'Rangkuman rapat kelompok', body: 'Samakan kontrak API antara Astro, Next.js, dan Fastify sebelum pengujian integrasi.', pinned: true },
  { id: 'demo-2', title: 'Ide peningkatan UI', body: 'Tambahkan empty state, loading skeleton, modal keyboard-friendly, dan notifikasi yang jelas.', pinned: false },
  { id: 'demo-3', title: 'Checklist presentasi', body: 'Periksa static export, aksesibilitas, dan hasil benchmark bersama Erika.', pinned: false },
];

export default function NotePreviewPage() {
  const [notes, setNotes] = useState<PreviewNote[]>(INITIAL);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showError, setShowError] = useState(false);
  const current = notes.find((note) => note.id === selected) ?? null;
  const filtered = (showEmpty ? [] : notes).filter((note) => (`${note.title} ${note.body}`)
    .toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID')))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  async function save(draft: NoteDraft) {
    if (dialog === 'edit' && current) {
      setNotes((prev) => prev.map((item) => item.id === current.id ? { ...item, ...draft } : item));
    } else {
      const newId = `demo-${Date.now()}`;
      setNotes((prev) => [{ id: newId, pinned: false, ...draft }, ...prev]);
      setShowEmpty(false);
      setSelected(newId);
    }
    setDialog(null);
  }
  async function remove() {
    if (!current) return;
    setNotes((prev) => prev.filter((item) => item.id !== current.id));
    setSelected(null);
    setDialog(null);
  }

  return (
    <main style={{ maxWidth: 1060, margin: '0 auto', padding: '36px 18px' }}>
      <p className="eyebrow">PENGUJIAN UI • TANPA BACKEND</p>
      <h1>Pratinjau Modul Catatan</h1>
      <p className="muted">Data di sini hanya simulasi lokal di browser. Tidak ada data yang dikirim ke Fastify/PostgreSQL.</p>
      <div className="actions">
        <button type="button" className="button secondary" onClick={() => { setSelected(null); setShowEmpty(false); setShowError(false); }}>Daftar</button>
        <button type="button" className="button secondary" onClick={() => { setSelected(null); setShowEmpty(true); setShowError(false); }}>Simulasi kosong</button>
        <button type="button" className="button secondary" onClick={() => { setSelected(null); setShowError(true); }}>Simulasi error</button>
        <button type="button" className="button secondary" onClick={() => { setShowError(false); setShowEmpty(false); }}>Reset tampilan</button>
      </div>
      {showError ? <section className="panel" role="alert">
        <h2>Catatan gagal dimuat</h2><p>Contoh kondisi API belum tersedia.</p>
        <button type="button" className="button" onClick={() => setShowError(false)}>Coba lagi</button>
      </section> : current && !showEmpty ? <section className="panel">
        <button type="button" className="button secondary" onClick={() => setSelected(null)}>Kembali</button>
        <h2 style={{ marginTop: 16 }}>{current.title}</h2>
        {current.pinned && <span className={styles.pin}>📌 Disematkan</span>}
        <p className={styles.detail}>{current.body}</p>
        <div className="actions">
          <button type="button" className="button secondary" onClick={() => setNotes((prev) => prev.map((item) => item.id === current.id ? { ...item, pinned: !item.pinned } : item))}>
            {current.pinned ? 'Lepas pin' : 'Sematkan'}
          </button>
          <button type="button" className="button secondary" onClick={() => setDialog('edit')}>Edit</button>
          <button type="button" className="button danger" onClick={() => setDialog('delete')}>Hapus</button>
        </div>
      </section> : <section>
        <div className={styles.toolbar}>
          <label className={styles.search}>Cari catatan
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari judul atau isi" />
          </label>
          <button type="button" className="button" onClick={() => setDialog('create')}>+ Tambah catatan</button>
        </div>
        {filtered.length === 0 ? <div className={`panel ${styles.empty}`} role="status">
          <h2>Belum ada catatan yang ditampilkan</h2>
          <p className="muted">Tambahkan catatan atau hapus filter untuk melihat data.</p>
        </div> : <div className={styles.grid}>
          {filtered.map((note) => <article className={`panel ${styles.card}`} key={note.id}>
            <p className={styles.cardTitle}>{note.title}</p>
            {note.pinned && <span className={styles.pin}>📌 Disematkan</span>}
            <p className={styles.excerpt}>{note.body.length > 120 ? `${note.body.slice(0, 120)}…` : note.body}</p>
            <div className={styles.cardActions}>
              <button type="button" className="button secondary" onClick={() => setSelected(note.id)}>Buka</button>
              <button type="button" className="button secondary" onClick={() => setNotes((prev) => prev.map((item) => item.id === note.id ? { ...item, pinned: !item.pinned } : item))}>
                {note.pinned ? 'Lepas pin' : 'Pin'}
              </button>
            </div>
          </article>)}
        </div>}
      </section>}
      {dialog === 'create' && <NoteFormDialog kind="create" onSave={save} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && current && <NoteFormDialog key={current.id} kind="edit" initial={{ title: current.title, body: current.body }}
        onSave={save} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && current && <NoteDeleteDialog title={current.title} onConfirm={remove} onClose={() => setDialog(null)} />}
    </main>
  );
}
