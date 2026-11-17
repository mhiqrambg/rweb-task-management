import { defineAction } from 'astro:actions';
import {
  api,
  copy,
  createNoteSchema,
  createTaskSchema,
  loginSchema,
  parseForm,
  registerSchema,
  routes,
  safeNextPath,
  updateNoteSchema,
  updateTaskSchema,
  type ValidationDetail,
} from '@taskapp/contracts';
import {
  login as loginWithPassword,
  register as registerAccount,
} from '../lib/server/auth';
import { request as apiRequest, toResult } from '../lib/server/api';
import { applySessionCookie, cookieHeader } from '../lib/server/session';

/**
 * Form actions for the auth slice (06 §5.1-§5.3).
 *
 * A non-JS POST re-renders the page with the result; the page reads `Astro.getActionResult` and
 * either redirects (success) or shows the field/form errors with the typed values intact.
 * Logout is the exception: it terminates at the `/logout` endpoint, because the shell layout that
 * carries the form cannot return a response-level redirect.
 */

export interface FormFailure {
  ok: false;
  errors: Record<string, string>;
  message?: string;
}

export interface FormSuccess {
  ok: true;
  redirect: string;
}

export type FormOutcome = FormSuccess | FormFailure;

function success(redirect: string): FormSuccess {
  return { ok: true, redirect };
}

/**
 * Appends a toast marker to a redirect target that may already carry a query string (e.g. a filtered
 * list `?status=todo`), so we never emit a second `?` and break the URL.
 */
function withToast(redirect: string, toast: string): string {
  return `${redirect}${redirect.includes('?') ? '&' : '?'}toast=${toast}`;
}

function failure(errors: Record<string, string> = {}, message?: string): FormFailure {
  return message === undefined ? { ok: false, errors } : { ok: false, errors, message };
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function toFieldErrors(details: ValidationDetail[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const detail of details) {
    if (detail.field && !errors[detail.field]) errors[detail.field] = detail.message;
  }
  return errors;
}

export const server = {
  login: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const parsed = parseForm(loginSchema, {
        email: text(form, 'email'),
        password: text(form, 'password'),
      });
      if (!parsed.ok) return failure(parsed.errors);

      const { result, setCookie } = await loginWithPassword(
        cookieHeader(context.request),
        parsed.value.email,
        parsed.value.password,
      );

      if (!result.ok) {
        // One message for a wrong password and an unknown email (NFR-SEC-007).
        if (result.code === 'UNAUTHENTICATED') {
          return failure({}, copy.auth.error.invalidCredentials);
        }
        if (result.code === 'RATE_LIMITED') {
          return failure({}, copy.auth.error.rateLimited);
        }
        return failure(toFieldErrors(result.details), result.message);
      }

      applySessionCookie(context.cookies, setCookie);
      return success(safeNextPath(text(form, 'next')) ?? routes.dashboard);
    },
  }),

  register: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const parsed = parseForm(registerSchema, {
        email: text(form, 'email'),
        password: text(form, 'password'),
      });
      if (!parsed.ok) return failure(parsed.errors);

      const { result, setCookie } = await registerAccount(
        cookieHeader(context.request),
        parsed.value.email,
        parsed.value.password,
      );

      if (!result.ok) {
        if (result.code === 'CONFLICT') {
          return failure({ email: copy.auth.error.emailTaken });
        }
        if (result.code === 'RATE_LIMITED') {
          return failure({}, copy.auth.error.rateLimited);
        }
        return failure(toFieldErrors(result.details), result.message);
      }

      applySessionCookie(context.cookies, setCookie);
      return success(safeNextPath(text(form, 'next')) ?? routes.dashboard);
    },
  }),

  /* -------------------------------------------------------------- tasks */

  /**
   * Creates a task and lands on its detail page (FR-TASK-020). The owner is never read from the
   * form: the API derives it from the session (FR-TASK-001).
   */
  createTask: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const parsed = parseForm(createTaskSchema, {
        title: text(form, 'title'),
        description: text(form, 'description'),
        status: text(form, 'status'),
        priority: text(form, 'priority'),
        dueDate: text(form, 'dueDate'),
      });
      if (!parsed.ok) return failure(parsed.errors);

      const raw = await apiRequest({
        method: 'POST',
        path: api.tasks,
        cookie: cookieHeader(context.request),
        body: parsed.value,
      });
      const result = toResult<{ id: string }>(raw);
      if (!result.ok) return failure(toFieldErrors(result.details), result.message);

      applySessionCookie(context.cookies, raw.setCookie);
      return success(`${routes.task(result.value.id)}?toast=taskCreated`);
    },
  }),

  /**
   * Saves an edit and returns to the detail page with the changes-saved toast (FR-TASK-006).
   * An absent or foreign id is a 404 from the API and renders as a not-found outcome, never a
   * distinguishable error (FR-TASK-019).
   */
  updateTask: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const id = text(form, 'id');
      const parsed = parseForm(updateTaskSchema, {
        title: text(form, 'title'),
        description: text(form, 'description'),
        status: text(form, 'status'),
        priority: text(form, 'priority'),
        dueDate: text(form, 'dueDate'),
      });
      if (!parsed.ok) return failure(parsed.errors);
      if (!id) return failure({}, copy.state.notFound.body);

      const raw = await apiRequest({
        method: 'PATCH',
        path: api.task(id),
        cookie: cookieHeader(context.request),
        body: parsed.value,
      });
      const result = toResult<unknown>(raw);
      if (!result.ok) {
        if (result.status === 404) return failure({}, copy.state.notFound.body);
        return failure(toFieldErrors(result.details), result.message);
      }

      applySessionCookie(context.cookies, raw.setCookie);
      return success(`${routes.task(id)}?toast=taskSaved`);
    },
  }),

  /** Inline status change from the list or the detail view (FR-TASK-007). */
  setTaskStatus: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const id = text(form, 'id');
      const status = text(form, 'status');
      const back = safeNextPath(text(form, 'next')) ?? routes.tasks;
      if (!id || !status) return failure({}, copy.state.notFound.body);

      const raw = await apiRequest({
        method: 'PATCH',
        path: api.task(id),
        cookie: cookieHeader(context.request),
        body: { status },
      });
      const result = toResult<unknown>(raw);
      if (!result.ok) {
        if (result.status === 404) return failure({}, copy.state.notFound.body);
        return failure({}, result.message);
      }

      applySessionCookie(context.cookies, raw.setCookie);
      return success(withToast(back, 'taskSaved'));
    },
  }),

  /** Delete with a confirmation the form already collected (FR-TASK-021). */
  deleteTask: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const id = text(form, 'id');
      if (!id) return failure({}, copy.state.notFound.body);

      const raw = await apiRequest({
        method: 'DELETE',
        path: api.task(id),
        cookie: cookieHeader(context.request),
      });
      if (raw.error && raw.status !== 404) {
        return failure({}, raw.error.message);
      }

      applySessionCookie(context.cookies, raw.setCookie);
      return success(`${routes.tasks}?toast=taskDeleted`);
    },
  }),

  /* -------------------------------------------------------------- notes */

  createNote: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const parsed = parseForm(createNoteSchema, {
        title: text(form, 'title'),
        body: text(form, 'body'),
        pinned: text(form, 'pinned') === 'on',
      });
      if (!parsed.ok) return failure(parsed.errors);

      const raw = await apiRequest({
        method: 'POST',
        path: api.notes,
        cookie: cookieHeader(context.request),
        body: parsed.value,
      });
      const result = toResult<{ id: string }>(raw);
      if (!result.ok) return failure(toFieldErrors(result.details), result.message);

      applySessionCookie(context.cookies, raw.setCookie);
      return success(`${routes.note(result.value.id)}?toast=noteCreated`);
    },
  }),

  updateNote: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const id = text(form, 'id');
      const parsed = parseForm(updateNoteSchema, {
        title: text(form, 'title'),
        body: text(form, 'body'),
      });
      if (!parsed.ok) return failure(parsed.errors);
      if (!id) return failure({}, copy.state.notFound.body);

      const raw = await apiRequest({
        method: 'PATCH',
        path: api.note(id),
        cookie: cookieHeader(context.request),
        body: parsed.value,
      });
      const result = toResult<unknown>(raw);
      if (!result.ok) {
        if (result.status === 404) return failure({}, copy.state.notFound.body);
        return failure(toFieldErrors(result.details), result.message);
      }

      applySessionCookie(context.cookies, raw.setCookie);
      return success(`${routes.note(id)}?toast=noteSaved`);
    },
  }),

  /** Pin and unpin from either surface; an edit never touches `pinned` (FR-NOTE-006/007). */
  setNotePinned: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const id = text(form, 'id');
      const pinned = text(form, 'pinned') === 'true';
      const back = safeNextPath(text(form, 'next')) ?? routes.notes;
      if (!id) return failure({}, copy.state.notFound.body);

      const raw = await apiRequest({
        method: 'PATCH',
        path: api.note(id),
        cookie: cookieHeader(context.request),
        body: { pinned },
      });
      const result = toResult<unknown>(raw);
      if (!result.ok) {
        if (result.status === 404) return failure({}, copy.state.notFound.body);
        return failure({}, result.message);
      }

      applySessionCookie(context.cookies, raw.setCookie);
      return success(withToast(back, pinned ? 'notePinned' : 'noteUnpinned'));
    },
  }),

  deleteNote: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const id = text(form, 'id');
      if (!id) return failure({}, copy.state.notFound.body);

      const raw = await apiRequest({
        method: 'DELETE',
        path: api.note(id),
        cookie: cookieHeader(context.request),
      });
      if (raw.error && raw.status !== 404) return failure({}, raw.error.message);

      applySessionCookie(context.cookies, raw.setCookie);
      return success(`${routes.notes}?toast=noteDeleted`);
    },
  }),

  /* -------------------------------------------------------------- attachments */

  /**
   * One upload per request, as the contract requires (D-8). The dropzone posts every selected file
   * as its own `uploadAttachment` submission, so one rejection cannot hide another's success
   * (FR-ATT-009) and a retry does not resend the files that already landed.
   */
  uploadAttachment: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const targetId = text(form, 'targetId');
      const targetType = text(form, 'targetType');
      const back = safeNextPath(text(form, 'next')) ?? routes.tasks;
      const file = form.get('file');

      if (!targetId || (targetType !== 'task' && targetType !== 'note')) {
        return failure({}, copy.upload.reject.type);
      }
      if (!(file instanceof File) || file.size === 0) {
        return failure({}, copy.upload.reject.type);
      }

      const body = new FormData();
      body.set('targetType', targetType);
      body.set('targetId', targetId);
      body.set('file', file, file.name);

      const raw = await apiRequest({
        method: 'POST',
        path: api.attachments,
        cookie: cookieHeader(context.request),
        form: body,
      });
      const result = toResult<unknown>(raw);
      if (!result.ok) {
        const detail = result.details[0];
        return failure(
          {},
          detail?.file ? `${detail.message} (${detail.file})` : detail?.message ?? result.message,
        );
      }

      applySessionCookie(context.cookies, raw.setCookie);
      return success(withToast(back, 'imageAdded'));
    },
  }),

  deleteAttachment: defineAction({
    accept: 'form',
    handler: async (form, context): Promise<FormOutcome> => {
      const id = text(form, 'id');
      const back = safeNextPath(text(form, 'next')) ?? routes.tasks;
      if (!id) return failure({}, copy.state.notFound.body);

      const raw = await apiRequest({
        method: 'DELETE',
        path: api.attachment(id),
        cookie: cookieHeader(context.request),
      });
      if (raw.error && raw.status !== 404) return failure({}, raw.error.message);

      applySessionCookie(context.cookies, raw.setCookie);
      return success(withToast(back, 'imageRemoved'));
    },
  }),
};
