import { describe, expect, it } from 'vitest';
import { call, registerUser, VALID_PASSWORD } from './helpers';

const TASKS = '/api/v1/tasks';
const DASHBOARD = '/api/v1/dashboard';

async function createTask(token: string, body: unknown, ip = '198.51.100.11') {
  return call(TASKS, { body, cookie: token, ip });
}

describe('POST /api/v1/tasks', () => {
  it('creates a task with defaults, 201 and Location', async () => {
    const { token } = await registerUser('tasks-create@example.test', { ip: '198.51.100.11' });
    const response = await createTask(token, { title: 'Buy milk' });
    expect(response.status).toBe(201);
    const location = response.headers.get('location') ?? '';
    expect(location).toMatch(/^\/api\/v1\/tasks\//);
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      title: 'Buy milk',
      description: null,
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      isOverdue: false,
    });
    expect(body.data.attachments).toEqual([]);
    expect(body.data.attachmentCount).toBe(0);
    expect(typeof body.data.id).toBe('string');
  });

  it('rejects a blank title and an impossible due date as 422', async () => {
    const { token } = await registerUser('tasks-invalid@example.test', { ip: '198.51.100.12' });
    const blank = await createTask(token, { title: '   ' }, '198.51.100.12');
    expect(blank.status).toBe(422);
    const badDate = await createTask(token, { title: 'x', dueDate: '2026-02-30' }, '198.51.100.12');
    expect(badDate.status).toBe(422);
  });

  it('requires a session as 401', async () => {
    const response = await call(TASKS, { body: { title: 'nope' }, ip: '198.51.100.13' });
    expect(response.status).toBe(401);
  });
});

describe('GET /api/v1/tasks', () => {
  it('lists newest first with cursor pagination that round-trips', async () => {
    const { token } = await registerUser('tasks-list@example.test', { ip: '198.51.100.21' });
    for (const title of ['first', 'second', 'third']) {
      const created = await createTask(token, { title }, '198.51.100.21');
      expect(created.status).toBe(201);
    }
    const first = await call(`${TASKS}?limit=2`, { cookie: token, ip: '198.51.100.21' });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { data: Array<{ title: string }>; page: { limit: number; nextCursor: string | null } };
    expect(firstBody.data.map((row) => row.title)).toEqual(['third', 'second']);
    expect(firstBody.page.limit).toBe(2);
    expect(typeof firstBody.page.nextCursor).toBe('string');

    const second = await call(
      `${TASKS}?limit=2&cursor=${encodeURIComponent(firstBody.page.nextCursor as string)}`,
      { cookie: token, ip: '198.51.100.21' },
    );
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { data: Array<{ title: string }>; page: { nextCursor: string | null } };
    expect(secondBody.data.map((row) => row.title)).toEqual(['first']);
    expect(secondBody.page.nextCursor).toBeNull();
  });

  it('filters by status and search, and rejects bad grammar as 422', async () => {
    const { token } = await registerUser('tasks-filter@example.test', { ip: '198.51.100.22' });
    await createTask(token, { title: 'Buy milk', status: 'completed' }, '198.51.100.22');
    await createTask(token, { title: 'Buy bread' }, '198.51.100.22');

    const filtered = await call(`${TASKS}?status=completed&q=milk`, { cookie: token, ip: '198.51.100.22' });
    expect(filtered.status).toBe(200);
    const filteredBody = (await filtered.json()) as { data: Array<{ title: string }> };
    expect(filteredBody.data.map((row) => row.title)).toEqual(['Buy milk']);

    for (const bad of [
      `${TASKS}?status=done`,
      `${TASKS}?sort=title`,
      `${TASKS}?sort=-updated_at,-updated_at`,
      `${TASKS}?limit=101`,
      `${TASKS}?cursor=short`,
      `${TASKS}?q=a&q=b`,
      `${TASKS}?dueState=range`,
      `${TASKS}?dueFrom=2026-01-01`,
    ]) {
      const rejected = await call(bad, { cookie: token, ip: '198.51.100.22' });
      expect(rejected.status).toBe(422);
    }
  });

  it('applies dueState and hasAttachments filters', async () => {
    const { token } = await registerUser('tasks-due@example.test', { ip: '198.51.100.23' });
    await createTask(token, { title: 'past due', dueDate: '2000-01-01' }, '198.51.100.23');
    await createTask(token, { title: 'no date' }, '198.51.100.23');

    const overdue = await call(`${TASKS}?dueState=overdue`, { cookie: token, ip: '198.51.100.23' });
    const overdueBody = (await overdue.json()) as { data: Array<{ title: string }> };
    expect(overdueBody.data.map((row) => row.title)).toEqual(['past due']);

    const none = await call(`${TASKS}?dueState=none`, { cookie: token, ip: '198.51.100.23' });
    const noneBody = (await none.json()) as { data: Array<{ title: string }> };
    expect(noneBody.data.map((row) => row.title)).toEqual(['no date']);

    const withoutImages = await call(`${TASKS}?hasAttachments=false`, { cookie: token, ip: '198.51.100.23' });
    expect(withoutImages.status).toBe(200);
    const withImages = await call(`${TASKS}?hasAttachments=true`, { cookie: token, ip: '198.51.100.23' });
    const withBody = (await withImages.json()) as { data: unknown[] };
    expect(withBody.data).toEqual([]);
  });
});

describe('GET /api/v1/tasks/:id', () => {
  it('returns the task and 404s a foreign id identically to a missing one', async () => {
    const { token: owner } = await registerUser('tasks-owner@example.test', { ip: '198.51.100.31' });
    const { token: stranger } = await registerUser('tasks-stranger@example.test', { ip: '198.51.100.32' });
    const created = await createTask(owner, { title: 'secret', description: 'shh' }, '198.51.100.31');
    const id = ((await created.json()) as { data: { id: string } }).data.id;

    const own = await call(`${TASKS}/${id}`, { cookie: owner, ip: '198.51.100.31' });
    expect(own.status).toBe(200);

    const foreign = await call(`${TASKS}/${id}`, { cookie: stranger, ip: '198.51.100.32' });
    expect(foreign.status).toBe(404);
    const missing = await call(`${TASKS}/00000000-0000-4000-8000-000000000000`, { cookie: stranger, ip: '198.51.100.32' });
    expect(missing.status).toBe(404);
    const foreignBody = (await foreign.json()) as { error: { code: string } };
    const missingBody = (await missing.json()) as { error: { code: string } };
    expect(foreignBody.error.code).toBe(missingBody.error.code);
  });
});

describe('PATCH /api/v1/tasks/:id', () => {
  it('applies a partial update and clears nullable fields', async () => {
    const { token } = await registerUser('tasks-patch@example.test', { ip: '198.51.100.41' });
    const created = await createTask(token, { title: 'draft', description: 'keep', dueDate: '2026-12-01' }, '198.51.100.41');
    const id = ((await created.json()) as { data: { id: string } }).data.id;

    const updated = await call(`${TASKS}/${id}`, {
      method: 'PATCH',
      body: { status: 'completed', description: null, dueDate: null },
      cookie: token,
      ip: '198.51.100.41',
    });
    expect(updated.status).toBe(200);
    const body = (await updated.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ status: 'completed', description: null, dueDate: null, title: 'draft' });
  });

  it('404s a foreign id and 422s an empty patch', async () => {
    const { token: owner } = await registerUser('tasks-patch-owner@example.test', { ip: '198.51.100.42' });
    const { token: stranger } = await registerUser('tasks-patch-stranger@example.test', { ip: '198.51.100.43' });
    const created = await createTask(owner, { title: 'mine' }, '198.51.100.42');
    const id = ((await created.json()) as { data: { id: string } }).data.id;

    const foreign = await call(`${TASKS}/${id}`, { method: 'PATCH', body: { title: 'yours' }, cookie: stranger, ip: '198.51.100.43' });
    expect(foreign.status).toBe(404);
    const empty = await call(`${TASKS}/${id}`, { method: 'PATCH', body: {}, cookie: owner, ip: '198.51.100.42' });
    expect(empty.status).toBe(422);
  });
});

describe('DELETE /api/v1/tasks/:id', () => {
  it('deletes once as 204, then 404s the repeat and a foreign id', async () => {
    const { token: owner } = await registerUser('tasks-delete-owner@example.test', { ip: '198.51.100.51' });
    const { token: stranger } = await registerUser('tasks-delete-stranger@example.test', { ip: '198.51.100.52' });
    const created = await createTask(owner, { title: 'ephemeral' }, '198.51.100.51');
    const id = ((await created.json()) as { data: { id: string } }).data.id;

    const foreign = await call(`${TASKS}/${id}`, { method: 'DELETE', cookie: stranger, ip: '198.51.100.52' });
    expect(foreign.status).toBe(404);

    const deleted = await call(`${TASKS}/${id}`, { method: 'DELETE', cookie: owner, ip: '198.51.100.51' });
    expect(deleted.status).toBe(204);

    const repeat = await call(`${TASKS}/${id}`, { method: 'DELETE', cookie: owner, ip: '198.51.100.51' });
    expect(repeat.status).toBe(404);
  });
});

describe('GET /api/v1/dashboard', () => {
  it('reports figures that agree with the task list', async () => {
    const { token } = await registerUser('tasks-dash@example.test', { ip: '198.51.100.61' });
    await createTask(token, { title: 'done one', status: 'completed', priority: 'high' }, '198.51.100.61');
    await createTask(token, { title: 'late one', priority: 'high', dueDate: '2000-01-01' }, '198.51.100.61');
    await createTask(token, { title: 'plain one', priority: 'low' }, '198.51.100.61');

    const response = await call(DASHBOARD, { cookie: token, ip: '198.51.100.61' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        tasks: { total: number; active: number; completed: number; overdue: number };
        byStatus: { todo: number; in_progress: number; completed: number };
        byPriority: { low: number; medium: number; high: number };
        recentTasks: Array<{ title: string }>;
        recentNotes: unknown[];
      };
    };
    expect(body.data.tasks).toEqual({ total: 3, active: 2, completed: 1, overdue: 1 });
    expect(body.data.byStatus).toEqual({ todo: 2, in_progress: 0, completed: 1 });
    expect(body.data.byPriority).toEqual({ low: 1, medium: 0, high: 2 });
    expect(body.data.recentTasks.map((row) => row.title)).toEqual(['plain one', 'late one', 'done one']);
    expect(body.data.recentNotes).toEqual([]);
  });

  it('requires a session and starts empty for a new account', async () => {
    const anonymous = await call(DASHBOARD, { ip: '198.51.100.62' });
    expect(anonymous.status).toBe(401);
    const { token } = await registerUser('tasks-dash-empty@example.test', { ip: '198.51.100.63' });
    const response = await call(DASHBOARD, { cookie: token, ip: '198.51.100.63' });
    const body = (await response.json()) as { data: { tasks: { total: number }; recentTasks: unknown[] } };
    expect(body.data.tasks.total).toBe(0);
    expect(body.data.recentTasks).toEqual([]);
  });
});
