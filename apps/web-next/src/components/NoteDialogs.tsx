'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  copy, createNoteSchema, fill, parseForm, updateNoteSchema,
} from '@taskapp/contracts';

export type NoteDraft = { title: string; body: string };

/**
 * Native `<dialog>`: the element owns Escape, the backdrop layer and the focus trap.
 * The caller unmounts this component to close, so cleanup closes the element and restores focus.
 */
function useModalDialog() {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    const target = dialog?.querySelector<HTMLElement>('[data-autofocus]');
    target?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return ref;
}

function backdrop(event: MouseEvent<HTMLDialogElement>, close: () => void) {
  if (event.target === event.currentTarget) close();
}

export function NoteFormDialog({
  kind, initial, onSave, onClose,
}: {
  kind: 'create' | 'edit';
  initial?: NoteDraft;
  onSave: (draft: NoteDraft) => Promise<void>;
  onClose: () => void;
}) {
  // The caller keys this component per note, so `initial` never changes underneath the fields.
  const [draft, setDraft] = useState<NoteDraft>(initial ?? { title: '', body: '' });
  const [errors, setErrors] = useState<{ title?: string; body?: string; form?: string }>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const titleErrorId = useId();
  const bodyErrorId = useId();
  const dialogRef = useModalDialog();

  function dismiss() {
    if (!busy) onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleaned: NoteDraft = { title: draft.title.trim(), body: draft.body.trim() };
    const parsed = parseForm(kind === 'create' ? createNoteSchema : updateNoteSchema, cleaned);
    if (!parsed.ok) {
      setErrors({
        title: parsed.errors.title,
        body: parsed.errors.body,
        form: parsed.errors.form,
      });
      setFailure('');
      return;
    }
    setErrors({});
    setFailure('');
    setBusy(true);
    try {
      await onSave(cleaned);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : copy.toast.errorSave);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={headingId}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => backdrop(event, dismiss)}
    >
      <div className="dialog__head">
        <h2 className="dialog__title" id={headingId}>
          {kind === 'create' ? copy.note.new : copy.action.edit}
        </h2>
      </div>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="dialog__body stack">
          <div className="field">
            <label className="field__label" htmlFor={`${headingId}-title`}>{copy.note.field.title}</label>
            <input
              id={`${headingId}-title`}
              className="field__input"
              type="text"
              maxLength={200}
              autoComplete="off"
              data-autofocus
              value={draft.title}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? titleErrorId : undefined}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
            />
            {errors.title && <p className="field__error" id={titleErrorId}>{errors.title}</p>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${headingId}-body`}>{copy.note.field.body}</label>
            <textarea
              id={`${headingId}-body`}
              className="field__input"
              rows={8}
              maxLength={20000}
              value={draft.body}
              aria-invalid={errors.body ? true : undefined}
              aria-describedby={errors.body ? bodyErrorId : undefined}
              onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))}
            />
            <span className="field__count">{`${draft.body.length}/20000`}</span>
            {errors.body && <p className="field__error" id={bodyErrorId}>{errors.body}</p>}
          </div>
          {(errors.form || failure) && (
            <div className="inline-error" role="alert">{errors.form ?? failure}</div>
          )}
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn" data-variant="secondary" disabled={busy} onClick={onClose}>
            {copy.action.cancel}
          </button>
          <button type="submit" className="btn" data-variant="primary" disabled={busy} aria-busy={busy || undefined}>
            {kind === 'create' ? copy.note.new : copy.action.save}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function NoteDeleteDialog({
  title, onConfirm, onClose,
}: {
  title: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const headingId = useId();
  const dialogRef = useModalDialog();

  function dismiss() {
    if (!busy) onClose();
  }

  async function confirm() {
    if (busy) return;
    setFailure('');
    setBusy(true);
    try {
      await onConfirm();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : copy.toast.errorSave);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog--confirm"
      aria-labelledby={headingId}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => backdrop(event, dismiss)}
    >
      <div className="dialog__head">
        <h2 className="dialog__title" id={headingId}>{copy.confirm.deleteNote.title}</h2>
      </div>
      <div className="dialog__body stack">
        <p>{fill(copy.confirm.deleteNote.body, { title })}</p>
        {failure && <div className="inline-error" role="alert">{failure}</div>}
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn" data-variant="secondary" data-autofocus disabled={busy} onClick={onClose}>
          {copy.action.cancel}
        </button>
        <button type="button" className="btn" data-variant="danger" disabled={busy} aria-busy={busy || undefined} onClick={() => void confirm()}>
          {copy.confirm.confirmDelete}
        </button>
      </div>
    </dialog>
  );
}
