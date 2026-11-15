---
document: 08-performance-strategy.md
phase: 1
stage: 9
prepared_by: performance-analyst
reviewed_by: software-architect
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, tdd]
  used: [backend-development]
  changed:
    - "backend-development: shaped the measurement-split discipline (server-timing + Worker timing + D1 query metrics) and the Worker cold-start caveat for DB-facing latency."
edited_on_persistence: "Condensed from the specialist's 1175-line output. Claim discipline, the three traffic scopes, dataset/session model, objectives, all eleven scenarios, the three variables tables, measurement method, statistics rules, hypotheses, caching, scalability limits, results template and acceptance criteria are preserved; per-scenario prose was tightened into tables. Protocol assumptions renumbered A-30..A-46 exactly as the specialist defined them."
---

# 08 — Performance Strategy and Benchmark Protocol

This is what Erika executes. It derives the workload from `05` §9, the objectives from `01` §4.1/§4.7/§4.8
and the mechanisms from `03` §3-§6. It defines no test levels (that is `09`) and contains **no measurement
of its own**. Protocol assumptions `A-30`..`A-46` are defined in Appendix A and are distinct from
`01` §7 `A-01`..`A-21`.

## 1. Research question and claim discipline

### 1.1 The question

For the same feature set, API, database and dataset, how do the two rendering paths differ — in what the
browser must download and execute, in where the work happens, and in what the user waits for — when a
member loads and operates the application? The measured variable is the rendering path (ADR-04, ADR-13).
The instrumentation is not the subject of the study.

### 1.2 What may be claimed

| May be claimed | Precondition | Shape |
|---|---|---|
| A difference in a metric between apps, for one scenario, cache state and condition set | Both build ids match; ≥10 admitted repetitions each | "S4 cold: median LCP lower for app A than B (n=10 each, IQRs disjoint)." |
| A difference attributable to a named mechanism | That mechanism's own measurement moves the same way (`render_ms`, `upstream_ms`, JS parse bytes, request count) | "The S3 gap co-moves with the two-request bootstrap (request-count table)." |
| An inequality in payload composition | Per-class bytes reported, cache state named | "Astro's S4 document carried the 20 rows; Next's JSON did, and its shell HTML was constant." |
| A stability statement | Repetition count, IQR, outliers shown | "`GET /tasks` latency was stable across the campaign (n=110)." |

### 1.3 What may not be claimed

| Forbidden | Why |
|---|---|
| "SSR is faster/slower than SSG" as a law | One implementation of each, one dataset, one pinned Cloudflare runtime/region, one browser (§10) |
| Anything about real users | Scripted, single-user, no RUM (NFR-RESEARCH-006) |
| A lab Lighthouse LCP presented as user experience | §1.5 |
| Any summed "total network traffic" figure | §1.4, NFR-RESEARCH-007 |
| An INP derived from Lighthouse, TBT or "responsiveness" audits | NFR-RESEARCH-008, §6.4 |
| Throughput, capacity or concurrency claims | Zero concurrent clients by design |
| A framework-version claim | The bundle is this app's bundle, built with this configuration |
| A cell with <10 admitted repetitions or mismatched build ids | §7, NFR-RESEARCH-004/009 |
| Statistical significance | No hypothesis test is performed; medians, IQRs and sign consistency only |

### 1.4 The three traffic scopes — never summed

Every traffic statement carries its scope in the same table cell. The scopes are different links, paid by
different parties, in different units.

| Scope | Name | Contains | Observed via | Exists for |
|---|---|---|---|---|
| **B** | Browser payload | Every byte the browser requests and receives for one scenario: document, CSS, JS (transferred and parsed), images, fonts, XHR/fetch JSON | CDP `Network.*`, cross-checked with `PerformanceResourceTiming` | Both apps |
| **S** | Server↔server | `web-astro` SSR → Worker over the Cloudflare internal route (per document: session probe + page data) | `Server-Timing` (`upstream`, per call) + Worker request log by request id | Astro only — the static Next app has no server hop |
| **D** | DB-facing | Statements, rows read, statement duration | D1 query metrics / Cloudflare Analytics around the repetition window + Worker `Server-Timing: db` | Both apps |

Rules: a JSON response counts in **B** when the browser fetched it (Next) and in **S** when the Astro
server fetched it — the same nominal payload therefore appears in different scopes per app, and a report
that puts both in one column is invalid. Scope **D** is never expressed in bytes (rows read are query work, not
wire). **No total-application-transfer figure is produced.**

### 1.5 Why a lab LCP is not a user-experience claim

Lighthouse loads one URL once, in one browser, with a *modelled* network and CPU profile, from a cold
cache, with no interaction, in a container whose only client is the harness. It cannot see a session, a
second navigation, a client-side transition after hydration, or an input. It is a reproducible *lab*
statistic and is reported as `lcp_lab_ms` in a separate table (§11.7), never merged with field values.

### 1.6 Numbers in this document

No number here is a measurement. Every quantitative value is a requirement target (traceable to `01`), an
assumption (`A-xx`), a protocol constant (repetition count, viewport, quiet window), or `TBD by
measurement protocol`. A number that is none of those is a defect.

## 2. Workload model

### 2.1 Dataset (`05` §9, A-04)

| Property | Value | Source |
|---|---|---|
| Users | 2 (`u01@bench.invalid` benchmark account, `u02` isolation account) | `05` §9.1 |
| Per user | 50 tasks, 50 notes, 3 attachments | A-04 |
| Task distribution | 20 `todo`, 15 `in_progress`, 15 `completed`; 17 `low`, 17 `medium`, 16 `high`; 15 undated, 15 overdue-window, 10 near-future, 10 far-future | `05` §9.1 |
| Notes | 5 pinned, 45 unpinned; bodies 200-2 000 chars | `05` §9.1 |
| Determinism | PRNG seed + `uuidv5` ids + anchor-date timestamps; `checksums.total` in the manifest | `05` §9.2-§9.4 |
| Anchor window | runs within 30 days of the anchor classify overdue identically; beyond it the campaign re-seeds | `05` §9.3 |
| Page size | 20 (the contract default) | A-18 |

### 2.2 What a "session" is for a run

One run = one measured repetition of one scenario, in one app, in one cache state. Each run gets a fresh
browser context (no shared cookies, no shared cache), logs in through the real flow (S2's steps are reused
as setup, but setup time is excluded from the measurement), navigates to the scenario's start URL, and
records the manifest before measuring.

### 2.3 Request mix — structural expectation

Counts are *structural* (what each architecture must issue), not performance expectations. The harness
records the actual mix; a divergence other than a cache effect is a defect to explain, not a result.

| Scenario | Astro (browser-visible) | Astro (server→API) | Next (browser-visible) |
|---|---|---|---|
| S1 landing | document + CSS + assets + inline JS | 0 | document + CSS + JS bundle + 1 `GET /auth/me` probe |
| S3 dashboard | document (+ CSS/images) | `/auth/me` + `/dashboard` | shell + bundle + `/auth/me` + `/dashboard` |
| S4 task list | document + 3 thumbnails × N | `/auth/me` + `/tasks` | shell + bundle + `/auth/me` + `/tasks` + thumbnails |
| S6 task detail | document + thumbnails | `/auth/me` + `/tasks/:id` | shell + bundle + `/auth/me` + `/tasks/:id` |
| S10 upload+preview | document reload + thumb | `/attachments` (+ `/auth/me`) + full image | `/attachments` + full image (no reload) |

### 2.4 Rate-limit budget (R-22)

Auth mutations 10/min/IP, uploads 20/min/user, other authed 300/min/user, `/health` exempt. The harness is
a single client and can trip the first two, so: each repetition logs in at most twice, an S10 repetition
uploads at most 3 files, and a `429` in a run invalidates that run (§7.5) rather than being retried
invisibly.

## 3. Objectives

`TBD by protocol` means the metric and its computation are defined here but the number is a measured
result. `assumed, unvalidated` marks a ceiling inherited from `01`.

| ID | Metric | Definition | Objective | Status |
|---|---|---|---|---|
| O-1 | `lcp_ms` | field LCP from the in-page `web-vitals` observer, per navigation | TBD by protocol; ceiling 2 500 ms assumed | NFR-PERF-001 |
| O-2 | `lcp_lab_ms` | Lighthouse LCP, median of 4 reported runs (A-41) | TBD by protocol | NFR-PERF-001 |
| O-3 | `cls` / `cls_lab` | layout-shift score over the scenario window | TBD; ceiling 0.1 assumed. Structural sub-target: 0.00 contribution from thumbnails, skeletons and toasts | NFR-PERF-002 |
| O-4 | `inp_ms` | INP for the single scripted interaction in S7-S11 (A-44) | TBD; ceiling 200 ms assumed | NFR-PERF-003 |
| O-5 | `inp_availability` | whether the scenario produced at least one qualifying interaction | must be `available` for S7-S11, else the cell is `n/a` with the reason | NFR-PERF-003 |
| O-6 | `payload_bytes{class}` | transferred and decoded bytes per class (document, css, js, image, font, xhr) | Reported, never targeted — the explanatory variable | NFR-PERF-004 |
| O-7 | `js_parsed_bytes` | decoded JS bytes executed | Reported | NFR-PERF-004 |
| O-8 | `requests{class}` | request count per class | Reported; divergences explained structurally | NFR-PERF-004 |
| O-9 | `ttfb_doc_ms`, `ttfb_api_ms` | first byte of document / of the API response | Reported | NFR-PERF-008 |
| O-10 | `render_ms` (Astro) | server render duration from `Server-Timing` | Reported; the attribution variable for scope S | NFR-PERF-008 |
| O-11 | `upstream_ms` (Astro) | sum of Astro→API calls per document | Reported | NFR-PERF-008 |
| O-12 | `db_ms`, statements/rows read | scope D per operation | Reported | NFR-PERF-010 |
| O-13 | `tbt_lab_ms` | total blocking time, lab only | Reported as lab, never as INP | NFR-PERF-003 |
| O-14 | Zero-variance invariants | no third-party request; no dev overlay; no source map; no `429`; no `5xx`; dataset checksum stable | **MUST be zero** in every admitted repetition | NFR-OBS-004/005, NFR-RESEARCH-002 |

## 4. Scenarios S1-S11

### 4.0 Common definitions

| Term | Definition |
|---|---|
| `SETTLE()` | 500 ms network-quiet **and** 500 ms layout-shift-quiet, capped at 10 s (A-35, A-36) |
| `IMAGES_READY()` | every in-viewport `img` satisfies `complete ∧ naturalWidth > 0` (A-37) |
| Cold | fresh browser context, cache disabled at the CDP level, service workers blocked |
| Warm | fresh context, cache enabled, one untimed priming navigation of the same URL, then a new document navigation |
| Reset | dataset reset per `05` §7.5 M4 before every repetition of a mutating scenario |
| Invalid if | any §7.5 predicate fires |

### S1 — Landing page initial load

| Field | Value |
|---|---|
| Purpose | The only scenario where both apps serve a public page with no session |
| Steps | new context → navigate `/` (Astro) or `/b/` (Next) → `SETTLE()` → `IMAGES_READY()` |
| Measured | `lcp_ms`, `cls`, `payload_bytes{class}`, `requests{class}`, `ttfb_doc_ms` |
| Cache | cold and warm |
| Reset | none |
| Stop | `SETTLE()` or the cap |
| Invalidate | API coverage > the declared expectation (§4.0 note), any third-party origin |
| **Disclosure** | Astro's landing is server-rendered by requirement (ADR-13: FR-LAND-003 needs the cookie); Next's is a static file plus exactly one `GET /auth/me` probe (O-5). S1 therefore compares a render against a file, and that asymmetry belongs to the requirements, not to the frameworks. This must be stated in the report beside the S1 table |

### S2 — Login

| Field | Value |
|---|---|
| Purpose | Cost of the auth page plus the login round trip |
| Steps | fresh context → navigate `/login` (`/b/login`) → `SETTLE()` → measure page load → then submit credentials → wait for the destination's first contentful paint |
| Measured | page-load `lcp_ms`/`cls`/payload; then `login_submit_ms` (submit → destination content visible) |
| Cache | cold (the login page), destination cold |
| Reset | none; uses the benchmark account |
| Stop | destination rendered, or 10 s |
| Invalidate | `429` on the login call; `409` (already authenticated — context was not fresh) |

### S3 — Dashboard initial load

| Field | Value |
|---|---|
| Purpose | The heaviest authenticated first paint: 7 counters + 2 lists + thumbnails |
| Steps | authenticated context → navigate `/app` (`/b/app/?view=dashboard`) → `SETTLE()` → `IMAGES_READY()` |
| Measured | `lcp_ms`, `cls`, `payload_bytes{class}`, `requests{class}`, scope S (`render_ms`, `upstream_ms`), scope D (`/dashboard` statement) |
| Cache | cold and warm |
| Reset | none (read-only) |
| Stop | `SETTLE()` or the cap |
| Invalidate | any `5xx`; cold/warm mixed within a cell |
| Note | This is where the Next skeleton's dimension stability is tested: the skeleton is on screen for an extra round trip, so any mismatch shows as `cls` (R-13) |

### S4 — Task list

| Field | Value |
|---|---|
| Purpose | 20 rows, badges, thumbnail strips, default sort |
| Steps | authenticated → navigate `/tasks` (`?view=tasks`) → `SETTLE()` → `IMAGES_READY()` |
| Measured | as S3, plus per-class image bytes (thumbnails must be ≤320 px renditions, FR-ATT-004) |
| Cache | cold and warm |
| Reset | none |
| Invalidate | a full-resolution image requested in a list view (contract violation, not a result) |

### S5 — Notes list

As S4 for `/notes` (`?view=notes`); pinned block present (5 notes), so ordering differs but cost class does
not. Same measurement set.

### S6 — Task detail (deep link)

| Field | Value |
|---|---|
| Purpose | The deep-link cost difference: per-request resolution (Astro) vs shell + client fetch (Next) |
| Steps | authenticated → navigate directly to the detail URL (task 1, which has one attachment) → `SETTLE()` → `IMAGES_READY()` |
| Measured | as S3; additionally record whether any *list* document was loaded first (it must not be) |
| Cache | cold and warm |
| Reset | none |
| Invalidate | navigating via the list (that would measure S4+S11 instead) |

### S7 — Create task (interaction)

| Field | Value |
|---|---|
| Purpose | INP of a write interaction plus the resulting navigation/refresh |
| Steps | authenticated → open the create form (modal on the list page) → fill title/description/priority → click save once → wait for the success affordance and the detail view (Astro) or the updated view (Next) |
| Measured | `inp_ms` (the single click, A-44), `create_total_ms`, payload of the write |
| Cache | warm after the setup navigation |
| Reset | **yes** — delete the created task before the next repetition (dataset checksum must return to baseline) |
| Stop | success affordance visible |
| Invalidate | double write (two rows created), checksum drift |

### S8 — Update task status (interaction)

| Field | Value |
|---|---|
| Purpose | INP of an inline interaction, and what an MPA does about it |
| Steps | authenticated → task list → click the status control on row 1 → `todo` → `completed` → wait for the row's new treatment |
| Measured | `inp_ms`, `update_total_ms`, whether a document reload occurred (recorded, not judged) |
| Cache | warm |
| Reset | **yes** — revert the status |
| Invalidate | status not persisted on reload; checksum drift |

### S9 — Note create and edit

| Field | Value |
|---|---|
| Purpose | Note write path, reported as two rows (`S9.create`, `S9.edit`) |
| Steps | S9.create: open new-note form → title + 500-char body → save → wait for the list to show it. S9.edit: open that note → append text → save → wait for the detail to update |
| Measured | `inp_ms` per sub-step, `create_total_ms`/`edit_total_ms` |
| Cache | warm |
| Reset | **yes** — delete the note and the edit |
| Invalidate | body lost, checksum drift |

### S10 — Upload and preview

| Field | Value |
|---|---|
| Purpose | Multipart upload, thumbnail appearance, and the lightbox's full-image fetch |
| Steps | authenticated → open a task with no attachments → attach one fixture image (≤1 MB) → wait for the thumbnail → activate it → wait for the lightbox image → close |
| Measured | `inp_ms` (the activate), `upload_ms` (submit → thumbnail visible), `preview_ms` (activate → full image visible), payload of both binaries |
| Cache | warm for the page, **cold for the binary** (each repetition requests the image fresh) |
| Reset | **yes** — delete the uploaded attachment |
| Invalidate | `413`/`415`/`429`; attachment count drift; a full image requested where the thumbnail was expected |

### S11 — Navigation between pages

| Field | Value |
|---|---|
| Purpose | The cost of moving between two authenticated views — the clearest structural difference |
| Steps | authenticated → task list → navigate to notes → navigate back to tasks (two transitions, reported per transition) |
| Measured | `nav_ms` (click → destination content visible), `inp_ms` per click, payload per transition, whether a new document was fetched (recorded per transition) |
| Cache | warm |
| Reset | none |
| Invalidate | a full reload inserted by the harness between transitions |

## 5. Controlled conditions and the variables table

### 5.1 Independent variables

| ID | Variable | Levels |
|---|---|---|
| IV-1 | Rendering path | Astro on-demand SSR/MPA vs Next static export/SPA |
| IV-2 | Scenario | S1..S11 |
| IV-3 | Cache state | cold / warm |
| IV-4 | Throttle profile | `P0` none (main campaign), `P1` 40 ms latency / 10 Mbit/s down / 5 Mbit/s up / 0 % loss (secondary set) |

### 5.2 Dependent variables

`lcp_ms`, `lcp_lab_ms`, `cls`, `cls_lab`, `inp_ms`, `inp_availability`, `tbt_lab_ms`,
`payload_bytes{class}` (transfer + decoded), `js_parsed_bytes`, `requests{class}`, `ttfb_doc_ms`,
`ttfb_api_ms`, `render_ms`, `upstream_ms`, `db_ms`, `statements`, `rows_read`, `worker_cold_start_ms`,
`login_submit_ms`, `create_total_ms`, `update_total_ms`, `upload_ms`, `preview_ms`, `nav_ms`.

### 5.3 Controlled variables

Every row is recorded in the run manifest per repetition; any difference within a pair invalidates the pair
(NFR-RESEARCH-003).

| # | Variable | Value |
|---|---|---|
| CV-1 | Browser | Playwright-pinned Chromium, exact version recorded; headed on a virtual display, `--disable-gpu` (A-33) |
| CV-2 | Cloudflare runtime / region | same pinned Workers runtime and deployment region for each paired run; platform-load variation is an accepted limitation |
| CV-3 | Viewport | 1440 × 900, DSF 1, `reducedMotion: reduce`, `colorScheme: light`, `en-US`, `UTC` (A-34, A-39) |
| CV-4 | Throttle | `P0` for the main set; `P1` for the secondary set, applied identically to both apps |
| CV-5 | Backend | same Worker version, same D1 database, same R2 bucket, same session TTL config |
| CV-6 | Dataset | same `dataset_id` + `checksums.total`, rebuilt from the manifest |
| CV-7 | Builds | production builds of both member frontends and the API; `NODE_ENV=production`; source maps off. `apps/admin` is not a measured target |
| CV-8 | Build ids | `astro_build_id`, `next_build_id`, `api_build_id` recorded; a pair requires all three to match |
| CV-9 | Cache policy | `no-store` on both apps' HTML (parity, §9.3); binary `private, max-age=86400` |
| CV-10 | Session | fresh context per run; the same benchmark account; login excluded from scenario timing |
| CV-11 | Idle peer | the other app is never under load during a run |
| CV-12 | Harness flags | fixed launch-flag set, recorded by hash (A-38) |
| CV-13 | Worker cold-start | every admitted repetition runs on an already-warm Worker isolate; a cold-start repetition is disclosed separately and never mixed into a warm cell |

## 6. Measurement method

### 6.1 Tool matrix

| Metric | Lab (Lighthouse) | Field (Playwright + in-page observers) | Reported as |
|---|---|---|---|
| LCP | `lcp_lab_ms` | `web-vitals` `onLCP` in the injected buffer | `lcp_ms` (field), `lcp_lab_ms` (lab, separate table) |
| CLS | `cls_lab` | `onCLS` over the scenario window | `cls`, `cls_lab` |
| INP | **not measurable** → `tbt_lab_ms` only | `onINP` for the single scripted interaction | `inp_ms`; lab is never a substitute |
| Payload | total bytes | CDP per-class transfer + decoded | `payload_bytes{class}` |
| Server render | — | `Server-Timing` on the document (Astro) | `render_ms`, `upstream_ms` |
| DB | — | D1 query metrics / Cloudflare Analytics + Worker `Server-Timing: db` | statements/rows read/`db_ms` |

### 6.2 The in-page vitals buffer

Injected via `context.addInitScript` before any navigation, **identical bytes in both apps**. It registers
`web-vitals` observers, buffers entries in `window.__vitals`, issues no network request (NFR-OBS-004
preserved), and is recorded in the manifest by hash. The harness reads the buffer after `SETTLE()`.

### 6.3 Field LCP / CLS / INP, consistently

| Metric | Consistency rules |
|---|---|
| LCP | measured per document navigation; a client-side transition does **not** produce a new LCP, which is why S11 reports `nav_ms` and not LCP for the second view |
| CLS | window starts at navigation and ends at `SETTLE()`; sessions with recent input are excluded per the metric definition, so no interaction runs inside a CLS window |
| INP | exactly one qualifying interaction per interaction scenario (A-44); the reported value is that interaction's latency |

### 6.4 Why INP cannot be inferred from lab

Lighthouse loads a page and never interacts. It reports **TBT**, the sum of long-task portions after FCP —
main-thread blocking *during load*. INP contains input delay, processing time and presentation delay for a
real interaction, and a client transition in an SPA never appears in a lab load at all. Reporting TBT as
INP would be a category error, so the lab table carries `tbt_lab_ms` and nothing else.

### 6.5 Throttling, and its limits

| Condition | Mechanism | What it is | What it is not |
|---|---|---|---|
| `P0` (main) | none | Loopback transport cost removed so the rendering/JS/DB differences are visible (A-30) | Not a network claim |
| `P1` (secondary) | CDP `Network.emulateNetworkConditions` | A fixed, identical transfer cost on both apps (A-31) | Not a device-class model; absolute milliseconds are profile-specific |

### 6.6 Payload capture per class

Primary source: CDP enabled before the first request. Classes: `document`, `css`, `js`, `image`, `font`,
`xhr`. For each: request count, transfer bytes, decoded bytes, and (for JS) decoded bytes executed.
Cross-checked against `PerformanceResourceTiming`; a mismatch > 1 % is logged as a capture defect, not
silently averaged.

### 6.7 Separating server and DB traffic

| Scope | Capture | Reported | Limit |
|---|---|---|---|
| S | Astro `Server-Timing` entries + API request-id-matched log lines | calls per document, `upstream_ms`, per-call ms | Astro only; Next has no server hop |
| D | D1 query metrics / Cloudflare Analytics window around the repetition | statements, rows read, `db_ms` per operation | Deltas include the harness's own login and setup; the manifest records the excluded operations |

### 6.8 Cache procedures

| State | Procedure | Assertion it worked |
|---|---|---|
| Cold | fresh context, CDP cache disabled, service workers blocked | `cache_hits = 0` in the resource timing entries |
| Warm | fresh context, cache enabled, one untimed priming navigation, then a new document navigation | `cache_hits > 0` on at least the immutable JS/CSS assets |

## 7. Repetitions and statistics

### 7.1 Counts

| Rule | Value | Source |
|---|---|---|
| Repetitions per cell | 11 executed, first discarded → 10 admitted | NFR-RESEARCH-004, A-40 |
| Lab runs per page/app | 5 executed, median of 4 reported | A-41 |
| Cells per campaign | 11 scenarios × 2 apps × 2 cache states = 44 (×2 for the `P1` secondary set) | — |

### 7.2 Summary statistics per cell

| Statistic | Definition | When reported |
|---|---|---|
| Median | 50th percentile of admitted samples | Always |
| IQR | Q1-Q3 | Always |
| p95 | 95th percentile | For latency metrics where tail behaviour matters (`ttfb_*`, `nav_ms`, `db_ms`) |
| Outlier flag | Tukey fence 1.5 × IQR (A-43) | Per sample; flagged samples are excluded from the median and counted |
| n (admitted / invalid) | counts | Always |

### 7.3 Pairing and comparability

A pair is (scenario, cache state, condition set) → (Astro cell, Next cell). It is comparable only if **all**
of `astro_build_id`, `next_build_id`, `api_build_id`, `dataset_id`, `checksums.total`, `browser_version`,
`throttle_profile`, `viewport`, `host_load_band` match. Any mismatch means the pair is not reported.

### 7.4 Comparison rules (no significance claims)

1. Primary statement is the two medians with their IQRs.
2. A direction claim requires **either** disjoint IQRs **or** the same sign of `Astro − Next` in at least 9
   of 10 admitted pairs.
3. No p-values, no "significant".
4. If neither condition holds, the cell is reported as "no consistent difference under these conditions".

### 7.5 An invalid repetition

Retained in the raw archive, excluded from the admitted set, with a machine-checkable reason code:

| Code | Predicate |
|---|---|
| `INV-01` | any `5xx` during the scenario |
| `INV-02` | any `429` |
| `INV-03` | dataset checksum ≠ campaign baseline after reset |
| `INV-04` | build id mismatch within the pair |
| `INV-05` | any third-party origin request |
| `INV-06` | dev overlay, source map, or `NODE_ENV=development` observed |
| `INV-07` | `SETTLE()` hit the 10 s cap |
| `INV-08` | host load outside the fixed band |
| `INV-09` | browser version or launch-flag hash differs from the campaign record |
| `INV-10` | cache assertion failed (cold had cache hits, or warm had none) |
| `INV-11` | `inp_availability = unavailable` on an interaction scenario |
| `INV-12` | payload capture mismatch > 1 % versus resource timing |
| `INV-13` | scenario executed against the wrong start URL or via a list navigation where a deep link was required |
| `INV-14` | the peer app served a request during the run |

### 7.6 Raw data retention

Every repetition writes its own directory (manifest, CDP trace, vitals buffer, timing marks, screenshots on
request, reason code if invalid); nothing is overwritten; the archive is checksummed and its path recorded in
the campaign manifest (NFR-RESEARCH-004 "all raw samples retained").

## 8. Bottleneck hypotheses

Falsifiable by a measurement in this protocol. Direction is a hypothesis, never a finding.

| ID | Hypothesis | Confirming measurement | Refuting measurement |
|---|---|---|---|
| H1 | Astro's authenticated first paint is dominated by server render + upstream, not JS | `render_ms` + `upstream_ms` ≈ `ttfb_doc_ms`; little JS in the payload mix | large JS share and `ttfb_doc_ms` ≪ content-visible time |
| H2 | Next's authenticated first paint is dominated by the auth-probe → data waterfall | two sequential XHRs in the trace; content visible after the second | content visible after one request, or before any XHR completes |
| H3 | Next's S11 navigation is much cheaper than Astro's per transition | fewer bytes and no document request in the transition; `nav_ms` gap | comparable bytes and document requests on both sides |
| H4 | JS parse/execute is a larger share of Next's load cost | `js_parsed_bytes` and `tbt_lab_ms` move with the `lcp_ms` gap; diagnostic with ×4 CPU (A-32) widens it | gap unchanged when JS is the only variable that moves |
| H5 | Thumbnail renditions, not full images, determine list payload in both apps | per-class image bytes ≪ full-image size × count | full-resolution bytes appear in a list scenario (contract violation) |
| H6 | The DB is not the bottleneck for any read scenario at dataset scale | scope D D1 query time small relative to `ttfb_api_ms` | `db_ms` accounts for most of the Worker time |
| H7 | Astro's server hop adds S-scope cost that Next does not have, which is visible in scope S but not in scope B | `upstream_ms` > 0 on Astro only | Astro documents with no upstream calls |
| H8 | CLS is zero-contribution from skeletons and thumbnails in both apps | `cls` ≈ 0 in S3-S6; no shift entries attributable to images or skeleton boxes | any shift entry with an image/skeleton source |
| H9 | Cold vs warm differs far more for Next (shared bundle) than for Astro (per-document assets) | cold−warm gap large on JS class for Next, small for Astro | warm ≈ cold on both, or the reverse |

## 9. Caching and network costs

### 9.1 What is cacheable

| Resource | Astro | Next | Directive | Why |
|---|---|---|---|---|
| HTML document | no | no (by parity decision) | `no-store` on both | §9.2, §9.3 |
| Hashed JS/CSS | yes | yes | `public, max-age=31536000, immutable` | Fingerprinted |
| Thumbnails / full images | yes (per-session) | yes (per-session) | `private, max-age=86400` + strong `ETag` | Authenticated, owner-scoped |
| API JSON | no | no | `no-store` | Owner-scoped |

### 9.2 Why authenticated responses are `no-store`

They are owner-scoped: a shared cache would serve one member's data to another (T-30); the payloads are
small so caching buys little; and a cached response would make the comparison depend on cache luck rather
than on the rendering path.

### 9.3 The HTML-parity control (a deliberate deviation)

Left alone, Next's shell is user-independent and *could* be `public, max-age=…`, while Astro's document never
can be. That asymmetry would make every warm comparison meaningless (Next reusing a static shell while Astro
re-renders). Therefore **both apps serve HTML `no-store`** during the campaign. This is recorded as a
protocol decision (A-46): it slightly disadvantages Next's warm numbers relative to how it would be deployed
publicly, and it is disclosed in the report rather than hidden.

### 9.4 Image `ETag` / `304`

Strong `ETag` derived from the stored binary so it is stable across restarts. Within a campaign `max-age`
means the browser reuses the image without a request in warm mode; a `304` still counts as a request in the
class table, which is why `cache_hits` is reported beside `requests`.

### 9.5 How cache-warm changes the comparison

| Effect | Consequence for the report |
|---|---|
| Shared JS bundle is reused by Next | Warm Next numbers reflect a returning visitor; this is the realistic case for an SPA |
| Astro re-downloads revalidated CSS/JS per document | `304` responses still cost a round trip; visible in `requests` and `ttfb_doc_ms` |
| Images cached in both | Image bytes collapse in warm mode on both sides; the cold table is where payload differences live |

## 10. Scalability limits of the measurement

These are the boundary of every claim, not caveats to soften.

| Limit | Consequence |
|---|---|
| One Cloudflare-hosted origin and one D1 database (single-writer), one R2 bucket | Nothing about horizontal scaling, D1 single-writer contention, or R2 read-latency tails |
| One browser, one version, one OS | Nothing about other engines or device classes |
| Zero concurrency | Nothing about throughput, capacity or tail latency under load |
| Synthetic dataset (50/50/3) | Nothing about large datasets; list cost is bounded by page size 20, not by table size |
| One user session | Nothing about multi-user effects (cache pressure, lock contention) |
| Scripted interactions | Nothing about real input patterns or INP distributions |
| Lab + field on the same machine | Nothing about real network geography |
| Two implementations, four contributors | Nothing about the frameworks in general |

## 11. Benchmark results template

Placeholders are filled by the harness; `<angle brackets>` is Erika's text. No cell is left with an
estimate.

### 11.1 Run manifest (per repetition, `run.json`)

| Field | Source |
|---|---|
| `run_id`, `campaign_id`, `timestamp`, `scenario`, `app`, `cache_state`, `throttle_profile` | harness |
| `astro_build_id`, `next_build_id`, `api_build_id`, `contracts_tag` | build |
| `dataset_id`, `checksums.total`, `anchor_date` | `05` §9.4 |
| `browser_version`, `launch_flags_hash`, `viewport`, `device_scale_factor` | harness |
| `host_load_band`, `host_samples` | campaign start |
| `session_user`, `login_count`, `reset_performed` (bool), `reset_checksum` | harness |
| `settle_ms`, `images_ready`, `reason_code` (if invalid) | harness |
| `vitals_buffer_hash`, `raw_dir` | harness |

### 11.2 Per-scenario metric table (one per scenario and cache state)

| Metric | Astro median (Q1-Q3) | Next median (Q1-Q3) | Δ median (Astro−Next) | IQRs disjoint? | Sign consistent 9/10? | n (adm/inv) |
|---|---|---|---|---|---|---|
| `lcp_ms` | | | | | | |
| `cls` | | | | | | |
| `inp_ms` | | | | | | |
| `ttfb_doc_ms` | | | | | | |
| `requests_total` | | | | | | |

### 11.3 Payload breakdown (scope B only)

| Class | Astro requests | Astro transfer | Astro decoded | Next requests | Next transfer | Next decoded | Note |
|---|---|---|---|---|---|---|---|
| document | | | | | | | |
| css | | | | | | | |
| js | | | | | | | |
| image | | | | | | | |
| xhr | | | | | | | |
| font | | | | | | | |

### 11.4 Scope S — server↔server (Astro only)

| Scenario | Calls per document | `upstream_ms` median (IQR) | Per-call ms | Bytes (only if measured) |
|---|---|---|---|---|

### 11.5 Scope D — DB-facing (both apps, same API)

| Operation | Scenario | Statements/req | Rows read/req | Worker `db_ms` median (IQR) | API p50 / p95 |
|---|---|---|---|---|---|---|

### 11.6 Cache-cold vs cache-warm

| Scenario | App | Metric | Cold median (IQR) | Warm median (IQR) | Cold−Warm | Cache hits (cold/warm) | Note |
|---|---|---|---|---|---|---|---|

### 11.7 Lab table (separate; never merged)

| Page | App | `lcp_lab_ms` median (n=4) | `cls_lab` | `tbt_lab_ms` | Total bytes | Runs |
|---|---|---|---|---|---|---|

### 11.8 Claims

| # | Claim | Scope | Evidence (scenario/metric/app/n) | Build ids match? | Supported? | Caveat |
|---|---|---|---|---|---|---|

### 11.9 Invalidation checklist (attached to every campaign)

- [ ] Parity checklist (FR-UI-009) passed for both apps on these exact build ids, signed.
- [ ] Both apps built in production mode; no source map served; no dev overlay observed (`INV-06`).
- [ ] Dataset checksum matches the campaign baseline (`INV-03`).
- [ ] Host load inside the fixed band (`INV-08`).
- [ ] Browser version and launch-flag hash recorded (`INV-09`).
- [ ] Cache assertions verified for both states (`INV-10`).
- [ ] Zero third-party requests (`INV-05`).
- [ ] Zero `429`/`5xx` across admitted runs (`INV-01`, `INV-02`).
- [ ] Every invalid repetition has a reason code and is retained.
- [ ] No cell reported with fewer than 10 admitted samples.

## 12. Acceptance criteria for the benchmark

The campaign is complete and admissible when every item is decidably true:

| ID | Criterion |
|---|---|
| AC-B01 | Both apps pass the parity checklist on the reported build ids, and the checklist is attached |
| AC-B02 | 44 main cells (11 × 2 × 2) exist; each has ≥10 admitted samples or is reported as `n/a` with a reason code |
| AC-B03 | The `P1` secondary set exists for at least S1, S3, S4 and S11, or its absence is disclosed (A-45) |
| AC-B04 | Every claim in §11.8 cites a scenario, metric, app, n and the matching build ids |
| AC-B05 | No traffic statement mixes scopes B, S and D, and no total-transfer figure exists |
| AC-B06 | Lab and field values appear in separate tables; no INP is derived from lab data |
| AC-B07 | Every invalid repetition is retained with a reason code; the admitted count is stated per cell |
| AC-B08 | The raw archive path and checksum are recorded in the campaign manifest |
| AC-B09 | The report states the §10 limits and the §9.3 HTML-parity deviation |
| AC-B10 | No claim of statistical significance, no framework-general claim, no RUM claim |

## Appendix A — Protocol assumptions

Distinct from `01` §7. Each is a value this protocol chose because no source states it, and each is a
candidate for challenge before the campaign.

| ID | Assumption / value | Why | If changed |
|---|---|---|---|
| A-30 | Main campaign throttle `P0` = none | Loopback cost is not the variable under study; `P0` isolates render/JS/DB | With `P0` only, no transfer-time claim is possible |
| A-31 | Secondary throttle `P1` = 40 ms latency, 10 Mbit/s down, 5 Mbit/s up, 0 % loss | Some transfer cost is needed to expose payload differences in wall-clock terms | Absolute ms change; direction results survive |
| A-32 | No CPU throttling in the campaign; ×4 only in a diagnostic | Avoids inventing a device class | H4 loses one of its two probes |
| A-33 | Headed Chromium on a virtual display, `--disable-gpu` | Determinism of rasterisation | Results become GPU-pipeline-specific |
| A-34 | Viewport 1440 × 900, DSF 1 | Brief §10 fixes an identical viewport; FR-LAND-002 asserts 1440×900 | Layout and thumbnails-per-row change, altering payload |
| A-35 | Quiet windows 500 ms network + 500 ms shift | `SETTLE()` must be decidable | Shorter → truncated samples; longer → thermal drift |
| A-36 | Settle cap 10 s | A stuck scenario must be declared invalid, not truncated | Too low invalidates legitimate slow runs |
| A-37 | `IMAGES_READY()` = `img.complete ∧ naturalWidth > 0` | Needed for S4/S5/S6/S10 stop conditions | A lazy-loading implementation could make it never true |
| A-38 | Fixed launch-flag set, recorded by hash | Flag drift is a silent condition change | Results from different flags are not comparable |
| A-39 | `reducedMotion: reduce`, `colorScheme: light`, `en-US`, `UTC` | Removes animation/theme variance from INP and CLS | With motion on, transitions could affect presentation delay |
| A-40 | 11 repetitions per cell (10 admitted) | NFR-RESEARCH-004 floor plus the discard | More would tighten IQRs, not change admissibility |
| A-41 | 5 lab runs per page/app, median of 4 reported | Lighthouse variance is high | A single lab run would be noise |
| A-42 | Host-load band fixed at campaign start from 20 idle samples | Detects a loaded machine without inventing a threshold now | Too tight → many invalid runs; too loose → contaminated samples |
| A-43 | Outlier fence Tukey 1.5 × IQR | Standard, transparent, no normality assumption | A different rule changes only the flag, never the reported median |
| A-44 | One scripted interaction per interaction scenario | Makes INP unambiguous | Multiple interactions would require reporting the max and disclosing which |
| A-45 | Campaign completeness gates on the main set only | The secondary set is reported but not gating | If grading expects `P1` everywhere, it becomes gating |
| A-46 | `no-store` on both apps' HTML during the campaign | §9.3 parity control | If Next's shell could cache, warm comparisons become unfair |

## Appendix B — What the measured system must expose

Parity-safe additions, identical in both apps, no user-visible change, no feature:

| Need | Requirement | Owner |
|---|---|---|
| `Server-Timing` on Astro documents (`render`, `upstream`, per call) | NFR-PERF-008, NFR-OBS-003 | Hamzah |
| Per-request timing + request id in the API log, and `Server-Timing: db` | NFR-OBS-001/003 | Iqram |
| Readiness gate before measuring (`/health`) | NFR-REL-007 | Iqram |
| D1 query metrics / Cloudflare Analytics enabled for the campaign Worker | NFR-PERF-010 | Iqram |
| Deterministic dataset + manifest/checksum | A-04, `05` §9 | Iqram + Erika |
| `run_id` correlation between harness, proxy and API logs | NFR-OBS-002 | Erika + Iqram |

## Appendix C — Traceability

| Requirement | Where this protocol satisfies it |
|---|---|
| NFR-PERF-001/002/003 | §3 O-1..O-5, §6.1-§6.4, §11.2, §11.7 |
| NFR-PERF-004/005 | §1.4 (three scopes), §6.6, §11.3, AC-B05 |
| NFR-PERF-006/007 | §5.3 CV-5/CV-7/CV-11, §11.9 |
| NFR-PERF-008 | §6.7, Appendix B |
| NFR-PERF-009 | §2.1 (dataset + page size), §11.1 |
| NFR-PERF-010 | §6.7, §11.5 |
| NFR-RESEARCH-001..009 | §1.2-§1.4, §7.1-§7.6, §10, §12, Appendices A-C |
| NFR-OBS-004 | §6.2 (no network request), `INV-05` |
| NFR-OBS-005 | `INV-01`, `INV-02`, AC-B07 |
| NFR-COMPAT-001 | §5.3 CV-1, `INV-09` |
| FR-ATT-004/010 | S4/S5/S10 image-class measurement, H5, H8 |
