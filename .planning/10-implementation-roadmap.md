---
document: 10-implementation-roadmap.md
phase: 1
stage: 11
prepared_by: software-architect
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [backend-development]
  changed:
    - "backend-development: put contract tests and migration-from-empty into the per-module gates instead of a later test phase, which moved QA left in the schedule."
---

# 10 — Implementation Roadmap

Relative schedule: **W1..W12** (A-01). If the deadline is shorter, compress by merging P2 into P1 and
P12 into P11 — never by removing P9/P10, which produce the project's evidence. Owner names are people;
phase gates are approvals, not ceremonies.

## 1. Phase overview

| Phase | Name | Weeks | Owner | Gate |
|---|---|---|---|---|
| P1 | Planning & discovery | W1 | architect + project owner | **G1** blueprint approved |
| P2 | UI/UX specification | W1–W2 | Erika + Azra | **G2** tokens + screen inventory frozen |
| P3 | Data model & API contract | W2 | Iqram | **G3** contract frozen (`packages/contracts` tagged) |
| P4 | Repository & environment setup | W2–W3 | Iqram | **G4** `dev` runs all three apps from a clean clone |
| P5 | Backend development | W3–W6 | Iqram | **G5** all endpoints + integration tests green |
| P6 | Astro frontend | W4–W8 | Erika | **G6a** Astro feature-complete |
| P7 | Next.js frontend | W4–W8 | Azra | **G6b** Next feature-complete, static-output check green |
| P8 | Integration | W8–W9 | Iqram | **G7** both apps behind one origin, parity run green |
| P9 | Functional testing | W9–W10 | Hamzah | **G8** test matrix green, defects triaged |
| P10 | Performance benchmarking | W10–W11 | Hamzah | **G9** all runs complete, raw data archived |
| P11 | Analysis & documentation | W11–W12 | Hamzah | **G10** report draft reviewed by all |
| P12 | Final presentation | W12 | Hamzah | **G11** owner sign-off |

```mermaid
gantt
  title Phase schedule (relative weeks)
  dateFormat  X
  axisFormat  W%I
  section Foundation
  P1 Planning            :p1, 0, 1
  P2 UI/UX spec          :p2, 1, 2
  P3 Data + API contract :p3, 1, 2
  P4 Repo + environment  :p4, 2, 2
  section Backend
  P5 API development     :p5, 3, 4
  section Frontends
  P6 Astro SSR           :p6, 4, 5
  P7 Next.js SSG         :p7, 4, 5
  section Verification
  P8 Integration         :p8, 8, 2
  P9 Functional testing  :p9, 9, 2
  P10 Benchmarking       :p10, 10, 2
  P11 Analysis + report  :p11, 11, 2
  P12 Presentation       :p12, 11, 1
```

## 2. Tasks

Every task names one owner. "Both FE" means the change must land in `apps/web-astro` and
`apps/web-next` before the task is done.

### P1 — Planning & discovery (W1)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-101 | Discovery: purpose, users, boundaries, constraints | architect | — | `00`, `02` |
| T-102 | Requirements with IDs, priorities, acceptance criteria | requirements analyst | T-101 | `01` |
| T-103 | System architecture + ADRs | architecture analyst | T-102 | `03`, `04` |
| T-104 | Data model + API contracts | database/API designers | T-102, T-103 | `05`, `06` |
| T-105 | Security, performance, test plans | security/perf/test specialists | T-104 | `07`, `08`, `09` |
| T-106 | Roadmap, risks, team matrix, UI spec, review | architect | T-101..T-105 | `10`..`14` |
| T-107 | Owner approves the blueprint | project owner | T-106 | G1 recorded in `12` §7 |

### P2 — UI/UX specification (W1–W2)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-201 | Finalize tokens into `packages/design-tokens` | Erika | G1 | `tokens.css`, `tokens.json` |
| T-202 | Component inventory with states (C-01..C-23) | Erika + Azra | T-201 | component checklist |
| T-203 | Screen inventory + route map for both apps | Azra | T-202 | route table confirmed against `14` §4 |
| T-204 | Copy strings file | Erika | T-202 | `packages/contracts/src/copy.ts` |
| T-205 | Acceptance + parity checklist per FR | Hamzah | T-102 | checklist in `09` appendix |
| T-206 | Map the 11 benchmark scenarios to screens | Hamzah | T-203 | scenario→screen table |

### P3 — Data model & API contract (W2)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-301 | Schema review → numbered migration plan | Iqram | `05` | migration list (`0001_init`…) |
| T-302 | `packages/contracts` scaffold: types, Zod schemas, error codes, route constants | Iqram | T-301 | compilable package |
| T-303 | Contract tests (schema round-trip, enum closure, envelope) | Hamzah | T-302 | Vitest suite |
| T-304 | Freeze + tag `contracts@0.1.0` | Iqram | T-302, T-303 | G3 |
| T-305 | Mock API from contract (dev fixture server) | Iqram | T-304 | `scripts/mock-api` so P6/P7 never block |

### P4 — Repository & environment setup (W2–W3)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-401 | `git init`, `main`, remote, branch protection, PR template, commit convention | Iqram | — | repo with rules from `DEVELOPMENT-GUIDELINES.md` |
| T-402 | **Repair pnpm** (`corepack prepare pnpm@9 --activate` or `npm i -g pnpm`) | Iqram | — | `pnpm -v` works (P-01) |
| T-403 | **Start container runtime + PostgreSQL 16 Compose service** | Iqram | — | `psql` reachable on `localhost:5432` (P-02, P-03) |
| T-404 | Workspace skeleton: `pnpm-workspace.yaml`, root `package.json`, tsconfig bases, eslint/prettier | Iqram | T-402 | `pnpm install` succeeds |
| T-405 | `infra/`: compose (api, pg), reverse proxy config (one origin, `/`, `/b`, `/api`) | Iqram | T-403 | `docker compose up` serves the proxy |
| T-406 | `.env.example` + config loader with schema validation | Iqram | T-404 | documented env contract |
| T-407 | Seed + dataset generator (deterministic, ID-tagged) | Iqram + Hamzah | T-301 | `scripts/seed --dataset=m1` |
| T-408 | CI: typecheck, lint, unit, integration (pg service), e2e skeleton | Iqram | T-404 | green pipeline on `main` |
| T-409 | Environment parity checklist | Hamzah | T-403 | checked list in `09` appendix |

### P5 — Backend development (W3–W6)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-501 | App skeleton: Fastify instance, plugins (cookie, helmet, rate-limit, multipart), error envelope, logger | Iqram | T-404 | `GET /health` green |
| T-502 | Migrations `0001_init` (5 tables, indexes, extensions) | Iqram | T-301 | `db:migrate` from empty works |
| T-503 | Auth module: register, login, logout, me, Argon2id, session table, cookie | Iqram | T-502 | auth integration tests |
| T-504 | Authorization helper + `WHERE user_id` rule + 404 semantics | Iqram | T-503 | ownership tests |
| T-505 | Tasks module (list w/ cursor+filters+search, CRUD) | Iqram | T-504 | module + tests |
| T-506 | Notes module (list, CRUD, pinned ordering) | Iqram | T-504 | module + tests |
| T-507 | Attachments: multipart, sniffing, size limit, storage write, thumbnail, stream endpoint, delete | Iqram | T-505, T-506 | module + tests |
| T-508 | Dashboard aggregate endpoint | Iqram | T-505, T-506 | module + test |
| T-509 | Contract tests run against the live API | Hamzah | T-505, T-506, T-507, T-508 | contract suite green |
| T-510 | Per-request timing logs for the harness | Iqram | T-501 | log fields documented |
| T-511 | Maintenance script: session purge, orphan binary sweep, orphan row reconciliation + nightly host cron entry (M1–M3) | Iqram | T-502, T-507 | `db-maintenance` script + crontab line in `infra/` |
| T-512 | Backup + restore drill: `pg_dump` + uploads archive, one rehearsed restore into a clean stack, dataset checksum compared (NFR-REL-008, M5) | Iqram | T-407 | recorded rehearsal with checksum |

### P6 — Astro frontend (W4–W8)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-601 | Project setup: `output:'server'`, `@astrojs/node` standalone, runtime API base | Erika | T-404, T-304 | dev server proxies `/api` |
| T-602 | Sign-in-proxy/transport layer: server-side fetch with cookie forwarding, 401 handling | Erika | T-503, T-601 | `lib/api.ts` |
| T-603 | Auth pages (login, register) with validation, states | Erika | T-602 | pages + tests |
| T-604 | App shell, sidebar, nav, account menu, logout | Erika | T-603 | shell |
| T-605 | Landing page | Erika | T-201 | `/` |
| T-606 | Dashboard (counts + recent tasks/notes + search entry) | Erika | T-604, T-508 | `/app` |
| T-607 | Task list: search, filters, pagination, thumbnails | Erika | T-604, T-505 | `/tasks` |
| T-608 | Task detail + edit + delete confirm + status update | Erika | T-607 | `/tasks/[id]` |
| T-609 | Notes list + detail + pin + edit/delete | Erika | T-604, T-506 | `/notes`, `/notes/[id]` |
| T-610 | Attachments UI: dropzone, progress, thumbnails, lightbox, remove | Erika | T-607, T-609, T-507 | shared components |
| T-611 | Empty/loading/error/success states across screens | Erika | T-603..T-610 | state matrix complete |
| T-612 | Accessibility + responsive pass | Erika | T-611 | checklist ≥ AA |

### P7 — Next.js frontend (W4–W8)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-701 | Project setup: `output:'export'`, `basePath:'/b'`, `images.unoptimized`, env base URL | Azra | T-404, T-304 | static build |
| T-702 | Single-shell client router (`?view=&id=&mode=`) + history handling | Azra | T-701 | router |
| T-703 | Data layer `lib/api.ts` with `credentials:'include'`, 401 → login, error mapping | Azra | T-701, T-503 | client |
| T-704 | Auth bootstrap: `GET /auth/me` on load, skeleton, redirect | Azra | T-703 | shell gate |
| T-705 | Auth pages (login, register) | Azra | T-703 | pages |
| T-706 | Landing page (shared assets, static) | Azra | T-201 | `/b/` |
| T-707 | Dashboard | Azra | T-704, T-508 | view |
| T-708 | Task list: search, filters, cursor pagination, thumbnails | Azra | T-707, T-505 | view |
| T-709 | Task detail/edit/delete/status | Azra | T-708 | view |
| T-710 | Notes list + detail + pin | Azra | T-707, T-506 | view |
| T-711 | Attachments UI (same components, React) | Azra | T-708..T-710 | components |
| T-712 | States + skeleton dimension budget (CLS guard) | Azra | T-704..T-711 | state matrix complete |
| T-713 | Static-output privacy check: `out/` contains no user data | Azra | T-712 | documented grep gate |

### P8 — Integration (W8–W9)

| ID | Task | Owner | Depends on | Deliverable |
|---|---|---|---|---|
| T-801 | Compose: api + pg + astro + next + proxy, production builds only | Iqram | T-405, G6a, G6b | one-origin stack |
| T-802 | Cookie/redirect smoke across both apps under the proxy | Iqram + Hamzah | T-801 | signed-in flow works on `/` and `/b` |
| T-803 | Cross-app parity run (same dataset, same assertions) | Hamzah | T-802 | parity report |
| T-804 | Fix integration defects, triage list | all | T-803 | defects closed or accepted |
| T-805 | Documentation of run commands (README) | Iqram | T-801 | onboarding doc |

### P9 — Functional testing (W9–W10)

| T-901 | Execute the `09` test matrix; log defects with requirement IDs | Hamzah | T-803 |
| T-902 | Security test pass (auth, ownership, upload, headers) | Hamzah + Iqram | T-901 |
| T-903 | Accessibility and responsive pass | Hamzah | T-901 |
| T-904 | Regression re-run after fixes; G8 sign-off | Hamzah | T-903 |

### P10 — Performance benchmarking (W10–W11)

| T-1001 | Harness: Playwright + Lighthouse driver, run manifest, raw output | Hamzah | T-409 |
| T-1002 | Dry runs on both apps, threshold/rate-limit sanity | Hamzah | T-1001, T-801 |
| T-1003 | Cache-cold and cache-warm runs, **≥10 repetitions per scenario** and per app, first repetition discarded, raw samples archived (NFR-RESEARCH-004; this supersedes any smaller count) | Hamzah | T-1002 | raw sample files + summary |
| T-1004 | Archive raw data + summarize medians/IQR | Hamzah | T-1003 |

### P11 — Analysis & documentation (W11–W12)

| T-1101 | Results tables + charts per metric and scenario | Hamzah | T-1004 |
| T-1102 | Architecture, data, API chapters from `.planning` (rewritten for the report, not copy-pasted) | Iqram | T-1101 |
| T-1103 | Frontend implementation chapters | Erika + Azra | T-1101 |
| T-1104 | Threats to validity + limitations section | Hamzah | T-1101 |
| T-1105 | Full-document consistency review | all | T-1104 |

### P12 — Final presentation (W12)

| T-1201 | Slide deck, demo script, live fallback recording | Hamzah | T-1105 |
| T-1202 | Owner sign-off | project owner | T-1201 |

## 3. Blocking prerequisites (must clear before P4 completes)

| ID | Prerequisite | Blocks | Owner | Fallback |
|---|---|---|---|---|
| P-01 | Repair/install pnpm (corepack shim currently broken) | T-404, every workspace command | Iqram | npm workspaces (same layout) |
| P-02 | Start container runtime (Docker/colima daemon) | T-403, T-405, T-801 | Iqram | native PostgreSQL 16, documented drift |
| P-03 | PostgreSQL 16 instance + client | T-502, integration tests | Iqram | same as P-02 |
| P-04 | `git init` + remote + branch protection | T-401, review workflow | Iqram | none — hard requirement |
| P-05 | Version pinning (`.nvmrc`, `packageManager`, `engines`, lockfile) | R-18, benchmark reproducibility | Iqram | none — hard requirement |

These are the only tasks that touch the machine outside the repo. They are documented, not executed,
in Phase 1.

## 4. Critical path and parallelism

```
P1 → P2/P3 → P4 → P5 ─┬→ P8 → P9 → P10 → P11 → P12
                      ├→ P6 (Astro) ─┘
                      └→ P7 (Next)  ─┘
```

- **Critical path:** P1 → P3 → P4 → P5 → P8 → P9 → P10 → P11 → P12. Only P5 has slack because the
  frontends can start at contract freeze (G3) against the mock API (T-305).
- **Parallelizable:** P2 with P3; P6 with P7 with P5 (after G3); T-407/T-409 with P5.
- **Serial by necessity:** G3 before P6/P7 code (no invented contracts); T-801 before T-1003 (measure
  the real deployment, not three dev servers).

## 5. Milestones

| ID | Milestone | Evidence | Week |
|---|---|---|---|
| M1 | Blueprint approved | G1 in `12` §7 | W1 |
| M2 | Contract frozen | tag + green contract tests | W2 |
| M3 | Environment reproducible | clean clone → `pnpm dev` in one page | W3 |
| M4 | API feature-complete | G5 + integration suite | W6 |
| M5 | Both frontends feature-complete | G6a, G6b + parity run | W9 |
| M6 | Evidence complete | G9 raw data archived | W11 |
| M7 | Report + demo | G10, G11 | W12 |

## 6. Definition of Done (task level)

A task is done when: its deliverable exists at the named path; its requirement IDs' acceptance
criteria are demonstrably met; tests at the required level pass; both frontends are updated if the
task says "both FE"; `typecheck`/`lint`/`test` are green in CI; the PR description names the
verification commands; and `.planning/` is updated in the same PR for any shape/route/status change.

## 7. Approval gates

| Gate | Approver | Cannot be skipped because |
|---|---|---|
| G1 blueprint | project owner | Every later phase cites these documents |
| G3 contract freeze | Iqram, reviewed by Hamzah | Both frontends build on it |
| G6a/G6b feature-complete | Hamzah (parity checklist) | Divergence must be caught before integration |
| G9 benchmark complete | Hamzah | Report cannot start on partial data |
| G11 final | project owner | Deliverable acceptance |
