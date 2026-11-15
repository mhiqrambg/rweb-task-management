-- 0002_tasks_notes — tasks, notes and attachments tables for `apps/api`
-- on Cloudflare D1 (SQLite). Logical shape mirrors `.planning/05` §3.3-3.5 with the
-- type substitutions D1 forces: uuid -> TEXT, timestamptz -> ISO-8601 TEXT.
--
-- Timestamps are stored as `YYYY-MM-DDTHH:MM:SS.sssZ`, so text ordering is time ordering.
-- Every timestamp is Worker-computed; nothing defaults inside D1.

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (trim(title) <> '') CHECK (length(title) <= 200),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (trim(title) <> '') CHECK (length(title) <= 200),
  body TEXT NOT NULL DEFAULT '' CHECK (trim(body) <> ''),
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  task_id TEXT,
  note_id TEXT,
  storage_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  width INTEGER CHECK (width > 0),
  height INTEGER CHECK (height > 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id, user_id) REFERENCES tasks (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (note_id, user_id) REFERENCES notes (id, user_id) ON DELETE CASCADE,
  CHECK (
    (CASE WHEN task_id IS NULL THEN 0 ELSE 1 END
      + CASE WHEN note_id IS NULL THEN 0 ELSE 1 END) = 1
  ),
  CHECK ((width IS NULL) = (height IS NULL))
) STRICT;

-- Composite-FK targets (`.planning/05` §3.3-3.4).
CREATE UNIQUE INDEX tasks_id_user_id_key ON tasks (id, user_id);
CREATE UNIQUE INDEX notes_id_user_id_key ON notes (id, user_id);

-- Task list ordering and counts (`.planning/05` §4.2 #11-15).
CREATE INDEX tasks_user_updated_at_id_idx ON tasks (user_id, updated_at DESC, id DESC);
CREATE INDEX tasks_user_status_updated_at_id_idx ON tasks (user_id, status, updated_at DESC, id DESC);
CREATE INDEX tasks_user_priority_updated_at_id_idx ON tasks (user_id, priority, updated_at DESC, id DESC);
CREATE INDEX tasks_user_created_at_id_idx ON tasks (user_id, created_at DESC, id DESC);
CREATE INDEX tasks_user_due_date_id_idx ON tasks (user_id, (due_date IS NULL), due_date DESC, id DESC);

-- Note list ordering (`.planning/05` §4.3 #18).
CREATE INDEX notes_user_pinned_updated_at_id_idx ON notes (user_id, pinned DESC, updated_at DESC, id DESC);

-- Attachment target lookups and cascade paths (`.planning/05` §4.3 #21-22).
CREATE INDEX attachments_task_id_created_at_id_idx ON attachments (task_id, created_at, id);
CREATE INDEX attachments_note_id_created_at_id_idx ON attachments (note_id, created_at, id);
