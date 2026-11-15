# AGENTS.md

Operating manual for any AI coding agent working in this repository. Read this file first, then
`RULES.md`, then `DESIGN.md`. Everything here is derived from the Phase 1 blueprint in `.planning/`;
where this file and the blueprint disagree, **the blueprint wins** and this file is the defect.

## 1. What this project is

A group assignment (4 people, part-time) that compares two rendering models behind one backend:

```
Astro SSR (MPA)     Next.js SSG (SPA-style)     Admin SSR (apps/admin)
        \                   |                          /
     ElysiaJS on Node + Worker (REST API · auth · business logic)
                         |
     Cloudflare D1 (SQLite · Serverless Database) · R2 (attachment binaries)
```

Node.js 24 hosts the toolchain (`pnpm`, Astro, `wrangler`, Vitest); the API itself runs on Cloudflare
Workers, locally through `wrangler dev` on `:8787` (ADR-16). There is no Node server entry.

The admin console is a separate deployable (`apps/admin`) held outside the benchmark. It is not a
third rendering model under comparison; it exists so account administration never ships in the static
export or in the SSR member app.

Diagram: `design/assets/architecture-mpa-spa.png`.

Both frontends must look and behave identically; only the rendering model differs. That parity is the
thing being measured — anything that makes one app finish differently for a reason unrelated to
rendering (different icons, fonts, copy, payload) invalidates the assignment.

Domain: tasks (status, priority, optional due date), notes (pinnable), image attachments on both, one
account per user, owner-only access. Five tables, one authorization axis.

## 2. Read order

| Order | File | Why |
|---|---|---|
| 1 | `AGENTS.md` (this file) | how to work here |
| 2 | `RULES.md` | the hard MUST / NEVER list you will be reviewed against |
| 3 | `DESIGN.md` | visual system, screens, states, copy, FigCraft workflow |
| 4 | `.planning/12-architecture-review.md` | index of the blueprint and how the documents relate |
| 5 | `.planning/00`…`14` | the authority for whatever you are about to touch |
| 6 | `DEVELOPMENT-GUIDELINES.md` | branches, PRs, reviews, testing obligations |

Do not read all 14 planning documents for a one-line change. Use the table in §5 to find the two you
need.

## 3. Truth hierarchy

1. `.planning/00-…14-…` — routes, data shapes, statuses, cookie name, storage layout, NFRs.
2. `packages/contracts` — the executable form of the blueprint's types and validators.
3. `RULES.md`, `DESIGN.md`, `DEVELOPMENT-GUIDELINES.md` — how to apply it.
4. Your preference — nothing. Consistency beats taste.

If a document is wrong, fix the document in the same PR as the code. Never quietly do it differently.

## 4. Repository map (target monorepo)

`STRUCTURE.md` is the full tree: what exists today, what Phase 3 creates, and where each kind of file
goes. The short version:

```
apps/
  web-astro/     Astro SSR, MPA. Server-rendered HTML per navigation.
  web-next/      Next.js static export, SPA-style data fetching.
  admin/         Admin SSR. Account administration only; not part of the benchmark.
  api/           ElysiaJS (Node + Worker). REST, sessions, ownership checks, uploads.
packages/
  contracts/     Zod schemas + types + copy constants. Dependency-free except zod.
  design-tokens/ tokens.css + tokens.json (single source for both frontends).
.planning/       the approved blueprint (read-only reference; changes need a PR + review)
design/          FigCraft file, exports, diagrams, icons, design docs
DEVELOPMENT-GUIDELINES.md, AGENTS.md, RULES.md, DESIGN.md, STRUCTURE.md
```

Dependency direction is `apps/* → packages/*`. Never `apps/web-next → apps/web-astro`, never
`packages/* → apps/*`. No new top-level directory without an ADR.

As of today the repository contains **only** `.planning/`, `design/` and these documents. There is no
`package.json` yet; `git init` (prerequisite P-04) and the scaffold are still open.

## 5. Where the truth lives for each task

| You are about to… | Read |
|---|---|
| Add or change a route, request, or response | `.planning/06-api-contracts.md` §5, `packages/contracts` |
| Touch the schema, a query, or a cascade | `.planning/05-database-design.md` §1-2 |
| Touch auth, sessions, cookies, uploads, ownership | `.planning/07-security-architecture.md` |
| Build or change a screen | `DESIGN.md`, `.planning/14-ui-ux-specification.md`, `.planning/01` §3 |
| Decide "SSR vs static" for a Next.js page | `.planning/04-architecture-decisions.md` ADR-04 |
| Measure anything | `.planning/08-performance-strategy.md` |
| Write or change a test | `.planning/09-testing-strategy.md` |
| Touch the landing page, admin console, or a marketing block | `design/10-landing-sections.md`, `design/09-admin-console.md` |

## 6. Commands

The scaffold defines these; use them, do not invent alternates:

```
pnpm install                 # install the workspace
pnpm -r typecheck            # tsc --noEmit across packages and apps
pnpm -r lint                 # eslint
pnpm -r test                 # unit + integration
pnpm --filter api dev         # wrangler dev (API Worker) on :8787
pnpm --filter api db:migrate:local  # apply D1 migrations locally
pnpm --filter web-astro dev  # Astro dev server
pnpm --filter web-next dev   # Next dev server
pnpm build                   # production build (the only build used for benchmarking)
```

Never measure against `dev`. Never commit `node_modules`, `.env`, `.next/out`, `dist/`, or
uploads.

## 7. How to work on a task

1. Restate the task as the requirement IDs it serves (`FR-…`, `NFR-…`). If you cannot name one, stop and
   ask: it is probably scope you are inventing.
2. Find the two or three planning documents from §5. Read the acceptance criteria, not just the prose.
3. Change the contract first if a shape changes; both frontends follow in the same PR.
4. Write the test the change demands (`DEVELOPMENT-GUIDELINES.md` §7) before or with the code.
5. Run `typecheck`, `lint`, and the narrowest test that exercises the change. Report the exact commands.
6. Update the document you contradicted. A stale doc is a review reject.
7. Branch `feat/<area>-<slug>`, Conventional Commit, PR body with requirement IDs, verification, and
   screenshots from **both** frontends for UI changes.

## 8. Design work

All UI design lives in `design/rweb-task-management.figcraft`, driven through the FigCraft MCP
(`run_command`, `get_node`, `screenshot`, `file.export`). Rules that matter:

- Components come from pages `00 Tokens` and `01 Components`. Instance them; never redraw a button,
  badge, field, or card from primitives.
- Every fill, stroke, radius, gap and font size binds a `Tokens` variable. No raw hex.
- Copy comes from `design/06-copy-deck.md`, verbatim. No invented strings, no emoji, no uppercase
  labels, no arrow glyphs in buttons.
- Every list and detail screen has loading, empty, no-results, error, validation, and feedback states.
- When you finish a frame set: `file.save`, export PNGs into `design/exports/`, and look at them. The
  export catches what the canvas hides (off-frame pastes, overlapping text, clipped cards).

`DESIGN.md` §2-§8 has the token values, geometry, component inventory, screen list and state matrix.

## 9. Hard stops

Stop and ask — do not guess — when:

- A requirement is ambiguous or two planning documents conflict.
- A change would add a dependency, a table, a route, or a top-level directory.
- A change would make the two frontends behave differently beyond their rendering model.
- A change would put user data into `apps/web-next` static output.
- A benchmark or performance claim is being requested without a run ID.
- A design change contradicts `.planning/14` or `DESIGN.md`.

Report what you tried and what is missing; never silently narrow scope.

## 10. Definition of done

- Behaviour matches the requirement ID and its acceptance criteria.
- Both frontends updated where the requirement concerns both.
- Tests at the level the change demands, passing; the 404-on-foreign-owner case covered for anything
  touching reads or writes.
- `typecheck`, `lint`, `test` green; CI green.
- Docs and contracts updated in the same PR.
- UI changes have screenshots from both apps and match `DESIGN.md`.
- No TODOs without an issue reference, no dead code, no commented-out blocks.
- `RULES.md` re-read once before you open the PR.
