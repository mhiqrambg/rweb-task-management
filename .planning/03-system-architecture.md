---
document: 03-system-architecture.md
phase: 1
stage: 4
prepared_by: system-architecture-analyst
reviewed_by: software-architect
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review, diagram-design]
  used: [backend-development, security-review, diagram-design]
  changed:
    - "backend-development: the API↔DB contract table (pool, one query per list, parameterized SQL, per-mutation transactions) and the readiness/pool-containment requirements came from it."
    - "security-review: produced the authoritative-vs-advisory enforcement table in §5.3 and the rule that unguessability is not a control."
    - "diagram-design: kept diagram node count low and labels identical to the canonical vocabulary; no HTML/SVG output, Mermaid only."
---

# 03 — System Architecture

Scope: the runtime shape of the product — who talks to what, which process owns which decision, and how
the two rendering paths differ. It consumes `01` (requirements), the architect-locked inputs and the
locked API surface. It does not define requirement text, endpoint bodies (`06`), schema DDL (`05`),
security controls in depth (`07`), the benchmark protocol (`08`) or test cases (`09`). Versions and
framework behaviour come from the verified-facts table; items marked `A-xx` are unverified assumptions.

## 1. System context

Two roles only (`00` §4). A **Visitor** reaches the landing, login and register pages. A **Member** —
the owner of every row they can see — reaches the dashboard, tasks, notes, account and attachment
binaries. No admin, no sharing, no public content, no second authorization axis.

The system boundary is one host and one origin. Everything needed runs inside it: two frontend
deliverables, one API, one database, one binary-storage volume, one reverse proxy. There is **no
external system** other than the browser and the host OS (Docker engine, volumes, host cron, TLS
material). No email transport (A-06), no object storage, no CDN, no analytics (NFR-OBS-004 forbids
third-party requests outright).

```mermaid
flowchart LR
  Visitor["Visitor"] --> Browser["Browser - one origin"]
  Member["Member - owner"] --> Browser
  Browser -->|"HTTPS, sid cookie"| Proxy["Reverse proxy - single origin"]
  subgraph System["System boundary - one host"]
    Proxy --> Astro["web-astro - on-demand SSR"]
    Proxy --> Next["web-next - static export"]
    Proxy --> Api["api - Fastify REST"]
    Api --> Pg[("PostgreSQL 16")]
    Api --> Store["Binary storage - UPLOAD_ROOT volume"]
  end
  HostOs["Host OS - Docker engine, volumes, cron, TLS material"] -.->|"runs and schedules"| System
```

Trust boundaries: the browser is untrusted input; the proxy is **not** an authorization point; the API
is the only component that decides access; PostgreSQL and the storage volume are inside the trust
boundary but are never reachable from the browser.

## 2. Architecture style and components

**Deliverable shape: 3 deployables + 1 database + 1 origin.**

| # | Deliverable | Runtime form | Deployable? |
|---|---|---|---|
| 1 | `apps/api` | Fastify process, port 3001 | yes |
| 2 | `apps/web-astro` | Astro on-demand server (`@astrojs/node`, standalone), port 4321 | yes |
| 3 | `apps/web-next` | Next static export artifact — **no runtime process**; files served by the proxy | yes (build artifact) |
| 4 | PostgreSQL 16 | one instance, one database | datastore |
| 5 | reverse proxy | one origin in front of all of the above | infrastructure, not a product application |

The style is a **modular monolith API inside a three-deployable system** (ADR-01, ADR-15). Modules share
one process, one connection pool and one migration history; they are separated by directory, route
prefix and repository ownership, not by network calls. The two frontends never share component source
(ADR-12) and never talk to each other.

```mermaid
flowchart TB
  Browser["Browser - one origin"]
  Proxy["reverse-proxy - nginx"]
  Astro["web-astro - Astro 7.4.x, on-demand SSR"]
  Next["web-next - Next 16.4.x, static export"]
  subgraph ApiBox["api - Fastify 5.12.x, one process"]
    ApiEdge["HTTP entry - plugins, error envelope, logger, request id"]
    AuthM["auth module"]
    TasksM["tasks module"]
    NotesM["notes module"]
    AttM["attachments module"]
    DashM["dashboard module"]
    HealthM["health module"]
    DbLayer["db - pg Pool, parameterized SQL"]
    ApiEdge --> AuthM
    ApiEdge --> TasksM
    ApiEdge --> NotesM
    ApiEdge --> AttM
    ApiEdge --> DashM
    ApiEdge --> HealthM
    AuthM --> DbLayer
    TasksM --> DbLayer
    NotesM --> DbLayer
    AttM --> DbLayer
    DashM --> DbLayer
    HealthM --> DbLayer
  end
  Contracts["packages/contracts"]
  Tokens["packages/design-tokens"]
  Pg[("PostgreSQL 16")]
  Store[("Binary storage - UPLOAD_ROOT")]
  Browser --> Proxy
  Proxy --> Astro
  Proxy --> Next
  Proxy --> ApiEdge
  Astro -->|"server-side fetch, Cookie header forwarded"| ApiEdge
  Browser -->|"client fetch, credentials include"| Proxy
  AttM --> Store
  DbLayer --> Pg
  Contracts -.->|"build-time import"| Astro
  Contracts -.->|"build-time import"| Next
  Contracts -.->|"build-time import"| ApiBox
  Tokens -.->|"build-time import"| Astro
  Tokens -.->|"build-time import"| Next
```

### 2.1 Component responsibilities and boundaries

| Component | Responsibility | Boundary — what it must NOT do | Owns (data/state) |
|---|---|---|---|
| `web-astro` | Render every page per request; decide the page's auth state **before** emitting HTML; forward the incoming `Cookie` to the API; render forms that post to its own endpoints; reload the document after a write | Must not connect to PostgreSQL, generate storage keys, decide ownership, cache another user's data across requests, re-fetch client-side data already rendered in HTML, serve binaries, or hold credentials | Per-request render context only; one short-lived `flash` cookie (success wording). No durable data |
| `web-next` | Serve one static shell for all authenticated views; parse `?view=&id=&mode=`; bootstrap identity via `GET /api/v1/auth/me`; fetch data client-side; render loading/empty/error states | Must not read `sid` (it is `HttpOnly`), be treated as access control, contain user data in build output or source maps, call the database, or upload directly to storage | In-memory per-view response cache and route state; cleared on every auth transition |
| `api` | Own session issuance and verification, authorization, validation, persistence, upload validation, binary streaming, readiness | Must not render HTML, hold UI state, trust a client-declared owner, MIME type, size or filename, serve `UPLOAD_ROOT` statically, or log secrets | `users`, `sessions`, `tasks`, `notes`, `attachments` rows; binaries and thumbnails; in-process rate-limit counters |
| `api` → `auth` module | Register, login, logout, `/auth/me`, Argon2id hashing, session row lifecycle, cookie set/clear, auth rate limits | Must not read task/note tables except through its own repository calls; must not expose password material in any response or log | `users`, `sessions` |
| `api` → `tasks` module | Task CRUD, list with `q`/filters/sort/cursor, ownership predicate in every statement | Must not compute dashboard aggregates (that is `dashboard`), write attachment rows, or build SQL from strings | `tasks` |
| `api` → `notes` module | Note CRUD, pinned ordering, search, cursor pagination | Must not touch tasks; must not change `pinned` on a title/body edit (FR-NOTE-006) | `notes` |
| `api` → `attachments` module | Multipart intake, size and count limits, content sniffing, decode validation, generated storage keys, thumbnail generation, owner-scoped streaming, delete | Must not derive a path from a client filename, accept a client MIME claim, write outside `UPLOAD_ROOT`, or serve a row whose binary is missing (NFR-REL-003) | `attachments` rows, binary files, thumbnails |
| `api` → `dashboard` module | One round trip returning counters, breakdown, overdue count and 5 + 5 recent items for the session owner | Must not return global counts, other users' rows, or run per-widget queries from the client | No rows; reads `tasks`/`notes` under the same ownership predicate |
| `api` → `health` module | Liveness and readiness for the proxy and the harness | Must not require auth, be rate-limited, or leak versions, connection strings or counts | No data |
| `packages/contracts` | Single source of entity types, Zod schemas, error codes, copy strings, route constants, formatting helpers | Must not import Astro, React, Next, Fastify or `pg`; must not perform I/O; must not contain framework code | Shape authority for both apps and the API |
| `packages/design-tokens` | `tokens.css` + `tokens.json`, the only source of colour, type, space, radius, breakpoints | Must not contain component CSS, selectors for a specific markup structure, or application logic | Token values |
| Binary storage (local volume) | Hold full-resolution binaries and one ≤320 px thumbnail per attachment under server-generated keys | Must not be URL-addressable, be the authority for existence (the row is), or be reachable except through the API's stream handler | Bytes and derivative files |
| PostgreSQL 16 | Hold all durable relational state; enforce enums, ownership, referential integrity, uniqueness, `num_nonnulls` on attachments | Must not be reachable from a frontend or from outside the compose network; must not be the only place ownership is checked | Every row |
| Reverse proxy | Present one origin; route `/`, `/b/*`, `/api/*`; serve the Next artifact; terminate TLS; refuse `/uploads/*` | Must not make authorization decisions, rewrite response bodies, cache authenticated responses, or forward `/uploads` anywhere | Origin identity, routing table, TLS material |

Data ownership follows the locked split: `users`/`sessions` belong to `auth`; `tasks`/`notes` to their
modules; `attachments` to `attachments` with `task_id`/`note_id` nullable FKs and
`CHECK (num_nonnulls(task_id, note_id) = 1)`. Deleting a task or note cascades attachment **rows** in the
database; binary removal is a separate storage call performed after the transaction commits.

## 3. Rendering paths

The two frontends are not two configurations of one design. They produce HTML at different times, from
different processes, with different data available. Everything below follows from that.

### 3.1 Astro — on-demand SSR, multi-page navigation

- **The adapter is mandatory.** On-demand rendering requires an adapter; `output: 'server'` only flips
  the per-route default. This project uses `@astrojs/node` in `mode: 'standalone'`: standalone owns its
  HTTP server, which is the unit the proxy addresses and needs no host application to mount into.
  `mode: 'middleware'` would only help if we already ran a Node server to embed in; we do not.
  (docs.astro.build/en/guides/on-demand-rendering; ADR-13 records the adapter as a choice among the four
  official adapters, not a law.)
- **`prerender` per route.** Because `output: 'server'` makes every route on-demand by default, each page
  declares `export const prerender = false` explicitly, so a future global default change cannot silently
  prerender a per-user page. A repository test asserts every page module contains that declaration.

| Route | `prerender` | Reason |
|---|---|---|
| `/` | `false` | must read `sid` to choose the dashboard CTA over the register CTA (FR-LAND-003; ADR-13) |
| `/login`, `/register` | `false` | a signed-in Member is offered the dashboard instead (permission matrix row 2) |
| `/app` | `false` | per-user aggregates (FR-DASH-002) |
| `/tasks`, `/tasks/[id]`, `/tasks/[id]/edit` | `false` | per-user rows; dynamic segment resolved per request |
| `/notes`, `/notes/[id]` | `false` | per-user rows |
| `/account` | `false` | per-user profile read |
| `/404` | `false` | keeps one header/nav render path |

- **Cookie forwarding.** `Astro.request.headers.get('cookie')` is copied verbatim into the server-side
  request to the API (`Cookie` header), with `Accept: application/json` and a generated request id.
  Nothing else is forwarded. The API's `401` becomes
  `Astro.redirect('/login?next=' + encodeURIComponent(pathname + search))` — before any protected markup
  exists in the response. (`Astro.cookies`/`Astro.request` exist only on on-demand routes; a prerendered
  page could not read them — that is the structural reason for the table above.)
- **SSR data fetch.** Each document performs its API reads server-side and renders the result into HTML:
  dashboard one call (`GET /api/v1/dashboard`), list pages one call each, detail pages one call plus
  image URLs the browser resolves later. Server-side calls target the internal service URL
  (`PUBLIC_API_BASE_URL`, e.g. `http://api:3001/api/v1`) read via `process.env` at request time — never
  `import.meta.env`, which is inlined at build.
- **Writes.** Forms post to Astro endpoints (`src/pages/*.ts` handlers such as `POST /tasks/create`) which
  proxy to the API, forward `Set-Cookie` from login/register verbatim, then answer `303` to the
  destination with a short-lived `flash` cookie carrying the success wording (FR-UI-004 must survive the
  reload an MPA performs).
- **Navigation.** Every navigation is a new document: new HTML, revalidated hashed CSS/JS, fresh image
  requests. History and deep links are native browser behaviour; no router exists. There is no framework
  runtime on the client — enhancement is plain inline `<script>` for dialog focus, lightbox and
  double-submit guards.
- **Runtime env.** All configuration is runtime: `PUBLIC_API_BASE_URL`, `NODE_ENV`, `LOG_LEVEL`, `PORT`.
  One build artifact is promotable; image and environment are independent.

### 3.2 Next.js — static export, single shell, query-param client router

- **Export configuration.** `output: 'export'`, `basePath: '/b'`, `images: { unoptimized: true }`,
  `trailingSlash: true` so each route emits `<route>/index.html` and the proxy can serve directories with
  `try_files`.
- **What the export forbids** (verified, nextjs.org/docs/app/guides/static-exports): dynamic routes
  **without** `generateStaticParams`; **Proxy** (renamed from middleware in Next 16); ISR/revalidation;
  Draft Mode; Route Handlers **that rely on `Request`**. A `GET` Route Handler with
  `export const dynamic = 'force-static'` is emitted as a static file — none is used here, because no
  per-user response can be a static file. `cookies()`/`headers()` do not throw under export; no request
  exists at build time, so they return empty values.
- **Single static shell.** `/tasks/[id]` cannot exist: `generateStaticParams` runs at build time and can
  only enumerate ids that exist then, while task ids are created by users at runtime. The route strategy
  is therefore one document for every authenticated view:

| View | URL | Static file |
|---|---|---|
| Landing | `/b/` | `out/index.html` |
| Login / Register | `/b/login`, `/b/register` | `out/login/index.html`, `out/register/index.html` |
| Dashboard | `/b/app/?view=dashboard` | `out/app/index.html` |
| Task list | `/b/app/?view=tasks` | same file |
| Task detail | `/b/app/?view=tasks&id=<uuid>` | same file |
| Task edit | `/b/app/?view=tasks&id=<uuid>&mode=edit` | same file |
| Note list / detail | `/b/app/?view=notes[&id=<uuid>]` | same file |
| Account | `/b/app/?view=account` | same file |
| Not found | any unmatched path | `out/404.html`, served by the proxy |

  The router reads `useSearchParams` inside a `<Suspense>` boundary whose fallback is the same skeleton
  (A-24: exact constraint to be re-confirmed against the pinned 16.4.x at T-701) and drives
  `history.pushState`/`replaceState`, so FR-TASK-014 (URL-authoritative state, Back/Forward) holds
  without any server involvement.
- **Auth bootstrap.** The shell cannot know identity at parse time. On boot it issues
  `GET /api/v1/auth/me` with `credentials: 'include'`: `200 {data:{user, expiresAt}}` renders the app;
  `401` replaces the route with `/b/login?next=…`. Immediately after a successful login the probe is
  skipped because identity is already server-derived. The gate is **UX only** — the API is the gate (§5).
- **Skeleton and CLS budget.** Header, sidebar and content boxes are dimension-stable and identical for
  every view; every skeleton occupies exactly the final element's box; thumbnails reserve a fixed 4:3 box
  with declared `width`/`height`; toasts are fixed-position overlays that never push content
  (NFR-PERF-002, FR-ATT-010). The auth-check state is a shell state, not a spinner over empty layout.
- **`basePath` effects.** Assets live under `/b/_next/*`; every `fetch` targets the absolute same-origin
  path `/api/v1/...` (`NEXT_PUBLIC_API_BASE_URL=/api/v1`, build-time) because `basePath` does not rewrite
  `fetch`; links are `next/link` with basePath-relative hrefs.

### 3.3 Comparison of the two paths

| Dimension | Astro (MPA + SSR) | Next.js (SPA over static export) |
|---|---|---|
| First paint of an authenticated page | First byte is final HTML containing data; the LCP candidate is server HTML. No JavaScript is required to show content | First byte is the same shell for every user: chrome + skeleton. Content appears after two sequential client round trips (auth probe → data), unless the probe result is already in memory |
| Data fetch origin | Astro **server** → API over the internal network, once per document; the incoming cookie is forwarded | **Browser** → API over the public origin, once per view after bootstrap; the browser attaches the cookie, JS never reads it |
| Navigation cost | Full document per navigation: HTML + revalidated CSS/JS + images. History and scroll restore are native | One-time JS/CSS cost for the shell and shared bundle; later navigations are a client transition plus a JSON payload, with no HTML re-parse and no shell re-render |
| Auth gating | Server-side, before any HTML: no/expired cookie → `302 /login`; protected markup never reaches an unauthenticated browser | Client-side, after parse: shell renders, probe returns `401`, route is replaced. Advisory only; every protected byte still comes from an authorized API call |
| Deep-link behaviour | URL resolves on the server per request with data included; `?next=` return path is a server redirect | Same URL returns the identical static shell; the id is parsed client-side and fetched after hydration. End state matches; one round trip later |
| Payload composition | HTML carrying data + CSS + minimal inline JS + images. Each navigation re-sends the page chrome inside the document | Static shell HTML + shared JS bundle (React, router, Zod) once per session, then JSON per view. JSON is smaller than HTML, but the bundle is an entry cost paid before the first authed paint |
| What the path cannot do | No client-side transitions: a filter or sort change costs a document unless scripted enhancement is added; authenticated pages cannot be cached by a CDN or served as files | No per-user HTML, no server redirect, no proxy/middleware, no ISR, no dynamic route segment; `/tasks/[id]` is impossible; the landing CTA cannot be resolved from the cookie without a client probe (FR-LAND-003/005 tension — §12) |

The comparison is deliberately not symmetric at the mechanism level — that asymmetry *is* the measured
variable (NFR-RESEARCH-001 requires identical features, not identical mechanisms).

## 4. Communication and data flows

### 4.1 Browser ↔ API contract

| Concern | Rule |
|---|---|
| Success envelope | `{ "data": <payload> }`; lists `{ "data": [...], "page": { "limit": 20, "nextCursor": "<opaque>\|null" } }`. Never a bare array or scalar. `204` has no body |
| Error envelope | `{ "error": { "code", "message", "requestId", "details": [ { field, code, message, file? } ] } }`; closed code set `VALIDATION_FAILED` 422, `UNAUTHENTICATED` 401, `NOT_FOUND` 404, `CONFLICT` 409, `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `RATE_LIMITED` 429, `INTERNAL` 500. Ownership failure is `NOT_FOUND`, never `403` (NFR-SEC-005) |
| Ids and time | UUID strings; timestamps ISO-8601 UTC with `Z`; `due_date` is `YYYY-MM-DD` |
| Pagination | Opaque `cursor` = base64url of the last row's sort key plus `id`; the server builds a keyset predicate and fetches `limit + 1` rows to decide `nextCursor`. Malformed cursor → `VALIDATION_FAILED`. `offset` is not accepted (FR-TASK-003) |
| Credentials | `credentials: 'include'` on every browser call. This is a **browser/CORS rule, not a framework feature**: it requires a concrete `Access-Control-Allow-Origin` (never `*`) plus `Access-Control-Allow-Credentials: true`, and `SameSite=None; Secure` for cross-site cookies. In production the same-origin proxy makes the cookie first-party, so no CORS is configured at all; `include` is kept only so the dev cross-origin case (§6.4) behaves identically |
| Caching | JSON responses `Cache-Control: no-store`. Binary responses `Cache-Control: private, max-age=86400`, strong `ETag`, `304` on `If-None-Match` |
| Content types | `application/json; charset=utf-8` for JSON; `multipart/form-data` for uploads only |

### 4.2 API ↔ PostgreSQL contract

| Concern | Rule |
|---|---|
| Pool | One `pg.Pool` per API process, small fixed `max` (proposed 10), `idleTimeoutMillis` and `statement_timeout` set; pool errors logged and never crash the process (NFR-REL-004) |
| Query count | One query per list or detail operation — attachments aggregated with `LEFT JOIN LATERAL (... json_agg ...)` rather than an N+1 loop; the dashboard is one statement using CTEs |
| Parameterization | Every value is a bound parameter; no string interpolation of input into SQL (NFR-SEC-008). Identifiers come from fixed allowlists, never from input |
| Ownership | Every owned-row statement carries `AND user_id = $sessionUserId` in the same statement that reads or mutates the row; a separate pre-check is not used |
| Transactions | Each mutation is one transaction; the binary is written before the attachment row so a row never points at a missing file (NFR-REL-003) |

### 4.3 Flow (a) — login → cookie → first authenticated Astro render

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant P as Reverse proxy
  participant A as web-astro
  participant S as api
  participant D as PostgreSQL

  B->>P: POST /login form email and password
  P->>A: forward same origin
  A->>S: POST /api/v1/auth/login
  S->>D: SELECT user by email
  S->>S: verify Argon2id hash
  S->>D: INSERT session token_hash expires_at last_used_at
  S-->>A: 200 data user and 401 alternative
  A-->>B: 303 Location /app plus Set-Cookie sid plus flash cookie
  B->>P: GET /app with sid
  P->>A: forward with Cookie
  A->>S: GET /api/v1/auth/me with forwarded Cookie
  S->>D: SELECT session join user
  S-->>A: 200 data user expiresAt
  A->>S: GET /api/v1/dashboard with forwarded Cookie
  S->>D: one CTE statement scoped to user_id
  S-->>A: 200 data counts breakdown recent
  A-->>B: 200 HTML containing the dashboard
  Note over B: LCP candidate is server HTML, no client fetch waterfall
```

Failure branches: `401` at `/auth/me` → `302 /login?next=%2Fapp` with no protected markup; `CONFLICT` at
register → form re-rendered with the email retained and the password cleared (FR-AUTH-002); any `5xx` →
error state with retry (FR-UI-003).

### 4.4 Flow (b) — login → cookie → shell boot → `/auth/me` → data in Next.js

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant P as Reverse proxy
  participant N as web-next static
  participant S as api
  participant D as PostgreSQL

  B->>P: GET /b/login
  P-->>B: static login HTML from export
  B->>P: POST /api/v1/auth/login credentials include
  P->>S: forward
  S->>D: SELECT user INSERT session
  S-->>B: 200 data user plus Set-Cookie sid
  B->>B: client router replace to /b/app/?view=dashboard
  Note over B,N: shell HTML is already parsed, no document reload
  B->>P: GET /api/v1/dashboard credentials include
  P->>S: forward with Cookie
  S->>D: one CTE statement scoped to user_id
  S-->>B: 200 data counts breakdown recent
  B->>B: render dashboard into reserved boxes
  Note over B: cold reload repeats GET /auth/me first then the data call
```

Cold boot (reload or deep link) inserts `GET /api/v1/auth/me` before the data call; `401` replaces the
route with `/b/login?next=<whitelisted internal path>` and clears the per-view cache. The skeleton is on
screen for the whole interval and must not change size.

### 4.5 Flow (c) — multipart upload → sniff → store → metadata → thumbnail

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant S as api
  participant D as PostgreSQL
  participant F as Binary storage

  B->>S: POST /api/v1/attachments multipart file targetType targetId
  S->>D: SELECT target row WHERE id AND user_id
  alt target absent or foreign owned
    S-->>B: 404 NOT_FOUND
  else owner
    S->>S: enforce 5 MB per file and count under 10
    S->>S: sniff magic bytes, allow jpeg png webp only
    S->>S: decode and read dimensions, reject undecodable
    S->>S: generate attachment id and storage key
    S->>F: write full file then rename into place
    S->>F: write thumbnail variant max 320 px
    S->>D: INSERT attachments row with width height
    S-->>B: 201 data attachment
  end
  Note over S,F: binary is written before the row, so a served row always has a readable file
```

Rejections are per file and name the file and reason: `UNSUPPORTED_MEDIA_TYPE` (415),
`PAYLOAD_TOO_LARGE` (413), `VALIDATION_FAILED` (422) for count and target-type errors. On any failure the
written file is unlinked; a crash between write and unlink leaves an orphan binary, swept by §11. Astro
reloads the target document after success; Next appends the new thumbnail in place (FR-ATT-003).

### 4.6 Flow (d) — authenticated binary read

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant P as Reverse proxy
  participant S as api
  participant D as PostgreSQL
  participant F as Binary storage

  B->>P: GET /api/v1/attachments/:id/content?variant=thumb
  P->>S: forward with Cookie
  S->>D: SELECT storage_key mime size FROM attachments WHERE id AND user_id
  alt no row or foreign owner
    S-->>B: 404 NOT_FOUND identical body and timing class
  else owner
    S->>F: read UPLOAD_ROOT slash storage_key or thumb variant
    S-->>B: 200 bytes with Content-Type ETag Cache-Control private and nosniff
  end
  Note over B,S: address guessing is never the control, the WHERE user_id is
```

The path is composed only from `UPLOAD_ROOT` and the server-generated `storage_key`; it is resolved and
asserted to remain inside the root before reading (NFR-SEC-009). `If-None-Match` matching the stored
`ETag` returns `304`.

### 4.7 Task status transition model

```mermaid
stateDiagram-v2
  [*] --> todo: create with default todo
  [*] --> in_progress: create with explicit status
  [*] --> completed: create with explicit status
  todo --> in_progress: PATCH status
  todo --> completed: PATCH status
  in_progress --> todo: PATCH status
  in_progress --> completed: PATCH status
  completed --> todo: PATCH status
  completed --> in_progress: PATCH status
  completed --> [*]: DELETE task
  todo --> [*]: DELETE task
  in_progress --> [*]: DELETE task
```

All six transitions are legal; there is no workflow restriction beyond the three canonical values
(FR-TASK-009). Repeated identical status changes are idempotent (NFR-REL-005). Deleting removes the row
and cascades attachment rows.

## 5. Authentication and session flow

### 5.1 Cookie and token

| Property | Value | Driver |
|---|---|---|
| Name | `sid` | canonical constant (FR-AUTH-004) |
| Value | opaque token, 32 random bytes from a CSPRNG, base64url-encoded | NFR-SEC-002 |
| `HttpOnly` | yes — no script access, no duplication into storage | FR-AUTH-004, FR-AUTH-012 |
| `SameSite` | `Lax` | NFR-SEC-006: blocks cookie attachment on cross-site unsafe methods while keeping top-level navigation usable |
| `Path` | `/` | one cookie for `/`, `/b` and `/api` |
| `Domain` | absent (host-only) | prevents subdomain leakage; only one host exists |
| `Secure` | set when `NODE_ENV=production` | NFR-SEC-003; the measured stack runs over TLS at the proxy so the production-shaped cookie works |
| `Max-Age` | 604800 (7 days) at login; re-issued with the remaining absolute lifetime on refresh | api-surface cookie contract |
| Server storage | `sessions.token_hash` = SHA-256 of the token (`bytea`, unique). The plaintext token never persists | NFR-SEC-002 |

### 5.2 Rotation, expiry, revocation

| Mechanism | Rule |
|---|---|
| Absolute expiry | `created_at + 7 days`, stored in `expires_at`, never extended. A session dies at day 7 regardless of activity (FR-AUTH-006) |
| Idle expiry | `last_used_at + 24 h`; evaluated on every read. An idle session is refused even before its absolute expiry |
| Refresh | At most once per hour: if `now - last_used_at ≥ 1h`, the row's `last_used_at` is updated and the cookie re-issued with `Max-Age` equal to the remaining absolute lifetime. No token rotation on refresh — concurrent requests from two tabs would race and one would be refused; a leaked token is bounded by the 24 h idle window and the 7-day absolute cap |
| Issuance | New token on register and on login only. Logging in while a session exists is refused (permission matrix row 4) |
| Revocation on logout | `DELETE FROM sessions WHERE token_hash = $1`, then `Set-Cookie: sid=; Max-Age=0; Path=/`. Other tabs and devices are refused at their next request (FR-AUTH-007, FR-AUTH-013) |
| Cross-tab invalidation | Any authenticated response with `401` clears client state: Astro's next document request redirects; Next.js clears its per-view cache and replaces the route (FR-AUTH-010) |

### 5.3 Authoritative vs advisory enforcement

The server is the only place a rule is decided (G-2, NFR-SEC-004). Each row names the layer that
*decides* and the layer that merely *avoids a pointless request*.

| Control | Authoritative layer | Advisory layer | Why the advisory layer is not the protection |
|---|---|---|---|
| Route gate on `/app`, `/tasks*`, `/notes*`, `/account` | API: every request without a valid `sid` is `401 UNAUTHENTICATED` | Astro: server-side `302 /login` before HTML; Next.js: client redirect after the `401` probe | `curl` without a cookie against the protected endpoints still yields `401`; forged markup never exists in either app |
| Post-login return to the requested destination | API: the destination is re-fetched with the session cookie | Astro: `?next=` server redirect, path validated as app-internal; Next.js: `?next=` client replace, same whitelist | A crafted `next` outside the whitelist is discarded; no open redirect and no data exposure |
| Ownership filter on tasks, notes, attachments | SQL predicate `AND user_id = $sessionUserId` inside the same statement; absent and foreign rows produce an identical `404` | The UI never performs a per-row permission check — there is nothing for it to check | Cross-owner test matrix asserts `404` for every operation on a foreign id (NFR-SEC-005) |
| Aggregate counts | `dashboard` SQL scoped by `user_id` | — (no client computation) | No global totals endpoint exists; a foreign row can never contribute to a counter |
| Attachment binary retrieval | `attachments` SQL join on `user_id`; path built from the server key only | Not the UUID: unguessability is a property, not a control (NFR-SEC-010) | Anonymous and cross-owner requests to real addresses return `404` with no bytes |
| Rate limiting | `@fastify/rate-limit` in the API: 10/min/IP auth mutations, 20/min/user uploads, 300/min/user other authed, `/health` exempt | Disabled submit button, client-side count check (FR-UI-012) | A scripted burst bypassing the UI is still throttled with `RATE_LIMITED` 429 |
| CSRF / same-origin on unsafe methods | API: `SameSite=Lax` plus `Origin`/`Sec-Fetch-Site` validation on `POST`/`PATCH`/`DELETE`; `multipart/form-data` is form-CORS-safelisted, so the origin check is mandatory for uploads | Forms are same-origin by construction; no token is rendered into pages | A cross-site form post arrives without the `Lax` cookie (`401`) and with a foreign `Origin` (refused as `401`) — indistinguishable from an absent session |
| `/uploads/*` | Proxy: the path is never proxied and returns `404` locally | — | Binaries exist only behind `/api/v1/attachments/:id/content` |
| Next.js authenticated rendering | API: every protected payload requires the cookie | **Next.js client gate is UX only** — it prevents a broken screen, not access | Disabling JavaScript or editing the shell yields no data: the data comes from the API under the cookie |

## 6. Deployment and runtime topology

### 6.1 Topology

```mermaid
flowchart LR
  Harness["Benchmark harness - Playwright + Lighthouse on the host"]
  Dev["Developer browser"]
  subgraph Host["Single Linux host - Docker Compose"]
    Proxy["proxy - nginx, TLS, one origin"]
    AstroC["web-astro container - node standalone :4321"]
    ApiC["api container - Fastify :3001"]
    PgC[("pg container - PostgreSQL 16 :5432 internal only")]
    StaticB["next export artifact mounted read-only at /srv/b"]
    Vol[("uploads volume - UPLOAD_ROOT")]
    Logs["docker json-file logs - rotated"]
  end
  Dev -->|"https one origin"| Proxy
  Harness -->|"https one origin, same host"| Proxy
  Harness -->|"readiness gate"| Proxy
  Proxy -->|"/ and /login and /app and /tasks and /notes"| AstroC
  Proxy -->|"/b/* from filesystem root"| StaticB
  Proxy -->|"/api/*"| ApiC
  Proxy -->|"/uploads/* never proxied"| Proxy
  ApiC --> PgC
  ApiC --> Vol
  AstroC -->|"server-side fetch over compose network"| ApiC
  AstroC --> Logs
  ApiC --> Logs
  Proxy --> Logs
```

There is no `web-next` process in production: the export artifact is a directory served by the proxy
(see §12, O-1). One origin, one host, no horizontal scaling (A-03).

### 6.2 Path table

| Path | Served by | Notes |
|---|---|---|
| `/` | `web-astro:4321` | Astro owns the root; on-demand for the cookie-aware CTA |
| `/login`, `/register`, `/app`, `/tasks*`, `/notes*`, `/account`, `/404` | `web-astro:4321` | all on-demand |
| `/b/`, `/b/login`, `/b/register`, `/b/app/`, `/b/404.html` | proxy `root /srv/b` | static export; `try_files $uri $uri/ $uri/index.html /b/404.html` |
| `/b/_next/*` | proxy `root /srv/b` | immutable hashed assets, long `Cache-Control` |
| `/api/*` | `api:3001` | prefix preserved; Fastify routes `/api/v1/*` |
| `/uploads/*` | proxy `return 404` | never proxied |
| `/healthz` | proxy static file | proxy liveness only, no application data |

Route order in the proxy is `/b/`, `/api/`, `/uploads/` before `/` — otherwise the Astro catch-all would
swallow the Next artifact and the API.

### 6.3 Health, readiness, logs, harness access

- `GET /api/v1/health`, public, unauthenticated, exempt from rate limiting, returns `{ status, db }` with
  `200` when the database answers and `503` otherwise. Readiness (not just liveness) is what the harness
  gates on before a run (NFR-REL-007). The locked surface carries no storage signal; see §12 O-3.
- Proxy liveness: `/healthz` static file. Astro liveness: HTTP `200` on `/login`.
- Logs: one JSON object per request to stdout from the API (`pino`), plus Astro request logs and proxy
  access logs; collected by the Docker `json-file` driver with `max-size`/`max-file` rotation. No log
  shipper, no SaaS collector (NFR-OBS-001, NFR-OBS-004).
- Harness access: Playwright drives `https://<host>/` and `https://<host>/b/` through the proxy, in the
  same browser, viewport and network profile, never while the other app is under load (NFR-PERF-007).
  TLS terminates at the proxy with a lab certificate; the Playwright context sets `ignoreHTTPSErrors` so
  the certificate is not a variable, while the scheme stays `https` so `Secure` cookies behave as in
  production.

### 6.4 Development equivalent, and why it is never measured

| App | Dev mechanism | Consequence |
|---|---|---|
| `web-astro` | Astro dev server with a Vite `server.proxy` entry for `/api` → `http://localhost:3001` | same-origin in dev; no CORS needed |
| `web-next` | `next dev` cannot use `rewrites` under `output: 'export'`; it uses an absolute `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1` plus a dev-only `@fastify/cors` allowlist `['http://localhost:3000']` with `credentials: true` | ports differ but the site is the same, so the `Lax` cookie still travels (cookie scope ignores ports); CORS is still required because the origin differs. `origin: '*'` must never be used — with `credentials: true` browsers reject it. `Secure` is off because dev is `http` |
| `api` | `tsx watch` with the same env contract | — |

Dev servers are excluded from all measurement (C-09, NFR-PERF-006); the dev CORS allowlist is registered
only when `NODE_ENV !== 'production'` and is absent from the measured stack.

## 7. Repository and project structure

```
rweb-task-management/
├── apps/
│   ├── api/                      # Fastify 5.12.x + TypeScript, the only component that talks to PostgreSQL
│   │   ├── src/{server.ts,app.ts,config/,plugins/,modules/{auth,tasks,notes,attachments,dashboard,health}/,db/,lib/,scripts/}
│   │   ├── migrations/           # numbered forward-only SQL, node-pg-migrate compatible
│   │   ├── test/{unit,integration}/
│   │   └── storage/              # dev-only upload root (gitignored)
│   ├── web-astro/                # Astro 7.4.x, output 'server', @astrojs/node standalone
│   │   └── src/{pages,layouts,components,lib,styles,assets}/
│   └── web-next/                 # Next.js 16.4.x App Router, output 'export', basePath '/b'
│       └── src/{app,components,lib,styles}/
├── packages/
│   ├── contracts/                # types + Zod schemas + error codes + copy + route constants
│   ├── design-tokens/            # tokens.css + tokens.json, single source for both frontends
│   ├── test-utils/               # fixture factories, dataset generator, API client for tests
│   └── config/                   # shared tsconfig bases, eslint flat config, prettier
├── assets/                       # shared static media (landing hero, preview shots, seed images)
├── infra/                        # docker-compose.yml, reverse-proxy.conf, Dockerfiles, TLS material (gitignored)
├── scripts/                      # seed, dataset generator, benchmark runner, storage sweep
├── docs/                         # final comparative report + diagrams (non-planning)
├── .planning/                    # this blueprint
├── DEVELOPMENT-GUIDELINES.md
└── # package.json / pnpm-workspace.yaml / tsconfig.base.json / .nvmrc / .env.example
```

Version comments follow the verified-facts table, not the older annotations in the locked tree (§12, O-2).
`modules/dashboard/` is added because endpoint #7 exists (§12, O-4). `src/scripts/` holds the one-shot
sweep entrypoints of §11.

**Dependency direction (enforced by review and by the pnpm strict resolver):**

| Rule | Reason |
|---|---|
| `apps/*` may import `packages/*`; `apps/*` never import each other | the two frontends must share contracts, not code paths |
| `packages/*` never import `apps/*` | keeps packages buildable in isolation |
| `packages/contracts` has exactly one runtime dependency, `zod` | it ships to both browsers and the server (NFR-MAINT-001) |
| `packages/design-tokens` has no dependencies at all | it is a CSS/JSON artifact |
| No frontend imports `pg`, `node:*`, or any API source | the database is reachable only through the API (C-04) |
| Business rules (validation, formatting, copy, transitions) exist only in `packages/contracts` | NFR-MAINT-005: framework-specific code is confined to rendering, navigation and data-fetch adapters |

**TypeScript strategy.** One base in `packages/config/tsconfig.base.json`: `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`.
Apps extend it; only the API overrides `module`/`moduleResolution` to `NodeNext`, the frontends use
`bundler`. The single permitted path alias is `@taskapp/contracts` (plus `@taskapp/design-tokens` for CSS
imports); per-app `paths` redefinition is review-blocking. One root `typecheck` covers all workspaces.

**Environment variables.**

| Name | Consumer | Build-time or runtime | Example |
|---|---|---|---|
| `NODE_ENV` | all | runtime | `production` |
| `API_PORT` | api | runtime | `3001` |
| `DATABASE_URL` | api | runtime | `postgres://app:app@pg:5432/taskapp` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | pg container | runtime | `app` / `app` / `taskapp` |
| `SESSION_COOKIE_NAME` | api | runtime | `sid` |
| `SESSION_TTL_DAYS` | api | runtime | `7` |
| `APP_ORIGIN` | api | runtime | `https://localhost` — the only accepted `Origin` for unsafe methods (NFR-SEC-006) |
| `UPLOAD_ROOT` | api | runtime | `/srv/uploads` |
| `UPLOAD_MAX_BYTES` | api | runtime | `5242880` |
| `PUBLIC_API_BASE_URL` | web-astro (server-side only) | runtime — read via `process.env` | `http://api:3001/api/v1` |
| `NEXT_PUBLIC_API_BASE_URL` | web-next | **build-time** (inlined) | `/api/v1` |
| `LOG_LEVEL` | api, web-astro | runtime | `info` |

`.env.example` is committed, `.env` is gitignored. The session idle window (24 h) and refresh throttle
(1 h) are typed constants in `apps/api/src/config`, not environment, so a benchmark cannot be run against
different session semantics than the documented ones.

**Root scripts.** `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `db:migrate`, `db:seed`,
`bench`, plus `db:sweep` for §11. `build` produces the Astro standalone server and the Next export; the
measured stack runs `build` output only.

**Branching and review.** Trunk-based: short-lived `feat/<area>-<slug>`, `fix/…`, `docs/…` branches off
`main`; conventional commits; a PR needs one review, green `typecheck`/`lint`/`test`, no direct pushes to
`main`, and `main` is always deployable. Any change to a shared shape, route or enum updates `.planning/`
in the same PR. The full rule set lives in `DEVELOPMENT-GUIDELINES.md`; this section states only the shape
it presumes. Toolchain rationale is in ADR-10 (versions) and ADR-11 (workspace manager).

## 8. Interactions and screens

Route inventory and component/state definitions belong to `14-ui-ux-specification.md` §4-§7; this section
maps each screen to the API operations it needs.

| Screen | Astro route | Next route | API endpoints used | States to implement |
|---|---|---|---|---|
| Landing | `/` | `/b/` | none (FR-LAND-005); Next additionally probes #4 for the signed-in CTA (§12 O-5) | signed-out CTA, signed-in CTA, both without layout shift; no loading/empty/error state |
| Login | `/login` | `/b/login` | #2, #4 (already-signed-in redirect), #3 on the account menu only | idle, submitting, field error, form error, `RATE_LIMITED`, expiry message |
| Register | `/register` | `/b/register` | #1, #4 | idle, submitting, per-field error, `CONFLICT` on email, success → dashboard |
| Dashboard | `/app` | `/b/app/?view=dashboard` | #7, #4 | loading (Astro: n/a in HTML), empty per widget, error + retry, overdue marker, search submit |
| Task list | `/tasks` | `/b/app/?view=tasks` | #8, #4, #20 (thumbnails), #11 (inline status) | loading skeletons, empty (no tasks), no-results + clear filters, error + retry, toast on status change, pagination end marker |
| Task detail | `/tasks/[id]` | `/b/app/?view=tasks&id=<uuid>` | #10, #4, #20, #11, #12 | loading, `NOT_FOUND` state, error + retry, attachment gallery, lightbox open/loading/error, delete confirmation |
| Task edit | `/tasks/[id]/edit` | `/b/app/?view=tasks&id=<uuid>&mode=edit` | #10, #11, #18, #21 | form idle/invalid/submitting, per-file upload progress, rejected-file list, success toast |
| Note list | `/notes` | `/b/app/?view=notes` | #13, #4, #20, #16 (pin toggle) | loading, empty + CTA, no-results, error + retry, pin/unpin toast |
| Note detail | `/notes/[id]` | `/b/app/?view=notes&id=<uuid>` | #15, #4, #16, #17, #18, #21, #20 | loading, `NOT_FOUND`, error + retry, lightbox, confirm delete, upload states |
| Account | `/account` | `/b/app/?view=account` | #5, #3, #4 | loading, error, logout immediate (no confirmation), profile read-only (permission matrix row 24) |
| Not found | `/404` | `/b/404.html` + `?view=` fallback | none | static message, link back to a safe route |
| Health (not a screen) | — | — | #22 | used by the harness and the proxy only |

Cross-cutting: every data-dependent screen implements loading, empty, error-with-retry and non-blocking
success (FR-UI-001..004); every destructive action uses the in-app confirmation (FR-UI-007); every list
state lives in the URL (FR-TASK-014, FR-NOTE-003). Wording comes from the shared copy deck, never from a
screen-local string (NFR-MAINT-006).

## 9. Quality attributes and how they are satisfied

| Attribute | Requirement IDs | Mechanism in this architecture | Verification pointer |
|---|---|---|---|
| Authorization and non-disclosure | NFR-SEC-004, NFR-SEC-005, FR-TASK-019, FR-NOTE-013, FR-ATT-008 | one guard chain in the API; ownership predicate inside every owned-row statement; `404` for absent and foreign alike; no per-row UI check exists to be mistaken for a control | `07` ownership matrix; `09` cross-owner suite |
| Credential and session integrity | NFR-SEC-001, NFR-SEC-002, NFR-SEC-003, FR-AUTH-004, FR-AUTH-012 | Argon2id; opaque token; SHA-256 at rest; cookie attributes per §5.1 | `07`; `09` auth tests |
| CSRF and origin integrity | NFR-SEC-006 | `SameSite=Lax`; `Origin`/`Sec-Fetch-Site` on unsafe methods; no CORS in production; `/uploads` unreachable | `07` threat register; `09` forged-request tests |
| Upload safety and binary privacy | NFR-SEC-009, NFR-SEC-010, FR-ATT-002/007/008/011 | sniff + decode validation; server-generated keys; owner-scoped stream; row-last write ordering | `07`; `09` upload battery |
| No user data in static output | NFR-SEC-012, FR-LAND-004 | the export contains no runtime data by construction; grep gate over `out/` and bundles | `09` static-output gate (T-713) |
| LCP | NFR-PERF-001 | Astro: data in the first byte, no client waterfall. Next: shell + dimension-stable skeleton, then data | `08` S1–S6 |
| CLS | NFR-PERF-002, FR-ATT-010 | declared image dimensions, skeleton boxes equal to final, overlay toasts, no late banners | `08` S1–S11 |
| INP | NFR-PERF-003 | Astro list content is not hydrated; Next keeps row handlers small and avoids synchronous work on interaction | `08` S7–S11 |
| Payload attribution | NFR-PERF-004/005/007 | per-resource-class capture; server-timing on documents and per-request timing on the API; DB-facing traffic reported separately | `08` run manifest |
| Reliability and integrity | NFR-REL-001..007 | DB constraints + per-mutation transactions + row-last binary write + readiness gate + pool error containment | `07`; `09` induced-failure tests |
| Backup and restore | NFR-REL-008 | `pg_dump` plus volume archive, one rehearsed restore (§11) | `09` restore rehearsal record |
| Accessibility | NFR-A11Y-001..007 | shared tokens, shared component state inventory, focus management rules in `14` | `09` accessibility pass |
| Maintainability and contract single source | NFR-MAINT-001/002/005/006 | `packages/contracts` as the only shape source; dependency-direction rules; one copy deck | `09`; repo rules |
| Observability | NFR-OBS-001..005 | pino JSON logs with request id and acting user id; server-timing; zero third-party requests | `08` log/trace sample |
| Research validity | NFR-RESEARCH-001..009 | one origin, one API instance, one database, one dataset; parity gate before runs; build id per run | `08` |
| Compatibility | NFR-COMPAT-003/004 | pinned Node and PostgreSQL, one origin, pinned Chromium | `10`; `08` manifest |

## 10. Technology justification table

| Item | Version | Confirmed requirement or constraint that needs it | If deferred | Class |
|---|---|---|---|---|
| Node.js | **24.11.1 pinned** (`.nvmrc`); floors: Astro ≥ 22.23.4, Next ≥ 20.9 | NFR-COMPAT-003, A-08; machine already at 24.11.1 | Unpinned runtime makes results non-reproducible across teammates | Baseline |
| pnpm | 9 | ADR-11; strict resolution catches undeclared deps and contract drift | npm workspaces fallback: same layout, weaker strictness | Baseline (fallback documented) |
| TypeScript | 5.x strict | NFR-MAINT-004 | Type drift between contracts and both apps | Baseline |
| Fastify | **5.12.x** | C-03 | No shared API; the comparison loses its instrument | Baseline |
| `@fastify/cookie` | 11.x | FR-AUTH-004 | Manual cookie parsing and signing errors | Baseline |
| `@fastify/multipart` | 10.x | FR-ATT-001, FR-ATT-002 | Hand-rolled streaming parser | Baseline |
| `@fastify/rate-limit` | current 5.x-compatible | NFR-SEC-007 | Brute-forceable login; threshold test impossible | Baseline (in-memory store) |
| `@fastify/helmet` | current 5.x-compatible | NFR-SEC-014 | Security headers hand-written per route | Baseline |
| `@fastify/cors` | current 5.x-compatible | **dev only** (§6.4) | Dev cross-origin requests fail; production needs none | Baseline (dev), absent in production |
| `pg` | 8.x | ADR-03, NFR-SEC-008 | No database access | Baseline |
| `node-pg-migrate` | current | ADR-03; forward-only numbered migrations | Manual SQL application; no migration record | Baseline |
| PostgreSQL | **16**, `citext`, `pg_trgm` | C-03, api-surface; case-insensitive unique email; substring search (FR-TASK-011, FR-NOTE-008) | Duplicate emails differing in case; unindexed `ILIKE` scans | Baseline |
| `argon2` (Argon2id) | current | NFR-SEC-001 | Weak or hand-rolled password hashing | Baseline |
| `file-type` | current | NFR-SEC-009 (magic-byte sniffing) | Extension/MIME trust → renamed-file bypass | Baseline |
| `sharp` | current | FR-ATT-004 (≤320 px thumbnail), FR-ATT-010 (dimensions), decode validation | No thumbnails; list payloads carry full images; CLS budget unenforceable | Baseline |
| `zod` | current | ADR-09, NFR-MAINT-001 | Duplicated validators in three packages | Baseline |
| Astro + `@astrojs/node` | **7.4.x**, standalone | C-01, FR-AUTH-008 (server gate) | No SSR path; comparison impossible | Baseline |
| Next.js + React | **16.4.x**, `output: 'export'` | C-02 | No SSG path; comparison impossible | Baseline |
| Vitest | current | ADR-14, NFR-MAINT-003 | Slower suite, worse ESM ergonomics | Baseline |
| Playwright | current, pinned Chromium | NFR-COMPAT-001, NFR-RESEARCH-004; also the benchmark driver | No reproducible browser; INP unmeasurable | Baseline |
| nginx | 1.27.x (A-22) | ADR-05, NFR-COMPAT-004; serves the Next artifact and proxies the rest | Two origins → cookie/CORS redesign | Baseline |
| Docker Compose | current | ADR-15, NFR-RESEARCH-003 | Host drift between members; run manifests not comparable | Baseline |
| Redis | — | **No confirmed driver**: single API instance, in-memory rate limits suffice | Multi-instance rate limits would need shared state; not required by any confirmed requirement | **Optional / deferrable** (ADR-01 consequence) |
| S3-compatible object store | — | **No confirmed driver**: A-03 single host; C-06 only requires binaries outside the database | Multi-host or off-host durability; `BinaryStore` interface makes it a later swap (ADR-07) | **Optional / deferrable** |
| CDN | — | **No confirmed driver**; NFR-OBS-004 forbids third-party origins | No gain on one host; would add a variable to the benchmark | **Optional / deferrable** |
| `pg_cron` | — | **No confirmed driver**: one nightly job, host cron suffices (§11) | Cleanup must be scheduled on the host instead | **Optional / deferrable** |
| APM / OpenTelemetry collector | — | **No confirmed driver**: NFR-OBS-001..004 are satisfied by structured logs + server-timing | No distributed traces; not required | **Optional / deferrable** |
| Kubernetes | — | **No confirmed driver**: one host, four part-time contributors (A-05) | Entirely disproportionate operational burden | **Rejected** |

## 11. Operational mechanisms

All mechanisms assume one API instance. Each is written to remain correct if a second instance ever
appears.

| Mechanism | What runs it | Trigger / schedule | Concurrency and idempotency with one instance | Failure handling | Roadmap phase |
|---|---|---|---|---|---|
| Orphan binary sweep | `node dist/scripts/sweep.js --orphans` in the api image, invoked as `docker compose run --rm api …` | before and after each benchmark campaign; optional nightly host cron | single run; takes `pg_try_advisory_lock`; deletes only files with no `attachments` row **and** mtime older than 24 h, so a re-run deletes nothing new | if the storage root is unreadable, abort without deleting and log the error; files are never deleted on a read error | P8 |
| Session cleanup | same script, `--sessions` | nightly host cron | one `DELETE` of expired-absolute or idle-expired rows; idempotent | failure logged, retried next night; sessions continue to be refused by the read-path checks regardless | P5 |
| Dataset seeding | `scripts/seed --dataset=m1` (`packages/test-utils` generator) | before each campaign, after migration; once for local development | deterministic ids; advisory lock; refuses to run while a run-manifest lock file exists; deletes and recreates only benchmark accounts | any error aborts and leaves the database untouched (single transaction); rerun from scratch | P4 |
| Migration run | `node-pg-migrate up` in the api container entrypoint | on every deploy, before the API accepts traffic | forward-only, `pgmigrations` table plus advisory lock; a second instance waits then sees nothing to do | fail closed: the API does not start and readiness stays `503`; no partial schema is served | P5 |
| Log rotation / disk guard | Docker `json-file` driver (`max-size`, `max-file`) on api, astro, proxy; harness preflight free-space check | continuous rotation; preflight once per campaign | no shared state | if free space is below the preflight threshold the harness aborts the campaign rather than producing invalid samples | P8 |
| Backup / restore rehearsal | `pg_dump` plus `tar` of the uploads volume into `backups/<date>/`, with a recorded checksum | once before the first campaign, then before each campaign | single writer; checksum recorded next to the archive | restore into a clean stack and compare the dataset checksum; a failed rehearsal blocks the campaign (NFR-REL-008) | P10 |

Every item is a one-shot command or a host-level schedule: nothing is a long-running extra container, and
nothing competes with request latency during a measured run.

## 12. Objections and open questions

| # | Item | Objection / question | Evidence | Proposed resolution |
|---|---|---|---|---|
| O-1 | Locked topology lists `/b/*` upstream as `web-next:3000` "(static files via nginx `root`)" | These are two different deployment shapes: a `web-next:3000` upstream implies a static file-server container; nginx `root` implies no process | `arch-fixed-inputs.md` §1 | Resolved as **the artifact is mounted at `/srv/b` and served by the proxy**; there is no Next runtime container. A container here would be a plain static server and add nothing to the comparison |
| O-2 | Locked tree annotates `web-astro` as "Astro 5" and `web-next` as "Next.js 15 App Router" | Contradicts the verified facts (Astro 7.4.x, Next 16.4.x), which explicitly override | fixed inputs §3 vs §7 | Tree comments corrected to 7.4.x / 16.4.x; the §7 table wins |
| O-3 | `GET /api/v1/health` returns `{ status, db }` only | NFR-REL-007 requires readiness to reflect **database and storage**; the storage signal is missing and the harness cannot gate on it | api-surface #22; NFR-REL-007 | Add `checks: { db, storage }` to the health payload (shape change → needs approval). Until then the harness gates on `status` and treats a storage failure as an upload-test failure, not a readiness failure |
| O-4 | Locked module list is `{auth,tasks,notes,attachments,health}` | Endpoint #7 `/dashboard` exists with aggregate semantics but belongs to no listed module | api-surface #7 vs fixed inputs §3 | Add `modules/dashboard/` (read-only aggregate). No new endpoint, no new table |
| O-5 | FR-LAND-005 requires **zero** API requests on the landing page, while FR-LAND-003 requires a session-dependent CTA resolved after hydration on the Next side | On Next the two cannot both hold: a static document cannot read the `HttpOnly` cookie, so the swap needs one `/auth/me` request | FR-LAND-003, FR-LAND-005 | Interpret FR-LAND-005 as *no content/data request* and permit exactly one auth probe on `/b/`; Astro's landing makes zero requests. Next's landing therefore carries one XHR, disclosed in `08` S1. **Needs requirements-owner confirmation** |
| O-6 | `GET /auth/me` is marked "Auth: optional" | "Optional" is not a behaviour. It must be callable without a session and answer `200` or `401` — it is the bootstrap for Next and the redirect decision for Astro | api-surface #4 | Define it as public-but-session-aware: `200 {data:{user,expiresAt}}` or `401 UNAUTHENTICATED`; never `403` |
| O-7 | Session model has one `expires_at`, but the contract requires absolute 7 days **and** idle 24 h **and** hourly refresh | Three timers cannot be derived from one column unambiguously | api-surface cookie section; §5.2 | `expires_at` = absolute `created_at + 7d`, never extended; idle window computed from `last_used_at`; refresh updates `last_used_at` at most hourly. No new column; semantics stated in `05`/`06` |
| O-8 | Thumbnail size: storage section said "max 480 px long edge" | FR-ATT-004 requires ≤ **320 px**; 480 would silently widen every list payload | api-surface §Storage vs FR-ATT-004 | Use **≤ 320 px** for the stored thumbnail and every `<img>`; the 480 figure is superseded |
| O-9 | Task list query surface is narrower than the requirements | FR-TASK-012 needs due-state and has-attachments filters; FR-TASK-013 needs ascending directions and a priority sort — the locked params offer neither | api-surface #8 vs FR-TASK-012/013 | Extend `GET /tasks` with `dueState`, `hasAttachments`, `sort` in ascending and descending forms and a `priority` key; the keyset cursor must carry the chosen sort key. **Needs API-owner approval** |
| O-10 | Roadmap T-1003 said "≥5 repetitions" while NFR-RESEARCH-004 says "≥10" | The benchmark would run to a weaker protocol than the requirement | roadmap T-1003 vs NFR-RESEARCH-004 | Follow NFR-RESEARCH-004 (≥10, first discarded); roadmap line corrected |
| O-11 | `PUBLIC_API_BASE_URL` | `PUBLIC_` implies client exposure in Astro, but this value is a server-only internal URL; reading it via `import.meta.env` would bake it at build and break promotion | fixed inputs §4 env list | Keep the name for now; mandate `process.env` access and document that it must never be read at build. Recommend renaming to `API_BASE_URL` |
| O-12 | Next route `/b/app/?view=…` | With `basePath: '/b'` the shell needs a nested `src/app/app/page.tsx`; a single-segment shell (`/b/?view=…`) would be simpler and identical in behaviour | `14` §4 | Keep as locked (route suffixes mirror Astro's `/app`); recorded so nobody "fixes" it mid-project |
| O-13 | Dev-mode CORS | The lock permits "absolute API base URL + CORS allowlist" for Next dev; this is the documented `@fastify/cors` footgun area | fixed inputs §1, §7 | Concrete allowlist `['http://localhost:3000']`, `credentials: true`, registered only outside production, never `origin: '*'` |

**Open questions requiring a decision (not blocking this document):**

| ID | Question | Default taken here |
|---|---|---|
| OQ-1 | Is one auth probe on the Next landing acceptable (O-5)? | Yes, one probe, disclosed in `08` |
| OQ-2 | Does the API owner accept the `GET /tasks` filter/sort extension (O-9)? | Yes; without it FR-TASK-012/013 cannot pass |
| OQ-3 | Is `checks.storage` in `/health` approved (O-3)? | Requested; harness degrades gracefully until then |
| OQ-4 | Absolute 7-day expiry means an active daily user is logged out at day 7 — acceptable? | Yes, it is the locked contract |

## 13. Assumptions introduced here

| ID | Assumption | If wrong |
|---|---|---|
| A-22 | nginx **1.27.x** is the proxy version (any current stable supporting `try_files` and `map` works) | Config syntax differs; the proxy smoke check catches it before a campaign |
| A-23 | *(intentionally unused — reserved, so no ID is reused)* | — |
| A-24 | Under the pinned Next 16.4.x, `useSearchParams` inside a `<Suspense>` boundary behaves as documented for the shell router; to be re-confirmed at T-701 | The router is restructured; the route strategy (ADR-04) is unaffected because the URL stays authoritative |
| A-25 | `sharp` installs successfully on the development machine (prebuilt binary or a working toolchain) | Upload decode and thumbnails fail; the fallback is a documented native-toolchain setup step, and the upload endpoint cannot ship without it |
