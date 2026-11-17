import { exports } from 'cloudflare:workers';

export const TEST_ORIGIN = 'https://app.example.test';
export const VALID_PASSWORD = 'correct horse battery';
export const DEFAULT_IP = '203.0.113.7';

export interface CallOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  /** Set to `null` to omit `Origin` entirely (a non-browser client). */
  origin?: string | null;
  ip?: string;
  cookie?: string;
  contentType?: string;
  extraHeaders?: Record<string, string>;
}

/** One request through the deployed Worker entry, at the real test origin. */
export async function call(path: string, options: CallOptions = {}): Promise<Response> {
  const headers = new Headers(options.extraHeaders);
  const origin = options.origin === undefined ? TEST_ORIGIN : options.origin;
  if (origin !== null) headers.set('origin', origin);
  headers.set('cf-connecting-ip', options.ip ?? DEFAULT_IP);
  if (options.cookie) headers.set('cookie', `sid=${options.cookie}`);

  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  }
  if (options.contentType) {
    headers.set('content-type', options.contentType);
  } else if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  return exports.default.fetch(`${TEST_ORIGIN}${path}`, {
    method: options.method ?? (body === undefined ? 'GET' : 'POST'),
    headers,
    body: body ?? null,
  });
}

export function sidFrom(response: Response): string | undefined {
  const cookie = response.headers.get('set-cookie');
  if (!cookie) return undefined;
  const match = /(?:^|;\s*)sid=([^;]*)/u.exec(cookie);
  return match?.[1] ? match[1] : undefined;
}

export interface RegisteredUser {
  token: string;
  response: Response;
}

export async function registerUser(
  email: string,
  options: { ip?: string; password?: string } = {},
): Promise<RegisteredUser> {
  const response = await call('/api/v1/auth/register', {
    body: { email, password: options.password ?? VALID_PASSWORD },
    ...(options.ip === undefined ? {} : { ip: options.ip }),
  });
  const token = sidFrom(response);
  if (!token) throw new Error(`registration failed: ${response.status} ${await response.text()}`);
  return { token, response };
}

/**
 * A parsed JSON body, decoded once at the boundary. `call()` returns a `Response`, so a test that
 * reads `data` must say what it expects; asserting the shape here keeps the unchecked cast to one
 * named place instead of an inline `(await response.json()) as { … }` at every read.
 */
export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export interface UploadOptions {
  cookie: string;
  targetType: 'task' | 'note';
  targetId: string;
  /** Bytes of the file part. Defaults to a real 1x1 PNG so the sniff and the header parse agree. */
  bytes?: Uint8Array;
  filename?: string;
  /** Client-declared content type. The API judges on bytes, so this is free to lie. */
  contentType?: string;
  ip?: string;
}

/** A valid 1x1 PNG (67 bytes). Gate 1 recognises the signature; gate 2 reads its 1x1 header. */
export const ONE_PIXEL_PNG: Uint8Array = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
);

/** One multipart upload, as the dropzone sends it: exactly one file plus the two target fields. */
export async function upload(
  path: string,
  options: UploadOptions,
): Promise<Response> {
  const form = new FormData();
  form.set('targetType', options.targetType);
  form.set('targetId', options.targetId);
  form.set(
    'file',
    new Blob([options.bytes ?? ONE_PIXEL_PNG], {
      type: options.contentType ?? 'image/png',
    }),
    options.filename ?? 'pixel.png',
  );

  return exports.default.fetch(`${TEST_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      origin: TEST_ORIGIN,
      'cf-connecting-ip': options.ip ?? DEFAULT_IP,
      cookie: `sid=${options.cookie}`,
    },
    body: form,
  });
}
