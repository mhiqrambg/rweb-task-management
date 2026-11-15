'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import styles from './AttachmentWidgets.module.css';

/** Can be a server URL or an ephemeral blob URL in the local preview. */
export type AttachmentImage = {
  id: string;
  name: string;
  url: string;
};

export function AttachmentLightbox({
  images, index, onClose, onChange,
}: {
  images: AttachmentImage[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = images[index];

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  if (!current) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'ArrowRight' && index < images.length - 1) {
      event.preventDefault();
      onChange(index + 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      onChange(index - 1);
    }
    if (event.key === 'Tab' && dialogRef.current) {
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div className={styles.lightboxOverlay} role="presentation">
      <div
        ref={dialogRef}
        className={styles.lightbox}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.lightboxTop}>
          <div className={styles.lightboxTitle}>
            <strong id={titleId}>{current.name}</strong>
            <small>{index + 1} dari {images.length} gambar</small>
          </div>
          <button ref={closeRef} type="button" className={styles.lightboxButton} onClick={onClose}>
            Tutup <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className={styles.lightboxCanvas}>
          <Image
            src={current.url}
            alt={`Pratinjau lampiran ${current.name}`}
            width={1200}
            height={900}
            unoptimized
            className={styles.fullImage}
          />
        </div>
        <nav aria-label="Navigasi gambar" className={styles.lightboxNav}>
          <button className={styles.lightboxButton} type="button" disabled={index === 0}
            onClick={() => onChange(index - 1)}>← Sebelumnya</button>
          <button className={styles.lightboxButton} type="button" disabled={index === images.length - 1}
            onClick={() => onChange(index + 1)}>Berikutnya →</button>
        </nav>
      </div>
    </div>
  );
}

/** Use for attachments returned by a real backend after authentication. */
export function AttachmentGallery({ images }: { images: AttachmentImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  return (
    <section aria-label="Galeri lampiran" className={styles.gallerySection}>
      <div className={styles.galleryHeader}>
        <h2>Lampiran gambar</h2>
        <span>{images.length} gambar</span>
      </div>
      {images.length === 0 ? (
        <p className={styles.hint}>Belum ada gambar yang tersedia.</p>
      ) : (
        <div className={styles.galleryGrid}>
          {images.map((img, i) => (
            <button type="button" key={img.id} className={styles.galleryCard}
              onClick={() => setActiveIndex(i)} aria-label={`Lihat gambar ${img.name}`}>
              <Image src={img.url} width={280} height={200} unoptimized alt={img.name} className={styles.thumbnail} />
              <span title={img.name}>{img.name}</span>
            </button>
          ))}
        </div>
      )}
      {activeIndex !== null && images[activeIndex] && (
        <AttachmentLightbox images={images} index={activeIndex} onChange={setActiveIndex}
          onClose={() => setActiveIndex(null)} />
      )}
    </section>
  );
}
