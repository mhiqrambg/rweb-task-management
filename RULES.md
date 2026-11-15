# RULES.md

Enforceable rules. Cite the rule ID in a PR when a reviewer asks why something is the way it is. Each
rule names its authority; if the authority and this file disagree, the authority wins and this file is
fixed.

Legend: **MUST** = required, **NEVER** = forbidden, **SHOULD** = default you may deviate from only with
a written reason in the PR.

---

## A. Architecture (authority: `.planning/03`, `.planning/04`)

- **R-A1 MUST** ship three deployables against one database: `apps/web-astro` (SSR, MPA),
  `apps/web-next` (static export, SPA-style), `apps/api` (Fastify).
- **R-A2 MUST** keep the dependency direction `apps/* → packages/*`. `apps/web-next` NEVER imports from
  `apps/web-astro`; `packages/*` NEVER imports from `apps/*`.
- **R-A3 MUST** serve both frontends and the API from one origin so cookies and
  same-origin requests behave identically. Details in `.planning/03` §2.
- **R-A4 NEVER** add server rendering, ISR, middleware, server actions, or edge functions to
  `apps/web-next`. It is a static export on purpose (ADR-04).
- **R-A5 NEVER** let `apps/web-astro` hydrate or re-fetch SSR data on the client. If a page needs
  interactivity, it is a deliberate island with a stated reason.
- **R-A6 NEVER** add a top-level directory, a runtime service, or a queue without an ADR.
- **R-A7 MUST** keep one authorization axis: `row.user_id = session.user_id`. Any multi-tenant or
  role-based change is a blueprint change (see `design/09-admin-console.md`, BCR-01, approval pending).

## B. Contracts and data (authority: `.planning/06`, `.planning/05`)

- **R-B1 MUST** declare every entity type, field name, enum, and validation rule in
  `packages/contracts`. A frontend that needs a new shape adds it there first.
- **R-B2 MUST** validate at the HTTP boundary with the shared Zod schema; inside the service the type is
  already trusted.
- **R-B3 MUST** return the documented envelope and status codes. Errors use the single error shape; no
  ad-hoc `{ error }` objects.
- **R-B4 MUST** return `404` for a resource the caller does not own — NEVER `403`. The API does not
  disclose existence.
- **R-B5 NEVER** build SQL by concatenation. Parameterized queries only (`$1`), in `modules/*/repo.ts`.
- **R-B6 MUST** enforce limits in code and in the database: title 1-200, task description ≤5 000, note
  body 1-20000, priority `low|medium|high`, status `todo|in_progress|completed`, 10 attachments per
  record, 5 MB per image, `image/jpeg|png|webp` by content sniffing.
- **R-B7 MUST** cascade deletes in one transaction: task → attachments → storage; user → tasks → notes →
  attachments → storage.
- **R-B8 MUST** paginate every list endpoint with a cursor. Unbounded list fetches are a review reject.

## C. Security (authority: `.planning/07`)

- **R-C1 MUST** hash passwords with Argon2id. NEVER log, return, or store plaintext.
- **R-C2 MUST** keep sessions server-side: opaque token in the `sid` cookie (`HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/`), only the SHA-256 hash stored. NEVER put a token in `localStorage`, a URL,
  or a log.
- **R-C3 MUST** check ownership inside the query (`WHERE user_id = $1`), not after fetching the row.
- **R-C4 MUST** treat `disabled`/expired sessions as unauthenticated and invalidate on logout.
- **R-C5 NEVER** serve attachment binaries directly from the filesystem; stream through an
  authenticated route with the ownership check.
- **R-C6 MUST** stop `.env` leaking: it is gitignored; `.env.example` documents names only.
- **R-C7 NEVER** disable CSRF, same-origin, or CSP checks to make something work. Report it instead.

## D. Frontend parity (authority: `.planning/14` §9, FR-UI-*)

- **R-D1 MUST** ship a user-visible feature in both frontends in the same PR, or not at all.
- **R-D2 MUST** use the same copy, badge labels, colours, spacing scale, icon set, and state model in
  both apps. The DOM may differ; the rendered result may not.
- **R-D3 NEVER** load a webfont, an icon library, or a UI framework in one app only. The font stack is
  `system-ui` in both; icons come from `design/icons/icons.svg` in both.
- **R-D4 MUST** keep the Next.js static output free of user data. A build that emits a record, email, or
  task into `.next/out` is a release blocker.
- **R-D5 MUST** render the authenticated Next.js shell as skeletons first, then fetch — that bootstrapping
  is the measured difference, not a bug to hide.
- **R-D6 NEVER** add a feature that exists in only one app, not even behind a flag.

## E. Design system (authority: `DESIGN.md`, `design/01-design-system.md`)

- **R-E1 MUST** take colour, spacing, radius, type size, shadow, and breakpoint from
  `packages/design-tokens`. A literal hex, px radius, or ad-hoc spacing value in app CSS is a defect.
- **R-E2 MUST** compose screens from the documented components (`C-01`…`C-23`). Creating a second button,
  badge, or card convention is a review reject.
- **R-E3 MUST** give every interactive element a visible `:focus-visible` ring and a 44 px touch target.
- **R-E4 NEVER** communicate meaning by colour alone. Badges carry words; status is not a coloured dot.
- **R-E5 MUST** respect `prefers-reduced-motion`; no perpetual animation, no decorative loops.
- **R-E6 NEVER** add dark mode, gradients, glassmorphism, or a second accent. One accent, used at the key
  moment.
- **R-E7 MUST** reserve space for images and skeletons (`width`/`height` or aspect-ratio). Layout shift is
  a measured metric, not a cosmetic issue.

## F. Copy (authority: `design/06-copy-deck.md`, FR-UI-006)

- **R-F1 MUST** render every string from the shared copy module or directly from record data. No literal
  UI text in components.
- **R-F2 NEVER** invent a string, emoji, exclamation mark, uppercase label, or a decorative arrow glyph.
- **R-F3 MUST** keep an action's name through the flow: button `Delete task` → toast `Task deleted`.
- **R-F4 MUST** word errors as cause + fix, in the interface's voice, without status codes or stack
  traces.
- **R-F5 MUST** write FAQ and marketing claims only about behaviour that ships. No sharing,
  collaboration, exports, integrations, AI, or offline claims.

## G. Accessibility (authority: `.planning/01` NFR-A11Y-*, `.planning/14` §8)

- **R-G1 MUST** meet WCAG 2.2 AA: 4.5:1 body text, 3:1 large text and control borders.
- **R-G2 MUST** use semantic landmarks and exactly one `h1` per page; controls are labelled (`label`,
  `aria-label`, or visible text).
- **R-G3 MUST** trap focus in dialogs, restore it on close, and close on Escape.
- **R-G4 MUST** announce dynamic updates once in a live region; focus never moves on a toast.
- **R-G5 MUST** pass keyboard-only use of every flow: create, filter, change status, open a lightbox,
  remove an image, delete a record.

## H. Performance (authority: `.planning/08`)

- **R-H1 MUST** benchmark production builds only. `dev` output is never a measurement.
- **R-H2 MUST** state the expected LCP/CLS/INP or payload effect of any PR touching a page, list, image,
  or list endpoint, plus how it was checked.
- **R-H3 MUST** serve thumbnails as the derived small file; the full-size image is only loaded in the
  lightbox.
- **R-H4 NEVER** report a number without a run ID, commit SHAs, browser, viewport, network profile,
  dataset ID, repetitions, and the raw file.
- **R-H5 NEVER** optimise one app in a way that changes the visual output; the comparison is rendering
  model only.

## I. Testing (authority: `.planning/09`, `DEVELOPMENT-GUIDELINES.md` §7)

- **R-I1 MUST** cover the 404-on-foreign-owner case for every new read or write endpoint.
- **R-I2 MUST** test auth: valid, expired, logged-out, tampered cookie.
- **R-I3 MUST** test uploads: allowed mime, oversize, wrong mime, foreign owner.
- **R-I4 MUST** test UI states, not only the happy path: empty, loading, error, validation, success.
- **R-I5 MUST** name tests after requirement IDs so a failure names the broken promise.
- **R-I6 NEVER** lower coverage of the modules a PR touches.

## J. Process (authority: `DEVELOPMENT-GUIDELINES.md` §4-§8)

- **R-J1 NEVER** push to `main`; branch `feat|fix|docs|chore|test/<area>-<slug>`.
- **R-J2 MUST** use Conventional Commits, one logical change per commit, no mixed formatting.
- **R-J3 MUST** include in the PR: requirement IDs, contract impact, exact verification commands,
  screenshots from both apps for UI changes, and risk.
- **R-J4 MUST** update `.planning/` in the same PR as any change to a shape, route, status, or env var.
- **R-J5 NEVER** commit `node_modules`, `.env`, `.next/out`, `dist/`, uploads, or
  editor folders.
- **R-J6 MUST** add a paragraph to the PR for any new dependency: what it does, why the platform or an
  existing dependency cannot, and its install size. `packages/contracts` stays dependency-free except
  zod.
- **R-J7 NEVER** reformat files you did not otherwise touch.
- **R-J8 MUST** raise a blocker instead of absorbing it silently; a blocked task is reported the same day.

---

## Violations

A rule broken with a written reason in the PR is a discussion. A rule broken silently is a review
reject, and for R-A4, R-B4, R-C1, R-C2, R-D4 it is a release blocker regardless of who wrote it.
