'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type SyntheticEvent } from 'react';
import {
  copy,
  createTaskSchema,
  fill,
  taskPriorityLabel,
  taskStatusLabel,
  updateTaskSchema,
  type TaskPriority,
  type TaskStatus,
} from '@taskapp/contracts';

export type TaskDraft = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
};

const EMPTY_TASK: TaskDraft = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
};

const FIELD_NAMES = ['title', 'description', 'status', 'priority', 'dueDate'] as const;
const MAX_DESCRIPTION = 5000;

/** The native dialog element supplies the backdrop, Escape handling and focus return. */
function useDialogElement() {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      opener?.focus();
    };
  }, []);

  return ref;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const byField: Record<string, string> = {};
  let form = '';
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && (FIELD_NAMES as readonly string[]).includes(field)) {
      if (!byField[field]) byField[field] = issue.message;
    } else if (!form) {
      form = issue.message;
    }
  }
  return { byField, form };
}

export function TaskFormDialog({
  kind,
  initial,
  onSave,
  onClose,
}: {
  kind: 'create' | 'edit';
  initial?: TaskDraft;
  onSave: (value: TaskDraft) => Promise<void>;
  onClose: () => void;
}) {
  // The caller provides a key when switching between different tasks.
  const [draft, setDraft] = useState<TaskDraft>(initial ?? EMPTY_TASK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const ref = useDialogElement();

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (!busy) onClose();
  }

  function patch<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function errorProps(field: (typeof FIELD_NAMES)[number]) {
    return {
      'aria-invalid': errors[field] ? true : undefined,
      'aria-describedby': errors[field] ? `${baseId}-${field}-error` : undefined,
    } as const;
  }

  function fieldError(field: (typeof FIELD_NAMES)[number]) {
    if (!errors[field]) return null;
    return (
      <p className="field__error" id={`${baseId}-${field}-error`}>
        {errors[field]}
      </p>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleaned: TaskDraft = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      status: draft.status,
      priority: draft.priority,
      dueDate: draft.dueDate,
    };
    const schema = kind === 'create' ? createTaskSchema : updateTaskSchema;
    const parsed = schema.safeParse({
      title: cleaned.title,
      description: cleaned.description,
      status: cleaned.status,
      priority: cleaned.priority,
      dueDate: cleaned.dueDate || (kind === 'create' ? undefined : null),
    });
    if (!parsed.success) {
      const { byField, form } = fieldErrors(parsed.error.issues);
      setErrors(byField);
      setFormError(form);
      return;
    }
    setErrors({});
    setFormError('');
    setBusy(true);
    try {
      await onSave(cleaned);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : copy.error.form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={headingId} onCancel={handleCancel}>
      <div className="dialog__head">
        <h2 className="dialog__title" id={headingId}>
          {kind === 'create' ? copy.task.new : copy.action.edit}
        </h2>
      </div>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="dialog__body stack">
          <div className="field">
            <label className="field__label" htmlFor={`${baseId}-title`}>
              {copy.task.field.title}
            </label>
            <input
              id={`${baseId}-title`}
              className="field__input"
              value={draft.title}
              onChange={(event) => patch('title', event.target.value)}
              maxLength={200}
              autoComplete="off"
              {...errorProps('title')}
            />
            {fieldError('title')}
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${baseId}-description`}>
              {copy.task.field.description}
            </label>
            <textarea
              id={`${baseId}-description`}
              className="field__input"
              value={draft.description}
              onChange={(event) => patch('description', event.target.value)}
              maxLength={MAX_DESCRIPTION}
              rows={4}
              {...errorProps('description')}
            />
            {kind === 'edit' ? (
              <span className="field__count">{`${draft.description.length}/${MAX_DESCRIPTION}`}</span>
            ) : null}
            {fieldError('description')}
          </div>

          <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor={`${baseId}-status`}>
              {copy.task.field.status}
            </label>
            <select
              id={`${baseId}-status`}
              className="field__input"
              value={draft.status}
              onChange={(event) => patch('status', event.target.value as TaskStatus)}
              {...errorProps('status')}
            >
              <option value="todo">{taskStatusLabel('todo')}</option>
              <option value="in_progress">{taskStatusLabel('in_progress')}</option>
              <option value="completed">{taskStatusLabel('completed')}</option>
            </select>
            {fieldError('status')}
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${baseId}-priority`}>
              {copy.task.field.priority}
            </label>
            <select
              id={`${baseId}-priority`}
              className="field__input"
              value={draft.priority}
              onChange={(event) => patch('priority', event.target.value as TaskPriority)}
              {...errorProps('priority')}
            >
              <option value="low">{taskPriorityLabel('low')}</option>
              <option value="medium">{taskPriorityLabel('medium')}</option>
              <option value="high">{taskPriorityLabel('high')}</option>
            </select>
            {fieldError('priority')}
          </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${baseId}-dueDate`}>
              {copy.task.field.dueDate}
            </label>
            <input
              id={`${baseId}-dueDate`}
              className="field__input"
              type="date"
              value={draft.dueDate}
              onChange={(event) => patch('dueDate', event.target.value)}
              {...errorProps('dueDate')}
            />
            {fieldError('dueDate')}
          </div>

          {formError && (
            <p className="inline-error" role="alert">
              {formError}
            </p>
          )}
        </div>

        <div className="dialog__actions">
          <button
            className="btn"
            data-variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            {copy.action.cancel}
          </button>
          <button
            className="btn"
            data-variant="primary"
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {kind === 'create' ? copy.task.new : copy.action.save}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function TaskDeleteDialog({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingId = useId();
  const ref = useDialogElement();

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (!busy) onClose();
  }

  async function confirm() {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.error.form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="dialog dialog--confirm"
      aria-labelledby={headingId}
      onCancel={handleCancel}
    >
      <div className="dialog__head">
        <h2 className="dialog__title" id={headingId}>
          {copy.confirm.deleteTask.title}
        </h2>
      </div>
      <div className="dialog__body stack-sm">
        <p>{fill(copy.confirm.deleteTask.body, { title })}</p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="dialog__actions">
        <button
          className="btn"
          data-variant="secondary"
          type="button"
          autoFocus
          onClick={onClose}
          disabled={busy}
        >
          {copy.action.cancel}
        </button>
        <button
          className="btn"
          data-variant="danger"
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {copy.confirm.confirmDelete}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Inline task editor: the title input takes the title position in the detail header, Save/Cancel sit
 * at the right of it, and the other fields flow below as the metadata and description sections. No
 * modal, so view and edit never render at the same time.
 */
export function TaskInlineEditForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: TaskDraft;
  onCancel: () => void;
  onSave: (value: TaskDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const baseId = useId();

  function patch<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function errorProps(field: (typeof FIELD_NAMES)[number]) {
    return {
      'aria-invalid': errors[field] ? true : undefined,
      'aria-describedby': errors[field] ? `${baseId}-${field}-error` : undefined,
    } as const;
  }

  function fieldError(field: (typeof FIELD_NAMES)[number]) {
    if (!errors[field]) return null;
    return (
      <p className="field__error" id={`${baseId}-${field}-error`}>
        {errors[field]}
      </p>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleaned: TaskDraft = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      status: draft.status,
      priority: draft.priority,
      dueDate: draft.dueDate,
    };
    const parsed = updateTaskSchema.safeParse({
      title: cleaned.title,
      description: cleaned.description,
      status: cleaned.status,
      priority: cleaned.priority,
      dueDate: cleaned.dueDate || null,
    });
    if (!parsed.success) {
      const { byField, form } = fieldErrors(parsed.error.issues);
      setErrors(byField);
      setFormError(form);
      return;
    }
    setErrors({});
    setFormError('');
    setBusy(true);
    try {
      await onSave(cleaned);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : copy.error.form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="task-detail" noValidate onSubmit={(event) => void submit(event)}>
      <header className="detail-head">
        <div className="detail-head__main">
          <div className="detail-edit__title">
            <label className="visually-hidden" htmlFor={`${baseId}-title`}>
              {copy.task.field.title}
            </label>
            <input
              id={`${baseId}-title`}
              className="field__input task-edit__title-input"
              value={draft.title}
              onChange={(event) => patch('title', event.target.value)}
              maxLength={200}
              autoComplete="off"
              disabled={busy}
              {...errorProps('title')}
            />
            {fieldError('title')}
          </div>

          <div className="detail-meta">
            <label className="field detail-meta__field">
              <span className="visually-hidden">{copy.task.field.status}</span>
              <select
                className="field__input"
                name="status"
                value={draft.status}
                onChange={(event) => patch('status', event.target.value as TaskStatus)}
                disabled={busy}
                {...errorProps('status')}
              >
                <option value="todo">{taskStatusLabel('todo')}</option>
                <option value="in_progress">{taskStatusLabel('in_progress')}</option>
                <option value="completed">{taskStatusLabel('completed')}</option>
              </select>
              {fieldError('status')}
            </label>

            <label className="field detail-meta__field">
              <span className="visually-hidden">{copy.task.field.priority}</span>
              <select
                className="field__input"
                name="priority"
                value={draft.priority}
                onChange={(event) => patch('priority', event.target.value as TaskPriority)}
                disabled={busy}
                {...errorProps('priority')}
              >
                <option value="low">{taskPriorityLabel('low')}</option>
                <option value="medium">{taskPriorityLabel('medium')}</option>
                <option value="high">{taskPriorityLabel('high')}</option>
              </select>
              {fieldError('priority')}
            </label>

            <label className="field detail-meta__field">
              <span className="visually-hidden">{copy.task.field.dueDate}</span>
              <input
                className="field__input"
                type="date"
                name="dueDate"
                value={draft.dueDate}
                onChange={(event) => patch('dueDate', event.target.value)}
                disabled={busy}
                {...errorProps('dueDate')}
              />
              {fieldError('dueDate')}
            </label>
          </div>
        </div>

        <div className="detail-head__actions">
          <button
            className="btn"
            data-variant="secondary"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            {copy.action.cancel}
          </button>
          <button
            className="btn"
            data-variant="primary"
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {copy.action.save}
          </button>
        </div>
      </header>

      {formError && (
        <p className="inline-error" role="alert">
          {formError}
        </p>
      )}

      <section className="detail-section">
        <div className="field">
          <label className="field__label" htmlFor={`${baseId}-description`}>
            {copy.task.field.description}
          </label>
          <textarea
            id={`${baseId}-description`}
            className="field__input"
            value={draft.description}
            onChange={(event) => patch('description', event.target.value)}
            maxLength={MAX_DESCRIPTION}
            rows={6}
            disabled={busy}
            {...errorProps('description')}
          />
          <span className="field__count">{`${draft.description.length}/${MAX_DESCRIPTION}`}</span>
          {fieldError('description')}
        </div>
      </section>
    </form>
  );
}
