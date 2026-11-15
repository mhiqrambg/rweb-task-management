import type { ErrorCode, PageMeta, ValidationDetail } from '@taskapp/contracts';
import { apiBaseUrl, apiMode, appOrigin } from './env';
import type { ApiRaw, ApiRequestInput, Failure, Result } from './types';

/**
 * The only place the Astro server talks to the API. Two transports, one contract:
 * - live: fetch to PUBLIC_API_BASE_URL with the browser's `sid` cookie forwarded
 * - mock: the contract-first dummy dataset (see ./mock), same shapes, same status codes
 */

const TIMEOUT_MS = 8000;

export async function request(input: ApiRequestInput): Promise<ApiRaw> {
  if (apiMode() === 'mock') {
    const { mockRequest } = await import('./mock/handlers');
    return mockRequest(input);
  }
  return liveRequest(input);
}

async function liveRequest(input: ApiRequestInput): Promise<ApiRaw> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    origin: appOrigin(),
  };
  if (input.cookie) headers.cookie = input.cookie;

  let body: BodyInit | undefined;
  if (input.form) {
    body = input.form;
  } else if (input.body !== undefined) {
    headers['content-type'] = 'application/json; charset=utf-8';
    body = JSON.stringify(input.body);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${input.path}`, {
      method: input.method,
      headers,
      body: body ?? null,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return transportFailure();
  }

  const setCookie = response.headers.get('set-cookie');
  if (response.status === 204) {
    return { status: 204, data: null, page: null, setCookie, error: null };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const envelope = payload as { error?: ApiRaw['error'] } | null;
    return {
      status: response.status,
      data: null,
      page: null,
      setCookie,
      error: envelope?.error ?? {
        code: 'INTERNAL',
        message: 'That did not load.',
        requestId: response.headers.get('x-request-id') ?? 'unknown',
        details: [],
      },
    };
  }

  const envelope = payload as { data?: unknown; page?: PageMeta } | null;
  return {
    status: response.status,
    data: envelope?.data ?? null,
    page: envelope?.page ?? null,
    setCookie,
    error: null,
  };
}

/** The API is down or unreachable: an error state, never a blank page. */
function transportFailure(): ApiRaw {
  return {
    status: 503,
    data: null,
    page: null,
    setCookie: null,
    error: {
      code: 'INTERNAL',
      message: 'That did not load.',
      requestId: 'transport',
      details: [],
    },
  };
}

export function toResult<T>(raw: ApiRaw): Result<T> {
  if (raw.error) {
    return {
      ok: false,
      status: raw.status,
      code: raw.error.code,
      message: raw.error.message,
      details: raw.error.details ?? [],
    };
  }
  return { ok: true, value: raw.data as T };
}

export function toListResult<T>(raw: ApiRaw): Result<{ items: T[]; page: PageMeta }> {
  if (raw.error) {
    return failureOf(raw);
  }
  return {
    ok: true,
    value: {
      items: (raw.data as T[]) ?? [],
      page: raw.page ?? { limit: 20, nextCursor: null },
    },
  };
}

export function failure(
  status: number,
  code: ErrorCode,
  message: string,
  details: ValidationDetail[] = [],
): Failure {
  return { ok: false, status, code, message, details };
}

function failureOf(raw: Extract<ApiRaw, { error: NonNullable<ApiRaw['error']> }>): Failure {
  return failure(raw.status, raw.error.code, raw.error.message, raw.error.details ?? []);
}
