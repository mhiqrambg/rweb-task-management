---
document: 00-project-discovery.md
phase: 1
stage: 1
prepared_by: software-architect
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [backend-development, security-review]
  changed:
    - "backend-development: forced explicit statement of the parameterized-query rule, Argon2id password handling, D1 batch atomicity, and the 70-20-10 test split that Stages 7-10 must honour."
    - "security-review: forced the authoritative-vs-advisory enforcement framing and the ban on flagging framework-mitigated patterns as risks in Stage 8."
---

# 00 — Project Discovery

## 1. Purpose

Build a web-based **Task & Notes Management System** — tasks with status/priority/due date, notes with
pinning, and image attachments on both — and use it as the instrument for a **controlled performance
comparison of two frontend rendering strategies against one shared backend**:

| | Approach A | Approach B |
|---|---|---|
| Frontend | Astro | Next.js |
| Rendering | On-demand SSR | Static Site Generation (export) |
| Navigation | Multi-page (full document per route) | Client-side (single static shell) |
| Data fetch | Server-side per request | Client-side `fetch` |

The deliverable of Phase 1 is this planning set. The application is **not** to be implemented until
the owner approves the blueprint.

## 2. Problem statement

Two claims need evidence, and the comparison is only valid if the two applications are otherwise
identical:

1. **Product problem** — a person needs one place to track tasks (with priority, status, due date)
   and free-form notes, each able to carry images, reachable from any browser with a login.
2. **Research problem** — "SSR MPA vs SSG SPA" is usually argued from framework marketing. A fair
   answer requires identical features, identical API, identical database, identical data, identical
   network conditions, and measurement of LCP, CLS, INP and network payload under a fixed protocol.

Two risks make the research problem hard, and both are architectural, not cosmetic:

- **Divergence risk.** Two teams writing two frontends will invent two feature sets, two validation
  rules, and two data shapes unless a shared contract package and a shared UI specification exist
  *before* either frontend starts.
- **Rendering-model risk.** SSG cannot serve per-user HTML. The authenticated dashboard must never be
  baked into public static HTML, and `/tasks/[id]` cannot be pre-rendered for user-generated IDs.
  The Next.js app therefore needs a route strategy that is honest about this, not a workaround that
  quietly turns it into an SSR app and invalidates the comparison.

## 3. Goals

| ID | Goal | Success looks like |
|---|---|---|
| G-01 | Two functionally equivalent apps | Every feature in `01-requirements.md` works identically in both; no exclusive feature on either side |
| G-02 | One contract | Both frontends import types and validators from `packages/contracts`; no redefined entity shape in either app |
| G-03 | One backend, one database | Workers + D1 serve both apps; no per-frontend tables, columns, or endpoints |
| G-04 | Reproducible benchmark | A protocol that any team member can re-run and get comparable results |
| G-05 | Measured comparison | LCP, CLS, INP, network payload per scenario, with median and spread across repetitions |
| G-06 | Documentation | This planning set plus a final comparative report |

**Non-goal of the comparison:** declaring a universal winner. The output is a scoped finding under
stated conditions.

## 4. Users and roles

Only one authenticated role exists in the product. There is no admin, no sharing, no team workspace.

| Role | Description | Capabilities |
|---|---|---|
| Visitor | Unauthenticated browser | Landing page, login page, register page |
| Member (owner) | Registered user with an active session | Full CRUD on **their own** tasks and notes, attachments, own profile read/update |

Ownership is the only authorization axis: a Member may read or mutate a task/note/attachment only
when `row.user_id = session.user_id`. Any other case is `404`, not `403`, so the API does not leak
existence (see `07-security-architecture.md`).

## 5. Stakeholders

Real, named people from the brief. No other stakeholder is invented; the evaluator is unnamed.

| Stakeholder | Type | Interest | Influence |
|---|---|---|---|
| Hamzah | Team — Astro SSR frontend | Correct SSR architecture, MPA navigation, deployment config | Owns `apps/web-astro` |
| Azra | Team — Next.js SSG frontend | Static export correctness, client routing, auth-state handling | Owns `apps/web-next` |
| Iqram | Team — backend | Workers + D1 + R2, API contract fidelity, session and upload security | Owns `apps/api`, `packages/contracts`, migrations, `wrangler.jsonc` |
| Erika | Team — QA, performance testing, analysis | Reproducible measurement, fair protocol, defensible report | Owns benchmark protocol and results; runs testing and analysis at the end of the roadmap |
| Project owner / academic evaluator | Decision authority | Coherent plan, working software, defensible comparison | Approval gate on this blueprint; not named in the brief (see Q-01) |

## 6. Domain context and vocabulary

Canonical terms used identically in every document. Frontends MUST NOT introduce synonyms
(e.g. "todo item", "memo", "file").

| Term | Definition |
|---|---|
| **User** | Account with email + password, owns tasks, notes, attachments, sessions |
| **Member/owner** | The authenticated user; `user_id` on every owned row |
| **Task** | Owned record: `title`, `description`, `status`, `priority`, `due_date`, timestamps, 0..n attachments |
| **Note** | Owned record: `title`, `body`, `pinned`, timestamps, 0..n attachments |
| **Attachment** | Owned record pointing to a stored binary: `id`, `owner`, `target` (task or note), `mime`, `size`, `width/height`, `storage_key`, `created_at` |
| **Session** | Server-side authentication record; the browser holds only an opaque token in cookie `sid` |
| **Status** | `todo` \| `in_progress` \| `completed` (server enum, lowercase snake) |
| **Priority** | `low` \| `medium` \| `high` |
| **Contract** | The shared TypeScript types + Zod validators in `packages/contracts` |
| **Scenario** | A named benchmark step (S1..S11 in `08-performance-strategy.md`) |
| **Lab run** / **Field run** | Lighthouse controlled run / Playwright + `web-vitals` scripted run |

## 7. System boundaries

**Inside the system**

- `apps/api` — Workers REST API (ElysiaJS), authentication, authorization, validation, upload handling, binary
  serving, D1 access, migrations.
- `apps/web-astro` — Astro SSR app on the `@astrojs/cloudflare` adapter as a Worker, with server-rendered pages, form posts / server-side fetch to the API.
- `apps/web-next` — Next.js static export, client-side data fetching and routing.
- `packages/contracts` — types, Zod schemas, error codes, route constants.
- `packages/design-tokens`, `assets/` — shared visual tokens and static media.
- D1 database (binding `env.DB`); R2 bucket for attachment binaries (binding `env.BUCKET`).
- Cloudflare zone routing that presents **one origin** to browsers.

**Outside the system**

- Email delivery (no verification, no reset — A-06).
- Third-party object storage/CDN (evaluated as an option, not baseline — ADR-07).
- Payments, sharing, real-time collaboration, mobile apps, push notifications.
- Analytics/monitoring SaaS (structured logs to stdout only).

## 8. Constraints

| ID | Constraint | Source |
|---|---|---|
| C-01 | Astro frontend MUST be SSR + MPA | brief §1 |
| C-02 | Next.js frontend MUST be SSG + client-side navigation/data | brief §1 |
| C-03 | One shared backend: Cloudflare Workers + ElysiaJS + D1 + R2, REST, cookie auth, multipart upload | brief §1 |
| C-04 | Both frontends consume the same API and DB | brief §2.3 |
| C-05 | Identical UI/UX, features, data structures, API contracts | brief §2.2 |
| C-06 | Image binaries outside the database, metadata inside | brief §7 |
| C-07 | No exclusive feature in either frontend | brief §3.F |
| C-08 | Planning only; no implementation in this phase | brief §14 |
| C-09 | Benchmark runs MUST use production builds, never dev servers | brief §10 |
| C-10 | Team of four, each with a named primary area | brief §4 |
| C-11 | No fabricated measurements | architect rule; any number in a plan is an objective or an assumption |
| C-12 | Workstation toolchain is partially broken: pnpm resolves only to a broken corepack shim, no Cloudflare account credentials configured, no `.git` | Stage 3 environment assessment; these are Phase-0 prerequisites, not design decisions |

## 9. Existing artifacts

Workspace is empty — see `02-repository-assessment.md` for the evidence. There is no prior codebase,
no `AGENTS.md`, no `DESIGN.md`, no `RULES.md`, no package manifest, no lockfile, no git history. This
blueprint is therefore **greenfield**: every convention below is a proposal, not a description of
existing practice.

## 10. References

| Ref | Use |
|---|---|
| `local://phase1-scope.md` | Authoritative product intent for this phase |
| Astro docs — on-demand rendering, `@astrojs/cloudflare` adapter | Stage 4 rendering model |
| Next.js docs — `output: 'export'` unsupported features | Stage 4 rendering model |
| web.dev — Core Web Vitals (LCP/CLS/INP) definitions and thresholds | Stage 9 |
| OWASP ASVS 4.0.3, OWASP Cheat Sheet Series (sessions, file upload, CSRF) | Stage 8 |
| D1 (SQLite) docs — indexes, `LIKE`/`ESCAPE` semantics, `ON DELETE` semantics | Stage 6 |

## 11. Assumptions

Every assumption is an ID referenced elsewhere. Assumed items never drive infrastructure by
themselves (see `12-architecture-review.md` §5).

| ID | Assumption | If wrong |
|---|---|---|
| A-01 | Academic project with a fixed deadline; absolute dates unknown, so the roadmap is expressed in **weeks** (W1..W12) | Re-scale phase durations; phase order and dependencies hold |
| A-02 | Single-tenant product: a user sees only their own rows; no sharing | Adds a membership table and a second authorization axis (out of scope, would reopen 05/06/07) |
| A-03 | Deployment target is one Cloudflare-hosted origin provided by Cloudflare zone routing; all apps share that origin | Different origins → cookie `SameSite`/CORS changes (ADR-05 alternatives cover it) |
| A-04 | Benchmark dataset generated synthetically (per user: 50 tasks, 50 notes, 3 images ≤ 1 MB) | Dataset spec changes; protocol and metric definitions do not |
| A-05 | Four part-time contributors; ~10–12 effective hours/week each | Timeline stretches; critical path unchanged |
| A-06 | No email verification, no password reset, no email change flow | Adds mail transport + token tables + two endpoints |
| A-07 | Attachments: `image/jpeg`, `image/png`, `image/webp`; ≤ 5 MB each; ≤ 10 per task/note | Limits are constants in `packages/contracts`; one-line change plus migration-free |
| A-08 | Runtime: Cloudflare Workers with D1 and R2 bindings; Node 24 LTS locally for tooling (Node 26 LTS is current; 22 and 24 also LTS), Node floor ≥ 22.23.4 as required by Astro 7; pnpm 9 | Version drift only; Astro 7 documents ≥ 22.23.4 and Next 16 documents ≥ 20.9, both satisfied |
| A-09 | Responsive target desktop-first, breakpoints 640/768/1024/1280 | Token changes only |
| A-10 | Benchmark browser is Playwright-pinned Chromium at one viewport (1440×900) | Protocol rerun with a different pinned browser |

Requirement-level assumptions `A-11`..`A-21` (password policy, session lifetime, field limits, counter
definitions, date-only due date, thumbnail rendition, post-registration behaviour, page size, partial
uploads, language, extra dashboard statistics) are defined once, in `01-requirements.md` §7. They are
not repeated here. Design- and protocol-level assumptions are defined once each where they are used:
`A-22`..`A-25` in `03` (zone-routing version, framework constraints, native module), `A-26`..`A-29` in `07` §12
(upload decode limits, decode queue, edge header handling, body cap), `A-30`..`A-46` in `08` Appendix A
(benchmark protocol constants). `A-23` is intentionally unused.

## 12. Open questions

| ID | Question | Blocks | Default if unanswered |
|---|---|---|---|
| Q-01 | Absolute deadline and reporting format required by the evaluator | Roadmap dates (`10`) | Roadmap stays in relative weeks |
| Q-02 | Must both apps be reachable **simultaneously** in the demo? | Deployment topology (`03`, ADR-05) | Both served under one origin, path-prefixed (`/a`, `/b`) |
| Q-03 | UI copy language: Indonesian, English, or both | UI spec (`14`) | English copy strings, single locale, no i18n layer |
| Q-04 | Is a password-reset flow required for grading? | Requirements (`01`) | Out of scope (A-06), documented as such |
| Q-05 | Mobile/tablet required in the demo, or desktop only? | UI spec, test matrix (`09`) | Responsive down to 375 px, benchmarked at desktop only |
| Q-06 | Permitted max upload size for the demo dataset | Upload limits (`01`, `07`) | 5 MB per file (A-07) |

Requirement-level questions `Q-07`..`Q-14` are defined once, in `01-requirements.md` §9.

## 13. Boundaries of this phase

In scope: requirements, architecture, ADRs, data model, API contracts, security, performance plan,
test plan, roadmap, risk register, review, team matrix, UI/UX spec, `DEVELOPMENT-GUIDELINES.md`.

Out of scope: any application source, migration files, dependency installation, `package.json`,
lockfiles, `wrangler.jsonc`, CI config, dev servers, builds, and any global or agent configuration.
