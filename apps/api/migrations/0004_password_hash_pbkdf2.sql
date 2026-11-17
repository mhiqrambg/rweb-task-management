-- 0004_password_hash_pbkdf2 — widen the `users.password_hash` CHECK to accept both the legacy
-- Argon2id format and the new PBKDF2 format (ADR: Argon2id -> PBKDF2 for the free-tier CPU budget).
--
-- Why a rebuild: SQLite cannot DROP or ALTER a CHECK constraint in place, so `users` is recreated
-- with the new constraint and its rows copied across.
--
-- Why accept BOTH formats: existing accounts keep their `$argon2id$…` hash and stay verifiable
-- (rehash-on-login upgrades them lazily). New registrations write `$pbkdf2$…`. Rejecting the legacy
-- prefix would brick every existing account.
--
-- === The FK trap (why the rebuild is ordered this way) ===
-- `PRAGMA writable_schema` is refused by D1 ("not authorized: SQLITE_AUTH"), so the stored schema
-- text cannot be edited to repoint a foreign key. And `ALTER TABLE users RENAME TO users_old` rewrites
-- every child table's `REFERENCES users` clause to `REFERENCES users_old` — measured: sessions, tasks,
-- notes and attachments all ended up referencing a table that was then dropped, silently orphaning the
-- FK. The safe ordering therefore never renames the original `users`:
--   1. create `users_new` with the widened CHECK,
--   2. copy rows `users` -> `users_new`,
--   3. drop `users`,
--   4. rename `users_new` -> `users` (children already say `REFERENCES users`; the rename of the new
--      table into that name is what keeps every FK pointing at a real `users` table).
-- Verified locally that after this ordering `sessions`/`tasks`/`notes`/`attachments` still reference `users`.

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL CHECK (
    password_hash LIKE '$argon2id$%' OR password_hash LIKE '$pbkdf2$%'
  ),
  display_name TEXT NOT NULL CHECK (trim(display_name) <> ''),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'))
) STRICT;

INSERT INTO users_new (id, email, password_hash, display_name, created_at, updated_at, role, status)
SELECT id, email, password_hash, display_name, created_at, updated_at, role, status FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

-- The index lived on the dropped table; recreate it against the rebuilt `users`.
CREATE INDEX users_role_status_created_at_id_idx ON users (role, status, created_at DESC, id DESC);
