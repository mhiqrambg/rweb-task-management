---
document: 11-risk-register.md
phase: 1
stage: 11
prepared_by: software-architect
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [security-review, backend-development]
  changed:
    - "security-review: split upload risks into content-sniffing, path traversal and storage-serving risks with authoritative enforcement points rather than one generic 'upload security' line."
    - "backend-development: added D1 single-writer contention and unbounded-list risks with concrete detection signals."
---

# 11 — Risk Register

Scoring: likelihood L (1 rare … 5 near-certain) × impact I (1 cosmetic … 5 project-invalidating).
Score = L×I. Bands: **≥15 critical**, **9–14 high**, **5–8 medium**, **≤4 low**.
Owner is a named person and is accountable for the mitigation, not for the risk disappearing.
Phase references (P1..P12) are defined in `10-implementation-roadmap.md`.

## 1. Register

| ID | Risk | L | I | Score | Owner | Mitigation | Early trigger | Phase |
|---|---|---|---|---|---|---|---|---|
| R-01 | **Feature divergence** — the two apps drift in features, wording, or behaviour; the comparison becomes apples-to-oranges and grading fails on brief §2.2 | 4 | 5 | **20** | Hamzah + Azra | Single UI spec (`14`), shared copy strings, parity checklist per screen, PR rule "feature lands as a pair", Erika's parity run in P8 | A screenshot pair shows different text or missing control | P2, P6–P8 |
| R-02 | **Contract drift** — a frontend redefines an entity or validation rule locally | 3 | 5 | **15** | Iqram | `packages/contracts` is the only declaration site; review rejects any duplicate type; contract tests in CI | A grep finds `interface Task` outside `packages/contracts` | P3–P8 |
| R-03 | **Auth broken across origins** — cookie not sent, `SameSite` blocks it, CORS credentials misconfigured, redirect loop | 3 | 5 | **15** | Iqram | One-origin reverse proxy in prod and dev proxy for `/api`; cookie `Path=/`, `SameSite=Lax`; `GET /auth/me` as the single truth probe; a manual cookie smoke test in P4 and P8 | Login succeeds but the next page shows the login screen; `Set-Cookie` absent in devtools | P4, P8 |
| R-04 | **SSG limits mishandled** — someone adds middleware/route handlers/SSR to Next, or bakes user data into static HTML, or tries `/tasks/[id]` | 3 | 5 | **15** | Azra | ADR-04 binding; single-shell + query-param routing; build check greps `out/` for a seeded email and fails; escalation instead of improvisation | `next.config` gains anything beyond `output:'export'`; `out/` contains a user email | P7–P8 |
| R-05 | **Astro SSR deployment misconfiguration** — adapter missing, `output` left at static, runtime env baked at build, proxy strips the cookie | 3 | 4 | 12 | Hamzah | `output:'server'` + `@astrojs/node` standalone pinned in the config committed in P6; API base URL from runtime env; container smoke test in P8 | Pages render but authenticated data is empty; 502 behind proxy | P6, P8 |
| R-06 | **Upload security** — MIME spoofing/polyglot, path traversal via filename, oversize DoS, public access to the R2 bucket, foreign-owner download | 3 | 5 | **15** | Iqram | Server-generated storage key, content sniffing via `file-type`, size check before the R2 `put`, the Worker-only bucket has no public R2 access, ownership check in the same query as the content read, `Content-Disposition: inline` + `X-Content-Type-Options: nosniff` | Any request that resolves a path from user input; a `.php`/`.html` file accepted | P5 |
| R-07 | **Benchmark not fair** — dev servers, warm caches mixed with cold, different viewports/browsers/datasets, network idle mis-detected, runs from a loaded machine | 4 | 5 | **20** | Erika | Written protocol (`08`): production builds, pinned browser, one viewport, cache-cold/warm separated, dataset ID, ≥5 repetitions, run manifest per run, raw files retained | A results table missing a run ID or a commit SHA | P9–P10 |
| R-08 | **Backend bottleneck skews the comparison** — N+1 queries, unbounded list responses, synchronous image processing blocking the request path | 3 | 4 | 12 | Iqram | Keyset pagination everywhere, indexes justified per query in `05`, one round-trip per list with attachment aggregation, `@jsquash` transform bounded by the Workers CPU cap with concurrency bounded explicitly (no unbounded inline fan-out) | p95 list latency rises with dataset size; CPU-limit warnings in the Worker log | P5, P10 |
| R-09 | **Workload imbalance / single point of failure** — Iqram owns contracts + API + infra; his absence stalls both frontends | 4 | 4 | **16** | Project owner | Contract frozen end of P3 and mocked for frontends; infra timeboxed; Erika reviews contract PRs; `13` §5 documents the imbalance | A frontend PR blocked > 1 day on an unpublished contract change | P3–P8 |
| R-10 | **Toolchain broken at start** — `pnpm` is a broken corepack shim on the dev machine | 5 | 2 | 10 | Iqram | P-01 prerequisite; one documented command to fix; npm workspaces fallback keeps the layout identical | `pnpm -v` throws `Cannot find module` | P4 |
| R-11 | **No database / Wrangler auth expired** — D1 unreachable or the Wrangler session lapsed; environment parity lost | 4 | 3 | 12 | Iqram | P-02/P-03 prerequisites; the D1 binding is pinned in `wrangler.jsonc` with one documented database name/ID; parity checklist in P4 | `wrangler d1 execute` fails; auth-expired prompt | P4, P8 |
| R-12 | **Session edge cases** — expiry mid-form, redirect loops, `/login?next=` open redirect, stale UI after logout | 3 | 3 | 9 | Iqram + both FE owners | Explicit session lifecycle in `07`, `401` interceptor behaviour in `14` §6, `next` restricted to same-origin app paths | Login page ↔ app redirect loop | P5–P8 |
| R-13 | **CLS from the Next.js auth skeleton** — shell renders, then content replaces it; layout shifts | 4 | 3 | 12 | Azra | Skeletons with fixed dimensions (`14` C-17), reserved thumbnail aspect ratios, no late font swap (system stack), measured as scenario S3 | CLS > 0.1 in the S3 run | P7, P10 |
| R-14 | **Attachment payload noise** — huge or varying images dominate the payload metric | 3 | 3 | 9 | Erika | Fixed dataset (A-04): per attachment ≤ 1 MB, identical files, identical counts; thumbnails bounded at ≤ 320 px long edge (FR-ATT-004); payload reported split into document / JS / CSS / image | Payload varies > 10 % between repetitions | P10 |
| R-15 | **Scope creep** — features neither app needs appear mid-phase (tags, sharing, dark mode, i18n) | 4 | 3 | 12 | Project owner | Out-of-scope list in `01` §8; any addition requires an ADR and a matching pair of implementations | A PR adds a field with no requirement ID | P2–P8 |
| R-16 | **Data loss / unusable dataset** — seed script overwrites the benchmark corpus, or the R2 bucket is wiped | 2 | 4 | 8 | Iqram | Dataset generated by a versioned script with an ID; D1 Time Travel + R2 versioning enabled; regeneration is deterministic | Seed run changes row counts mid-benchmark | P4, P10 |
| R-17 | **Accessibility regressions** — missing labels, focus traps, contrast failures | 3 | 2 | 6 | Erika | `14` §8 baseline; axe checks in the e2e suite; keyboard-only pass per screen | axe reports serious violations | P9 |
| R-18 | **Dependency/supply-chain drift** — floating versions break reproducibility | 3 | 3 | 9 | Iqram | Committed lockfile, `engines`, `.nvmrc`, Playwright version pinned, renovate/manual upgrade only between benchmark rounds | `node_modules` differs across machines | P4 |
| R-19 | **Analytical misinterpretation** — browser payload reported as total infrastructure traffic; lab LCP presented as user experience | 4 | 4 | **16** | Erika | `08` §7 defines the four traffic scopes separately and requires each claim to name its scope; report template forces a "scope" column | A slide says "total network traffic" with a DevTools number | P11 |
| R-20 | **Schedule compression** — P10/P11 crushed near the deadline; benchmarking rushed | 4 | 4 | **16** | Project owner | Harness scaffolded in P2, dataset script in P4, dry runs in P8, benchmark rounds scheduled before the report window | P9 finishes later than planned with no free slot for P10 | P1, P10 |
| R-21 | **Migration drift** — schema diverges between machines; "works on mine" | 3 | 3 | 9 | Iqram | `wrangler d1 migrations apply` in CI, forward-only numbered migrations, no manual `ALTER` on a shared database | A column exists in one environment but not another | P4–P8 |
| R-22 | **Rate limiting distorts benchmark** — 429s during a scripted run | 2 | 4 | 8 | Iqram + Erika | Limits documented in `06`; harness uses one user per scenario run and stays below thresholds; a 429 in a run invalidates that run and is reported | Any 429 in a run log | P10 |
| R-23 | **Orphaned R2 objects** — rows deleted, bucket objects left; storage growth during long benchmark rounds | 3 | 2 | 6 | Iqram | Delete order (row first, then R2 `delete`) documented; a Cron Trigger sweep listed as an operational task; bucket size monitored during P10 | Bucket object count grows while row count falls | P5, P10 |
| R-24 | **Path-prefix breakage for the second app** — absolute asset paths, `_next/` under `/b`, client router base mismatch | 3 | 3 | 9 | Iqram + Azra | `basePath` set and smoke-tested in P8; both apps verified from a cold browser with no cache | 404s on `/_next/static/*` or blank page at `/b` | P7–P8 |

## 2. Critical and high risks, ranked

| Rank | Risk | Score | Why it is ranked here |
|---|---|---|---|
| 1 | R-01 feature divergence | 20 | Destroys the premise of the project; caught only by discipline |
| 2 | R-07 unfair benchmark | 20 | Produces a confident, wrong conclusion |
| 3 | R-09 single point of failure | 16 | Structural; one person's absence stalls two streams |
| 4 | R-19 misinterpretation | 16 | The report can be technically correct and analytically wrong |
| 5 | R-20 schedule compression | 16 | The last two phases are the ones being graded |
| 6 | R-02 contract drift | 15 | Silent divergence between apps and API |
| 7 | R-03 auth/origin failure | 15 | Blocks both apps at once |
| 8 | R-04 SSG limits mishandled | 15 | Invalidates the comparison by accident |
| 9 | R-06 upload security | 15 | Highest-severity security exposure in the system |
| 10 | R-08 backend bottleneck | 12 | Confounds every measured scenario |

## 3. Watch list (not scored as risks)

| Item | Why not a risk | Action |
|---|---|---|
| Node version spread (26 LTS current; machine has 24.11.1) | Both satisfy the framework floors (Astro 7 ≥ 22.23.4, Next 16 ≥ 20.9) and only one machine is used | `.nvmrc` pins 24; `engines.node` states the floor, not a ceiling |
| No password reset | Explicitly out of scope (A-06, Q-04) | Documented; not a defect |
| No dark mode | Not in the brief | Explicitly excluded from `14` |
| D1 single-writer ceiling during the benchmark | The campaign is single-client and read-mostly; D1's single-writer serialisation is not exercised at benchmark scale | Monitor D1 write latency in the query metrics during P10; escalate to an ADR only if a measured write path degrades |

## 4. Risk review cadence

- Reviewed at the start of every phase (P2..P12) in the team standup: each owner states the score
  change and whether a trigger fired.
- A risk that fires is recorded in `12-architecture-review.md` §6 (contradiction log) with its cause and
  the decision taken.
- New risks get the next free ID; IDs are never reused.
