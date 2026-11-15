import { api, type SessionProbe } from '@taskapp/contracts';
import { request as apiRequest, toResult } from './api';
import type { Result } from './types';

/**
 * The four auth endpoints this slice uses (06 §5.1-§5.3). #4 `/auth/me` lives in `session.ts`
 * because every request needs it, not only the auth screens.
 *
 * A session is identified by the `sid` cookie only. `setCookie` is returned next to the result so
 * the caller can mirror it onto the browser response; nothing here touches Astro.
 */

export interface AuthOutcome {
  result: Result<SessionProbe>;
  setCookie: string | null;
}

export async function login(
  cookie: string | null,
  email: string,
  password: string,
): Promise<AuthOutcome> {
  const raw = await apiRequest({
    method: 'POST',
    path: api.auth.login,
    cookie,
    body: { email, password },
  });
  return { result: toResult<SessionProbe>(raw), setCookie: raw.setCookie };
}

export async function register(
  cookie: string | null,
  email: string,
  password: string,
): Promise<AuthOutcome> {
  const raw = await apiRequest({
    method: 'POST',
    path: api.auth.register,
    cookie,
    body: { email, password },
  });
  return { result: toResult<SessionProbe>(raw), setCookie: raw.setCookie };
}

export interface LogoutOutcome {
  result: Result<null>;
  setCookie: string | null;
}

export async function logout(cookie: string | null): Promise<LogoutOutcome> {
  const raw = await apiRequest({
    method: 'POST',
    path: api.auth.logout,
    cookie,
  });
  return { result: toResult<null>(raw), setCookie: raw.setCookie };
}
