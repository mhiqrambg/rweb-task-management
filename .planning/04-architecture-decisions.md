---
document: 04-architecture-decisions.md
phase: 1
stage: 5
prepared_by: system-architecture-analyst
reviewed_by: software-architect
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [backend-development, security-review]
  changed:
    - "backend-development: ADR-03 (explicit SQL), ADR-06 (server-side sessions) and ADR-14 (real-D1 integration tests) took their acceptance criteria from it."
    - "security-review: ADR-07/ADR-08 reframed unguessable keys as a property rather than a control, and ADR-06 added replay-after-logout as a required test."
---

# 04 — Architecture Decision Records

All statuses are `Proposed`. Nothing here is `Accepted`; acceptance belongs to the project owner (G1).
Alternatives rejected for being fashionable, modern or popular are not acceptable reasons and do not
appear; every rationale is tied to a requirement or constraint ID from `01`/`00`.

### ADR-01 — Modular monolith API (Node + Worker), four deployables, one database

Status: Proposed
Proposed by: system-architecture-analyst
Deciders: project owner (approval pending)

**Context.** The comparison needs one API and one database serving two frontends with different rendering
models (C-03, C-04, C-05). The team is four part-time contributors (C-10, A-05) on one platform (A-03). The
domain is five tables with one authorization axis (`row.user_id = session.user_id`). NFR-REL-002/003
require deletion and upload to be atomic from the user's point of view, which is cheapest inside one
transaction boundary.

**Problem.** How many runtime services should the backend be split into, and how should the system
decompose at deployable level?

**Options considered.**
1. Modular monolith API (ElysiaJS on Node and Worker) + two measured frontends + the admin app + one
   D1 database + one R2 bucket (chosen). Auth, tasks, notes, attachments, dashboard, admin and health are
   directories inside one app, separated by route
   prefix, repository ownership and module boundaries. Cross-module reads (dashboard) are SQL against
   the same D1 binding.
2. A single application containing the API and one frontend (Next route handlers or Astro endpoints
   only). Violates C-01/C-02 (each frontend must use its own rendering model) and C-04; would make the
   comparison one app against itself.
3. Service-per-domain (auth, tasks, notes, attachments as separate Workers). Adds four network hops,
   four deployment units, four config surfaces, distributed transactions for delete-with-attachments
   (NFR-REL-002), and a service-discovery-shaped problem, for a team with ~10–12 h/week each.

**Decision.** Option 1. Three deployables (`apps/api` as a Worker, `apps/web-astro`, `apps/web-next` as a
static artifact), one D1 database, one origin. Module boundaries are enforced by directory, by
repository ownership (a module reads only its own tables plus `users` via auth helpers), and by review —
not by the network.

**Rationale.** Every confirmed requirement is satisfiable inside one Worker: ownership checks
(NFR-SEC-004/005) are single `WHERE` predicates; delete-with-attachments (NFR-REL-002, FR-ATT-011) is one
`env.DB.batch()` call with `ON DELETE CASCADE`; upload consistency (NFR-REL-003) is a single code path; the
dashboard aggregate (FR-DASH-002) is one CTE statement instead of fan-out. The two frontends remain
genuinely separate deployables, which is what the research question needs (NFR-RESEARCH-001). Nothing in
C-01..C-16 asks for independent scaling or fault isolation of domains.

**Trade-offs.** Modules can drift into a tangle — one module importing another's repository directly, or
shared SQL helpers growing into a de-facto god-layer. One Worker deploy unit is one failure domain for
code, but Worker isolates are ephemeral: there is no process memory to hold cross-request state, so the
single failure-domain argument applies to the deploy unit and its bindings, not to in-memory state. The
D1 database is the shared state every isolate reaches into; it, not the Worker, is the real single point
of coordination (and, today, the single writer). A monolith also makes it easy for a frontend-specific
hack to land in the API, which C-04/NFR-MAINT-005 forbid.

**Consequences.** `apps/api/src/modules/<name>/{routes.ts,service.ts,repo.ts}` per module, with `repo.ts`
the only file that writes SQL for its tables. Cross-module reads go through a module's exported service
function, never its `repo.ts`. Rate-limit counters live in the D1 `rate_limits` table (`bucket`, `key`,
`window_start`, `count`), not in isolate memory, so they survive isolate churn and are consistent across
concurrent invocations. No message broker, no queue, no service mesh, no Redis in the baseline.
Revisit if (a) a second deployment region with an independent D1 is introduced, (b) any single module
needs independent scaling or a different release cadence, or (c) a background job starts competing with
request latency.

### ADR-02 — D1 (SQLite), single database

Status: Proposed · Deciders: project owner (approval pending)

**Context.** The locked stack is Cloudflare Workers with D1. The schema is five tables in one D1
database. Case-insensitive unique email is a column-level property (`email TEXT NOT NULL UNIQUE COLLATE
NOCASE`, value lower-cased at write), and substring search in FR-TASK-011 and FR-NOTE-008 is a
parameterized `LIKE '%q%' ESCAPE '\'` predicate (ASCII case-insensitive by default in SQLite). The data
is small (A-04). Both frontends must read the same rows through the same API (C-04, NFR-RESEARCH-002).
There is no HA requirement anywhere in `01`.

**Problem.** What database engine and topology should the system ship with?

**Options considered.**
1. One D1 database, one schema, one migration history, binding `env.DB` (chosen).
2. One database per frontend. Breaks C-04 and makes the comparison meaningless: different rows and
   different query plans per app.
3. D1 plus a second read-only store or read replica. D1 does not expose replicas in the region topology
   this project uses, and no confirmed availability driver exists to justify a second data plane.
4. A second database for reads (e.g. a materialised cache in KV). Would introduce two sources of truth
   for the same rows, so the checksum assertion in NFR-RESEARCH-002 would no longer be meaningful.

**Decision.** Option 1. Single D1 database bound as `env.DB`; `email TEXT NOT NULL UNIQUE COLLATE NOCASE`
with the value lower-cased at write; parameterized `LIKE` for substring search; UUIDs generated in the
Worker with `crypto.randomUUID()` and bound as TEXT; timestamps computed in the Worker as TEXT ISO-8601
UTC with `Z`; forward-only numbered migrations under `apps/api/migrations` applied by `wrangler d1
migrations apply`.

**Rationale.** One database is the only topology in which NFR-RESEARCH-002 (same contents per scenario)
can be asserted by checksum, and in which the ownership model has a single truth. The required
case-insensitive email uniqueness is a column constraint in SQLite rather than an application workaround,
and the rows-per-owner bound (A-04) makes an unindexed `LIKE` predicate acceptable instead of a trigram
index. A trigger-free schema keeps invariants declarative (NFR-REL-001).

**Trade-offs.** D1 is single-writer and serialised, so the atomicity unit is one `env.DB.batch([...])`
call rather than an interactive multi-statement transaction; anything that would need `SELECT … FOR
UPDATE` must be restructured. `LIKE '%q%'` scans the owner's rows without a trigram index, which is
acceptable only because rows-per-owner is small (A-04); a large dataset would force a different search
design. SQLite has no `NULLS LAST`, so pinned-first and due-date orderings are emulated with a leading
expression column. Backup is `wrangler d1 export` (or D1 Time Travel PITR) plus R2 object copy.

**Consequences.** `env.DB` is the only database binding; no connection string, no pool. Every integration
test run gets its own local D1 created from migrations via `@cloudflare/vitest-pool-workers`. Revisit if
a scenario shows the database as the dominant cost rather than the rendering path, or if a confirmed
requirement needs cross-region writes.

### ADR-03 — D1 prepared statements with hand-written parameterized SQL and `wrangler d1 migrations`, no ORM

Status: Proposed · Deciders: project owner (approval pending)

**Context.** Five tables, one owner axis, keyset cursor pagination (FR-TASK-003, NFR-REL-006),
substring search (FR-TASK-011, FR-NOTE-008), pinned-first ordering (FR-NOTE-003),
one-round-trip dashboard aggregates (FR-DASH-002), and an explicit rule that all input is parameterized
(NFR-SEC-008). NFR-PERF-010 requires per-operation latency attribution, so query count and shape must be
visible. The team must debug whatever is chosen.

**Problem.** How should the Worker talk to D1 — through an ORM/query builder or through explicit SQL?

**Options considered.**
1. D1 prepared statements + hand-written SQL in `modules/*/repo.ts`, `wrangler d1 migrations` for
   numbered forward-only migration files (chosen).
2. Prisma. A second schema language plus a generated client; keyset predicates and the list aggregation
   need `$queryRaw`, so types stop helping exactly where the hard queries are; adds a generate step to
   every CI run.
3. Drizzle or Kysely. Type-safe builders that still need raw SQL for the grouped list aggregation and
   the multi-column keyset; adds a query DSL to learn and review, and the plan is less obvious from the
   source.
4. String-built SQL for "simple" cases. Directly violates NFR-SEC-008 and cannot be reviewed reliably.

**Decision.** Option 1. Every query is a D1 prepared statement with `?` placeholders and a bound values
array; identifiers (sort column, direction) come from fixed allowlists, never from input. One migration
file per change under `apps/api/migrations`, `0001_init` first, forward-only, applied by `wrangler d1
migrations apply`. `repo.ts` is the only place SQL exists.

**Rationale.** The requirement set is dominated by query shape, not object mapping: cursor pagination
needs a stable multi-column keyset, lists need attachments aggregated without N+1, and search needs an
index-aware predicate. Explicit SQL makes each reviewable against D1's `EXPLAIN QUERY PLAN` and makes
NFR-SEC-008 verifiable by inspection rather than by trusting a library's escaping. A five-table schema
needs no identity map, no lazy loading, no relation graph.

**Trade-offs.** No autogenerated types; row types are hand-maintained next to the Zod schemas, so a column
rename touches two places (mitigated by a contract test that round-trips a row through the Zod schema). No
migration diffing — a forgotten column is a runtime error, not a compile error. Injection safety depends
on discipline, enforced by review, a lint rule and tests, not by construction.

**Consequences.** `db/mapper.ts` holds typed row→domain converters; `env.DB` is the only database handle,
reached through the repositories. There is no pool: a Worker isolate uses one binding. Multi-statement
atomicity is expressed as a single `env.DB.batch([...])` call, which is the atomicity unit D1 gives us.
No `statement_timeout`: the Workers CPU/wall-clock limit bounds any runaway query instead. Revisit past
roughly a dozen entities or if hand-mapping becomes a measurable defect source.

### ADR-04 — Next.js static export, one shell, query-param client router (and why `/tasks/[id]` cannot be pre-rendered)

Status: Proposed · Deciders: project owner (approval pending)

**Context.** C-02 requires SSG plus client-side navigation and data fetching. Verified
(nextjs.org/docs/app/guides/static-exports): `output: 'export'` does not support dynamic routes without
`generateStaticParams`, Proxy (renamed from middleware in 16), ISR/revalidation, Draft Mode, or Route
Handlers that rely on `Request`; `cookies()`/`headers()` return empty because no request exists at build
time. Task and note ids are generated at runtime (`crypto.randomUUID()`), i.e. after the build.
FR-TASK-005/FR-NOTE-005 require deep links to a specific id; FR-TASK-014 requires all list state in the
URL; FR-AUTH-008 requires an unauthenticated deep link to land on login and then continue.

**Problem.** What route strategy gives a statically exported app deep-linkable, per-id authenticated
views?

**Options considered.**
1. Single static shell at `/b/app/` with all views and ids in query params
   (`?view=tasks&id=<uuid>`), parsed client-side (chosen). One document, identical bytes for every user,
   zero user data in the export.
2. Dynamic route `/tasks/[id]` with `generateStaticParams` enumerating build-time ids. Impossible:
   ids do not exist at build time, and a build that enumerated the seed dataset would bake user ids into
   public output (NFR-SEC-012) and break the moment a user creates a task.
3. Dynamic route with `generateStaticParams` returning `[]`. The export emits no page for any id, so
   every id 404s at the static host — the requirement fails for every task.
4. `output: 'standalone'` (server mode) with real dynamic routes. Fixes auth-gating and LCP but converts
   the app into an SSR app, destroying the SSG premise (C-02) and invalidating the comparison.
5. Hash routing (`/b/app#/tasks/<id>`). Deep links work with no server, but the fragment never reaches
   the server, breaks path-shape parity with Astro, and makes FR-TASK-014's URL-authoritative states
   diverge by construction.

**Decision.** Option 1. `/b/app/` is the only authenticated document; `view`, `id` and `mode` are query
params read via `useSearchParams` inside a `<Suspense>` boundary, with `history.pushState`/`replaceState`
and a `popstate` listener. Landing, login and register remain separate static pages (`/b/`, `/b/login`,
`/b/register`). `basePath: '/b'`, `images.unoptimized: true`, `trailingSlash: true`.

**Rationale.** It is the only option that satisfies C-02 and FR-TASK-005 simultaneously. It also makes
NFR-SEC-012 trivially checkable: one shell file, greppable for dataset values, identical for every user.
Auth state is resolved after parse by `GET /api/v1/auth/me` — the honest consequence of having no request
at build time, not a workaround.

**Trade-offs.** (a) No per-user HTML, so authenticated pages pay an extra round trip before content and
need a layout-stable skeleton to avoid CLS; (b) no server-side redirect, so the client gate is UX only and
a flash of shell is possible; (c) every view shares one bundle, so first load carries code for views the
user may never open; (d) `useSearchParams` + Suspense is a framework-shaped constraint to re-verify
against the pinned version (A-24). Options 2–5 were rejected for correctness (2, 3), for destroying the
premise (4), or for breaking parity and URL semantics (5).

**Consequences.** Exactly one authenticated route exists; any new view is a `?view=` value, never a new
path segment. The router is the single owner of navigation state; components never read `window.location`
directly. Static-output privacy grep runs in CI (T-713). If a future requirement needs per-user HTML, this
ADR must be superseded, not quietly patched.

### ADR-05 — One origin via Cloudflare zone routing instead of separate origins

Status: Proposed · Deciders: project owner (approval pending)

**Context.** The session cookie must be first-party for both apps (NFR-COMPAT-004, FR-AUTH-004). Emitting
`Access-Control-Allow-Origin: *` with `credentials: true` is rejected by browsers; reflecting any origin
is documented as unsafe in production. `credentials: 'include'` is a browser/CORS rule requiring a
concrete allowed origin and, for cross-site cookies, `SameSite=None; Secure`. FR-AUTH-013 requires logout
to invalidate the session in other tabs, so both apps and the API must share the Cloudflare-hosted origin, not separate app subdomains.

**Problem.** Should the two frontends and the API share the Cloudflare-hosted origin or be served from
separate origins with CORS?

**Options considered.**
1. One Cloudflare-hosted origin via Cloudflare zone routing / Workers routes: `/` → Astro Worker,
   `/b/*` → Next static assets, `/api/*` → API Worker, `/uploads/*` → hard 404 (chosen).
2. Separate origins with a concrete CORS allowlist and `credentials: true`. Works, but forces
   `SameSite=None` (weakening CSRF posture relative to `Lax`), makes every JSON request preflighted
   (`application/json` is not safelisted), and makes the upload endpoint — whose `multipart/form-data`
   *is* safelisted — a genuine form-CSRF target. Two cookie scopes, and logout may not reach both apps.
3. Same host, different ports, in production. Cookies ignore ports, so the session would leak across
   ports while `Origin` differs; CORS becomes mandatory while `SameSite` semantics stay same-site. A
   confusing middle ground with no benefit.

**Decision.** Option 1. Cloudflare zone routing / Workers routes send `/api/*` to the API Worker, `/b/*`
to the Next static assets, `/` and Astro app paths to the Astro `@astrojs/cloudflare` Worker, and return a
hard 404 for `/uploads/*`. The zone's route configuration is the routing mechanism. Workers CORS middleware
is **not registered in production** and appears only in the dev configuration with two exact origins
(`APP_ORIGIN`, the Astro dev origin `http://localhost:4321`, and `http://localhost:3000`,
`credentials: true`).

**Rationale.** One origin makes the cookie first-party with `SameSite=Lax`, `HttpOnly`, `Path=/` and no
`Domain` (NFR-SEC-003), exactly what FR-AUTH-004 specifies, with no CORS surface to misconfigure. It
satisfies NFR-COMPAT-004 literally, removes the preflight from every measured interaction (which would
otherwise contaminate INP and payload metrics), and keeps the two apps addressable by path on the same
Cloudflare-hosted origin.

**Trade-offs.** The zone route table is a single point of configuration that can silently route Astro app
paths over `/api` if route selection is wrong. Path-prefixing means the Next app must carry
`basePath: '/b'` everywhere and the API must keep `/api/v1`. Local development cannot perfectly reproduce
one origin for Next, so a dev-only CORS path exists and must never reach production.

**Consequences.** The route table is asserted by a smoke check that `/`, `/b/`, `/api/v1/health` and
`/uploads/x` return the expected status each. `APP_ORIGIN` is the only accepted `Origin` for unsafe
methods (NFR-SEC-006). The measured stack uses HTTPS with TLS terminating at the Cloudflare edge, so `Secure` cookies behave as
in production. Any future separate frontend origin reopens this ADR.

### ADR-06 — Server-side opaque sessions in the `sid` cookie, not JWT

Status: Proposed · Deciders: project owner (approval pending)

**Context.** FR-AUTH-004 requires an opaque token in `HttpOnly; SameSite=Lax; Path=/` `sid`, `Secure` in
production, with no token readable by script or duplicated to storage. FR-AUTH-007/013 require logout to
revoke server-side and to invalidate the session in other tabs. NFR-SEC-002 requires 32 CSPRNG bytes stored
only as SHA-256. The Worker has a D1 database and one binding. NFR-SEC-005 requires indistinguishable
responses.

**Problem.** How should a session be represented and revoked?

**Options considered.**
1. Opaque random token in `sid`; server-side `sessions` row storing SHA-256 of the token, with absolute
   and idle expiry (chosen).
2. Signed JWT in the same `HttpOnly` cookie. Stateless verification, but FR-AUTH-007/013 revocation then
   requires a server-side denylist — recreating the session table with worse ergonomics — and idle expiry
   needs either a short TTL (re-login churn, FR-AUTH-006) or a last-seen store.
3. JWT or token in `localStorage` sent via `Authorization`. Forbidden by FR-AUTH-004/012: script-readable,
   XSS-exfiltratable, and it would make the two apps diverge in auth semantics.
4. Cookie containing user id + HMAC without a database row. No revocation, no idle expiry, no multi-tab
   logout.

**Decision.** Option 1. Cookie value = base64url of 32 random bytes. D1 stores
`token_hash = sha256(token)` (unique, `BLOB` with `CHECK length(token_hash)=32`); lookups hash the
presented token and compare. Absolute expiry `created_at + 7 days` in `expires_at`, never extended; idle
expiry from `last_used_at + 24 h`; refresh (`last_used_at` update and cookie re-issue with the remaining
absolute lifetime) at most hourly; logout deletes the row and clears the cookie with `Max-Age=0`.

**Rationale.** Revocation is a requirement, and revocation is a state problem — the database is already
required, so making session state server-side costs one indexed lookup per request and buys FR-AUTH-007,
FR-AUTH-013 and FR-AUTH-010 exactly. Hashing the token at rest means a database dump cannot be replayed
(NFR-SEC-002). No rotation on refresh: two concurrent tab requests would race and one would be refused,
and rotation buys little when the idle window already bounds a leaked token.

**Trade-offs.** One extra indexed read per authenticated request (visible in NFR-PERF-010, identical for
both frontends, so it cannot bias the comparison). Sessions table growth requires cleanup (§11 of `03`). A
stolen token stays valid until idle or absolute expiry; there is no per-device revocation UI. Every Worker
isolate must reach the session row in D1, and D1 is the shared state, so sessions still block stateless
horizontal scale-out in the same way a process-external store would (accepted; ADR-15).

**Consequences.** `auth` owns `sessions`; the verification helper is the only code that reads it.
`expires_at` means absolute expiry and `last_used_at` drives the idle window — stated in `05`/`06` (O-7).
Tests must cover: expired absolute, idle-expired, revoked, replayed cookie after logout, cross-tab
invalidation.

### ADR-07 — Binary storage: R2 bucket behind an interface, not `BLOB`

Status: Proposed · Deciders: project owner (approval pending)

**Context.** C-06 requires image binaries outside the database with metadata inside. A-07 fixes the format
allowlist, 5 MB per file, 10 per target. A-03 fixes a Cloudflare-hosted origin provided by zone routing. FR-ATT-004 requires a ≤320 px thumbnail
rendition; FR-ATT-008 requires binaries retrievable only within the owner's session; NFR-SEC-010 requires
non-enumerable keys and no public addressability. NFR-REL-003 requires no served row without a readable
binary.

**Problem.** Where do attachment bytes live, and how is that choice kept replaceable?

**Options considered.**
1. R2 bucket keyed by server-generated `storage_key`, reached only through a `BinaryStore` interface
   (`put`, `get`, `delete`, `stat`) (chosen).
2. `BLOB` column in `attachments`. Violates C-06, bloats the database and backups, and removes `ETag`
   served from object metadata.
3. Base64 in a text column. Explicitly excluded by the brief.
4. A second hosted bucket outside the Workers platform. Adds a credential surface and an external system
   the boundary currently excludes; its advantages — off-platform durability, presigned URLs — are unused
   here, and presigned URLs would actively violate FR-ATT-008.

**Decision.** Option 1. Layout `<user_id>/<attachment_id>.<ext>` plus
`<attachment_id>.thumb.webp` in the R2 bucket bound as `env.BUCKET`; `put` is atomic per key, so the
temp-file-then-rename dance disappears; deletions run after the row commit; a scheduled
sweep reconciles leftovers. All access goes through the `BinaryStore` interface so a different object
store is a constructor change.

**Rationale.** Bytes and rows must agree; the cheapest agreement is an object `put` followed by a row
insert (row-last means a served row always has a readable object; the inverse produces orphans, which the
sweep removes). R2 also lets the Worker serve `ETag`/`304` from object metadata without another service
round trip, which matters because attachment images appear in list payloads (NFR-PERF-004). Nothing
confirmed requires off-platform durability.

**Trade-offs.** No replication beyond the R2 platform's own durability guarantees; R2 is the shared
binary state, and the Worker is the only writer. Object storage is eventually consistent for list
operations in some corner cases, so the sweep is not optional. Orphans are possible on a crash between
`put` and row insert.

**Consequences.** `attachments` depends on a `BinaryStore` interface, not the R2 binding directly; the
concrete implementation is injected at app construction. Keys are always composed from the user id and
the stored key and asserted to stay inside the expected prefix. A Cron Trigger on the Worker runs the
orphan sweep (`03` §11). Revisit if off-platform durability or a second binary region becomes a confirmed
requirement.

### ADR-08 — Upload validation by content sniffing with server-generated storage keys

Status: Proposed · Deciders: project owner (approval pending)

**Context.** FR-ATT-002 and NFR-SEC-009 require the type determined by inspecting content, not filename or
client-declared type; size ≤ 5 MB; ≤ 10 per target; storage names server-generated and never used for path
construction; SVG and other active content refused. FR-ATT-010 requires real pixel dimensions for layout
stability, which means the file must actually decode. NFR-REL-003 requires per-file all-or-nothing. The
upload endpoint accepts `multipart/form-data`, which is CORS-safelisted, so it is the one endpoint where
form-based CSRF is plausible (NFR-SEC-006).

**Problem.** What exactly must happen to an uploaded byte stream before it becomes an attachment row?

**Options considered.**
1. Trust the client `Content-Type` and sanitise the filename. Rejected: a renamed executable or text file
   passes; NFR-SEC-009 exists because this fails.
2. Sniff magic bytes with `file-type`, restrict to `image/jpeg|png|webp`, decode with `@jsquash` for
   dimensions and the thumbnail, then write with a generated key (chosen). The decode is the second gate:
   a file claiming to be PNG that does not decode is refused.
3. Full re-encode of every upload through `@jsquash` (normalise, strip metadata, re-emit). Strongest
   against polyglots, but changes the bytes the owner uploaded, costs CPU per file, and would alter the
   "full-resolution" artefact FR-ATT-005 shows.
4. Antivirus scanning. No dependency is available or required, and it does not address polyglot images.

**Decision.** Option 2. Pipeline: per-file limit → buffer → `file-type` sniff against the allowlist →
`@jsquash` decode (rejects undecodable input, yields `width`/`height`) → target ownership and count check
inside the `batch()` → generate `attachment_id` (`crypto.randomUUID()`) and `storage_key` → `put` full
file to R2 → encode and `put` ≤320 px `.thumb.webp` → insert row. The client-supplied filename is never
stored as a path and never echoed into `Content-Disposition`.

**Rationale.** Two independent gates (magic bytes, decodability) make "renamed file" and "polyglot" tests
fail closed, and the same decode produces the dimensions FR-ATT-010 needs. Generated keys make
enumeration and traversal structurally impossible rather than filtered (NFR-SEC-010), and row-last
ordering satisfies NFR-REL-003 without two-phase commit.

**Trade-offs.** `@jsquash` is a Wasm dependency and a per-upload CPU cost (identical for both frontends,
so it cannot bias the comparison, but it raises upload latency). The original plan for a bounded decode
queue (A-27) becomes redundant here: the Workers CPU and wall-clock limit per invocation already bounds
how much concurrent decode work any isolate can do, so an application-level queue would not add a
guarantee. Option 3's stronger guarantees are given up.

**Consequences.** `attachments` is the only module touching upload bytes; the limiter is configured
per-file and per-request. Tests must include: renamed text file, SVG, oversized file, 11th file,
traversal filename, truncated PNG, valid WebP. Rejections name the file and the reason
(`UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `VALIDATION_FAILED`) without leaking paths.

### ADR-09 — `packages/contracts` with Zod as the single contract source

Status: Proposed · Deciders: project owner (approval pending)

**Context.** C-05 requires identical data structures and API contracts in both frontends; NFR-MAINT-001
forbids redefining an entity type or validator outside one shared package; NFR-MAINT-002 forbids synonyms;
FR-UI-006 requires field-level messages to be identical across apps; FR-UI-012 requires the client to
reject a rule violation with the same message the server would return, while the server still enforces it.
All three packages are TypeScript in one workspace.

**Problem.** What is the single authoritative representation of entity shapes, enums, validation rules and
error codes, and how is it consumed by three packages?

**Options considered.**
1. Zod schemas in `packages/contracts`, types derived via `z.infer`, consumed at runtime by the API
   (request validation) and both frontends (form validation), plus shared copy strings and error-code
   constants (chosen).
2. An OpenAPI document plus generated clients/types. The spec becomes a second artefact that can drift
   from the handlers; runtime validation still needs a validator; the generator adds a build step and a
   type surface nobody reviews; and the cursor/envelope conventions would have to be expressed in a
   document only the code enforces.
3. Duplicated interfaces per app plus per-app validators. Violates NFR-MAINT-001 and guarantees FR-UI-006
   drift.
4. A shared component library instead of a contract library. Not viable across Astro and React without
   importing React into Astro (ADR-12 rejects it).

**Decision.** Option 1. `packages/contracts` exports entity schemas (`user`, `task`, `note`,
`attachment`, `session`), request/response schemas, the closed error-code union, list/page envelope types,
`copy.ts` and `format.ts`. Its only runtime dependency is `zod`. The API validates every request body and
query with the same schemas and maps `ZodError` to `VALIDATION_FAILED` with `details[]`; frontends validate
forms with the same schemas and render the same messages.

**Rationale.** The requirement is not "document the API" but "make divergence impossible"
(NFR-MAINT-001/005/006). A runtime schema satisfies that in one artefact, because the same code both
validates and types, in the server and in both browsers — exactly what FR-UI-006 and FR-UI-012 demand.
With no external API consumers, an OpenAPI document would be documentation with no reader.

**Trade-offs.** Zod ships to the browser in both apps, adding measured bundle bytes (NFR-PERF-004) —
unavoidable for client-side validation and identical in both apps, so it cannot bias the comparison, but
a real entry cost on the Next side. Schema and SQL row types are maintained separately (ADR-03), bridged
by a contract test. Zod messages must be normalised into `details[]` rather than passed through, or the
two apps would render differently shaped errors.

**Consequences.** No entity interface may be declared outside `packages/contracts` (review-blocking;
grep-checked). `contracts` is tagged at G3; both frontends depend on the tag. Copy strings live here, not
in screen files. Adding a field means one schema edit, one migration, one API mapping — in that order.

### ADR-10 — Runtime and framework version pinning

Status: Proposed · Deciders: project owner (approval pending)

**Context.** NFR-COMPAT-003 requires recorded runtime and framework versions for every benchmark run;
NFR-PERF-006/NFR-RESEARCH-003 require every run to record versions. The locked stack is a Cloudflare
Worker for the API, D1 and R2 for state, ElysiaJS as the framework for both Node and Worker,
`@jsquash` for image decode, Astro 7.4.x and Next 16.4.x for the two frontends, and pnpm as the workspace
manager.

**Problem.** Which versions do we pin, and how do we state them so a run manifest can be compared against
another run?

**Options considered.**
1. Pin every runtime and framework version in the lockfile plus the Worker `compatibility_date`, and
   record the set in every run manifest (chosen).
2. Pin only the frontends and let the Worker track whatever `wrangler` ships. Would make the Worker half
   of every run non-reproducible and NFR-RESEARCH-003 unverifiable for the API.
3. Pin only the lockfile and skip `compatibility_date`. The date gates Workers runtime features, so two
   runs with the same lockfile but different dates could measure different runtime behaviour.
4. No pin, rely on each developer's environment. Makes NFR-COMPAT-003 and NFR-RESEARCH-003 unverifiable.

**Decision.** Option 1. Pinned in the lockfile and recorded in every run manifest: Workers
`compatibility_date`, D1, R2, ElysiaJS, `@noble/hashes`, `@jsquash`, Astro 7.4.x, Next 16.4.x, pnpm. The
`compatibility_date` in `wrangler.jsonc` is treated as a version like any other — a bump is a PR that
changes the date, the lockfile and the run-manifest template together.

**Rationale.** The pin must make two runs comparable. Recording every version per run, including the
Workers runtime date, turns later drift into a documented change rather than a hidden variable. The
frontends are already pinned (ADR-04, Astro adapter), so the Worker stack is the only half that needs a
new convention.

**Trade-offs.** `compatibility_date` moves independently of the lockfile, so a run manifest that cites
only the lockfile would be incomplete; we record both. The Workers runtime is updated by Cloudflare under
the pinned date, so the exact binary is not something we control — disclosed rather than hidden.

**Consequences.** CI uses the same pinned versions; the run-manifest template includes the
`compatibility_date`. A version bump is a PR touching `wrangler.jsonc`, the lockfile and the run-manifest
template together, and triggers re-runs of any affected benchmark pair (NFR-RESEARCH-009).

### ADR-11 — pnpm workspaces

Status: Proposed · Deciders: project owner (approval pending)

**Context.** The monorepo holds three apps and four packages that must share one contract (NFR-MAINT-001)
and one lockfile, on one Node version (ADR-10). A declared constraint records that pnpm on the workstation
is currently a broken corepack shim (C-12), so the choice carries a repair prerequisite and a fallback.
NFR-MAINT-004 needs one command to type-check every workspace.

**Problem.** Which workspace manager, given four part-time contributors and a strict-single-source
requirement?

**Options considered.**
1. pnpm workspaces: `workspace:*` protocol, strict `node_modules` (undeclared dependencies fail at
   resolution instead of resolving by accident), content-addressed store, one lockfile (chosen).
2. npm workspaces: no strictness, flat hoisting that hides a missing dependency until runtime, no
   `workspace:*` protocol. Same layout works, weaker drift detection.
3. Yarn Berry with PnP: adds a loader every tool (Astro, Next, Vitest, Playwright, `tsx`) must cooperate
   with — a debugging surface for a student team, with an unfamiliar failure mode when a package ships
   without proper PnP metadata.

**Decision.** Option 1, with the documented repair step (`corepack prepare pnpm@9 --activate` or
`npm i -g pnpm`) as prerequisite P-01 and npm workspaces as the fallback with the same directory layout.

**Rationale.** Contract single-sourcing (NFR-MAINT-001) is enforced by more than review here: strict
resolution makes an app that imports a package it did not declare fail immediately, the cheapest possible
detector of contract drift between Astro, Next and the API. One lockfile keeps NFR-COMPAT-003 honest for
all three apps.

**Trade-offs.** One more tool in the chain, whose current breakage blocks all workspace commands until
P-01 is done. Strict linking occasionally forces an explicit dependency npm would have hoisted silently —
extra PR noise, but the intended effect. The store is content-addressed, so disk usage differs.

**Consequences.** `pnpm-workspace.yaml` lists `apps/*` and `packages/*`; inter-package dependencies use
`workspace:*`; the root `typecheck`/`lint`/`test` fan out through `pnpm -r`. Falling back to npm means
identical layout, no `workspace:*`, and a documented loss of strictness. Nothing else in the system
depends on which manager is used.

### ADR-12 — Share design tokens and copy, not component source

Status: Proposed · Deciders: project owner (approval pending)

**Context.** C-05 and brief §9 require identical UI/UX while warning against forcing Astro to use React to
look identical; NFR-MAINT-005 confines framework-specific code to rendering, navigation and data-fetch
adapters; FR-UI-006/NFR-MAINT-006 require identical strings and messages; FR-UI-009 requires a
screen × state parity checklist. The Astro app exists to be measured as an MPA/SSR app — its performance
is part of the experiment (NFR-RESEARCH-001).

**Problem.** What exactly is shared between the two frontends, and what must stay separate?

**Options considered.**
1. Share `design-tokens` (CSS variables + JSON), `contracts` (types/validators/copy) and `assets`;
   implement components twice — Astro components in `apps/web-astro`, React components in
   `apps/web-next` (chosen).
2. Share React components and render them inside Astro via `@astrojs/react` islands. Maximises source
   reuse, but injects a React runtime and hydration into the Astro app, changing the measured variable —
   the comparison would become "Astro+React versus Next+React". Rejected on NFR-RESEARCH-001.
3. Web components shared by both. Framework-agnostic in theory, but adds a runtime to Astro too, and
   parity of focus/dialog behaviour across shadow boundaries is harder than two small component sets.
4. Duplicate tokens per app. Guarantees drift in colour/spacing/contrast (NFR-A11Y-002) and fails the
   visual-parity gate.

**Decision.** Option 1. `packages/design-tokens` is the only source of colour, type, space, radius and
breakpoints; `contracts/copy.ts` is the only source of user-visible strings; `assets/` is the only source
of shared media. Component **source** is per-app; component **inventory and states** are specified once
(`14` §5-§7) and both implementations must satisfy every row.

**Rationale.** The research question is about rendering models, so the only acceptable shared artefacts are
those that cannot change rendering behaviour: data shapes, tokens and strings. Sharing component source
would silently change the Astro app's performance profile and invalidate NFR-RESEARCH-001, while
duplicating tokens would break NFR-A11Y-002 and FR-UI-006 in practice. The parity checklist (FR-UI-009)
is what makes "implemented twice" safe.

**Trade-offs.** Every UI change is done twice, in two idioms — real labour and a real source of visual
drift. Some markup will differ while looking identical; the checklist asserts observable equivalence, not
DOM equality. Two sets of component tests.

**Consequences.** No React dependency in `apps/web-astro`; no `.astro` import in `apps/web-next`. Tokens
imported as plain CSS in both apps; hard-coded hex values are review-blocking. Any new component is added
to `14` §5 with its states before either implementation lands. Revisit only if the research question
changes to include a shared-component variable.

### ADR-13 — Astro landing page rendered on demand, not prerendered

Status: Proposed · Deciders: project owner (approval pending)

**Context.** Verified: on-demand rendering needs an adapter; `output: 'server'` only flips the default and
`prerender = false` is the granular switch; `Astro.cookies`/`Astro.request` exist **only** on on-demand
routes, so a prerendered page cannot read a request cookie. FR-LAND-003 requires the landing page to show
a dashboard CTA when a session exists and a register CTA otherwise. FR-LAND-005 forbids data requests from
the landing page. The Next landing is necessarily a static file, so S1 compares a file against whatever
Astro serves.

**Problem.** Should `/` be prerendered (maximally comparable to the static Next landing) or rendered per
request?

**Options considered.**
1. `prerender = false` on `/` (chosen): identity is read from `sid` server-side; the CTA is chosen before
   HTML is emitted; zero additional client requests.
2. Prerender `/` and resolve the CTA client-side via `GET /api/v1/auth/me`. Makes S1 file-against-file,
   but adds a client probe plus a layout-stable skeleton to a page whose entire purpose in the benchmark
   is initial load, and contradicts FR-LAND-005's zero-request criterion as written.
3. Prerender `/` and always show the signed-out CTA. Perfectly static, but fails FR-LAND-003 outright and
   is a visible parity break against the Next app's post-hydration state.
4. Prerender `/` and inject a cookie-independent hint (a second JS-readable cookie). Forbidden by
   FR-AUTH-004/012 and would add a second cookie contract.

**Decision.** Option 1. `/` is on-demand like every other Astro route; the CTA is decided from the
forwarded cookie before any HTML exists; there is no client fetch on the Astro landing. Astro runs on the
`@astrojs/cloudflare` adapter as a Worker, reached through Cloudflare zone routing / Workers routes (ADR-05).

**Rationale.** FR-LAND-003 and FR-LAND-005 are both `MUST` and both confirmed; options 2 and 3 each break
one of them. Prerendering also cannot reduce Astro's measured cost honestly, because the requirement makes
the page per-session by definition. Choosing the requirement over aesthetic symmetry is the defensible
call, and the resulting asymmetry is disclosed rather than hidden.

**Trade-offs.** A genuine comparability cost: S1 measures server-rendered HTML (with a render and a cookie
parse) against a static file served from disk, so Astro starts with a handicap that belongs to the
requirement, not to the framework. Reviewers may read S1 as a framework result; the report must label it
as a structural property. Astro also loses CDN-cacheability for its landing page, which the Next side
keeps.

**Consequences.** `/` must never be added to a prerender list; a test asserts every page module declares
`prerender = false` (so option 3 cannot reappear by accident). `08` must state in S1's method section that
the two landings differ in rendering mechanism by requirement, and `11`'s threats-to-validity section must
repeat it. If the owner prefers symmetry over FR-LAND-003, this ADR is superseded — not quietly overridden.

### ADR-14 — Test stack: Vitest + Playwright

Status: Proposed · Deciders: project owner (approval pending)

**Context.** NFR-MAINT-003 requires a roughly 70/20/10 unit/integration/E2E split with every `MUST` FR
cited by at least one automated test; NFR-COMPAT-001 requires one pinned Chromium driven by Playwright for
the benchmark; NFR-PERF-003 requires real interaction measurement (INP); NFR-RESEARCH-004 requires ≥10
repetitions with raw samples archived. The codebase is TypeScript with ESM everywhere and two frontends.

**Problem.** Which test runners cover unit, integration, E2E and the benchmark driver with the least
configuration?

**Options considered.**
1. Vitest for unit/integration/contract tests; Playwright for E2E per app and as the benchmark driver,
   with Lighthouse invoked from a Playwright-driven page for lab runs (chosen).
2. Jest + React Testing Library + Playwright. Jest needs extra ESM/TS configuration, is slower, and
   duplicates a transform pipeline the build already has.
3. `node:test` for everything non-browser. Zero dependencies and fast, but no DOM environment for frontend
   component tests and a thinner assertion/watch story; would still need Playwright.
4. Cypress for E2E. One browser engine in practice, weaker multi-page/multi-origin ergonomics, and a
   second driver would still be needed for the benchmark (NFR-COMPAT-001 names Playwright).

**Decision.** Option 1. Vitest runs unit (API modules, formatters, validators), integration (API against
real local D1 created from migrations via `@cloudflare/vitest-pool-workers`, the pool `apps/api` already
uses) and contract (schema round-trip, envelope conformance, enum closure). Playwright runs the per-app
E2E suites and is the only benchmark driver; Lighthouse lab runs are executed through a Playwright page so
the browser build and network profile match the field runs.

**Rationale.** One browser tool for both validation and measurement removes a class of "the test browser
is not the benchmark browser" discrepancies. Integration tests against a real D1 — not a mock — are
required because NFR-REL-001 and the `CHECK`/FK invariants are database behaviour. Only the engine changed
from the original plan; the mandate is preserved.

**Trade-offs.** Two runners, two configs, two ways to be slow. Playwright E2E is the least stable layer, so
the 70/20/10 split keeps most assertions in Vitest. Real-D1 integration is slower and needs a per-run
database. Lighthouse through Playwright adds a layer that must stay thin so lab and field numbers stay
comparable. Rate-limit tests must reset or isolate the `rate_limits` table (or use a distinct
`(bucket,key,window_start)` per test) so counters do not leak across tests.

**Consequences.** `packages/test-utils` holds fixture factories, the deterministic dataset generator and a
typed API client used by both runners. Every `MUST` FR maps to a test that cites its ID; the mapping is
generated, not hand-maintained. Playwright projects run against the deployed stack only (C-09).

### ADR-15 — Cloudflare deploy: Worker + static frontends + D1 + R2 on one origin

Status: Proposed · Deciders: project owner (approval pending)

**Context.** C-09/NFR-PERF-006 require production builds; NFR-RESEARCH-003 requires recorded, identical
conditions and reproducibility across four contributors; NFR-REL-007 requires a readiness gate; NFR-REL-008
requires a rehearsed backup/restore. No requirement in `01` mentions availability targets, autoscaling,
multi-region or zero-downtime deploys.

**Problem.** How is the stack deployed and operated so that any team member can reproduce a measured run?

**Options considered.**
1. Cloudflare deploy: API Worker on a `/api/*` route, Astro on the `@astrojs/cloudflare` adapter as a
   Worker for `/` and app paths, Next static assets on `/b/*`, D1 for state, R2 for binaries, all on one
   Cloudflare-hosted origin over TLS (chosen).
2. A VPS with hand-installed Node and a reverse proxy. Fewer moving parts, but host drift is unrecorded,
   "works on my machine" returns, and restore has no declarative form — against NFR-RESEARCH-003.
3. A second cloud (Kubernetes or a managed container platform). Provides rolling updates, self-healing
   and horizontal scaling that no confirmed requirement asks for, at the cost of manifests, an ingress
   controller, a registry and a second control plane for a four-person team.
4. One Worker running all four apps (serving Next HTML and the admin pages from the Worker too). Makes
   the four-deployable boundary (ADR-01) a fiction, couples deploy and log behaviour, and hides which app
   is slow.

**Decision.** Option 1. Cloudflare zone routing / Workers routes provide one Cloudflare-hosted origin:
`/api/*` → API Worker (`apps/api`), `/` and app paths → Astro `@astrojs/cloudflare` Worker,
`/b/*` → Next static assets, `/admin*` → `apps/admin` SSR, `/uploads/*` → 404. D1 is bound as `env.DB`;
R2 is bound as `env.BUCKET`; migrations are applied by `wrangler d1 migrations apply --remote` as a
deploy/CI step. The Workers
production environment makes `Secure` cookies behave as in production; Worker Cron Triggers run session
purge and the orphan sweep; per-request JSON logs go through Workers tail / Logpush.

**Rationale.** The deploy is the smallest artefact that makes NFR-RESEARCH-003 checkable — the
`wrangler.jsonc` file plus the lockfile plus `compatibility_date` *is* the environment record, and a run
manifest can cite its hash. It also gives the four required operational mechanisms (`03` §11: migration at
deploy, scheduled sweep, backup archive, log shipping) a place to exist without inventing a platform.
Single-origin operation is a deliberate consequence of ADR-01/ADR-06.

**Trade-offs.** The origin is a single point of failure and blast radius; a platform incident ends every
in-flight session and any benchmark run. No zero-downtime deploy — a Workers deploy briefly overlaps
requests, so deploys must not overlap a measured campaign. D1 and R2 durability equals platform
durability, which is why NFR-REL-008 backup (`wrangler d1 export` plus R2 object copy) is mandatory rather
than optional. TLS terminates at the Cloudflare edge using the Cloudflare zone certificate.

**Consequences.** Wrangler configuration and Cloudflare zone routes are the deploy contract. The deployment
has no long-running server process. Rehearsal means deploying to a preview environment and running
NFR-REL-008 there.
The harness gates on readiness (`{status, db}`, with `storage` added when the attachments module lands)
before measuring and never runs while another app is deployed. Migrations never run at Worker boot; they
are a deploy step and fail closed. Revisit if a second origin or an availability requirement appears, at
which point ADR-01, ADR-06 and ADR-07 are reopened together.

### ADR-16 — One API entry: Cloudflare Worker; Node.js is the toolchain, not a second server

Status: Proposed · Deciders: project owner (approval pending)

**Context.** ElysiaJS is the API framework (`ADR-01`). The current implementation has exactly one entry,
`apps/api/src/index.ts`, exporting `fetch(request, env, ctx)`; D1 arrives as `env.DB` and R2 as
`env.BUCKET`, stashed by `setEnv(env)` before `app.handle`. `wrangler dev` serves that entry on `:8787`
against emulated D1/R2 state. Two runtime names appear in the stack description ("ElysiaJS on Node +
Worker"), and `apps/api/package.json` has only wrangler scripts, so the question is whether a plain Node
server entry should exist.

**Problem.** Should the API gain a second, non-Worker entry point for local development or deployment?

**Options considered.**
1. One entry, the Worker (`src/index.ts`); local development through `wrangler dev` (chosen). Node.js 24
   remains the pinned runtime that hosts wrangler, Vitest and the build tooling.
2. A Node entry (`src/node.ts` + `tsx watch`) that adapts the same Elysia app to `node:http`, obtaining
   bindings through `getPlatformProxy()` from wrangler. Feasible and cheap in code, but it adds a second
   entry, a second dev command and a second boot path to keep verified, while the bindings still come from
   the same emulator — no new capability, only a different launcher.
3. A Node entry with real Node drivers (`better-sqlite3` for SQL, `node:fs`/S3 for binaries) behind
   adapters. Two storage stacks, two SQL dialects to keep aligned, and `env.DB.batch([...])` (the
   documented atomicity unit) no longer means what `05` §6 says it means.

**Decision.** Option 1. `apps/api/src/index.ts` is the only entry point in the repository.
`pnpm --filter api dev` remains `wrangler dev` on `:8787`; tests run under the Cloudflare Vitest plugin
against the same bindings. No `tsx`, no `getPlatformProxy`, no second server script.

**Rationale.** The API's entire persistence and authorization design is written against D1 prepared
statements and R2 keys (`ADR-02`, `ADR-03`, `ADR-07`). A Node entry that does not change the bindings buys
a different launcher for the same behaviour, and a Node entry that does change them creates the divergence
that NFR-RESEARCH-003 and the benchmark's validity depend on avoiding. Node.js is already present and
pinned (`.nvmrc` 24.11.1) as the process hosting `wrangler dev` — the runtime name in the stack is
accurate without a second entry.

**Trade-offs.** Development is tied to wrangler; an environment that cannot run workerd (a restricted CI
runner, for example) cannot start the API, and a future Node host would need a new ADR plus option 2.
Debugging goes through workerd's inspector rather than plain `node --inspect`.

**Consequences.** One code path from unit test to integration test to preview to production, so a
behaviour difference cannot hide behind a launcher. `apps/api/package.json` keeps its wrangler-only
scripts; adding `dev:node` later is an explicit, recorded change rather than a default. `03` §6.1 states
the same fact: locally `wrangler dev` runs the app as a Node process on `:8787`; in production it is a
Cloudflare Worker. Revisit if a Node deployment target, an off-Cloudflare CI requirement, or a second API
host appears.

## ADR-17 — Password hashing: native PBKDF2-SHA256 (free-tier CPU budget)

Status: Proposed · Deciders: project owner (approval pending)

**Context.** The original NFR-SEC-001 baseline was a memory-hard KDF (pure-TS, `m=19456 KiB, t=2, p=1`)
measured at ~140 ms CPU per hash. On Workers **Free** the CPU budget is **10 ms/request**, so
`register`/`login` — the only endpoints that hash — intermittently fail with Cloudflare **Error 1102**
("Worker exceeded resources"); `GET /health` stays 200. Measured on the deployed Worker, the native
`crypto.subtle` PBKDF2 costs: 20k iters = 4 ms, 30k = 6 ms, 40k = 12 ms, 100k = 15 ms; above 100 000
iterations `crypto.subtle` refuses with "iteration counts above 100000 are not supported".

**Problem.** How can password hashing stay inside the free-tier 10 ms budget without weakening it past
the point of usefulness?

**Options considered.**
1. Native `crypto.subtle` PBKDF2-SHA256, 30 000 iterations (chosen). Stays on Cloudflare, stays free.
2. Lower the memory-hard KDF's parameters. Memory hardness is CPU-heavy at any useful parameter set; it
   cannot be tuned into 10 ms without defeating its purpose.
3. Offload auth to Supabase Auth (or similar). Removes the CPU cost but reopens ADR-02/03/06/15 and
   adds a second vendor; rejected for now as a larger change than the problem needs. Recorded here as
   the fallback if the free-tier budget or request volume makes PBKDF2 untenable.
4. Upgrade to Workers Paid. Keeps the memory-hard KDF, but the free tier is a stated constraint.

**Decision.** Option 1. `hashPassword` writes `$pbkdf2$SHA-256$30000$<salt>$<digest>` using
`crypto.subtle.deriveBits` (native, 16-byte random salt, 32-byte digest). `verifyPassword` accepts only
that format. Migration `0005` narrows the `users.password_hash` CHECK to `$pbkdf2$%` and resets accounts
whose hash predates this ADR: their sessions are revoked and the hash is replaced with a PBKDF2 sentinel
whose preimage was random and discarded, so no password authenticates against it; the account row and its
owned tasks/notes/attachments are preserved. Recovery needs an explicit password reset (out of scope).
`NFR-SEC-001` wording updates to PBKDF2 with these parameters.

**Rationale.** Measured, not assumed: the free-tier 10 ms budget is a hard platform limit, and the
native Web Crypto path is the documented fast path for crypto on Workers. 30 000 iterations lands at
~6 ms, leaving headroom for the session read and response serialisation in the same request.

**Trade-offs.** PBKDF2-SHA256 @30k is ~5 % of the OWASP recommendation (600 000) and weaker than a
memory-hard KDF against GPU/ASIC cracking — a real reduction accepted deliberately for the free tier. It
is offset by the 12-character minimum password policy (A-11), a unique 16-byte salt per user, and
constant-time comparison. The `crypto.subtle` 100 000-iteration cap is a fixed platform ceiling.

**Consequences.** Migrations `0004` and `0005` rebuild `users` (SQLite cannot drop a CHECK, and the
ordering avoids the `RENAME`-orphaned-FK trap). Accounts with only the current format log in unchanged;
pre-ADR-17 accounts are locked until reset. Revisit if the free-tier CPU budget changes, if Workers Paid
is adopted, or if a stronger KDF becomes affordable.

## Register

| ADR | Subject | Status | Blocks / blocked by |
|---|---|---|---|
| ADR-01 | Modular monolith API (Node + Worker), four deployables, one database | Proposed | Blocks ADR-15 (single-origin assumption), ADR-07 (single-writer storage); blocked by nothing |
| ADR-02 | D1 (SQLite), single database | Proposed | Blocks ADR-03; blocked by the locked Cloudflare stack |
| ADR-03 | D1 prepared statements + hand-written parameterized SQL + `wrangler d1 migrations` | Proposed | Blocked by ADR-02; blocks the API module layout in `05`/`06` |
| ADR-04 | Next static export + single shell + query-param router | Proposed | Blocks `14` §4 Next routes, T-701/T-702 and `08` S3–S6 method notes |
| ADR-05 | One origin via Cloudflare zone routing | Proposed | Blocks ADR-06 (cookie attributes), ADR-15, T-405/T-801 |
| ADR-06 | Opaque server-side sessions in `sid` | Proposed | Blocked by ADR-02/ADR-05; blocks `07` session section and O-7 resolution |
| ADR-07 | R2 bucket storage behind `BinaryStore` | Proposed | Blocked by ADR-01/ADR-15; blocks `03` §11 sweep design and `05` attachment storage |
| ADR-08 | Content sniffing + server-generated keys | Proposed | Blocked by ADR-07; blocks `07` upload section, `09` upload battery |
| ADR-09 | Zod contracts package as single source | Proposed | Blocks T-302/T-304 (G3 contract freeze) and both frontends' validation layer |
| ADR-10 | Runtime and framework version pinning | Proposed | Blocks P-05, the run manifest and every benchmark campaign |
| ADR-11 | pnpm workspaces | Proposed | Blocked by prerequisite P-01; blocks T-404 and all workspace scripts |
| ADR-12 | Shared tokens and copy, not component source | Proposed | Blocks P2 token freeze and both frontends' component work |
| ADR-13 | Astro landing on-demand, not prerendered | Proposed | Blocked by FR-LAND-003/005 and ADR-05; blocks `08` S1 method note and `11` validity section |
| ADR-14 | Vitest + Playwright | Proposed | Blocks P-05 test scaffolding, `09`, and the benchmark driver (T-1001) |
| ADR-15 | Cloudflare deploy: Worker + Astro SSR + Next static + D1 + R2 on one origin | Proposed | Blocked by ADR-01/ADR-05; blocks T-405, T-801, `03` §11 mechanisms and NFR-REL-008 rehearsal |
| ADR-16 | One API entry (Cloudflare Worker); Node.js is the toolchain | Proposed | Blocked by ADR-01/ADR-02/ADR-07; blocks any `dev:node` script, and `03` §6.1 wording |
| ADR-17 | Password hashing: native PBKDF2-SHA256 @30k (single format) | Proposed | Updates NFR-SEC-001; `migrations 0004`-`0005`; blocked by nothing |

## Objections to the locked inputs

Repeated from `03` §12 so this document stands alone. Each needs an owner decision; none was silently
changed.

| # | Locked item | Objection | Proposed resolution |
|---|---|---|---|
| O-1 | Topology: `/b/*` upstream `web-next` static export | Two deployment shapes in one line | Next static assets served by the zone route from `/b/*`; no Next runtime |
| O-2 | Tree annotates "Astro 5" / "Next.js 15" | Contradicts verified facts (Astro 7.4.x, Next 16.4.x) | Tree comments corrected; `03` §10 table wins |
| O-3 | `GET /health` returns `{status, db}` | NFR-REL-007 requires DB **and storage** readiness | Add `checks: {db, storage}` via R2 `head()` (needs approval); until then the harness gates on `status` |
| O-4 | Module list `{auth,tasks,notes,attachments,health}` | Endpoint #7 `/dashboard` has no module | Add `modules/dashboard/` — read-only aggregate, no new endpoint or table |
| O-5 | FR-LAND-005 zero API requests vs FR-LAND-003 session-aware CTA on a static page | Both cannot hold for a static document that cannot read the cookie | Interpret FR-LAND-005 as "no content/data request"; exactly one `/auth/me` probe on `/b/`, zero on Astro's `/`; disclose in `08` S1. **Needs requirements-owner confirmation** |
| O-6 | `GET /auth/me` marked "Auth: optional" | "Optional" is not a behaviour | Public-but-session-aware: `200` or `401 UNAUTHENTICATED`, never `403` |
| O-7 | One `expires_at` vs absolute 7 d + idle 24 h + hourly refresh | Three timers cannot be derived unambiguously | `expires_at` = absolute, never extended; idle from `last_used_at`; refresh ≤ hourly |
| O-8 | Storage: thumbnail "max 480 px long edge" | FR-ATT-004 requires ≤ 320 px | Use ≤ 320 px for the stored rendition and every `<img>`; 480 is superseded |
| O-9 | `GET /tasks` params `q,status,priority,limit,cursor,sort=-updated_at\|-created_at\|-due_date` | FR-TASK-012 needs due-state and has-attachments; FR-TASK-013 needs ascending directions and priority sort | Extend with `dueState`, `hasAttachments`, ascending/descending `sort` including `priority`; cursor carries the sort key. **Needs API-owner approval** (applied in `06`) |
| O-10 | Roadmap T-1003 "≥5 repetitions" | NFR-RESEARCH-004 requires ≥10, first discarded | Follow NFR-RESEARCH-004; roadmap line corrected |
| O-11 | Env var `PUBLIC_API_BASE_URL` | `PUBLIC_` implies client exposure in Astro; `import.meta.env` would bake it at build | Keep the name; mandate `process.env`; recommend renaming to `API_BASE_URL` |
| O-12 | Next route `/b/app/?view=…` under `basePath: '/b'` | Needs a nested `src/app/app/page.tsx`; a single-segment `/b/?view=…` would behave identically | Keep as locked (mirrors Astro's `/app`); recorded so it is not "fixed" mid-project |
| O-13 | Dev-mode Next has no rewrites under `output: 'export'` | The allowed fallback sits on the documented Workers CORS-middleware footgun | Concrete allowlist `['http://localhost:3000']`, `credentials: true`, only when the Worker runs in a non-production environment, never `origin: '*'` |
