-- 0005_password_hash_pbkdf2_only — narrow `users.password_hash` to `$pbkdf2$` only.
--
-- Supersedes 0004's dual-format CHECK. Accounts still holding a hash in the retired memory-hard
-- format cannot be verified any more, so they are reset:
--   * their sessions are deleted (any live cookie stops working immediately), and
--   * their `password_hash` is replaced with a PBKDF2 sentinel whose preimage was 32 random bytes,
--     generated once and discarded. No password authenticates against it, and it satisfies the new
--     CHECK; the account row and all owned tasks/notes/attachments are preserved. Recovery requires
--     an explicit password reset (out of scope for the benchmark product).
-- PBKDF2 rows are copied unchanged.
--
-- Why a rebuild: SQLite cannot DROP or ALTER a CHECK constraint in place. The ordering below is the
-- only one measured safe on D1 — `ALTER TABLE users RENAME TO users_old` rewrites every child
-- table's `REFERENCES users` to `REFERENCES users_old`, orphaning sessions/tasks/notes/attachments
-- when the old table is dropped. `PRAGMA writable_schema` is refused by D1 (`SQLITE_AUTH`).
-- Recreating `users` under the same name keeps every child FK valid (verified after 0004).

DELETE FROM sessions
WHERE user_id IN (SELECT id FROM users WHERE password_hash NOT LIKE '$pbkdf2$%');

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL CHECK (password_hash LIKE '$pbkdf2$%'),
  display_name TEXT NOT NULL CHECK (trim(display_name) <> ''),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'))
) STRICT;

INSERT INTO users_new (id, email, password_hash, display_name, created_at, updated_at, role, status)
SELECT
  id,
  email,
  CASE
    WHEN password_hash LIKE '$pbkdf2$%' THEN password_hash
    ELSE '$pbkdf2$SHA-256$30000$uEqfH0IHyGzKf9b3+OFv0g$rXYHNZSW4S6v8uG+rhulSOj+yLj//CAzP5LtHSv8/kg'
  END,
  display_name,
  created_at,
  updated_at,
  role,
  status
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

-- The index lived on the dropped table; recreate it against the rebuilt `users`.
CREATE INDEX users_role_status_created_at_id_idx ON users (role, status, created_at DESC, id DESC);
