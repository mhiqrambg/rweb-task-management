export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** `YYYY-MM-DDTHH:mm:ss.sssZ` — text ordering equals time ordering, in D1 and in JS. */
export function isoFrom(ms: number): string {
  return new Date(ms).toISOString();
}

export function nowMs(): number {
  return Date.now();
}
