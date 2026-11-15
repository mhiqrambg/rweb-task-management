'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  api,
  copy,
  loginSchema,
  registerSchema,
  routes,
  type ItemResponse,
  type SessionProbe,
} from '@taskapp/contracts';
import { ApiError, requestJson } from '@/lib/api';
import { ListChecks } from '@/components/icons';

type Mode = 'login' | 'register';
type FieldErrors = { email?: string; password?: string };
type Issues = { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };

/** `next` may only point inside the app on this origin (14 §6, session expiry row). */
function safeNextDestination(): string | null {
  const requested = new URLSearchParams(window.location.search).get('next');
  if (!requested) return null;
  try {
    const parsed = new URL(requested, window.location.origin);
    if (
      parsed.origin === window.location.origin &&
      parsed.pathname.startsWith('/b/app/') &&
      !parsed.username &&
      !parsed.password
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // A malformed value falls back to the dashboard.
  }
  return null;
}

function toFieldErrors(error: Issues): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === 'email' || field === 'password') && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/** Astro's `safeNextPath`: a session-expiry return target must be an app-internal path. */
function safeNextParam(value: string | null): boolean {
  if (!value || !value.startsWith('/')) return false;
  return !value.startsWith('//') && !value.startsWith('/_actions') && !value.startsWith('/login');
}

/** C-19 form notice: the Astro login page shows it when `next` is present and nothing failed yet. */
function ExpiredNotice() {
  const search = useSearchParams();
  if (!safeNextParam(search.get('next'))) return null;
  return (
    <p className="inline-error" role="alert">
      {copy.auth.error.sessionExpired}
    </p>
  );
}

function errorCopy(mode: Mode, cause: unknown): { field?: FieldErrors; message?: string } {
  if (!(cause instanceof ApiError)) return { message: copy.error.form };
  switch (cause.status) {
    case 401:
      return { message: copy.auth.error.invalidCredentials };
    case 409:
      // Login while authenticated is a precondition conflict (Q-15), not an email error.
      return mode === 'register' ? { field: { email: copy.auth.error.emailTaken } } : { message: copy.error.form };
    case 429:
      return { message: copy.auth.error.rateLimited };
    default:
      return { message: copy.error.form };
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const passwordHint = mode === 'register' ? copy.auth.hint.password : undefined;
  const passwordDescribedBy =
    [passwordHint ? 'password-hint' : '', fieldErrors.password ? 'password-error' : '']
      .filter(Boolean)
      .join(' ') || undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setAttempted(true);
    setFormError('');
    setFieldErrors({});

    const values = { email: email.trim().toLowerCase(), password };
    const parsed = (mode === 'register' ? registerSchema : loginSchema).safeParse(values);
    if (!parsed.success) {
      // Astro never repopulates the password field, so a failed submit clears it.
      setPassword('');
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setBusy(true);
    try {
      await requestJson(mode === 'register' ? api.auth.register : api.auth.login, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });

      // Both endpoints set the sid cookie; confirm the browser accepted it before leaving.
      await requestJson<ItemResponse<SessionProbe>>(api.auth.me);
      const destination = safeNextDestination();
      if (destination) {
        window.location.assign(destination);
      } else {
        router.replace(`${routes.dashboard}?view=dashboard`);
      }
    } catch (cause) {
      const failure = errorCopy(mode, cause);
      setPassword('');
      if (failure.field) setFieldErrors(failure.field);
      if (failure.message) setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'login' ? copy.auth.login.title : copy.auth.register.title;
  const submitLabel = mode === 'login' ? copy.auth.login.submit : copy.auth.register.submit;
  const crossLink = mode === 'login' ? copy.auth.login.crossLink : copy.auth.register.crossLink;
  const crossHref = mode === 'login' ? routes.register : routes.login;

  return (
    <>
      <a className="skip-link" href="#main">
        {copy.nav.skipToContent}
      </a>

      <header className="m-header">
        <div className="m-header__inner">
          <Link className="wordmark" href={routes.landing}>
            <ListChecks size={20} strokeWidth={1.6} />
            {copy.brand.name}
          </Link>
        </div>
      </header>

      <main id="main" className="auth-main">
        <div className="auth-card">
          <h1 className="auth-card__title">{title}</h1>

          <form className="auth-card__form" onSubmit={submit} noValidate aria-busy={busy}>
            {mode === 'login' && !attempted ? (
              <Suspense fallback={null}>
                <ExpiredNotice />
              </Suspense>
            ) : null}

            {formError ? (
              <p className="inline-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="field">
              <label className="field__label" htmlFor="email">
                {copy.auth.field.email}
              </label>
              <input
                className="field__input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                aria-invalid={fieldErrors.email ? 'true' : undefined}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email ? (
                <p className="field__error" id="email-error" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                {copy.auth.field.password}
              </label>
              <input
                className="field__input"
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
                aria-invalid={fieldErrors.password ? 'true' : undefined}
                aria-describedby={passwordDescribedBy}
              />
              {passwordHint ? (
                <p className="field__hint" id="password-hint">
                  {passwordHint}
                </p>
              ) : null}
              {fieldErrors.password ? (
                <p className="field__error" id="password-error" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <button
              className="btn btn--block"
              type="submit"
              data-variant="primary"
              data-submit=""
              aria-busy={busy ? 'true' : undefined}
              disabled={busy}
            >
              {busy ? <span className="btn__spinner" aria-hidden="true" /> : null}
              {submitLabel}
            </button>
          </form>

          <p className="auth-card__crosslink">
            <Link href={crossHref}>{crossLink}</Link>
          </p>
        </div>
      </main>

      <footer className="m-footer">
        <div className="m-footer__inner">
          <p className="muted footer-blurb">{copy.landing.footerBlurb}</p>
          <nav className="m-footer__links">
            <Link href={routes.landing}>{copy.brand.name}</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
