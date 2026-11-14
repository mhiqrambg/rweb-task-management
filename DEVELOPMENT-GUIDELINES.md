---
document: DEVELOPMENT-GUIDELINES.md
phase: 1
stage: 11
prepared_by: software-architect
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: none
  used: none
  changed:
    - "nothing — this file restates process rules derived from .planning/00-14 and cites them as the authority; no skill content shaped it."
---

# DEVELOPMENT-GUIDELINES.md

Rules every team member follows. This file states **process and enforcement**; it does not restate
contracts. The authority for any technical detail is `.planning/` — start at
`.planning/12-architecture-review.md` (mapping table) when you cannot find something.

Status: proposed with the rest of the Phase 1 blueprint. It takes effect at the first commit
(prerequisite P-04: `git init`).

---

## 1. Authority and precedence

| Level | Source | Rule |
|---|---|---|
| 1 | `.planning/00-…12-…` | The blueprint. Data shapes, routes, statuses, cookie name, storage layout are defined **once**, there |
| 2 | `packages/contracts` | Executable form of the blueprint's types and validators. When docs and code disagree, that is a defect — raise it, do not pick a side |
| 3 | This file | How we work: branches, reviews, gates, DoD |
| 4 | Personal preference | Nothing. Consistency beats taste |

If a document is wrong, fix the document in the same PR as the code. Never "just do it differently".

## 2. Non-negotiables

1. **One contract.** No entity type, field name, enum, or validation rule is declared outside
   `packages/contracts`. If a frontend needs a new shape, it is added there first.
2. **No divergent features.** A feature shipped in one frontend must exist in the other, or it does not
   ship (brief C-07). Feature work lands as a pair or behind no flag at all.
3. **The API is the only gate.** Frontend route guards are UX. Authorization is enforced server-side on
   every request; a non-owned resource returns `404`, never `403`.
4. **Nothing private in static HTML.** `apps/web-next` static output must contain zero user data. Any
   build that emits user data into `.next/out` is a release blocker.
5. **No secrets in git.** `.env` is gitignored; `.env.example` documents names only.
6. **No fabricated numbers.** Benchmark tables contain measured values only, with the run ID. A plan
   may state objectives, never results.
7. **Production builds for benchmarking.** `pnpm dev` output is never a measurement source.
8. **No new dependency without a paragraph.** Add a line to the PR: what it does, why the platform or
   an existing dep cannot, and its install size. `packages/contracts` stays dependency-free except
   `zod`.

## 3. Repository rules

- Layout is fixed by `.planning/03-system-architecture.md` §7. Do not add a top-level directory without
  an ADR.
- Dependency direction: `apps/*` → `packages/*`. Never `apps/web-next` → `apps/web-astro`, never
  `packages/*` → `apps/*`.
- `apps/web-astro` and `apps/web-next` must not share component source. They share **tokens** and
  **contracts**, and they must look identical — not be written identically (brief §9).
- Commit `pnpm-lock.yaml`. Never commit `node_modules`, `.env`, upload contents, or `.next/out`,
  `dist/`, `apps/api/storage/`.

## 4. Branching and commits

- `main` is always green and deployable. No direct pushes.
- Branch names: `feat/<area>-<slug>`, `fix/<area>-<slug>`, `docs/<slug>`, `chore/<slug>`,
  `test/<slug>`. Area ∈ `api`, `astro`, `next`, `contracts`, `infra`, `bench`.
- Commits: Conventional Commits (`feat(api): add task status transition`). One logical change per
  commit; do not mix formatting with behaviour.
- Rebase to keep history linear; no merge commits into `main`.
- Do not commit generated artifacts (migration output, `desktop.ini`, editor folders).

## 5. Pull requests

Every PR states, in the description:

1. **What changed** and which requirement IDs (`FR-…`, `NFR-…`) or ADR it serves.
2. **Contract impact**: `none` / added / changed (changed = both frontends updated in the same PR, or a
   linked blocking PR).
3. **How it was verified**: the exact commands run, not "tested locally".
4. **Screenshots** for any UI change, from **both** frontends when the change is user-visible.
5. **Risk**: what could break and what you would watch.

Review rules:

- Minimum one approval, from the owner of the area or the backend owner for contract changes.
- Contract changes need Iqram's review. Anything touching `auth` needs Iqram **and** Hamzah.
- Reviewers check the four contract points first: shape, status codes, error envelope, ownership rule.
- CI must be green: `typecheck`, `lint`, `test`. e2e green before merge to `main` once it exists.
- Review SLA: 1 working day. A PR idle for 2 days gets a nudge in the standup, not a silent merge.

## 6. Code standards

- TypeScript `strict`; `any` requires a comment. `as` casts require a comment. No non-null `!` on
  anything from the network.
- Validation happens at the boundary (route handler) with the shared Zod schema; inside the service the
  type is already trusted.
- SQL is parameterized, always (`$1`), in `modules/*/repo.ts`. String-built SQL is a review reject.
- Errors: throw typed domain errors, map to the envelope once in the error handler. No `res.send(err)`.
- No `console.log` in `apps/api/src` — use the Fastify logger (`request.log`).
- Frontend data access goes through one module per app (`lib/api.ts`) so the base URL, credentials, and
  error mapping live in one place.
- Formatting: Prettier defaults; do not reformat files you did not otherwise touch.

## 7. Testing obligations

| Change | Minimum before review |
|---|---|
| Contract or validation | unit test in `packages/contracts` + one API integration test |
| API endpoint | integration test incl. the **404-on-foreign-owner** case |
| Auth/session | integration test: valid, expired, logged-out, tampered cookie |
| Upload | integration test: allowed mime, oversize, wrong mime, foreign owner |
| UI component | component test or Playwright step covering the state (empty/loading/error/success) |
| Any new page | Playwright smoke: renders in both apps, same visible content |

Test names reference requirement IDs (`FR-TASK-04 …`) so a failure names the broken promise.
No PR lowers coverage of the modules it touches.

## 8. Definition of Done (every task)

- Behaviour matches its requirement ID and its acceptance criteria.
- Both frontends updated where the requirement applies to both.
- Tests at the level the change demands, passing.
- `typecheck`, `lint`, `test` green locally; CI green.
- Docs touched: any change to a shape, route, status, or env var lands in `.planning/` in the same PR.
- No TODOs left behind without an issue reference. No dead code, no commented-out blocks.
- Reviewer can reproduce the verification from the PR description.

## 9. Security rules (short form; full detail in `.planning/07-security-architecture.md`)

- Passwords: Argon2id only. Never log, never return, never store plaintext.
- Sessions: opaque token in `sid` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`). Server stores only
  the SHA-256 hash. Never put a token in `localStorage`, a URL, or a log line.
- Ownership check on **every** read and write, in the query (`WHERE user_id = $1`), not after the fetch.
- Uploads: check MIME by content (`file-type`), not by `Content-Type` or extension alone; enforce size
  before writing to disk; generate the storage key server-side; never serve the upload directory.
- Never interpolate user input into SQL, shell, HTML, or a file path.
- Do not disable CSRF/same-origin checks to "make it work" — report it instead.
- Report a suspected vulnerability to Iqram and Hamzah before writing a public issue.

## 10. Performance discipline

- Any PR touching a page, a list, an image, or an API list endpoint states its expected effect on LCP,
  CLS, INP or payload, and how it was checked (Lighthouse once, or the bench script).
- No layout-shifting inserts: reserve space for images (`width`/`height` or aspect-ratio), skeletons
  must match final dimensions.
- List endpoints paginate. Unbounded list fetches are a review reject.
- Images: thumbnails are a separate derived file, never the full binary scaled in CSS.

## 11. Definition of "measured"

A benchmark number is admissible only with: run ID, commit SHA of both frontends and the API, browser
version, viewport, network profile, dataset ID, repetitions, and the raw file it came from. Anything
else is an anecdote and is labelled as such.

## 12. Escalation

| Situation | Who decides |
|---|---|
| Contract shape dispute | Iqram, then the architect's blueprint, then project owner |
| Cross-frontend visual divergence | Hamzah + Azra agree against `.planning/14-ui-ux-specification.md`; the spec wins |
| Perf protocol dispute | Erika; the protocol in `.planning/08` is the referee |
| Scope change | Project owner; log it in `.planning/12-architecture-review.md` §6 (contradiction log) |
| Blocked > 1 day | Raise it, do not absorb it silently |
