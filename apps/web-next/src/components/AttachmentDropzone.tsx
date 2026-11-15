'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Image from 'next/image';
import { AttachmentLightbox, type AttachmentImage } from './AttachmentLightbox';
import styles from './AttachmentWidgets.module.css';

export type UploadStatus = 'ready' | 'uploading' | 'success' | 'error';

type PendingImage = {
  id: string;
  file: File;
  url: string;
  status: UploadStatus;
  message?: string;
};

/**
 * Reusable UI only; does not choose/assume an API endpoint.
 * Provide onUpload(file) from the authenticated app once Iqram confirms API contract.
 */
export function AttachmentDropzone({
  onUpload,
  maxFiles = 5,
  maxSizeMB = 5,
  disabled = false,
}: {
  onUpload: (file: File) => Promise<void>;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}) {
  const [entries, setEntries] = useState<PendingImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const createdUrls = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  useEffect(() => {
    const urls = createdUrls.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  }, []);

  const previewImages: AttachmentImage[] = entries.map((entry) => ({
    id: entry.id, name: entry.file.name, url: entry.url,
  }));

  function addFiles(files: File[]) {
    if (disabled || uploadingRef.current || files.length === 0) return;
    const remaining = Math.max(0, maxFiles - entries.length);
    const accepted: PendingImage[] = [];
    const errors: string[] = [];
    const seen = new Set(entries.map((entry) => `${entry.file.name}|${entry.file.size}|${entry.file.lastModified}`));
    for (const file of files) {
      const fileKey = `${file.name}|${file.size}|${file.lastModified}`;
      if (accepted.length >= remaining) { errors.push('Jumlah gambar melebihi batas.'); break; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        errors.push(`${file.name}: hanya JPG, PNG, dan WebP yang diterima.`); continue;
      }
      if (file.size === 0 || file.size > maxSizeMB * 1024 * 1024) {
        errors.push(`${file.name}: ukuran harus lebih dari 0 dan maksimal ${maxSizeMB} MB.`); continue;
      }
      if (seen.has(fileKey)) { errors.push(`${file.name}: gambar sudah dipilih.`); continue; }
      seen.add(fileKey);
      const url = URL.createObjectURL(file);
      createdUrls.current.add(url);
      accepted.push({ id: crypto.randomUUID(), file, url, status: 'ready' });
    }
    setMessage(errors.join(' '));
    if (accepted.length) setEntries((previous) => [...previous, ...accepted]);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files) addFiles(Array.from(event.dataTransfer.files));
  }

  function remove(id: string) {
    if (uploadingRef.current) return;
    const item = entries.find((entry) => entry.id === id);
    if (item) {
      URL.revokeObjectURL(item.url);
      createdUrls.current.delete(item.url);
    }
    // Close lightbox before removing images to avoid index pointing at another entry.
    setLightboxIndex(null);
    setEntries((previous) => previous.filter((entry) => entry.id !== id));
  }

  function mark(id: string, status: UploadStatus, message?: string) {
    setEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, status, message } : entry));
  }

  async function upload(ids?: string[]) {
    if (disabled || uploadingRef.current) return;
    const selected = entries.filter((entry) => ids ? ids.includes(entry.id) : entry.status === 'ready' || entry.status === 'error');
    if (!selected.length) return;
    uploadingRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      for (const entry of selected) {
        mark(entry.id, 'uploading');
        try {
          await onUpload(entry.file);
          mark(entry.id, 'success');
        } catch (cause) {
          mark(entry.id, 'error', cause instanceof Error ? cause.message : 'Unggah gagal.');
        }
      }
    } finally {
      uploadingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label="Unggah lampiran gambar" className={styles.uploadCard}>
      <div className={styles.uploadHead}>
        <div><h2>Tambahkan lampiran</h2><p>Seret gambar ke sini atau pilih dari perangkat.</p></div>
        <span className={styles.limit}>{entries.length}/{maxFiles} gambar</span>
      </div>
      <div
        className={`${styles.dropArea} ${dragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={handleDrop}
      >
        <span aria-hidden="true" className={styles.dropIcon}>▧</span>
        <strong>{dragging ? 'Lepaskan untuk menambahkan gambar' : 'Tarik & lepaskan gambar'}</strong>
        <span className={styles.hint}>JPG, PNG, WebP • maksimal {maxSizeMB} MB per gambar • {maxFiles} gambar</span>
        <button className={styles.selectButton} type="button" disabled={disabled || busy || entries.length >= maxFiles}
          onClick={() => inputRef.current?.click()}>Pilih gambar</button>
        <input ref={inputRef} className={styles.visuallyHidden} type="file"
          accept="image/jpeg,image/png,image/webp" multiple onChange={handleInput}
          disabled={disabled || busy || entries.length >= maxFiles} aria-label="Pilih gambar untuk lampiran" />
      </div>
      {message && <p className={styles.errorText} role="alert">{message}</p>}
      {entries.length > 0 && (
        <>
          <ul className={styles.fileList} aria-label="Daftar gambar yang dipilih">
            {entries.map((entry, index) => (
              <li className={styles.fileRow} key={entry.id}>
                <button type="button" className={styles.previewButton} onClick={() => setLightboxIndex(index)}
                  aria-label={`Perbesar ${entry.file.name}`}>
                  <Image src={entry.url} width={92} height={70} unoptimized alt="" className={styles.previewImage} />
                </button>
                <div className={styles.fileInfo}>
                  <strong title={entry.file.name}>{entry.file.name}</strong>
                  <small>{(entry.file.size / 1024 / 1024).toFixed(2)} MB</small>
                  <span aria-live="polite" className={entry.status === 'error' ? styles.errorText : styles.status}>
                    {entry.status === 'ready' ? 'Siap diunggah' : entry.status === 'uploading' ? 'Sedang mengunggah…' :
                      entry.status === 'success' ? 'Proses unggah berhasil' : `Gagal: ${entry.message ?? 'Kesalahan tidak diketahui'}`}
                  </span>
                </div>
                <div className={styles.fileActions}>
                  {entry.status === 'error' && <button type="button" onClick={() => void upload([entry.id])} disabled={busy} className={styles.smallButton}>Ulangi</button>}
                  <button type="button" onClick={() => remove(entry.id)} disabled={busy} className={styles.smallButton} aria-label={`Hapus pilihan ${entry.file.name}`}>Hapus</button>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.footerActions}>
            <span className={styles.hint}>Gambar hanya dikirim ketika Anda menekan tombol unggah.</span>
            <button className={styles.selectButton} type="button" disabled={disabled || busy || !entries.some(e => e.status === 'ready' || e.status === 'error')}
              onClick={() => void upload()}>{busy ? 'Mengunggah…' : 'Unggah gambar'}</button>
          </div>
        </>
      )}
      {lightboxIndex !== null && previewImages[lightboxIndex] && (
        <AttachmentLightbox images={previewImages} index={lightboxIndex} onChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)} />
      )}
    </section>
  );
}
