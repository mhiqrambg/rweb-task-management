import type { AstroCookies } from 'astro';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, applySessionCookie } from './session';

/**
 * The API owns the session; this app only mirrors the `sid` cookie (06 §2.1). A mistake here is
 * either a lost login or a cookie with weaker attributes than 07 §S-03 requires, so the parser is
 * tested directly.
 */

interface CookieCall {
  kind: 'set' | 'delete';
  name: string;
  value: string | null;
  options: Record<string, unknown> | undefined;
}

function recorder(): { cookies: AstroCookies; calls: CookieCall[] } {
  const calls: CookieCall[] = [];
  const cookies = {
    set(name: string, value: string, options?: Record<string, unknown>) {
      calls.push({ kind: 'set', name, value, options });
    },
    delete(name: string, options?: Record<string, unknown>) {
      calls.push({ kind: 'delete', name, value: null, options });
    },
  } as unknown as AstroCookies;
  return { cookies, calls };
}

describe('applySessionCookie', () => {
  it('mirrors a set-cookie with the attributes the browser must enforce', () => {
    const { cookies, calls } = recorder();

    applySessionCookie(cookies, 'sid=abc123; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800');

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call).toBeDefined();
    expect(call?.kind).toBe('set');
    expect(call?.name).toBe(SESSION_COOKIE);
    expect(call?.value).toBe('abc123');
    expect(call?.options).toMatchObject({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 604800,
    });
  });

  it('clears the cookie when the API expires it', () => {
    const { cookies, calls } = recorder();

    applySessionCookie(cookies, 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

    expect(calls).toEqual([{ kind: 'delete', name: SESSION_COOKIE, value: null, options: { path: '/' } }]);
  });

  it('clears the cookie when the value is empty even without Max-Age', () => {
    const { cookies, calls } = recorder();

    applySessionCookie(cookies, 'sid=');

    expect(calls[0]?.kind).toBe('delete');
  });

  it('ignores another cookie and a malformed header', () => {
    const { cookies, calls } = recorder();

    applySessionCookie(cookies, 'theme=dark; Path=/');
    applySessionCookie(cookies, 'novalue');

    expect(calls).toHaveLength(0);
  });

  it('does nothing when the API sent no Set-Cookie', () => {
    const { cookies, calls } = recorder();

    applySessionCookie(cookies, null);

    expect(calls).toHaveLength(0);
  });
});
