import { describe, expect, it } from 'vitest';
import { call, registerUser } from './helpers';

const NOTES = '/api/v1/notes';
const DASHBOARD = '/api/v1/dashboard';

async function createNote(token: string, body: unknown, ip = '198.51.100.71') {
  return call(NOTES, { body, cookie: token, ip });
}

async function noteId(token: string, body: unknown, ip = '198.51.100.71'): Promise<string> {
  const created = await createNote(token, body, ip);
  if (created.status !== 201) throw new Error(`note creation failed: ${created.status} ${await created.text()}`);
  return ((await created.json()) as { data: { id: string } }).data.id;
}

describe('POST /api/v1/notes', () => {
  it('creates a note with pinned false by default, 201 and Location', async () => {
    const { token } = await registerUser('notes-create@example.test', { ip: '198.51.100.71' });
    const response = await createNote(token, { title: 'Milk', body: 'Two litres' });
    expect(response.status).toBe(201);
    expect(response.headers.get('location') ?? '').toMatch(/^\/api\/v1\/notes\//);
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ title: 'Milk', body: 'Two litres', pinned: false });
    expect(body.data.attachments).toEqual([]);
    expect(typeof body.data.id).toBe('string');
    expect(body.data.createdAt).toBe(body.data.updatedAt);
  });

  it('accepts pinned true and rejects a blank title, blank body, or unknown field as 422', async () => {
    const { token } = await registerUser('notes-invalid@example.test', { ip: '198.51.100.72' });
    const pinned = await createNote(token, { title: 'Pinned', body: 'kept', pinned: true }, '198.51.100.72');
    expect(pinned.status).toBe(201);
    expect(((await pinned.json()) as { data: { pinned: boolean } }).data.pinned).toBe(true);

    for (const bad of [{ title: '   ', body: 'x' }, { title: 'x', body: '  ' }, { title: 'x', body: 'y', userId: 'nope' }]) {
      const rejected = await createNote(token, bad, '198.51.100.72');
      expect(rejected.status).toBe(422);
    }
  });

  it('requires a session as 401', async () => {
    const response = await call(NOTES, { body: { title: 'nope', body: 'nope' }, ip: '198.51.100.73' });
    expect(response.status).toBe(401);
  });
});

describe('GET /api/v1/notes', () => {
  it('lists pinned first by default and round-trips a cursor without repeats or omissions', async () => {
    const { token } = await registerUser('notes-list@example.test', { ip: '198.51.100.81' });
    await noteId(token, { title: 'alpha', body: 'a' }, '198.51.100.81');
    await noteId(token, { title: 'beta', body: 'b' }, '198.51.100.81');
    await noteId(token, { title: 'gamma', body: 'c', pinned: true }, '198.51.100.81');

    const all = await call(NOTES, { cookie: token, ip: '198.51.100.81' });
    expect(all.status).toBe(200);
    const allBody = (await all.json()) as { data: Array<{ title: string; pinned: boolean }>; page: { limit: number } };
    expect(allBody.data[0]).toMatchObject({ title: 'gamma', pinned: true });
    expect(allBody.page.limit).toBe(20);

    const first = await call(`${NOTES}?limit=2`, { cookie: token, ip: '198.51.100.81' });
    const firstBody = (await first.json()) as { data: Array<{ title: string }>; page: { nextCursor: string | null } };
    expect(firstBody.data).toHaveLength(2);
    expect(typeof firstBody.page.nextCursor).toBe('string');

    const second = await call(
      `${NOTES}?limit=2&cursor=${encodeURIComponent(firstBody.page.nextCursor as string)}`,
      { cookie: token, ip: '198.51.100.81' },
    );
    const secondBody = (await second.json()) as { data: Array<{ title: string }>; page: { nextCursor: string | null } };
    expect(secondBody.page.nextCursor).toBeNull();
    const seen = [...firstBody.data, ...secondBody.data].map((row) => row.title).sort();
    expect(seen).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('filters by pinned and searches the body, and scopes to the session user', async () => {
    const { token: owner } = await registerUser('notes-filter-owner@example.test', { ip: '198.51.100.82' });
    const { token: stranger } = await registerUser('notes-filter-stranger@example.test', { ip: '198.51.100.83' });
    await noteId(owner, { title: 'shopping', body: 'milk and bread' }, '198.51.100.82');
    await noteId(owner, { title: 'ideas', body: 'write the report', pinned: true }, '198.51.100.82');

    const search = await call(`${NOTES}?q=bread`, { cookie: owner, ip: '198.51.100.82' });
    const searchBody = (await search.json()) as { data: Array<{ title: string }> };
    expect(searchBody.data.map((row) => row.title)).toEqual(['shopping']);

    const pinned = await call(`${NOTES}?pinned=true`, { cookie: owner, ip: '198.51.100.82' });
    const pinnedBody = (await pinned.json()) as { data: Array<{ title: string }> };
    expect(pinnedBody.data.map((row) => row.title)).toEqual(['ideas']);

    const unpinned = await call(`${NOTES}?pinned=false`, { cookie: owner, ip: '198.51.100.82' });
    const unpinnedBody = (await unpinned.json()) as { data: Array<{ title: string }> };
    expect(unpinnedBody.data.map((row) => row.title)).toEqual(['shopping']);

    const foreign = await call(NOTES, { cookie: stranger, ip: '198.51.100.83' });
    const foreignBody = (await foreign.json()) as { data: unknown[] };
    expect(foreignBody.data).toEqual([]);
  });

  it('computes the excerpt as the first 160 chars of the body with whitespace collapsed', async () => {
    const { token } = await registerUser('notes-excerpt@example.test', { ip: '198.51.100.84' });
    const body = `${'a'.repeat(150)}\n\n${'b'.repeat(100)}`;
    await noteId(token, { title: 'long', body }, '198.51.100.84');

    const response = await call(NOTES, { cookie: token, ip: '198.51.100.84' });
    const listed = (await response.json()) as { data: Array<{ excerpt: string }> };
    expect(listed.data[0]?.excerpt).toBe(`${'a'.repeat(150)} ${'b'.repeat(8)}`);
  });

  it('rejects bad grammar as 422', async () => {
    const { token } = await registerUser('notes-grammar@example.test', { ip: '198.51.100.85' });
    for (const bad of [
      `${NOTES}?pinned=maybe`,
      `${NOTES}?sort=title`,
      `${NOTES}?sort=-pinned,-pinned`,
      `${NOTES}?sort=-pinned,-updated_at,-created_at`,
      `${NOTES}?limit=0`,
      `${NOTES}?limit=101`,
      `${NOTES}?cursor=short`,
      `${NOTES}?q=a&q=b`,
      `${NOTES}?pinned=true&pinned=false`,
    ]) {
      const rejected = await call(bad, { cookie: token, ip: '198.51.100.85' });
      expect(rejected.status, bad).toBe(422);
    }
  });

  it('sorts by created_at when asked and rejects a cursor minted for another sort', async () => {
    const { token } = await registerUser('notes-sort@example.test', { ip: '198.51.100.86' });
    await noteId(token, { title: 'one', body: '1' }, '198.51.100.86');
    await noteId(token, { title: 'two', body: '2' }, '198.51.100.86');

    const created = await call(`${NOTES}?sort=created_at&limit=1`, { cookie: token, ip: '198.51.100.86' });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { page: { nextCursor: string | null } };
    expect(typeof createdBody.page.nextCursor).toBe('string');

    const mismatched = await call(
      `${NOTES}?sort=-updated_at&cursor=${encodeURIComponent(createdBody.page.nextCursor as string)}`,
      { cookie: token, ip: '198.51.100.86' },
    );
    expect(mismatched.status).toBe(422);
  });
});

describe('GET /api/v1/notes/:id', () => {
  it('returns the full body and 404s a foreign id identically to a missing one', async () => {
    const { token: owner } = await registerUser('notes-owner@example.test', { ip: '198.51.100.91' });
    const { token: stranger } = await registerUser('notes-stranger@example.test', { ip: '198.51.100.92' });
    const long = 'line one\nline two';
    const id = await noteId(owner, { title: 'secret', body: long }, '198.51.100.91');

    const own = await call(`${NOTES}/${id}`, { cookie: owner, ip: '198.51.100.91' });
    expect(own.status).toBe(200);
    const ownBody = (await own.json()) as { data: { body: string } };
    expect(ownBody.data.body).toBe(long);

    const foreign = await call(`${NOTES}/${id}`, { cookie: stranger, ip: '198.51.100.92' });
    expect(foreign.status).toBe(404);
    const missing = await call(`${NOTES}/00000000-0000-4000-8000-000000000000`, { cookie: stranger, ip: '198.51.100.92' });
    expect(missing.status).toBe(404);
    const foreignBody = (await foreign.json()) as { error: { code: string } };
    const missingBody = (await missing.json()) as { error: { code: string } };
    expect(foreignBody.error.code).toBe(missingBody.error.code);
  });
});

describe('PATCH /api/v1/notes/:id', () => {
  it('edits title/body without changing pinned, and toggles pinned alone', async () => {
    const { token } = await registerUser('notes-patch@example.test', { ip: '198.51.100.101' });
    const id = await noteId(token, { title: 'draft', body: 'first', pinned: true }, '198.51.100.101');

    const edited = await call(`${NOTES}/${id}`, {
      method: 'PATCH',
      body: { title: 'final', body: 'second' },
      cookie: token,
      ip: '198.51.100.101',
    });
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as { data: Record<string, unknown> }).data).toMatchObject({
      title: 'final',
      body: 'second',
      pinned: true,
    });

    const before = await call(`${NOTES}/${id}`, { cookie: token, ip: '198.51.100.101' });
    expect(before.status).toBe(200);

    const unpinned = await call(`${NOTES}/${id}`, {
      method: 'PATCH',
      body: { pinned: false },
      cookie: token,
      ip: '198.51.100.101',
    });
    expect(unpinned.status).toBe(200);
    const unpinnedBody = (await unpinned.json()) as { data: { pinned: boolean; title: string } };
    expect(unpinnedBody.data.pinned).toBe(false);
    expect(unpinnedBody.data.title).toBe('final');

    const list = await call(`${NOTES}?sort=-pinned`, { cookie: token, ip: '198.51.100.101' });
    const listBody = (await list.json()) as { data: Array<{ pinned: boolean }> };
    expect(listBody.data.every((row) => !row.pinned)).toBe(true);
  });

  it('404s a foreign id and 422s an empty patch', async () => {
    const { token: owner } = await registerUser('notes-patch-owner@example.test', { ip: '198.51.100.102' });
    const { token: stranger } = await registerUser('notes-patch-stranger@example.test', { ip: '198.51.100.103' });
    const id = await noteId(owner, { title: 'mine', body: 'text' }, '198.51.100.102');

    const foreign = await call(`${NOTES}/${id}`, {
      method: 'PATCH',
      body: { pinned: true },
      cookie: stranger,
      ip: '198.51.100.103',
    });
    expect(foreign.status).toBe(404);

    const empty = await call(`${NOTES}/${id}`, { method: 'PATCH', body: {}, cookie: owner, ip: '198.51.100.102' });
    expect(empty.status).toBe(422);
  });
});

describe('DELETE /api/v1/notes/:id', () => {
  it('deletes once as 204, then 404s the repeat and a foreign id', async () => {
    const { token: owner } = await registerUser('notes-delete-owner@example.test', { ip: '198.51.100.111' });
    const { token: stranger } = await registerUser('notes-delete-stranger@example.test', { ip: '198.51.100.112' });
    const id = await noteId(owner, { title: 'ephemeral', body: 'gone soon' }, '198.51.100.111');

    const foreign = await call(`${NOTES}/${id}`, { method: 'DELETE', cookie: stranger, ip: '198.51.100.112' });
    expect(foreign.status).toBe(404);

    const deleted = await call(`${NOTES}/${id}`, { method: 'DELETE', cookie: owner, ip: '198.51.100.111' });
    expect(deleted.status).toBe(204);

    const repeat = await call(`${NOTES}/${id}`, { method: 'DELETE', cookie: owner, ip: '198.51.100.111' });
    expect(repeat.status).toBe(404);

    const afterDelete = await call(NOTES, { cookie: owner, ip: '198.51.100.111' });
    expect(((await afterDelete.json()) as { data: unknown[] }).data).toEqual([]);
  });
});

describe('GET /api/v1/dashboard with notes', () => {
  it('fills recentNotes with list items, newest first, regardless of pin', async () => {
    const { token } = await registerUser('notes-dash@example.test', { ip: '198.51.100.121' });
    await noteId(token, { title: 'older', body: 'first body' }, '198.51.100.121');
    await noteId(token, { title: 'newer', body: 'second body', pinned: true }, '198.51.100.121');

    const response = await call(DASHBOARD, { cookie: token, ip: '198.51.100.121' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        recentNotes: Array<{
          title: string;
          excerpt: string;
          pinned: boolean;
          updatedAt: string;
          attachments: unknown[];
          attachmentCount: number;
        }>;
      };
    };
    const rows = body.data.recentNotes;
    // Both notes are recent, pinned or not (§3.7); order is `updated_at` desc.
    expect(rows.map((row) => row.title).sort()).toEqual(['newer', 'older']);
    expect(rows.find((row) => row.title === 'newer')).toMatchObject({
      excerpt: 'second body',
      pinned: true,
      attachments: [],
      attachmentCount: 0,
    });
    expect(rows.find((row) => row.title === 'older')).toMatchObject({ excerpt: 'first body', pinned: false });
    const times = rows.map((row) => row.updatedAt);
    expect(times).toEqual([...times].sort().reverse());
  });
});
