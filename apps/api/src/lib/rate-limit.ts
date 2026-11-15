import { COPY } from '@rweb/contracts';
import { ApiError } from './errors';

/**
 * `.planning/07` §8.3, adapted to Workers: isolates share no memory, so the counters live in D1.
 * A window is a fixed epoch-aligned bucket; `count > limit` refuses, and the first refusal is the
 * request that crossed the limit.
 */
export interface RateLimitWindow {
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  window: RateLimitWindow;
}

function windowFor(limit: number, windowSeconds: number, count: number): RateLimitWindow {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % windowSeconds);
  return {
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: windowStart + windowSeconds,
  };
}

async function readCount(
  db: D1Database,
  bucket: string,
  key: string,
  windowStart: number,
): Promise<number> {
  const row = await db
    .prepare(
      'SELECT count FROM rate_limits WHERE bucket = ?1 AND key = ?2 AND window_start = ?3',
    )
    .bind(bucket, key, windowStart)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function consumeRateLimit(
  db: D1Database,
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitOutcome> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % windowSeconds);

  // One round trip: increment then read inside a single D1 batch transaction.
  const [, selected] = await db.batch([
    db
      .prepare(
        `INSERT INTO rate_limits (bucket, key, window_start, count) VALUES (?1, ?2, ?3, 1)
         ON CONFLICT (bucket, key, window_start) DO UPDATE SET count = count + 1`,
      )
      .bind(bucket, key, windowStart),
    db
      .prepare(
        'SELECT count FROM rate_limits WHERE bucket = ?1 AND key = ?2 AND window_start = ?3',
      )
      .bind(bucket, key, windowStart),
  ]);

  const first = selected?.results[0];
  const count =
    first && typeof first === 'object' && 'count' in first && typeof first.count === 'number'
      ? first.count
      : 1;

  const window = windowFor(limit, windowSeconds, count);
  return { allowed: count <= limit, window };
}

/** Counters read without incrementing (the failed-login gate). */
export async function peekRateLimit(
  db: D1Database,
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitOutcome> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % windowSeconds);
  const count = await readCount(db, bucket, key, windowStart);
  return { allowed: count < limit, window: windowFor(limit, windowSeconds, count) };
}

export function rateLimitError(window: RateLimitWindow): ApiError {
  const retryAfter = Math.max(1, window.resetAt - Math.floor(Date.now() / 1000));
  return new ApiError('RATE_LIMITED', COPY.auth.rateLimited, {
    headers: {
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': String(window.limit),
      'X-RateLimit-Remaining': String(window.remaining),
      'X-RateLimit-Reset': String(window.resetAt),
    },
  });
}
