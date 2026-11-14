# Contributing

This is a four-person group assignment. The rules that matter are already written down; this page only
points at them so nobody has to guess.

## Before your first commit

1. Read [`AGENTS.md`](AGENTS.md) — how work is done here.
2. Read [`RULES.md`](RULES.md) — 65 numbered MUST/NEVER rules you will be reviewed against.
3. If you touch UI, read [`DESIGN.md`](DESIGN.md).
4. Find the blueprint document for your area in `.planning/` (index: `.planning/12-architecture-review.md`).

## Workflow

```bash
git switch main && git pull
git switch -c feat/<area>-<slug>       # area: api | astro | next | contracts | infra | bench
# … work …
pnpm -r typecheck && pnpm -r lint && pnpm -r test
git commit -m "feat(api): add task status transition"
git push -u origin feat/<area>-<slug>
```

Open a PR against `main`. The template asks for requirement IDs, contract impact, exact verification
commands, screenshots from **both** frontends for UI changes, and risk. One approval is required;
contract changes and auth changes need the owners named in `.planning/13-team-responsibility-matrix.md`.

Branch names, commit format, review rules and the Definition of Done are in
[`DEVELOPMENT-GUIDELINES.md`](DEVELOPMENT-GUIDELINES.md) §4-§8.

## Scope discipline

- A feature ships in both frontends in the same PR, or it does not ship.
- A new dependency needs a paragraph in the PR: what it does, why the platform or an existing dependency
  cannot, its install size.
- No change to a shared shape, route, status or environment variable without updating `.planning/` in the
  same PR.
- Do not push to `main`. Do not commit `node_modules`, `.env`, build output, or uploads.

## Local environment

The scaffold (`package.json`, `pnpm-workspace.yaml`, `.nvmrc`) lands with Phase 3; until then the commands
above are the contract to implement, not something that runs yet. See [`STRUCTURE.md`](STRUCTURE.md) for
what exists and what is created when.

## Questions

Ownership and escalation: `.planning/13` §1 and §6. A blocked task is raised the same day, not absorbed.
