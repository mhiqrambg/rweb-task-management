-- 0005_password_hash_pbkdf2_only — narrow `users.password_hash` to `$pbkdf2$` only.
--
-- Development-stage wipe. The owner does not need any existing accounts, so this migration deletes
-- every user; `ON DELETE CASCADE` on sessions, tasks, notes and attachments removes their data too.
-- The table is then rebuilt with the PBKDF2-only CHECK, leaving an empty, clean database.
--
-- Why a rebuild: SQLite cannot DROP or ALTER a CHECK in place. Deleting the rows first makes the
-- recreate safe — `DROP TABLE users` performs an implicit DELETE of the remaining rows, and it is
-- *that* implicit delete which cascades into every child table (measured when the table still had
-- rows). With the table empty, nothing cascades. The create → drop → rename order keeps the child
-- tables' `REFERENCES users` valid; renaming the original instead would rewrite those references to
-- the old name (the trap documented in 0004).
-- `PRAGMA writable_schema` is refused by D1 (`SQLITE_AUTH`).

DELETE FROM users;

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

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

-- The index lived on the dropped table; recreate it against the rebuilt `users`.
CREATE INDEX users_role_status_created_at_id_idx ON users (role, status, created_at DESC, id DESC);
