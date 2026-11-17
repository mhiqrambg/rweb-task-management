import { describe, expect, it } from 'vitest';
import { call, json, ONE_PIXEL_PNG, registerUser, upload } from './helpers';

/**
 * FR-ATT-002/008/009/011, NFR-SEC-005/009, R-I1/R-I3.
 *
 * The upload battery: a renamed text file, a 6 MB file, an SVG, an 11th file, a truncated image,
 * and the cross-owner matrix that must be indistinguishable from an absent id.
 *
 * Registration is limited to 10/min per IP, so every test registers on its own pair of addresses.
 * An owner and a stranger inside one test share those two, never one.
 */

const ATTACHMENTS = '/api/v1/attachments';
const TASKS = '/api/v1/tasks';
const NOTES = '/api/v1/notes';

let ipCounter = 0;

/** A fresh client address. Two calls in one test give an owner and a stranger. */
function nextIp(): string {
  ipCounter += 1;
  return `198.18.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
}

interface ErrorBody {
  error: { code: string; message: string; details: unknown[]; requestId: string };
}

interface Created {
  id: string;
  mime: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  thumbUrl: string;
  fullUrl: string;
}

async function createTask(token: string, title: string, ip: string): Promise<string> {
  const response = await call(TASKS, { body: { title }, cookie: token, ip });
  if (response.status !== 201) {
    throw new Error(`task creation failed: ${response.status} ${await response.text()}`);
  }
  return (await json<{ data: { id: string } }>(response)).data.id;
}

async function createNote(token: string, title: string, ip: string): Promise<string> {
  const response = await call(NOTES, { body: { title, body: 'note body' }, cookie: token, ip });
  if (response.status !== 201) {
    throw new Error(`note creation failed: ${response.status} ${await response.text()}`);
  }
  return (await json<{ data: { id: string } }>(response)).data.id;
}

/** One owner session plus the address it registered from. */
async function owner(): Promise<{ token: string; ip: string }> {
  const ip = nextIp();
  const { token } = await registerUser(`att-${ip.replaceAll('.', '-')}@example.test`, { ip });
  return { token, ip };
}

function uploadTo(
  token: string,
  targetType: 'task' | 'note',
  targetId: string,
  ip: string,
  overrides: Partial<Parameters<typeof upload>[1]> = {},
): Promise<Response> {
  return upload(ATTACHMENTS, { cookie: token, targetType, targetId, ip, ...overrides });
}

describe('POST /api/v1/attachments', () => {
  it('stores a valid image, reports its dimensions and stable URLs, and 201s', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'With image', ip);

    const created = await uploadTo(token, 'task', taskId, ip);
    expect(created.status).toBe(201);
    expect(created.headers.get('location') ?? '').toMatch(/^\/api\/v1\/attachments\//);

    const attachment = (await json<{ data: Created }>(created)).data;
    expect(attachment.mime).toBe('image/png');
    expect(attachment.width).toBe(1);
    expect(attachment.height).toBe(1);
    expect(attachment.sizeBytes).toBe(ONE_PIXEL_PNG.byteLength);
    expect(attachment.fullUrl).toContain('/content?variant=full');
    expect(attachment.thumbUrl).toContain('/content?variant=thumb');
    // The storage key must never reach a client (07 §1.1, §3.4): the URLs address the id only.
    expect(JSON.stringify(attachment)).not.toMatch(/storageKey|thumbKey|"key"/u);
  });

  it('rejects a renamed text file on content, not on its declared type', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Sniff', ip);

    const response = await uploadTo(token, 'task', taskId, ip, {
      // A lie in both the declared type and the extension: only the bytes decide.
      bytes: new TextEncoder().encode('this is not an image at all'),
      filename: 'evil.png',
      contentType: 'image/png',
    });

    expect(response.status).toBe(415);
    const body = await json<{
      error: { code: string; details: Array<{ field: string; code: string; file?: string }> };
    }>(response);
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(body.error.details[0]).toMatchObject({
      field: 'file',
      code: 'mime_not_allowed',
      file: 'evil.png',
    });
  });

  it('rejects an SVG as active content', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Svg', ip);

    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const response = await uploadTo(token, 'task', taskId, ip, {
      bytes: svg,
      filename: 'x.svg',
      contentType: 'image/svg+xml',
    });

    expect(response.status).toBe(415);
  });

  it('rejects a 6 MB file as 413', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Big', ip);

    const large = new Uint8Array(6 * 1024 * 1024);
    large.set(ONE_PIXEL_PNG.subarray(0, 8));
    const response = await uploadTo(token, 'task', taskId, ip, {
      bytes: large,
      filename: 'huge.png',
    });

    expect(response.status).toBe(413);
    expect((await json<{ error: { code: string } }>(response)).error.code).toBe(
      'PAYLOAD_TOO_LARGE',
    );
  });

  it('rejects a truncated image whose frame header cannot be parsed', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Truncated', ip);

    // The PNG signature is intact; the IHDR that follows is not, so gate 2 refuses it.
    const response = await uploadTo(token, 'task', taskId, ip, {
      bytes: ONE_PIXEL_PNG.subarray(0, 20),
      filename: 'truncated.png',
    });

    expect(response.status).toBe(422);
    expect((await json<{ error: { code: string } }>(response)).error.code).toBe(
      'VALIDATION_FAILED',
    );
  });

  it('rejects the 11th attachment with the target-naming limit message', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Ten images', ip);

    for (let index = 0; index < 10; index += 1) {
      const added = await uploadTo(token, 'task', taskId, ip);
      expect(added.status).toBe(201);
    }

    const eleventh = await uploadTo(token, 'task', taskId, ip);
    expect(eleventh.status).toBe(422);
    const body = await json<{ error: { details: Array<{ code: string }> } }>(eleventh);
    expect(body.error.details[0]?.code).toBe('attachment_limit');
  });

  it('attaches to a note as well as a task, and 404s a foreign target without writing', async () => {
    const { token, ip } = await owner();
    const strangerIp = nextIp();
    const { token: stranger } = await registerUser(
      `att-other-${strangerIp.replaceAll('.', '-')}@example.test`,
      { ip: strangerIp },
    );

    const aTask = await createTask(token, 'A task', ip);
    const bTask = await createTask(stranger, 'B task', strangerIp);

    // B targets A's task: 404, identical to a random absent id.
    const foreign = await uploadTo(stranger, 'task', aTask, strangerIp);
    const absent = await uploadTo(stranger, 'task', crypto.randomUUID(), strangerIp);
    expect(foreign.status).toBe(404);
    expect(absent.status).toBe(404);
    // Indistinguishable means the same shape and the same message, not the same request id.
    const foreignBody = await json<ErrorBody>(foreign);
    const absentBody = await json<ErrorBody>(absent);
    expect(foreignBody.error.code).toBe(absentBody.error.code);
    expect(foreignBody.error.message).toBe(absentBody.error.message);
    expect(foreignBody.error.details).toEqual(absentBody.error.details);

    // A's task really gained nothing from B's attempt.
    const aDetail = await call(`${TASKS}/${aTask}`, { cookie: token, ip });
    expect((await json<{ data: { attachments: unknown[] } }>(aDetail)).data.attachments).toEqual(
      [],
    );

    // And a note target works for its owner.
    const noteId = await createNote(token, 'A note', ip);
    const noteUpload = await uploadTo(token, 'note', noteId, ip);
    expect(noteUpload.status).toBe(201);

    expect(bTask).not.toBe(aTask);
  });

  it('requires a session as 401', async () => {
    const ip = nextIp();
    const response = await call(ATTACHMENTS, { body: new FormData(), ip });
    expect(response.status).toBe(401);
  });
});

describe('GET /api/v1/attachments/:id and /content', () => {
  async function seedAttachment(): Promise<{
    ownerToken: string;
    ownerIp: string;
    attachment: Created;
  }> {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Readable', ip);
    const created = await uploadTo(token, 'task', taskId, ip);
    const attachment = (await json<{ data: Created }>(created)).data;
    return { ownerToken: token, ownerIp: ip, attachment };
  }

  it('serves the owner the original bytes with a strong ETag and private caching', async () => {
    const { ownerToken, ownerIp, attachment } = await seedAttachment();

    const full = await call(`${ATTACHMENTS}/${attachment.id}/content?variant=full`, {
      cookie: ownerToken,
      ip: ownerIp,
    });
    expect(full.status).toBe(200);
    expect(full.headers.get('content-type')).toBe('image/png');
    expect(full.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(full.headers.get('content-disposition')).toBe('inline');
    expect(full.headers.get('etag')).toBeTruthy();
    expect(full.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await full.arrayBuffer()).byteLength).toBe(ONE_PIXEL_PNG.byteLength);
  });

  it('answers a matching If-None-Match with 304 and no body', async () => {
    const { ownerToken, ownerIp, attachment } = await seedAttachment();

    const first = await call(`${ATTACHMENTS}/${attachment.id}/content`, {
      cookie: ownerToken,
      ip: ownerIp,
    });
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await call(`${ATTACHMENTS}/${attachment.id}/content`, {
      cookie: ownerToken,
      ip: ownerIp,
      extraHeaders: { 'if-none-match': etag ?? '' },
    });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('answers a foreign id with the same 404 body as an absent one', async () => {
    const { ownerToken, ownerIp, attachment } = await seedAttachment();
    const strangerIp = nextIp();
    const { token: stranger } = await registerUser(
      `att-read-${strangerIp.replaceAll('.', '-')}@example.test`,
      { ip: strangerIp },
    );

    const foreign = await call(`${ATTACHMENTS}/${attachment.id}/content?variant=full`, {
      cookie: stranger,
      ip: strangerIp,
    });
    const absent = await call(`${ATTACHMENTS}/${crypto.randomUUID()}/content?variant=full`, {
      cookie: stranger,
      ip: strangerIp,
    });
    const anonymous = await call(`${ATTACHMENTS}/${attachment.id}/content`, { ip: strangerIp });

    expect(foreign.status).toBe(404);
    expect(absent.status).toBe(404);
    expect(anonymous.status).toBe(401);
    const foreignBody = await json<ErrorBody>(foreign);
    const absentBody = await json<ErrorBody>(absent);
    expect(foreignBody.error.code).toBe(absentBody.error.code);
    expect(foreignBody.error.message).toBe(absentBody.error.message);
    expect(foreignBody.error.details).toEqual(absentBody.error.details);

    // The owner can still read it: the 404s were authorization, not deletion.
    const stillThere = await call(`${ATTACHMENTS}/${attachment.id}`, {
      cookie: ownerToken,
      ip: ownerIp,
    });
    expect(stillThere.status).toBe(200);
  });

  it('returns metadata for the owner and 404 for a foreign id', async () => {
    const { ownerToken, ownerIp, attachment } = await seedAttachment();
    const strangerIp = nextIp();
    const { token: stranger } = await registerUser(
      `att-meta-${strangerIp.replaceAll('.', '-')}@example.test`,
      { ip: strangerIp },
    );

    const mine = await call(`${ATTACHMENTS}/${attachment.id}`, {
      cookie: ownerToken,
      ip: ownerIp,
    });
    expect(mine.status).toBe(200);
    expect((await json<{ data: Created }>(mine)).data.id).toBe(attachment.id);

    const theirs = await call(`${ATTACHMENTS}/${attachment.id}`, {
      cookie: stranger,
      ip: strangerIp,
    });
    expect(theirs.status).toBe(404);
  });
});

describe('DELETE /api/v1/attachments/:id', () => {
  it('removes the row, makes the binary unretrievable, and cascades with its task', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Doomed', ip);

    const created = await uploadTo(token, 'task', taskId, ip);
    const attachment = (await json<{ data: Created }>(created)).data;

    const removed = await call(`${ATTACHMENTS}/${attachment.id}`, {
      method: 'DELETE',
      cookie: token,
      ip,
    });
    expect(removed.status).toBe(204);

    const content = await call(`${ATTACHMENTS}/${attachment.id}/content?variant=full`, {
      cookie: token,
      ip,
    });
    expect(content.status).toBe(404);

    // FR-ATT-011: deleting the task removes the rest with it.
    const second = await uploadTo(token, 'task', taskId, ip);
    const secondAttachment = (await json<{ data: Created }>(second)).data;
    const deletedTask = await call(`${TASKS}/${taskId}`, { method: 'DELETE', cookie: token, ip });
    expect(deletedTask.status).toBe(204);

    const orphaned = await call(`${ATTACHMENTS}/${secondAttachment.id}/content`, {
      cookie: token,
      ip,
    });
    expect(orphaned.status).toBe(404);
  });

  it('404s a foreign id and a repeat delete, never 403', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Mine', ip);
    const created = await uploadTo(token, 'task', taskId, ip);
    const attachment = (await json<{ data: Created }>(created)).data;

    const strangerIp = nextIp();
    const { token: stranger } = await registerUser(
      `att-del-${strangerIp.replaceAll('.', '-')}@example.test`,
      { ip: strangerIp },
    );

    const foreign = await call(`${ATTACHMENTS}/${attachment.id}`, {
      method: 'DELETE',
      cookie: stranger,
      ip: strangerIp,
    });
    expect(foreign.status).toBe(404);

    expect(
      (await call(`${ATTACHMENTS}/${attachment.id}`, { method: 'DELETE', cookie: token, ip }))
        .status,
    ).toBe(204);

    expect(
      (await call(`${ATTACHMENTS}/${attachment.id}`, { method: 'DELETE', cookie: token, ip }))
        .status,
    ).toBe(404);
  });
});

describe('attachment summaries on list rows', () => {
  it('returns the first three in upload order plus the exact count', async () => {
    const { token, ip } = await owner();
    const taskId = await createTask(token, 'Five images', ip);

    const ids: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const added = await uploadTo(token, 'task', taskId, ip, {
        filename: `image-${index}.png`,
      });
      ids.push((await json<{ data: Created }>(added)).data.id);
    }

    const detail = await call(`${TASKS}/${taskId}`, { cookie: token, ip });
    const task = await json<{ data: { attachments: Array<{ id: string }> } }>(detail);
    expect(task.data.attachments.map((item) => item.id)).toEqual(ids);

    const list = await call(TASKS, { cookie: token, ip });
    const row = (
      await json<{ data: Array<{ attachments: unknown[]; attachmentCount: number }> }>(list)
    ).data[0];
    expect(row?.attachmentCount).toBe(5);
    expect(row?.attachments).toHaveLength(3);
  });
});