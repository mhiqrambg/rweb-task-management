import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { call, json, registerUser } from './helpers';

/**
 * FR-ADMIN-001..007, NFR-SEC-005, R-I1.
 *
 * The admin extension's whole security story is one rule: a caller without `role = 'admin'` gets
 * the same 404 an absent route gives, never 403 (06 §1.9). These tests exercise that gate, the
 * self-lockout guard, immediate session invalidation on disable, and the create/update round trip.
 */

const MEMBERS = '/api/v1/admin/members';
const LOGIN = '/api/v1/auth/login';
const ME = '/api/v1/auth/me';

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `198.19.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
}

interface Member {
  id: string;
  displayName: string;
  email: string;
  role: 'member' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
}

interface MemberPage {
  data: { items: Member[]; nextCursor: string | null; total: number };
}

interface ErrorBody {
  error: { code: string; message: string; details: unknown[] };
}

/**
 * Promotes a fresh account to admin straight in the database. There is no "make me admin" endpoint
 * by design, so a test that needs an admin has to seed one the way a deployment would.
 */
async function promoteToAdmin(userId: string): Promise<void> {
  await env.DB.prepare(`UPDATE users SET role = 'admin' WHERE id = ?1`).bind(userId).run();
}

/** Registers, then promotes, then returns the session token and the member id. */
async function admin(): Promise<{ token: string; ip: string; id: string }> {
  const ip = nextIp();
  const email = `admin-${ip.replaceAll('.', '-')}@example.test`;
  const { token, response } = await registerUser(email, { ip });
  const probe = await json<{ data: { user: { id: string } } }>(response);
  const id = probe.data.user.id;
  await promoteToAdmin(id);
  return { token, ip, id };
}

describe('admin authorization gate', () => {
  it('404s a member session, an anonymous caller is 401, and the body is the shared not-found shape', async () => {
    const memberIp = nextIp();
    const { token } = await registerUser(
      `member-${memberIp.replaceAll('.', '-')}@example.test`,
      { ip: memberIp },
    );

    const anonymous = await call(MEMBERS, { ip: memberIp });
    expect(anonymous.status).toBe(401);

    const member = await call(MEMBERS, { cookie: token, ip: memberIp });
    expect(member.status).toBe(404);

    const unknownRoute = await call('/api/v1/admin/nope', { cookie: token, ip: memberIp });
    expect(unknownRoute.status).toBe(404);

    // The admin route is indistinguishable from a route that does not exist.
    const memberBody = await json<ErrorBody>(member);
    const unknownBody = await json<ErrorBody>(unknownRoute);
    expect(memberBody.error.code).toBe(unknownBody.error.code);
    expect(memberBody.error.message).toBe(unknownBody.error.message);
    expect(memberBody.error.details).toEqual(unknownBody.error.details);
  });

  it('404s every admin write for a member, not just the read', async () => {
    const memberIp = nextIp();
    const { token } = await registerUser(
      `member2-${memberIp.replaceAll('.', '-')}@example.test`,
      { ip: memberIp },
    );

    const create = await call(MEMBERS, {
      body: { displayName: 'x', email: 'x@example.test', temporaryPassword: 'correct horse battery' },
      cookie: token,
      ip: memberIp,
    });
    expect(create.status).toBe(404);

    const patch = await call(`${MEMBERS}/${crypto.randomUUID()}`, {
      method: 'PATCH',
      body: { role: 'admin' },
      cookie: token,
      ip: memberIp,
    });
    expect(patch.status).toBe(404);

    const remove = await call(`${MEMBERS}/${crypto.randomUUID()}`, {
      method: 'DELETE',
      cookie: token,
      ip: memberIp,
    });
    expect(remove.status).toBe(404);
  });

  it('lets an admin read, create, update and delete a member', async () => {
    const { token, ip } = await admin();

    const create = await call(MEMBERS, {
      body: {
        displayName: 'Erika Nord',
        email: 'erika.nord@example.test',
        temporaryPassword: 'correct horse battery',
      },
      cookie: token,
      ip,
    });
    expect(create.status).toBe(201);

    const created = (await json<{ data: Member }>(create)).data;
    expect(created).toMatchObject({
      displayName: 'Erika Nord',
      email: 'erika.nord@example.test',
      role: 'member',
      status: 'active',
    });
    // The temporary password must never be echoed (FR-ADMIN-002).
    expect(JSON.stringify(created)).not.toContain('correct horse battery');
    expect(JSON.stringify(created)).not.toContain('temporaryPassword');

    const list = await call(MEMBERS, { cookie: token, ip });
    expect(list.status).toBe(200);
    const page = await json<MemberPage>(list);
    expect(page.data.items.some((item) => item.id === created.id)).toBe(true);
    expect(page.data.total).toBeGreaterThan(0);

    const patch = await call(`${MEMBERS}/${created.id}`, {
      method: 'PATCH',
      body: { displayName: 'Erika R.', role: 'admin', status: 'disabled' },
      cookie: token,
      ip,
    });
    expect(patch.status).toBe(200);
    expect(await json<{ data: Member }>(patch)).toMatchObject({
      data: { displayName: 'Erika R.', role: 'admin', status: 'disabled' },
    });

    const remove = await call(`${MEMBERS}/${created.id}`, { method: 'DELETE', cookie: token, ip });
    expect(remove.status).toBe(204);
  });

  it('rejects a duplicate email with 409 and an invalid enum with 422', async () => {
    const { token, ip } = await admin();

    const body = {
      displayName: 'Duplicate',
      email: 'dup@example.test',
      temporaryPassword: 'correct horse battery',
    };
    expect((await call(MEMBERS, { body, cookie: token, ip })).status).toBe(201);
    expect((await call(MEMBERS, { body, cookie: token, ip })).status).toBe(409);

    const badRole = await call(MEMBERS, {
      body: { ...body, email: 'other@example.test', role: 'superuser' },
      cookie: token,
      ip,
    });
    expect(badRole.status).toBe(422);

    const unknownField = await call(MEMBERS, {
      body: { ...body, email: 'third@example.test', userId: 'spoof' },
      cookie: token,
      ip,
    });
    expect(unknownField.status).toBe(422);
  });
});

describe('self-lockout and session invalidation', () => {
  it('refuses to demote, disable or delete the caller own account with 409', async () => {
    const { token, ip, id } = await admin();

    const demote = await call(`${MEMBERS}/${id}`, {
      method: 'PATCH',
      body: { role: 'member' },
      cookie: token,
      ip,
    });
    expect(demote.status).toBe(409);

    const disable = await call(`${MEMBERS}/${id}`, {
      method: 'PATCH',
      body: { status: 'disabled' },
      cookie: token,
      ip,
    });
    expect(disable.status).toBe(409);

    const remove = await call(`${MEMBERS}/${id}`, { method: 'DELETE', cookie: token, ip });
    expect(remove.status).toBe(409);

    // A rename of the caller's own account is fine: only demotion and disabling are guarded.
    const rename = await call(`${MEMBERS}/${id}`, {
      method: 'PATCH',
      body: { displayName: 'Renamed' },
      cookie: token,
      ip,
    });
    expect(rename.status).toBe(200);
  });

  it('stops a disabled member session on its very next request and refuses its login', async () => {
    const { token, ip } = await admin();

    const created = await call(MEMBERS, {
      body: {
        displayName: 'To Disable',
        email: 'disable-me@example.test',
        temporaryPassword: 'correct horse battery',
      },
      cookie: token,
      ip,
    });
    const member = (await json<{ data: Member }>(created)).data;

    // The member's own session, obtained the way a person would: log in.
    const login = await call(LOGIN, {
      body: { email: 'disable-me@example.test', password: 'correct horse battery' },
      ip,
    });
    expect(login.status).toBe(200);
    const memberToken = /sid=([^;]*)/u.exec(login.headers.get('set-cookie') ?? '')?.[1];
    expect(memberToken).toBeTruthy();
    // The token is asserted above; narrowing it here keeps `exactOptionalPropertyTypes` honest.
    if (!memberToken) throw new Error('login set no sid cookie');

    const before = await call(ME, { cookie: memberToken, ip });
    expect(before.status).toBe(200);

    const disabled = await call(`${MEMBERS}/${member.id}`, {
      method: 'PATCH',
      body: { status: 'disabled' },
      cookie: token,
      ip,
    });
    expect(disabled.status).toBe(200);

    // FR-ADMIN-004: the existing cookie stops working immediately.
    const after = await call(ME, { cookie: memberToken, ip });
    expect(after.status).toBe(401);

    // And a fresh login is refused with the same generic message as a wrong password.
    const relogin = await call(LOGIN, {
      body: { email: 'disable-me@example.test', password: 'correct horse battery' },
      ip,
    });
    expect(relogin.status).toBe(401);

    // Re-enabling restores login without re-creating the account.
    const enabled = await call(`${MEMBERS}/${member.id}`, {
      method: 'PATCH',
      body: { status: 'active' },
      cookie: token,
      ip,
    });
    expect(enabled.status).toBe(200);
    expect(
      (
        await call(LOGIN, {
          body: { email: 'disable-me@example.test', password: 'correct horse battery' },
          ip,
        })
      ).status,
    ).toBe(200);
  });

  it('filters by role and status, searches by name and email, and pages with a cursor', async () => {
    const { token, ip } = await admin();

    for (const [name, email] of [
      ['Alpha One', 'alpha.one@example.test'],
      ['Beta Two', 'beta.two@example.test'],
      ['Gamma Three', 'gamma.three@example.test'],
    ] as const) {
      await call(MEMBERS, {
        body: { displayName: name, email, temporaryPassword: 'correct horse battery' },
        cookie: token,
        ip,
      });
    }

    const search = await call(`${MEMBERS}?q=beta`, { cookie: token, ip });
    const found = await json<MemberPage>(search);
    expect(found.data.items.map((item) => item.email)).toEqual(['beta.two@example.test']);

    const byRole = await call(`${MEMBERS}?role=member`, { cookie: token, ip });
    const members = await json<MemberPage>(byRole);
    expect(members.data.items.every((item) => item.role === 'member')).toBe(true);

    const byStatus = await call(`${MEMBERS}?status=active`, { cookie: token, ip });
    const active = await json<MemberPage>(byStatus);
    expect(active.data.items.every((item) => item.status === 'active')).toBe(true);

    const firstPage = await call(`${MEMBERS}?limit=2`, { cookie: token, ip });
    const page = await json<MemberPage>(firstPage);
    expect(page.data.items).toHaveLength(2);
    expect(page.data.nextCursor).toBeTruthy();

    const secondPage = await call(`${MEMBERS}?limit=2&cursor=${page.data.nextCursor}`, {
      cookie: token,
      ip,
    });
    const next = await json<MemberPage>(secondPage);
    const firstIds = new Set(page.data.items.map((item) => item.id));
    expect(next.data.items.some((item) => firstIds.has(item.id))).toBe(false);
  });
});