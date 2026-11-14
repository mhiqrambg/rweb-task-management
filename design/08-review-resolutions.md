---
document: 08-review-resolutions.md
phase: 2
stage: review reconciliation
prepared_by: design integrator
reviewed_by: design-reviewer (findings source: `04-design-review.md`)
---

# 08 — Review resolutions

`design/04-design-review.md` returned **4 blockers, 19 major, 11 minor** and the status
`not ready`. This file records what changed after that review, what is accepted as a documented
risk, and who owns what remains. It does not re-review the work.

## 1. Blockers

| ID | Resolution | Evidence |
|---|---|---|
| DR-001 copy contract broken inside the component library | **Fixed.** C-16 empty states now use deck strings (`task.empty.body`, `note.empty.body`, `task.attachments.none`, `task.noResults.title`, `task.noResults.body`, `dash.empty.tasks`, `dash.empty.tasksHint`); C-03 field errors read `Enter a title.` and the description-length message; `Todo` became `To do` in the badge (161) and the select value (109). | `node.set` on 389, 396, 402, 403, 407, 408, 414, 415, 80, 102, 161, 109 |
| DR-002 no sort control | **Fixed.** A fourth `C-04-select` (3591, 160×40) with label `Sort by` and value `Last updated` sits in the task-list filter row; `Clear` (1556) and `Has images` reflowed so nothing overlaps. | screenshot of 1414; export `05-tasks.png` |
| DR-003 detail status control broken | **Fixed.** Instance 3575 width 150 with inner input 3577 at 150 (chevron follows the layout); label 3576 visible again. Mobile control 3584 unchanged. | `get_node` 3575, screenshot 2000 |
| DR-004 not-found routed to the public 404 | **Fixed.** Diagram now has `In-app not found` (C-18 in the shell, absent = foreign id) for task/note detail, and a separate `Public 404` node reached only by an unknown public path. | `03-navigation-map.drawio` cells `notfound`, `notfound404`, `e20`; `.mmd` mirror; validator passes 15 vertices / 18 edges |

## 2. Majors addressed

| ID | Resolution |
|---|---|
| DR-029 prose claims | Fixed: `02` header now says 43 frames. The remaining caption corrections are folded into the next product-design pass; the frames, not the prose, are authoritative. |
| DR-030 no landing-preview asset | Resolved: the hero illustration ships as `design/assets/landing-illustration.svg` (+ PNG), and the product preview is drawn in the frame `product-preview` inside `l-01`, not shipped as a separate image. The earlier `landing-preview.svg` export was removed as dead weight. |
| DR-020 / DR-021 deck gaps | Partly fixed: eleven strings used by C-12 and C-19 were added to `06` §13. The frames' remaining wording (`Could not save changes.`) is now covered by `toast.error.save`; `Retry` → `Try again` is a frame edit still open. |
| DR-022 counter colour | Open, owner: design system. `184/200` stays `ink-muted` in C-03; the ≥90 % rule needs a second counter specimen. |

## 3. Accepted risks and open majors (owner: product-design wave 2)

None of these are hidden; each is a real gap against `.planning/01` §3.

| ID | Gap | Why it is still open |
|---|---|---|
| DR-005 | Task cards omit last-updated time (FR-TASK-004) | Needs a C-08 variant; card internals are a component change, not a frame fix |
| DR-006 | Pinned note card has no thumbnail strip (FR-NOTE-004) | Same: C-09 variant |
| DR-007 | No pin control on list cards (FR-NOTE-007) | Needs an icon-button slot on C-09 |
| DR-008 | Lightbox had no visible close control (FR-ATT-005) | **Fixed**: close control (32 px, `color/paper`, 16 px ×) added to `C-11` on the components board and to the screen instance in `tk-11-task-detail-lightbox`; previous/next already existed in the frame. Export: `design/exports/05b-task-lightbox.png`. |
| DR-009 | `a-03` password field no longer shows a field error | Deliberate: an empty password with `Enter your password.` contradicted the generic form error. The spec text in `02` §3 must follow the frame |
| DR-010 | `tk-03` / `tk-04` empty-state instances render ~138 px wide | Instance size overrides, quick fix for the next pass |
| DR-011 | Filters are single selects, not multi-select chips (`.planning/14` §6) | Chip component does not exist; needs a C-24 multi-select chip |
| DR-012 | Dashboard recent lists show 2 of 5 (FR-DASH-004/005) | Documented in `02` §9.9 as a fold, not a dataset; a compact row variant is the real fix |
| DR-013 | Landing footer lacks product name and login/register links (FR-LAND-006) | One text row per landing frame |
| DR-014 | Mobile landing drops the feature highlights | One block per breakpoint |
| DR-015 | Focus-visible variant is an inset stroke, not a 2 px ring + offset (AG-10) | FigCraft has no ring with offset; the ring is drawn on an outer wrapper. Needs a documented approximation |
| DR-016 | Destructive confirm does not show Cancel focused (FR-UI-007) | Add a focus ring to the Cancel instance in C-14 and tk-07 |
| DR-017 | Handoff contradicts the build (20 vs 24 px icons, line-heights, C-16 icons) | `05` is prose; it must be corrected toward `01-design-system.md` and `icons.svg` |
| DR-018 | 768 frame keeps a 240 px sidebar although `14` §3 wants a 72 px rail | C-22 has no rail variant |
| DR-019 | s-02 caption says "icon rail" at 1024 | Caption fix |
| DR-023 | Invalid textarea said `Description is required` | **Fixed** with the description-length message |
| DR-024 | Notes show absolute dates, tasks relative | One date model in `format.ts` |
| DR-025 | Note create submits `Save changes`, task create `New task` | Use `note.new` / `task.new` for create |
| DR-026 | C-16 CTAs are hand-drawn frames, not C-01 instances | Replace with instances |
| DR-027 | Mobile detail has 3 attachments all named `screenshot.png`, desktop has 4 named ones | Same data at both breakpoints |
| DR-028 | No prototype interactions (J-01..J-13) | The prototype lane was not run; the frames are static |
| DR-031 | `t-04-layout-grid` is 1504 wide | Deliberate 1440 1:1 viewport board; record as a deviation |
| DR-032 | No desktop logout affordance outside Account | Add a user menu with Log out |
| DR-033 | `End of list` marker never applied | Add to the end of the task list |
| DR-034 | Notes have no no-results state | Add a frame with `note.noResults.*` |

## 4. Status

The package is **ready for implementation of the tokens, component library and the screens that have no
open blocker**, and **not ready for a parity benchmark**: DR-005..DR-012, DR-018 and DR-028 touch
behaviour the blueprint marks MUST. Owner approval is not implied by this document.
