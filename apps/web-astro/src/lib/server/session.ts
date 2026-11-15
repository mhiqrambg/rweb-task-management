import type { AstroCookies } from 'astro';
import { api, type SessionProbe } from '@taskapp/contracts';
import { request as apiRequest, toResult } from './api';
import { isProduction } from './env';

/**
 * The `sid` cookie is the only session state this app holds (06 §2.1, R-C2).
 *
 * The Astro server never verifies the token itself: it asks the API. This module only moves the
 * cookie between the browser and the API request, and mirrors a `Set-Cookie` the API issued.
 */

export const SESSION_COOKIE = 'sid';
const MAX_AGE_SECONDS = 604800;

/** The raw Cookie header to forward to the API, or null when the browser sent nothing. */
export function cookieHeader(request: Request): string | null {
  return request.headers.get('cookie');
}

export interface SessionState {
  session: SessionProbe | null;
  /** Present when the API answered 401 with an expired `sid` that must be cleared. */
  setCookie: string | null;
}

/** One `GET /auth/me` per request; the page and the shell both read `locals.session`. */
export async function loadSession(request: Request): Promise<SessionState> {
  const raw = await apiRequest({
    method: 'GET',
    path: api.auth.me,
    cookie: cookieHeader(request),
  });
  const result = toResult<SessionProbe>(raw);
  return { session: result.ok ? result.value : null, setCookie: raw.setCookie };
}

/**
 * Copy the API's `Set-Cookie` onto the browser response (06 §2.1).
 *
 * Only `sid` is honoured; attributes the browser must enforce (HttpOnly, SameSite, Secure, Path)
 * are re-stated here instead of being passed through blindly from an upstream header.
 */
export function applySessionCookie(cookies: AstroCookies, header: string | null): void {
  if (!header) return;

  const [pair = '', ...attributes] = header.split(';').map((part) => part.trim());
  const separator = pair.indexOf('=');
  if (separator <= 0) return;

  const name = pair.slice(0, separator);
  if (name !== SESSION_COOKIE) return;

  const value = pair.slice(separator + 1);
  const maxAge = attributes
    .find((attribute) => attribute.toLowerCase().startsWith('max-age='))
    ?.slice('max-age='.length);

  if (maxAge === '0' || value === '') {
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return;
  }

  cookies.set(SESSION_COOKIE, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    maxAge: MAX_AGE_SECONDS,
  });
}
