# DESIGN.md

The visual and interaction system for both frontends. Two apps, one appearance. This file is the working
reference for anyone building UI; the authorities are `.planning/14-ui-ux-specification.md` (spec) and
`design/rweb-task-management.figcraft` (source of truth for pixels).

If code and this file disagree, the code is the defect — unless this file disagrees with `.planning/14`,
in which case this file is the defect.

## 1. Where the design lives

| Artifact | Path |
|---|---|
| Editable design file (tokens, components, screens) | `design/rweb-task-management.figcraft` |
| Design system reference (ids, states, contrast) | `design/01-design-system.md` |
| Screen-by-screen record | `design/02-screen-specs.md` |
| Copy deck (every string) | `design/06-copy-deck.md` |
| Parity + state gate | `design/07-parity-checklist.md` |
| Landing page sections | `design/10-landing-sections.md` |
| Admin console (extension, approval pending) | `design/09-admin-console.md` |
| Icon sprite | `design/icons/icons.svg` |
| Renders for review | `design/exports/*.png` |
| Tokens shipped to code (Phase 3 target) | `packages/design-tokens/tokens.css`, `tokens.json` |

Work through the FigCraft MCP: `get_node` / `inspect_document` to read, `run_command` to write,
`screenshot` to verify, `file.export` for PNGs, `file.save` to persist. Never edit frames by hand
elsewhere and import them.

## 2. Character

A quiet, precise personal workspace. Light paper, dark ink, one green accent used where an action
matters. Structure comes from alignment, rules, and spacing — not from decoration. It should read like a
tool someone uses daily, not a launch page.

- Light theme only. No dark mode, no theme toggle.
- No gradients, no glass, no glows, no background patterns.
- One accent colour. If everything is green, nothing is.
- Shadows mark elevation only: hovered cards, dialogs. Everything else sits flat.
- Sentence case everywhere. No uppercase labels, no letter-spaced eyebrows.

## 3. Colour

Single `Light` mode. All values are variables; apps reference `var(--color-*)`, never a hex.

| Token | Hex | Use |
|---|---|---|
| `color/paper` | `#FFFFFF` | page and card surface |
| `color/surface` | `#F5F7F9` | page background behind cards, section bands |
| `color/surface-2` | `#EEF1F5` | inert fills: secondary button, thumbnails, previews |
| `color/ink` | `#17202A` | primary text |
| `color/ink-muted` | `#5B6773` | secondary text, meta, labels |
| `color/ink-faint` | `#8A949E` | control borders, disabled text, decorative glyphs only |
| `color/line` | `#DCE1E7` | dividers, card borders |
| `color/line-strong` | `#B9C2CC` | secondary-button border, emphasised rules |
| `color/accent` | `#0B6E4F` | primary action, focus ring, links |
| `color/accent-hover` | `#095A41` | primary hover |
| `color/accent-soft` | `#E6F2ED` | selected nav, pinned badge, icon wells |
| `color/danger` / `-soft` | `#B3261E` / `#FBECEB` | destructive action, overdue, disabled account |
| `color/warn` / `-soft` | `#B45309` / `#FDF3E7` | in-progress status, medium priority |
| `color/ok` / `-soft` | `#0B6E4F` / `#E6F2ED` | completed status, active account |

Contrast (computed, WCAG 2.2): ink/paper 16.45:1 · ink-muted/paper 5.78:1 · accent/paper 6.25:1 ·
white/accent 6.25:1 · white/danger 6.54:1 · badge pairs 4.58–5.70:1 · ink-faint/paper 3.08:1
(borders and disabled text only — never body copy).

Status and priority are words first, colours second: `To do` · `In progress` · `Completed`,
`Low` · `Medium` · `High`. A dot alone NEVER carries the state.

## 4. Type

Family: `system-ui` stack in both apps — no webfont, no download, no FOUT. Weights 400 / 500 / 600 only.

| Role | Size | Line height | Weight | Token |
|---|---|---|---|---|
| Hero (landing only) | 40 | 1.2 | 600 | `font/fs-40` |
| Page title `h1` | 32 | 1.2 | 600 | `font/fs-32` |
| Section title `h2` | 20 | 1.2 | 600 | `font/fs-20` |
| Card title | 16 | 1.3 | 600 | `font/fs-16` |
| Body | 16 | 1.55 | 400 | `font/fs-16` |
| Label / meta | 14 | 1.45 | 400–500 | `font/fs-14` |
| Badge / caption | 12 | 1.3 | 600 | `font/fs-12` |

Body measure ≤ 68 characters on detail views and long prose. No all-caps, no tracking tricks, no
monospace (this is not a developer tool).

## 5. Space, radius, elevation, layout

- Space scale (px): 4, 8, 12, 16, 24, 32, 48, 64 — `--sp-1…--sp-8`. No arbitrary margins.
- Radius: `r-sm 6` (controls), `r-md 10` (cards), `r-lg 16` (panels, dialogs), `r-pill 999` (badges,
  chips). Never one radius everywhere.
- Elevation: `shadow-1` hover cards, `shadow-2` dialogs. Nothing else.
- Container 1120 px, gutter 24 (32 from 768). App shell: header 64, sidebar 240 (72 icon rail at 768-1023).
- Section rhythm 64 px top and bottom; heading block max 720 px wide.
- Breakpoints: `<560` phone, `560-767` large phone, `768-1023` tablet/rail, `1024-1279` laptop,
  `≥1280` desktop. Test 375, 768, 1024, 1440.

## 6. Components

23 families in the design file (`01 Components`), all built from tokens. Instance them; never redraw.

| ID | Component | Height | States |
|---|---|---|---|
| C-01 | Button (primary / secondary / ghost / danger) | 40 | default, hover, focus-visible, active, disabled, loading |
| C-02 | Icon button | 32 visual / 44 target | default, hover, focus, disabled |
| C-03 | Text field / textarea | 40 | default, focus, filled, invalid + message, disabled, counter |
| C-04 | Select | 40 | default, open, selected, disabled |
| C-05 | Date field | 40 | empty, set, invalid, cleared |
| C-06 | Badge (status, priority) | 24 | 6 values, text always present |
| C-07 | Card | — | default, hover, selected |
| C-08 | Task card | min 132 | default, overdue, with thumbnails + overflow, selected |
| C-09 | Note card | min 148 | default, pinned, hover |
| C-10 | Attachment thumbnail | 80×60 (208×156 detail) | loading, loaded, broken, removing |
| C-11 | Lightbox | full | loading, loaded, error; `2 of 5`, arrows, close, Escape |
| C-12 | Upload dropzone | — | idle, drag-over, uploading, rejected, complete |
| C-13 | Modal | — | open, closing; focus trap |
| C-14 | Confirm dialog | — | default (Cancel focused), destructive, pending |
| C-15 | Toast | — | success, error, info; fixed, max 3 |
| C-16 | Empty state | — | no records, no results, no attachments, no recent |
| C-17 | Skeleton | matches final box | text, card, thumbnail |
| C-18 | Error state | — | message + retry |
| C-19 | Inline error | — | field-level, form-level |
| C-20 | Pagination | — | `Load more` + end-of-list (cursor only) |
| C-21 | Search input | 40 | idle, typing (300 ms debounce), no-results |
| C-22 | App shell | 1440×900 desktop | authenticated, bootstrapping (Next only), drawer |
| C-23 | Stat card | 120 | value, loading |

Geometry that never changes: controls 40 high, badges 24, card padding 16, thumbnail 4:3, focus ring
2 px accent + 2 px offset, toast 360 wide fixed bottom-right.

## 7. Screens

| Screen | Astro | Next.js | States required |
|---|---|---|---|
| Landing | `/` | `/b/` | — (no data), signed-in CTA variant |
| Login | `/login` | `/b/login` | field error, generic error, rate limit, redirect |
| Register | `/register` | `/b/register` | field error, email-taken, redirect |
| Dashboard | `/app` | `/b/app/?view=dashboard` | skeleton, per-widget empty, per-widget error |
| Task list | `/tasks?q&status&priority&due&hasImages&sort&cursor` | `/b/app/?view=tasks&…` | skeleton, empty, no-results, error, toast |
| Task detail | `/tasks/[id]` | `/b/app/?view=tasks&id=` | 404 for foreign id, lightbox, inline status change |
| Task form | modal on `/tasks` (create), `/tasks/[id]/edit` (edit) | `…&mode=edit` | validation, single-submit guard |
| Note list | `/notes?q&pinned&cursor` | `/b/app/?view=notes&…` | skeleton, empty, no-results, error |
| Note detail | `/notes/[id]` | `/b/app/?view=notes&id=` | 404, pin toggle, gallery |
| Note form | modal on `/notes` (create and edit) | `…&view=notes` + modal | validation, single-submit guard |
| Account | `/account` | `/b/app/?view=account` | loading, error, logout |
| Not found | `/404` | `/404.html` | public + in-app variant |
| Admin (extension) | `/admin` | not exported | table, pills, row actions, form, confirm |

Landing sections and the admin console are specified in `design/10-landing-sections.md` and
`design/09-admin-console.md`.

## 8. Copy

`design/06-copy-deck.md` is the only source of UI strings; in code they live in
`packages/contracts/src/copy.ts`. Voice: plain, active, specific. An action keeps its name through the
flow (`Delete task` → `Task deleted`). Errors name the cause and the next step, never a status code.
Empty states say why the screen is empty and the one action that fills it. No emoji, no exclamation
marks, no marketing superlatives.

## 9. Iconography and illustration

- One hand-authored 20 px stroke set (`design/icons/icons.svg`, 24 viewBox, 1.6 stroke). No icon library:
  a library is a payload difference between the apps and a borrowed look.
- Icons label or afford; they never decorate. No icons on every button.
- The landing hero uses one illustration (`design/assets/landing-illustration.png`, exported from
  `landing-illustration.svg`): a task card with an image strip and a note behind it. Same palette as the
  UI. No stock photos, no 3D blobs, no generic character art.
- Thumbnails in mocks are `surface-2` placeholders with the image glyph; real screens show real images.

## 10. Motion

Answers an action, never runs on a loop. 150-200 ms, `ease` out. Hover changes colour or elevation;
dialogs fade in; toasts slide in from the bottom-right. `prefers-reduced-motion: reduce` removes all of
it. No parallax, no scroll-triggered sequences, no pulsing dots.

## 11. Accessibility (non-negotiable)

WCAG 2.2 AA. One `h1`; landmarks `header`/`nav`/`main`/`footer`; every control labelled; focus visible
on everything focusable; dialogs trap and restore focus; live regions announce create/save/delete/error
once; 44 px touch targets; status never colour-only; text reflows at 375 px with no horizontal scroll.

## 12. Changing the design

1. Change the FigCraft variable/component, not a single frame, when the change is systemic.
2. Rename a token by touching `Tokens`, `tokens.css`, `tokens.json` and both apps in one change.
3. Re-export affected frames to `design/exports/` and add them to the PR.
4. Update `design/01`, `design/02`, this file, or `.planning/14` when a measurement or rule changes.
5. Run `design/07-parity-checklist.md` against both apps for anything user-visible.

## 13. Do not

- Do not invent a screen, section, or state that the blueprint does not describe.
- Do not add a second accent, a gradient, a webfont, a component library, or a dark theme.
- Do not put sample records into the Next.js static output.
- Do not use colour, size, or spacing values outside the token set.
- Do not decorate: no left-edge colour stripes, no emoji, no badges that mark nothing, no arrows on every
  button, no hero pill repeating the headline.
