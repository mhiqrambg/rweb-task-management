---
document: 12-architecture-review.md
phase: 1
stage: 12
prepared_by: software-architect
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [security-review]
  changed:
    - "security-review: its research-before-flagging rule became the evidence rule in §2 — a stage is never marked PASS on belief, only on a check whose output is quoted."
---

# 12 — Architecture Review

## 1. Method

Every stage below was checked against its completion condition by opening the file on disk, not by
recalling that a specialist had been asked. Checks used: presence of required section headings;
presence of the promised content (IDs, ADR fields, endpoints, entities, threat rows, variable tables,
test levels); closure of identifier references (every `FR-`, `NFR-`, `A-`, `C-`, `Q-` id cited resolves
to a definition in `00` or `01`); absence of placeholder text; and agreement of shared tokens
(`sid`, `/api/v1`, `todo|in_progress|completed`, `low|medium|high`, `users|sessions|tasks|notes|attachments`).

Status vocabulary: **PASS** (condition met, evidence named), **OPEN** (condition not met, missing
evidence named), **PASS (architect-authored)** (specialist unavailable, analysis performed by the
architect — recorded so no one mistakes it for delegated work).

## 2. Stage ownership and completion status

| # | Stage | Owner | Inputs | Completion check | Status | Evidence |
|---|---|---|---|---|---|---|
| 1 | Discovery | software-architect | scope brief | purpose, problem, users, stakeholders, domain, boundaries, existing docs all present; no invented stakeholder | PASS | `00` §1-§13; five named stakeholders only (four team members + unnamed owner), A-01..A-10, Q-01..Q-06, C-01..C-12 |
| 2 | Requirements | project-requirements-analyst | `00` | every FR/NFR has a unique stable ID; roles+permission matrix; journeys; constraints; acceptance criteria per FR; assumptions; out-of-scope | PASS | `01` §2 matrix (26 rows), §3 89 FRs with G/W/T criteria, §4 65 NFRs, §5 J-01..J-13, §6 C-01..C-16, §7 A-11..A-21, §8 out-of-scope, §9 Q-07..Q-14, §10 traceability; ID closure verified by grep (no undefined `NFR-` family, no out-of-range `FR-`, no dangling `A-`/`C-`/`Q-`) |
| 3 | Repository assessment | software-architect | filesystem + orchestrator environment check | emptiness/partiality stated with evidence; toolchain + version findings; no overwriting of working code | PASS | `02` §1-§6; empty-tree evidence table, toolchain table (Node 24.11.1, broken pnpm shim, no local PG, Docker daemon stopped, no `.git`), prerequisites P-01..P-05 |
| 4 | System architecture | system-architecture-analyst | `00`, `01` | every component has responsibility + boundary; comms, data flow, integration, deployment; ≥4 Mermaid diagrams; both rendering paths explained distinctly | PASS | `03`: §2.1 component table with a "must NOT do" column for 11 components; §3 two rendering paths plus a 7-dimension comparison table; §4.1-§4.7 four sequence diagrams + one state diagram; §6 deployment topology; **7 Mermaid diagrams** (context, components, 4 flows, status states, deployment); §10 justification table with deferrable/rejected items; §11 six operational mechanisms with owner/trigger/concurrency/failure/phase; §12 13 objections |
| 5 | ADRs | system-architecture-analyst | `03`, `01` | each ADR has context, problem, ≥2 alternatives, decision, rationale, trade-offs, consequences; no "popularity" rationale; status field | PASS | `04`: ADR-01..ADR-15, every one with all nine fields, ≥2 alternatives (ADR-04 has 5, ADR-10 has 4), Status `Proposed`, Deciders = project owner; register with blocking relationships; no rationale rests on popularity |
| 6 | Database | database-designer | `01`, `03` | entities+attributes, PK/FK, constraints, indexes with query justification, migration strategy, ownership, tx boundaries; Mermaid ERD | PASS | `05`: 5 entities + ownership table + ERD; full column/constraint tables; 10 PK/unique + 13 secondary indexes each naming the endpoint served, plus a "not added" table; §5 cursor design with 3 SQL predicates; §6 transaction table + binary/row ordering rule; §7 lifecycle + Rule-14 mechanisms; §8 migrations; §9 deterministic dataset; §10 TS alignment + non-exposed fields; §11 open questions and objections |
| 7 | API contracts | api-designer | `01`, `05` | every endpoint: method, path, auth, authz rule, req, res, errors, validation; consistent envelope; pagination/filtering/versioning; owner-only enforcement stated; representative examples | PASS | `06`: §1.1-§1.9 conventions (strict schemas as the mass-assignment guard, status matrix, 8-code closed set, idempotency, body limits, the single not-found rule); §2.4 all 22 endpoints with auth + authorization + rate limit + idempotency; §3 nine shared schemas; §4 20-row validation table; §5 22 endpoint subsections with request/response examples and error sets; §6 cursor/offset/NULL/sort/filter + exact query grammar; §7 versioning and deprecation; §8 upload contract (two-gate validation, per-file errors, write ordering, binary headers); §9 five consistency checks; §10 15 open questions; §11 11 deviations. Edited on persistence (condensed), recorded in its provenance block |
| 8 | Security | security-auditor | `03`, `06`, `07` | authn, authz, sessions, input validation, tenant isolation, secrets, CORS, CSRF, rate limits, threat register with severity+mitigation, security tests | PASS | `07`: §1 assets + 7 trust boundaries + Mermaid boundary diagram + actors; §2 auth (Argon2id, dummy-hash on unknown email, token storage, fixation/login-CSRF analysis, never-logged list); §3 authorization (in-statement predicate, 404 indistinguishability, mass-assignment exclusion, 13-case cross-owner matrix); §4 enforcement (authoritative/advisory + per-endpoint failure modes); §5 validation/encoding/upload two-gate model; §6 CSRF/CORS/header policy; §7 secrets/dump content; §8 logging + effective rate limits; §9 **37-row threat register** with justification, enforcement point, stage and test ref; §10 six-category test plan occupying 56 of the `S-01..S-63` numbers (S-01, S-50, S-53..S-56 unused; some rows co-labelled); §11 residual gaps G-1..G-9; §12 A-26..A-29 |
| 9 | Performance | performance-analyst | `01`, `03`, `07` | workload model, objectives, bottleneck hypotheses, caching, network, scalability limits, measurement method, variables table (independent/dependent/controlled); zero invented benchmark numbers | PASS | `08`: §1 claim discipline + three traffic scopes (B/S/D, never summed); §2 workload (dataset, session, structural request mix, rate-limit budget); §3 14 objectives all "TBD by protocol" or `assumed`; §4 S1..S11 each with steps/measure/cache/reset/stop/invalidation; §5 three variables tables (IV, DV, CV×12); §6 tool matrix + capture + throttling + cache procedures; §7 repetitions, statistics, pairing, INV-01..INV-14; §8 nine falsifiable hypotheses; §9 caching and the HTML-parity deviation; §10 scalability limits; §11 seven results tables + invalidation checklist; §12 AC-B01..AC-B10; Appendix A A-30..A-46. **Zero invented measurements** |
| 10 | Testing | test-architect | `01`, `06`, `07`, `09` | unit/integration/e2e/API/security/perf levels, test data, environments, quality gates, acceptance criteria tied to requirement IDs | PASS | `09`: §1 four claims with falsifiers; §2 seven levels with "must not do" columns and the 70/20/10 accounting; §3 requirement-to-test map covering every FR family with criteria counts and every NFR family, plus the four FRs whose tests depend on a default; §4 deterministic dataset, fixture factories, two-owner isolation, hostile upload fixtures, per-run databases; §5 three environments + the 8-point parity checklist; §6 execution of the `07` §10 cases by category (ID range non-contiguous); §7 two Playwright projects, locators, screenshot pairs, three-layer copy parity; §8 CI vs campaign boundary and what CI must never do; §9 gates G0-G8 with pass conditions and waiver policy; §10 J-01..J-13 and S1-S11 smoke assertions; §11 eleven honest exclusions; §12 TQ-01..TQ-13 |
| 11 | Roadmap | software-architect | `01`, `03`, `13` | phases, milestones, workstreams, tasks, deps, deliverables, DoD; blocking prerequisites named; owner per task; critical path | PASS | `10` §1-§7 (P1..P12, T-101..T-1202, P-01..P-05, critical path, M1..M7, gates G1..G11); `11` §1-§4 (24 risks scored, owner, trigger, phase); `13` (per-member matrix, RACI, imbalance analysis) |
| 12 | Review | software-architect | all | every doc cross-checked; contradictions/missing decisions/risks/open questions recorded; stage table filled with pass/OPEN | PASS | this document: §2 rows 1-11 PASS with named evidence; §3 scope-deliverable mapping (13 requested deliverables → files, plus 18 brief sections → sections); §4 sixteen contradictions with resolutions and where each was applied; §5 six owner decisions + 15 ADRs + 14 questions awaiting approval; §6 append-only contradiction log; §7 approval gate; §8 document inventory with provenance and skills. Cross-checks run: no undefined `NFR-` family, no out-of-range `FR-`, no dangling `A-`/`C-`/`Q-` ID, no placeholder text, canonical tokens consistent (`sid`, `/api/v1`, `todo\|in_progress\|completed`, `low\|medium\|high`, `users\|sessions\|tasks\|notes\|attachments`) |

## 3. Scope-deliverable mapping

Every deliverable named in the brief maps to a file and a section. Nothing requested is dropped; nothing
is duplicated across two documents.

### 3.1 Brief §13 requested layout → canonical file

| Brief deliverable | Satisfied by | Note |
|---|---|---|
| `docs/planning/01-PROJECT-OVERVIEW.md` | `.planning/00-project-discovery.md` (purpose, problem, users, domain, boundaries) | Canonical doc set replaces `docs/planning/`; no second copy exists |
| `docs/planning/02-REQUIREMENTS-SPECIFICATION.md` | `.planning/01-requirements.md` | |
| `docs/planning/03-TEAM-RESPONSIBILITY-MATRIX.md` | `.planning/13-team-responsibility-matrix.md` | Supplement: no canonical doc owns team ownership |
| `docs/planning/04-SYSTEM-ARCHITECTURE.md` | `.planning/03-system-architecture.md` + `.planning/04-architecture-decisions.md` | ADRs are split out per the canonical set |
| `docs/planning/05-DATA-MODEL.md` | `.planning/05-database-design.md` | |
| `docs/planning/06-API-CONTRACT.md` | `.planning/06-api-contracts.md` | |
| `docs/planning/07-UI-UX-SPECIFICATION.md` | `.planning/14-ui-ux-specification.md` (+ `03` §8 interactions, `01` §5 journeys) | Supplement: UI/UX has no canonical owner |
| `docs/planning/08-REPOSITORY-STRUCTURE.md` | `.planning/03-system-architecture.md` §7 | Deliberately a section, not a 4th file — avoids two descriptions of one tree |
| `docs/planning/09-PERFORMANCE-TEST-PLAN.md` | `.planning/08-performance-strategy.md` + `.planning/09-testing-strategy.md` | Protocol and test levels are separate subjects |
| `docs/planning/10-DEVELOPMENT-ROADMAP.md` | `.planning/10-implementation-roadmap.md` | |
| `docs/planning/11-RISK-REGISTER.md` | `.planning/11-risk-register.md` | |
| `docs/planning/12-ARCHITECTURE-DECISIONS.md` | `.planning/04-architecture-decisions.md` | |
| `DEVELOPMENT-GUIDELINES.md` (root) | `DEVELOPMENT-GUIDELINES.md` | References `.planning/`; restates no contract |

### 3.2 Brief section → where each requirement is answered

| Brief section | Answered in |
|---|---|
| §1 Project overview (two approaches, shared backend) | `00` §1-§2, `03` §2-§3, `04` ADR-04/ADR-05/ADR-13 |
| §2 Objectives (1-7) | `01` §10 traceability, `08` (5,6), `10` P11 (7) |
| §3 A Landing page | `01` FR-LAND-001..006, `14` §3-§4 |
| §3 B Authentication | `01` FR-AUTH-001..014, `06` #1-4, `07` §2-§3, `03` §5 |
| §3 C Dashboard | `01` FR-DASH-001..009, `06` #7, `05` §4 |
| §3 D Task management | `01` FR-TASK-001..021, `06` #8-12, `05`, `14` §5 |
| §3 E Notes management | `01` FR-NOTE-001..013, `06` #13-17 |
| §3 F Shared UI states | `01` FR-UI-001..012, `14` §7, `09` (parity gate) |
| §4 Team structure and responsibilities | `13` §2 per-member matrix, §3 RACI, §4 early-QA obligations, §5 imbalance |
| §5.1-5.9 Architecture planning | `03` §2-§7, §11 |
| §5 rendering considerations (Astro SSR, Next SSG, dynamic ids, cookie sharing) | `03` §3, §5; `04` ADR-04, ADR-05, ADR-13 |
| §5 "decisions to finalize before development" | `04` §(register), `12` §5 |
| §6 Data model and shared contracts | `05` (entities, tables, keys, constraints, indexes), `05` §10 (TS contracts), `06` (schemas), `04` ADR-09 |
| §7 REST API planning | `06` (all endpoints, envelope, errors, validation, authz), `06` §storage options, `04` ADR-07 |
| §8 Repository and project structure | `03` §7 (tree, package manager, TS config, env vars, scripts, branching, PR workflow), `04` ADR-11, `DEVELOPMENT-GUIDELINES.md` |
| §9 Frontend consistency specification | `14` §1-§10 (tokens, layout, screens, components, states, parity checklist) |
| §10 Performance benchmark planning (metrics, scenarios, conditions, repetitions, traffic scopes, LCP/CLS/INP collection, results template) | `08` §2-§9 |
| §11 Project timeline and dependencies (12 phases, critical path, milestones, weekly schedule) | `10` §1-§7, `13` §3 |
| §12 Risks and technical decisions | `11` §1-§4, `04` ADR register |
| §13 Deliverables (layout + guidelines) | §3.1 above |
| §14 Working instructions (inspect, no installs, assumptions, cross-check) | `02` (inspection), `12` (cross-check), `00` §13 (phase boundary) |
| §15 Final response (executive summary → first milestone) | The architect's reply to the owner, plus `10` §5 (M1) |

## 4. Contradictions found and resolved

Every row was a real disagreement between a locked input, a specialist output, or two documents. The
resolution is recorded where it was applied; nothing was silently changed.

| # | Contradiction | Sources | Resolution | Applied in |
|---|---|---|---|---|
| X-01 | Locked tree named "Astro 5" and "Next.js 15"; verified versions are Astro **7.4.x**, Next **16.4.x**, Fastify **5.12.x** | locked inputs §3 vs verified facts §7 | Verified facts win; tree annotations corrected; runtime pin is Node 24.11.1 (floors: Astro ≥ 22.23.4, Next ≥ 20.9) | `02` §3/§5, `03` §7/§10, `04` ADR-10, `00` A-08 |
| X-02 | "Next.js static export has no Route Handlers" | earlier brief framing vs nextjs.org static-exports | Corrected: `GET` Route Handlers with `export const dynamic = 'force-static'` are emitted as static files; the exclusion is handlers that rely on `Request` | `03` §3.2, `04` ADR-04 |
| X-03 | "`cookies()`/`headers()` throw under export" | earlier brief framing vs docs | Corrected: they return empty values because no request exists at build time; only *Cookies* is listed as unsupported | `03` §3.2, `04` ADR-04 |
| X-04 | Middleware-based auth described as available in an export | earlier brief framing vs Next 16 rename | `middleware.ts` → `proxy.ts`; Proxy is on the unsupported list, so no proxy-based auth gating exists in the static app; the client gate is UX only | `03` §3.2/§5.3, `04` ADR-04/ADR-05 |
| X-05 | "Astro SSR ⇒ `@astrojs/node`" stated as a law | locked inputs §2 vs docs.astro.build | Reframed as a **choice** among four official adapters, justified by self-hosting one compose stack; `standalone` vs `middleware` trade-off stated | `03` §3.1, `04` ADR-13/ADR-15 |
| X-06 | Thumbnail rendition stated as "max 480 px" | locked storage note vs FR-ATT-004 (≤ 320 px) | 320 px wins; 480 marked superseded everywhere | `03` §12 O-8, `04` O-8, `05` Q9/O5, `11` R-14 |
| X-07 | Benchmark repetitions "≥5" in the roadmap vs "≥10" in NFR-RESEARCH-004 | `10` T-1003 vs `01` §4.8 | ≥10, first repetition discarded, raw samples archived; roadmap line corrected and marked as superseding | `10` T-1003, `08` |
| X-08 | `GET /tasks` filter/sort surface narrower than FR-TASK-012/013 | locked api-surface #8 vs `01` | Extended with `dueState`, `hasAttachments`, ascending sorts and a `priority` key; cursor carries the sort key | `03` §12 O-9, `05` §5.1, `06` |
| X-09 | `GET /auth/me` marked "Auth: optional" | locked api-surface #4 | Defined as public-but-session-aware: `200` or `401`, never `403` | `03` §12 O-6, `06` §2 |
| X-10 | `/health` returned `{status, db}` only, while NFR-REL-007 requires a storage readiness signal | locked api-surface #22 vs `01` | Proposed `checks: { db, storage }`; until approved the harness gates on `status` and treats storage failure as an upload-test failure (recorded as an open decision, not silently changed) | `03` §12 O-3, `06` §5 #22 |
| X-11 | Module list omitted `/dashboard` although endpoint #7 exists | locked inputs §3 vs api-surface #7 | `modules/dashboard/` added; no new endpoint or table | `03` §2.1/§7 |
| X-12 | Attachment ownership was application-enforced only | `01` NFR-SEC-005 vs `05` §3.5 | Composite FK `(task_id, user_id)` / `(note_id, user_id)` plus `UNIQUE (id, user_id)` on both parents makes a cross-tenant attachment row unrepresentable | `05` §3.5/§11.2 O1 |
| X-13 | `notes.body` had `DEFAULT ''` while FR-NOTE-001 makes body required | locked skeleton vs `01` | Default kept for skeleton fidelity but made inert by `CHECK (btrim(body) <> '')` | `05` §3.4 |
| X-14 | Key-only requirement rows (NFR/A/C/Q IDs cited before they were defined) | `01` as first persisted | NFR families, A-11..A-21, C-13..C-16, Q-07..Q-14 and journeys were completed; ID closure verified by grep | `01` §4-§11 |
| X-15 | "One origin" in production vs a dev cross-origin Next server | `03` §6.4 vs ADR-05 | Dev uses an absolute API base URL plus a single-origin CORS allowlist; production configures no CORS at all (`@fastify/cors` default `*` + `credentials:true` is rejected by browsers) | `03` §6.4, `04` O-13 |
| X-16 | `PUBLIC_` prefix on a server-only Astro variable | locked env list | Kept the name, mandated `process.env` access, recommended rename to `API_BASE_URL` | `03` §7/§12 O-11, `04` O-11 |

## 5. Decisions still needing the owner

These are not defects; they are the places where the blueprint deliberately stopped.

| ID | Decision | Why it is the owner's | Default if unanswered |
|---|---|---|---|
| O-3 | Add `checks: { db, storage }` to `GET /health` | It is a contract shape change to a locked endpoint | Harness gates on `status` only |
| O-5 | One auth probe on the Next landing page, interpreting FR-LAND-005 as "no content/data request" | It relaxes a `MUST` acceptance criterion as literally written | One probe, disclosed in `08` S1 |
| O-9 | Extended `GET /tasks` filter/sort surface | Extends the locked endpoint's query grammar | Applied in `06`; reverting would fail FR-TASK-012/013 |
| O-11 | Rename `PUBLIC_API_BASE_URL` → `API_BASE_URL` | Naming preference with a build-time footgun behind it | Keep the name, enforce `process.env` |
| O-12 | Next shell route `/b/app/` vs `/b/` | Cosmetics of nesting | Keep `/b/app/` to mirror Astro's `/app` |
| ADR-01..15 | All fifteen architectural decisions | Approval authority is the owner; status stays `Proposed` | Blocked at G1 |
| Q-01..Q-14 | Product/verification questions listed in `00` §12 and `01` §9 | They change requirements, not architecture | Each has a stated default; the defaults are what this blueprint designs for |

## 6. Contradiction log (append-only, used during Phases 2-12)

The register above is the Phase-1 record. During implementation, any fired risk (`11` §4), any deviation
from a `Proposed` ADR, and any scope change is appended here with: date, what contradicted what, who
decided, and which document was updated. An entry here without a matching document update is itself a
defect.

| Date | Item | Decision | Documents updated |
|---|---|---|---|
| 2026-11-15 | Framework/runtime versions corrected during Phase 1 | Verified facts win over the earlier brief framing | `00`, `02`, `03`, `04`, `10`, `11` (see X-01..X-05) |
| 2026-11-15 | Thumbnail size 480 → 320 px | FR-ATT-004 wins | `03`, `04`, `05`, `11` (X-06) |
| 2026-11-15 | Benchmark repetitions 5 → 10 | NFR-RESEARCH-004 wins | `10` T-1003 (X-07) |

## 7. Approval gate

| Item | State |
|---|---|
| Blueprint status | **Proposed — awaiting owner approval** |
| ADR statuses | All 15 `Proposed`; none `Accepted` |
| Requirement statuses | 89 FR + 65 NFR; every `assumed` item is labelled and paired with a question where one exists |
| Code, migrations, configuration produced in this phase | None. The only files written are `.planning/*.md` and `DEVELOPMENT-GUIDELINES.md` |
| Global/agent configuration touched | None |
| Next action | Owner approves the blueprint (G1) or returns a decision list; implementation starts only after that |

## 8. Document inventory and provenance summary

| File | Prepared by | Skills recorded as used | Size class |
|---|---|---|---|
| `00-project-discovery.md` | software-architect | backend-development, security-review | 12 KB |
| `01-requirements.md` | project-requirements-analyst (edited on persistence) | backend-development, security-review | 60 KB |
| `02-repository-assessment.md` | software-architect | backend-development | 7 KB |
| `03-system-architecture.md` | system-architecture-analyst | backend-development, security-review, diagram-design | 25 KB + |
| `04-architecture-decisions.md` | system-architecture-analyst | backend-development, security-review | 52 KB |
| `05-database-design.md` | database-designer (edited on persistence) | backend-development, security-review, diagram-design | 35 KB + |
| `06-api-contracts.md` | api-designer (edited on persistence) | backend-development, security-review | 21 KB + |
| `07-security-architecture.md` | security-auditor (edited on persistence) | backend-development, security-review | 50 KB |
| `08-performance-strategy.md` | performance-analyst (edited on persistence) | backend-development | 40 KB |
| `09-testing-strategy.md` | test-architect | tdd, backend-development | 48 KB |
| `10-implementation-roadmap.md` | software-architect | backend-development | 15 KB |
| `11-risk-register.md` | software-architect | security-review, backend-development | 11 KB |
| `12-architecture-review.md` | software-architect | security-review | this file |
| `13-team-responsibility-matrix.md` (supplement) | software-architect | backend-development | 11 KB |
| `14-ui-ux-specification.md` (supplement) | software-architect (ui-ux-analyst unavailable) | backend-development (no content change) | 13 KB |
| `DEVELOPMENT-GUIDELINES.md` (root) | software-architect | none claimed | 9 KB |

No skill is claimed that was not read in full by the agent credited with the document; `diagram-design`
was used only for Mermaid structure (no HTML/SVG output was produced). Every persisted specialist document
records `edited_on_persistence` when the architect condensed it.
