import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { call, json, registerUser } from './helpers';

/**
 * #5 and #6 (`.planning/06` §5.5-§5.6). The profile is the session's own row: `WHERE id = ?` with the
 * id from the verified session. `displayName` is the only writable field (01 §8), so a body naming
 * anything else must be a 422 rather than a silent no-op.
 */

const ME = '/api/v1/users/me';

interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

interface ErrorBody {
  error: { code: string; message: string; details: Array<{ field: string; code: string }> };
}

describe('GET /api/v1/users/me', () => {
  it('returns the session user and never a credential field', async () => {
    const { token, response } = await registerUser('users-me@example.test', {
      ip: '198.20.0.1',
    });
    const probe = await json<{ data: { user: User } }>(response);

    const mine = await call(ME, { cookie: token, ip: '198.20.0.1' });
    expect(mine.status).toBe(200);

    const body = await json<{ data: User }>(mine);
    expect(body.data.id).toBe(probe.data.user.id);
    expect(body.data.email).toBe('users-me@example.test');
    expect(JSON.stringify(body.data)).not.toMatch(/password|passwordHash|tokenHash/u);
  });

  it('401s without a session', async () => {
    const response = await call(ME, { ip: '198.20.0.2' });
    expect(response.status).toBe(401);
  });

  it('401s a tampered session cookie', async () => {
    const response = await call(ME, {
      cookie: 'not-a-real-token',
      ip: '198.20.0.3',
    });
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/v1/users/me', () => {
  it('updates only the display name and moves updated_at', async () => {
    const { token } = await registerUser('users-patch@example.test', { ip: '198.20.0.4' });

    const before = await env.DB.prepare(
      'SELECT display_name, updated_at FROM users WHERE email = ?1',
    )
      .bind('users-patch@example.test')
      .first<{ display_name: string; updated_at: string }>();

    const updated = await call(ME, {
      method: 'PATCH',
      body: { displayName: 'Erika Nord' },
      cookie: token,
      ip: '198.20.0.4',
    });
    expect(updated.status).toBe(200);
    expect((await json<{ data: User }>(updated)).data.displayName).toBe('Erika Nord');

    const after = await env.DB.prepare(
      'SELECT display_name, email, updated_at FROM users WHERE email = ?1',
    )
      .bind('users-patch@example.test')
      .first<{ display_name: string; email: string; updated_at: string }>();

    expect(after?.display_name).toBe('Erika Nord');
    // The email is the immutable sign-in identity.
    expect(after?.email).toBe('users-patch@example.test');
    expect(after?.updated_at).not.toBe(before?.updated_at);
  });

  it('rejects an unknown field as 422, the mass-assignment guard', async () => {
    const { token } = await registerUser('users-guard@example.test', { ip: '198.20.0.5' });

    for (const body of [
      { email: 'attacker@example.test' },
      { role: 'admin' },
      { status: 'disabled' },
      { displayName: 'Ok', userId: 'someone-else' },
      { displayName: '   ' },
    ]) {
      const rejected = await call(ME, {
        method: 'PATCH',
        body,
        cookie: token,
        ip: '198.20.0.5',
      });
      expect(rejected.status).toBe(422);
      const envelope = await json<ErrorBody>(rejected);
      expect(envelope.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('401s without a session', async () => {
    const response = await call(ME, {
      method: 'PATCH',
      body: { displayName: 'Nope' },
      ip: '198.20.0.6',
    });
    expect(response.status).toBe(401);
  });
});