'use client';

import { useEffect, useRef, type KeyboardEvent, type SyntheticEvent } from 'react';
import { copy, fill, formatBytes, formatDimensions, type AttachmentSummary } from '@taskapp/contracts';

/**
 * What a thumbnail or a slide needs. Dashboard lists carry the summary shape (no byte size yet), the
 * detail screens carry the full record, so the size is optional here and rendered only when present.
 */
export type AttachmentView = AttachmentSummary & { sizeBytes?: number };
import { ImageIcon, X } from './icons';

/**
 * C-11 lightbox (FR-ATT-005/006). A native `<dialog>` over the panel with the full-resolution
 * image, its dimensions, a position counter, arrow-key navigation, Escape to close and focus
 * returned to the thumbnail that opened it.
 *
 * The element is `<dialog>` rather than a div so the browser supplies the focus trap, the backdrop
 * and the Escape key — the three behaviours the requirement names. Every string comes from the
 * copy deck; the Astro twin renders the same sentences from the same keys (R-D2).
 */
export function AttachmentLightbox({
  label,
  attachments,
  index,
  onChange,
  onClose,
}: {
  label: string;
  attachments: AttachmentView[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const current = attachments[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      // The browser restores focus on close; this makes the return target explicit.
      openerRef.current?.focus();
    };
  }, []);

  if (!current) return null;

  const position = fill(copy.task.attachments.counter, { index: index + 1, count: attachments.length });
  // FR-ATT-005 names dimensions *and* size, so the caption carries both.
  const caption =
    [formatDimensions(current.width, current.height), current.sizeBytes === undefined ? null : formatBytes(current.sizeBytes)]
      .filter(Boolean)
      .join(' · ') || current.mime;

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'ArrowRight' && index < attachments.length - 1) {
      event.preventDefault();
      onChange(index + 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      onChange(index - 1);
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  return (
    <dialog
      className="lightbox"
      ref={dialogRef}
      aria-label={label}
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
    >
      <div className="lightbox__head">
        <span className="lightbox__counter" data-lightbox-counter aria-live="polite">
          {position}
        </span>
        <button ref={closeRef} type="button" className="icon-btn" onClick={onClose}>
          <X />
          <span className="visually-hidden">{copy.action.close}</span>
        </button>
      </div>

      <figure className="lightbox__figure">
        {/* The full rendition, not the thumbnail (FR-ATT-004). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image cannot optimise, and explicit dimensions are required (R-D5) */}
        <img src={current.fullUrl} alt={position} />
        <figcaption className="lightbox__caption">{caption}</figcaption>
      </figure>

      <div className="lightbox__controls">
        <button
          type="button"
          className="btn"
          data-variant="secondary"
          disabled={index === 0}
          onClick={() => onChange(index - 1)}
        >
          {copy.action.previousImage}
        </button>
        <button
          type="button"
          className="btn"
          data-variant="secondary"
          disabled={index === attachments.length - 1}
          onClick={() => onChange(index + 1)}
        >
          {copy.action.nextImage}
        </button>
      </div>
    </dialog>
  );
}

/**
 * C-10 thumbnails. Detail screens show every attachment; the lightbox reads from this list, so no
 * extra request is made when a preview opens (FR-ATT-005). A failed image degrades to the deck's
 * message instead of an empty box (FR-ATT-010).
 */
export function AttachmentStrip({
  attachments,
  size = 'card',
  overflow = 0,
  onOpen,
  onRemove,
}: {
  attachments: AttachmentView[];
  /** Lists show three 80×60 thumbs; detail screens show every attachment at 208×156 (design/05 §1). */
  size?: 'card' | 'detail';
  overflow?: number;
  onOpen: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  const shown = size === 'detail' ? attachments : attachments.slice(0, 3);
  const hidden = size === 'detail' ? overflow : Math.max(overflow, 0);
  const thumbWidth = size === 'detail' ? 208 : 80;
  const thumbHeight = size === 'detail' ? 156 : 60;
  if (!shown.length) {
    return (
      <p className="muted">
        <ImageIcon size={16} />
        {copy.task.attachments.none}
      </p>
    );
  }

  return (
    <div className="thumbs" data-size={size}>
      {shown.map((attachment, index) => {
        const label = fill(copy.task.attachments.open, {
          index: index + 1,
          count: shown.length,
        });
        const caption =
          [
            formatDimensions(attachment.width, attachment.height),
            attachment.sizeBytes === undefined ? null : formatBytes(attachment.sizeBytes),
          ]
            .filter(Boolean)
            .join(' · ') || attachment.mime;
        return (
          <figure className="thumb-figure" key={attachment.id}>
            <button
              className={size === 'detail' ? 'thumb thumb--detail' : 'thumb'}
              type="button"
              aria-label={label}
              onClick={() => onOpen(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image cannot optimise, and explicit dimensions are required (R-D5) */}
              <img
                src={attachment.thumbUrl}
                alt={label}
                width={thumbWidth}
                height={thumbHeight}
                loading="lazy"
                decoding="async"
              />
            </button>
            {size === 'detail' && onRemove ? (
              <button
                className="thumb-figure__remove"
                type="button"
                onClick={() => onRemove(index)}
              >
                {copy.task.attachments.remove}
              </button>
            ) : null}
            {size === 'detail' ? (
              <figcaption className="thumb-figure__caption">{caption}</figcaption>
            ) : null}
          </figure>
        );
      })}
      {hidden > 0 ? <span className="thumbs__more">{`+${hidden}`}</span> : null}
    </div>
  );
}
