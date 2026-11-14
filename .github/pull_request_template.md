## What changed

<!-- One paragraph. Name the requirement IDs (FR-…, NFR-…) or ADR this serves. -->

Requirement / ADR:

## Contract impact

- [ ] none
- [ ] added — `packages/contracts` updated, both frontends follow in this PR
- [ ] changed — breaking; both frontends and a migration land together

## Verification

<!-- Exact commands, not "tested locally". -->

```
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

## UI change

- [ ] Screenshots attached from **both** frontends (Astro and Next.js)
- [ ] States covered: loading / empty / no-results / error / validation / success
- [ ] Matches `DESIGN.md`; no raw colours, no new component convention

## Risk

<!-- What could break, what you would watch after merge. -->

## Checklist

- [ ] `RULES.md` re-read; no `NEVER` rule broken
- [ ] Tests at the level the change demands, including the 404-on-foreign-owner case
- [ ] Docs or contracts updated in this PR if a shape, route, status or env var changed
- [ ] No secrets, no build output, no editor files committed
