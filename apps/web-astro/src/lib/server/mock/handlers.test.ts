import { describe, expect, it } from 'vitest';
import type { ApiRaw } from '../types';
import { mockRequest } from './handlers';
import { MOCK_PASSWORD, MOCK_SECOND_USER_EMAIL } from './store';

/**
 * The mock is the stand-in for Fastify during P6 (13 §2), so its auth answers must match
 * 06 §5.1-§5.3 exactly: 201 on register, 409 on a taken email, 401 for an unknown session, and
 * one generic message for a wrong password or an unknown email (NFR-SEC-007).
 */

function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  cookie: string | null = null,
  body?: unknown,
): Promise<ApiRaw> {
  return mockRequest(
    body === undefined
      ? { method, path, cookie }
      : { method, path, cookie, body },
  );
}

function errorDetails(raw: ApiRaw): Array<{ field?: string; message: string }> {
  return raw.error?.details ?? [];
}

describe('mock auth', () => {
  it('rejects /auth/me without a session', async () => {
    const raw = await request('GET', '/api/v1/auth/me');

    expect(raw.status).toBe(401);
    expect(raw.error?.code).toBe('UNAUTHENTICATED');
    // Nothing was sent, so there is nothing to clear.
    expect(raw.setCookie).toBeNull();
  });

  it('rejects an unknown session token and clears it', async () => {
    const raw = await request('GET', '/api/v1/auth/me', 'sid=not-a-real-token');

    expect(raw.status).toBe(401);
    expect(raw.error?.code).toBe('UNAUTHENTICATED');
    expect(raw.setCookie).toContain('Max-Age=0');
  });

  it('logs in the seeded account and issues the session cookie', async () => {
    const raw = await request('POST', '/api/v1/auth/login', null, {
      email: 'erika@example.com',
      password: MOCK_PASSWORD,
    });

    expect(raw.status).toBe(200);
    expect(raw.setCookie).toContain('sid=');
    expect(raw.setCookie).toContain('HttpOnly');
    expect(raw.setCookie).toContain('SameSite=Lax');
    expect((raw.data as { user: { email: string } }).user.email).toBe('erika@example.com');
  });

  it('answers a wrong password and an unknown email with the same message', async () => {
    const wrongPassword = await request('POST', '/api/v1/auth/login', null, {
      email: 'erika@example.com',
      password: 'wrong password',
    });
    const unknownEmail = await request('POST', '/api/v1/auth/login', null, {
      email: 'nobody@example.com',
      password: MOCK_PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.error?.message).toBe(unknownEmail.error?.message);
  });

  it('registers a new account with a session', async () => {
    const email = `test-${crypto.randomUUID()}@example.com`;
    const raw = await request('POST', '/api/v1/auth/register', null, {
      email,
      password: MOCK_PASSWORD,
    });

    expect(raw.status).toBe(201);
    expect(raw.setCookie).toContain('sid=');
    expect((raw.data as { user: { email: string } }).user.email).toBe(email);
  });

  it('keeps the second seeded account usable for parity checks', async () => {
    const raw = await request('POST', '/api/v1/auth/login', null, {
      email: MOCK_SECOND_USER_EMAIL,
      password: MOCK_PASSWORD,
    });

    expect(raw.status).toBe(200);
  });

  it('rejects a taken email with a field-level conflict', async () => {
    const raw = await request('POST', '/api/v1/auth/register', null, {
      email: 'erika@example.com',
      password: MOCK_PASSWORD,
    });

    expect(raw.status).toBe(409);
    expect(raw.error?.code).toBe('CONFLICT');
    expect(errorDetails(raw).some((detail) => detail.field === 'email')).toBe(true);
  });

  it('rejects a password shorter than the contract allows', async () => {
    const raw = await request('POST', '/api/v1/auth/register', null, {
      email: `short-${crypto.randomUUID()}@example.com`,
      password: 'short',
    });

    expect(raw.status).toBe(422);
    expect(raw.error?.code).toBe('VALIDATION_FAILED');
    expect(errorDetails(raw).some((detail) => detail.field === 'password')).toBe(true);
  });

  it('clears the cookie on logout and invalidates the token', async () => {
    const login = await request('POST', '/api/v1/auth/login', null, {
      email: 'erika@example.com',
      password: MOCK_PASSWORD,
    });
    const cookie = login.setCookie?.split(';')[0] ?? '';

    const logout = await request('POST', '/api/v1/auth/logout', cookie);
    expect(logout.setCookie).toContain('Max-Age=0');

    const after = await request('GET', '/api/v1/auth/me', cookie);
    expect(after.status).toBe(401);
  });
});
