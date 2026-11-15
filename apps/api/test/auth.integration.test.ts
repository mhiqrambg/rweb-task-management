import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { DEFAULT_IP, VALID_PASSWORD, call, registerUser, sidFrom } from './helpers';

const REGISTER = '/api/v1/auth/register';
const LOGIN = '/api/v1/auth/login';
const LOGOUT = '/api/v1/auth/logout';
const ME = '/api/v1/auth/me';

const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

describe('POST /auth/register', () => {
  it('creates the user and a session, with a Secure HttpOnly sid and no secrets in the body', async () => {
    const email = 'happy@example.test';
    const response = await call(REGISTER, {
      body: { email: `  ${email.toUpperCase()} `, password: VALID_PASSWORD },
      ip: '198.51.100.21',
    });

    expect(response.status).toBe(201);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('sid=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=604800');

    const body: unknown = await response.json();
    expect(body).toMatchObject({ data: { user: { email, displayName: 'happy' } } });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(VALID_PASSWORD);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('token');

    const token = sidFrom(response);
    expect(token).toBeTruthy();

    const storedUser = await env.DB.prepare(
      'SELECT password_hash FROM users WHERE email = ?1',
    )
      .bind(email)
      .first<{ password_hash: string }>();
    expect(storedUser?.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(storedUser?.password_hash).not.toContain(VALID_PASSWORD);

    const storedSession = await env.DB.prepare(
      'SELECT s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ?1',
    )
      .bind(email)
      .first<{ token_hash: ArrayBuffer }>();
    const storedHash = new Uint8Array(storedSession?.token_hash ?? new ArrayBuffer(0));
    expect(storedHash.byteLength).toBe(32);
    const presentedHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token ?? '')),
    );
    expect(Array.from(storedHash)).toEqual(Array.from(presentedHash));
  });

  it('rejects an already-registered email as 409, case-insensitively', async () => {
    const email = 'dup@example.test';
    await registerUser(email, { ip: '198.51.100.22' });
    const response = await call(REGISTER, {
      body: { email: email.toUpperCase(), password: VALID_PASSWORD },
      ip: '198.51.100.22',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'CONFLICT', message: 'That email is already registered.' },
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a short password, a malformed email, and an unknown field with contract details', async () => {
    const shortPassword = await call(REGISTER, {
      body: { email: 'short@example.test', password: 'too short' },
      ip: '198.51.100.23',
    });
    expect(shortPassword.status).toBe(422);
    expect(await shortPassword.json()).toMatchObject({
      error: {
        code: 'VALIDATION_FAILED',
        details: [{ field: 'password', code: 'password_policy' }],
      },
    });

    const badEmail = await call(REGISTER, {
      body: { email: 'foo@', password: VALID_PASSWORD },
      ip: '198.51.100.23',
    });
    expect(badEmail.status).toBe(422);
    expect(await badEmail.json()).toMatchObject({
      error: { details: [{ field: 'email', code: 'email_format' }] },
    });

    const unknownField = await call(REGISTER, {
      body: { email: 'unknown@example.test', password: VALID_PASSWORD, userId: 'attacker' },
      ip: '198.51.100.23',
    });
    expect(unknownField.status).toBe(422);
    expect(await unknownField.json()).toMatchObject({
      error: { details: [{ field: 'userId', code: 'unknown_field' }] },
    });

    const created = await env.DB.prepare('SELECT count(*) AS n FROM users WHERE email = ?1')
      .bind('unknown@example.test')
      .first<{ n: number }>();
    expect(created?.n).toBe(0);
  });

  it('enforces the JSON media type and the 256 KiB body limit', async () => {
    const wrongType = await call(REGISTER, {
      rawBody: '{"email":"a@b.test"}',
      contentType: 'application/x-www-form-urlencoded',
      ip: '198.51.100.24',
    });
    expect(wrongType.status).toBe(415);
    expect(await wrongType.json()).toMatchObject({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } });

    const tooLarge = await call(REGISTER, {
      rawBody: `{"email":"a@b.test","password":"${'x'.repeat(300 * 1024)}"}`,
      contentType: 'application/json',
      ip: '198.51.100.24',
    });
    expect(tooLarge.status).toBe(413);
    expect(await tooLarge.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('rate-limits auth mutations to 10 per minute per client IP', async () => {
    const ip = '198.51.100.25';
    const first = await call(REGISTER, {
      body: { email: 'limit0@example.test', password: VALID_PASSWORD },
      ip,
    });
    expect(first.status).toBe(201);

    // The window is epoch-aligned; seed the current one to the limit so the refusal is
    // deterministic instead of depending on where the test starts inside the minute.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const windowStart = nowSeconds - (nowSeconds % 60);
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket, key, window_start, count) VALUES ('auth-ip', ?1, ?2, 10)
       ON CONFLICT (bucket, key, window_start) DO UPDATE SET count = 10`,
    )
      .bind(ip, windowStart)
      .run();

    const limited = await call(REGISTER, {
      body: { email: 'limit1@example.test', password: VALID_PASSWORD },
      ip,
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect(limited.headers.get('x-ratelimit-limit')).toBe('10');
    expect(await limited.json()).toMatchObject({
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' },
    });
  });
});

describe('POST /auth/login', () => {
  it('answers unknown email and wrong password identically', async () => {
    const email = 'enum@example.test';
    await registerUser(email, { ip: '198.51.100.26' });

    const wrongPassword = await call(LOGIN, {
      body: { email, password: 'wrong horse battery' },
      ip: '198.51.100.26',
    });
    const unknownEmail = await call(LOGIN, {
      body: { email: 'nobody@example.test', password: 'wrong horse battery' },
      ip: '198.51.100.26',
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.headers.get('set-cookie')).toBeNull();
    expect(unknownEmail.headers.get('set-cookie')).toBeNull();

    const expected = {
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Invalid email or password.',
        details: [],
      },
    };
    expect(await wrongPassword.json()).toMatchObject(expected);
    expect(await unknownEmail.json()).toMatchObject(expected);
  });

  it('issues a new session and refuses a second login while authenticated', async () => {
    const email = 'second@example.test';
    const { token } = await registerUser(email, { ip: '198.51.100.27' });

    const login = await call(LOGIN, {
      body: { email, password: VALID_PASSWORD },
      ip: '198.51.100.27',
    });
    expect(login.status).toBe(200);
    const loginToken = sidFrom(login);
    if (!loginToken) throw new Error('login issued no sid');
    expect(loginToken).not.toBe(token);

    const second = await call(LOGIN, {
      body: { email, password: VALID_PASSWORD },
      ip: '198.51.100.27',
      cookie: loginToken,
    });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('ignores a client-supplied sid and issues a fresh token (session fixation)', async () => {
    const email = 'fixation@example.test';
    await registerUser(email, { ip: '198.51.100.28' });
    const login = await call(LOGIN, {
      body: { email, password: VALID_PASSWORD },
      ip: '198.51.100.28',
      cookie: 'attacker-chosen-token',
    });

    expect(login.status).toBe(200);
    expect(sidFrom(login)).toBeTruthy();
    expect(sidFrom(login)).not.toBe('attacker-chosen-token');
  });

  it('blocks a sixth attempt for 15 minutes after five failures per (IP, email)', async () => {
    const ip = '198.51.100.29';
    const email = 'gate@example.test';
    await registerUser(email, { ip });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await call(LOGIN, {
        body: { email, password: 'wrong horse battery' },
        ip,
      });
      expect(failed.status).toBe(401);
    }

    const blocked = await call(LOGIN, {
      body: { email, password: VALID_PASSWORD },
      ip,
    });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});

describe('origin integrity', () => {
  it('refuses an unsafe request from a foreign origin', async () => {
    const email = 'origin1@example.test';
    await registerUser(email, { ip: '198.51.100.30' });
    const response = await call(LOGIN, {
      body: { email, password: VALID_PASSWORD },
      ip: '198.51.100.30',
      origin: 'https://evil.example',
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('refuses an unsafe request with no Origin and no same-origin signal', async () => {
    const email = 'origin2@example.test';
    await registerUser(email, { ip: '198.51.100.31' });
    const response = await call(LOGIN, {
      body: { email, password: VALID_PASSWORD },
      ip: '198.51.100.31',
      origin: null,
    });
    expect(response.status).toBe(401);
  });

  it('accepts Sec-Fetch-Site: same-origin when Origin is absent', async () => {
    const email = 'origin3@example.test';
    await registerUser(email, { ip: '198.51.100.32' });
    const response = await call(LOGIN, {
      body: { email, password: VALID_PASSWORD },
      ip: '198.51.100.32',
      origin: null,
      extraHeaders: { 'sec-fetch-site': 'same-origin' },
    });
    expect(response.status).toBe(200);
  });

  it('emits no CORS headers in production', async () => {
    const response = await call('/api/v1/health');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('GET /auth/me and logout', () => {
  it('answers 401 without a cookie and sets nothing', async () => {
    const response = await call(ME);
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toMatchObject({
      error: { code: 'UNAUTHENTICATED', message: 'Your session ended. Log in to continue.' },
    });
  });

  it('clears a presented-but-invalid cookie', async () => {
    const response = await call(ME, { cookie: 'bogus-token' });
    expect(response.status).toBe(401);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('sid=');
    expect(cookie).toContain('Max-Age=0');
  });

  it('returns the session owner and the absolute expiry', async () => {
    const email = 'probe@example.test';
    const { token } = await registerUser(email, { ip: '198.51.100.33' });
    const response = await call(ME, { cookie: token });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { user: { email }, expiresAt: expect.any(String) },
    });
  });

  it('revokes on logout and refuses the replayed cookie', async () => {
    const email = 'logout@example.test';
    const { token } = await registerUser(email, { ip: '198.51.100.34' });

    const logout = await call(LOGOUT, { method: 'POST', cookie: token });
    expect(logout.status).toBe(204);
    expect(await logout.text()).toBe('');
    expect(logout.headers.get('content-type')).toBeNull();
    expect(logout.headers.get('set-cookie') ?? '').toContain('Max-Age=0');

    const replay = await call(ME, { cookie: token });
    expect(replay.status).toBe(401);

    const repeat = await call(LOGOUT, { method: 'POST', cookie: token });
    expect(repeat.status).toBe(401);

    const remaining = await env.DB.prepare(
      'SELECT count(*) AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ?1',
    )
      .bind(email)
      .first<{ n: number }>();
    expect(remaining?.n).toBe(0);
  });

  it('treats logout without a session as already logged out', async () => {
    const response = await call(LOGOUT, { method: 'POST', ip: '198.51.100.35' });
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie') ?? '').toContain('Max-Age=0');
  });

  it('refuses an absolute-expired session', async () => {
    const email = 'absolute@example.test';
    const { token } = await registerUser(email, { ip: '198.51.100.36' });
    await env.DB.prepare(
      'UPDATE sessions SET created_at = ?2, expires_at = ?3 WHERE user_id = (SELECT id FROM users WHERE email = ?1)',
    )
      .bind(email, '2000-01-01T00:00:00.000Z', '2000-01-08T00:00:00.000Z')
      .run();

    const response = await call(ME, { cookie: token });
    expect(response.status).toBe(401);
  });

  it('refuses an idle-expired session', async () => {
    const email = 'idle@example.test';
    const { token } = await registerUser(email, { ip: '198.51.100.37' });
    await env.DB.prepare(
      'UPDATE sessions SET last_used_at = ?2 WHERE user_id = (SELECT id FROM users WHERE email = ?1)',
    )
      .bind(email, isoAgo(25 * 60 * 60 * 1000))
      .run();

    const response = await call(ME, { cookie: token });
    expect(response.status).toBe(401);
  });

  it('refreshes at most hourly and keeps the absolute expiry', async () => {
    const email = 'refresh@example.test';
    const { token } = await registerUser(email, { ip: '198.51.100.38' });
    const stale = isoAgo(2 * 60 * 60 * 1000);
    await env.DB.prepare(
      'UPDATE sessions SET last_used_at = ?2 WHERE user_id = (SELECT id FROM users WHERE email = ?1)',
    )
      .bind(email, stale)
      .run();

    const response = await call(ME, { cookie: token });
    expect(response.status).toBe(200);
    const maxAge = /Max-Age=(\d+)/u.exec(response.headers.get('set-cookie') ?? '')?.[1];
    expect(maxAge).toBeDefined();
    expect(Number(maxAge)).toBeLessThan(604800);
    expect(Number(maxAge)).toBeGreaterThan(0);

    const refreshed = await env.DB.prepare(
      'SELECT s.last_used_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ?1',
    )
      .bind(email)
      .first<{ last_used_at: string }>();
    expect(refreshed?.last_used_at).not.toBe(stale);
  });
});

describe('platform behaviour', () => {
  it('reports readiness without leaking counts or versions', async () => {
    const response = await call('/api/v1/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: 'ok', db: 'ok' } });
  });

  it('answers unknown paths and unsupported methods with 404 NOT_FOUND', async () => {
    const unknown = await call('/api/v1/nope');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: { code: 'NOT_FOUND', details: [] } });

    const wrongMethod = await call(REGISTER);
    expect(wrongMethod.status).toBe(404);
  });

  it('sets the security headers and a request id on every response', async () => {
    const response = await call('/api/v1/health');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('echoes a valid inbound request id and replaces an invalid one', async () => {
    const validId = '3f1c2a9e-7b4d-4c6f-8a1b-2d5e9f0c3a7b';
    const echoed = await call('/api/v1/health', { extraHeaders: { 'x-request-id': validId } });
    expect(echoed.headers.get('x-request-id')).toBe(validId);

    const replaced = await call('/api/v1/health', { extraHeaders: { 'x-request-id': 'nope' } });
    expect(replaced.headers.get('x-request-id')).not.toBe('nope');
    expect(replaced.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it('keeps request bodies out of the stored rate-limit keys', async () => {
    await call(LOGIN, {
      body: { email: 'leak@example.test', password: VALID_PASSWORD },
      ip: DEFAULT_IP,
    });
    const keys = await env.DB.prepare('SELECT key FROM rate_limits').all<{ key: string }>();
    for (const row of keys.results) {
      expect(row.key).not.toContain('leak@example.test');
    }
  });
});
