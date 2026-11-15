# Phase 2 — Design deliverables

Design for `rweb-task-management`, traceable to the approved Phase 1 blueprint in `.planning/`.
Authority order: `.planning/14-ui-ux-specification.md` (visual + state authority) → `.planning/01`
(acceptance criteria) → this folder (derived numbers and artefacts). Where this folder adds a number,
it is marked a design decision and never contradicts a MUST.

| File | Contents |
|---|---|
| `00-design-plan.md` | Input validation, gap decisions, tool verification, page/screen plan, component build order, waves, acceptance gates, wave results |
| `01-design-system.md` | Tokens, text/effect styles, component library with states, FigCraft node ids |
| `02-screen-specs.md` | Screen-by-screen layout, content, states, responsive behaviour, frame ids |
| `03-diagram-index.md` | Technical diagram index (architecture, containers, navigation, lifecycle, flows) |
| `04-design-review.md` | Independent review against Phase 1 sources; pass/fail per gate |
| `05-implementation-handoff.md` | Derived geometry, token contract, markup contract, screen→data→states table, CLS guards |
| `06-copy-deck.md` | The single copy string set both apps import |
| `07-parity-checklist.md` | Executable screen × state parity gate |
| `08-review-resolutions.md` | What changed after the independent review, what is accepted, who owns the rest |
| `09-admin-console.md` | Admin member-management extension (BCR-01): scope, data delta, endpoints, screens, exclusion from the benchmark |
| `10-landing-sections.md` | Extended landing page in FigCraft: frames l-04…l-10, measurements, copy, open items |
| `assets/landing-illustration.svg`, `.png` | Landing hero illustration (task card with image strip) |
| `rweb-task-management.figcraft` | The editable design file: tokens, components, 11 member screens, 3 admin screens, states, responsive samples |
| `diagrams/*.mmd`, `diagrams/*.drawio` | Diagram sources and editable draw.io files |
| `icons/icons.svg` | Retired. Icons now come from **Lucide Icons** (`@lucide/astro` / `lucide-react`); this sprite is kept only as a historical record and is not shipped |
| `exports/*.png` | Screen renders for review and PR screenshots |

## Non-negotiables carried from Phase 1

- Two apps, one visual language; identical copy, badges, spacing scale, icon set (C-05, C-07).
- No user data in static HTML; the Next.js shell renders skeletons first (NFR-SEC-012, FR-UI-001).
- Skeletons equal final boxes, thumbnails declare dimensions, toasts are fixed (CLS zero-onset).
- Light theme only; no dark mode, no i18n layer. Icons: **Lucide Icons** only (`@lucide/astro` / `lucide-react`), never a maintained sprite or icon font (A-20, `.planning/14` §2, §10).
- Every screen ships loading, empty, no-results, error, validation and success states.
