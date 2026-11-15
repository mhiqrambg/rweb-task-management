import { sessionCookieName } from '@taskapp/contracts';

/** Reads the `sid` value from a `Cookie` header without trusting the rest of it. */
export function readSessionCookie(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== sessionCookieName) continue;
    const raw = part.slice(separator + 1).trim();
    if (raw === '') return undefined;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

/**
 * `HttpOnly; SameSite=Lax; Path=/` and `Secure` in production (FR-AUTH-004).
 * The server never reads the cookie's `Max-Age`; expiry lives on the session row.
 */
export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const attributes = [
    `${sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function clearedSessionCookie(secure: boolean): string {
  const attributes = [
    `${sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}
