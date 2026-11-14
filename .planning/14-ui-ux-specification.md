---
document: 14-ui-ux-specification.md
phase: 1
stage: 4 supplement (UI/UX); ui-ux-analyst specialist was not in the live spawn roster
prepared_by: software-architect (specialist unavailable: ui-ux-analyst)
reviewed_by: none
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop, frontend-design, antislop-ui]
  selected: [backend-development, security-review]
  used: [backend-development]
  changed:
    - "backend-development: nothing in this document — no skill altered the UI content; the token/state inventory follows the brief's §9 parity requirement directly."
---

# 14 — Frontend Consistency Specification

Goal: **identical user experience, not identical source code** (brief §9). Two apps, two rendering
models, one visual language, one component inventory, one set of states. Divergence is a defect.

Rule of thumb: if the user cannot tell which app they are in from a screenshot of the same page and
data, this document is satisfied.

## 1. What is shared, what is not

| Artifact | Shared? | Form |
|---|---|---|
| Design tokens (color, type, space, radius, breakpoint) | **Yes — one file consumed by both** | `packages/design-tokens/tokens.css` + `tokens.json` |
| Copy strings (labels, errors, empty states) | **Yes** | `packages/contracts/src/copy.ts` (plain constants, no i18n layer per Q-03 default) |
| Validation messages | **Yes** | Zod messages in `packages/contracts` |
| Component *source* | **No** | Astro components in `apps/web-astro`, React components in `apps/web-next` |
| Page structure / DOM semantics | Mirrored by convention | Checked by the parity checklist §9 |
| Assets (logo, hero, favicon) | **Yes** | `assets/` |
| Date/number formatting | **Yes** | one `format.ts` in `packages/contracts` (or `lib/format` duplicated verbatim is forbidden) |

**Explicitly rejected:** wrapping Astro in React so components can be shared. It changes the Astro
app's own performance characteristics and contaminates the comparison. Rejected in ADR-12.

## 2. Design tokens

Source of truth: `packages/design-tokens/tokens.css` (CSS custom properties) and `tokens.json` (for
anything that needs JS). Both apps import the same CSS file. **No hard-coded hex values in app code.**

```css
:root {
  /* surface */
  --paper: #ffffff;      --surface: #f5f7f9;   --surface-2: #eef1f5;
  /* ink */
  --ink: #17202a;        --ink-muted: #5b6773; --ink-faint: #8a949e;
  /* lines */
  --line: #dce1e7;       --line-strong: #b9c2cc;
  /* accent (single brand hue) */
  --accent: #0b6e4f;     --accent-hover: #095a41; --accent-soft: #e6f2ed;
  /* feedback */
  --danger: #b3261e;     --danger-soft: #fbeceb;
  --warn: #b45309;       --warn-soft: #fdf3e7;
  --ok: #0b6e4f;         --ok-soft: #e6f2ed;
  /* status + priority (semantic, used for badges) */
  --status-todo: #5b6773; --status-progress: #b45309; --status-done: #0b6e4f;
  --priority-low: #5b6773; --priority-medium: #b45309; --priority-high: #b3261e;
  /* type */
  --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fs-12: 0.75rem; --fs-14: 0.875rem; --fs-16: 1rem; --fs-20: 1.25rem;
  --fs-24: 1.5rem;  --fs-32: 2rem;     --fs-40: 2.5rem;
  --lh-tight: 1.2; --lh-body: 1.55;
  /* space (4px scale) */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;
  /* radius + elevation */
  --r-sm: 6px; --r-md: 10px; --r-pill: 999px;
  --shadow-1: 0 1px 2px rgba(23,32,42,.06), 0 1px 3px rgba(23,32,42,.08);
  --shadow-2: 0 8px 24px rgba(23,32,42,.12);
  /* layout */
  --container: 1120px; --measure: 68ch;
}
```

Type scale usage: page title `--fs-32`/tight; section `--fs-20`; body `--fs-16`; card title `--fs-16`
semibold; meta `--fs-14` muted; badge `--fs-12`. Landing hero uses `--fs-40`.

Dark mode: **out of scope** (not in the brief). Do not add a theme toggle to one app only.

## 3. Layout and responsive rules

| Breakpoint | Width | Behavior |
|---|---|---|
| Base | < 640 | single column; nav collapses to a menu button + drawer; cards full width |
| `sm` | ≥ 640 | 2-column card grid |
| `md` | ≥ 768 | sidebar becomes persistent rail (icon + label), content max `--container` |
| `lg` | ≥ 1024 | app shell: fixed 240px sidebar + fluid content; task list + detail can sit side by side |
| `xl` | ≥ 1280 | content capped at `--container`, centered, extra space becomes margin |

- App shell: header (logo, page title, user menu), sidebar (Dashboard, Tasks, Notes), main.
- Landing page: hero (headline, subcopy, two CTAs), feature highlights (3 cards), product preview
  (static image from `assets/`), footer. No animation beyond a 150 ms opacity transition.
- Cards: `--surface` background, `--line` border, `--r-md`, `--sp-4` padding, `--shadow-1` on hover only.
- Do not use a CSS framework for one app only. Hand-written CSS with tokens in both.

## 4. Screen inventory

Astro serves under `/`; Next.js serves under `/b`. Route suffixes are identical so the comparison is
route-for-route honest.

| Screen | Astro route | Next.js route | Requirement areas |
|---|---|---|---|
| Landing | `/` | `/b/` | FR-LAND |
| Login | `/login` | `/b/login` | FR-AUTH |
| Register | `/register` | `/b/register` | FR-AUTH |
| Dashboard | `/app` | `/b/app/?view=dashboard` | FR-DASH |
| Task list | `/tasks` | `/b/app/?view=tasks` | FR-TASK |
| Task detail | `/tasks/[id]` (SSR) | `/b/app/?view=tasks&id=<uuid>` | FR-TASK, FR-ATT |
| Task edit (modal or page) | `/tasks/[id]/edit` | `/b/app/?view=tasks&id=<uuid>&mode=edit` | FR-TASK |
| Note list | `/notes` | `/b/app/?view=notes` | FR-NOTE |
| Note detail | `/notes/[id]` (SSR) | `/b/app/?view=notes&id=<uuid>` | FR-NOTE, FR-ATT |
| Profile (read-only + logout) | `/account` | `/b/app/?view=account` | FR-AUTH |
| Not found | `/404` | static `404.html` | FR-UI |

The Next.js depth is a **route-strategy consequence**, not a design preference — see ADR-04. The
visible UI is identical: same sidebar, same URLs' *content*, same deep-link result after hydration.
Note the honest cost: on the Next side, a deep link shows the shell skeleton first.

## 5. Component inventory (both apps implement every row)

| # | Component | States that must exist | Notes |
|---|---|---|---|
| C-01 | `Button` | default, hover, focus-visible, active, disabled, loading (spinner + label kept) | variants: primary, secondary, ghost, danger |
| C-02 | `IconButton` | as above | needs `aria-label` |
| C-03 | `TextField` / `Textarea` | default, focus, filled, invalid (+message), disabled, char counter when max set | error text `--danger`, `aria-describedby` wired |
| C-04 | `Select` (status/priority/filter) | default, open, selected, disabled | native `<select>` is acceptable and preferred for parity + perf |
| C-05 | `DatePicker` (due date) | empty, set, invalid, cleared | native `input[type=date]` acceptable |
| C-06 | `Badge` | status (3 variants), priority (3 variants) | color from tokens, text always present (never color-only) |
| C-07 | `Card` | default, hover, selected | |
| C-08 | `TaskCard` | title, badges, due date (overdue styled), up to 3 thumbnails + `+N`, description clamp 2 lines | used in list + dashboard recent |
| C-09 | `NoteCard` | title, body clamp 3 lines, pin indicator, up to 3 thumbnails + `+N`, updated date | |
| C-10 | `AttachmentThumb` | loading (reserved box), loaded, broken (fallback icon + filename), removing | fixed aspect-ratio 4:3, `--r-sm` |
| C-11 | `Lightbox` | open, loading, loaded, error, close-on-esc/backdrop | focus trap, `role="dialog"`, `aria-modal` |
| C-12 | `FileDropzone` | idle, drag-over, uploading (per-file progress), rejected (reason), complete | accepts jpeg/png/webp, ≤5 MB, ≤10 |
| C-13 | `Modal` | open, closing | focus trap, esc, scroll lock |
| C-14 | `ConfirmDialog` | default, destructive, pending | used for delete task/note/attachment, logout has none |
| C-15 | `Toast` | success, error, info | auto-dismiss 4 s, `role="status"` / `role="alert"` |
| C-16 | `EmptyState` | icon, title, one sentence, primary action | one per list and per dashboard widget |
| C-17 | `Skeleton` | text-line, card, thumbnail variants | **dimensions must equal the final element** (CLS) |
| C-18 | `ErrorState` | message + Retry | replaces content region, not the page |
| C-19 | `InlineError` | form-level and field-level | |
| C-20 | `Pagination` | next/prev only (cursor), end-of-list marker | no page numbers (cursor model) |
| C-21 | `SearchInput` | idle, typing (debounced 300 ms), no-results | |
| C-22 | `AppShell` | authenticated, skeleton-bootstrapping (Next only), unauthenticated redirect | |
| C-23 | `StatCard` | value, label, loading | dashboard totals |

## 6. Interaction contracts

| Interaction | Contract (identical in both apps) |
|---|---|
| Search | 300 ms debounce, sends `q`, resets cursor, preserves other filters; URL reflects state |
| Filter (status/priority/pinned) | multi-select chips on tasks; single toggle on notes (pinned); applied immediately |
| Create task | modal (list page) with title required ≤ 200 chars, description ≤ 5 000, priority default `medium`, status default `todo`, due date optional future-or-past allowed with warning; submit → toast + list refresh |
| Edit task | same form pre-filled; save → toast, optimistic list update allowed only if rollback on error is implemented |
| Status update | inline control on card and detail; instant PATCH; on failure revert + error toast |
| Delete | `ConfirmDialog` naming the item; on success remove row + toast with no undo (documented) |
| Upload | picker or dropzone; per-file progress; validation before request (type/size/count) and after (server error envelope mapped to field) |
| Remove attachment | icon on thumb → confirm → DELETE; thumb removed |
| Lightbox | click thumb → overlay; arrow keys navigate within the item's attachments; esc closes |
| Notes pin | single click toggle, optimistic with revert |
| Logout | menu item → POST logout → redirect to `/login` (Astro: server redirect; Next: client redirect + shell reset) |
| Session expiry mid-use | next API call returns `401` → redirect to `/login?next=<current>`; after login return to `next` (whitelisted app-internal paths only) |
| Keyboard | every action reachable; visible `:focus-visible` ring (2px `--accent`, 2px offset) |

## 7. State coverage matrix (per screen)

Every screen must implement all four; a missing state is a failed acceptance check.

| Screen | Loading | Empty | Error | Success feedback |
|---|---|---|---|---|
| Landing | n/a (static/SSR HTML) | n/a | n/a | n/a |
| Login/Register | submit spinner (button) | n/a | field + form error | redirect |
| Dashboard | stat + list skeletons | per widget ("No tasks yet" + CTA) | per widget retry | n/a |
| Task list | card skeletons (3–6) | C-16 + "New task" CTA | C-18 retry | toast on mutations |
| Task detail | detail skeleton (Astro: SSR HTML rarely shows it) | n/a | 404 state / C-18 | toast |
| Note list | card skeletons | C-16 + CTA | C-18 | toast |
| Note detail | skeleton | n/a | 404 / C-18 | toast |
| Upload area | per-file progress | "No attachments" inline | rejected file list | thumb appears + toast |

Astro note: because pages are SSR, initial content arrives in HTML; client-side mutations still need
the same optimistic/loading/error paths. Next note: the shell always shows skeletons first, so its
skeletons must be dimension-stable or CLS will (correctly) penalise it.

## 8. Accessibility baseline

- WCAG 2.2 AA intent: contrast ≥ 4.5:1 for body, ≥ 3:1 for large text and UI borders.
- Landmarks: `header`, `nav`, `main`, `footer`; one `h1` per page.
- All form fields have a visible `<label>`; errors announced via `aria-live="polite"`.
- Focus trap in modal/lightbox, focus restored to the trigger on close.
- No color-only meaning: badges carry text; overdue dates carry text + icon.
- `prefers-reduced-motion: reduce` disables transitions.
- Images need `alt`; decorative images `alt=""`.

## 9. Parity checklist (Erika's gate, per screen)

1. Same visible text content for the same data, both apps.
2. Same DOM order of primary elements (title → meta → actions → body).
3. Same breakpoint behaviour at 375/768/1440.
4. Same empty/loading/error wording (comes from `copy.ts`).
5. Same badge colors and labels for identical records.
6. Same form validation messages, field order, and required markers.
7. Same thumbnail aspect ratio, same `+N` overflow rule, same lightbox keyboard behaviour.
8. Screenshot pair attached to the PR.

## 10. Things one app must not do

- Astro must not add client-side re-fetching of data already rendered by SSR (that would fake the
  comparison and double the payload).
- Next.js must not adopt SSR/ISR/server actions, middleware, or per-request HTML to fix an auth or
  SEO problem — ADR-04 governs; escalate instead.
- Neither app may add a feature, a page, or a visual flourish the other lacks.
- Neither app may use a different icon set, font, or spacing scale.
