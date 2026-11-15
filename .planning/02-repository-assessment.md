---
document: 02-repository-assessment.md
phase: 1
stage: 3
prepared_by: software-architect
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [backend-development]
  changed:
    - "backend-development: shaped the toolchain verdict — requires Node 22+ locally and Cloudflare Workers + D1 as the runtime target, and made 'wrangler and Cloudflare account access' an explicit environment prerequisite rather than an afterthought."
---

# 02 — Repository and Environment Assessment

## 1. Verdict

**Maturity: EMPTY (greenfield).** The workspace contains **no** application code, package manifest,
lockfile, build config, database artifact, test, CI definition, or documentation. There is **nothing
to preserve, extend, or refactor**, and nothing that constrains the design except the brief and the
toolchain findings in §3.

Consequences that every downstream document inherits:

- No existing convention to reuse → this blueprint *defines* the conventions. Contradicting them later
  is a defect, not a preference.
- No existing dependency to audit → the dependency policy in `03-system-architecture.md` §10 is
  forward-looking.
- No git history → the branching and PR rules in `DEVELOPMENT-GUIDELINES.md` are proposals that take
  effect only after `git init`.

## 2. Evidence

| Check | Command / method | Result | Interpretation |
|---|---|---|---|
| Files present at repo root | glob for all files **including hidden** under `.` | no files | empty tree |
| Directories present | glob for directories, hidden included | none | no hidden `.public`/`.github`/`.vscode` scaffolding |
| `AGENTS.md`, `DESIGN.md`, `RULES.md` | glob for those names | absent | no repository-specific agent instructions to follow |
| Version control | `.git` directory | **absent** | not a repository yet |
| `package.json` / lockfile | glob | absent | no JS project, no installed deps |
| Planning docs | `.planning/` | created by this stage (00, 02) | first artifacts in the tree |
| Prior planning equivalent (`docs/planning/`) | glob | absent | no duplicate document set to reconcile |

No file was overwritten: the only writes are the new `.planning/` documents themselves.

## 3. Toolchain availability (verified on this workstation)

Findings are **observations from the machine that will be used for development**, not design
choices. They split cleanly into "available" and "needs a prerequisite step".

| Tool | Status | Version | Design impact |
|---|---|---|---|
| Node.js | available | v24.11.1 | Local toolchain floor: Astro 7 requires **≥ 22.23.4** and rejects odd Node majors; Next 16 requires **≥ 20.9**. v24.11.1 satisfies both. The API runtime is Cloudflare Workers with D1/R2 bindings, not local Node — A-08 |
| npm | available | 11.6.2 | Zero-blocker fallback workspace manager (`npm workspaces`) |
| npx | available | 11.6.2 | one-off tooling (e.g. Playwright, Lighthouse CLI) without global install |
| corepack | available | 0.34.2 | the intended route to activate pnpm |
| bun | available | 1.3.8 | **not** used as the package manager: lockfile/workspace behaviour must match the documented commands, and the team's toolchain is npm-family. Optional as a script runner only, never as installer |
| pnpm | **BROKEN** | shim present, resolves to `corepack/dist/pnpm.js`, which fails with `Cannot find module '.../corepack/v1/pnpm/12.4.2/bin/pnpm.cjs'` | pnpm cannot run today → blocking prerequisite (P-01) |
| Cloudflare account / `wrangler` auth | **not configured locally** | — | `wrangler` is not authenticated; D1 and R2 bindings cannot be created or migrated until `wrangler login` succeeds (P-03) |
| git | not initialized in this repo | — | P-04 |

No shell was executed by this stage to probe versions; the values above were supplied by the
orchestrator's verification on the same machine and are taken as ground truth (do not re-derive,
do not attempt to repair).

## 4. Blocking prerequisites

These are **Phase-0 setup tasks**, owned in `10-implementation-roadmap.md` §3 and scored in
`11-risk-register.md`. They are the only places a human must touch the machine before any code exists.

| ID | Prerequisite | Why it blocks | Fix (documented, not executed) | Fallback if it cannot be fixed |
|---|---|---|---|---|
| P-01 | Repair or install pnpm | `pnpm` shim is broken; every workspace command in the plan assumes it | `corepack prepare pnpm@9 --activate`, or `npm i -g pnpm` | Use **npm workspaces** — zero blockers, same directory layout, `npm run -w` instead of `pnpm --filter` |
| P-02 | Install and authenticate `wrangler`, the Cloudflare CLI | The Worker, D1 migrations and R2 bindings are managed through `wrangler`; nothing runs without it | `npm i -g wrangler`, then `wrangler login` | None — the bindings are the platform; without them nothing runs |
| P-03 | Create the D1 database and the R2 bucket, and bind them | The Worker needs `env.DB` and `env.BUCKET`; migrations and integration tests need a real D1 | `wrangler d1 create`, `wrangler r2 bucket create`, then declare the bindings in `wrangler.jsonc`; local dev uses `wrangler dev` on `:8787` with local D1/R2 under `.wrangler/state` | None — same reason as P-02 |
| P-04 | `git init` + first commit + default branch `main` | Branching strategy, PR workflow, and review gate assume a repository | `git init`, add remote, push | None — required for the collaboration model |
| P-05 | Pin versions | Benchmark validity depends on one browser/toolchain version across runs | `.nvmrc`, `packageManager` field, `engines`, Playwright pinned version, Workers compatibility date, committed lockfile | None — without pinning the comparison is not reproducible |

**Not recommended:** editing global configs, shell profiles, or agent configuration to work around
any of the above. Each fix is per-project or per-user-install only, and is listed for the team to run
whenever they choose to leave the planning phase.

## 5. Environment target

| Concern | Decision | Where it is argued |
|---|---|---|
| Node runtime | Node 24 LTS pinned for local tooling (`engines.node: ">=22.23.4"`), satisfying Astro 7 (≥22.23.4, no odd majors) and Next 16 (≥20.9) | ADR-10 |
| Framework versions | Astro **7.4.x**, Next.js **16.4.x**, Hono on Cloudflare Workers | ADR-10, `03` §10 |
| Package manager | pnpm workspaces (fallback: npm workspaces) | ADR-11 |
| Database | D1 (SQLite), single database, one migration history, accessed via binding `env.DB` | ADR-02 |
| Object/binary storage | R2 bucket behind the `BinaryStore` interface, accessed via binding `env.BUCKET` | ADR-07 |
| Browser for benchmark | Playwright-pinned Chromium, 1440×900 | `08` §5 |
| Origin model | one custom origin behind Cloudflare zone routing (`/api/*` → Worker, `/` → Astro, `/b/*` → Next static) | ADR-05 |

## 6. What is deliberately absent

- No TypeScript project references yet; `03` §7 fixes them as a design.
- No lint/format config; `DEVELOPMENT-GUIDELINES.md` §6 fixes the rules, `03` §7 the file placement.
- No CI pipeline; `10` places it in Phase 4 with a named owner. Until then, gates run locally with the
  same commands.
- No secrets, `.env` values, or credentials anywhere in this tree — `.env.example` is authored in
  Phase 4 from `03` §8.
