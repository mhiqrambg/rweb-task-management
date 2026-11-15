/**
 * The one date/number formatter both frontends use (14 §1: a duplicated format helper is
 * forbidden). Values match the design frames: `12 Nov 2026`, `3 hours ago`, `240 KB`.
 */

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

/** `2026-11-12` or an ISO instant → `12 Nov 2026`. */
export function formatDate(value: string): string {
  return DATE.format(toDate(value));
}

/** ISO instant → `3 hours ago`, `yesterday`, `just now`. */
export function formatRelative(value: string, now: Date = new Date()): string {
  const then = toDate(value).getTime();
  const seconds = Math.round((then - now.getTime()) / 1000);
  if (Math.abs(seconds) < 45) return 'just now';
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** A calendar date for tomorrow-free comparisons and the `next 7 days` filter. */
export function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `241172` → `235 KB`. Sizes are never a raw byte count in the interface. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `1600 × 1200` for the lightbox caption. */
export function formatDimensions(width: number | null, height: number | null): string | null {
  if (width === null || height === null) return null;
  return `${width} × ${height}`;
}

function toDate(value: string): Date {
  // A calendar date is UTC midnight by contract (06 §1.5); never shift it into local time.
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}
