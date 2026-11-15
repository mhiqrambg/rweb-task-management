/**
 * Kontrak API sudah mengandung prefix /api/v1.
 * NEXT_PUBLIC_API_ORIGIN harus hanya berupa origin (contoh http://127.0.0.1:3001).
 * Untuk SSG: semua request data pengguna harus dari browser, bukan saat build.
 */
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
  const body = value as { error?: unknown; message?: unknown };
  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  if (typeof body.error === 'object' && body.error !== null) {
    const nested = body.error as { message?: unknown };
    if (typeof nested.message === 'string' && nested.message.trim()) return nested.message;
  }
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
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
    throw new ApiError(
      0,
      'API belum dapat dihubungi. Pastikan API ElysiaJS aktif, alamat API benar, dan CORS mengizinkan frontend.',
    );
  }

  if (!response.ok) {
    const fallback =
      response.status === 401
        ? 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.'
        : `Permintaan gagal (HTTP ${response.status}).`;
    let message = fallback;
    try {
      message = messageFromResponse(await response.json(), fallback);
    } catch {
      // Server mungkin tidak mengembalikan JSON.
    }
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(response.status, 'Server tidak mengembalikan respons JSON sesuai kontrak API.');
  }
  return (await response.json()) as T;
}
