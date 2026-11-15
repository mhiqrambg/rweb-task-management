import { defineAction } from 'astro:actions';
import {
  copy,
  loginSchema,
  parseForm,
  registerSchema,
  routes,
  safeNextPath,
  type ValidationDetail,
} from '@taskapp/contracts';
import {
  login as loginWithPassword,
  logout as endSession,
  register as registerAccount,
} from '../lib/server/auth';
import { applySessionCookie, cookieHeader } from '../lib/server/session';

/**
 * Form actions for the auth slice (06 §5.1-§5.3).
 *
 * A non-JS POST re-renders the page with the result; the page reads `Astro.getActionResult` and
 * either redirects (success) or shows the field/form errors with the typed values intact.
 * No endpoint of our own exists, so Astro's own origin check protects every unsafe method.
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
      return success(safeNextPath(text(form, 'next')) ?? routes.account);
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
      return success(safeNextPath(text(form, 'next')) ?? routes.account);
    },
  }),

  logout: defineAction({
    accept: 'form',
    handler: async (_form, context): Promise<FormOutcome> => {
      const { setCookie } = await endSession(cookieHeader(context.request));
      // A 401 means the session was already gone; clearing the cookie is still the right ending.
      applySessionCookie(context.cookies, setCookie);
      return success(`${routes.login}?toast=signedOut`);
    },
  }),
};
