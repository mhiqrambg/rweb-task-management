---
document: 09-admin-console.md
phase: 2
stage: design extension
status: extension, requires owner approval (BCR-01)
prepared_by: design integrator
sources: [".planning/00-project-discovery.md §4-§8", ".planning/01-requirements.md §3.2 (FR-AUTH)", ".planning/05-database-design.md §1.1", ".planning/06-api-contracts.md §1-§2", "design/01-design-system.md", "design/06-copy-deck.md"]
---

# 09 — Admin console (member management)

**Scope change.** The approved blueprint is single-tenant and owner-only: a user sees and edits only
their own rows, and a foreign id returns 404, never 403 (`.planning/00` §6, `01` A-08). An admin who
manages *other people's accounts* contradicts that model, so this surface is an **extension** and is
designed to stay out of the way of everything the benchmark measures. It needs explicit owner approval
before implementation.

What it is: account administration — list members, create a member, edit role and sign-in state, disable
or enable, delete. It is **not** a task/note moderation tool: an admin never opens another member's tasks
or notes.

## 1. Why it does not disturb the benchmark

| Rule | How the admin console respects it |
|---|---|
| Owner-only data access | Admin reads `users` rows only. Task and note endpoints keep their ownership rule; no admin route returns task or note content. |
| 404-not-403 | A non-admin calling an admin route gets the same 404 envelope as an absent resource, so the route's existence is not disclosed. |
| Static export purity | The console ships in the Astro app only (SSR, server-authorised). The Next.js export has no admin route, no admin bundle, no admin markup. |
| Parity | Not benchmarked. The parity checklist (`07`) covers the member-facing screens; the admin console is deliberately out of the shared visual comparisons because it has no counterpart app. |
| One design language | It uses the same tokens, type scale, component states, table rhythm and copy voice as the member screens. |

## 2. Data model delta (proposal)

```sql
ALTER TABLE users
  ADD COLUMN role   text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'));
```

- `users.email` stays unique and immutable (the sign-in identity).
- `status = 'disabled'` makes every session-invalidating endpoint return 401 and blocks new logins.
- Deleting a member cascades tasks → notes → attachments exactly as a self-delete does today
  (`.planning/05` §1.2), through the same storage cleanup path.
- An admin cannot delete or demote their own account (self-lockout guard).

## 3. Endpoints (proposal, Astro-only)

| Method | Path | Returns |
|---|---|---|
| `GET` | `/admin` | Console shell, server-rendered page 1 of members |
| `GET` | `/admin/members?q&role&status&cursor` | Cursor page of `{id, displayName, email, role, status, createdAt}` plus `nextCursor` and `total` |
| `POST` | `/admin/members` | Creates a member with a temporary password; `201` with the record |
| `PATCH` | `/admin/members/:id` | Updates `displayName`, `role`, `status` |
| `DELETE` | `/admin/members/:id` | Deletes the member and their workspace; `204` |

Envelope, errors, validation and rate limiting reuse `.planning/06` §1-§2 unchanged.

## 4. Screens (page `09 Admin` in the design file)

| Frame | Size | Content |
|---|---|---|
| `ad-01-admin-members-1440` | 1440×900 | Table: Member / Email / Role / Status / Created / Actions. Toolbar: search, role filter, status filter, `New user`. Summary `128 members · 7 admins · 2 disabled`. Role pill for admins, status pills, row actions `Edit`/`Enable`/`Delete`, cursor footer `128 members · showing 1–5` + `Load more`. |
| `ad-02-admin-member-edit-1440` | 1440×900 | Edit form: full name, email (read-only identity), temporary password (create only), role segmented Member/Admin, status segmented Active/Disabled, `Cancel` + `Save changes`. |
| `ad-03-admin-members-375` | 375×812 | Mobile list: search, two filter chips, five rows with name + `email · role · status`, `New user` full-width action. |

States designed: active row, disabled row, admin role, empty result (via the standard `C-16` no-results
state, `Clear filters`), error (`C-18` + `Try again`), create/edit validation (`C-19`), delete confirm
(`C-14`, Cancel focused). Loading uses `C-17` skeletons at the row height.

## 5. Copy added to the deck

`Members`, `New user`, `Search members`, `Role`, `Status`, `All roles`, `All statuses`, `Member`,
`Admin`, `Active`, `Disabled`, `Edit`, `Enable`, `Delete`, `Save changes`, `Load more`,
`128 members · showing 1–5` (data-driven), plus the deck's existing action and validation strings. Any
string not in `design/06-copy-deck.md` is a defect (add it there first).

## 6. Accessibility

Same contract as the member screens: table header row is a real `th` scope="col" set; row actions are
buttons with the row's member name in the accessible name (`Edit Amina Rahman`); status is never
colour-only (the pill carries the word); focus ring 2 px accent + 2 px offset; destructive confirm
traps focus and returns it to the row.

## 7. Open items

1. Owner approval of BCR-01 (admin role + cross-member account visibility).
2. Whether `DELETE` should hard-delete or set a tombstone; the design assumes hard delete with cascade.
3. Temporary-password delivery is out of scope: the create form shows the password once, the member must
   change it at first sign-in.
4. No audit log is designed; if the project needs one, it is a new requirement, not a screen tweak.
