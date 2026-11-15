# 00 — Phase 2 Design Plan

Status: **Proposed for owner approval.** Derived from the approved Phase 1 blueprint; no requirement is
added, removed or reworded here. Where the blueprint is silent, the resolution is marked
`[DESIGN DECISION]` and stays inside the blueprint's rules.

Authority order: `.planning/14-ui-ux-specification.md` (visual/spec authority) → `.planning/01` §3
(acceptance criteria) → `.planning/03` §1-2, `05`, `06` §1-2 (structure, data, envelopes) →
`DEVELOPMENT-GUIDELINES.md` §1 precedence. A `MUST` in any of those is never contradicted below.

Scope of Phase 2: an editable FigCraft design package (tokens, components, screens, states, responsive
specimens, prototype) and draw.io diagrams. No application source. No benchmark claim.

---

## 1. Phase 1 input validation

### 1.1 Verified inputs

| Input | Sections read | State |
|---|---|---|
| `.planning/14-ui-ux-specification.md` | §1-§10, complete | Complete binding spec; tokens, layout, screens, components, interactions, states, a11y, parity |
| `.planning/01-requirements.md` | §2-§3 (FR tables), §6-§7 (constraints, assumptions) | 7 FR areas, all with testable acceptance criteria |
| `.planning/00-project-discovery.md` | §1-§8, §11-§12 | Roles, vocabulary, boundaries, constraints, assumptions, questions |
| `.planning/03-system-architecture.md` | §1-§2, §2.1 | Two frontends, one API, component boundaries |
| `.planning/06-api-contracts.md` | §1-§2 | Envelopes, status matrix, auth model, rate limits |
| `DEVELOPMENT-GUIDELINES.md` | §1-§12 | Precedence, parity, DoD, escalation |
| `.planning/05`, `07`, `08`, `09`, `10` | not read in Phase 2 | Not design inputs; referenced by ID only |

No duplicate or ambiguous planning set exists: one file per stage, `.planning/00`..`14`.

### 1.2 Design artefact → source → requirement traceability

| Design artefact | Source section | Requirement IDs it must satisfy |
|---|---|---|
| `00 Tokens` (FigCraft variables, styles) | `14` §2 | FR-UI-006, FR-UI-009, FR-TASK-008, FR-TASK-009 |
| `01 Components` C-01..C-23 | `14` §5; §6; §7 | FR-UI-002/003/004/005/007/010/011/012, FR-ATT-005/010, FR-TASK-017/018, FR-DASH-007 |
| Typography/space/radius/container board | `14` §2, §3 | FR-UI-008/009 |
| `02 Marketing` L-01/L-02/404 | `14` §3, §4; `01` §3.1 | FR-LAND-001..006, FR-UI-008, FR-UI-009 |
| `03 Auth` (login, register, expired) | `14` §4, §6, §7; `01` §3.2 | FR-AUTH-001..014, FR-UI-001/005/006/010 |
| `04 App Shell & Dashboard` | `14` §3, §4, §7; `01` §3.3 | FR-DASH-001..009, FR-DASH-007, FR-UI-001/002/003/008 |
| `05 Tasks` (list, filters, detail, edit, delete) | `14` §4, §6, §7; `01` §3.4 | FR-TASK-001..021, FR-ATT-001..012, FR-UI-002/004/005/007 |
| `06 Notes` (list, detail, editor, pin) | `14` §4, §6, §7; `01` §3.5 | FR-NOTE-001..013, FR-ATT-005/006 |
| `07 Account` | `14` §4; `01` §3.2 | FR-AUTH-007/009, FR-AUTH-014 |
| `08 States & Responsive` | `14` §3, §7, §8 | FR-UI-001/002/003/004/008/009/010/011, FR-ATT-010 |
| Lightbox / upload specimens | `14` §5 C-11/C-12, §6 | FR-ATT-002/005/006/009/010/012 |
| Parity checklist gates PG-01..PG-08 | `14` §9 | FR-UI-009, NFR-RESEARCH-001 |
| Draw.io diagram index | `03`, `05`, `06`, `07` | Phase-1 structure only; no UI FR |
| Prototype flows | `14` §6; `01` §5 journeys | J-01..J-13 traversal evidence |

### 1.3 Design-readiness gaps and decisions

Each gap blocks a pixel-accurate build as written. The resolution is the conservative reading of
existing tokens, vocabulary (`00` §6) and contracts.

| # | Gap / ambiguity | Impact if unresolved | Resolution |
|---|---|---|---|
| G-01 | `packages/contracts/src/copy.ts` does not exist. `14` §1 requires one copy deck; no string is authored anywhere. Empty-state, toast, error and validation wording are unspecified. | Copy parity (FR-UI-006/009) unbuildable; two apps invent two strings. | `[DESIGN DECISION]` Author a provisional English copy deck in `04-component-and-state-spec.md`, using only `00` §6 vocabulary. Status labels `Todo` / `In progress` / `Completed`; priorities `Low` / `Medium` / `High`. Marked **Proposed**; implementation promotes it verbatim into `packages/contracts/src/copy.ts`. No UI string may be typed inline in a screen spec. |
| G-02 | Product name is never stated, yet FR-LAND-001/006 require it in hero, header and footer. | Landing, 404 and app shell have no wordmark. | `[DESIGN DECISION]` Working name **“Task & Notes”** (the brief's own product description, not a new brand). One `PRODUCT_NAME` constant. Flagged for owner confirmation in §9 open questions. |
| G-03 | No icon set is named; `14` §10 forbids a different icon set per app. | Two apps ship two icon languages. | `[DESIGN DECISION]` **Lucide Icons** are the single icon source in both apps: `@lucide/astro` in Astro, `lucide-react` in Next (`pnpm add @lucide/astro` / `pnpm add lucide-react`). Inline SVG on `currentColor`, 24×24 viewBox, stroke `1.6`, `stroke-linecap="round"`, `fill="none"`. Tree-shaken per import, so both apps ship the same icon bytes and no icon font or maintained sprite. The same Lucide name is used for the same slot in both apps; decorative icons `aria-hidden`, icon-only controls carry `aria-label`. |
| G-04 | `assets/` is empty: logo, hero and “product preview” image do not exist (FR-LAND-005 requires static shared non-user imagery). | Landing preview block cannot be built or made payload-honest. | `[DESIGN DECISION]` Preview is a vector composition saved as `assets/landing-preview.svg` plus a 2× PNG, built from components C-08/C-23 with lorem-free, non-user sample rows labelled as a product illustration. No API request, no user data. |
| G-05 | Dashboard composition is unspecified beyond “three counters + breakdowns + two lists + search”. | Layout invented per app. | `[DESIGN DECISION]` 12-column grid, 1120 px container: row 1 = search + primary CTA; row 2 = 3 × C-23 (span 4); row 3 = status breakdown, priority breakdown, overdue (span 4 each); row 4 = recent tasks (span 6) + recent notes (span 6); stacked at < 1024. |
| G-06 | Task detail “list + detail can sit side by side” (`14` §3) is permissive, while the route inventory defines a distinct `/tasks/[id]` document. | Side-by-side implemented in one app only → parity defect. | `[DESIGN DECISION]` Detail is its own route in both apps; no master-detail split. “Can” is read as an option, not a requirement (FR-TASK-005 only requires a deep-linkable detail view). |
| G-07 | `14` §4 says task edit is “modal or page”; §6 specifies a modal only for create. | Divergent edit surfaces. | `[DESIGN DECISION]` One modal form (C-13) for create and edit on list and detail; Next encodes `mode=edit` in the query, Astro in the URL — same visible surface (FR-TASK-006/007). |
| G-08 | Note create/edit interaction is unspecified (only FR-NOTE-001/006). | Notes get an inconsistent form pattern. | `[DESIGN DECISION]` Same modal pattern as tasks; fields `title` (required, ≤ 200), `body` (required, ≤ 20 000), attachments. Pin is never inside the edit form (FR-NOTE-006). |
| G-09 | FR-ATT-001 requires a multi-file submission, but `06` §5.18 accepts exactly one file per request. | Upload UX cannot be specified honestly. | `[DESIGN DECISION]` The form collects N files and issues N sequential one-file requests, each with its own progress row; A-19 partial persistence is surfaced per file. Client-side pre-validation (type, 5 MB, 10-per-target) blocks the request and reuses the server message (FR-UI-012). Contract unchanged; raised for Iqram in §9. |
| G-10 | Account screen is “read-only + logout” (`14` §4), but `06` #6 `PATCH /users/me` exists. | An edit form might be invented. | `[DESIGN DECISION]` Account shows email (read-only), display name (read-only), created/expiry context, Log out. No inline editing in Phase 2; #6 has no FR consumer (`06` §9.1 D-1). |
| G-11 | C-20 promises “next/prev only (cursor)”, but `06` §6.1 returns only `nextCursor`. | A Previous button with no contract. | `[DESIGN DECISION]` Cursor-honest pagination: `Load more` (next), no Previous, end-of-list marker “End of list”. URL keeps cursor so Back/Forward restore state (FR-TASK-014). |
| G-12 | Badge colours: `14` §2 defines status/priority text tokens but no soft backgrounds per status. | Ad-hoc badge tints per app. | `[DESIGN DECISION]` Map to existing soft tokens only: todo/low → `--surface-2` bg + `--status-todo`/`--priority-low` text; progress/medium → `--warn-soft` + `--status-progress`/`--priority-medium`; done/high → `--ok-soft` / `--danger-soft` + `--status-done`/`--priority-high`. 1 px border in the same text colour at 40 % is **not** used (no alpha tokens exist). Labels always present (FR-TASK-008). |
| G-13 | `14` §8 requires ≥ 3:1 for UI borders, but `--line` (1.32:1) and `--line-strong` (1.80:1) cannot meet it on `--paper`. | An unmet a11y MUST. | `[DESIGN DECISION]` Interactive control boundaries use `--ink-faint` (3.08:1 on paper). `--line`/`--line-strong` remain for non-interactive dividers and card edges (not subject to 4.5:1 text or 3:1 control-boundary). Focus ring `--accent` on paper = 6.25:1. |
| G-14 | Placeholder text colour is unspecified; `--ink-faint` is 3.08:1 and fails body-text contrast. | Placeholders fail AA. | `[DESIGN DECISION]` Placeholder/help text = `--ink-muted` (5.78:1). `--ink-faint` is reserved for decorative icons and disabled text only. |
| G-15 | Mobile navigation pattern is “menu button + drawer” but the drawer's contents/order are unstated. | Two different drawers. | `[DESIGN DECISION]` Drawer = same three nav items in the same order + Account + Log out, 240 px wide, full-height, focus-trapped, closes on Escape/backdrop. |
| G-16 | Form label style is not in the §2 type scale (only page/section/body/card-title/meta/badge/hero). | Labels guessed per app. | `[DESIGN DECISION]` Derived styles `type/label` (`--fs-14`, 500, `--ink`) and `type/button` (`--fs-16`, 500), built only from existing scale values. |
| G-17 | `14` §7 marks Landing as n/a for all states, but FR-LAND-003 requires a session-aware CTA swap without layout shift (NFR-PERF-002). | CTA swap measured as CLS. | `[DESIGN DECISION]` Hero CTA slot has fixed height (44 px) and reserved width for both labels; the signed-in and signed-out variants are separate specimens with identical box metrics. |
| G-18 | 404 screen has no layout, copy or route owner beyond FR-UI/route inventory. | Undesigned screen. | `[DESIGN DECISION]` 404 is a public screen (header + centred block: “Page not found”, one sentence, `Go to dashboard`/`Back to home` per auth state) in `02 Marketing`. Not-found for a foreign/missing task or note is C-18 inside the app shell, never the 404 page (FR-TASK-019, FR-NOTE-013). |
| G-19 | No light/dark theme decision other than “light only” (`14` §2). FigCraft's canvas itself renders dark. | Specimens unreadable or a dark mode implied. | `[DESIGN DECISION]` One collection `Tokens`, one mode `Light`. Page background `#F5F7F9` (`--surface`), every frame `#FFFFFF` (`--paper`). No mode toggle anywhere. |
| G-20 | Component state matrix does not say which *variant* carries which state. | Inconsistent coverage. | `[DESIGN DECISION]` §6.3 matrix. Required states are all demonstrated; `loading`/`active` are demonstrated on the primary variant, and each other variant carries default + hover + disabled. |
| G-21 | Illustration/empty-state iconography unspecified (C-16 requires an icon). | Emoji or clip-art creeps in. | `[DESIGN DECISION]` C-16 icon = the entity's 24 px icon in `--ink-faint` inside a 48 px `--surface-2` circle. No illustrations. |
| G-22 | Toast placement/duration: §5 says auto-dismiss 4 s; FR-UI-004 says ≥ 3 s. | Divergent stacking. | `[DESIGN DECISION]` Fixed bottom-right on desktop, bottom-centre full-width minus 16 px on mobile, 4 s auto-dismiss, dismiss control, max 3 stacked, newest on top, `role="status"` success/info, `role="alert"` error. |
| G-23 | “Character counter when max set” (C-03) has no position/style. | Counters differ. | `[DESIGN DECISION]` Counter right-aligned under the field, `--fs-12`, `--ink-muted`; turns `--danger` at ≥ 90 % of the limit; announced via the field's `aria-describedby`. |
| G-24 | Overdue indicator “text + icon” is required but the wording is not. | Two different markers. | `[DESIGN DECISION]` `Overdue · 12 Nov 2026` with the alert-triangle icon, `--danger`; completed tasks never show it (FR-TASK-010). |
| G-25 | Date display format is unspecified (`A-15` says “displayed verbatim”, ISO date on the wire). | Different date rendering per app. | `[DESIGN DECISION]` One `format.ts` (`14` §1): display `12 Nov 2026`, relative “Updated 3 hours ago” only where FR-TASK-004/FR-NOTE-004 require an updated time, absolute date in the tooltip/title. |
| G-26 | Search input on the dashboard (FR-DASH-006) vs C-21 behaviour (300 ms debounce). | Dashboard search behaves like a filter. | `[DESIGN DECISION]` Dashboard reuses C-21 visually but submits on Enter/`Search` (navigates to the task list with `q`), no debounce. Lists keep 300 ms debounce. |
| G-27 | FigCraft has no `file.new` command in this build; only `file.newFromTemplate`, `file.newBoard`, `window.new`. | Wave 1 cannot start from a blank file the documented way. | `[DESIGN DECISION]` Use the already-open `Untitled` tab (document id 1, one page, one empty `Tokens` collection) as the working file; rename its page and save to the target path. No second document, no new window. |
| G-28 | Wave-1 component corpora are large; `component.combineVariants` names unnamed variants `Property 1=Default`. | Unusable variant naming. | `[DESIGN DECISION]` Variant frames are named `variant=<v>, state=<s>` before combining; the resulting set is named `C-NN-<slug>`. |

No gap above changes an FR, an API shape, a token value, or a status label.

---

## 2. Tool capability verification

Verified in this session against the live services. Nothing below mutated a document.

### 2.1 FigCraft MCP — UI/UX lane

Identity: `figcraft/*` tools, backend attached to the FigCraft desktop app. Proof of attachment (at
verification time, before the document was renamed and saved):
`inspect_ui` reports `windows: [{id: 0, title: "Untitled • – FigCraft", focused: true}]`,
`status.document: "Untitled"`, `canvas.rect: [296, 40, 1200, 900]`, live `frameTimes.frames: 211`.

| Operation | Tool / command used | Result | Evidence | Status |
|---|---|---|---|---|
| App attached, a document is open | `inspect_ui` | Attached; one window; one tab `Untitled` | `windows[0].title`, `tabs[0]` | Verified |
| Read document tree | `inspect_document` | `id: 1`, `name: Untitled`, `path: null`, 1 page (`Page 1`, bg `#1E1E1E`), `variables: 0`, `styles: []` | full JSON | Verified |
| Document writable, not a live read-only share | `inspect_ui.live` | `session: null`, `readOnly: null`, `status: "off"`, `peers: 0`; `status.dirty: true`, undo depth 1 | JSON | Verified (no share lock) |
| Command catalogue | `list_commands` filters `variable`, `style`, `component`, `page`, `file `, `doc` | 45 / 41 / 53 / 93 / 58 / 34 commands returned; `variable.create`, `style.create`, `component.create`, `component.combineVariants`, `page.add`, `node.create`, `frame.create`, `node.set`, `component.list`, `node.find`, `inspect.code` present | tool text | Verified |
| Variables read/write | `variable.list`, `variable.createCollection`, `variable.create`, `variable.bind`, `variable.export` | `variable.list` returns collection `Tokens` (`VariableCollectionId:1`, one mode `Mode 1`) with 0 variables; create/bind/export documented | JSON + catalogue | Verified (read); create untested by design (Wave 1 owns it) |
| Styles | `style.create`, `style.list`, `style.bind`, `style.apply` | `style.list` → `[]`; commands documented | JSON | Verified (read) |
| Components | `component.create`, `component.createMultiple`, `component.combineVariants`, `component.list`, `instance.create` | `component.list` → `[]`; commands documented | JSON | Verified (read) |
| Layers/pages | `page.add`, `page.rename`, `page.setBackground`, `frame.create`, `node.create`, `node.set` (incl. `fill: {$var: name}`), `node.find` | all documented with params | catalogue | Verified |
| Persist native file | `file.save {path}` | required on first save; `file.new` **absent** in this build (`file.newFromTemplate` only) — see G-27 | catalogue | Verified with limitation |
| Render/verify | `screenshot`, `inspect_document`, `inspect.properties`, `export` | bot deps render (`frameTimes`), commands documented | JSON | Verified |
| Agent callability | `design-system-engineer`, `product-designer`, `prototype-engineer` all receive the same FigCraft tool set | assigned in waves | — | Verified by dispatch |

Limitation recorded: `file.new` does not exist in this FigCraft build. The working document is the open
`Untitled` tab; the file is created by `file.save` to the path in §4. This is a tooling limitation, not
a design gap.

### 2.2 draw.io MCP — diagram lane

Identity: `drawio/*`. Another agent holds this lane in this run; I only verified, authored nothing.

| Operation | Tool | Result | Status |
|---|---|---|---|
| Generation reference available | `get_drawio_reference {format:"mermaid"}` | Full reference returned: 28 diagram types, flowchart/ELK/classDef guidance, colour roles | Verified |
| Read a .drawio file without creating one | `list_pages {path:"design/scratch-does-not-exist.drawio"}` | `Error: file not found: design/scratch-does-not-exist.drawio` — no file created, no write side effect | Verified (read-only probe) |
| Page read contract | `get_page {path, page}` | schema: index / exact name / id; decompresses before returning XML | Verified (schema) |
| Page write contract | `set_page {path, page, xml}` | replaces one page, leaves other pages untouched | Verified (schema) |
| Shape library search | `search_shapes` | mounted, ~10k stencils | Not tested (owned by diagram lane) |
| Author/save a native diagram | `open_drawio_mermaid`, `open_drawio_xml` | not exercised in this run (single-writer rule on the diagram lane) | Not tested |

Consequence: the design lane is not blocked by draw.io, and no diagram may be created in FigCraft
Boards as a fallback (`01` §8 rule 7).

---

## 3. Deliverable and page plan

**FigCraft file:** `design/rweb-task-management.figcraft` (created by `file.save`; the working document
was the open `Untitled` tab, id 1, and now reports name `rweb-task-management`). One document, eight
pages, fixed page order. A page is created once by its owner and never re-created.

Page background `#F5F7F9`; every screen/specimen frame `#FFFFFF`. Frame origin: x = 0, y = 0 for the
first frame of each page, subsequent frames laid out in a single row with 80 px gutters, max three per
row, then a new row 80 px below the tallest frame. Frame names are kebab-case with the screen ID.

### 3.1 Page and screen inventory

| Page | Screen ID | Frame name | Size(s) | Requirement IDs the frame must show |
|---|---|---|---|---|
| `00 Tokens` | T-01 | `t-01-color-board` | 1120×auto | `14` §2 colour tokens; FR-UI-006 |
| | T-02 | `t-02-type-scale` | 1120×auto | §2 type scale; FR-UI-006 |
| | T-03 | `t-03-space-radius-shadow` | 1120×auto | §2 spacing, radius, elevation |
| | T-04 | `t-04-layout-grid` | 1120×auto | §3 container 1120, measure 68ch, breakpoints |
| `01 Components` | C-01..C-23 | `c-01-button` … `c-23-stat-card` | component-sized; boards 1120 wide | `14` §5 states; §6 interactions |
| `02 Marketing` | L-01 | `l-01-landing-1440` | 1440×900 | FR-LAND-001..005 |
| | L-02 | `l-02-landing-375` | 375×812 | FR-LAND-002/006, FR-UI-008 |
| | L-03 | `l-03-landing-signed-in-1520` (CTA swap) | 1440×900 | FR-LAND-003 (no shift) |
| | N-01 | `n-01-not-found-1440` | 1440×900 | FR-UI-002/003 (G-18) |
| `03 Auth` | A-01 | `a-01-login-1440` | 1440×900 | FR-AUTH-001..006/011/014 |
| | A-02 | `a-02-login-375` | 375×812 | FR-UI-008 |
| | A-03 | `a-03-login-error` | 1440×900 | FR-AUTH-005, FR-UI-005/006 |
| | A-04 | `a-04-login-expired` | 1440×900 | FR-AUTH-010 |
| | A-05 | `a-05-register-1440` | 1440×900 | FR-AUTH-001..003/011 |
| | A-06 | `a-06-register-375` | 375×812 | FR-UI-008 |
| `04 App Shell & Dashboard` | S-01 | `s-01-shell-1440` | 1440×900 | FR-DASH-007, FR-UI-010 |
| | S-02 | `s-02-shell-1024` | 1024×768 | `14` §3 md/lg |
| | S-03 | `s-03-shell-768` | 768×1024 | FR-DASH-007 |
| | S-04 | `s-04-shell-drawer-375` | 375×812 | FR-UI-008, G-15 |
| | D-01 | `d-01-dashboard-1440` | 1440×900 | FR-DASH-001..007 |
| | D-02 | `d-02-dashboard-empty-1440` | 1440×900 | FR-DASH-008, FR-UI-002 |
| | D-03 | `d-03-dashboard-375` | 375×812 | FR-UI-008 |
| `05 Tasks` | TK-01 | `tk-01-task-list-1440` | 1440×900 | FR-TASK-003/004/008/010/013/014/017 |
| | TK-02 | `tk-02-task-list-filters-1440` | 1440×900 | FR-TASK-011/012/014 |
| | TK-03 | `tk-03-task-list-empty-1440` | 1440×900 | FR-TASK-015, FR-UI-002 |
| | TK-04 | `tk-04-task-list-no-results-1440` | 1440×900 | FR-TASK-015 |
| | TK-05 | `tk-05-task-detail-1440` | 1440×900 | FR-TASK-005/006/007/010/016 |
| | TK-06 | `tk-06-task-form-modal-1440` | 1440×900 (modal 560) | FR-TASK-001/002/018/020 |
| | TK-07 | `tk-07-task-delete-confirm` | 1440×900 (modal 440) | FR-TASK-021, FR-UI-007 |
| | TK-08 | `tk-08-task-list-375` | 375×812 | FR-UI-008 |
| | TK-09 | `tk-09-task-detail-375` | 375×812 | FR-UI-008 |
| | TK-10 | `tk-10-attachment-upload` | 1120×auto | FR-ATT-001/002/003/009/012, C-12 states |
| | TK-11 | `tk-11-task-detail-lightbox` | 1440×900 | FR-ATT-005/006 |
| `06 Notes` | N-02 | `n-02-note-list-1440` | 1440×900 | FR-NOTE-003/004/007/008 |
| | N-03 | `n-03-note-list-empty-1440` | 1440×900 | FR-NOTE-012, FR-UI-002 |
| | N-04 | `n-04-note-detail-1440` | 1440×900 | FR-NOTE-005/006/010/011 |
| | N-05 | `n-05-note-form-modal-1440` | 1440×900 (modal 560) | FR-NOTE-001/002 |
| | N-06 | `n-06-note-list-375` | 375×812 | FR-UI-008 |
| | N-07 | `n-07-note-detail-375` | 375×812 | FR-UI-008 |
| `07 Account` | AC-01 | `ac-01-account-1440` | 1440×900 | FR-AUTH-007/009 (G-10) |
| | AC-02 | `ac-02-account-375` | 375×812 | FR-UI-008 |
| `08 States & Responsive` | ST-01 | `st-01-loading-matrix` | 1120×auto | FR-UI-001, C-17 |
| | ST-02 | `st-02-empty-matrix` | 1120×auto | FR-UI-002 (5 distinct) |
| | ST-03 | `st-03-error-matrix` | 1120×auto | FR-UI-003, C-18 |
| | ST-04 | `st-04-toast-stack` | 1120×auto | FR-UI-004, C-15 |
| | ST-05 | `st-05-focus-specimens` | 1120×auto | FR-UI-010/011, C-01..C-05 |
| | ST-06 | `st-06-breakpoint-sweep` | 375/768/1024/1440 | FR-UI-008, `14` §3 |
| | ST-07 | `st-07-parity-checklist` | 1120×auto | FR-UI-009 (PG-01..PG-08 render) |

Sizes are pixels at 100 %. `auto` = the frame hugs its content; its height is recorded after build.
Astro and Next render the same frame; no screen may be specified once per app.

---

## 4. File, ownership and write discipline

- One FigCraft document: `design/rweb-task-management.figcraft`. One writer at a time, enforced by me
  (the orchestrator) dispatching waves sequentially. Two agents writing this document at once is a
  defect, not a parallelisation.
- A wave may write only the pages it names. Pages it does not own are read-only for it.
- Each wave ends with `file.save {path}` and reports: page names, frame names, node ids, counts,
  `inspect_document` excerpt and `screenshot` evidence.
- `inspect_ui`, `inspect_document`, `list_commands`, `node.find`, `variable.list`, `style.list`,
  `component.list` are safe at any time.
- No `.fig` export, no `window.new`, no `file.newFromTemplate`, no second tab.
- draw.io is a separate service and a separate writer; it is never used by a FigCraft wave and FigCraft
  is never used for diagrams (`01` §8 rule 7).

---

## 5. Token, style and accessibility gates

Wave 1 must satisfy all of these before Wave 2 starts.

### 5.1 Variable collection `Tokens`, mode `Light`

Colour variables (23), values exactly from `14` §2:

| Name | Value | Name | Value |
|---|---|---|---|
| `color/paper` | `#FFFFFF` | `color/accent` | `#0B6E4F` |
| `color/surface` | `#F5F7F9` | `color/accent-hover` | `#095A41` |
| `color/surface-2` | `#EEF1F5` | `color/accent-soft` | `#E6F2ED` |
| `color/ink` | `#17202A` | `color/danger` | `#B3261E` |
| `color/ink-muted` | `#5B6773` | `color/danger-soft` | `#FBECEB` |
| `color/ink-faint` | `#8A949E` | `color/warn` | `#B45309` |
| `color/line` | `#DCE1E7` | `color/warn-soft` | `#FDF3E7` |
| `color/line-strong` | `#B9C2CC` | `color/ok` | `#0B6E4F` |
| `color/status-todo` | `#5B6773` | `color/ok-soft` | `#E6F2ED` |
| `color/status-progress` | `#B45309` | `color/status-done` | `#0B6E4F` |
| `color/priority-low` | `#5B6773` | `color/priority-medium` | `#B45309` |
| `color/priority-high` | `#B3261E` | | |

Numeric variables: `space/sp-1..sp-8` = 4, 8, 12, 16, 24, 32, 48, 64 · `radius/r-sm` 6,
`radius/r-md` 10, `radius/r-pill` 999 · `font/fs-12` 12, `font/fs-14` 14, `font/fs-16` 16,
`font/fs-20` 20, `font/fs-24` 24, `font/fs-32` 32, `font/fs-40` 40 · `font/lh-tight` 1.2,
`font/lh-body` 1.55 · `layout/container` 1120, `layout/measure` 68 → **45 variables**.

No mode other than `Light`. No raw hex on any layer or style: every fill/stroke/radius/space/gap/
padding/font-size that has a token is bound with `variable.bind` (or set as `fill: {"$var": "…"}`).

### 5.2 Styles

Text styles (9): `type/hero` 40/1.2 · `type/page-title` 32/1.2 · `type/section` 20/1.2 ·
`type/body` 16/1.55 · `type/card-title` 16/1.2 · `type/label` 14/1.2 · `type/meta` 14/1.2 ·
`type/badge` 12/1.2 · `type/button` 16/1.2. Family `ui-sans-serif` stack rendered as
`-apple-system`/`SF Pro` (system UI); weights 400 body, 500 label/button/badge, 600 title/section/hero.
Font size and line height bound to `font/*` variables via `style.bind`.

Effect styles (2): `effect/shadow-1` = two drop shadows `0 1 2 rgba(23,32,42,0.06)` and
`0 1 3 rgba(23,32,42,0.08)`; `effect/shadow-2` = `0 8 24 rgba(23,32,42,0.12)`.

### 5.3 Accessibility gates (computed, WCAG 2.2 relative-luminance formula)

| Gate | Pair | Ratio | Requirement |
|---|---|---|---|
| AG-01 | `ink` on `paper` | 16.45:1 | ≥ 4.5 |
| AG-02 | `ink-muted` on `paper` / `surface` | 5.78:1 / 5.38:1 | ≥ 4.5 |
| AG-03 | `ink-faint` on `paper` | 3.08:1 | decorative/disabled only — never body text |
| AG-04 | `accent` on `paper` (links, focus ring) | 6.25:1 | ≥ 3 (non-text) and 4.5 (text) |
| AG-05 | white on `accent` (primary button) | 6.25:1 | ≥ 4.5 |
| AG-06 | white on `danger` (destructive button) | 6.54:1 | ≥ 4.5 |
| AG-07 | badge text pairs (todo/progress/done/low/medium/high on their soft bg) | 5.10 / 4.58 / 5.45 / 5.10 / 4.58 / 5.70 | ≥ 4.5 |
| AG-08 | `ink-faint` as input border on `paper` | 3.08:1 | ≥ 3 (G-13) |
| AG-09 | `line`, `line-strong` | 1.32 / 1.80 | dividers only, never a sole control boundary |
| AG-10 | focus ring: 2 px `accent`, 2 px offset, on every interactive layer | — | FR-UI-010 |
| AG-11 | hit target ≥ 44×44 px (24 px visual may sit inside a 44 px target) | — | `14` §8, FR-UI-008 |
| AG-12 | badges and overdue markers carry text; no colour-only meaning | — | FR-TASK-008/010 |
| AG-13 | skeletons occupy final dimensions (C-17) | — | FR-UI-001, NFR-PERF-002 |
| AG-14 | every image/thumbnail has an accessible name | — | FR-ATT-010 |

Gates are re-checked per wave; a failing pair is fixed in tokens, never in one screen.

### 5.4 Component naming gate

Layer, component and set names: `C-NN-<kebab-slug>` (`C-01-button`, `C-08-task-card`,
`C-22-app-shell`). Variant names: `variant=<v>, state=<s>`. Sub-layers are kebab-case, no spaces, no
ID-less duplicates (`c-01/primary/state-loading` is not used; variants carry the name).

---

## 6. Component build plan (`01 Components`)

### 6.1 Build order

Primitives first so composites can be assembled from them; no composite is drawn from scratch.

| Order | ID | Component | Depends on |
|---|---|---|---|
| 1 | C-03 | TextField / Textarea | tokens |
| 2 | C-04 | Select | tokens |
| 3 | C-05 | DatePicker | tokens |
| 4 | C-01 | Button | tokens, icon |
| 5 | C-02 | IconButton | C-01, icon |
| 6 | C-06 | Badge | tokens |
| 7 | C-19 | InlineError | tokens |
| 8 | C-17 | Skeleton | tokens |
| 9 | C-15 | Toast | tokens, icon |
| 10 | C-18 | ErrorState | C-01, icon |
| 11 | C-16 | EmptyState | C-01, icon |
| 12 | C-21 | SearchInput | C-03, icon |
| 13 | C-20 | Pagination | C-01 |
| 14 | C-23 | StatCard | C-17 |
| 15 | C-07 | Card | tokens |
| 16 | C-10 | AttachmentThumb | C-17, icon |
| 17 | C-08 | TaskCard | C-06/07/10, C-01 |
| 18 | C-09 | NoteCard | C-06/07/10 |
| 19 | C-11 | Lightbox | C-02, C-10 |
| 20 | C-12 | FileDropzone | C-01/02, C-10, C-19 |
| 21 | C-13 | Modal | C-01/02 |
| 22 | C-14 | ConfirmDialog | C-13, C-01 |
| 23 | C-22 | AppShell | C-01/02, C-21, icon |

Order 1-23 is a dependency order, not a page layout order; the page groups them in ID order left to
right, top to bottom, each under a section label (`c-01-button` etc.).

### 6.2 Coverage required per component

Every state named in `14` §5 must exist visibly on the page. The matrix below fixes which variant
demonstrates which state (G-20).

| ID | Variants to build (each = one variant frame) |
|---|---|
| C-01 | primary: default, hover, focus-visible, active, disabled, loading · secondary: default, hover, disabled · ghost: default, hover, disabled · danger: default, hover, disabled |
| C-02 | ghost icon button: default, hover, focus-visible, active, disabled, loading · secondary: default, hover, disabled |
| C-03 | text field: default, focus, filled, invalid+message, disabled, counter (max set) · textarea: default, filled, invalid+message |
| C-04 | default, open (option list specimen), selected, disabled |
| C-05 | empty, set, invalid, cleared |
| C-06 | status todo, status in progress, status completed, priority low, priority medium, priority high |
| C-07 | default, hover, selected |
| C-08 | default (2-line clamp, badges, due date), overdue, 3 thumbnails + “+2”, selected |
| C-09 | default (3-line clamp, updated date), pinned, hover |
| C-10 | loading (4:3 reserved), loaded, broken (icon + filename), removing |
| C-11 | open-loading, open-loaded, open-error |
| C-12 | idle, drag-over, uploading (per-file progress rows), rejected (reason), complete |
| C-13 | open, closing |
| C-14 | default, destructive, pending |
| C-15 | success, error, info |
| C-16 | no-tasks, no-notes, no-attachments, no-results, no-recent |
| C-17 | text-line, card, thumbnail |
| C-18 | error + Retry |
| C-19 | field-level, form-level |
| C-20 | next (Load more), end-of-list |
| C-21 | idle, typing, no-results |
| C-22 | authenticated (desktop), skeleton-bootstrapping, nav drawer open (375) |
| C-23 | value, loading |

Count: **98 variant/state specimens** across 23 components (15+9+9+4+4+6+3+4+3+4+3+5+2+3+3+5+3+1+2+2+3+3+2).

### 6.3 Structure rules for composites

- Auto layout everywhere; padding from `space/*`; gap from `space/*`.
- C-08 TaskCard: vertical frame, 100 % width in use; `title` (`type/card-title`), meta row (C-06 ×2 +
  due/overdue), description clamped to 2 lines (`maxLines: 2`, `textAutoResize: height`), thumbnail row
  (C-10 ×3 max + `+N`), radius `r-md`, border `line`, fill `paper`, `shadow-1` only in the hover variant.
- C-09 NoteCard: pin indicator 16 px in the title row, body clamp 3 lines, updated date, thumbnails.
- C-10: fixed 4:3 box (`aspect` achieved via width 96 / height 72 and 160/120 specimens), radius `r-sm`.
- C-22: header 64 px (logo, page title, user menu), sidebar 240 px at ≥ 1024 / 72 px rail at 768-1023,
  main with `container` max width, 24 px padding; drawer specimen 375 px wide with backdrop.
- C-16/C-18 occupy the content region, never the page.

---

## 7. Parity checklist as executable gates

`14` §9 is turned into eight gates. Each is a checkable assertion, run against both production builds
before any benchmark run (FR-UI-009). A failing gate blocks the run.

| Gate | Assertion | Method | Fixture |
|---|---|---|---|
| PG-01 | Same visible text for the same data, both apps | `copy.ts` key diff + rendered-text snapshot per screen | seeded account, 50/50 rows |
| PG-02 | Same DOM order: title → meta → actions → body | Playwright `expect(locator).toHaveCSS` order assertion on `data-testid` sequence | task/note list + detail |
| PG-03 | Same breakpoint behaviour at 375/768/1440 | Screenshot pair per screen per width; overflow check `scrollWidth <= clientWidth` | 1440×900, 768×1024, 375×812 |
| PG-04 | Same empty/loading/error wording | Text assertions on the five empty states, three error states, skeleton presence, from `copy.ts` | empty account + forced 500 |
| PG-05 | Same badge colour and label for identical records | Computed-style assertion on badge bg/fg + text | one record per status/priority |
| PG-06 | Same validation messages, field order, required markers | Submit the identical invalid matrix to both forms | `01` §6 A-13 limits |
| PG-07 | Same thumbnail ratio, `+N` rule, lightbox keys | Assert 4:3 box, `+N` arithmetic at 0/1/3/4/5 attachments, Arrow/ Escape behaviour | 5-attachment task |
| PG-08 | Screenshot pair attached to the PR | Artefact naming `parity/<screen>@<width>-{astro,next}.png` | every screen in §3.1 |

Design-side counterpart in this phase: ST-07 renders the checklist, and the design reviewer verifies each
frame against these eight assertions.

---

## 8. Wave sequencing

Single writer to the FigCraft document; waves run in order. Only truly independent work (draw.io lane)
may overlap, and it is a different service.

| Wave | Owner | Writes | Depends on | Acceptance criteria |
|---|---|---|---|---|
| W1 | `design-system-engineer` | `00 Tokens`, `01 Components` | this plan | 45 variables, 9 text + 2 effect styles, 23 components / 98 state specimens, all token-bound, file saved, inspected |
| W2-W4 | `product-designer` (one dispatch, pages built in order) | `02 Marketing`, `03 Auth`, `04 App Shell & Dashboard`, `05 Tasks`, `06 Notes`, `07 Account`, `08 States & Responsive` | W1 | L-01..L-03, N-01, A-01..A-06, S-01..S-04, D-01..D-03, TK-01..TK-11, N-02..N-07, AC-01/02, ST-01..ST-07 built from W1 instances; states per `14` §7; frame sizes exact. **Executed**: all 45 frames exist; the dispatch then exited non-zero before self-verification, and the integrator applied five corrections (§10 of `02-screen-specs.md`) and exported the pages. |
| W3 | `product-designer` | `04 App Shell & Dashboard`, `05 Tasks` | W2 | superseded by the combined W2-W4 dispatch above |
| W4 | `product-designer` | `06 Notes`, `07 Account`, `08 States & Responsive` | W3 | N-02..N-07, AC-01/02, ST-01..ST-07 |
| W5 | `prototype-engineer` | interactions on stable frames (no layout change) | W4 | J-01..J-13 traversable; esc/backdrop/focus restore wired |
| W6 | `diagram-engineer` | draw.io files only | W1 (shape vocabulary) | ERD, context/container/component, deployment, data flow, sequence, upload flow, status state diagram; native `.drawio` saved and reopened |
| W7 | `design-reviewer` | read-only | W5, W6 | findings with severity, evidence, requirement, disposition |
| W8 | orchestrator | `design/00-…09` documents | W7 | reconciled findings, handoff, completion status |

A wave that fails its criteria is re-dispatched once with a precise delta; the page is never rebuilt
from scratch and never written by two agents.

---

## 9. Open questions carried into Phase 2

| # | Question | Owner | Default applied |
|---|---|---|---|
| DQ-01 | Product name for hero/header/footer (G-02) | Project owner | “Task & Notes” |
| DQ-02 | Copy deck authored here is Proposed, not approved (G-01) | Erika + Azra | Use it; promote to `packages/contracts/src/copy.ts` on approval |
| DQ-03 | Idle input border contrast exception (G-13) | Erika + Azra | `--ink-faint` border |
| DQ-04 | Sequenced one-file uploads vs a batched endpoint (G-09) | Iqram | Sequential per-file requests |
| DQ-05 | Landing preview asset ownership (G-04) | project owner | Vector illustration, no photos |

---

## 10. Deliverables and numbering

`design/README.md` (authored in this folder) fixes the file numbering. This plan defers to it; the
earlier stage-name numbering is withdrawn so that no two files claim the same number.

| File | Owner | Status |
|---|---|---|
| `design/00-design-plan.md` | orchestrator (this file) | exists |
| `design/01-design-system.md` | design-system wave | exists (tokens, styles, component ids, a11y evidence) |
| `design/02-screen-specs.md` | product-design wave | exists (45 frames, §10 integrator fixes) |
| `design/03-diagram-index.md` | diagram lane | exists (peer-authored) |
| `design/04-design-review.md` | design-reviewer | in progress (independent review) |
| `design/05-implementation-handoff.md` | orchestrator | exists (peer-authored) |
| `design/06-copy-deck.md` | product-design waves | exists (peer-authored, Proposed) |
| `design/07-parity-checklist.md` | parity gates | exists (peer-authored) |
| `design/rweb-task-management.figcraft` | FigCraft waves | exists (pages 1-2) |
| `design/diagrams/*.drawio`, `*.mmd` | diagram lane | in progress, separate writer |
| `design/icons/icons.svg` | design-system wave | **retired** — icons now come from Lucide (`@lucide/astro` / `lucide-react`); kept as a historical record only |
| `design/exports/*.png` | integrator | nine 1× page renders (`00-tokens` … `08-states-responsive`) |

The tool-capability report is not a separate numbered file: its per-operation evidence is §2 of this
document, which is the authoritative record for both MCP lanes.

Open risk: files `03`, `05`, `06`, `07` were authored concurrently by another design lane while Wave 1
ran. They are read-only for this lane. Any disagreement between them and `14` is resolved toward `14`
and recorded in `04-design-review.md`, never by silently editing a peer file.

Completion status is `Partially ready` until W7 reconciliation; owner approval is never implied.

---

## Wave 1 result

Status: **Verified.** Built by `design-system-engineer` in two sequential dispatches (build, then a
targeted token-binding delta). Single-writer discipline held: one document, one writer, no second tab.

### What exists now

File: `design/rweb-task-management.figcraft` — document id 1, name `rweb-task-management`, saved
(58 660 bytes), `inspect_ui.status.dirty: false`, `path` set, one tab, no live session (`readOnly: null`).

| Page | id | Background | Contents |
|---|---|---|---|
| `00 Tokens` | 1 | `#F5F7F9` | 4 boards: `t-01-color-board` 541 (1120×1476), `t-02-type-scale` 653 (1120×760), `t-03-space-radius-shadow` 682 (1120×720), `t-04-layout-grid` 715 (1504×680) |
| `01 Components` | 2 | `#F5F7F9` | 23 section boards, ids below |

**45 variables** in collection `Tokens` (`VariableCollectionId:1`), single mode `Light`:
23 `color/*` (including all six status/priority tokens), 8 `space/sp-1..8`, 3 `radius/*`, 7
`font/fs-12..40`, 2 `font/lh-*`, 2 `layout/*`. Values are exactly `14` §2 (verified value-by-value in
`variable.list`).

**11 styles**: `type/hero`, `type/page-title`, `type/section`, `type/body`, `type/card-title`,
`type/label`, `type/meta`, `type/badge`, `type/button` (S:1-S:9) + `effect/shadow-1`, `effect/shadow-2`
(S:10-S:11).

**23 component families**, 98 state specimens, section ids:
C-01 5 · C-02 40 · C-03 62 · C-04 104 · C-05 133 · C-06 158 · C-07 173 · C-08 184 · C-09 239 ·
C-10 258 · C-11 275 · C-12 289 · C-13 322 · C-14 340 · C-15 369 · C-16 383 · C-17 416 · C-18 424 ·
C-19 432 · C-20 440 · C-21 448 · C-22 472 · C-23 463.

Four are true variant sets via `combineVariants` — `C-01-button` 38 (15 variants), `C-02-icon-button` 61
(9), `C-03-text-field` 103 (9), `C-06-badge` 172 (6); 39 variant frames carry
`variant=…, state=…` names. The other 19 families are separate main components named
`C-NN-<slug>` / `C-NN-<slug>-<state>`.

Token binding: 185 solid white fills were audited; 113 already resolved to `color/paper` and the
remaining **72 raw `#FFFFFF` slots were bound** to `color/paper`. No raw hex fill remains on either page
(page backgrounds and the two effect-style rgba values are the only intended literals).

### Verification run (by the orchestrator, not self-reported)

| Check | Command | Result |
|---|---|---|
| Document saved, path, dirty | `inspect_ui` | `document: rweb-task-management`, `path` set, `dirty: false`, `undo: 46` |
| Page tree and styles | `inspect_document` | 2 pages with correct backgrounds; 11 styles; 45 variables |
| Variable values | `variable.list` | 45 entries, mode `Light`, each value equals `14` §2 |
| Component inventory | `component.list` | 4 sets + 19 families; `instances: 0` |
| Section labels | `get_node {id:2, depth:1}` | 23 sections `C-01-button` … `C-23-stat-card` |
| Variant frames | `node.find {root:2, name:"variant="}` | `total: 39` |
| Binding proof | `inspect.properties {id:106}` | Gap `space/sp-1`, Fill token `color/paper`; child `input` 108 bound to `color/paper` / `color/ink-faint` / `radius/r-sm` / `space/sp-3` |
| Visual proof | `screenshot` 541, 5, 158, 184, 472 | Token board legible with name/hex/usage and badge-pair mapping; 15 button variants; 6 badges; 4 task cards incl. overdue and selected; 3 app-shell specimens |
| Specimen count | arithmetic over the §6.2 matrix | **98**, not the 100 stated in an earlier draft — corrected in §6.2 and §8 |

### Accepted deviations (recorded, not silent)

1. **`lineHeight` is not variable-bound.** FigCraft line height is px-only; binding `font/lh-body`
   (1.55) collapsed the line box to 1.55 px, so line heights are set in px derived from the ratio
   (24.8, 19.2, 16.8, 14.4, 38.4, 48). `fontSize` *is* bound on every text style. Tokens stay defined
   for the implementation handoff.
2. **Composite sub-elements are frames, not instances** (`component.list.instances: 0`). Wave 2 screens
   MUST place real instances (`instance.create` / `instance.place`); building screens from detached
   copies is a defect.
3. **`focus-visible`** is a 2 px accent ring on a 4 px offset box (no stroke-offset property exists).
   `active` uses `accent-hover`; danger hover adds `effect/shadow-1` instead of a halo.
4. **`t-04-layout-grid` is 1504 px wide** so the 1440 viewport renders 1:1; other boards are 1120.
5. **Thumbnail “loaded” states use the image icon** — no image assets exist yet (G-04).
6. **Variant values are kebab-case** (`state=in-progress`) because spaces/commas are property
   separators.
7. FigCraft draws component-set boundaries as a dashed purple outline with transparent fill; that is
   native file chrome, not a design element.

### Residual risk

| Risk | Impact | Mitigation |
|---|---|---|
| Icons moved off the hand-authored sprite to **Lucide Icons** (`@lucide/astro` / `lucide-react`); the sprite `design/icons/icons.svg` is retired | A stale sprite or a different icon set per app | Both apps import the same Lucide name per slot; tree-shaking ships identical icon bytes, so no sprite and no icon-font payload difference |
| Composite previews not linked to primitive components | A late change to C-06 would not propagate into C-08 | Wave 2 builds screens from real instances; reviewer checks `instances > 0` |
| FigCraft has no `file.new` in this build | New files must be created by saving the open tab | Documented in G-27; Wave 2 continues in the same file |
| Peer-authored `03`/`05`/`06`/`07` documents arrived concurrently | Possible drift from `14` | §10: read-only for this lane; `04-design-review.md` resolves toward `14` |
| 98 specimens is the full `14` §5 state list, but `14` §7 also demands per-screen states | Screen-state coverage is not provable from the component page alone | Waves 2-4 build the §7 matrix as screen frames; `08 States & Responsive` holds the matrices |

Wave 1 gate: **passed** for tokens, styles, component families and token binding. Wave 2 may start.

Wave 2 must build `02 Marketing` (L-01..L-03, N-01) and `03 Auth` (A-01..A-06) from these components as
instances, at the exact frame sizes in §3.1, and must not re-author tokens, styles or component
internals.
