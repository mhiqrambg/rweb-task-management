-- 0001_auth — users, sessions, and the rate-limit window store for `apps/api`
-- on Cloudflare D1 (SQLite). Logical shape mirrors `.planning/05` §3.1-§3.2 with the
-- type substitutions D1 forces: uuid -> TEXT, timestamptz -> ISO-8601 TEXT,
-- bytea -> BLOB, inet -> TEXT.
--
-- Timestamps are stored as `YYYY-MM-DDTHH:MM:SS.sssZ`, so text ordering is time ordering.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  display_name TEXT NOT NULL CHECK (trim(display_name) <> ''),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash BLOB NOT NULL UNIQUE CHECK (length(token_hash) = 32),
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  expires_at TEXT NOT NULL CHECK (expires_at > created_at),
  user_agent TEXT,
  ip TEXT
) STRICT;

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Operational rate-limit state (`.planning/07` §8.3). Workers isolates share no memory,
-- so the counters live in the same database; one row per (bucket, key, window).
CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (bucket, key, window_start)
) STRICT;
