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
    - "backend-development: shaped the toolchain verdict — requires Node 22+ and a pooled PostgreSQL, and made 'connection pooling strategy' an explicit environment prerequisite rather than an afterthought."
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
| Node.js | available | v24.11.1 | Current framework floors: Astro 7 requires **≥ 22.23.4** and rejects odd Node majors; Next 16 requires **≥ 20.9**. v24.11.1 satisfies both. Team pin = Node 24 LTS on this machine (Node 26 LTS is also current) — A-08 |
| npm | available | 11.6.2 | Zero-blocker fallback workspace manager (`npm workspaces`) |
| npx | available | 11.6.2 | one-off tooling (e.g. Playwright, Lighthouse CLI) without global install |
| corepack | available | 0.34.2 | the intended route to activate pnpm |
| bun | available | 1.3.8 | **not** used as the package manager: lockfile/workspace behaviour must match the documented commands, and the team's toolchain is npm-family. Optional as a script runner only, never as installer |
| pnpm | **BROKEN** | shim present, resolves to `corepack/dist/pnpm.js`, which fails with `Cannot find module '.../corepack/v1/pnpm/12.4.2/bin/pnpm.cjs'` | pnpm cannot run today → blocking prerequisite (P-01) |
| PostgreSQL client/server | **absent locally** | — | `psql` not found; DB must come from a container (P-03) |
| Docker CLI | available, **daemon stopped** | 29.8.1 | `colima` socket missing → container DB cannot start until the runtime is started (P-02) |
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
| P-02 | Start the container runtime (colima/Docker daemon) | Compose-based PostgreSQL and the parity environment need it | Start the user-level colima/Docker daemon | Native PostgreSQL 16 install (documented in `03` §9.4), accepting host-version drift |
| P-03 | Obtain PostgreSQL 16 | No local server or client; migrations and integration tests need it | Run Postgres 16 in Compose on `localhost:5432` with a named volume | Same as P-02 fallback |
| P-04 | `git init` + first commit + default branch `main` | Branching strategy, PR workflow, and review gate assume a repository | `git init`, add remote, push | None — required for the collaboration model |
| P-05 | Pin versions | Benchmark validity depends on one browser/toolchain version across runs | `.nvmrc`, `packageManager` field, `engines`, Playwright pinned version, committed lockfile | None — without pinning the comparison is not reproducible |

**Not recommended:** editing global configs, shell profiles, or agent configuration to work around
any of the above. Each fix is per-project or per-user-install only, and is listed for the team to run
whenever they choose to leave the planning phase.

## 5. Environment target

| Concern | Decision | Where it is argued |
|---|---|---|
| Node runtime | Node 24 LTS pinned (`engines.node: ">=22.23.4"`), satisfying Astro 7 (≥22.23.4, no odd majors) and Next 16 (≥20.9) | ADR-10 |
| Framework versions | Astro **7.4.x**, Next.js **16.4.x**, Fastify **5.12.x**; `@fastify/cookie` 11.x, `@fastify/multipart` 10.x | ADR-10, `03` §10 |
| Package manager | pnpm workspaces (fallback: npm workspaces) | ADR-11 |
| Database | PostgreSQL 16 in Docker Compose, single instance, one database, pooled via `pg.Pool` | ADR-02 |
| Object/binary storage | local volume `/var/lib/taskapp/uploads` behind a storage interface | ADR-07 |
| Browser for benchmark | Playwright-pinned Chromium, 1440×900 | `08` §5 |
| Origin model | one origin, path-prefixed apps behind a reverse proxy | ADR-05 |

## 6. What is deliberately absent

- No TypeScript project references yet; `03` §7 fixes them as a design.
- No lint/format config; `DEVELOPMENT-GUIDELINES.md` §6 fixes the rules, `03` §7 the file placement.
- No CI pipeline; `10` places it in Phase 4 with a named owner. Until then, gates run locally with the
  same commands.
- No secrets, `.env` values, or credentials anywhere in this tree — `.env.example` is authored in
  Phase 4 from `03` §8.
