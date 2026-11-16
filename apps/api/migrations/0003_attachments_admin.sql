-- 0003_attachments_admin — the attachment thumbnails and the admin extension (BCR-01).
--
-- Two independent changes, one migration because both land in the same PR series:
--
-- 1. `attachments.thumb_key` (D-15). `0002` stored only `storage_key`. The binary contract addresses
--    two variants through one authenticated route (06 §8.7), and the two variants need distinct
--    cache keys even while this runtime serves the same bytes for both (no Wasm ⇒ no re-encode).
--    Added nullable, backfilled from `storage_key`, then made NOT NULL: a table that already holds
--    rows must stay readable, and a half-written attachment row is not a state worth keeping.
--
-- 2. `users.role` / `users.status` (D-12, `design/09-admin-console.md` §2). The admin axis is a
--    single extra check on the session user; it is not a second ownership axis, and no task, note
--    or attachment statement changes shape.

ALTER TABLE attachments ADD COLUMN thumb_key TEXT;

UPDATE attachments SET thumb_key = storage_key WHERE thumb_key IS NULL;

-- SQLite cannot add a NOT NULL column, so the constraint is enforced by the application: every
-- insert names both keys (see modules/attachments/repo.ts). The backfill above means no existing
-- row is left without one.

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'admin'));

ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'disabled'));

-- Admin member listing: search by name or email, filter by role and status, newest first.
CREATE INDEX users_role_status_created_at_id_idx ON users (role, status, created_at DESC, id DESC);