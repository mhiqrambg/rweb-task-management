---
document: 13-team-responsibility-matrix.md
phase: 1
stage: 11 (supplement to the roadmap)
prepared_by: software-architect
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [backend-development]
  changed:
    - "backend-development: its 70-20-10 test split and 'contract testing for services' line became Erika's enforceable gate ownership instead of a vague 'QA at the end'."
---

# 13 — Team Responsibility Matrix

Four people, one shared contract. This file is the authority for **who owns what and who cannot be
blocked by whom**. Technical detail lives in the other documents; phases (P1..P12) and task IDs (T-xx)
are defined in `10-implementation-roadmap.md`.

> **Ownership revision (2026-11-15, project owner).** Frontend and QA ownership swapped:
> Astro SSR is **Hamzah**, Next.js SSG is **Azra**, backend (Fastify + PostgreSQL, contracts, infra) is
> **Iqram**, QA performance testing and analysis is **Erika**, executed at the end of the roadmap after
> both apps are integrated. Superseded text in other documents was corrected in the same change.

## 1. Ownership map

| Area | Owner | Backup / reviewer |
|---|---|---|
| `packages/contracts` (types, Zod, error codes, route constants) | Iqram | Hamzah |
| `apps/api` (Fastify, auth, upload, migrations, DB access) | Iqram | Hamzah |
| `apps/web-astro` (SSR pages, Astro endpoints, Node adapter config) | Hamzah | Azra (review of UI parity) |
| `apps/web-next` (static export, client router, client data layer) | Azra | Hamzah (review of UI parity) |
| `packages/design-tokens` + `14-ui-ux-specification.md` | Hamzah + Azra (joint, Hamzah records) | Iqram |
| Benchmark protocol, dataset, harness, results | Erika | Iqram (API-side instrumentation) |
| `infra/` (compose, reverse proxy, Dockerfiles) | Iqram | Hamzah (parity of the measured environment) |
| Final comparative report | Erika (lead), all contribute sections | Project owner |

Single-writer rule: a file's owner merges changes to it. Anyone may open a PR against it; nobody
merges another owner's area without their approval.

## 2. Per-member matrix

### Hamzah — Astro SSR frontend

| Field | Content |
|---|---|
| **Primary** | `apps/web-astro`: SSR pages, MPA navigation, server-side data fetching with cookie forwarding, auth gate redirects, Astro server endpoints for form posts, Node standalone adapter config |
| **Secondary** | Landing page implementation (first, because it is shared visual ground), design-token consumption, Astro side of the benchmark scenarios, UI parity review of `apps/web-next` |
| **Deliverables** | Working Astro app covering every `FR-*` marked applies-to-both; `astro.config.mjs` with `output:'server'` + adapter; SSR deployment notes; screenshots for the report |
| **Technical dependencies** | `packages/contracts` (P3), API running with seed data (P5), design tokens + `14` (P2), reverse proxy config (P4/P8) |
| **Independent** | Page/layout/components against a contract-first mock, landing page, styling, form validation UX, empty/loading/error states, accessibility pass |
| **Collaboration needed** | Contract changes (Iqram), route/visual parity sign-off (Azra), cookie behaviour under the proxy (Iqram, Erika for verification), benchmark scenarios S1–S11 (Erika) |
| **Acceptance** | Every applicable FR passes on the Astro build; Parcel-free production build (`pnpm build`) starts under the adapter and serves pages with the cookie; no client fetch waterfall on authed pages; Playwright astro suite green |
| **Overload risk** | **Medium-high.** SSR introduces deployment/config work that the Next.js side does not have, plus he carries the landing page. Mitigation: landing page built once in P6 and mirrored in P7 (not rewritten from scratch), and the adapter/deploy debugging timeboxed with Iqram's help |

### Azra — Next.js SSG frontend

| Field | Content |
|---|---|
| **Primary** | `apps/web-next`: `output:'export'`, single static shell + query-param client router, client data layer (`lib/api.ts` with `credentials:'include'`), auth-state bootstrap via `/auth/me`, skeleton/CLS discipline, thumbnail and lightbox components |
| **Secondary** | Route-strategy documentation (why no `/tasks/[id]`), static-export constraints guardrail (a build that emits user data fails), UI parity review of `apps/web-astro` |
| **Deliverables** | Working Next.js app covering the same FR set; `next.config` with `output:'export'`, `images.unoptimized:true`; client router; documented static-export limits; screenshots for the report |
| **Technical dependencies** | Same as Hamzah, plus the route-strategy decision (ADR-04) and `NEXT_PUBLIC_API_BASE_URL` baked at build |
| **Independent** | Shell, router, components against contract-first mocks, loading/empty/error states, lightbox, responsive layout |
| **Collaboration needed** | Contract changes (Iqram), parity sign-off (Hamzah), CORS/dev-proxy setup for local dev (Iqram), S1–S11 scenarios (Erika) |
| **Acceptance** | Static `out/` build contains no user data (grep for a seeded email returns nothing); deep link `/app/?view=tasks&id=<uuid>` restores the view after reload; unauthenticated visit redirects to login after the session probe; no layout shift from the auth skeleton; Playwright next suite green |
| **Overload risk** | **Medium.** The SSG constraint is the least familiar area and every workaround tempts a redesign into SSR (which would invalidate the comparison). Mitigation: ADR-04 is binding; any deviation is escalated, not improvised |

### Iqram — Node.js + Fastify + PostgreSQL backend

| Field | Content |
|---|---|
| **Primary** | `apps/api`, `packages/contracts`, migrations, session auth, ownership enforcement, multipart upload + storage, error envelope, rate limiting, security headers, seeded dataset endpoint/script |
| **Secondary** | `infra/` compose and reverse proxy, API-side timing/log instrumentation for the benchmark, review of all contract changes |
| **Deliverables** | Running API with every endpoint in `06`; migrations that build the schema from empty; seed + dataset generator; integration test suite; OpenAPI-free but contract-accurate handler set; `.env.example` |
| **Technical dependencies** | Requirements `01`, data model `05`, API spec `06` (P3); Docker/PG availability (P-02/P-03); node runtime present |
| **Independent** | Schema + migrations once `05` is approved, auth module, CRUD modules, upload module, error handling, tests — all before either frontend is finished |
| **Collaboration needed** | Contract shape changes (both frontend owners), cookie/proxy behaviour (Hamzah, Erika), dataset size for benchmarking (Erika) |
| **Acceptance** | All integration tests green including the 404-on-foreign-owner cases for every owned resource; upload rejects oversize and wrong MIME; session expiry enforced; API serves list endpoints in bounded time at dataset scale |
| **Overload risk** | **High.** Iqram is on the critical path for *both* frontends and owns infra. Mitigation: contract frozen and published at end of P3 (before any UI work), API mocked from the contract so frontends never wait; infra work timeboxed and parallel to frontend work |

### Erika — QA, performance testing and analysis

| Field | Content |
|---|---|
| **Primary** | Test strategy execution, e2e suites, benchmark protocol ownership, dataset and harness, results collection, statistical summary, comparative report, defect triage |
| **Secondary** | Security test cases, accessibility checks, parity verification between the two apps, release gate sign-off |
| **Deliverables** | `09`-conformant test suites and fixtures; reproducible harness (`scripts/bench`); raw result files with run IDs; results tables + charts; report chapters 4–6; defect log |
| **Technical dependencies** | Requirements with acceptance criteria (P1/P2), API contract (P3), both apps deployed behind the proxy (P8), production builds (P10) |
| **Independent** | Test plan from `09` immediately, dataset generator spec, harness scaffolding, protocol dry runs against the API alone, accessibility audit of the landing page |
| **Collaboration needed** | Instrumentation hooks from Iqram, scenario walkthroughs with Hamzah and Azra, environment parity (same host, same DB, same dataset) |
| **Acceptance** | Two apps measured under identical conditions with ≥ 5 repetitions per scenario, cache-cold and cache-warm separated; medians and IQR reported; every claim traceable to a raw file; report states limitations |
| **Overload risk** | **Medium-high.** Load is back-loaded by nature (P9–P12) but the brief explicitly requires QA from planning onward. Mitigation: the P2–P8 tasks below are mandatory, not optional |

## 3. Phase participation (RACI)

R = does the work, A = accountable, C = consulted, I = informed.

| Phase | Hamzah | Azra | Iqram | Erika |
|---|---|---|---|---|
| P1 Planning & discovery | C | C | C | C (A: architect/owner) |
| P2 UI/UX specification | R | R | C | C |
| P3 Data model & API contract | C | C | R | C |
| P4 Repo & environment setup | C | C | R | C |
| P5 Backend development | I | I | R | C |
| P6 Astro frontend | R | C | C | C |
| P7 Next.js frontend | C | R | C | C |
| P8 Integration | R | R | A | C |
| P9 Functional testing | C | C | C | R |
| P10 Performance benchmarking | C | C | C | R (A) |
| P11 Analysis & documentation | C | C | C | R (A) |
| P12 Final presentation | R | R | R | R (A) |

## 4. Early QA obligations (P2–P8)

The brief forbids QA starting only at the end. These are Erika's tasks before P9 begins:

| Phase | QA deliverable | Gate effect |
|---|---|---|
| P2 | Acceptance-criteria checklist per FR; parity checklist (ast parity) | Blocks P6/P7 start |
| P3 | API contract cases drafted from `06` (happy, validation, auth, ownership) | Blocks P5 merge of each module |
| P4 | Environment parity checklist (Node, PG, browser, dataset) | Blocks P8 |
| P5 | Contract tests executed against the API as it lands | Each module's PR |
| P6/P7 | Playwright smoke per page, both apps; state coverage (empty/loading/error/success) | Each page's PR |
| P8 | Cross-app parity run: same dataset, same assertions, both apps | Blocks P9 |

## 5. Workload imbalance analysis

| Risk | Evidence | Mitigation |
|---|---|---|
| Iqram is the single point of failure | Owns contracts + API + infra; both frontends block on him | Freeze contracts by end of P3; mock API from contract; infra timeboxed; Hamzah reviews contract PRs to share knowledge |
| Frontend owners idle in P5 | Their work depends on a live API | Contract-first mocks mean P6/P7 can start in parallel with P5 (see `10` §4) |
| Erika back-loaded | Benchmark and report are P10–P11 | §4 front-loads QA; harness scaffolding begins in P2 |
| Hamzah heavier than Azra in setup | SSR adapter + proxy + runtime env are extra work | Landing page built once and mirrored; adapter debugging paired with Iqram; the proxy is Iqram's deliverable, not his |
| Knowledge silos | Each area has one owner | Mandatory reviewer from another area on every P8 PR; report sections cross-reviewed |

## 6. Escalation and unblocking

| Blocker | First ask | Then |
|---|---|---|
| Contract shape unclear | Iqram | `06`/`01`, then architect's `12` |
| Visual divergence | The other frontend owner | `14`, then the parity checklist |
| Environment/DB not running | Iqram | `02` §4 prerequisites |
| Benchmark result looks wrong | Erika | Re-run with run ID; never adjust numbers by hand |
| Task ownership dispute | Project owner | `10` §2 task owner column |
