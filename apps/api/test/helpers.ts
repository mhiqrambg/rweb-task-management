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
    body,
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
    ip: options.ip,
  });
  const token = sidFrom(response);
  if (!token) throw new Error(`registration failed: ${response.status} ${await response.text()}`);
  return { token, response };
}
