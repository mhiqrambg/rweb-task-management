'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api, copy, fill, type Attachment } from '@taskapp/contracts';
import { requestJson, ApiError } from '../lib/api';
import { AttachmentLightbox, AttachmentStrip } from './AttachmentLightbox';

const MAX_PER_TARGET = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Images section on task and note detail (FR-ATT-001…010). Thumbnails, the lightbox and the
 * dropzone all read the same `attachments` array the detail response already carries, so opening a
 * preview or removing an image costs no extra read.
 *
 * Uploads are one file per request (D-8) and the row is the commit point, so a rejected file never
 * leaves a half-written attachment behind. Strings are the deck's — this is the React twin of
 * `ThumbStrip.astro` + `Lightbox.astro` and must render the same sentences (R-D2).
 */
export function AttachmentSection({
  target,
  targetId,
  attachments,
  onChanged,
}: {
  target: 'task' | 'note';
  targetId: string;
  attachments: Attachment[];
  onChanged: () => void;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = attachments.length >= MAX_PER_TARGET;

  function rejection(file: File): string {
    if (!ACCEPTED.includes(file.type)) {
      return fill(copy.upload.reject.type, { filename: file.name });
    }
    if (file.size > MAX_BYTES) {
      return fill(copy.upload.reject.size, { filename: file.name });
    }
    if (full) {
      return fill(copy.upload.reject.count, { target, filename: file.name });
    }
    return '';
  }

  async function upload(file: File) {
    const rejected = rejection(file);
    if (rejected) {
      setNotice('');
      setError(rejected);
      return;
    }

    const body = new FormData();
    body.set('targetType', target);
    body.set('targetId', targetId);
    body.set('file', file);

    setError('');
    setNotice('');
    setBusy(true);
    try {
      await requestJson(api.attachments, { method: 'POST', body });
      setNotice(copy.upload.addedSummary.replace('{n}', '1'));
      onChanged();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : copy.state.error.body);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove(attachment: Attachment) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await requestJson(api.attachment(attachment.id), { method: 'DELETE' });
      if (openAt !== null) setOpenAt(null);
      onChanged();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : copy.state.error.body);
    } finally {
      setBusy(false);
    }
  }

  const inputId = `images-${targetId}`;

  return (
    <section className="detail-section" aria-labelledby={`${inputId}-title`}>
      <h2 className="detail-section__title" id={`${inputId}-title`}>
        {copy.task.field.images}
      </h2>

      <AttachmentStrip attachments={attachments} onOpen={setOpenAt} />

      {attachments.length === 0 ? (
        <p className="muted stat__hint">{copy.task.attachments.noneHint}</p>
      ) : null}

      <div className="dropzone">
        <label className="dropzone__label" htmlFor={inputId}>
          {copy.dropzone.idle}
          <span className="visually-hidden">{copy.task.attachments.add}</span>
        </label>
        <p className="dropzone__hint">{fill(copy.dropzone.hint, { target })}</p>

        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="muted stat__hint">{notice}</p> : null}

        <input
          className="visually-hidden"
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          className="btn"
          data-variant="secondary"
          type="button"
          disabled={busy || full}
          onClick={() => inputRef.current?.click()}
        >
          {copy.task.attachments.add}
        </button>
      </div>

      {attachments.length > 0 ? (
        <ul className="attachment-removals">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <button
                className="btn"
                data-variant="danger"
                type="button"
                disabled={busy}
                onClick={() => setPending(attachment)}
              >
                {copy.task.attachments.remove}
                <span className="visually-hidden">
                  {fill(copy.task.attachments.open, {
                    index: attachments.indexOf(attachment) + 1,
                    count: attachments.length,
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {pending ? (
        <RemoveImageDialog
          target={target}
          index={attachments.indexOf(pending) + 1}
          count={attachments.length}
          onConfirm={() => remove(pending)}
          onClose={() => setPending(null)}
        />
      ) : null}

      {openAt !== null && attachments[openAt] ? (
        <AttachmentLightbox
          label={copy.task.field.images}
          attachments={attachments}
          index={openAt}
          onChange={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * C-14 confirm dialog for FR-ATT-007. Cancel is focused by default, so a stray Enter never removes
 * an image, and nothing is requested until the person confirms (FR-UI-007).
 */
function RemoveImageDialog({
  target,
  index,
  count,
  onConfirm,
  onClose,
}: {
  target: 'task' | 'note';
  index: number;
  count: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const headingId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog dialog--confirm"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog__head">
        <h2 className="dialog__title" id={headingId}>
          {copy.confirm.deleteImage.title}
        </h2>
      </div>
      <div className="dialog__body stack">
        <p>{fill(copy.confirm.deleteImage.body, { index, count, target })}</p>
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn" data-variant="secondary" data-autofocus disabled={busy} onClick={onClose}>
          {copy.action.cancel}
        </button>
        <button
          type="button"
          className="btn"
          data-variant="danger"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            void onConfirm().finally(() => {
              setBusy(false);
              onClose();
            });
          }}
        >
          {copy.confirm.confirmDelete}
        </button>
      </div>
    </dialog>
  );
}
