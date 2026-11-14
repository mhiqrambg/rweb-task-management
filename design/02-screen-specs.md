# 02 — Screen specs

Frame-by-frame record of pages `02 Marketing` … `08 States & Responsive` in
`design/rweb-task-management.figcraft`. Authority for every visual decision stays
`.planning/14-ui-ux-specification.md`; frame names and sizes are `design/00-design-plan.md` §3.1.
Copy is `design/06-copy-deck.md` verbatim; sample records are masked, query-free workspace data.

Status: **built and inspected.** 43 screen frames across 7 pages. Pages `00 Tokens` and
`01 Components` were read only.

Common rules applied to every frame:

- Screen frame fill `color/paper`, page background `color/surface`, light theme only, no gradients.
- Chrome comes from real component instances (`C-01` … `C-23`). Nothing is redrawn; a few screens
  place fields over a `C-13` instance because the modal component has no slot.
- Every label sits above its field; every control is at least 44 px tall on mobile.
- Badges always carry text; due dates use `12 Nov 2026`; overdue uses text plus the alert icon.
- One text style per role (`type/hero`, `type/page-title`, `type/section`, `type/body`,
  `type/card-title`, `type/label`, `type/meta`, `type/badge`); no letterspacing tricks.

## 1. Frame index

| Page | Frame | Size | Frame id | Components used | States shown |
|---|---|---|---|---|---|
| 02 Marketing | `l-01-landing-1440` | 1440×900 | 756 | C-01 ×4, C-08 ×3, C-07 (card variants inside C-08) | default |
| 02 Marketing | `l-02-landing-375` | 375×812 | 820 | C-01 ×2, C-08 | default, mobile |
| 02 Marketing | `l-03-landing-signed-in-1520` | 1440×900 | 3352 | C-01 ×2, C-08 ×3 | signed-in CTA swap |
| 02 Marketing | `n-01-not-found-1440` | 1440×900 | 911 | C-01 | signed-in header, public 404 |
| 03 Auth | `a-01-login-1440` | 1440×900 | 920 | C-03 ×2, C-01 | default |
| 03 Auth | `a-02-login-375` | 375×812 | 975 | C-03 ×2, C-01 | mobile |
| 03 Auth | `a-03-login-error` | 1440×900 | 936 | C-03 filled, C-03 invalid, C-19 form, C-01 | field + form error |
| 03 Auth | `a-04-login-expired` | 1440×900 | 956 | C-19 form, C-03 ×2, C-01 | session expired notice |
| 03 Auth | `a-05-register-1440` | 1440×900 | 991 | C-03 ×2, C-01 | default |
| 03 Auth | `a-06-register-375` | 375×812 | 1007 | C-03 ×2, C-01 | mobile |
| 04 Shell | `s-01-shell-1440` | 1440×900 | 1023 | C-22 | authenticated, dashboard active |
| 04 Shell | `s-02-shell-1024` | 1024×768 | 1051 | C-22 | lg, fluid content |
| 04 Shell | `s-03-shell-768` | 768×1024 | 1079 | C-22 | md, 528 px content |
| 04 Shell | `s-04-shell-drawer-375` | 375×812 | 1107 | C-22 drawer | nav drawer open |
| 04 Shell | `d-01-dashboard-1440` | 1440×900 | 1130 | C-22, C-21, C-01, C-23 ×3, C-06 ×6, C-08 ×2, C-09 ×2 | data |
| 04 Shell | `d-02-dashboard-empty-1440` | 1440×900 | 1249 | C-22, C-23 ×3, C-16 ×2 | empty per widget |
| 04 Shell | `d-03-dashboard-375` | 375×812 | 1382 | C-21, C-23 ×3, C-06 ×3 | mobile |
| 05 Tasks | `tk-01-task-list-1440` | 1440×900 | 1414 | C-22, C-21, C-01, C-04 ×3, C-08 ×6, C-20 | list, overdue card |
| 05 Tasks | `tk-02-task-list-filters-1440` | 1440×900 | 1644 | C-22, C-04, C-08 ×2 | filters applied |
| 05 Tasks | `tk-03-task-list-empty-1440` | 1440×900 | 1785 | C-22, C-16 | empty |
| 05 Tasks | `tk-04-task-list-no-results-1440` | 1440×900 | 1932 | C-22, C-21, C-16 | no results |
| 05 Tasks | `tk-05-task-detail-1440` | 1440×900 | 2000 | C-22, C-06 ×2, C-01 ×2, C-10 ×4 | detail |
| 05 Tasks | `tk-06-task-form-modal-1440` | 1440×900 | 2172 | C-22, C-13, C-03 ×2, C-04 ×2, C-05, C-01 ×2 | create modal |
| 05 Tasks | `tk-07-task-delete-confirm` | 1440×900 | 2349 | C-22, C-14 destructive | confirm delete |
| 05 Tasks | `tk-08-task-list-375` | 375×812 | 2500 | C-21, C-01, C-08 ×2 | mobile |
| 05 Tasks | `tk-09-task-detail-375` | 375×812 | 2539 | C-06 ×2, C-10 ×3, C-01 ×2 | mobile |
| 05 Tasks | `tk-10-attachment-upload` | 1120×720 | 2570 | C-12 ×5 | idle, drag, uploading, rejected, complete |
| 05 Tasks | `tk-11-task-detail-lightbox` | 1440×900 | 2608 | C-22, C-11, C-10 ×4 | lightbox open |
| 06 Notes | `n-02-note-list-1440` | 1440×900 | 2680 | C-22, C-21, C-01, C-09 ×6 (one pinned) | pinned block first |
| 06 Notes | `n-03-note-list-empty-1440` | 1440×900 | 2865 | C-22, C-16 | empty |
| 06 Notes | `n-04-note-detail-1440` | 1440×900 | 2948 | C-22, C-01 ×2, C-10 ×3 | detail, pinned |
| 06 Notes | `n-05-note-form-modal-1440` | 1440×900 | 3050 | C-22, C-13, C-03 ×2, C-12, C-01 ×2 | create modal |
| 06 Notes | `n-06-note-list-375` | 375×812 | 3151 | C-21, C-01, C-09 ×2 | mobile |
| 06 Notes | `n-07-note-detail-375` | 375×812 | 3175 | C-10 ×3, C-01 ×2 | mobile |
| 07 Account | `ac-01-account-1440` | 1440×900 | 3204 | C-22, C-01 | read-only profile |
| 07 Account | `ac-02-account-375` | 375×812 | 3292 | C-01 | mobile |
| 08 States | `st-01-loading-matrix` | 1120×720 | 3309 | C-17 ×3, C-23 loading, C-22 skeleton | loading |
| 08 States | `st-02-empty-matrix` | 1120×660 | 3430 | C-16 ×5 | five empty states |
| 08 States | `st-03-error-matrix` | 1120×500 | 3468 | C-18 ×2, C-15 error, C-19 form | error |
| 08 States | `st-04-toast-stack` | 1120×420 | 3493 | C-15 ×3 | error, success, info |
| 08 States | `st-05-focus-specimens` | 1120×460 | 3510 | C-01, C-02, C-03, C-21 focus | focus visible |
| 08 States | `st-06-breakpoint-sweep` | 1120×1400 | 3530 | schematic widths only | 1024 / 768 / 375 |
| 08 States | `st-07-parity-checklist` | 1120×780 | 3549 | text only | PG-01..PG-08 |

## 2. Page 02 — Marketing

**`l-01-landing-1440` (756).** Header 72 px: wordmark left, `Log in` secondary and `Get started`
primary right, 1 px `color/line` rule. Hero: `brand.valueLine` at `type/hero` (40), `landing.intro`
at `type/body` in `color/ink-muted`, width 560 to hold the measure. Feature highlights: three
columns of 360 at y 344 — `Tasks`, `Notes`, `Images` (`type/section`) with the deck's one-line
descriptions (`task.empty.body`, `note.empty.body`, `task.attachments.noneHint`). Product preview:
1120×280 `color/surface-2` panel holding three `C-08` instances (`Prepare sprint review`,
`Draft Q4 roadmap`, `Book team offsite`) with `C-10`-style thumbnail glyphs and the `+2` overflow.
Closing CTA block: `Get started` + `Log in` at 44 px height. Footer: rule plus
`landing.footerBlurb`. Block order is hero → introduction → feature highlights → preview → CTA →
footer (FR-LAND-001).

**`l-02-landing-375` (820).** Same order, single column, 343 px measure, 44 px menu control in the
header (44×44 target), full-width CTAs, one preview card. Content ends at y 806; nothing crosses
the frame edge.

**`l-03-landing-signed-in-1520` (3352).** `l-01` with the CTA slot swapped to `Go to dashboard`
(44 px height, same box metrics) and the `Log in` buttons hidden, so FR-LAND-003 causes no layout
shift.

**`n-01-not-found-1440` (911).** Public header in the signed-in state (`Go to dashboard`) so the
single action `Back to dashboard` (`state.notFound.action`) is consistent with the header. Centred
block: `state.notFound.title`, `state.notFound.body`, primary action held on one line.

## 3. Page 03 — Auth

All six frames: 72 px header with the wordmark only, card 384 (desktop) or 343 (mobile) on
`color/surface`, `radius/r-md`, 1 px `color/line`, padding 32 (desktop) / 24 (mobile).

- **`a-01-login-1440` (920).** `Log in` title, `Email` and `Password` fields (filled state, masked
  password), full-width `Log in` button, `New here? Create an account` link in `color/accent`.
- **`a-02-login-375` (975).** Same card at 343 wide, fields 320.
- **`a-03-login-error` (936).** Password field in the invalid state with `Enter your password.`
  under it, `C-19` form-level alert above the button carrying `Invalid email or password.`, card
  height 452.
- **`a-04-login-expired` (956).** `Your session ended. Log in to continue.` in the `C-19` alert
  block above the fields; every other block identical to `a-01`, so the shift is measurable.
- **`a-05-register-1440` (991) / `a-06-register-375` (1007).** `Create your account` (two lines at
  32 px), `Email`, `Password` with the `12 characters or more` hint, `Create account`, and
  `Already have an account? Log in`.

## 4. Page 04 — App shell and dashboard

**`s-01-shell-1440` (1023).** `C-22` instance resized to 1440×900 with header 1440, sidebar 240×836,
main 1200×836; dashboard nav item active (`color/accent-soft`, accent icon and label). This is the
authority for shell geometry with the page title `Dashboard`.

**`s-02-shell-1024` (1051).** Shell at 1024×768: sidebar 240×704, main 784×704.

**`s-03-shell-768` (1079).** Shell at 768×1024: sidebar 240×960, main 528×960, second demo card
hidden so the row fits. See deviations — the rail variant is not modelled by the component.

**`s-04-shell-drawer-375` (1107).** `C-22-app-shell-drawer` grown to 375×812: page content, 45 %
ink backdrop, drawer 240×812 holding the same three nav items in order plus Account and Log out.

**`d-01-dashboard-1440` (1130).** Content region 1200×836 at (240,64), inner container 1120.
Row 1: `Dashboard` title, `C-21` search, `New task`. Row 2: three `C-23` stat cards — **Total tasks
9**, **Active 6**, **Completed 3**, each with the deck's hint. Row 3: three columns of 360 —
breakdowns (`By status` To do 4 / In progress 2 / Completed 3; `By priority` Low 3 / Medium 4 /
High 2; `Overdue` **2** in `color/danger` with `Past due, not completed`) and two recent lists
(`Recently updated tasks` with 2 `C-08`, `Recently updated notes` with 2 `C-09`, each with
`View all`). Numbers reconcile: 4 + 2 + 3 = 9, 4 + 2 = 6 active, 3 + 4 + 2 = 9 priorities.

**`d-02-dashboard-empty-1440` (1249).** Same grid, every counter `0`, breakdown rows `0`, and the
two list slots replaced by `C-16` no-tasks and no-notes with the deck's body strings and their
create actions. No `0` is shown inside a skeleton.

**`d-03-dashboard-375` (1382).** Header with brand and 44 px menu control, `Dashboard` title,
`C-21` 343 wide, three stacked `C-23` (9 / 6 / 3), then the `By status` panel. Remaining widgets
continue below the fold.

## 5. Page 05 — Tasks

**`tk-01-task-list-1440` (1414).** `Tasks` title, `C-21` search, `New task`, filter row of three
`C-04` selects (`Status`, `Priority`, `Due` — `All`, `All`, `Any date`), a `Has images` secondary
and a `Clear` ghost button. Six `C-08` cards in a 3 × 320 grid with 20 px gutters:
`Prepare sprint review` (In progress / High, 12 Nov 2026), `Draft Q4 roadmap` (To do / Low),
`Book team offsite` (Completed / Medium), `Renew domain certificate` (overdue variant, To do / High,
`Overdue · 12 Nov 2026` in `color/danger`), `Write onboarding checklist` (In progress / Medium),
`Archive old receipts` (Completed / Low). `C-20` `Load more` closes the list; no Previous.

**`tk-02-task-list-filters-1440` (1644).** Same chrome with `Status` = `In progress`, only the two
matching cards, and `Filters applied` in `color/ink-muted` under the filter row.

**`tk-03-task-list-empty-1440` (1785).** No cards; `C-16` no-tasks in the content region with
`New task`.

**`tk-04-task-list-no-results-1440` (1932).** Search shows the typed query `sprint` in `color/ink`,
`Status` = `Completed`, and `C-16` no-results with the deck's title, body and `Clear filters`.

**`tk-05-task-detail-1440` (2000).** Title, `In progress` and `High` badges, `12 Nov 2026`, `Edit`
(secondary) and `Delete` (danger) at the top right, description at 720, divider, `Images` with four
`C-10` thumbnails and filenames, the upload hint, divider and `Updated 3 hours ago`.

**`tk-06-task-form-modal-1440` (2172).** 40 % ink backdrop over the list; `C-13` instance at
560×700 with its body and footer hidden; `Title`, `Description` (textarea), `Status` (`To do`),
`Priority` (`Medium`), `Due date` (`No due date`) placed inside it; `Cancel` secondary and
`New task` primary at 44 px. Field order matches the copy deck order in §6.

**`tk-07-task-delete-confirm` (2349).** Backdrop plus `C-14` destructive: `Delete this task?`,
`“Prepare sprint review” and its images will be deleted. This cannot be undone.`, `Cancel` and
`Delete`.

**`tk-08-task-list-375` (2500).** Header, title, 343 search, full-width `New task`, two cards.

**`tk-09-task-detail-375` (2539).** Title, badges, due date, description, `Images` with three
thumbnails, hint, divider, `Edit` and `Delete` side by side at 160 each.

**`tk-10-attachment-upload` (2570).** Specimen board: five `C-12` states — idle (`Drag images here,
or choose files` plus the JPEG/5 MB/10-per-task hint), drag over, uploading with per-file progress,
rejected with the reason per file, complete. One line of the note states the one-request-per-file
contract.

**`tk-11-task-detail-lightbox` (2608).** Detail screen under a 55 % ink backdrop, `C-11` open with
`2 of 4 · 1600 × 1200 · 240 KB`, and 44 px previous / next controls using arrow vectors.

## 6. Page 06 — Notes

**`n-02-note-list-1440` (2680).** `Notes`, `C-21` with `Search notes`, `New note`, a `Pinned`
label and the pinned `C-09` (`Sprint review notes`) above a 3 × 320 grid of five notes
(`Venue shortlist`, `Reading list`, `Weekly review template`, `Interview questions`, `Plumbing
quotes`) with updated dates. Cards without images hide the thumbnail row.

**`n-03-note-list-empty-1440` (2865).** `C-16` no-notes with `note.empty.body` and `New note`.

**`n-04-note-detail-1440` (2948).** Title, pin marker (`Pinned`, accent pin vector), `Edit` and
`Delete`, two body paragraphs at 720, divider, `Images` with three thumbnails, `Updated 12 Nov
2026`, and `Unpin note` (pin is never inside the edit form).

**`n-05-note-form-modal-1440` (3050).** `C-13` at 560×640 over a 40 % backdrop: `Title`, `Body`
textarea, `C-12` idle dropzone, `Cancel` and `Save changes`.

**`n-06-note-list-375` (3151).** Header, title, search, `New note`, pinned card then one card.

**`n-07-note-detail-375` (3175).** Title, pin marker, two paragraphs, divider, `Images` with three
thumbnails, `Updated 12 Nov 2026`, `Edit` and `Delete`.

## 7. Page 07 — Account

**`ac-01-account-1440` (3204).** `Account` title and a 560×360 panel on `color/paper`: `Email`
(`erika@example.com`), `Name` (`Erika Nord`), `Member since` (`12 Nov 2026`), a divider, the
read-only note `Email and password changes are not available in this build.` and a `Log out`
secondary button. No inline editing (G-10).

**`ac-02-account-375` (3292).** The same panel at 343 wide, 24 px padding.

## 8. Page 08 — States and responsive

- **`st-01-loading-matrix` (3309).** `Text line`, `Card`, `Thumbnail` skeletons in a row, a `C-23`
  loading stat card (32 px value skeleton, never `0`) and the `C-22` skeleton shell at 660×320.
- **`st-02-empty-matrix` (3430).** Five distinct empties: no tasks, no notes, no images, no
  results, no recent items, each with its deck title, body and action.
- **`st-03-error-matrix` (3468).** Two `C-18` blocks (`Could not load tasks`, `That did not load`)
  with `Check your connection and try again.` and `Try again`, the error toast, and the form-level
  `C-19` alert.
- **`st-04-toast-stack` (3493).** Error (`role=alert`, newest on top), success (`Task created`) and
  info (`Note pinned`) at 360 wide.
- **`st-05-focus-specimens` (3510).** Focus-visible ring on the primary button and the icon button,
  focus field and search; one caption states the 2 px accent ring at 2 px offset, 44 × 44 targets,
  and that `prefers-reduced-motion: reduce` removes the 150 ms transitions.
- **`st-06-breakpoint-sweep` (3530).** 1024, 768 and 375 outlined to scale with header, sidebar and
  content blocks; 1440 is referenced to `s-01` / `d-01` rather than duplicated.
- **`st-07-parity-checklist` (3549).** PG-01 … PG-08 rendered as gate id, assertion and method, the
  design-side counterpart of the runtime checklist.

## 9. Deviations and open items

1. **`l-03` frame name** keeps `-1520` from §3.1 while its size is 1440×900, as the plan lists it.
2. **Landing feature copy** has no deck key; the three highlights reuse `task.empty.body`,
   `note.empty.body` and `task.attachments.noneHint`. The hero headline reuses `brand.valueLine`
   and the paragraph reuses `landing.intro` for the same reason.
3. **404 header state.** `n-01` uses the signed-in header (`Go to dashboard`) so the single action
   `Back to dashboard` matches the header; a signed-out 404 would need a home-label copy key that
   the deck does not have.
4. **`s-03-shell-768`** keeps the 240 px sidebar. `C-22` has no 72 px rail variant, and instance
   children cannot take a new position, so the rail would require editing the component.
5. **Modal fields are placed over the `C-13` instance**, not inside it: `C-13` has no slot and an
   instance cannot accept new children. The dialog still supplies surface, radius, title and the
   drop shadow; the footer is hidden in favour of `C-01` instances at the same 44 px height.
6. **`+N` overflow on preview cards** keeps the component's fixed `+2` text; the card grid does not
   recompute it per screen.
7. **`tk-10` height** is 720, not auto-hugging, because the plan's `auto` cannot be expressed for a
   frame that also hosts five fixed-height specimens.
8. **`st-06` is schematic**: real 1024/768/375 widths with block outlines, not four rendered
   screens; the 1440 rendering lives in `s-01` and `d-01`.
9. **Dashboard recent widgets.** `d-01` shows the first two cards of each recent list. FR-DASH-004/005
   require 5 items each; the widget is a scroll region inside a 900 px frame, so the static frame
   cannot show all five without shrinking the cards below the thumbnail/minimum-height contract. The
   implementation renders 5 items and lets the widget scroll; the frame is the fold, not the dataset.
   If the reviewer treats the fold as a defect, the fix is a compact-row variant of C-08/C-09, not a
   taller frame.

## 10. Integrator fixes after the screen wave (2026-11-15)

The screen wave closed the frames but exited before final verification. These corrections were then
applied in the same file and verified by screenshot:

| Frame | Defect | Fix |
|---|---|---|
| `tk-05-task-detail-1440` (2000) | no inline status control (FR-TASK-007) and a duplicated status badge | C-04-select instance added top-right before Edit (node 3575, 150×40, label hidden, value `In progress`); status badge 2141 hidden |
| `tk-09-task-detail-375` (2539) | same gap; the priority badge collided with the new control | C-04-select instance 3584 (145×40) replaces the status badge 2545; priority badge moved to x=170, due date to x=246 |
| `a-03-login-error` (936) | password field showed `Enter your password` while the form error said `Invalid email or password` — contradictory for an empty password | field error 949 hidden; password border 947 re-bound to `color/ink-faint` at 1 px so it reads as an empty field with the generic message |
| `ac-01-account-1440` (page 747) | `Notes` was marked as the current nav item on the Account screen | nav item 3220 highlight removed, icon 3221 and label 3222 re-bound to `color/ink-muted` |
| `s-01..s-04` shells | partial dashboard content read as an unfinished screen | one-line caption added per frame stating shell geometry and the content region (nodes 3580-3583) |
| `C-04-select` (main 106) and its variants 111/123/128 | chevron rendered as `^` in every select (rotation 90 on a right-pointing path) | chevron vectors 110/115/127/132 set to rotation 270, so all instances point down |
| `tk-06-task-form-modal-1440` (2172) | submit button was the `state=loading` primary variant, showing a spinner on a static form | instance 2346 replaced by a `state=default` primary (3589, 150×44) with the label `New task` |

Export: nine page PNGs at 1× in `design/exports/` (00-tokens … 08-states-responsive).
