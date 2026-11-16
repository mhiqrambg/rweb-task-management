/**
 * The API contract already carries the /api/v1 prefix.
 * NEXT_PUBLIC_API_ORIGIN must be an origin only (e.g. http://127.0.0.1:8787), no path.
 * For SSG: every private-data request runs in the browser, never at build time, so the
 * static export contains no user data.
 */
import { copy, errorEnvelopeSchema, type ValidationDetail } from '@taskapp/contracts';

const apiOrigin = (process.env.NEXT_PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '');

export const SESSION_EXPIRED_EVENT = 'taskapp:session-expired';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Field-level messages from a 422 envelope; empty for every other status. */
    public readonly details: ValidationDetail[] = [],
  ) {
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

/**
 * Field-level messages of a 422 envelope, parsed with the contract's own detail schema at
 * this untrusted boundary. A malformed detail is ignored, never trusted.
 */
function detailsFromResponse(value: unknown): ValidationDetail[] {
  const envelope = errorEnvelopeSchema.safeParse(value);
  return envelope.success ? envelope.data.error.details : [];
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
    let details: ValidationDetail[] = [];
    try {
      const body: unknown = await response.json();
      message = messageFromResponse(body, fallback);
      details = detailsFromResponse(body);
    } catch {
      // The server may not return JSON.
    }
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(response.status, message, details);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    // The envelope is always JSON; anything else is a broken upstream.
    throw new ApiError(response.status, copy.state.error.body);
  }
  return (await response.json()) as T;
}
