# STRUCTURE.md

One tree for the repository: what exists today and what Phase 3 creates. The layout of code follows
`.planning/03-system-architecture.md` §7; this file adds the documentation and design side and states
what is already built.

Legend: `[now]` exists in this repository · `[P3]` created when the app scaffold lands · `[P4]` created
with infra.

```
rweb-task-management/
├── .planning/                    [now]  the blueprint, 00-14. Read-only reference; changes need a PR
├── design/                       [now]  all UI design, diagrams and renders
│   ├── rweb-task-management.figcraft    source of truth: tokens, components, 43 member screens,
│   │                                    3 admin screens, landing sections
│   ├── 00-design-plan.md                Phase 2 plan, gap decisions, gates
│   ├── 01-design-system.md              tokens, styles, component ids, contrast evidence
│   ├── 02-screen-specs.md               frame-by-frame screen record
│   ├── 03-diagram-index.md              diagram index + verification
│   ├── 04-design-review.md              independent review findings
│   ├── 05-implementation-handoff.md     derived geometry, markup contract, state table
│   ├── 06-copy-deck.md                  every UI string, ready for packages/contracts
│   ├── 07-parity-checklist.md           screen × state parity gate
│   ├── 08-review-resolutions.md         what changed after review, what is still open
│   ├── 09-admin-console.md              admin extension (BCR-01, approval pending)
│   ├── 10-landing-sections.md           landing frames l-04…l-10
│   ├── assets/                          design media: hero illustration, architecture diagram
│   ├── diagrams/                        5 draw.io files + mermaid sources + validator
│   ├── exports/                         PNG renders of every page for review and PRs
│   └── icons/                    (retired) icons now come from Lucide Icons in both frontends
│
├── apps/                         [P3]
│   ├── api/                      ElysiaJS (Node + Worker) + TypeScript; the only component that talks to Cloudflare D1
│   │   ├── src/{index.ts,app.ts,config/,routes/,modules/{auth,tasks,notes,attachments,dashboard,admin,health}/,db/,lib/}
│   │   ├── migrations/           numbered forward-only SQL, applied by `wrangler d1 migrations apply`
│   │   └── test/{unit,integration}/
│   ├── web-astro/                Astro, output 'server', @astrojs/node standalone, route prefix '/'
│   │   └── src/{pages,layouts,components,lib,styles,assets}/
│   ├── web-next/                 Next.js App Router, output 'export', basePath '/b'
│   │   └── src/{app,components,lib,styles}/
│   └── admin/                    Admin SSR (server-authorised), route prefix '/admin'
│       └── src/{pages,layouts,components,lib,styles}/
│
├── packages/                     [P3]
│   ├── contracts/                types + Zod schemas + error codes + copy + route constants
│   │   └── src/{types/,schemas/,errors.ts,copy.ts,routes.ts}   (dependency-free except zod)
│   ├── design-tokens/            tokens.css + tokens.json, generated from the FigCraft `Tokens` set
│   ├── test-utils/               fixture factories, dataset generator, typed API client for tests
│   └── config/                   shared tsconfig bases, eslint flat config, prettier
│
├── assets/                       [P3]  runtime seed media only (seed images for the benchmark dataset).
│                                       Design media lives in design/assets/ — do not mix the two.
├── infra/                        [P4]  deployment config and zone-routing notes, secrets (gitignored)
├── scripts/                      [P3]  seed, dataset generator, benchmark runner, storage sweep
├── docs/                         [P3]  the final comparative report and its diagrams (not planning)
│
├── README.md                     [now]  entry point, status, team, conventions
├── AGENTS.md                     [now]  operating manual for AI agents
├── RULES.md                      [now]  40 numbered MUST/NEVER rules
├── DESIGN.md                     [now]  visual system for both frontends
├── STRUCTURE.md                  [now]  this file
├── DEVELOPMENT-GUIDELINES.md     [now]  branches, PRs, reviews, testing obligations
└── package.json / pnpm-workspace.yaml / tsconfig.base.json / .nvmrc / .env.example   [P3]
```

## Dependency direction

| Rule | Why |
|---|---|
| `apps/*` may import `packages/*` | shared contracts and tokens |
| `apps/*` never import each other | the two frontends must share data shapes, not implementation |
| `packages/*` never import `apps/*` | packages stay buildable in isolation |
| No frontend imports `pg`, `node:*`, or API source | the database is reachable only through the API |
| Business rules live only in `packages/contracts` | one validation, one copy deck, one enum |

## Where each kind of file goes

| You are adding… | Path |
|---|---|
| A page or component | `apps/web-astro/src/pages|components/` **and** `apps/web-next/src/app|components/` |
| A shared type, schema, enum, or UI string | `packages/contracts/src/` |
| A colour, space, radius, or type value | `packages/design-tokens/` (and the FigCraft `Tokens` set) |
| A design change | `design/` (FigCraft + doc + export) |
| A decision or requirement | `.planning/` |
| An upload test fixture | `assets/` (runtime seed media) |
| A benchmark scenario or result | `scripts/` + the archived raw files referenced in `.planning/08` |

## Never committed

`node_modules/`, `.env*`, `dist/`, `.next/`, `out/`, `coverage/`,
`playwright-report/`, `test-results/`, `infra/` secrets material, editor and OS files. Full list in
`.gitignore`; binary assets are marked in `.gitattributes`.

## Current state

Only the `[now]` paths exist. There is no `package.json`, no `pnpm-workspace.yaml`, and no app source:
Phase 3 starts with the scaffold (`pnpm init`, workspace file, `apps/*`, `packages/*`) and every path
above is created then. Until that happens, `pnpm` commands mentioned in `AGENTS.md` §6 are the contract
to implement, not something you can run.
