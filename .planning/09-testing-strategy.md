---
document: 09-testing-strategy.md
phase: 1
stage: 10
prepared_by: test-architect
reviewed_by: software-architect
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [tdd, backend-development]
  used: [tdd, backend-development]
  changed:
    - "tdd: produced the 'one owner per behaviour' rule — a rule is asserted at the lowest level that can detect its failure — and the ban on re-asserting the same predicate at e2e level."
    - "backend-development: produced the 70/20/10 split accounting, contract tests, migration-from-empty in CI, and the real-D1 integration requirement."
---

# 09 — Testing Strategy

Scope: how this project proves that it works, before implementation exists. It defines test levels,
environments, data, gates and traceability. It contains no test code, installs nothing, runs nothing, and
reports no results. Requirement, contract, threat, dataset and protocol facts are referenced by ID from
`01`, `05`, `06`, `07`, `08`, `03` and `14`; they are not restated.

## 1. What testing must prove

The suite exists to support four claims. Nothing else is a reason to add a test.

| # | Claim | What would falsify it | Levels that carry the proof |
|---|---|---|---|
| C-A | **Both apps are functionally equivalent and satisfy the frozen requirement set.** Every `MUST` FR behaves the same in Astro and Next, with the same copy, states and URL outcomes. | One app passes a journey the other fails; a parity cell differs; an FR has no citing test. | Contract, unit, integration, e2e per app, parity suite |
| C-B | **The API enforces ownership and cannot be bypassed.** No UI state, hidden control or client-side check is load-bearing; a foreign id and an absent id are indistinguishable. | Any cross-owner request returns data, a different response from a random UUID, or mutates the target. | Security integration matrix, API-level authorization tests, build-time static-output gate |
| C-C | **The performance comparison is valid.** The two apps are the same feature set on the same builds, origin, API, database and dataset; the measured stack is reproducible and free of dev-only artefacts. | Parity fails on the reported build ids; builds, dataset or browser differ within a pair; private data appears in static output. | Parity gate, build gates, pre-campaign manifest checks, CI protocol smoke |
| C-D | **The system survives the failure modes the design names.** Expiry, revocation, database loss, storage failure, partial upload, double submit, cursor mutation and malformed input do not crash the API or corrupt state. | A named failure produces a 5xx with internals, a partial row, a duplicate, an unhandled crash, or a stale protected view. | Integration failure injection, security suite, e2e error/expiry journeys |

Two limits are deliberate. The suite does **not** prove that one rendering approach is faster — that is the
campaign's job under `08`, and the suite proves only the preconditions. It does not prove framework-general
behaviour; it proves this implementation on these builds (`08` §10).

## 2. Test levels and what belongs where

Durations are planning budgets, not measurements.

| Level | Runner | Scope | What it MUST NOT do | Budget | Gate |
|---|---|---|---|---|---|
| **Contract** | Vitest, Node env, `packages/contracts` | Schema round-trip for `User`, `Task`, `Note`, `Attachment`, `SessionProbe`, `Dashboard`, page and error envelopes; enum closure for 3 statuses, 3 priorities, 3 MIMEs and 8 error codes; strict-body rejection of unknown keys; envelope conformance; type derivation from schemas | Touch a database, boot the Worker, render a component, or assert handler behaviour. A contract test that needs D1 is an integration test in the wrong place. | ≤ 60 s | PR |
| **Unit** | Vitest, Node env, `apps/api` + `packages/contracts` | Pure API modules: mappers (`snake_case`↔`camelCase`), formatters, validation rules, cursor encode/decode with a fixed clock, `isOverdue` derivation, sort/filter query builders. Framework-free frontend logic lives in `packages/contracts` and is tested here, not twice. | Open a socket, connect to D1, mount a DOM, import a framework component, or snapshot rendered HTML. Mock only clock, UUID generator and storage adapter. | ≤ 90 s | pre-commit, PR |
| **Integration** | Vitest + `@cloudflare/vitest-pool-workers`, real local D1 migrated from empty | API routes through the Worker app invoked via `self.fetch`, real SQL, real constraints, migrations, `batch()` atomicity, cascades, pagination under mutation, error envelope, request id, log redaction. Every owned-resource operation runs against a second owner. | Mock the D1 binding, fake a `batch()`, assert UI selectors or copy in rendered markup, or use the browser. Database constraints are never replaced by validator assertions. | 3-6 min | PR |
| **E2E per app** | Playwright, two projects (`astro`, `next`), pinned Chromium, composed stack (Pages + Worker + D1 + R2 on a preview environment) | The 13 journeys, state matrix, deep links, URL-backed list state, dialogs, lightbox, keyboard operation, loading/empty/error/success states, responsive viewports. Both projects execute the same spec files. | Read/write the database with SQL, import Worker internals, mock the API, assert request counts as a performance claim, or fail on a timing value. Fixtures come from the typed API client. | 8-12 min per project | pre-merge |
| **Security (API-level)** | Vitest + typed API client over real HTTP; Playwright only for the cases `07` §10 assigns to e2e; build scripts for `S-47/48/51/52` | The security suite in `07` §10 (56 tests in the `S-01..S-63` numbering; non-contiguous, with some rows co-labelled): authentication/session, cross-owner matrix, upload battery, CSRF/origin/redirect, rate limits, headers/CSP/static output/encoding | Go through the UI for an ownership assertion, mock authentication, mock D1, or treat a hidden button as a control. | 4-6 min | PR, pre-merge, pre-campaign |
| **Performance / benchmark** | Playwright + Lighthouse, production builds, composed stack; executed by Erika | `08` S1-S11, cold/warm, 11 executed → 10 admitted, three traffic scopes, `INV-01..INV-14`, `AC-B01..AC-B10` | Use dev builds or dev servers, run a campaign in CI, publish CI timings as results, compute a median in CI, or fail a gate on an LCP/INP value. | smoke ≤ 15 min; campaign is a manual block | pre-campaign, release |
| **Build gates** | Node scripts + Playwright CSP console check | Static-output privacy grep, source-map absence, `NEXT_PUBLIC_*` allowlist, CSP hash-list staleness, Astro `is:inline` absence, migration-from-empty and `.schema` snapshot diff (`wrangler d1 migrations list`), lint/typecheck, copy-deck and banned-synonym greps, secret scan | Exercise runtime behaviour, start the Worker for grep gates, or use a browser except for the CSP console assertion. | 3-5 min | PR |

**70/20/10 split.** Counted by test case, not wall time; each logical scenario counts once even though
Playwright executes it in two projects.

- **70 % unit** — unit plus contract tests (in-process, deterministic, no I/O, so they belong in the unit
  bucket; a stated decision, not an accident of classification).
- **20 % integration** — API-against-D1, security integration, migration tests, constraint tests.
- **10 % e2e** — Playwright journeys, parity execution, state-matrix checks. Security e2e cases (`S-37`,
  `S-45`, `S-57`, `S-58`) count here.
- Build gates sit outside the ratio: they assert artefacts, not behaviour, and a ratio that counted greps
  would reward writing greps.
- The ratio is reported by the generated FR→test map (NFR-MAINT-003). It is a shape target. Coverage
  percentage is not a gate and no coverage target is set.

**One owner per behaviour.** A rule is asserted at the lowest level that can detect its failure. An
ownership failure is caught in integration; e2e may observe the resulting not-found screen but must not
re-assert the SQL predicate. Copy parity is owned by the parity suite; a unit test does not duplicate it.

## 3. Requirement-to-test map

Notation: `FR-XXX-NNN(n)` where **n** is the number of independent acceptance-criteria groups in `01` §3. A
family row cites every ID in that family. `[S]` marks a `SHOULD` requirement. This table is the
traceability artefact for NFR-MAINT-003: a `MUST` FR absent from this table is a planning defect, and the
generated report fails when a cited test does not exist.

### 3.1 Functional requirements

| Area | Requirement IDs (criteria count) | Level(s) | Test artefact name | Gate |
|---|---|---|---|---|
| Landing | `FR-LAND-001(1)`, `002(1)`, `003(2)`, `004(1)`, `005(1)`, `006(1)` | e2e, build | `e2e/landing.spec.ts`; `e2e/landing-no-api.spec.ts`; `gate/static-privacy`; `e2e/a11y-landing.spec.ts` | PR, pre-merge |
| Auth — registration and form | `FR-AUTH-001(2)`, `002(1)`, `003(1)`, `011(2)` | unit, integration, e2e | `contracts/validation.rules`; `api/integration/auth-register.int.test.ts`; `e2e/journeys/j01-register.spec.ts` | PR, pre-merge |
| Auth — login, cookie, secrecy | `FR-AUTH-004(1)`, `005(2)`, `012(1)` | integration, security, e2e | `api/integration/auth-login.int.test.ts`; `security/session-cookie.int.test.ts` (`S-03`); `security/login-enumeration.int.test.ts` (`S-05`, `S-06`); `e2e/journeys/j02-login.spec.ts` | PR, pre-merge |
| Auth — persistence and expiry | `FR-AUTH-006(2)`, `010(1)` | integration (short TTL), e2e | `api/integration/session-lifecycle.int.test.ts` (`S-09`, `S-10`); `e2e/journeys/j11-session-expiry.spec.ts` | PR, pre-merge |
| Auth — logout and revocation | `FR-AUTH-007(1)`, `013(1)` | integration, e2e | `api/integration/logout-revocation.int.test.ts` (`S-08`); `e2e/journeys/j10-logout.spec.ts` | PR, pre-merge |
| Auth — protected access, state, shared copy | `FR-AUTH-008(2)`, `009(2)`, `014(1)` | e2e, parity | `e2e/journeys/j13-deeplink-login.spec.ts`; `e2e/auth-state.spec.ts`; `parity/login-register.parity.spec.ts` | pre-merge, pre-campaign |
| Dashboard | `FR-DASH-001(2)`, `002(1)`, `003(1)[S]`, `004(2)`, `005(1)`, `006(1)`, `007(1)`, `008(1)`, `009(1)` | integration, e2e, parity | `api/integration/dashboard.int.test.ts`; `e2e/dashboard.spec.ts`; `parity/dashboard.parity.spec.ts` | PR, pre-merge |
| Task — create and validate | `FR-TASK-001(2)`, `002(1)`, `018(1)`, `020(1)` | unit, integration, e2e | `api/unit/task-validators.unit.test.ts`; `api/integration/tasks-create.int.test.ts`; `e2e/journeys/j03-task-with-images.spec.ts` | PR, pre-merge |
| Task — list, paging, row facts | `FR-TASK-003(1)`, `004(1)`, `013(1)` | integration, e2e | `api/integration/tasks-list.int.test.ts`; `e2e/task-list.spec.ts` | PR, pre-merge |
| Task — detail, edit, status | `FR-TASK-005(2)`, `006(2)`, `007(1)`, `009(2)` | integration, e2e | `api/integration/tasks-detail.int.test.ts`; `e2e/journeys/j05-task-status.spec.ts`; `e2e/journeys/j12-task-edit-attachment.spec.ts` | PR, pre-merge |
| Task — labels and overdue | `FR-TASK-008(1)`, `010(3)` | unit, e2e, parity | `contracts/format.unit.test.ts`; `e2e/task-card.spec.ts`; `parity/task-list.parity.spec.ts` | PR, pre-merge |
| Task — search, filters, URL, no-results | `FR-TASK-011(2)`, `012(2)`, `014(1)`, `015(2)` | integration, e2e | `api/integration/tasks-query.int.test.ts`; `e2e/journeys/j04-task-search.spec.ts` | PR, pre-merge |
| Task — attachments, ownership, delete | `FR-TASK-016(1)`, `017(1)`, `019(1)`, `021(2)` | integration, security, e2e | `api/integration/tasks-attachments.int.test.ts`; `security/cross-owner-matrix.int.test.ts` (`S-11..S-13`); `e2e/journeys/j09-task-delete.spec.ts`; `e2e/journeys/j13-deeplink-login.spec.ts` | PR, pre-merge |
| Note — create and validate | `FR-NOTE-001(2)`, `002(1)` | unit, integration, e2e | `api/unit/note-validators.unit.test.ts`; `api/integration/notes-create.int.test.ts`; `e2e/journeys/j06-note-create.spec.ts` | PR, pre-merge |
| Note — list, order, detail | `FR-NOTE-003(1)`, `004(1)`, `005(1)` | integration, e2e | `api/integration/notes-list.int.test.ts`; `e2e/note-list.spec.ts`; `e2e/note-detail.spec.ts` | PR, pre-merge |
| Note — edit and pin | `FR-NOTE-006(1)`, `007(2)` | integration, e2e | `api/integration/notes-update.int.test.ts`; `e2e/journeys/j07-note-pin.spec.ts` | PR, pre-merge |
| Note — search | `FR-NOTE-008(2)` | integration, e2e | `api/integration/notes-search.int.test.ts`; `e2e/note-search.spec.ts` | PR, pre-merge |
| Note — delete | `FR-NOTE-009(2)` | integration, e2e | `api/integration/notes-delete.int.test.ts`; `e2e/note-delete.spec.ts` | PR, pre-merge |
| Note — attachments, preview, empty state | `FR-NOTE-010(1)`, `011(1)`, `012(1)` | integration, e2e | `api/integration/notes-attachments.int.test.ts`; `e2e/journeys/j08-lightbox.spec.ts`; `e2e/note-empty.spec.ts` | PR, pre-merge |
| Note — ownership | `FR-NOTE-013(1)` | integration, security, e2e | `security/cross-owner-matrix.int.test.ts` (`S-14..S-16`); `e2e/journeys/j13-deeplink-login.spec.ts` | PR, pre-merge |
| Attachment — upload and validation | `FR-ATT-001(1)`, `002(1)`, `009(1)` | integration, security, e2e | `security/upload-battery.int.test.ts` (`S-24..S-32`); `e2e/journeys/j03-task-with-images.spec.ts` | PR, pre-merge |
| Attachment — visibility, thumbs, dimensions, order | `FR-ATT-003(2)`, `004(1)`, `010(1)`, `012(1)` | integration, e2e, perf smoke | `api/integration/attachments-renditions.int.test.ts`; `e2e/attachments-visible.spec.ts`; `perf/smoke/s04-task-list.spec.ts`; `perf/smoke/s10-upload-preview.spec.ts` | PR, pre-merge, pre-campaign |
| Attachment — lightbox | `FR-ATT-005(2)`, `006(1)[S]` | e2e, a11y | `e2e/journeys/j08-lightbox.spec.ts`; `e2e/keyboard-dialogs.spec.ts` | pre-merge |
| Attachment — removal, binary authorization, cascade | `FR-ATT-007(1)`, `008(1)`, `011(1)` | integration, security, e2e | `api/integration/attachments-delete.int.test.ts`; `security/cross-owner-matrix.int.test.ts` (`S-17..S-21`); `e2e/journeys/j09-task-delete.spec.ts`; `e2e/journeys/j12-task-edit-attachment.spec.ts` | PR, pre-merge |
| UI — states | `FR-UI-001(1)`, `002(1)`, `003(2)`, `004(1)` | e2e | `e2e/states.loading.spec.ts`; `e2e/states.empty.spec.ts`; `e2e/states.error.spec.ts`; `e2e/states.success.spec.ts` | pre-merge |
| UI — validation parity | `FR-UI-005(1)`, `006(1)`, `012(1)` | contract, e2e, parity | `contracts/validation.messages.contract.test.ts`; `parity/forms.parity.spec.ts` | PR, pre-merge |
| UI — confirmation dialogs | `FR-UI-007(1)` | e2e, a11y | `e2e/confirm-dialogs.spec.ts`; `e2e/keyboard-dialogs.spec.ts` | pre-merge |
| UI — responsive | `FR-UI-008(1)` | e2e | `e2e/responsive.spec.ts` (375/768/1024/1440 loops) | pre-merge |
| UI — parity, keyboard, live regions | `FR-UI-009(1)`, `010(1)`, `011(1)` | parity, e2e, a11y | `parity/report`; `e2e/keyboard-journey.spec.ts`; `e2e/live-regions.spec.ts` | pre-merge, pre-campaign |
| Admin — list, create, edit, disable, delete (extension) | `FR-ADMIN-001(1)`, `002(1)`, `003(1)`, `004(1)`, `005(1)`, `007(1)`, `008(1)` | integration, security, e2e | `api/integration/admin-members.int.test.ts`; `e2e/admin/admin-members.spec.ts`; `e2e/admin/admin-disable-session.spec.ts`; `e2e/admin/admin-self-lockout.spec.ts` | PR, pre-merge |
| Admin — member apps carry no admin surface | `FR-ADMIN-006(1)` | security, build gate | `security/admin-route-nondisclosure.int.test.ts`; `gate/admin-free-member-builds` | PR, pre-merge |

### 3.2 Non-functional requirements

| Area | Requirement IDs | Level(s) | Test artefact name | Gate |
|---|---|---|---|---|
| Performance | `NFR-PERF-001..010` | benchmark, perf smoke, build manifest | `perf/campaign/` (manual, Erika); `perf/smoke/`; `perf/manifest.check` | pre-campaign, release |
| Security | `NFR-SEC-001..014` | integration, security, e2e, build, manual | `security/` six-category suite; `gate/static-privacy`; `gate/csp`; `security/credentials.manual.md` (`S-63`) | PR, pre-merge, pre-campaign |
| Reliability | `NFR-REL-001..008` | integration, process-level, manual | `api/integration/db-constraints.int.test.ts`; `api/integration/transactions.int.test.ts`; `api/integration/pagination-under-mutation.int.test.ts`; `api/integration/db-down.int.test.ts`; `ops/restore-drill.manual.md` | PR, pre-campaign, release |
| Accessibility | `NFR-A11Y-001..007` | e2e, a11y, manual | `e2e/a11y-scan.spec.ts`; `e2e/keyboard-journey.spec.ts`; `e2e/zoom-320.spec.ts`; `a11y/manual-screen-reader.md` | pre-merge, release |
| Maintainability | `NFR-MAINT-001..007` | contract, unit, build | `contracts/single-source.contract.test.ts`; `gate/banned-synonyms`; `gate/copy-deck`; `gate/typecheck`; `reports/fr-test-map.json` | PR, pre-merge |
| Compatibility | `NFR-COMPAT-001..005` | CI version check, manifest, manual browser smoke | `gate/versions`; `perf/manifest.check`; `compat/browser-smoke.manual.md` | pre-campaign, release |
| Observability | `NFR-OBS-001..005` | integration, manifest | `api/integration/logging.int.test.ts`; `api/integration/request-id.int.test.ts`; `perf/manifest.check` | PR, pre-campaign |
| Research validity | `NFR-RESEARCH-001..009` | parity, benchmark, gates | `parity/report`; `perf/campaign/acceptance`; `perf/manifest.check` | pre-campaign, release |

**Untestable as written.** None of the `MUST` FRs is untestable, but four need a settled default before
their tests are final: `FR-DASH-003` (statistics set, Q-10), `FR-ATT-009` (partial-upload semantics,
Q-11), `FR-AUTH-006` (session lifetime, Q-08) and `FR-ATT-004` (thumbnail rendition, Q-14). Each has a
default in `01` §9 and a test written against it; a change of answer changes constants and fixtures, not
the test structure. `FR-ATT-006` is `SHOULD` and is covered once.

## 4. Test data

### 4.1 The deterministic dataset

The benchmark and parity dataset is the one in `05` §9, not a test-local invention.

- `dataset_id` includes the anchor date (`m1-2026-11-15`); one PRNG seed, `uuidv5` ids per
  `(dataset_id, table, index)`, timestamps derived from the anchor, never `now()`.
- Two users: `u01@bench.invalid` (benchmark) and `u02@bench.invalid` (isolation).
- Per user: 50 tasks, 50 notes, 3 attachments. Task distribution per `08` §2.1; notes 5 pinned / 45
  unpinned, bodies 200-2 000 chars.
- One deliberate duplicate `updated_at` pair per user so the `id` tiebreak is exercised every run.
- Anchor window: runs within 30 days after the anchor classify every seeded task identically. Beyond that
  the campaign re-seeds and gets a new `dataset_id`; a test depending on "today" uses a frozen clock.
- `manifest.json` carries `counts`, `probe_terms`, per-table checksums and `checksums.total`,
  `image_hashes`, `anchor_date`. Tests compare `checksums.total`, not row counts.
- The three seed images are committed under `assets/seed-images/`, referenced by content hash; the seed
  copies bytes, never regenerates or recompresses them.

### 4.2 Fixture factories

`packages/test-utils` owns the fixtures; no test file defines its own entity literal.

| Factory | Contract |
|---|---|
| `makeUser(overrides)` | unique email by default; returns credentials plus the created `User`; never reuses an email across files |
| `makeTask(owner, overrides)` | defaults `todo`/`medium`, no due date; caller may set any field including `updatedAt` offsets |
| `makeNote(owner, overrides)` | requires title and body; defaults unpinned |
| `makeAttachment(owner, target, fixtureName)` | uploads through the typed API client; returns `Attachment` |
| `withSession(user)` | typed client carrying the `sid` cookie; used by integration and security tests |
| `ownerPair()` | creates owners A and B plus the isolation fixture below |
| `seedDataset(id)` / `resetDataset(id)` | wraps `scripts/seed`; returns the manifest; refuses a non-test database name |
| `typedApiClient(baseUrl, cookie?)` | one request method per endpoint shape; asserts envelope types at compile time |

The client is the only way tests reach the API. A test that constructs a raw `fetch` for an owned resource
is an artefact defect, because it bypasses the typed error-envelope handling the suite exists to check.

### 4.3 Two-owner isolation fixture

`ownerPair()` returns A, B and the addresses B must not reach:

- A owns one task with one full-size image and one thumbnail, and one note with one image.
- B owns a task and note of its own, so a passing test cannot be explained by B having no data.
- The fixture returns `aTaskId`, `aTaskAttachmentId`, `aNoteId`, `aNoteAttachmentId`, plus
  `randomAbsentId` — a valid UUID v4 that exists in no table.
- Every cross-owner case asserts **two** things: the foreign id and `randomAbsentId` produce byte-identical
  status, `code`, `message`, `details` and body length; and A's row, attachment count and binary hash are
  unchanged after the attempt.
- Created per test, not in `beforeAll`, unless the file is strictly read-only. Two tests sharing A's
  mutable row is the defect this fixture exists to prevent.

### 4.4 Upload fixtures

Committed under `packages/test-utils/fixtures/uploads/`, hashes pinned in the fixture manifest:

- Valid: `image-1.jpg`, `image-2.png`, `image-3.webp` (each ≤ 1 MB, same bytes as the seed images where a
  scenario needs them).
- Hostile: `renamed-text.png`, `vector.svg`, `oversize-6mb.png`, `pixel-bomb.png` (declared
  50 000 × 50 000), `truncated.png`, `polyglot.jpg`, and a request whose filename is `../../x.png`.
- The battery asserts the codes from `06` §8: `415` for sniff failures, `422 undecodable_image` for decode
  failures, `413` for size, `422 attachment_limit` for an 11th file. It never asserts a rejection message
  that is not the shared copy deck's text.

### 4.5 No shared mutable state across files

- Every Vitest file gets its own database (§4.6). No file truncates or seeds a database another file uses.
- Within a file, each test creates its own owner via `makeUser`; tests do not depend on execution order.
- The seeded benchmark dataset is read-only for parity and screenshot tests. Mutating scenarios run against
  a disposable database or create and delete their own rows.
- Playwright workers do not share an account. Mutating journey specs run with `workers: 1`; read-only
  parity/state specs may run in parallel only after the mutating suite finishes.
- A test needing "the seeded task with two images" looks it up by the fixture contract, not by list
  position, because position is itself under test.

### 4.6 Per-run database creation and cleanup

| Context | Database | Creation | Reset / cleanup |
|---|---|---|---|
| Unit and contract | none | — | — |
| Integration, per CI job | local D1 (ephemeral) | `wrangler d1 migrations apply --local`, assert the `d1_migrations` count equals the migration-file count, diff `schema.snapshot.sql` | Discard the local D1 state at job end |
| Integration, per Vitest worker | isolated per-worker local D1 storage | each `vitest-pool-workers` worker gets its own isolated storage dir before its first file | Drop at worker teardown; no D1 state reused across runs |
| E2E | deployed preview D1 | migrate from empty, `seedDataset(m1)` once | `resetDataset(m1)` before and after; journey specs create and delete their own accounts/rows |
| Performance smoke | deployed preview D1 | migrate from empty, `seedDataset(m1)` | Reset before each mutating scenario; checksum compared to `checksums.total`; state discarded at job end |
| Measured campaign | deployed preview D1 | migrate from empty, `seedDataset(m1)` only after the pre-campaign gate | Reset per `05` §7.5 M4 before every mutating repetition; never touched by CI or e2e |

`scripts/seed` refuses to run when the target D1 database is not in the allowed test/benchmark set.
Cleanup also removes the per-run local R2 state, Playwright traces/videos for passing tests and temporary
fixture files; failed-test traces are retained as CI artefacts.
Cleanup also removes the per-run upload root, Playwright traces/videos for passing tests and temporary
fixture files; failed-test traces are retained as CI artefacts.

## 5. Environments

| Environment | What runs | Database | Builds | Browser | Gate |
|---|---|---|---|---|---|
| **Local dev** | Astro dev server, `next dev`, Worker under `wrangler dev`; unit, contract, integration, framework-free logic | local D1 (`.wrangler/state`) migrated from empty; integration uses per-worker isolated local D1 storage | Development builds only | Not measured | pre-commit, PR |
| **CI** | Lint/typecheck, contract, unit, integration, security, build gates, Playwright e2e and parity, migration-from-empty, protocol smoke | Ephemeral local D1 under Miniflare; per-worker isolated D1 storage; preview D1 for e2e and smoke | Production builds for e2e and smoke; dev builds for unit only | Pinned Chromium, same version as the campaign | PR, pre-merge, pre-campaign |
| **Composed measured stack** | Astro `@astrojs/cloudflare` Worker, static Next export served from Cloudflare at `/b/*`, API Worker at `/api/*`, D1, R2 on one Cloudflare-hosted origin over TLS; campaign run by Erika | preview D1, seeded `m1`, checksum per repetition | Production only; production Worker build; source maps off; no dev overlay | Pinned Chromium and Cloudflare Worker runtime/region, one viewport, `--disable-gpu`, headed on a virtual display | pre-campaign, release |

The composed stack is the only place where e2e, parity and benchmark results are produced. `next dev` and
the Astro dev server are never measured (`03` §6.4, NFR-PERF-006). The dev CORS allowlist is absent from
the measured stack; a smoke assertion checks that no response carries an `Access-Control-*` header.

**Parity checklist before any benchmark (FR-UI-009, `14` §9).** Executed against the exact production
build ids on the composed stack, not dev builds:

1. Same visible text for the same data in both apps.
2. Same DOM order of primary elements (title → meta → actions → body).
3. Same breakpoint behaviour at 375 / 768 / 1440.
4. Same empty/loading/error wording from the shared copy deck.
5. Same badge colours and labels for identical records.
6. Same form validation messages, field order and required markers.
7. Same thumbnail aspect ratio, `+N` overflow rule and lightbox keyboard behaviour.
8. Screenshot pair attached to the report.

Every screen in `14` §4 × every applicable state in `14` §7 is a cell. A cell passes only when both apps
pass all eight checks. The result is committed as `parity/report.json` with the three build ids, the
dataset id and screenshot hashes. A single failed cell blocks the campaign; there is no waiver that admits
a benchmark with a failed cell.

## 6. Security test execution

`07` §10 defines the cases. This section defines how they are organised and executed.

| Category (`07` §10) | Case IDs | Level | Artefact |
|---|---|---|---|
| Authentication and session | `S-02..S-10`, `S-12` | integration, real HTTP, short TTL for `S-09/S-10` | `security/auth-session.int.test.ts` |
| Authorization — cross-owner matrix | `S-11..S-23`, `S-18b` | integration, real HTTP | `security/cross-owner-matrix.int.test.ts` |
| Upload battery | `S-24..S-32` | integration, real multipart | `security/upload-battery.int.test.ts` |
| CSRF, origin and redirects | `S-33..S-38` | integration, except `S-37` e2e | `security/origin-csrf.int.test.ts`; `e2e/security-next-redirect.spec.ts` |
| Rate limits | `S-39..S-44` | integration | `security/rate-limits.int.test.ts`; `security/session-purge.int.test.ts` |
| Headers, CSP, static output, encoding | `S-45..S-49`, `S-51`, `S-52`, `S-57..S-63` | e2e for `S-45/57/58`; build for `S-47/48/51/52`; integration for the rest; manual for `S-63` | `security/headers-csp.spec.ts`; `gate/csp`; `gate/static-privacy`; `security/error-envelope.int.test.ts`; `security/log-injection.int.test.ts`; `security/storage-cleanup.int.test.ts`; `security/dataset-reseed.int.test.ts`; `security/credentials.manual.md` |

**Short-TTL session configuration.** Expiry tests boot the API with a test-only configuration: absolute TTL
2 s, idle TTL 1 s, injected through the config module. The verification, refresh and revocation code paths
are the production ones; only the two constants differ. No production environment variable is added,
because `03` §7 deliberately keeps session semantics out of environment configuration.

**Ownership is asserted against the API directly.** Every cross-owner case uses the typed client with a real
`sid` over real HTTP. It does not open a browser and does not use a UI state as evidence. The e2e suite may
observe the not-found screen afterwards; that observation is not the proof. Each case compares the foreign
response to `randomAbsentId` byte-for-byte, then re-reads A's row and binary hash.

**Rate limits.** Counters live in the D1 `rate_limits` table, so each rate-limit test must use a distinct
`(bucket, key, window_start)` or reset the `rate_limits` table before the case; counters otherwise leak across
tests because there is no in-process limiter to reset. A `429` assertion checks `Retry-After` and the
`RATE_LIMITED` envelope, not an internal counter.

**What the security suite is not.** It is not a penetration test and does not claim coverage of `07` §11
residual gaps. `S-63` is a manual check that seeded credentials are gitignored; it is not automated because
the repository is the artefact under inspection.

## 7. Frontend parity testing

### 7.1 Two projects, one set of specs

Playwright defines `astro` and `next` projects. Both point at the same composed stack, one at `/` and one at
`/b/`, and both run the same spec files. A spec never branches on the project name to change an assertion.
If a behaviour legitimately differs because of the rendering model, the spec asserts the **same end state**
and separately records the mechanism (new document vs client transition) in the run manifest, not in a
conditional pass.

### 7.2 Locator strategy

- First choice: role + accessible name (`getByRole`, `getByLabel`) — identical in both apps because DOM
  semantics and the copy deck are shared.
- Second: a user-visible label from `packages/contracts/src/copy.ts`.
- Last resort: `data-testid` on a non-semantic container, with the value defined once in a shared constants
  module and consumed by both apps; specs refer to the logical name through one resolver.
- No CSS selectors, no XPath, no text that is not in the copy deck, no per-app selector maps.
- A locator that exists in one app only is a parity defect, not a reason to fork the spec.

### 7.3 Screenshot pairs

For every screen × applicable state × viewport (375, 768, 1440), the parity run captures one screenshot per
app after the same settle rule. The pair is compared to itself, not only to a golden:

- **Cross-app diff:** pixel difference ≤ 0.1 % of the frame and zero differences inside text regions after
  normalisation. A non-zero diff is attached to the report and reviewed by Erika; a text difference is a
  failure regardless of pixel percentage.
- **Per-app baselines:** each app also keeps its own baseline, so a change affecting both apps identically
  is still caught as a regression.
- Captured with animations disabled, reduced motion, light scheme, `en-US`, `UTC`, same font set — the same
  conditions as `08` CV-3/CV-9, so a parity screenshot and a benchmark screenshot describe the same
  rendering.
- Stored as `parity/<screen>/<state>/<viewport>/<app>.png` and referenced from the report by hash. The
  report, not a folder of images, is the evidence.

### 7.4 Identical copy without duplicated selectors

Three layers, each with one owner:

1. **Copy-deck contract test** (`contracts/copy-deck.contract.test.ts`): every key exists once, both apps
   import the same deck, and no screen-local user-visible string exists outside the deck. Source of truth.
2. **Text-region comparison** in the parity spec: the normalised `innerText` of header, main and footer for
   a given fixture/state must be identical across apps. The expected value is not typed into the spec; where
   a literal is needed it is read from the copy deck.
3. **Form parity spec:** for identical invalid inputs, field order, message text, association and trigger
   point must match — catching the case where the same string appears in the wrong field.

A rendered string that exists in only one app fails layer 2; the copy-deck test fails layer 1 if it was
added outside the deck. There is no third place to add copy.

### 7.5 Executing FR-UI-009

`parity/report.json` records, per cell: screen, state, viewport, app, screenshot hash, the eight checklist
results, the three build ids, dataset id and timestamp. The gate reads the report: **all cells pass in both
apps**. A missing cell is a fail, not a skip. The report and screenshots are committed with the campaign
manifest. The campaign cannot start without a green report on the exact build ids it will measure.

## 8. Performance test integration

CI and the campaign have different jobs. CI proves the protocol still runs; the campaign produces the
numbers.

| Concern | CI | Campaign (manual, Erika) |
|---|---|---|
| Readiness | `GET /api/v1/health` returns `200` with `db: "ok"`; a stopped database returns `503` and the smoke run refuses to start | Same readiness gate before every campaign |
| Build identity | Record `astro_build_id`, `next_build_id`, `api_build_id`, `contracts_tag`; refuse to run if any is missing | Same ids in every `run.json`; a pair requires all three to match (`08` §7.3) |
| Protocol smoke | One unmeasured pass of each S1-S11 per app against `taskapp_smoke`, asserting the structural predicates in §10. No repetitions, no statistics, no LCP/CLS/INP threshold | 11 executed → 10 admitted per cell; cold and warm; `P0` main set, `P1` secondary set |
| Dataset | `checksums.total` compared before and after the smoke | `checksums.total` per repetition; `INV-03` on mismatch |
| Payload capture | Resource-class capture runs; a mismatch > 1 % versus resource timing is logged as a capture defect | Same rule, `INV-12` |
| Vitals | In-page buffer injected and read after settle; `inp_availability` recorded | Same buffer, identical bytes in both apps, hash in the manifest |
| Output | CI logs and a smoke manifest; **no median, no IQR, no result table** | Raw archive per repetition, median/IQR/p95, invalidation codes, `AC-B01..AC-B10` |

**CI MUST NOT:** run a campaign, execute 10 repetitions of anything, compute or publish a median, upload a
results table as an artefact, compare the two apps' timings, or use a development build. A CI timing value
may appear in a debug log; it is not a result and is not retained as one.

**What CI may fail on:** readiness false, a missing build id, dataset checksum drift, a 5xx, a 429, a
third-party request, a full-resolution image in a list where the thumbnail was required, a `SETTLE()` cap, a
missing vitals buffer, or a protocol structural predicate. It never fails because an LCP value looks slow.

## 9. Quality gates

| Gate | When | Command(s) | Pass condition | Who is blocked |
|---|---|---|---|---|
| **G0 — pre-commit** | Before every commit | `pnpm lint`; `pnpm typecheck`; `pnpm test:unit` | Exit 0, zero warnings, zero changed-file unit failures | The author, locally |
| **G1 — contract and unit** | Every PR | `pnpm test:contract && pnpm test:unit` | Exit 0; schema and enum closure pass; every `MUST` FR in the generated map resolves to an existing test | Merge |
| **G2 — integration and migration** | Every PR | `pnpm db:gate:fresh && pnpm test:integration` | Exit 0; `d1_migrations` count equals migration-file count; schema-snapshot diff empty; suite green on real local D1 | Merge |
| **G3 — build and artefact gates** | Every PR, after build | `pnpm build && pnpm gate:static && pnpm gate:csp && pnpm gate:secrets && pnpm gate:copy && pnpm gate:versions` | Zero hits for seeded emails/`DATABASE_URL`/password strings in `out/`, bundles and maps; zero `.map` files served; Astro `is:inline` count zero; Next CSP hash list matches rendered inline scripts; copy deck single source; banned synonyms zero; pinned versions match | Merge |
| **G4 — e2e and accessibility** | Pre-merge, after G1-G3 | `pnpm test:e2e && pnpm test:a11y` | Both projects green; zero AA violations in the audited rule set; keyboard journey passes; no console error | Merge |
| **G5 — security** | Pre-merge; on every PR touching auth, ownership, upload, headers or session code; always before release | `pnpm test:security` | Every applicable case defined in `07` §10 passes (56 tests; the ID range is non-contiguous); cross-owner responses byte-identical to `randomAbsentId`; zero bytes on foreign binaries | Merge |
| **G6 — parity smoke** | Pre-merge for screens touched by the PR; full matrix before campaign | `pnpm test:parity --grep <touched screens>`; `pnpm test:parity` | 100 % of executed cells pass all eight checks; missing cell = fail | Merge; campaign start |
| **G7 — pre-campaign** | Before every campaign | `pnpm gate:campaign` | Production builds on the exact reported ids; `/health` ready; `dataset_id` + `checksums.total` match; full parity report green; security suite green; no third-party request; no dev overlay; host-load band recorded | Erika — no repetition may start |
| **G8 — pre-release/demo** | Before a release or demo | `pnpm verify:release` | G1-G7 green on the release commit; `AC-B01..AC-B10` true; raw archive path and checksum recorded; §11 exclusions stated in the report | Release/demo |

**Failure policy.** A red gate blocks the merge, not the discussion. The fix is a code change, a corrected
test, or a written scope decision; rerunning until green is not a resolution. An infrastructure-only failure
may be retried with the failing job linked in the PR. A flaky test is quarantined only with an owner, a
linked defect and a removal date; it is not silently retried and does not stop being counted.

**Waivers.** G0-G5 have no waiver for privacy, secret or ownership failures. A functional gate (G6-G8) may
be waived only by the named gate owner, in writing, with the failed cell and user-visible impact listed; the
waiver becomes part of the report. A benchmark with a failed parity cell is never waived — it is not run.

## 10. Acceptance criteria tied to requirement IDs

### 10.1 Journeys J-01..J-13

Each journey is one spec file executed by both projects. The test asserts the end state; the project name
records the mechanism, never a different assertion.

| Journey | Test | What it proves | FRs |
|---|---|---|---|
| J-01 | `e2e/journeys/j01-register.spec.ts` | Empty submit → two field errors, zero API requests; duplicate email retains email, clears password; valid registration lands on a 0/0/0 dashboard; reload keeps the session | FR-LAND-001/002, FR-AUTH-001/002/003, FR-DASH-008, FR-UI-005 |
| J-02 | `e2e/journeys/j02-login.spec.ts` | Wrong password and unknown email produce identical messages; valid login sets `sid`; reopening a persistent context keeps the session | FR-LAND-002, FR-AUTH-004/005/006, NFR-SEC-007 |
| J-03 | `e2e/journeys/j03-task-with-images.spec.ts` | Three images attach; the renamed text file is rejected by content sniffing with its own message; retry works; detail shows three thumbnails and the five-fact row | FR-TASK-001/002/004/016/017/018/020, FR-ATT-001/002/003/009, FR-UI-012 |
| J-04 | `e2e/journeys/j04-task-search.spec.ts` | Search + combined filters in the URL; reload and a second tab reproduce rows and chips; Back restores the previous combination; zero-match shows no-results with clear-filters | FR-TASK-003/011/012/013/014/015, FR-UI-003 |
| J-05 | `e2e/journeys/j05-task-status.spec.ts` | Inline status change persists across reload; dashboard moves one from active to completed | FR-TASK-007/009, FR-DASH-001/009, FR-UI-004 |
| J-06 | `e2e/journeys/j06-note-create.spec.ts` | Title + 501-char body + two images creates a note at the top of the unpinned block; reload preserves body and thumbnails; empty body creates nothing | FR-NOTE-001/002/003/004, FR-ATT-001/003/012, FR-UI-004 |
| J-07 | `e2e/journeys/j07-note-pin.spec.ts` | Pin moves the note to the pinned block with a marker; reload keeps it; unpin restores time order; a failed pin leaves the previous position | FR-NOTE-003/007, FR-UI-004 |
| J-08 | `e2e/journeys/j08-lightbox.spec.ts` | Thumbnail opens the full image with dimensions and size; ArrowRight twice → "4 of 5"; Escape closes and restores focus; backdrop closes | FR-ATT-004/005/006/008, FR-UI-010, NFR-A11Y-005 |
| J-09 | `e2e/journeys/j09-task-delete.spec.ts` | Dialog names the task, Cancel focused, Escape makes zero requests; confirm removes the task, cascades attachments, updates counters, both addresses not-found | FR-TASK-021, FR-ATT-011, FR-UI-007, NFR-REL-002 |
| J-10 | `e2e/journeys/j10-logout.spec.ts` | Logout revokes and clears `sid`; Back shows no protected content; replaying the captured cookie is refused | FR-AUTH-007/009/013, NFR-SEC-002 |
| J-11 | `e2e/journeys/j11-session-expiry.spec.ts` | A status change after out-of-band invalidation lands on login with the expiry message; no task data remains; the refused change was not applied | FR-AUTH-008/010 |
| J-12 | `e2e/journeys/j12-task-edit-attachment.spec.ts` | Edit title, clear due date, remove attachment 2 with confirmation; save shows new title, "no due date", two thumbnails in stable order; removed address not-found | FR-TASK-006/010, FR-ATT-007/012, FR-UI-004 |
| J-13 | `e2e/journeys/j13-deeplink-login.spec.ts` | Anonymous deep link → login with destination remembered; owner sees the detail after login; another account gets not-found; a foreign `next` falls back to the dashboard | FR-AUTH-008, FR-TASK-005/019, NFR-SEC-005 |

J-11 runs against the short-TTL e2e stack variant; every other journey runs against the standard composed
stack.

### 10.2 Scenario smoke assertions S1..S11

One unmeasured pass per app in CI. Asserts protocol mechanics and structural facts, never a timing value.

| Scenario | CI smoke assertion |
|---|---|
| S1 Landing | `/` and `/b/` return 200; the five landing blocks are present in order; Astro makes zero API requests from the page, Next makes exactly the `/auth/me` probe; zero third-party origins; footer present at 375 px |
| S2 Login | Login page renders; valid credentials reach the destination's first content; `sid` set; no 429; fresh context so no 409 |
| S3 Dashboard | Seven figures present and equal the seeded manifest's computed values; two recent lists of five; no skeleton remains after settle; `/health` ready throughout |
| S4 Task list | 20 rows; every row exposes five facts; every image request is `variant=thumb`; no full-resolution binary requested; cursor end marker present after traversal |
| S5 Notes list | Five pinned notes first; 20 rows; thumbnails; cursor traversal covers the owner's set without duplicates |
| S6 Task detail | Direct detail URL loads with every stored field and all attachments; the trace contains no prior list-document request |
| S7 Create task | One submit creates exactly one row; success affordance and created detail appear; reset deletes the row and restores `checksums.total` |
| S8 Status update | One status change persists on reload; row treatment updates; reset restores the original status and checksum |
| S9 Note create/edit | Create then edit persists; body not lost; reset removes the note and restores checksum |
| S10 Upload/preview | One fixture upload produces a thumbnail and a full-image lightbox read; attachment count changes by one; reset restores count and checksum |
| S11 Navigation | Two transitions reach their destinations; URL state survives; the manifest records whether a document was requested per transition (Astro expected, Next not expected) without judging it |

The smoke run uses the preview D1, never the measured campaign D1. A smoke pass says nothing about performance
and is never cited as a result.


## 11. What is not tested and why

| Not tested | Reason | Trigger that would add it |
|---|---|---|
| Admin console performance or parity | `apps/admin` is outside the benchmark and has no counterpart app, so FR-UI-009 parity and NFR-PERF-* do not cover it (`design/09-admin-console.md` §1) | An admin screen added to the measured surface, or a parity requirement that names it |
| Load, stress and soak testing | The comparison has zero concurrency by design (`08` §10); no throughput or availability requirement exists in `01` | Any stated concurrency, uptime or capacity target; a public deployment with real traffic |
| Multi-instance behaviour, horizontal scaling, shared rate-limit store | ADR-01 and the one-origin topology fix a single Worker; D1-backed limits are the documented design | A second Worker, or a requirement for shared session/limit state |
| Browser matrix beyond a smoke pass | NFR-COMPAT-002 is a manual smoke requirement; the benchmark is one pinned Chromium | An engine-specific defect, or a release demand for automated cross-browser coverage |
| No-JavaScript operation | NFR-COMPAT-005 excludes it; the static Next app cannot function without JS, so a no-JS requirement would create an exclusive feature (C-07) | A requirement change that makes no-JS part of the product |
| Email verification, password reset, email change | A-06 and `01` §8 place them out of scope; no mail transport exists | A requirement that adds an email flow |
| Real screen-reader behaviour and 200 % zoom judgement | NFR-A11Y-006 is a manual pass; automation can assert DOM/live-region shape but cannot judge announcement quality | An accessibility complaint, or a release gate requiring a recorded assistive-technology pass |
| Penetration testing and WAF/bot defence | Security work is bounded by NFR-SEC-* and `07` §11 | A public launch, or an external security review |
| Non-R2 binary storage (CDN in front of the bucket, a different object store) | C-16 keeps storage behind the `BinaryStore` seam; only the R2 binding is built | A storage-provider change; then NFR-REL-003 fault injection is repeated against the adapter |
| Database restore drill as an automated test | NFR-REL-008 is `SHOULD` and needs a clean environment and a human-run restore | A release that must demonstrate recoverability; the drill becomes a recorded manual gate |
| Visual regression across GPUs and platforms | Only one pinned Chromium / runtime configuration is measured; cross-GPU pixel equality is not a product requirement | A platform-tied visual defect, or a design-system release across platforms |
| Dark mode, i18n/RTL, native mobile, offline/PWA | Out of scope in `01` §8; adding them doubles the state matrix and invalidates cache-cold/warm definitions | A scope change adding one of these |
| Coverage percentage as a target | Coverage is a signal, not an objective; gates assert behaviour and traceability, not a number | A reviewer requests coverage as a diagnostic; it still does not become a gate |

No pass rate, defect count or reliability figure is claimed anywhere in this document. The absence of a test
is stated above rather than hidden behind a green suite.

## 12. Open questions

| # | Question | Default |
|---|---|---|
| TQ-01 | Do contract tests count in the 70 % unit bucket or the 20 % integration bucket? | Unit: in-process, no I/O. The ratio report states this classification. |
| TQ-02 | Should e2e share the benchmark dataset with parity? | No. `taskapp_e2e` is separate; parity reads the seeded dataset, journey specs create and delete their own accounts. |
| TQ-03 | What is the cross-app screenshot tolerance? | ≤ 0.1 % pixels and zero text-region differences; any text difference fails regardless of pixels. |
| TQ-04 | Is cross-browser automation in scope? | No. Manual smoke per NFR-COMPAT-002; automate only after an engine-specific defect. |
| TQ-05 | How often does the S1-S11 protocol smoke run? | Nightly and pre-campaign, not on every PR. A PR may run a single affected scenario when it changes a rendering path. |
| TQ-06 | Is `PATCH /users/me` (#6) tested? | Not until it has an FR. If D-1 is resolved by adding an FR, it gets the same treatment as profile read. |
| TQ-07 | How is the short-TTL session configuration injected? | A test-only config override in the API boot path; no production env var, no alternate verification code. |
| TQ-08 | What happens to a flaky test? | Quarantine with an owner and a linked defect; no silent retry; the gate stays red for the affected behaviour until fixed or formally waived. |
| TQ-09 | Which accessibility rules are automated? | WCAG 2.2 AA rules in one pinned scanner, plus keyboard and focus assertions in Playwright; screen-reader and zoom judgement remain manual. |
| TQ-10 | What happens when the dataset anchor window lapses mid-campaign? | Stop, re-seed with a new `dataset_id`, discard unpaired repetitions, restart the affected cells. |
| TQ-11 | How is storage failure induced for NFR-REL-003? | Through the storage adapter's test fault hook, not by unmounting a real volume in CI. |
| TQ-12 | Who owns the generated FR→test map? | Iqram generates it in CI; Erika audits it before a campaign; a missing `MUST` FR is a merge blocker. |
| TQ-13 | Is a failed parity cell ever waivable? | No for a benchmark. For a non-campaign merge, the gate owner may record a waiver only with the user-visible impact and a linked fix. |
