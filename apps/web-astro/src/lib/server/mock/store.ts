import { randomBytes, randomUUID } from 'node:crypto';
import type {
  Attachment,
  AttachmentSummary,
  ISODateTime,
  Note,
  NoteListItem,
  Task,
  TaskListItem,
  User,
} from '@taskapp/contracts';

/**
 * In-memory dummy dataset for the P6 build (API_MODE=mock).
 *
 * It exists so the SSR screens can be finished and reviewed against the contract before apps/api
 * lands (13 §2). It implements the documented shapes, status codes and owner predicate, and it is
 * NEVER a second source of truth: every field here comes from .planning/06 §3.
 *
 * Not for production: data lives in the process, passwords are compared in plain text.
 */

export interface MockUserRow extends User {
  password: string;
}

export interface MockAttachmentRow extends Attachment {
  userId: string;
  targetType: 'task' | 'note';
  targetId: string;
}

export interface MockTaskRow {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  dueDate: string | null;
  attachments: MockAttachmentRow[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface MockNoteRow {
  id: string;
  userId: string;
  title: string;
  body: string;
  pinned: boolean;
  attachments: MockAttachmentRow[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface MockSession {
  token: string;
  userId: string;
  expiresAt: ISODateTime;
}

export interface MockStore {
  users: MockUserRow[];
  tasks: MockTaskRow[];
  notes: MockNoteRow[];
  sessions: MockSession[];
}

const DAY = 24 * 60 * 60 * 1000;

function isoAt(days: number, hours = 0): ISODateTime {
  return new Date(Date.now() + days * DAY + hours * 60 * 60 * 1000).toISOString();
}

function calendarAt(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

function attachment(
  userId: string,
  targetType: 'task' | 'note',
  targetId: string,
  index: number,
  mime: Attachment['mime'],
  width: number,
  height: number,
  sizeBytes: number,
): MockAttachmentRow {
  const id = randomUUID();
  return {
    id,
    userId,
    targetType,
    targetId,
    mime,
    width,
    height,
    sizeBytes,
    createdAt: isoAt(-2, index),
    thumbUrl: `/mock-media/${id}.svg?variant=thumb`,
    fullUrl: `/mock-media/${id}.svg?variant=full`,
  };
}

const PRIMARY_EMAIL = 'erika@example.com';
export const MOCK_PASSWORD = 'correct horse battery';

export const MOCK_SECOND_USER_EMAIL = 'hamzah@example.com';

export function createStore(): MockStore {
  const primary: MockUserRow = {
    id: randomUUID(),
    email: PRIMARY_EMAIL,
    displayName: 'Erika Nord',
    createdAt: isoAt(-90),
    updatedAt: isoAt(-90),
    password: MOCK_PASSWORD,
  };

  const second: MockUserRow = {
    id: randomUUID(),
    email: MOCK_SECOND_USER_EMAIL,
    displayName: 'Hamzah',
    createdAt: isoAt(-40),
    updatedAt: isoAt(-40),
    password: MOCK_PASSWORD,
  };

  const tasks: MockTaskRow[] = [
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Prepare sprint review',
      description:
        'Collect the two open questions from the last review and the demo checklist for the team.',
      status: 'in_progress',
      priority: 'high',
      dueDate: calendarAt(2),
      attachments: [],
      createdAt: isoAt(-9),
      updatedAt: isoAt(0, -3),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Draft Q4 roadmap',
      description: null,
      status: 'todo',
      priority: 'low',
      dueDate: null,
      attachments: [],
      createdAt: isoAt(-7),
      updatedAt: isoAt(-1),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Book team offsite',
      description: 'Two candidate venues, both within the travel budget.',
      status: 'completed',
      priority: 'medium',
      dueDate: calendarAt(-3),
      attachments: [],
      createdAt: isoAt(-12),
      updatedAt: isoAt(-4),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Renew domain certificate',
      description: 'The certificate expires this week and the renewal needs the account owner.',
      status: 'todo',
      priority: 'high',
      dueDate: calendarAt(-3),
      attachments: [],
      createdAt: isoAt(-15),
      updatedAt: isoAt(-1, -5),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Write onboarding checklist',
      description: 'Steps a new member needs on day one, plus the accounts to create.',
      status: 'in_progress',
      priority: 'medium',
      dueDate: calendarAt(5),
      attachments: [],
      createdAt: isoAt(-6),
      updatedAt: isoAt(0, -6),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Archive old receipts',
      description: null,
      status: 'completed',
      priority: 'low',
      dueDate: null,
      attachments: [],
      createdAt: isoAt(-20),
      updatedAt: isoAt(-8),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Renew passport',
      description: 'Appointment is booked, bring the old passport and one photo.',
      status: 'todo',
      priority: 'medium',
      dueDate: calendarAt(-1),
      attachments: [],
      createdAt: isoAt(-30),
      updatedAt: isoAt(-2),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Plan December budget',
      description: null,
      status: 'todo',
      priority: 'low',
      dueDate: calendarAt(10),
      attachments: [],
      createdAt: isoAt(-4),
      updatedAt: isoAt(-2, -2),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Publish release notes',
      description: 'Summarise the three changes that ship this week.',
      status: 'completed',
      priority: 'high',
      dueDate: calendarAt(1),
      attachments: [],
      createdAt: isoAt(-5),
      updatedAt: isoAt(-1, -1),
    },
  ];

  const notes: MockNoteRow[] = [
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Sprint review notes',
      body: 'Two questions came up: who owns the migration window, and whether the review needs a demo.\n\nDecision: the demo stays, the migration window moves to the week after.',
      pinned: true,
      attachments: [],
      createdAt: isoAt(-8),
      updatedAt: isoAt(0, -2),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Venue shortlist',
      body: 'Two venues within budget, one closer to the station. Ask about the projector before booking.',
      pinned: false,
      attachments: [],
      createdAt: isoAt(-10),
      updatedAt: isoAt(-1, -2),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Reading list',
      body: 'Three articles on release checklists, one on writing shorter meeting notes.',
      pinned: false,
      attachments: [],
      createdAt: isoAt(-14),
      updatedAt: isoAt(-3),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Weekly review template',
      body: 'What moved, what is blocked, what to drop. Three lines, no more.',
      pinned: false,
      attachments: [],
      createdAt: isoAt(-21),
      updatedAt: isoAt(-5),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Interview questions',
      body: 'Start with the last thing the candidate shipped, then ask what they would change.',
      pinned: false,
      attachments: [],
      createdAt: isoAt(-25),
      updatedAt: isoAt(-6),
    },
    {
      id: randomUUID(),
      userId: primary.id,
      title: 'Plumbing quotes',
      body: 'Two quotes so far. The second one includes parts and the first does not.',
      pinned: false,
      attachments: [],
      createdAt: isoAt(-28),
      updatedAt: isoAt(-7),
    },
  ];

  // Images on one task and one note so the thumbnail, +N and lightbox states have real content.
  const withImages = tasks[0];
  if (withImages) {
    withImages.attachments = [
      attachment(primary.id, 'task', withImages.id, 0, 'image/png', 1600, 1200, 241_172),
      attachment(primary.id, 'task', withImages.id, 1, 'image/jpeg', 1200, 900, 188_416),
      attachment(primary.id, 'task', withImages.id, 2, 'image/webp', 1600, 1200, 96_512),
      attachment(primary.id, 'task', withImages.id, 3, 'image/png', 1400, 1050, 210_944),
    ];
  }

  const overdueTask = tasks[3];
  if (overdueTask) {
    overdueTask.attachments = [
      attachment(primary.id, 'task', overdueTask.id, 0, 'image/jpeg', 1280, 960, 164_864),
    ];
  }

  const pinnedNote = notes[0];
  if (pinnedNote) {
    pinnedNote.attachments = [
      attachment(primary.id, 'note', pinnedNote.id, 0, 'image/png', 1440, 1080, 198_656),
      attachment(primary.id, 'note', pinnedNote.id, 1, 'image/webp', 1200, 900, 88_064),
    ];
  }

  // A row owned by somebody else, so the 404-on-foreign-owner rule is exercised in dev and tests.
  tasks.push({
    id: randomUUID(),
    userId: second.id,
    title: 'Second account task',
    description: 'Only the owner can see this row.',
    status: 'todo',
    priority: 'low',
    dueDate: null,
    attachments: [],
    createdAt: isoAt(-3),
    updatedAt: isoAt(-2),
  });

  return { users: [primary, second], tasks, notes, sessions: [] };
}

const KEY = Symbol.for('taskapp.mock.store');

type GlobalWithStore = typeof globalThis & { [KEY]?: MockStore };

function globalStore(): MockStore {
  const scope = globalThis as GlobalWithStore;
  scope[KEY] ??= createStore();
  return scope[KEY];
}

export function getStore(): MockStore {
  return globalStore();
}

export function resetStore(): MockStore {
  const store = createStore();
  (globalThis as GlobalWithStore)[KEY] = store;
  return store;
}

/* ---------------------------------------------------------------- helpers */

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function findSessionUser(store: MockStore, cookie: string | null): MockUserRow | null {
  const token = cookieValue(cookie, 'sid');
  if (!token) return null;
  const session = store.sessions.find((row) => row.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    store.sessions = store.sessions.filter((row) => row.token !== token);
    return null;
  }
  return store.users.find((user) => user.id === session.userId) ?? null;
}

export function cookieValue(cookie: string | null, name: string): string | null {
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function toUser(row: MockUserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAttachmentSummary(row: MockAttachmentRow): AttachmentSummary {
  return {
    id: row.id,
    mime: row.mime,
    width: row.width,
    height: row.height,
    thumbUrl: row.thumbUrl,
    fullUrl: row.fullUrl,
  };
}

export function toAttachment(row: MockAttachmentRow): Attachment {
  const summary = toAttachmentSummary(row);
  const { sizeBytes, createdAt } = row;
  return { ...summary, sizeBytes, createdAt };
}

export function isOverdue(task: Pick<MockTaskRow, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate || task.status === 'completed') return false;
  return task.dueDate < calendarAt(0);
}

export function toTask(task: MockTaskRow): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    isOverdue: isOverdue(task),
    attachments: task.attachments.map(toAttachment),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function toTaskListItem(task: MockTaskRow): TaskListItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    isOverdue: isOverdue(task),
    attachments: task.attachments.slice(0, 3).map(toAttachmentSummary),
    attachmentCount: task.attachments.length,
    updatedAt: task.updatedAt,
  };
}

export function toNote(note: MockNoteRow): Note {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    attachments: note.attachments.map(toAttachment),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function toNoteListItem(note: MockNoteRow): NoteListItem {
  return {
    id: note.id,
    title: note.title,
    excerpt: note.body.replace(/\s+/g, ' ').trim().slice(0, 160),
    pinned: note.pinned,
    attachments: note.attachments.slice(0, 3).map(toAttachmentSummary),
    attachmentCount: note.attachments.length,
    updatedAt: note.updatedAt,
  };
}
