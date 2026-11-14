---
document: 10-landing-sections.md
phase: 2
stage: design extension (FigCraft)
status: designed; frames l-04..l-10 in `design/rweb-task-management.figcraft` page `02 Marketing`
prepared_by: design integrator
sources: ["design/02-screen-specs.md", "design/06-copy-deck.md", ".planning/01-requirements.md §3.1 (FR-LAND)", ".planning/14-ui-ux-specification.md §2-§6"]
---

# 10 — Landing page: extended sections (design)

Six sections were added to the landing page in the design file. The existing fold is untouched: header,
hero, three highlight blocks, task preview cards, CTA pair and footer identity keep their structure,
tokens and typography.

Artifact: `design/rweb-task-management.figcraft`, page `02 Marketing`.

## 1. Frames

The new sections are stacked below the existing fold so the page reads top to bottom in one column.
`l-01` stays the first viewport; its footer is the page footer for the fold, and the same footer
identity is repeated at the end of `l-09`.

| Frame | Size | File position | Content |
|---|---|---|---|
| `l-04-core-features-1440` | 1440 × 560 | (0, 1900) | h2 + subhead, three feature cards with icon wells and mini UI previews |
| `l-05-how-it-works-1440` | 1440 × 420 | (0, 2500) | h2 + subhead, three steps `01`–`03` on hairline rules |
| `l-06-task-showcase-1440` | 1440 × 700 | (0, 2960) | h2 + subhead, app panel with search, two filter chips, `New task`, three task cards |
| `l-07-notes-showcase-1440` | 1440 × 640 | (0, 3700) | h2 + body, pinned note card with three-image gallery, second note card |
| `l-08-faq-1440` | 1440 × 780 | (0, 4380) | h2 + subhead, six questions with dividers, first answer open |
| `l-09-final-cta-1440` | 1440 × 420 | (0, 5200) | CTA panel: "Everything You Need to Stay Organized.", supporting line, `Get started` + `Log in`; footer row |
| `l-10-features-375` | 375 × 1180 | (1520, 1900) | the features section at phone width |

Renders: `design/exports/11-l04-features.png`, `11-l05-how-it-works.png`,
`11-l06-task-showcase.png`, `11-l07-notes-showcase.png`, `11-l08-faq.png`,
`11-l09-final-cta.png`, `11-l10-features-375.png`.

## 2. Layout

Same grid as the fold: container 1120 at x=160, section heading 32/600, subhead 16 `ink-muted`,
section rhythm 64.

| Element | Value |
|---|---|
| Feature card | 352 × 316, radius 10, 1px `color/line`, padding 24 |
| Feature icon well | 40 × 40, radius 6, fill `color/accent-soft`, 20px stroke icon in `color/accent` |
| Feature preview | rows, note block or three 84×60 tiles, separated by a 1px top rule |
| Step | 352 wide, rule at y=200, 32px `01`–`03` chip on the rule, title 20/600, body 14 |
| App panel | 1120 × 360, radius 16, toolbar 72 on `color/surface`, panel cards 320 × 240 from `C-08` |
| Note card | 700 wide, radius 10, `Pinned` badge in `color/accent-soft`, gallery 120 × 90 |
| FAQ | 880 wide, 68px rows, 1px `color/line` dividers, `+` / `−` marks at x=1010 |
| CTA panel | 1120 × 248, radius 16, fill `color/surface`, buttons 160×44 and 120×44 |
| Mobile features | 343-wide cards, 24 padding, 20px titles |

Every fill, stroke, radius, size and space binds a `Tokens` variable; the only literals are type sizes
inside text layers that already carry the matching `type/*` style.

## 3. Copy

Feature cards: *Task management*, *Notes management*, *Image attachments* with the bodies already in
`06-copy-deck.md` §13 and the hero highlights. Steps: *Create your tasks*, *Add notes and images*,
*Track your progress*. Showcase headings: "Tasks that show their state", "Notes and images, kept
together". CTA headline and supporting line are exactly as briefed.

FAQ answers are limited to shipped behaviour: one workspace per account; ten images per record at 5 MB
each in JPEG/PNG/WebP with a larger preview; status, priority and optional due date with overdue
marking; sign-up with email plus a 12-character password; ownership checked per record with a 404 for
foreign ids. No answer promises sharing, collaboration, exports or integrations.

## 4. State and interaction notes for implementation

- FAQ: one panel open at a time; `+` becomes `−`; `aria-expanded` on the trigger, `hidden` on the panel.
- Anchor navigation targets `#features`, `#how-it-works`, `#faq`, `#register`, `#login`; the sticky
  header needs `scroll-margin-top: 80px` on each target.
- Mobile: the section stack is single column; the nav collapses into a drawer (existing `l-02` pattern).
- Buttons stay real links; nothing in the frames is a decorative control.

## 5. Verification

Every frame was exported and looked at. Two defects were found this way and fixed in place: the task
showcase cards were pasted with a page-offset (they rendered off-frame at relative y −2864) and the CTA
button labels sat 10 px left of centre. The mobile features frame was trimmed from 280 to 220 px cards
after the export showed too much dead space.

## 6. Open items

- Thumbnails in `l-06` and `l-07` are plain `color/surface-2` blocks; the image icon used on `l-04`
  could be repeated inside them for a more finished look.
- `l-02-landing-375` still shows the old fold only; the mobile versions of steps, showcases, FAQ and CTA
  are not drawn. Only the features section has a 375 frame.
- The footer appears twice (fold and CTA); in the real page it belongs once, at the end.
