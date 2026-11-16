/**
 * The API contract already carries the /api/v1 prefix.
 * NEXT_PUBLIC_API_ORIGIN must be an origin only (e.g. http://127.0.0.1:8787), no path.
 * For SSG: every private-data request runs in the browser, never at build time, so the
 * static export contains no user data.
 */
import { copy } from '@taskapp/contracts';

const apiOrigin = (process.env.NEXT_PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '');

export const SESSION_EXPIRED_EVENT = 'taskapp:session-expired';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageFromResponse(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback;
  if ('error' in value) {
    const error: unknown = value.error;
    if (typeof error === 'string' && error.trim()) return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const nested: unknown = error.message;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }
  if ('message' in value) {
    const message: unknown = value.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, copy.state.error.body);
  }

  if (!response.ok) {
    const fallback =
      response.status === 401 ? copy.auth.error.sessionExpired : `Request failed (HTTP ${response.status}).`;
    let message = fallback;
    try {
      message = messageFromResponse(await response.json(), fallback);
    } catch {
      // The server may not return JSON.
    }
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    // The envelope is always JSON; anything else is a broken upstream.
    throw new ApiError(response.status, copy.state.error.body);
  }
  return (await response.json()) as T;
}
