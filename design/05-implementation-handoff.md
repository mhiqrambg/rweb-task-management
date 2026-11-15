---
document: 05-implementation-handoff.md
phase: 2
stage: design delivery
prepared_by: design integrator
reviewed_by: design-reviewer (see 04-design-review.md)
sources: [".planning/14-ui-ux-specification.md", ".planning/01-requirements.md §3-§4", ".planning/03-system-architecture.md §2", "design/06-copy-deck.md"]
---

# 05 — Implementation handoff

How the FigCraft design becomes two hand-written frontends that a reviewer cannot tell apart. Binding
authority stays `.planning/14`; this file adds the numbers §14 leaves to the design and the markup
contract both apps implement.

## 1. Derived geometry (design decisions, not new requirements)

`.planning/14` fixes the 4 px space scale, `--container: 1120px`, `--r-md: 10px` and a 240 px sidebar at
`lg`. The values below are the only deltas a developer needs:

| Token / measure | Value | Used by |
|---|---|---|
| `--header-h` | 64px | app shell header, sticky offset |
| `--sidebar-w` | 240px (fixed at `lg`), 72px icon rail at `md` | app shell |
| `--gutter` | 24px base, 32px at `md` | page padding |
| `--list-gap` | 16px (`--sp-4`) | card grid gap |
| `--thumb-w` / `--thumb-h` | 80px / 60px (4:3) | C-10 in cards and dashboard |
| `--thumb-detail` | 208px / 156px (4:3) | attachment grid on detail screens |
| `--card-min-h` | 132px task card, 148px note card | list + dashboard |
| `--focus-ring` | `0 0 0 2px var(--paper), 0 0 0 4px var(--accent)` | every focusable element |
| `--toast-w` | 360px, `position: fixed`, bottom `--sp-5`, right `--sp-5` | C-15 (never in flow → no CLS) |
| grid columns | 1 (<640), 2 (640–1279), 3 (≥1280) | task and note lists, dashboard widgets |

Card grid count is a design decision inside §14 §3's "2-column at `sm`" rule; it adds a third column
only where the container allows it and never changes the DOM order.

## 2. Token contract

1. `packages/design-tokens/tokens.css` is the only place a colour, size, radius, shadow or breakpoint
   literal appears. App CSS may not contain `#` hex values (FR-UI-009 gate: grep for `#[0-9a-f]{3,6}`).
2. Every FigCraft variable in the `Tokens` collection maps 1:1 to a CSS custom property name:
   `--paper`, `--surface`, `--surface-2`, `--ink`, `--ink-muted`, `--ink-faint`, `--line`,
   `--line-strong`, `--accent`, `--accent-hover`, `--accent-soft`, `--danger`, `--danger-soft`,
   `--warn`, `--warn-soft`, `--ok`, `--ok-soft`, `--status-todo`, `--status-progress`,
   `--status-done`, `--priority-low`, `--priority-medium`, `--priority-high`.
3. Spacing uses the `--sp-1..--sp-8` scale only; no arbitrary margins. Type uses `--fs-12..--fs-40`.
4. Both apps import the same file. A token rename is a contract change: it lands in `tokens.css`,
   `tokens.json` and both apps in one PR.

## 3. Type scale in use

| Role | Size / line-height / weight | Token |
|---|---|---|
| Landing hero | 40 / 1.2 / 600, `-0.01em` | `--fs-40`, `--lh-tight` |
| Page title (`h1`) | 32 / 1.2 / 600 | `--fs-32` |
| Section title (`h2`) | 20 / 1.2 / 600 | `--fs-20` |
| Card title | 16 / 1.3 / 600 | `--fs-16` |
| Body | 16 / 1.55 / 400 | `--fs-16`, `--lh-body` |
| Meta, labels, table headers | 14 / 1.45 / 400, `--ink-muted` | `--fs-14` |
| Badges, counters captions | 12 / 1.3 / 600 | `--fs-12` |

Body measure is capped at `--measure` (68ch) on detail views and landing prose. No uppercase labels, no
letter-spaced eyebrows, no monospace (copy deck §1).

## 4. Component markup contract

State is data-attribute driven so both apps express it identically while writing different templates.
`data-state` is the only state hook; class names never encode state.

| Component | Root markup | States |
|---|---|---|
| C-01 Button | `<button class="btn" data-variant="primary\|secondary\|ghost\|danger" data-state="default\|loading">` | `[disabled]`, `[aria-busy="true"]` keeps the label and adds a 16px spinner before it |
| C-02 IconButton | `<button class="icon-btn" aria-label="…">` | 32×32 hit area minimum, 44×44 on touch |
| C-03 TextField | `<label class="field"><span class="field__label">…</span><input class="field__input" aria-describedby="…">` + `<p class="field__error" role="alert">` | `[aria-invalid="true"]`, counter `<span class="field__count">` when max is set |
| C-04 Select | native `<select>` with the same `.field` wrapper | no custom popup (parity + perf) |
| C-05 DatePicker | native `<input type="date">` + "Clear" ghost button | empty shows `task.field.dueDate.empty` |
| C-06 Badge | `<span class="badge" data-kind="status\|priority" data-value="todo\|…">` text always present | colour from `--status-*` / `--priority-*` |
| C-08 TaskCard | `article.task-card` → `h3` title, `.task-card__meta` badges, `.task-card__due`, `.task-card__thumbs`, `.task-card__desc` (2-line clamp) | `[data-overdue]`, `[data-selected]` |
| C-09 NoteCard | `article.note-card` → `h3`, pin marker, 3-line clamp body, thumbs, updated | `[data-pinned]` |
| C-10 AttachmentThumb | `<button class="thumb" style="width/height reserved"><img width="80" height="60" alt="…">` | `[data-state="loading\|loaded\|error\|removing"]` |
| C-11 Lightbox | `div[role="dialog"][aria-modal="true"]`, focus trap, `2 of 5` counter, ← → controls | error variant shows `task.attachments.broken` |
| C-12 FileDropzone | `div.dropzone` + hidden `input[type=file][multiple]` + `ul.upload-list` progress rows | `[data-drag]`, per-file `[data-state]` |
| C-13 Modal | `role="dialog" aria-modal="true"` + scroll lock | Escape, backdrop, focus restore |
| C-14 ConfirmDialog | built on C-13, Cancel focused by default | destructive confirm uses `data-variant="danger"` |
| C-15 Toast | `role="status"` (success/info) / `role="alert"` (error), fixed region | 4 s auto-dismiss, dismiss button |
| C-16 EmptyState | icon-less by default: `h2`, one sentence, primary action | one per list, per dashboard widget |
| C-17 Skeleton | `.skeleton` blocks matching final box exactly | text-line 16/24, card `--card-min-h`, thumb 80×60 |
| C-18 ErrorState | `.error-state` inside the content region | message from `state.error.*`, retry |
| C-19 InlineError | form-level `role="alert"` above submit; field-level in C-03 | |
| C-20 Pagination | cursor: `Load more` (uses `nextCursor`) + `pagination.end` marker | one control only — the contract returns `nextCursor` and no previous cursor; never hide the marker (layout stable) |
| C-21 SearchInput | 300 ms debounce, `role="search"` landmark | `[data-state="typing\|no-results"]` |
| C-22 AppShell | `header` + `nav` + `main` + live-region outlet | `[data-state="ready\|bootstrapping"]` (Next only) |
| C-23 StatCard | value `--fs-32`, label `--fs-14`, hint `--fs-12` | `[data-state="loading"]` shows a 32px skeleton, never `0` |

Icons: **Lucide Icons** (`lucide.dev`) are the only icon source in both apps — `@lucide/astro` in
`apps/web-astro`, `lucide-react` in `apps/web-next`. Install: `pnpm add @lucide/astro` /
`pnpm add lucide-react`. They render inline SVG on `currentColor` at stroke 1.6 and are tree-shaken to
the glyphs each page imports, so both apps ship the same icon bytes and no icon font or maintained
sprite. Import one icon per use (`import ListChecks from '@lucide/astro/icons/list-checks';`), and
keep the same Lucide name for the same slot in both apps so the two renders are byte-identical.
Slot → Lucide name: task → `list-checks`, note → `sticky-note`, image → `image`, close → `x`,
menu → `menu`, wordmark → `list-checks`.

## 5. Screen → route → data → states

| Screen | Astro | Next.js | Data | Must render |
|---|---|---|---|---|
| Landing | `/` | `/b/` | none (no API call, FR-LAND-005) | hero, intro, 3 feature blocks, preview, CTA, footer; signed-in CTA swap without shift |
| Login | `/login` | `/b/login` | `POST /auth/login` | field errors, generic credential error, rate-limit notice |
| Register | `/register` | `/b/register` | `POST /auth/register` | field errors, email-taken error |
| Dashboard | `/app` | `/b/app/?view=dashboard` | `GET /dashboard` | 3 counters, 2 breakdowns + overdue, 5+5 recent, search, per-widget empty/error |
| Task list | `/tasks?…` | `/b/app/?view=tasks&…` | `GET /tasks?q&status&priority&due&hasImages&sort&limit&cursor` | filter chips, sort, cards, skeleton, empty, no-results, error, pagination |
| Task detail | `/tasks/[id]` | `/b/app/?view=tasks&id=` | `GET /tasks/:id` + attachments | all fields, attachment grid, lightbox, status control, edit/delete |
| Task edit | `/tasks/[id]/edit` | `…&mode=edit` | `PATCH /tasks/:id` | prefilled form, validation, single-submit guard, toast after redirect |
| Note list | `/notes?…` | `/b/app/?view=notes&…` | `GET /notes?q&pinned&cursor` | pinned block first, cards, empty, no-results |
| Note detail | `/notes/[id]` | `/b/app/?view=notes&id=` | `GET /notes/:id` | full body, pin toggle, attachments, lightbox |
| Account | `/account` | `/b/app/?view=account` | `GET /auth/me` | email, name, member since, read-only note, logout |
| Not found | `/404` | `/404.html` | none | `state.notFound.*` |
| Admin members (extension) | `/admin` | none — not exported | `GET /admin/members?q&role&status&cursor` | `design/09-admin-console.md` §4: table, pills, row actions, cursor footer |
| Admin member edit (extension) | `/admin/members/[id]` | none | `PATCH /admin/members/:id` | prefilled form, role/status segments, save, validation |

Every URL-encoded list state survives reload and Back/Forward in both apps (FR-TASK-014): the query key
order is fixed as `q, status, priority, due, hasImages, sort, limit, cursor` so a copied URL is stable.

## 6. Guards that protect the comparison

- Thumbnails are always the 320 px rendition; a list never requests `variant=full` (FR-ATT-004).
- Skeletons occupy final dimensions; toast and live region are fixed-position (zero CLS onset).
- Astro does not re-fetch SSR data on the client; Next.js does not adopt SSR, ISR, middleware or server
  actions to hide its bootstrap state (ADR-04, `.planning/14` §10).
- One icon set, one font stack, one spacing scale, one copy deck in both apps.

## 7. Accessibility acceptance (per screen, both apps)

`h1` once; landmarks `header`/`nav`/`main`/`footer`; every control labelled; focus ring visible on every
focusable element with `:focus-visible`; dialogs trap focus and restore it; live region announces
create/save/delete/error once; contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI borders; badges never
colour-only; `prefers-reduced-motion: reduce` removes the 150 ms transitions.

## 8. FigCraft artefact map

`design/rweb-task-management.figcraft` — see `design/02-screen-specs.md` for frame-by-frame intent and
`design/01-design-system.md` for variable/style/component ids. Page order matches the build order:
tokens → components → marketing → auth → shell/dashboard → tasks → notes → account → states/responsive.
