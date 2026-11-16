import { DAY_MS, HOUR_MS, MINUTE_MS } from './lib/time';

/** Bindings and vars declared in `wrangler.jsonc`. */
export interface Env {
	DB: D1Database;
	/** Attachment binaries (06 §8.5). Absent only in unit contexts that never upload. */
	BUCKET?: R2Bucket;
	ENVIRONMENT?: string;
	APP_ORIGIN?: string;
	/** Second frontend origin on `*.workers.dev`, where no zone route can share one origin (ADR-05). */
	APP_ORIGIN_NEXT?: string;
	SESSION_TTL_DAYS?: string;
	SESSION_IDLE_HOURS?: string;
	SESSION_REFRESH_MINUTES?: string;
}

export interface Config {
  db: D1Database;
  bucket: R2Bucket;
  isProduction: boolean;
  appOrigin: string;
  nextOrigin: string | null;
  sessionTtlMs: number;
  sessionIdleMs: number;
  sessionRefreshMs: number;
  cookieSecure: boolean;
}
function positiveNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

/** A missing binding is a deployment defect, not a runtime fallback (07 §7.2). */
function missingBinding(name: string): never {
  throw new Error(`${name} binding is required`);
}

/**
 * Fails closed: a missing `APP_ORIGIN` must stop the request, because without it the
 * origin check cannot authorise a single unsafe method (`.planning/07` §6.2).
 */
export function loadConfig(env: Env): Config {
  const appOrigin = env.APP_ORIGIN?.trim();
  if (!appOrigin) {
    throw new Error('APP_ORIGIN is required');
  }
  const isProduction = env.ENVIRONMENT === 'production';
  const nextOrigin = env.APP_ORIGIN_NEXT?.trim().replace(/\/+$/u, '') || null;
  return {
    db: env.DB,
    // Fail closed like APP_ORIGIN: without the bucket every upload would fail at the write.
    bucket: env.BUCKET ?? missingBinding('BUCKET'),
    isProduction,
    appOrigin: appOrigin.replace(/\/+$/u, ''),
    nextOrigin,
    sessionTtlMs: positiveNumber(env.SESSION_TTL_DAYS, 7, 'SESSION_TTL_DAYS') * DAY_MS,
    sessionIdleMs: positiveNumber(env.SESSION_IDLE_HOURS, 24, 'SESSION_IDLE_HOURS') * HOUR_MS,
    sessionRefreshMs:
      positiveNumber(env.SESSION_REFRESH_MINUTES, 60, 'SESSION_REFRESH_MINUTES') * MINUTE_MS,
    cookieSecure: isProduction,
  };
}
