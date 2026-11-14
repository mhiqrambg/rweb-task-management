---
document: 01-design-system.md
phase: 2
stage: design system
prepared_by: design integrator (consolidates the Wave 1 build by design-system-engineer)
reviewed_by: design-reviewer (see 04-design-review.md)
sources: [".planning/14-ui-ux-specification.md §2, §5, §8", "design/00-design-plan.md §5-§6", "design/rweb-task-management.figcraft"]
---

# 01 — Design system

One token set, one component library, consumed by both frontends. FigCraft is the editable source;
`packages/design-tokens` is the shipped source. The mapping below is 1:1 by name.

Artifact: `design/rweb-task-management.figcraft`, pages `00 Tokens` (id 1) and `01 Components` (id 2).

## 1. Variables

Collection `Tokens`, single mode **Light** (no dark mode: `.planning/14` §2, A-20 scope). 45 variables,
values verified one by one against `.planning/14` §2.

| Group | Variables | Values |
|---|---|---|
| Surface | `color/paper`, `color/surface`, `color/surface-2` | `#FFFFFF`, `#F5F7F9`, `#EEF1F5` |
| Ink | `color/ink`, `color/ink-muted`, `color/ink-faint` | `#17202A`, `#5B6773`, `#8A949E` |
| Lines | `color/line`, `color/line-strong` | `#DCE1E7`, `#B9C2CC` |
| Accent | `color/accent`, `color/accent-hover`, `color/accent-soft` | `#0B6E4F`, `#095A41`, `#E6F2ED` |
| Feedback | `color/danger`, `color/danger-soft`, `color/warn`, `color/warn-soft`, `color/ok`, `color/ok-soft` | `#B3261E`, `#FBECEB`, `#B45309`, `#FDF3E7`, `#0B6E4F`, `#E6F2ED` |
| Status | `color/status-todo`, `color/status-progress`, `color/status-done` | `#5B6773`, `#B45309`, `#0B6E4F` |
| Priority | `color/priority-low`, `color/priority-medium`, `color/priority-high` | `#5B6773`, `#B45309`, `#B3261E` |
| Space | `space/sp-1` … `space/sp-8` | 4, 8, 12, 16, 24, 32, 48, 64 |
| Radius | `radius/r-sm`, `radius/r-md`, `radius/r-pill` | 6, 10, 999 |
| Type size | `font/fs-12`, `14`, `16`, `20`, `24`, `32`, `40` | 12…40 |
| Line height | `font/lh-tight`, `font/lh-body` | 1.2, 1.55 (ratios; see §2 deviation) |
| Layout | `layout/container`, `layout/measure` | 1120, 68 |

Binding rule: every fill, stroke, radius, gap, padding and font size on both pages is bound to a token.
The only literals are the page backgrounds, the two effect-style `rgba()` shadows, and the hex labels on
`t-01-color-board` (they are documentation, not paint).

## 2. Type styles

Nine text styles (S:1-S:9) and two effect styles (S:10-S:11). Family is the system UI stack; FigCraft
reports it as `System Font` — never Inter, never a webfont (payload parity).

| Style | Size | Line height | Weight | Token bindings |
|---|---|---|---|---|
| `type/hero` | 40 | 48 | 600 | `font/fs-40`, `color/ink` |
| `type/page-title` | 32 | 38.4 | 600 | `font/fs-32`, `color/ink` |
| `type/section` | 20 | 24 | 600 | `font/fs-20`, `color/ink` |
| `type/body` | 16 | 24.8 | 400 | `font/fs-16`, `color/ink` |
| `type/card-title` | 16 | 19.2 | 600 | `font/fs-16`, `color/ink` |
| `type/label` | 14 | 16.8 | 500 | `font/fs-14`, `color/ink` |
| `type/meta` | 14 | 16.8 | 400 | `font/fs-14`, `color/ink-muted` |
| `type/badge` | 12 | 14.4 | 600 | `font/fs-12`, status/priority token |
| `type/button` | 16 | 19.2 | 500 | `font/fs-16`, `color/paper` or `color/ink` |

`effect/shadow-1` = `0 1 2 rgba(23,32,42,.06)` + `0 1 3 rgba(23,32,42,.08)`; `effect/shadow-2` =
`0 8 24 rgba(23,32,42,.12)`. Shadow-1 appears on hover cards only; shadow-2 on modals and the lightbox.

**Accepted deviation (recorded, not silent):** FigCraft's line height is px-only, so the ratio variables
`font/lh-*` cannot be bound to text without collapsing the line box to 1.55 px. Line heights above are
the px equivalents the implementation expresses as `line-height: 1.2` / `1.55`. `fontSize` is bound
everywhere.

## 3. Component library

23 families, **98 state specimens**, all on page `01 Components`. Four are native variant sets; the other
19 are main components with one main per state (FigCraft variant values cannot carry spaces).

| ID | Family | FigCraft | States built |
|---|---|---|---|
| C-01 | `C-01-button` (section 5) | set **38**, 15 variants | primary: default/hover/focus-visible/active/disabled/loading · secondary: default/hover/disabled · ghost: default/hover/disabled · danger: default/hover/disabled |
| C-02 | `C-02-icon-button` (40) | set **61**, 9 | ghost: default/hover/focus-visible/active/disabled/loading · secondary: default/hover/disabled |
| C-03 | `C-03-text-field` (62) | set **103**, 9 | text field: default/focus/filled/invalid+message/disabled/counter · textarea: default/filled/invalid |
| C-04 | `C-04-select` (104) | mains 106/111/123/128 | default, open, selected, disabled |
| C-05 | `C-05-date-picker` (133) | mains 135/140/145/151 | empty, set, invalid, cleared |
| C-06 | `C-06-badge` (158) | set **172**, 6 | status todo/in-progress/completed · priority low/medium/high |
| C-07 | `C-07-card` (173) | mains 175/178/181 | default, hover, selected |
| C-08 | `C-08-task-card` (184) | mains 186/200/214/228 | default, overdue, 3 thumbs + `+2`, selected |
| C-09 | `C-09-note-card` (239) | mains 241/248/254 | default, pinned, hover |
| C-10 | `C-10-attachment-thumb` (258) | mains 260/263/267/271 | loading (4:3 reserved), loaded, broken, removing |
| C-11 | `C-11-lightbox` (275) | mains 277/280/284 | open-loading, open-loaded, open-error |
| C-12 | `C-12-file-dropzone` (289) | mains 291/295/299/312/318 | idle, drag-over, uploading (+per-file progress), rejected, complete |
| C-13 | `C-13-modal` (322) | mains 324/332 | open, closing |
| C-14 | `C-14-confirm-dialog` (340) | mains 342/350/360 | default, destructive, pending |
| C-15 | `C-15-toast` (369) | mains 371/375/379 | success, error, info |
| C-16 | `C-16-empty-state` (383) | mains 385/392/399/404/411 | no-tasks, no-notes, no-attachments, no-results, no-recent |
| C-17 | `C-17-skeleton` (416) | mains 418/419/423 | text-line, card, thumbnail |
| C-18 | `C-18-error-state` (424) | main 426 | message + Retry |
| C-19 | `C-19-inline-error` (432) | mains 434/437 | field-level, form-level |
| C-20 | `C-20-pagination` (440) | mains 442/444 | next (Load more), end-of-list |
| C-21 | `C-21-search-input` (448) | mains 450/453/457 | idle, typing, no-results |
| C-22 | `C-22-app-shell` (472) | mains 474/501/519 | authenticated, skeleton-bootstrapping, drawer open |
| C-23 | `C-23-stat-card` (463) | mains 465/469 | value, loading |

Every state in `.planning/14` §5 is represented. Composites are auto-layout frames built from tokens;
Wave 2 composes screens from instances, not copies.

## 4. Geometry

Fixed by the design system and reused by both apps:

| Element | Height | Notes |
|---|---|---|
| Button (all variants) | 40 | 12 px horizontal padding at `space/sp-3`, arrow-free labels |
| Icon button | 32 visual / 44 target | focus ring outside the 32 box |
| Text field, select, date | 40 | border 1 px `color/ink-faint`, radius `r-sm`, padding `sp-3` |
| Badge | 24 | radius `r-pill`, padding 0 12, text 12/600 |
| Card | min 132 (task) / 148 (note) | radius `r-md`, border `color/line`, fill `color/paper`, padding `sp-4` |
| Thumb (card) | 80×60 | 4:3, radius `r-sm` |
| Thumb (detail) | 208×156 | 4:3 |
| Header | 64 | |
| Sidebar | 240 (lg) / 72 rail (md) | |
| Container | 1120 | centred, gutter 24/32 |
| Toast | 360 wide, fixed bottom-right | 3 max stacked, never in flow |
| Focus ring | 2 px `color/accent` + 2 px offset | on every focusable element |

## 5. Accessibility evidence

Computed with the WCAG 2.2 relative-luminance formula on the token values (not estimated):

| Pair | Ratio | Verdict |
|---|---|---|
| `ink` on `paper` | 16.45:1 | AA/AAA text |
| `ink-muted` on `paper` / `surface` | 5.78:1 / 5.38:1 | AA |
| `ink-faint` on `paper` | 3.08:1 | decorative icons, disabled text, control borders only |
| `accent` on `paper` | 6.25:1 | links, focus ring |
| white on `accent` / `accent-hover` | 6.25:1 / 8.23:1 | primary button |
| white on `danger` | 6.54:1 | destructive confirm |
| `status-todo` on `surface-2` | 5.10:1 | badge |
| `status-progress` on `warn-soft` | 4.58:1 | badge |
| `status-done` on `ok-soft` | 5.45:1 | badge |
| `priority-low` / `medium` / `high` badges | 5.10 / 4.58 / 5.70 | AA |
| `line` / `line-strong` on `paper` | 1.32:1 / 1.80:1 | dividers only — never the sole boundary of a control |

## 6. Implementation mapping

| FigCraft | Shipped |
|---|---|
| Collection `Tokens`, mode Light | `packages/design-tokens/tokens.css`: `:root { --color-… }` — the same names with `/` → `-` (`color/ink-muted` → `--color-ink-muted`; prose shorthand in docs uses `--ink-muted`) |
| Text styles `type/*` | `--fs-*` / `--lh-*` plus per-role weight and colour; no separate CSS class per style |
| `effect/shadow-1`, `effect/shadow-2` | `--shadow-1`, `--shadow-2` |
| `space/*`, `radius/*` | `--sp-1..8`, `--r-sm/md/pill` |
| `layout/container`, `layout/measure` | `--container: 1120px`, `--measure: 68ch` |
| Component states | `data-state` attributes (`design/05-implementation-handoff.md` §4) |

Rule: a rename lands in the FigCraft variable, `tokens.css`, `tokens.json` and both apps in one change.
No app may introduce a colour, size or radius outside this table.
