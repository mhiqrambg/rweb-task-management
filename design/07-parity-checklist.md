---
document: 07-parity-checklist.md
phase: 2
stage: design delivery
prepared_by: design integrator
sources: [".planning/14-ui-ux-specification.md §7, §9", ".planning/01-requirements.md FR-UI-001..012, NFR-A11Y-001..007"]
---

# 07 — Parity and state gate

Executable gate for FR-UI-009: run against **production builds of both apps** before any benchmark run.
A failing cell blocks the run. Each cell is checked at 1440×900 and 375×667.

## 1. How to run

For each row: open the Astro route and the Next.js route with the same dataset and session, then compare
(1) visible text, (2) DOM order of primary elements, (3) badge labels and colours, (4) state copy, (5)
screenshot pair attached to the PR. Evidence naming: `parity/<screen>-<state>-<app>.png`.

## 2. Screen × state matrix

Legend: `S` skeleton/loading, `E` empty, `N` no-results, `X` error + retry, `K` success feedback,
`V` validation, `D` destructive confirm.

| Screen | S | E | N | X | K | V | D | Extra checks |
|---|---|---|---|---|---|---|---|---|
| Landing | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 5 blocks in order; both CTAs above the fold; signed-in CTA swap with zero shift; footer links; 375 px no overflow |
| Login | button spinner | n/a | n/a | generic + rate-limit | redirect | field + form | n/a | password never in URL/storage; cross-link |
| Register | button spinner | n/a | n/a | email-taken | redirect to dashboard | field + form | n/a | password cleared on email-taken; email retained |
| Dashboard | stat + list skeletons | per-widget | n/a | per-widget retry | n/a | n/a | n/a | counters equal filtered list totals; overdue excludes completed; 5+5 in update order |
| Task list | 3–6 card skeletons | C-16 + New task | clear-filters CTA | C-18 retry | toast | n/a | per row | URL round-trip; multi-filter AND; sort toggle; `+N` thumbs; overdue marker; cursor ends |
| Task detail | detail skeleton (Next only) | n/a | n/a | 404 / C-18 | toast | inline edit | task | deep link; all fields; attachment grid; lightbox keyboard; status change persists |
| Task edit | n/a | n/a | n/a | field map from server | toast + redirect to detail | field + form | n/a | double-submit creates one task; clear due date |
| Note list | card skeletons | C-16 + New note | clear search | C-18 retry | toast | n/a | per row | pinned block first; pin toggle optimistic + revert |
| Note detail | skeleton (Next only) | n/a | n/a | 404 / C-18 | toast | inline edit | note | full body; lightbox; pin state unchanged by edit |
| Account | n/a | n/a | n/a | C-18 | n/a | n/a | n/a | email, name, member since, read-only note, logout |
| Not found | n/a | n/a | n/a | n/a | n/a | n/a | n/a | same wording and CTA in both; non-owned id yields this screen |
| Upload area | per-file progress | "No images yet" | n/a | per-file rejection list | thumb appears + toast | client-side reject before request | image | renamed `.png`, 6 MB file, 11th file; retry without reload |
| Lightbox | spinner | n/a | n/a | broken-image fallback | n/a | n/a | n/a | focus trap, Esc, arrow keys, `2 of 5`, restore focus |

## 3. Cross-cutting asserts (run once per build)

1. `grep -rE '#[0-9a-fA-F]{3,6}' apps/web-astro/src apps/web-next/src` returns only `tokens.css` imports' paths — no raw colour.
2. Both apps load the same icon set, font stack and copy module; string diff of the two rendered login pages is empty apart from the framework's own document scaffolding.
3. Zero horizontal scroll and zero clipped controls at 375 / 768 / 1024 / 1440.
4. Keyboard-only pass of: create task, filter, change status, open lightbox, remove image, delete task.
5. Every dynamic change announced once in a live region; focus never moves on toast.
6. CLS onset from thumbnails, skeletons and toasts is zero (reserved boxes, fixed toast).
7. Next.js static output contains no seeded dataset value (grep the export directory).
8. `401` mid-use: both apps land on login with the expiry message and no residual protected DOM or cached payload.
