---
document: 06-api-contracts.md
phase: 1
stage: 7
prepared_by: api-designer
reviewed_by: software-architect
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [backend-development, security-review]
  changed:
    - "backend-development: strict-schema validation, the rate-limit keying model and the `Retry-After` idiom came from it."
    - "security-review: produced the unknown-field rejection as the mass-assignment guard, the origin-check-on-unsafe-methods rule, and the 'same response as an absent session' CSRF shape."
edited_on_persistence: "Condensed from the specialist's 1848-line output. Conventions, the per-endpoint auth/authorization/rate-limit table, shared schemas, validation rules, pagination grammar, versioning rules, upload contract, consistency checks, open questions and all 11 deviations are preserved. Per-endpoint subsections keep method, path, auth, params, one request example, one response example, the error set and the requirement IDs; the specialist's longer per-endpoint prose was tightened."
---

# 06 — API Contracts

Normative for every endpoint. §1-§4 apply to all of §5. Deviations from the locked surface are enumerated
only in §11. The wire contract is what both frontends and the API implement from `packages/contracts`.

## 1. Conventions

### 1.1 Base path and shape

| Item | Rule |
|---|---|
| Base path | `/api/v1`; every path is written in full |
| Transport | HTTPS only. In production the Worker shares one origin with both frontends (ADR-05), so no CORS headers are emitted at all; the Workers CORS middleware is registered only in dev, with the single allowlist origin `http://localhost:3000` and `credentials: true` |
| JSON media type | `application/json; charset=utf-8`, both directions, including errors |
| Multipart | `multipart/form-data`, endpoint #18 only |
| Success envelope | `{ "data": <payload> }`; lists are `{ "data": [...], "page": { "limit": <int>, "nextCursor": "<opaque>" \| null } }` |
| Error envelope | `{ "error": { "code": "<CODE>", "message": "<human text>", "requestId": "<id>", "details": [ { "field": "...", "code": "...", "message": "...", "file": "..." } ] } }` |
| Forbidden shapes | A bare array, a bare scalar, a top-level `null`, or an object without `data`/`error`. `204` carries no body and no `Content-Type` |
| Methods | Only the methods in §2.4 exist on a path. A known path with an unsupported method and an unknown path both answer `404 NOT_FOUND`; `405` is not in the closed status set |
| Field naming | `camelCase` on the wire, `snake_case` in SQL; the mapper is the only place they meet (ADR-03) |
| Identifiers | UUID v4, canonical lowercase hyphenated. Path ids are validated as UUIDs before a statement is prepared; a non-UUID id is treated as absent |
| No internals | No stack traces, SQL, file paths, storage keys, driver names (D1/Wrangler internals) or framework versions (`NFR-SEC-011`) |
| Unknown fields | Every request schema is **strict**. An unknown key in a body or query string is `422 VALIDATION_FAILED` with `details[0].code = "unknown_field"`. This is the mass-assignment guard: `userId`, `ownerId`, `id`, `createdAt`, `updatedAt`, `passwordHash`, `tokenHash` are rejected, not ignored (FR-TASK-001, NFR-SEC-004) |

### 1.2 Status-code matrix

| Status | Meaning here | Body | Endpoints that can emit it |
|---|---|---|---|
| `200 OK` | Read succeeded; unconditional update applied | success envelope, or bytes on #20 | 2, 4, 5, 6, 7, 8, 10, 11, 13, 15, 16, 19, 20, 22 |
| `201 Created` | Resource created; `Location` present | success envelope | 1, 9, 14, 18 |
| `204 No Content` | State change with nothing to return | none | 3, 12, 17, 21 |
| `304 Not Modified` | Conditional binary read matched the strong `ETag` | none | 20 |
| `401 Unauthorized` | No session, invalid/expired/idle-revoked session, bad credentials, or a refused cross-site unsafe request | error envelope | 2-21 |
| `404 Not Found` | Row absent **or** owned by another user (indistinguishable), or unknown route/method | error envelope | 10, 11, 12, 15, 16, 17, 18, 19, 20, 21; any unmatched path |
| `409 Conflict` | Unique-value collision, or already-satisfied precondition (e.g. login while authenticated) | error envelope | 1, 2 |
| `413 Payload Too Large` | Per-file limit or request body limit exceeded | error envelope | 1, 2, 6, 9, 11, 14, 16, 18 |
| `415 Unsupported Media Type` | Declared media type not accepted, or upload content not an allowed image type | error envelope | 1, 2, 6, 9, 11, 14, 16, 18 |
| `422 Unprocessable Entity` | Structural or rule validation failure, including a malformed cursor | error envelope with `details[]` | every endpoint except 22 |
| `429 Too Many Requests` | Rate limit exceeded; `Retry-After` always present | error envelope | 1-21 |
| `500 Internal Server Error` | Unhandled failure, database unavailable, storage read failure | error envelope | every endpoint |
| `503 Service Unavailable` | Readiness failed — **only** #22, carrying a success envelope (§11 D-5) | success envelope | 22 |

### 1.3 Error codes (closed set)

`VALIDATION_FAILED` 422 · `UNAUTHENTICATED` 401 · `NOT_FOUND` 404 · `CONFLICT` 409 ·
`PAYLOAD_TOO_LARGE` 413 · `UNSUPPORTED_MEDIA_TYPE` 415 · `RATE_LIMITED` 429 · `INTERNAL` 500.
A ninth code is a defect and requires a version (§7). `details[].code` is a stable machine key; the
`message` text comes from the shared copy deck and is **not** part of the contract.

### 1.4 Idempotency and safety rules

| Class | Endpoints | Rule |
|---|---|---|
| Safe | all `GET` | No user-visible state change. No state-changing operation is reachable by `GET`, so a top-level cross-site GET can do nothing |
| Repeated-safe by effect | `DELETE`, `PATCH`, `POST /auth/logout` | A repeated delete yields `404` or `204` as appropriate but never creates state; a repeated PATCH writes the same values and does not move `updated_at` unless something actually changed |
| Creating | `POST` #1, #9, #14, #18, #24 | Each success creates a row. Double-submit protection is client-side (FR-TASK-018); no `Idempotency-Key` in v1 (Q-08) |

### 1.5 Time, dates and numbers

| Type | Wire format | Rule |
|---|---|---|
| Instant | ISO-8601 UTC with `Z` (`2026-11-15T09:41:07.123Z`) | Never local, never without offset |
| Calendar date (`dueDate`, `dueFrom`, `dueTo`) | `YYYY-MM-DD` | No time component, no timezone conversion (A-15) |
| Counts / sizes | JSON number | `sizeBytes`, `width`, `height` are integers well under 2^31; no 64-bit ids, so nothing needs string encoding |
| `null` | explicit `null` | Distinct from absent: in PATCH, an absent field means "unchanged", `null` means "clear" for nullable fields |

### 1.6 Caching and content headers

| Response class | `Cache-Control` | Other headers |
|---|---|---|
| Every JSON response | `no-store` | `Content-Type: application/json; charset=utf-8`, `X-Request-Id` |
| Binary, `variant=full` | `private, max-age=86400` | strong `ETag`, `Content-Type` from the stored `mime`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff` |
| Binary, `variant=thumb` | `private, max-age=86400` | same, `Content-Type: image/webp` |
| `304` | as above | `ETag` only |

### 1.7 Request identifiers

Every request gets a server-generated id (or the inbound `X-Request-Id` when it is a syntactically valid
UUID), echoed as `X-Request-Id` and in `error.requestId`. It appears in the structured log line, so a
benchmark anomaly traces to a server event (NFR-OBS-002).

### 1.8 Request body limits

| Body | Limit | On breach |
|---|---|---|
| JSON body | 256 KiB | `413 PAYLOAD_TOO_LARGE` |
| Multipart request | one file ≤ 5 MiB, plus fields | `413` for the file, `422` for field errors |
| Query string | 4 KiB | `414` is not in the code set → `422 VALIDATION_FAILED` |

### 1.9 The not-found rule

FR-TASK-019, FR-NOTE-013, FR-ATT-008 and NFR-SEC-005 reduce to one rule, applied identically in every
statement that touches an owned row:

```sql
WHERE id = $1 AND user_id = $2      -- session user; never from the request
```

Zero rows affected or selected → `404 NOT_FOUND`. There is no `403` anywhere in this API, no separate
"does it exist" query, and no response that differs between "absent" and "someone else's".

## 2. Authentication model

### 2.1 The `sid` cookie

| Attribute | Value | Notes |
|---|---|---|
| Name | `sid` | canonical constant (FR-AUTH-004) |
| Value | 32 CSPRNG bytes, base64url | never a JWT; never client-readable |
| `HttpOnly` | yes | script cannot read or duplicate it |
| `SameSite` | `Lax` | cross-site unsafe methods arrive without it → `401` |
| `Path` | `/` | one cookie for `/`, `/b`, `/api` |
| `Domain` | absent (host-only) | no subdomain leakage |
| `Secure` | when `NODE_ENV=production` | measured stack runs over TLS |
| `Max-Age` | 604800 (7 d) at issue; re-issued with the remaining absolute lifetime on refresh | absolute expiry never extended |
| Server storage | `sessions.token_hash` = SHA-256, unique 32 bytes | the plaintext token never persists |

Set on #1 and #2; cleared by #3 with `Set-Cookie: sid=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
(+`Secure` in production). A `401` from a presented-but-invalid cookie also clears it; a `401` with no
cookie presented sets nothing (Q-13).

### 2.2 Session lifecycle

| Mechanism | Rule | Requirement |
|---|---|---|
| Issuance | only #1 and #2 | FR-AUTH-004 |
| Absolute expiry | `created_at + 7 d`, stored in `expires_at`, never extended | FR-AUTH-006 |
| Idle expiry | `last_used_at + 24 h`, evaluated on every read | FR-AUTH-010 |
| Refresh | at most hourly: conditional `UPDATE ... WHERE last_used_at < ?`, with the one-hour cutoff computed in the Worker and bound as a parameter (no SQL `now()`/`interval`), then re-issue the cookie with the remaining lifetime | O-7 |
| Revocation | `DELETE FROM sessions WHERE token_hash = $1` at #3; every other tab/device is refused at its next request | FR-AUTH-007, FR-AUTH-013 |
| Login while authenticated | `409 CONFLICT`; no second session, no session reuse path (Q-15) | permission matrix row 4 |

### 2.3 `GET /auth/me` in every state

Public-but-session-aware (O-6). Never `403`.

| State | Response |
|---|---|
| Valid session | `200 { data: { user, expiresAt } }` |
| No cookie | `401 UNAUTHENTICATED`, no `Set-Cookie` |
| Invalid / expired / idle-revoked / revoked | `401 UNAUTHENTICATED` + expired `Set-Cookie` |

This is the only bootstrap the Next.js shell has, and the redirect decision for Astro.

### 2.4 Per-endpoint auth, authorization, rate limit and idempotency

| # | Method | Path | Auth | Authorization rule | Rate limit (key) | Idempotent? |
|---|---|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/register` | none | Creates the caller's own account; a `userId` in the body is rejected | 10/min (IP) | no — user + session per success |
| 2 | POST | `/api/v1/auth/login` | none | Session for the credential owner only; valid existing session → `409` | 10/min (IP); plus 5 failed / 15 min per (IP, email) | no |
| 3 | POST | `/api/v1/auth/logout` | session | `WHERE token_hash = $presented` only | 10/min (IP) | yes by effect (repeat → `401`, still logged out) |
| 4 | GET | `/api/v1/auth/me` | optional | Returns only the presented session's own user | 300/min (user, else IP) | yes (safe) |
| 5 | GET | `/api/v1/users/me` | session | `WHERE id = $sessionUserId` | 300/min (user) | yes (safe) |
| 6 | PATCH | `/api/v1/users/me` | session | `WHERE id = $sessionUserId`; only `displayName` writable | 300/min (user) | yes by effect |
| 7 | GET | `/api/v1/dashboard` | session | every figure scoped by `user_id = $sessionUserId` in one statement | 300/min (user) | yes (safe) |
| 8 | GET | `/api/v1/tasks` | session | `WHERE user_id = $sessionUserId` before filters, sort, cursor | 300/min (user) | yes (safe) |
| 9 | POST | `/api/v1/tasks` | session | owner is `$sessionUserId`, never from the body | 300/min (user) | no |
| 10 | GET | `/api/v1/tasks/:id` | session | `WHERE id = $id AND user_id = $sessionUserId`; else `404` | 300/min (user) | yes (safe) |
| 11 | PATCH | `/api/v1/tasks/:id` | session | same predicate inside the `UPDATE`; foreign id affects 0 rows → `404` | 300/min (user) | yes by effect |
| 12 | DELETE | `/api/v1/tasks/:id` | session | same predicate; cascades attachment rows | 300/min (user) | yes by effect (repeat → `404`) |
| 13 | GET | `/api/v1/notes` | session | `WHERE user_id = $sessionUserId` before filters, sort, cursor | 300/min (user) | yes (safe) |
| 14 | POST | `/api/v1/notes` | session | owner is `$sessionUserId` | 300/min (user) | no |
| 15 | GET | `/api/v1/notes/:id` | session | `WHERE id = $id AND user_id = $sessionUserId`; else `404` | 300/min (user) | yes (safe) |
| 16 | PATCH | `/api/v1/notes/:id` | session | same predicate inside the `UPDATE` | 300/min (user) | yes by effect |
| 17 | DELETE | `/api/v1/notes/:id` | session | same predicate; cascades attachment rows | 300/min (user) | yes by effect |
| 18 | POST | `/api/v1/attachments` | session | target must satisfy `id = $targetId AND user_id = $sessionUserId`; foreign target → `404` | 20/min (user) | no |
| 19 | GET | `/api/v1/attachments/:id` | session | `WHERE id = $id AND user_id = $sessionUserId` | 300/min (user) | yes (safe) |
| 20 | GET | `/api/v1/attachments/:id/content` | session | `SELECT … WHERE id AND user_id` **before** any file is opened | 300/min (user) | yes (safe) |
| 21 | DELETE | `/api/v1/attachments/:id` | session | same predicate; row delete first, R2 object delete after | 300/min (user) | yes by effect |
| 22 | GET | `/api/v1/health` | none | no data beyond dependency state; no counts, no versions | exempt | yes (safe) |
| 23 | GET | `/api/v1/admin/members` | session + `role='admin'` | no ownership predicate by design: admin reads `users` rows only; non-admin caller → `404` (not `403`) | 60/min (admin user) | yes (safe) |
| 24 | POST | `/api/v1/admin/members` | session + `role='admin'` | creates a `users` row with `role`/`status` from the body | 20/min (admin user) | no |
| 25 | PATCH | `/api/v1/admin/members/:id` | session + `role='admin'` | `WHERE id = $id`; self-demote or self-disable → `409`; target's sessions revoked when `status` becomes `disabled` | 60/min (admin user) | yes by effect |
| 26 | DELETE | `/api/v1/admin/members/:id` | session + `role='admin'` | `WHERE id = $id`; deleting own account → `409`; cascades tasks → notes → attachments and R2 objects | 20/min (admin user) | yes by effect (repeat → `404`) |

Authorization authority is always the API. Astro's `302 /login` and Next's post-`401` route replacement
are UX only (`03` §5.3). No frontend performs a per-row permission check, because there is nothing for it
to check.

Rate-limit counters live in the D1 `rate_limits` table (`bucket`, `key`, `window_start`, `count`) —
ADR-01, no Redis and no in-process memory (brief §1): auth mutations `10/min` per IP, failed login
`5/15min` per `(IP, email)`, reads `300/min` per user. Every `429` carries `Retry-After` seconds and,
when available, `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` (Unix seconds).

### 2.5 CSRF and origin integrity

| Rule | Behaviour |
|---|---|
| `SameSite=Lax` | A cross-site `POST`/`PATCH`/`DELETE` arrives without the cookie → `401 UNAUTHENTICATED` |
| Origin check on unsafe methods | For `POST`/`PATCH`/`DELETE`, the API requires `Origin` (or, absent, `Sec-Fetch-Site: same-origin`) to equal `APP_ORIGIN`; foreign or missing → `401 UNAUTHENTICATED`, deliberately identical to an absent session |
| Why uploads specifically | `multipart/form-data` is CORS-safelisted, so no preflight protects #18; the origin check is its only CSRF control (NFR-SEC-006) |
| Top-level cross-site GET | Cannot change state — no state-changing operation is reachable by `GET` |
| Exception | #1, #2, #22 are public, but the origin check still applies to #1/#2 so a cross-site form cannot mint a session for the victim |

## 3. Shared schemas

Exported from `packages/contracts` (ADR-09), used by the API as runtime validators and by both frontends
as form validators. Types derive from the Zod schemas via `z.infer`; the blocks below are the public
types.

### 3.1 Primitives

```ts
type UUID = string;            // canonical lowercase v4, 36 chars
type ISODateTime = string;     // 2026-11-15T09:41:07.123Z
type CalendarDate = string;    // 2026-11-15
type TaskStatus = 'todo' | 'in_progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';
type Mime = 'image/jpeg' | 'image/png' | 'image/webp';
type ErrorCode = 'VALIDATION_FAILED' | 'UNAUTHENTICATED' | 'NOT_FOUND' | 'CONFLICT'
               | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'RATE_LIMITED' | 'INTERNAL';
```

### 3.2 `User`

```ts
interface User {
  id: UUID;
  email: string;
  displayName: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

### 3.3 `SessionProbe`

```ts
interface SessionProbe {
  user: User;
  expiresAt: ISODateTime;   // absolute expiry of the presented session
}
```

### 3.4 `AttachmentSummary` (in list rows) and `Attachment` (detail)

```ts
interface AttachmentSummary {
  id: UUID;
  mime: Mime;
  width: number | null;
  height: number | null;
  thumbUrl: string;         // /api/v1/attachments/<id>/content?variant=thumb
  fullUrl: string;          // /api/v1/attachments/<id>/content?variant=full
}

interface Attachment extends AttachmentSummary {
  sizeBytes: number;
  createdAt: ISODateTime;
}
```

### 3.5 `Task` (detail) and `TaskListItem`

```ts
interface Task {
  id: UUID;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: CalendarDate | null;
  isOverdue: boolean;          // server-computed, §4
  attachments: Attachment[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface TaskListItem {
  id: UUID;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: CalendarDate | null;
  isOverdue: boolean;
  attachments: AttachmentSummary[];   // first three in canonical order
  attachmentCount: number;
  updatedAt: ISODateTime;
}
```

### 3.6 `Note` (detail) and `NoteListItem`

```ts
interface Note {
  id: UUID;
  title: string;
  body: string;
  pinned: boolean;
  attachments: Attachment[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface NoteListItem {
  id: UUID;
  title: string;
  excerpt: string;            // first 160 chars of body, whitespace-collapsed
  pinned: boolean;
  attachments: AttachmentSummary[];
  attachmentCount: number;
  updatedAt: ISODateTime;
}
```

### 3.7 `Dashboard`

```ts
interface Dashboard {
  tasks: { total: number; active: number; completed: number; overdue: number };
  byStatus:   { todo: number; in_progress: number; completed: number };
  byPriority: { low: number; medium: number; high: number };
  recentTasks: TaskListItem[];   // 5, updated_at desc
  recentNotes: NoteListItem[];    // 5, updated_at desc regardless of pin
}
```

Seven figures plus two lists, in one round trip (FR-DASH-001..006, A-21).

### 3.8 `Page<T>`, `ValidationDetail`, `ErrorEnvelope`

```ts
interface Page<T> {
  limit: number;
  nextCursor: string | null;
}

interface ValidationDetail {
  field: string;        // dotted path, e.g. "dueDate" or "file"
  code: string;         // stable machine key
  message: string;      // resolved copy, not part of the contract
  file?: string;        // basename only, for upload rejections (D-9)
}

interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details: ValidationDetail[];
  };
}
```

### 3.9 Fields that never appear in a response

`passwordHash` (credential material), `tokenHash` (session verifier), `storageKey` (server path),
`userId` (ownership is implied by the session and would invite tampering), and `sessions.ip`/`userAgent`
(operational). `temporaryPassword` is write-only for #24 and is never echoed.

### 3.10 `AdminMember` (admin extension, BCR-01)

```ts
type AdminMember = {
  id: string;
  displayName: string;
  email: string;                      // lower-cased, the sign-in identity
  role: "member" | "admin";
  status: "active" | "disabled";
  createdAt: string;                  // ISO-8601 UTC
};
```

Used by #23-#26 only (`design/09-admin-console.md` §3). It carries no task, note or attachment field:
the admin module reads `users` rows and nothing else.

## 4. Validation rules

Normative for the API; both frontends validate with the same Zod schemas and therefore produce the same
message key and text (FR-UI-005/006/012). `details[].message` is the resolved English text;
`details[].code` is stable.

| Field | Type | Required | Constraints | On violation |
|---|---|---|---|---|
| `email` | string | yes (1) | trimmed, ≤ 254, RFC-ish syntax, lowercased for storage; case-insensitive uniqueness enforced by a `COLLATE NOCASE` unique index | `422 VALIDATION_FAILED`, `details[0].field="email"` |
| `password` | string | yes (1, 2) | 12-128 chars, no composition rules (A-11); never logged, never echoed | `422` with `code="password_policy"` |
| `displayName` | string | optional (1), optional (6) | trimmed, 1-100, no control characters | `422` |
| `title` (task, note) | string | yes | trimmed 1-200 | `422`, `code="required"` or `"too_long"` |
| `description` (task) | string \| null | optional | ≤ 5 000 | `422` |
| `body` (note) | string | yes | trimmed 1-20 000 | `422` |
| `status` | enum | optional on create (default `todo`), optional on PATCH | one of 3 values | `422`, `code="enum"` |
| `priority` | enum | optional on create (default `medium`) | one of 3 values | `422` |
| `dueDate` | `YYYY-MM-DD` \| null | optional | real calendar date; `null` clears | `422`, `code="date_format"` |
| `pinned` | boolean | optional | true/false only | `422` |
| `q` | string | optional | trimmed; empty ⇒ no filter; ≤ 200; `%`/`_`/`\` escaped in SQL | `422` if > 200 |
| `limit` | integer | optional | 1-100, default 20 | `422`, `code="range"` |
| `cursor` | string | optional | 16-512 chars, base64url, `v=1`, sort discriminator must match the requested `sort` | `422`, `field="cursor"` |
| `sort` | string | optional | 1-2 keys from the endpoint allowlist, `-` prefix for descending | `422`, `code="sort_key"` |
| `dueState` | enum | optional | `overdue\|today\|range\|none`; `range` requires `dueFrom` ≤ `dueTo` | `422` |
| `hasAttachments` | boolean | optional | — | `422` |
| file (#18) | binary | yes | content in allowlist by sniffing, ≤ 5 MiB, ≤ 10 per target, decodable | `415` / `413` / `422` / `409` |
| `targetType` | enum | yes (#18) | `task` \| `note` | `422` |
| `targetId` | UUID | yes (#18) | must exist and be owned | `404` |

`isOverdue` is derived, not stored: `dueDate < today(UTC) AND status <> 'completed'` (Q-07 fixes "today"
as server UTC date).

## 5. Endpoints

Twenty-two endpoints, numbered as locked. "Auth" abbreviates §2.4. Every path absolute.

### 5.1 #1 — `POST /api/v1/auth/register`

Creates a user and, in the same response, an authenticated session (auto-login, A-17), landing the caller
on the dashboard (J-01). Auth: none. Rate: 10/min IP.

```jsonc
// request
{ "email": "erika@example.test", "password": "correct horse battery", "displayName": "Erika" }
// 201 + Set-Cookie: sid=...; Path=/; HttpOnly; SameSite=Lax
{ "data": { "user": { "id": "…", "email": "erika@example.test", "displayName": "Erika",
                      "createdAt": "2026-11-15T09:41:07.123Z", "updatedAt": "2026-11-15T09:41:07.123Z" },
            "expiresAt": "2026-11-22T09:41:07.123Z" } }
```

Errors: `422` (email/password/displayName), `409 CONFLICT` (email taken), `413`, `415`, `429`.
FR-AUTH-001..003, FR-UI-005. Q-02 fixes `displayName` as optional, defaulting to the email local part.

### 5.2 #2 — `POST /api/v1/auth/login`

Issues a session for an existing credential pair (J-02). Auth: none. Rate: 10/min IP plus 5 failed
attempts/15 min per (IP, email).

Request `{ "email": "…", "password": "…" }` → `200` with the same `SessionProbe` shape as #1 plus
`Set-Cookie`. Errors: `401 UNAUTHENTICATED` (one generic message for wrong password and unknown email),
`409` (already authenticated), `422`, `429`, `413`, `415`. FR-AUTH-004/005, NFR-SEC-007.

### 5.3 #3 — `POST /api/v1/auth/logout`

Revokes the presented session and clears the cookie (J-10). Auth: session. `204`, no body, plus
`Set-Cookie: sid=; Max-Age=0`. Errors: `401` (no/invalid session — treated as already logged out),
`429`. FR-AUTH-007/013.

### 5.4 #4 — `GET /api/v1/auth/me`

Session probe (§2.3): the Next.js bootstrap and Astro's redirect decision (O-6). Auth: optional.
`200 { data: { user, expiresAt } }` or `401 UNAUTHENTICATED`. Never `403`. FR-AUTH-009, NFR-OBS-002.

### 5.5 #5 — `GET /api/v1/users/me`

Profile resource for the account screen and nav identity. Auth: session. `200 { data: User }`.
Errors: `401`, `429`. FR-AUTH-009. **No FR consumer beyond nav identity — see §9.1 and D-1.**

### 5.6 #6 — `PATCH /api/v1/users/me`

Updates `displayName` only; credentials and email changes are out of scope (`01` §8). Auth: session.
Request `{ "displayName": "Erika R." }` → `200 { data: User }`. Errors: `401`, `422`, `429`.
Recorded as untraced by an FR (D-1).

### 5.7 #7 — `GET /api/v1/dashboard`

One round trip returning counters, breakdowns, overdue count and the 5 most recently updated tasks and
notes (FR-DASH-001..006, A-21). Auth: session. `200 { data: Dashboard }` (§3.7), computed in one
statement so all seven figures agree with the corresponding filtered lists (FR-DASH-002). Errors: `401`,
`429`. Next.js must not serve a cached payload (FR-DASH-009); the response is `no-store`.

### 5.8 #8 — `GET /api/v1/tasks`

Paginated, filtered, sorted task list (FR-TASK-003/004/011..015). Auth: session. Query grammar in §6.6.
`200 { data: TaskListItem[], page: { limit, nextCursor } }`. Errors: `401`, `422` (any bad filter,
cursor or sort key), `429`. Ordering is deterministic (FR-TASK-013); the cursor is opaque (§6.1).

### 5.9 #9 — `POST /api/v1/tasks`

Creates a task owned by the session user, defaults `todo`/`medium`, no due date (FR-TASK-001/002).

```jsonc
// request
{ "title": "Buy milk", "description": "2 litres", "priority": "high", "dueDate": "2026-11-20" }
// 201 + Location: /api/v1/tasks/<id>
{ "data": { "id": "…", "title": "Buy milk", "description": "2 litres", "status": "todo",
            "priority": "high", "dueDate": "2026-11-20", "isOverdue": false,
            "attachments": [], "createdAt": "…", "updatedAt": "…" } }
```

No attachment field: images are uploaded to the new id via #18 (Q-06). Errors: `401`, `422`, `429`.
FR-TASK-016/018/020.

### 5.10 #10 — `GET /api/v1/tasks/:id`

Task detail with every stored field and all attachments (FR-TASK-005). Auth: session. `200 { data: Task }`.
Errors: `401`, `404` (absent **or** foreign), `429`. Deep-linkable from both frontends (FR-AUTH-008, J-13).

### 5.11 #11 — `PATCH /api/v1/tasks/:id`

Partial update of `title`, `description`, `status`, `priority`, `dueDate`; serves both the edit form and
the inline status change (FR-TASK-006/007). Request carries only changed fields (absent = unchanged,
`null` clears `description`/`dueDate`). `200 { data: Task }`. Errors: `401`, `404`, `422`, `429`.
Last-write-wins, no precondition (Q-14).

### 5.12 #12 — `DELETE /api/v1/tasks/:id`

Deletes the task; attachment rows cascade and binaries become unretrievable (FR-TASK-021, FR-ATT-011).
Auth: session. `204`. Errors: `401`, `404` (repeat or foreign), `429`.

### 5.13 #13 — `GET /api/v1/notes`

Paginated, searched, sorted note list, pinned first by default (FR-NOTE-003/004/008). Query grammar
§6.6. `200 { data: NoteListItem[], page }`. Errors: `401`, `422`, `429`.

### 5.14 #14 — `POST /api/v1/notes`

Creates a note with required `title` and `body` (FR-NOTE-001/002). Request
`{ "title": "…", "body": "…", "pinned": false }` → `201` + `Location` with `{ data: Note }`.
Errors: `401`, `422`, `429`. Attachments follow via #18 (Q-06).

### 5.15 #15 — `GET /api/v1/notes/:id`

Note detail with the full body and all attachments (FR-NOTE-005). `200 { data: Note }`. Errors: `401`,
`404`, `429`.

### 5.16 #16 — `PATCH /api/v1/notes/:id`

Updates `title`/`body` and toggles `pinned` from either surface (FR-NOTE-006/007). A title/body edit MUST
NOT change `pinned`; a pin toggle changes `pinned` and `updated_at` (and therefore list position).
`200 { data: Note }`. Errors: `401`, `404`, `422`, `429`.

### 5.17 #17 — `DELETE /api/v1/notes/:id`

Deletes the note; attachment rows cascade (FR-NOTE-009). `204`. Errors: `401`, `404`, `429`.

### 5.18 #18 — `POST /api/v1/attachments`

Attaches **one** image to an owned task or note (FR-ATT-001/002/003). `multipart/form-data` parts:
`file` (required, exactly one), `targetType` (`task`|`note`), `targetId` (UUID).

```
file=@milk-1.png; type=image/png
targetType=task
targetId=0193f2c1-…
```

`201 { data: Attachment }` + `Location: /api/v1/attachments/<id>`. Errors: `401`, `404` (target absent
or foreign), `413` (file or request), `415` (not an allowed image by content), `422` (undecodable,
count ≥ 10, bad targetType), `429` (20/min user). Contract §8.

### 5.19 #19 — `GET /api/v1/attachments/:id`

Attachment metadata so a lightbox can show dimensions and size without re-reading the parent
(FR-ATT-005). `200 { data: Attachment }`. Errors: `401`, `404`, `429`.

### 5.20 #20 — `GET /api/v1/attachments/:id/content`

Streams the binary — `?variant=thumb|full`, default `full` (FR-ATT-004/008). `200` with bytes,
`Content-Type` from the stored mime (thumb: `image/webp`), strong `ETag`,
`Cache-Control: private, max-age=86400`, `Content-Disposition: inline`,
`X-Content-Type-Options: nosniff`. `304` when `If-None-Match` matches. Errors: `401`, `404` (absent,
foreign, or binary missing — indistinguishable), `429`. `Range` is not supported (Q-12).

### 5.21 #21 — `DELETE /api/v1/attachments/:id`

Removes the attachment; afterwards neither metadata nor bytes are retrievable (FR-ATT-007). `204`.
Row delete commits first, then the R2 object is deleted (`05` §6.1). Errors: `401`, `404`, `429`.

### 5.22 #22 — `GET /api/v1/health`

Liveness and readiness for the Cloudflare route and the harness (NFR-REL-007). Auth: none; rate-limit exempt.

```jsonc
{ "data": { "status": "ok", "db": "ok", "storage": "ok" } }        // 200
{ "data": { "status": "degraded", "db": "down", "storage": "ok" } } // 503, success envelope
```

No counts, no versions, no connection strings. D-5 (`storage`, `503` with a success envelope) needs
approval (O-3).

### 5.23 #23-#26 — admin member management (approved extension BCR-01)

Documented in `design/09-admin-console.md` §3; implemented by the `admin` module and called only by
`apps/admin`. Neither member frontend routes to these endpoints, and no response ever carries task or
note content.

Path prefix is `/api/v1/admin/members`. Every route: `401` without a session, `404` for a session whose
`role` is `member` (the 404-not-403 rule, §1.9 — a non-admin must not be able to probe for the route),
`429` past the per-admin limit.

```jsonc
// #23 GET /api/v1/admin/members?q&role&status&cursor
{ "data": { "items": [ { "id": "…", "displayName": "…", "email": "…", "role": "member",
                         "status": "active", "createdAt": "2026-11-16T09:00:00Z" } ],
            "nextCursor": null, "total": 128 } }

// #24 POST /api/v1/admin/members   → 201
{ "displayName": "…", "email": "…", "temporaryPassword": "…", "role": "member", "status": "active" }

// #25 PATCH /api/v1/admin/members/:id   → 200, same `AdminMember` shape as a list item
{ "displayName": "…", "role": "admin", "status": "disabled" }   // any subset

// #26 DELETE /api/v1/admin/members/:id  → 204, no body
```

| Field | Rule |
|---|---|
| `email` | created with the same normalisation as #1; duplicate → `409`; read-only after creation (the sign-in identity) |
| `temporaryPassword` | create-only, validated by the same password schema as #1, never echoed back |
| `role`, `status` | closed enums; any other value → `422` |
| self-lockout | `PATCH`/`DELETE` against `$sessionUserId` that would demote, disable or delete the caller → `409 CONFLICT` |
| `q` | matches `display_name` or `email`, `LIKE` escaped per §4 |
| `cursor` | same §6.1 cursor contract, sort id `u:created` |

## 6. Pagination, filtering, sorting

### 6.1 The cursor contract

| Property | Rule |
|---|---|
| Format | `base64url(utf8(JSON))` of `{"v":1,"s":"<sort-id>","k":[<key values>]}` |
| Content | the last row's sort-key values plus the `id` tiebreak; **never** an offset and never `user_id` |
| Sort binding | `s` must equal the requested sort (`t:updated`, `t:created`, `t:due`, `n:pinned`); a cursor from another sort is `422` |
| Forgeability | none — an unsigned cursor can only reposition the caller inside their own result set, because ownership comes from the session |
| Probing | the server fetches `limit + 1` rows; `nextCursor` is emitted only when the extra row exists, else `null` |
| Validation | length 16-512, base64url alphabet, `v === 1`, known `s`, arity matching the sort, each value parsing to its declared type |

### 6.2 Why `offset` is rejected

Depth cost is invisible and unbounded; a row updated or deleted between requests makes `LIMIT/OFFSET`
repeat one row and skip another, violating FR-TASK-003's "without duplicates or omissions"; a boundary
inside a tie group splits arbitrarily; and the locked contract has no `offset`. A cursor is also
stateless, so either frontend and any Worker can serve page n+1.

### 6.3 NULL handling for `due_date`

`NULL` is not a date and must not sort as one: **`NULL` sorts last in both directions**. The due-date sort
uses an explicit leading `(due_date IS NULL)` column — `ORDER BY (due_date IS NULL) ASC, due_date DESC, id DESC`
— and the stored index carries the same expression (`05` §4.2 #15), so NULLs land after every dated row.
`dueState=none` selects the NULL region explicitly, so a client never has to infer it from ordering.

### 6.4 Sort grammar

`sort` is a comma-separated list of 1-2 keys, each optionally prefixed with `-` for descending. Omitted
⇒ the endpoint default. Duplicates, more than two keys, an empty segment, or a key outside the allowlist
are `422`. The final tiebreak is always `id`, added by the server and never sent by the client.

### 6.5 Filter combination

Filters are ANDed and applied before sort, cursor and limit, in one statement. No OR mode, no negation, no
grouping — FR-TASK-012 specifies AND only, and anything richer needs a query language the contract lacks.

### 6.6 Exact query grammar per list endpoint

```
GET /api/v1/tasks
  ?q=<string≤200>                     (repeat: rejected)
  &status=todo|in_progress|completed   (repeat: rejected)
  &priority=low|medium|high
  &dueState=overdue|today|range|none
  &dueFrom=YYYY-MM-DD                  (only with dueState=range)
  &dueTo=YYYY-MM-DD                    (only with dueState=range; ≥ dueFrom)
  &hasAttachments=true|false
  &limit=<int 1..100, default 20>
  &cursor=<opaque 16..512>
  &sort=<key[,-key]>                   keys: updated_at|created_at|due_date|priority

GET /api/v1/notes
  ?q=<string≤200>
  &pinned=true|false
  &limit=<int 1..100, default 20>
  &cursor=<opaque 16..512>
  &sort=<key[,-key]>                   keys: pinned|updated_at|created_at
```

Parameter order is irrelevant; non-ASCII and reserved characters must be percent-encoded; the server
normalises nothing except trimming `q`. The sort column and direction come from a fixed map, never from
the request string (NFR-SEC-008).

## 7. Versioning and compatibility

| Concern | Rule |
|---|---|
| Scheme | URL-versioned `/api/v1`; no header negotiation, no version field |
| `v1` lifetime | the only version built and benchmarked; a `v2` would be served alongside, not instead |
| Additive (allowed in `v1`) | optional request field with a documented default; new response field; new endpoint; new allowlisted `sort` key; new `details[].code` for an existing rule; relaxed limit |
| Breaking (needs a new version) | removing/renaming a field; changing a type or nullability; adding an **enum value** to `status`/`priority`/`dueState`/`ErrorCode`; changing a status or error code for an existing outcome; changing a default; tightening validation; changing cursor encoding; changing auth requirements; lowering a rate limit |
| Nullability | both directions are breaking: a non-null→nullable change breaks exhaustive clients; nullable→non-null breaks clients that handle `null` |
| Not contract | key order; `message` text |
| Deprecation | `Deprecation: true` + `Sunset: <HTTP-date>` headers, changelog entry, kept for ≥1 milestone, both frontends migrated in the same PR series |
| Contract freeze (G3) | `packages/contracts` tagged at G3; after it, any shape/enum/route/rule change re-baselines both apps and re-runs the affected scenarios (C-14, NFR-RESEARCH-009). Mismatched build ids are never paired |
| Changelog discipline | a shared-shape change updates `.planning/` in the same PR; a contract change that skips this document is review-blocking |

The freeze forbids *silent* change, not additive work.

## 8. Upload and binary contract

### 8.1 Multipart shape (#18)

| Part | Content type | Required | Order |
|---|---|---|---|
| `file` | any; content is sniffed | yes, exactly one per request | any |
| `targetType` | text | yes | before `file` when possible |
| `targetId` | text (UUID) | yes | before `file` when possible |

One file per request (D-8, Q-03): the envelope has no multi-status body, so N files are N requests issued
by one user action.

### 8.2 Limits

| Limit | Value | Breach |
|---|---|---|
| Per file | 5 MiB (5 242 880 bytes) | `413 PAYLOAD_TOO_LARGE` |
| Per target | 10 attachments | `422`, `code="attachment_limit"` |
| Request | one file + fields ≤ 6 MiB | `413` |

### 8.3 Two-gate validation

| Gate | Checks | Rejection |
|---|---|---|
| 1. Content sniff | magic bytes via `file-type` ∈ `image/jpeg`/`image/png`/`image/webp`; SVG and everything else refused | `415 UNSUPPORTED_MEDIA_TYPE` |
| 2. Decode | `@jsquash` (Wasm WebP/JPEG codec) metadata read succeeds (catches polyglots and truncated files), yields `width`/`height` | `422 VALIDATION_FAILED`, `code="undecodable_image"` |

### 8.4 Per-file error reporting

One file per request, so a rejection is a normal error envelope whose `details[0]` names the file:

```jsonc
{ "error": { "code": "UNSUPPORTED_MEDIA_TYPE", "message": "That file type is not supported.",
             "requestId": "…",
             "details": [ { "field": "file", "code": "mime_not_allowed",
                            "message": "Only JPEG, PNG or WebP images are accepted.",
                            "file": "notes.txt" } ] } }
```

`file` is the basename only, stripped of path separators and truncated to 100 chars (D-9).

### 8.5 Write ordering and failure

| Step | Failure handling |
|---|---|
| 1. Validate target ownership (`SELECT … WHERE id AND user_id`) | absent/foreign → `404`, nothing written |
| 2. Validate file (size, sniff, decode) | reject before writing any R2 object |
| 3. Write the full binary to the R2 bucket | failure → `500`, no row |
| 4. Write the thumb (`≤320 px`, WebP) to the R2 bucket | failure → delete the just-written full object, `500`, no row |
| 5. One `env.DB.batch([...])`: count check, `INSERT attachments` (D1 single-writer atomicity) | failure → delete the just-written R2 objects, `422`/`500` |
| 6. Return `201` with the row | — |

The row is the commit point (`05` §6.1): binaries are written to the R2 bucket before the row is committed,
and deleted after the commit fails or the row is later removed — a crash before commit leaves an unreachable
object, swept later; a crash after commit leaves a consistent pair.

### 8.6 Stable order

Attachments are returned `created_at ASC, id ASC` everywhere, so the same target renders identically on
every load in both apps (FR-ATT-012). List payloads carry the first three of that order plus
`attachmentCount`.

### 8.7 Binary response semantics (#20)

| Concern | Rule |
|---|---|
| Variant | `?variant=thumb` (≤320 px, `image/webp`) or `full` (default, original bytes) |
| Auth | owner only, checked before any file is opened; absent/foreign/missing-binary all `404` |
| Headers | `Content-Type`, `Content-Length`, strong `ETag` (from the R2 object metadata), `Cache-Control: private, max-age=86400`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff` |
| Conditional | `If-None-Match` matching ⇒ `304`, no body |
| Range | not supported (Q-12); images are small and the lightbox needs the whole file |
| Never | the `storage_key` (the R2 object key), or any `/uploads/*` URL |

### 8.8 Thumbnail rendition

| Property | Value |
|---|---|
| Longest edge | ≤ **320 px** (D-6; the older 480 px figure is superseded) |
| Format | WebP, quality chosen once and recorded in the pipeline config |
| Orientation | EXIF orientation applied before resize, metadata not carried forward |
| Source of dimensions | the decode in gate 2; stored in `width`/`height`; declared on every `<img>` (FR-ATT-010) |

## 9. Consistency checks

### 9.1 Every endpoint traces to at least one requirement

| # | Endpoint | Requirement IDs | Consuming screen (`03` §8) |
|---|---|---|---|
| 1 | `POST /auth/register` | FR-AUTH-001/002/003 | Register |
| 2 | `POST /auth/login` | FR-AUTH-004/005 | Login |
| 3 | `POST /auth/logout` | FR-AUTH-007/013 | Account |
| 4 | `GET /auth/me` | FR-AUTH-009/010, FR-LAND-003 | all shell pages, Landing (Next) |
| 5 | `GET /users/me` | FR-AUTH-009 (identity) | Account |
| 6 | `PATCH /users/me` | **none** (D-1) | none |
| 7 | `GET /dashboard` | FR-DASH-001..009 | Dashboard |
| 8 | `GET /tasks` | FR-TASK-003/004/011..015 | Task list |
| 9 | `POST /tasks` | FR-TASK-001/002/018/020 | Task list, Dashboard CTA |
| 10 | `GET /tasks/:id` | FR-TASK-005/019 | Task detail |
| 11 | `PATCH /tasks/:id` | FR-TASK-006/007/009 | Task detail, Task list |
| 12 | `DELETE /tasks/:id` | FR-TASK-021, FR-ATT-011 | Task detail |
| 13 | `GET /notes` | FR-NOTE-003/004/008 | Note list |
| 14 | `POST /notes` | FR-NOTE-001/002 | Note list |
| 15 | `GET /notes/:id` | FR-NOTE-005/013 | Note detail |
| 16 | `PATCH /notes/:id` | FR-NOTE-006/007 | Note detail, Note list |
| 17 | `DELETE /notes/:id` | FR-NOTE-009 | Note detail |
| 18 | `POST /attachments` | FR-ATT-001/002/003/009/010 | Task/Note edit |
| 19 | `GET /attachments/:id` | FR-ATT-005 | Lightbox |
| 20 | `GET /attachments/:id/content` | FR-ATT-004/005/008 | Lists, detail, lightbox |
| 21 | `DELETE /attachments/:id` | FR-ATT-007 | Task/Note edit |
| 22 | `GET /health` | NFR-REL-007, NFR-OBS-005 | harness, proxy |

`#6` is the only untraced endpoint; it is retained with `displayName` as the sole writable field and
flagged for removal before G3 if no FR is added (D-1, Q-01).

### 9.2 Every owned resource has an explicit owner check

| Owned resource | Operations | Owner check | Decided in |
|---|---|---|---|
| `tasks` | #10, #11, #12 | `WHERE id AND user_id = $sessionUserId` | the same statement as the read/write |
| `notes` | #15, #16, #17 | same | same |
| `attachments` | #19, #20, #21 | same | same, before any file is opened |
| attachment target | #18 | target row must satisfy `id AND user_id` | the upload transaction |
| aggregates | #7 | every CTE scoped by `user_id` | the single dashboard statement |

### 9.3 Every error code in the closed set is used

| Code | HTTP | Emitted by (example) | Observable example |
|---|---|---|---|
| `VALIDATION_FAILED` | 422 | #9 with a 201-char title | `details[0].field="title"` |
| `UNAUTHENTICATED` | 401 | #10 without a cookie | no `Set-Cookie` when none presented |
| `NOT_FOUND` | 404 | #10 with a foreign id | identical to a random UUID |
| `CONFLICT` | 409 | #1 with an existing email | `field="email"` |
| `PAYLOAD_TOO_LARGE` | 413 | #18 with a 6 MiB file | `details[0].file` names it |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | #18 with a renamed `.txt` | `code="mime_not_allowed"` |
| `RATE_LIMITED` | 429 | #2 on the 11th attempt/minute | `Retry-After` present |
| `INTERNAL` | 500 | #20 when the R2 object read fails | no internals in `message` |

### 9.4 No endpoint can return another user's data

| Endpoint class | Why it cannot |
|---|---|
| Detail reads (#10, #15, #19, #20) | single-row predicate including `user_id` |
| List reads (#8, #13) | `WHERE user_id = $1` applied before filters, sort and cursor |
| Aggregates (#7) | every CTE carries `user_id`; no global totals exist |
| Writes (#11, #12, #16, #17, #21) | predicate inside the `UPDATE`/`DELETE`; zero rows → `404` |
| Creations (#9, #14, #18) | owner from the session; a body `userId` is a strict-schema `422` |
| Binary (#20) | row resolved (and therefore authorized) before the file is opened |

### 9.5 Every list endpoint paginates

| List-bearing response | Paginated? | Rule |
|---|---|---|
| #8 tasks | yes | `limit` + `cursor`, `nextCursor` |
| #13 notes | yes | same |
| #7 `recentTasks`/`recentNotes` | no, bounded | fixed `LIMIT 5`, no cursor, not user-expandable |
| #10/#15 `attachments` | no, bounded | ≤ 10 per target by contract |

## 10. Open questions

Every item has a default already applied, so implementation is not blocked.

| ID | Question | Blocks | Default taken here |
|---|---|---|---|
| Q-01 | Is #6 `PATCH /users/me` kept without an FR, or dropped before G3? | #6, account screen scope | Keep, `displayName`-only; dropping is cleaner if no FR is added |
| Q-02 | Does #1 accept `displayName` or derive it? | #1, register form | Optional field, default = email local part (≤100) |
| Q-03 | May one multipart request carry several files? | #18, §8.1, A-19 | One file per request; the UI issues N requests in one action |
| Q-04 | Is exact upload order required, or only stable order? | §8.6, `05` | `created_at ASC, id ASC`; a `position` column would make it exact |
| Q-05 | Should `/health` expose `storage` and use a success envelope on `503`? | #22, harness gating | Yes, per D-5; needs architect approval (O-3) |
| Q-06 | Atomic create-with-images? | #9, #14, J-03 | Two-step: create then upload |
| Q-07 | Which "today" decides `isOverdue` / `dueState=today`? | §4, #10 | Server UTC date per request |
| Q-08 | Is an `Idempotency-Key` needed for creates? | §1.4, #9 | No; double-submit guard is client-side (FR-TASK-018) |
| Q-09 | May `sort` carry more than two keys? | §6.4 | Two keys + `id` tiebreak |
| Q-10 | Is a 160-character `excerpt` right? | §3.6 | Yes, whitespace-collapsed, server-computed |
| Q-11 | Does an attachment change refresh the parent's `updated_at`? | #18, #21, FR-DASH-004 | Yes — the recent lists must reflect it |
| Q-12 | Is ignoring `Range` acceptable? | §8.7 | Yes; full body, `200` |
| Q-13 | Does a `401` always clear the cookie? | §2.1 | Only when a cookie was presented |
| Q-14 | Is last-write-wins acceptable on PATCH? | #11, #16 | Yes; no precondition/version field |
| Q-15 | `409` or `200` for login while authenticated? | #2 | `409 CONFLICT` |

## 11. Deviations from the locked surface

The locked 22 endpoints keep their paths, methods and numbering: none was removed or renamed. The
approved admin extension BCR-01 adds four endpoints as #23-#26 (D-12); nothing in the 22 changed.

| # | Item | Locked said | This document | Driver | Status |
|---|---|---|---|---|---|
| D-1 | #6 `PATCH /users/me` | Present, "update `displayName`" | Specified but recorded as untraced (no FR, no screen) | `01` §8 puts profile editing out of scope | **Objection** — retain or drop before G3 |
| D-2 | `GET /tasks` query surface | `q,status,priority,limit,cursor,sort=-updated_at\|-created_at\|-due_date` | Adds `dueState`, `dueFrom`, `dueTo`, `hasAttachments`; `sort` accepts four keys in both directions, up to two | O-9; FR-TASK-012/013 cannot pass otherwise | Accepted per O-9/OQ-2 |
| D-3 | `GET /notes` query surface | `q,pinned,limit,cursor,sort=-pinned,-updated_at` | `sort` accepts `pinned,updated_at,created_at` in both directions; default unchanged | Symmetry with D-2, FR-NOTE-003 | Accepted |
| D-4 | Error envelope | `{code,message,details}` | Adds `error.requestId` | NFR-OBS-002; `03` §4.1 already promises it | Additive, accepted |
| D-5 | `/health` payload and status | `{status,db}` | `{status,db,storage}`, `503` with a **success** envelope | O-3: readiness must reflect storage; an error envelope would lose the diagnostic | **Needs approval** |
| D-6 | Thumbnail size | "max 480 px" | ≤320 px, `image/webp` | O-8, FR-ATT-004 | Accepted; `05` matches |
| D-7 | #20 addressing | `/content` | `/content?variant=thumb\|full`, default `full` | O-8 needs two renditions through one authenticated endpoint | Accepted |
| D-8 | #18 multipart | fields `file,targetType,targetId` | Exactly one `file` part per request | The envelope has no multi-status body; A-19 needs per-file outcomes | Interpretation, not a change (Q-03) |
| D-9 | `ValidationDetail` | `{field,code,message}` | Adds optional `file` | FR-ATT-002 requires naming the rejected file | Additive |
| D-10 | Status codes | closed set omits `503`/`405` | `503` used by #22 only; `405` never used (unknown method → `404`) | `03` §6.3 specifies `503` for readiness | Recorded |
| D-11 | `GET /attachments/:id` | "metadata" | Full `Attachment` object, same shape as create | One schema per resource; lightbox needs dimensions and size | Additive |
| D-12 | Admin surface | absent | Adds #23-#26 `/admin/members*`, the `users.role`/`users.status` columns and the 404-not-403 rule for non-admins | BCR-01 approved; `design/09-admin-console.md`; the only cross-member read in the system | **Approved** |

Two things the locked surface leaves implicit, restated rather than changed: #1 and #2 both return
`SessionProbe` (Next's bootstrap and Astro's cookie round trip need the same shape), and #7 returns
breakdowns as flat count objects because FR-DASH-003 names exactly seven figures.
