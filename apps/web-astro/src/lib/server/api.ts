import type { ErrorCode, PageMeta, ValidationDetail } from '@taskapp/contracts';
import { apiBaseUrl, apiMode, appOrigin, isProduction } from './env';
import type { ApiRaw, ApiRequestInput, Failure, Result } from './types';

/**
 * The only place the Astro server talks to the API. Two transports, one contract:
 * - live: fetch to PUBLIC_API_BASE_URL with the browser's `sid` cookie forwarded
 * - mock: the contract-first dummy dataset (see ./mock), same shapes, same status codes
 */

const TIMEOUT_MS = 8000;

interface ApiService {
  fetch: typeof fetch;
}

let apiService: ApiService | null | undefined;

/**
 * The `API` service binding declared in wrangler.jsonc. A Worker cannot fetch another Worker on
 * `workers.dev` (Cloudflare error 1042), so production uses the binding; local dev and the test
 * environment have none and fall back to a public `fetch`.
 *
 * The binding forwards to the production `rweb-api` Worker regardless of what URL is passed to it,
 * so it must only be used when the configured base points at the production origin. A local dev run
 * (`--var PUBLIC_API_BASE_URL:http://localhost:…`) sets the URL but not the binding's destination,
 * so the binding is skipped and a plain fetch is used instead.
 *
 * Dynamic import on purpose: `cloudflare:workers` exists only in the Workers runtime, so a static
 * import would break `astro dev` and Vitest.
 */
async function serviceBinding(): Promise<ApiService | null> {
  // The binding is a production-only path: it forwards to the deployed `rweb-api` Worker, which is
  // the only way to reach another Worker from `*.workers.dev` (Cloudflare error 1042). Under
  // `astro dev` (platformProxy) the binding resolves but its fetch answers a bare 503 with no body
  // — it does not throw, so the plain-fetch fallback below never runs and every auth call failed
  // with the generic "That did not load.". Gating on a production build keeps dev on the plain
  // fetch to whatever `PUBLIC_API_BASE_URL` names (local Worker or the deployed one).
  if (!isProduction()) return null;
  const base = apiBaseUrl();
  if (new URL(base).hostname === 'localhost' || new URL(base).hostname === '127.0.0.1') {
    return null;
  }
  if (apiService !== undefined) return apiService;
  try {
    const runtime = await import('cloudflare:workers');
    apiService = (runtime.env.API as ApiService | undefined) ?? null;
  } catch {
    apiService = null;
  }
  return apiService;
}

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
  // `input.path` is absolute (`/api/v1/...`), and `new URL(abs, base)` discards the base's path.
  // Only its origin is wanted here, so the origin is taken from the configured base and the
  // contract path is appended unchanged.
  const url = `${new URL(apiBaseUrl()).origin}${input.path}`;
  const init: RequestInit = {
    method: input.method,
    headers,
    body: body ?? null,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  // In production the API service binding is the supported path (Cloudflare error 1042: Worker-to-
  // Worker fetch between `*.workers.dev` hosts is blocked). In local `wrangler dev --local` the
  // binding resolves but throws because there is no local `rweb-api` Worker to forward to, so a
  // throw falls through to a plain fetch — production still uses the binding, local dev still works.
  try {
    const service = await serviceBinding();
    response = service ? await service.fetch(url, init) : await fetch(url, init);
  } catch {
    try {
      response = await fetch(url, init);
    } catch {
      return transportFailure();
    }
  }

  const setCookie = response.headers.get('set-cookie');
  if (response.status === 204) {
    return { status: 204, data: null, page: null, setCookie, error: null };
  }

  let payload: unknown;
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
