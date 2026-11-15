---
document: 01-requirements.md
phase: 1
stage: 2
prepared_by: project-requirements-analyst
reviewed_by: software-architect
persisted_by: software-architect
skills:
  discovered: [backend-development, security-review, diagram-design, tdd, nodejs-backend-patterns, code-review, antislop]
  selected: [backend-development, security-review]
  used: [backend-development, security-review]
  changed:
    - "backend-development: inserted NFR-SEC-008 (parameterized queries) and the 70/20/10 split in NFR-MAINT-003, plus Argon2id parameters in NFR-SEC-001."
    - "security-review: produced the G-2 global rule (server authoritative, browser advisory), the 404-indistinguishability requirement NFR-SEC-005, the CSRF/same-origin requirement NFR-SEC-006, and made security tests run against the API rather than through the UI."
edited_on_persistence: "FE notes condensed where they repeated the acceptance criteria; §10 traceability for brief §3.C-F and §11 handoff notes were authored by the architect from the specialist's FR set (the specialist's mapping was truncated at §3.B in transit). Requirement IDs, priorities, statuses, assumptions A-11..A-21, constraints C-13..C-16, questions Q-07..Q-14 and all acceptance criteria are unchanged."
---

# 01 — Requirements Specification

## 1. Requirement ID scheme

`FR-<AREA>-NNN` for functional, `NFR-<CLASS>-NNN` for non-functional, `J-NN` journeys, `C-NN`
constraints, `A-NN` assumptions, `Q-NN` questions. Areas follow the product, not the frameworks.
Numbers are permanent: a withdrawn requirement is marked `withdrawn`, never reused or renumbered.

| Prefix | Area | IDs used | Count |
|---|---|---|---|
| `FR-LAND` | Public landing page | 001–006 | 6 |
| `FR-AUTH` | Authentication, session, protected access | 001–014 | 14 |
| `FR-DASH` | Dashboard | 001–009 | 9 |
| `FR-TASK` | Task management | 001–021 | 21 |
| `FR-NOTE` | Notes management | 001–013 | 13 |
| `FR-ATT` | Attachments (upload, thumbnail, preview, removal) | 001–012 | 12 |
| `FR-UI` | Shared UI states and parity | 001–012 | 12 |
| `NFR-PERF` | Performance (measured, protocol-bound) | 001–010 | 10 |
| `NFR-SEC` | Security | 001–014 | 14 |
| `NFR-REL` | Reliability, data integrity, failure handling | 001–008 | 8 |
| `NFR-A11Y` | Accessibility | 001–007 | 7 |
| `NFR-MAINT` | Maintainability, contract single-source, test split | 001–007 | 7 |
| `NFR-COMPAT` | Compatibility (browser, viewport, runtime) | 001–005 | 5 |
| `NFR-OBS` | Observability and measurement instrumentation | 001–005 | 5 |
| `NFR-RESEARCH` | Fairness and validity of the comparison | 001–009 | 9 |
| `J` | User journeys | 01–13 | 13 |

**Priority:** `MUST` = required for phase acceptance; `SHOULD` = required unless a documented deviation
is recorded in the parity checklist; `COULD` = optional, but if built it must be identical in both apps.

**Status:** `confirmed` = stated by the brief, the discovery document, or a canonical constant;
`assumed` = a decision this document made because no source states it (restated in §7, questioned in
§9); `needs-clarification` = untestable until a question is answered, with the default named in §9.

**Global rules.**

- **G-1 — One requirement set, two implementations.** Every FR applies to both frontends and to the
  single shared backend; no FR may be satisfied in one app only (C-05, C-07). Per-framework
  requirement IDs are forbidden. Observable rendering-model differences are recorded in the `FE note`
  column of the same FR.
- **G-2 — Server is authoritative, browser is advisory.** Every access rule in §2 is enforced by the
  server. Hiding a button, redirecting early, or filtering client-side does not satisfy an
  authorization requirement; the server response alone decides. Access-control FRs are tested against
  the API, then observed in the UI.

## 2. Roles and permission matrix

Two roles only: no admin, no sharing, no workspace, no public content (00 §4). "Member" always means
*owner of the row*; the authorization axis is `row.user_id = session.user_id`, and there is no second
axis. **`404`** means the fixed not-found semantics: an absent row and a foreign-owned row are
indistinguishable (asserted by NFR-SEC-005).

| # | Capability | Visitor (no session) | Member (owner) |
|---|---|---|---|
| 1 | View landing page | ALLOWED | ALLOWED |
| 2 | View login / register pages | ALLOWED | ALLOWED (offered the dashboard instead) |
| 3 | Register an account | ALLOWED | DENIED — duplicate email rejected; authenticated caller redirected |
| 4 | Log in | ALLOWED | DENIED — no second session created |
| 5 | Log out | DENIED — treated as already logged out | ALLOWED — own session only |
| 6 | View dashboard | DENIED — redirected to login, destination remembered | ALLOWED — own aggregates only |
| 7 | List tasks | DENIED | ALLOWED — own rows only; other users' rows never appear in any page, count, or cursor |
| 8 | Create task | DENIED | ALLOWED — owner from the session, never from the body |
| 9 | View task detail | DENIED | ALLOWED own / `404` non-owned or absent |
| 10 | Edit task | DENIED | ALLOWED own / `404` |
| 11 | Change task status | DENIED | ALLOWED own / `404` |
| 12 | Delete task | DENIED | ALLOWED own / `404`; cascades to its attachments |
| 13 | Search / filter / sort tasks | DENIED | ALLOWED — filter applied to own rows, never after fetching others' |
| 14 | List notes | DENIED | ALLOWED — own rows only |
| 15 | Create note | DENIED | ALLOWED |
| 16 | View note detail | DENIED | ALLOWED own / `404` |
| 17 | Edit note | DENIED | ALLOWED own / `404` |
| 18 | Pin / unpin note | DENIED | ALLOWED own / `404` |
| 19 | Delete note | DENIED | ALLOWED own / `404`; cascades to its attachments |
| 20 | Search notes | DENIED | ALLOWED — own rows only |
| 21 | Upload attachment to a task/note | DENIED | ALLOWED — own target only; foreign target is `404` |
| 22 | View attachment binary (full or thumbnail) | DENIED — no public URL exists | ALLOWED own / `404` non-owned, absent, or removed |
| 23 | Remove an attachment | DENIED | ALLOWED own / `404`; row and binary both cease to be retrievable |
| 24 | Edit own credentials / profile (UI) | DENIED | OUT OF SCOPE — profile read exists at API level only (§8) |
| 25 | Read another user's aggregate counts | DENIED | DENIED — counts are per session owner; no global totals exist |
| 26 | Reach an authenticated page by URL | DENIED — login screen, then return to the requested page (FR-AUTH-008) | ALLOWED own / not-found page for a foreign or absent id |

Notes: (a) rows 1–2 are the entire anonymous surface — no attachment, task, note or statistic content
is reachable without a session, in HTML or in data responses (NFR-SEC-012); (b) roles are never
transmitted by the client — the backend derives owner from the session, and a body field claiming a
different owner is rejected (FR-TASK-001); (c) there is no role table: the per-row ownership check is
the whole model.

## 3. Functional requirements

Legend for `FE note`: **—** = no observable rendering-model difference. A note describes how the same
requirement is met differently; it never relaxes the acceptance criteria.

### 3.1 Landing page (`FR-LAND`)

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-LAND-001 | The app MUST serve a public landing page at the site root containing, in this order: hero with product name and one-line value statement, application introduction, feature highlights (at least tasks with status/priority/due date, notes with pinning, image attachments), product preview, and a call-to-action block. | MUST | confirmed (brief §3.A) | G: an unauthenticated browser requests the root. W: the page is served. T: all five blocks present, in order, with no session cookie required. | — |
| FR-LAND-002 | The landing page MUST offer two primary CTAs — "Get started" (register) and "Log in" — each reachable in one click from the hero and present in the header. | MUST | confirmed | G: visitor on landing page. W: reads the hero. T: both CTAs visible without scrolling at 1440×900; each reaches its form. | — |
| FR-LAND-003 | With a valid session the landing page MUST offer a dashboard CTA instead of the register CTA; without one, the register CTA. | MUST | confirmed (brief §3.B) | G: visitor with a valid session loads the root. T: dashboard CTA present, register CTA absent. G: no session. T: inverse. | Astro resolves this per request from the cookie. Next.js serves one static shell and resolves after hydration: static HTML carries the signed-out CTA only, and the swap MUST NOT shift layout (NFR-PERF-002). |
| FR-LAND-004 | The landing page MUST render identically for all visitors and MUST NOT contain user-specific data in served HTML or build output. | MUST | confirmed (brief §5; NFR-SEC-012) | G: two accounts + one anonymous client request the root. T: byte-identical bodies apart from non-user values; no email, name, id, task or note string appears. | Next.js: export dir grep-clean for dataset values. Astro: same grep on a post-login response; only public markup. |
| FR-LAND-005 | The product preview MUST use static shared non-user imagery and MUST NOT issue a data request to the API. | MUST | confirmed (brief §3.A, §10) | G: landing loaded with network recording. T: zero requests to the API path; preview images from the shared asset set in both apps. | — |
| FR-LAND-006 | The landing page MUST include a footer with product name, one-line description, and login/register links, and MUST not scroll horizontally at 375 px. | MUST | confirmed | G: viewport 375 px. W: scroll horizontally. T: no overflow; footer links present and focusable. | — |

### 3.2 Authentication (`FR-AUTH`)

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-AUTH-001 | The app MUST allow registration with email + password, validating both before any account is created: valid, unique email; password per A-11. | MUST | confirmed (brief §3.B); policy assumed | G: submit `foo@` and `short`. T: no API request; both fields show inline errors; no account exists. G: valid pair. T: account created. | — |
| FR-AUTH-002 | Registration MUST reject an already-registered email with one explicit message, retain the typed email, and clear the password field. | MUST | confirmed | G: existing email + valid password. T: one error naming the email field; email retained; password empty; no second account. | — |
| FR-AUTH-003 | Successful registration MUST create an authenticated session and land the user on the dashboard. | MUST | assumed (A-17; J-01) | G: valid registration. T: dashboard with all-zero counts; reload keeps the session. | — |
| FR-AUTH-004 | Login MUST establish a session identified by an opaque token in an HttpOnly, `SameSite=Lax`, `Path=/` cookie named `sid`, `Secure` in production, with no token exposed to client scripts or client-readable storage. | MUST | confirmed (canonical constants) | G: valid credentials. T: cookie set with those attributes; no token in localStorage/sessionStorage/IndexedDB or any response body; script cannot read the cookie. | — |
| FR-AUTH-005 | Failed login MUST return one generic "invalid email or password" message that does not reveal account existence, retain the typed email, and be rate-limited per NFR-SEC-007. | MUST | confirmed | G: existing email + wrong password. T: generic message. G: unregistered email. T: identical message and no observable difference in field or redirect. | — |
| FR-AUTH-006 | A session MUST survive browser restart and reloads until expiry; the user MUST NOT re-authenticate on every navigation. | MUST | confirmed (brief §3.B); lifetime assumed (A-12) | G: log in, close browser, reopen, request a protected page. T: still authenticated. G: wait past lifetime. T: refused, login shown. | — |
| FR-AUTH-007 | Logout MUST revoke the session server-side, clear `sid`, and make previously loaded protected pages unusable: a later request is refused and Back MUST NOT reveal protected content. | MUST | confirmed | G: activate logout, then Back. T: no task/note content (page re-requests and is refused); a replayed cookie is unusable. | Astro posts and follows a server redirect. Next.js calls the API, clears its client cache, replaces the route. Same browser test applies to both. |
| FR-AUTH-008 | Every protected page MUST require a valid session; an unauthenticated request MUST land on login and, after login, continue to the originally requested destination. | MUST | confirmed (brief §3.B) | G: anonymous client opens a task detail URL. T: login form; after login the same detail is shown. G: task owned by another account. T: not-found outcome. | Astro decides server-side before any HTML. Next.js renders the shell, resolves the session client-side, and replaces the route in the same load, emitting no protected markup. |
| FR-AUTH-009 | Auth state MUST be derived from the server on each navigation or data load; after login/logout the navigation MUST update without a manual reload and be identical in both apps. | MUST | confirmed | G: log in from the login page. T: nav shows logout, no login/register links. G: logout. T: inverse, without refresh. | Next.js revalidates cached session state after each auth transition; Astro reads it per request. |
| FR-AUTH-010 | When a session expires during use, the next protected operation MUST produce one non-silent transition to login with an expiry message, leaving no protected data in the DOM or client caches. | MUST | confirmed | G: session invalidated out-of-band while on a task list; user changes a status. T: login page with the message within that interaction; no task data remains. | Astro: next document request refused and redirected. Next.js: failed call clears cache and replaces the route. |
| FR-AUTH-011 | Login and register MUST cross-link in one click and be reachable from the landing page, and MUST reject an entirely empty form without contacting the API. | MUST | confirmed | G: submit empty login. T: field errors, zero API requests. G: "register" link. T: register form. | — |
| FR-AUTH-012 | The app MUST NOT persist credentials or tokens in browser-readable storage and MUST send the password only to the same-origin auth request. | MUST | confirmed | G: log in while recording network and storage. T: password only in the auth request body; no token/password in storage, URLs or logs. | — |
| FR-AUTH-013 | Logout in one tab MUST invalidate that session for all tabs/devices at their next request; no in-memory cache may keep serving protected data. | MUST | confirmed | G: same account in two tabs; log out in A. T: B is refused and shown login. | — |
| FR-AUTH-014 | Both apps MUST use the same auth copy strings and the same field order. | MUST | confirmed (C-05) | G: capture both login screens. T: identical text, field order, error wording. | One copy deck; asserted by FR-UI-009. |

### 3.3 Dashboard (`FR-DASH`)

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-DASH-001 | The dashboard MUST show three counters for the owner: total tasks, active tasks (`todo` + `in_progress`), completed tasks. | MUST | confirmed (brief §3.C); definition assumed (A-14) | G: 4 todo, 2 in_progress, 3 completed. T: 9 / 6 / 3. G: all completed. T: active shows 0, not blank. | — |
| FR-DASH-002 | Every dashboard figure and list MUST be computed from the owner's rows only and MUST equal the corresponding filtered list result. | MUST | confirmed (00 §4) | G: two owners with different tasks; A loads dashboard. T: B's rows influence no counter; each filtered list total matches its counter. | — |
| FR-DASH-003 | The dashboard MUST show a status breakdown (3 values), a priority breakdown (3 values), and a count of overdue tasks (due before today and not completed). | SHOULD | assumed (A-21) | G: known dataset. T: each of the 7 figures equals the independently computed value; overdue excludes completed. | — |
| FR-DASH-004 | The dashboard MUST list the 5 most recently updated tasks of the owner with title, status, priority, due date when set, and up to 3 thumbnails plus overflow count. | MUST | confirmed (brief §3.C); count assumed (A-14) | G: 12 tasks with distinct update times. T: exactly 5 rows in update order, values matching. G: task with 3 images. T: 3 thumbnails. | — |
| FR-DASH-005 | The dashboard MUST list the 5 most recently updated notes with title, excerpt, pin indicator and thumbnails. | MUST | confirmed (brief §3.C) | G: 8 notes, 1 pinned. T: 5 rows in update order; pinned note marked. | — |
| FR-DASH-006 | The dashboard MUST provide a search input that submits to the task list with the term applied, plus visible navigation to tasks, notes and logout. | MUST | confirmed (brief §3.C) | G: search a term present in one title. T: task list shows only matches, term still in the field. | — |
| FR-DASH-007 | Every authenticated page MUST expose the same primary navigation with the current section indicated, and MUST NOT link to out-of-scope areas. | MUST | confirmed | G: visit dashboard, tasks, notes. T: same items and order; current marked; no dead links. | Astro re-renders nav per document; Next.js keeps it mounted. The indicator must be right after full reload in both. |
| FR-DASH-008 | An account with no tasks and no notes MUST see zero counters (not blanks or placeholder numbers) and one CTA per entity. | MUST | confirmed (brief §3.F) | G: fresh account. T: 0/0/0; empty-state text and both CTAs; no invented sample data. | — |
| FR-DASH-009 | Reloading the dashboard after a create/update/delete elsewhere MUST show current values; no stale counter or row may survive navigation. | MUST | confirmed | G: complete a task, navigate to dashboard. T: completed and active counts reflect it immediately. | Next.js must not serve a cached dashboard payload; Astro re-renders per request. |

### 3.4 Task management (`FR-TASK`)

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-TASK-001 | The app MUST allow the owner to create a task with required `title`, optional `description`, `priority` (`low`\|`medium`\|`high`, default `medium`), `status` (`todo`\|`in_progress`\|`completed`, default `todo`), optional `due_date`. Owner MUST come from the session, never from request input. | MUST | confirmed (brief §3.D; defaults A-14) | G: submit only a title. T: stored as `medium`/`todo`, no due date. G: submit an owner field naming another account. T: ignored or rejected; owner is the session user. | — |
| FR-TASK-002 | Task input MUST be validated: title within A-13 and non-blank after trimming; description within A-13; enums restricted to canonical values; `due_date` a real calendar date or null. Invalid input MUST be rejected with no partial write. | MUST | confirmed (00 §6); limits assumed (A-13) | G: spaces-only title, `priority: "urgent"`, `due_date: 2026-02-30`. T: each rejected with a message naming the field; no row created or modified. | — |
| FR-TASK-003 | The task list MUST show only the owner's tasks, ordered deterministically (default last-updated first), paginated with `limit` + `cursor` returning `nextCursor`; traversal MUST cover the whole set without duplicates or omissions. | MUST | confirmed (brief §3.D) | G: 50 tasks, page size 20. T: 20/20/10 distinct rows; union 50; `offset` not accepted. | — |
| FR-TASK-004 | Each list row MUST display title, status, priority, due date (or an explicit "no due date" state), attachment thumbnail strip, and last-updated time. | MUST | confirmed | G: task with 2 images, due date, `high`. T: all five facts visible without opening the task. | — |
| FR-TASK-005 | A task detail view MUST be reachable by a URL containing the task id and display every stored field plus all attachments. | MUST | confirmed (brief §3.D) | G: open the URL directly while authenticated. T: same content as via the list. G: reload. T: intact. | Both apps must deep-link; Astro resolves per request, Next.js resolves the id client-side. User-visible behaviour must match. |
| FR-TASK-006 | The owner MUST be able to edit title, description, priority, status and due date; changes persist and update the last-updated time. | MUST | confirmed | G: edit title only. T: title changed, other fields untouched, updated time advanced. G: clear the due date. T: stored and shown as none. | — |
| FR-TASK-007 | The owner MUST be able to change status directly from the list and the detail view without the full edit form, persisted across reload. | MUST | confirmed | G: `todo` → `completed` from the list. T: status and treatment update in place; reload persists; dashboard counts change. | Astro may reload the document; Next.js updates in place. Neither may lose the current filter/search state (FR-TASK-014). |
| FR-TASK-008 | Priorities MUST be presented as visible text labels with consistent treatment across apps and MUST NOT rely on colour alone. | MUST | confirmed | G: list containing all three. T: priority readable as text; identical labels and colours in both apps. | — |
| FR-TASK-009 | Statuses MUST use the same canonical wording in both apps, and a status change MUST only accept the three canonical values. | MUST | confirmed | G: send `done` to the API. T: rejected. G: UI control. T: exactly three options with shared labels. | — |
| FR-TASK-010 | Due date MUST be optional and clearable; a task due before today and not completed MUST be marked overdue in list, detail and dashboard with a non-colour indicator. | MUST | confirmed; date-only assumed (A-15) | G: due yesterday, `todo`. T: marker present. G: set completed. T: marker gone. G: clear date. T: "no due date" state. | — |
| FR-TASK-011 | Task search MUST match a case-insensitive substring of title **or** description, trim input, and treat an empty term as no filter. | MUST | confirmed | G: tasks "Buy milk" and "Milk run"; search "MILK". T: both returned. G: search `"  "`. T: unfiltered list. | — |
| FR-TASK-012 | The list MUST support filters for status, priority, due state (overdue / today / range / none) and presence of attachments; multiple filters combine as logical AND. | MUST | confirmed | G: status `todo` AND priority `high`. T: only rows satisfying both. G: add has-attachments. T: subset. | — |
| FR-TASK-013 | The list MUST support sorting by last updated, created, due date and priority in both directions, with a deterministic tiebreak so identical keys never reorder. | MUST | confirmed; tiebreak assumed | G: sort by priority asc then desc. T: canonical order; repeated identical requests return identical order. | — |
| FR-TASK-014 | Search, filters, sort and pagination MUST be encoded in the URL so state survives reload and Back/Forward and can be shared; restoring a URL MUST reproduce the identical result set. | MUST | confirmed (brief §9) | G: apply search+filters, copy URL, reload, open in a new tab. T: identical rows and identical filter chips in all three cases. | The clearest observable divergence: Astro issues a new document per state change; Next.js uses client transitions but must keep the URL authoritative. |
| FR-TASK-015 | When a filter or search yields no rows the list MUST show the no-results state with a one-click way to clear filters, and MUST NOT show the first-task empty state. | MUST | confirmed (brief §3.F) | G: filter matching nothing. T: no-results message + clear-filters; first-task CTA absent. G: clear. T: full list. | — |
| FR-TASK-016 | A task MUST be able to carry zero or more image attachments up to A-07, added at creation or later and removable (see FR-ATT). | MUST | confirmed | G: create with 3 images. T: 3 attachments returned with the task; reload preserves them. | — |
| FR-TASK-017 | Each list row MUST show up to 3 attachment thumbnails plus a "+N" indicator, using the thumbnail rendition (FR-ATT-004), never the full image. | MUST | confirmed (brief §3.D) | G: task with 5 attachments. T: 3 thumbnails + "+2"; no full-resolution binary requested. | — |
| FR-TASK-018 | Creating or editing MUST issue at most one write per user action: a double-activated submit MUST NOT create two tasks or two edits. | MUST | confirmed (brief §3.F) | G: double-click submit on a slow response. T: exactly one task; one success message. | — |
| FR-TASK-019 | Any task operation on an absent or foreign-owned id MUST produce the same not-found outcome with no data, no partial mutation, and no distinguishable message. | MUST | confirmed (00 §4; NFR-SEC-005) | G: owner B attempts detail, edit, status, delete on A's task. T: all four yield the same result as a random id; A's row unchanged. | — |
| FR-TASK-020 | Successful creation MUST show a success confirmation and land on the created task's detail page. | MUST | assumed (target not specified) | G: create a valid task. T: one confirmation; detail page shown with the id in the URL; reload keeps it. | Same destination in both; the mechanism differs, the end state must not. |
| FR-TASK-021 | Deleting a task MUST require a confirmation naming the task, remove it from all lists and counters, and make its detail URL yield not-found afterwards. | MUST | confirmed (brief §3.D, §3.F) | G: delete then cancel. T: task present, no request. G: delete then confirm. T: gone from list, counters updated, detail URL not-found, attachments unretrievable. | — |

### 3.5 Notes management (`FR-NOTE`)

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-NOTE-001 | The app MUST allow the owner to create a note with required `title` and required `body`, plus zero or more image attachments. | MUST | confirmed; body-required assumed (A-13) | G: submit title only. T: rejected naming `body`; nothing created. G: both. T: note created at the top of the list. | — |
| FR-NOTE-002 | Note input MUST be validated for length (A-13) and non-blankness after trimming, rejected without partial write. | MUST | confirmed | G: 20 001-character body. T: rejected with a field error; stored notes unchanged. | — |
| FR-NOTE-003 | The note list MUST show only the owner's notes, pinned first then last-updated descending, paginated with `limit` + `cursor` and `nextCursor`. | MUST | confirmed; ordering assumed | G: 3 pinned, 5 unpinned. T: pinned block first (newest pinned first), then unpinned by update time; cursor traversal covers all without duplicates. | — |
| FR-NOTE-004 | Each note row MUST display title, body excerpt, pinned marker, last-updated time, and thumbnails of its attachments. | MUST | confirmed (brief §3.E) | G: pinned note with 2 images. T: all four facts visible without opening. | — |
| FR-NOTE-005 | A note detail view MUST be reachable by a URL containing the note id and display the full body and all attachments. | MUST | confirmed | G: open the URL directly while authenticated. T: full body, all attachments, pin state; identical to navigating from the list. | Same deep-link rule as FR-TASK-005. |
| FR-NOTE-006 | The owner MUST be able to edit title and body; changes persist, update last-updated, and MUST NOT change pin state. | MUST | confirmed | G: edit the body of a pinned note. T: body changed, still pinned, time advanced, ordering per FR-NOTE-003. | — |
| FR-NOTE-007 | The owner MUST be able to pin and unpin from list and detail; the change persists and is reflected in ordering on the next render. | MUST | confirmed | G: pin from the list. T: moves to the pinned block without manual refresh; reload keeps it. G: unpin. T: back to time order. | Astro may reload the document; Next.js updates in place. Both keep the current search state. |
| FR-NOTE-008 | Note search MUST match a case-insensitive substring of title **or** body, with the same trimming and empty-term behaviour as FR-TASK-011. | MUST | confirmed | G: "Groceries" (body mentions milk) and "Milk plan"; search "milk". T: both returned. G: empty term. T: full list. | — |
| FR-NOTE-009 | Deleting a note MUST require a confirmation naming the note; afterwards it disappears from lists and its detail URL yields not-found. | MUST | confirmed | G: delete then cancel. T: intact, no request. G: delete then confirm. T: removed; detail URL not-found; attachments unretrievable. | — |
| FR-NOTE-010 | A note MUST be able to carry zero or more image attachments up to A-07 with the same upload, validation, thumbnail and removal behaviour as tasks. | MUST | confirmed | G: create with 4 images, remove 1. T: 3 remain, rendered, stable order. | — |
| FR-NOTE-011 | Each note's attachments MUST be previewable full-size from list and detail (FR-ATT-005). | MUST | confirmed | G: note with 2 images in the list; activate a thumbnail. T: lightbox with the full image; closing returns focus. | — |
| FR-NOTE-012 | An account with no notes MUST see an empty state with a creation CTA and no placeholder rows. | MUST | confirmed (brief §3.F) | G: fresh account opens notes. T: empty-state text + CTA; zero rows; no skeleton still visible. | — |
| FR-NOTE-013 | Any note operation on an absent or foreign-owned id MUST yield the same not-found outcome with no data and no partial mutation. | MUST | confirmed (00 §4) | G: owner B attempts read, edit, pin, delete on A's note. T: identical not-found for all four; A's note unchanged. | — |

### 3.6 Attachments (`FR-ATT`)

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-ATT-001 | The owner MUST be able to attach one or more images to a task or note at creation and afterwards, in a single submission containing multiple files. | MUST | confirmed | G: select 3 files and save. T: 3 attachments associated with the target; 3 thumbnails shown. | — |
| FR-ATT-002 | Upload MUST be validated server-side: content type in `image/jpeg`, `image/png`, `image/webp` determined by inspecting content (not filename or client-declared type); size ≤ 5 MB; at most 10 per task/note. Violations MUST be rejected per file, naming the file and reason. | MUST | confirmed (A-07; NFR-SEC-009) | G: text file renamed `.png`; 6 MB PNG; an 11th file. T: each rejected with its own message; target count unchanged. | — |
| FR-ATT-003 | An uploaded attachment MUST be visible on its target (thumbnail in list and detail, full image in the gallery) after the save without a manual refresh. | MUST | confirmed | G: add 2 images to an existing task. T: 2 new thumbnails in the same interaction; reload preserves them. | Astro may reload after the write; the requirement is the end state within the interaction. |
| FR-ATT-004 | List, dashboard and detail thumbnails MUST be served from a downscaled rendition with longest edge ≤ 320 px; list and dashboard MUST NOT request full-resolution binaries. | MUST | assumed (A-16) | G: list with 10 attachments, network recorded. T: every image response is a thumbnail rendition; no full-size binary requested. | — |
| FR-ATT-005 | Activating a thumbnail MUST open an in-page modal/lightbox with the full-resolution image, its dimensions and size, and a close control; Escape and backdrop close it; focus trapped while open and restored to the invoking thumbnail. | MUST | confirmed (brief §3.D, §3.E, §3.F) | G: open, press Tab repeatedly, then Escape. T: focus never leaves; Escape closes and restores focus. G: click backdrop. T: closes. | — |
| FR-ATT-006 | Within a target's lightbox the owner SHOULD move to previous/next attachment via controls and arrow keys, with position shown (e.g. "2 of 5"). | SHOULD | assumed | G: 5 attachments, lightbox on the 2nd, ArrowRight twice. T: "4 of 5"; no wrap-around. | — |
| FR-ATT-007 | The owner MUST be able to remove an attachment; afterwards it disappears from the target and its binary MUST no longer be retrievable by any request. | MUST | confirmed (brief §3.D) | G: remove 1 of 3. T: 2 remain; the old addresses yield not-found; confirmation was required first (FR-UI-007). | — |
| FR-ATT-008 | Attachment binaries (thumbnail and full) MUST be retrievable only within the owner's session; anonymous or non-owner requests MUST yield the same not-found outcome as a nonexistent attachment. | MUST | confirmed (00 §4; NFR-SEC-005) | G: copy full and thumbnail addresses; open privately and in another session. T: not-found in both; no bytes; no distinguishable response. | — |
| FR-ATT-009 | A failed upload MUST NOT leave a visible or retrievable attachment: the target's set is unchanged, the failure is reported per file, and retry works without reloading the form. | MUST | confirmed (brief §3.F) | G: submit 3 files where the 2nd is invalid. T: first and third may persist (A-19); the second is reported by name; no row for it; retry succeeds. | — |
| FR-ATT-010 | Thumbnails MUST declare explicit dimensions (or a fixed aspect-ratio box) so their arrival shifts no layout, and MUST carry text alternatives naming the attachment's target. | MUST | confirmed (NFR-PERF-002, NFR-A11Y-004) | G: load a list throttled. T: no shift from thumbnails; each has a non-empty accessible name. | — |
| FR-ATT-011 | Deleting the containing task or note MUST remove its attachments; neither metadata nor binary may remain retrievable. | MUST | confirmed (NFR-REL-002) | G: task with 3 attachments; delete it; request each address. T: all not-found; no orphan rows in the owner's responses. | — |
| FR-ATT-012 | Attachments MUST be returned and displayed in a stable order (upload order) so the same target renders identically on every load in both apps. | MUST | confirmed | G: 4 attachments, reload 3 times per app. T: identical order and positions every time. | — |

### 3.7 Shared UI states (`FR-UI`)

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-UI-001 | Every data-dependent view MUST render an explicit loading state until data resolves and MUST NOT show an empty state, a zero, or a partial list while loading. | MUST | confirmed (brief §3.F) | G: throttle to Slow 3G and open the task list. T: loading indicator visible; no "no tasks" message and no zero counter before data; indicator removed on arrival. | Where SSG/SPA is most visible: the Next.js shell arrives before data, so the loading state must exist at first paint. |
| FR-UI-002 | The app MUST provide distinct empty states for: no tasks, no notes, no attachments on a target, no results for the current search/filter, and no recent items on the dashboard, each with an explanatory sentence and, where an action exists, a CTA. | MUST | confirmed (brief §3.F) | G: visit all five. T: five distinct messages; the no-results state offers clear-filters; the no-attachments state offers upload. | — |
| FR-UI-003 | A failed data load MUST render an error state with a human-readable message and a retry control; it MUST NOT show raw server text, stack traces, or error codes as the primary message. | MUST | confirmed (brief §3.F; NFR-SEC-013) | G: make the API unreachable, open the list. T: error state with retry; no stack trace or SQL. G: restore, retry. T: list loads without a full reload. | Next.js retry re-issues the client request; Astro retry reloads the document. Same visible result. |
| FR-UI-004 | Every successful mutation (create, update, status change, delete, pin, attachment add/remove) MUST produce non-blocking success feedback with identical wording across apps, auto-dismissing after ≥ 3 s or dismissible. | MUST | confirmed (brief §3.F) | G: perform all six action classes. T: one confirmation each with shared wording; data usable while shown; primary action not obscured. | Next.js shows it in-page; Astro after a reload must still show it. A message lost by reload fails this FR. |
| FR-UI-005 | Form validation MUST appear per field on blur and on submit before any request; a form with an invalid field MUST NOT submit; server-side field errors MUST map onto the same fields. | MUST | confirmed (brief §3.F) | G: type an invalid email, blur, submit. T: one field message on blur; no request while invalid. G: server rejects a field the client accepted. T: message on that field. | — |
| FR-UI-006 | Field-level validation messages MUST be identical between apps (text, field, trigger point) so a parity diff of the forms shows no differences. | MUST | confirmed (C-05) | G: submit identical invalid values to both. T: zero differences in text, position, field association. | Shared schemas and copy deck; asserted by FR-UI-009. |
| FR-UI-007 | Destructive actions MUST require an in-app confirmation dialog naming the target, with Cancel and a destructive-styled Confirm, Cancel focused by default, Escape to cancel, in both apps; native browser dialogs MUST NOT be used. | MUST | confirmed (brief §3.F) | G: activate delete on each entity. T: names the target; Cancel focused; Escape cancels with zero requests; no `window.confirm`/`alert`. | — |
| FR-UI-008 | Both apps MUST be usable from 375 px to 1440 px with no horizontal scrolling and no clipped controls; navigation MUST collapse to a menu below 768 px. | MUST | confirmed (brief §3.F; A-09) | G: render every page at 375/768/1024/1440. T: no overflow; all primary actions reachable; nav menu opens and closes by keyboard. | — |
| FR-UI-009 | A maintained parity checklist MUST enumerate every screen × every state and be executed against both apps before any benchmark run; a difference blocks the run. | MUST | confirmed (C-05, C-07; NFR-RESEARCH-001) | G: run the checklist against both production builds. T: every cell passes in both; the checklist and its result are committed. | The gate that makes "functionally equivalent" testable. |
| FR-UI-010 | All interactive elements MUST be keyboard reachable and operable in a visible focus order, and every focusable control MUST show a visible focus indicator. | MUST | confirmed (NFR-A11Y-001) | G: complete create, filter, status change, preview and delete with keyboard only. T: every action performable; focus always visible. | — |
| FR-UI-011 | Dynamic state changes MUST be announced to assistive technology through a live region without moving focus unexpectedly. | MUST | confirmed (NFR-A11Y-006) | G: with a screen reader, trigger save, error and validation. T: each announced once; focus unchanged. | — |
| FR-UI-012 | A client-knowable rule violation MUST be prevented before submission with the same message the server would return, while the server MUST still enforce the rule. | MUST | confirmed (defence in depth; NFR-SEC-009) | G: select an 11th file on a full target. T: client shows the server's message; no request; a crafted direct request is still rejected. | — |

### 3.8 Admin member management (`FR-ADMIN`, approved extension BCR-01)

These requirements apply to `apps/admin` and the `admin` module of `apps/api` only. They are **outside**
the benchmark surface and outside the SSR-vs-SSG comparison: no admin screen has a counterpart app, so
`FR-UI-006`/`FR-UI-009` parity rules do not cover them.

| ID | Requirement | Pri | Status | Acceptance criteria | FE note |
|---|---|---|---|---|---|
| FR-ADMIN-001 | An authenticated `role='admin'` MUST be able to list members with search by name or email, role and status filters, and cursor pagination. | MUST | confirmed (BCR-01) | G: open `/admin` as an admin. T: page 1 of members, total shown, filters narrow the set, `Load more` appends without duplicates. | SSR page in `apps/admin`; the API returns `AdminMember` (#23). |
| FR-ADMIN-002 | An admin MUST be able to create a member with a display name, email, temporary password, role and status; the temporary password MUST NOT be readable back from any endpoint. | MUST | confirmed (BCR-01) | G: create with a duplicate email. T: `409` and a field message. G: create valid. T: `201`, member appears in the list, no password in any response or log. | — |
| FR-ADMIN-003 | An admin MUST be able to edit a member's display name, role and status; email stays immutable. | MUST | confirmed (BCR-01) | G: change role to Admin and status to Disabled. T: row reflects both; email field is read-only; invalid enum → `422`. | — |
| FR-ADMIN-004 | Disabling a member MUST take effect immediately: outstanding sessions stop working and new logins are refused. Re-enabling MUST restore login without re-creating the account. | MUST | confirmed (BCR-01) | G: disable a member with an active session, reuse that cookie. T: `401` on the next request. G: attempt login. T: refusal. G: re-enable, log in. T: success, data intact. | Checked at session resolution, not only at login. |
| FR-ADMIN-005 | Deleting a member MUST remove the member and their workspace (tasks → notes → attachments, including R2 objects) and MUST require a confirmation dialog naming the member. | MUST | confirmed (BCR-01) | G: delete a member with tasks and attachments. T: confirm names the member; `204`; no row, no binary, no orphan key remains. | Same cascade path as a self-delete (`05` §1.2). |
| FR-ADMIN-006 | Neither member frontend MAY contain an admin route, admin bundle, or admin markup; a caller without `role='admin'` MUST receive the `404` envelope from every admin endpoint and page. | MUST | confirmed (BCR-01, 404-not-403) | G: grep both production builds for `/admin` and admin module names. T: zero hits. G: call #23 with a member session. T: `404`. | Static export purity and route non-disclosure in one rule. |
| FR-ADMIN-007 | An admin MUST NOT be able to demote, disable or delete their own account; the attempt MUST be refused with `409`. | MUST | confirmed (BCR-01) | G: as the only admin, try to demote self. T: `409` and the row unchanged. G: try to delete self. T: `409`. | Self-lockout guard. |
| FR-ADMIN-008 | The admin console MUST reuse the shared tokens, component states, copy deck and accessibility contract; it MUST NOT introduce a second visual language. | MUST | confirmed (BCR-01) | G: compare admin screens to member screens. T: same fonts, spacing, pills, focus rings; every string exists in `design/06-copy-deck.md`. | `design/09-admin-console.md` §4-§6. |

## 4. Non-functional requirements

**Numeric targets.** Every number marked `assumed` is an *unvalidated objective*, not a measurement.
Authoritative performance numbers come from the benchmark protocol (`08`) executed by Erika (C-09,
C-11). "TBD by measurement protocol" means the protocol defines the number and this document does not.

### 4.1 Performance (`NFR-PERF`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-PERF-001 | LCP MUST be measured and reported for each of the eleven benchmark scenarios (S1–S11) on production builds of both apps under identical conditions. | Lighthouse lab run + field run (Playwright + `web-vitals`), median of ≥10 repetitions | TBD by measurement protocol; informational ceiling 2.5 s — **assumed, unvalidated** | MUST | confirmed (brief §2.5, §10) |
| NFR-PERF-002 | CLS MUST be measured and reported per scenario and MUST be zero-onset for data-driven content: images declare dimensions, skeletons occupy the final box, no banner/toast pushes content down. | CLS per scenario, lab and field | Report measured value; ceiling 0.1 assumed, unvalidated. Structural sub-target (0.00 contribution from thumbnails/skeletons/toasts) is a design invariant, not a claim | MUST | confirmed; 0.1 assumed |
| NFR-PERF-003 | INP MUST be measured and reported per interaction scenario (S7–S11) using real interaction measurement, not Lighthouse-only proxying. | INP per scenario, field run | Report measured value; ceiling 200 ms assumed, unvalidated | MUST | confirmed (brief §2.5, §10) |
| NFR-PERF-004 | Network payload MUST be reported per scenario and per app split into document HTML, CSS, JS (transferred/parsed), images, fonts and total, with cache-cold and cache-warm runs distinguished. | Transfer sizes per resource class from the capture | No target: this is the primary explanatory variable of the comparison | MUST | confirmed (brief §2.6, §10) |
| NFR-PERF-005 | Browser payload MUST NOT be presented as total infrastructure traffic; server-side and database-facing traffic MUST be reported separately. | Report sections kept distinct; a conflated run is rejected | Structural requirement | MUST | confirmed (brief §10) |
| NFR-PERF-006 | All benchmark runs MUST execute against production builds of both frontends and a production-mode API — never dev servers with hot reload or default source maps. | Run manifest records build mode per app | Zero dev-mode runs admitted | MUST | confirmed (C-09) |
| NFR-PERF-007 | Both apps MUST be measured behind the same Cloudflare route, host, Worker deployment and database, in the same session, and never while the other app is under load. | Run manifest records route config, host, Worker version id | Identical per scenario for both apps | MUST | confirmed (brief §10) |
| NFR-PERF-008 | Server-render cost MUST be attributable: each app emits server-timing for render and upstream calls, and the API emits per-request timing, so a scenario can be split into server render, network and client work. | Presence and plausibility of timing in responses | Timing on 100 % of rendered documents and API responses | SHOULD | assumed (feeds NFR-OBS-003) |
| NFR-PERF-009 | Data volume MUST NOT silently dominate the comparison: dashboard, task list and notes list are measured with the fixed protocol dataset (A-04) and protocol page size, both recorded per run. | Dataset + page size recorded | One dataset, one page size for both apps | MUST | confirmed (A-04) |
| NFR-PERF-010 | API latency MUST be measured per resource operation and reported with median and spread, so endpoint regressions are detectable before a comparison run. | p50/p95 per operation over a fixed request script | TBD by measurement protocol | MUST | assumed (needed by NFR-RESEARCH-009) |

### 4.2 Security (`NFR-SEC`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-SEC-001 | Passwords MUST be stored only as Argon2id hashes with documented parameters; no plaintext, reversible, MD5/SHA-family, or unsalted storage anywhere. | Inspect the stored representation for a known account; grep hashing calls | Argon2id; parameters recorded in an ADR. Baseline `m=19456 KiB, t=2, p=1` — assumed | MUST | confirmed; parameters assumed |
| NFR-SEC-002 | Session tokens MUST be 32 random bytes from a CSPRNG, opaque to the client, stored server-side only as a SHA-256 hash. | Entropy check; DB shows hash only; a leaked row cannot be replayed | 100 % of sessions | MUST | confirmed |
| NFR-SEC-003 | The `sid` cookie MUST be `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, and never readable by script or duplicated into client storage. | Header inspection; script read attempt | 100 % of auth responses | MUST | confirmed |
| NFR-SEC-004 | Authorization MUST be enforced server-side on every request by combining session user and row owner; client-side hiding MUST never be the only control. | API test suite bypassing the UI for every owned-resource operation | 100 % of operations | MUST | confirmed (G-2, 00 §4) |
| NFR-SEC-005 | Absent and non-owned resources MUST be indistinguishable: same outcome, body shape, and no timing or message difference revealing existence. | Cross-owner matrix test (task, note, attachment binary, thumbnail) | Zero distinguishable responses | MUST | confirmed (IDOR semantics) |
| NFR-SEC-006 | Cookie-authenticated state-changing requests MUST resist CSRF: `SameSite=Lax` plus an origin/site check on unsafe methods; no state change may be reachable by top-level cross-site GET. | Forged cross-origin form/GET against create/update/delete | All rejected, no state change | MUST | confirmed (security review) |
| NFR-SEC-007 | Login and registration MUST be rate-limited per client identity and per targeted email, with backoff that does not reveal account existence, and the limits documented. | Scripted burst of failed logins; observe when throttling starts and what the client sees | Behaviour is the requirement; starting value 5 failures / 15 min per (IP, email) — assumed | MUST | confirmed; threshold assumed |
| NFR-SEC-008 | All database access MUST use parameterized queries; string concatenation of user input into SQL is forbidden. | Review + injection probes on every string-typed input | Zero interpolated queries; probes rejected | MUST | confirmed (`backend-development`) |
| NFR-SEC-009 | Uploads MUST be validated on content: MIME allowlist by sniffing (`image/jpeg`, `image/png`, `image/webp`), size ≤ 5 MB, ≤ 10 per target; stored filenames MUST be server-generated opaque keys, never user filenames, never used for path construction; responses MUST carry a safe content type and disposition; SVG and other active content refused. | Upload battery: renamed executable, polyglot, oversized, traversal filename (`../../x.png`), SVG | 100 % rejected or neutralised; no file written outside the storage root | MUST | confirmed (A-07) |
| NFR-SEC-010 | Attachment binaries MUST never be publicly addressable; every request is authorized as the owning user's request (FR-ATT-008); storage keys MUST NOT be guessable or enumerable. | Anonymous and cross-owner requests against full and thumbnail addresses | All not-found; keys random | MUST | confirmed |
| NFR-SEC-011 | Responses MUST NOT leak internals: no stack traces, SQL text, file paths or framework versions; errors use the fixed envelope with a stable code and human message. | Fuzz malformed requests; inspect error bodies | Zero internal detail; 100 % envelope conformance | MUST | confirmed |
| NFR-SEC-012 | No per-user data may exist in served static HTML, build output, shipped source maps, or the client bundle. | Grep export dir and served documents for seeded dataset values and account emails | Zero occurrences | MUST | confirmed (brief §5) |
| NFR-SEC-013 | Logs MUST NOT contain passwords, session tokens, cookie values or attachment content; logs MUST suffice to reconstruct who did what to which resource id. | Log inspection after an exercised scenario | Zero secrets; resource ids present | MUST | confirmed (security review) |
| NFR-SEC-014 | Production responses MUST include baseline security headers (CSP without untrusted inline script, `X-Content-Type-Options: nosniff`, referrer policy, frame-ancestors denial, HSTS), identical in both apps. | Header inspection on both apps and the API | All present; no CSP violation during the parity run | MUST | assumed (needed for a defensible baseline) |

### 4.3 Reliability and data integrity (`NFR-REL`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-REL-001 | Data invariants MUST be enforced by the database as well as the API: enum values, owner required, attachment size/mime/count, referential integrity to the target. | Direct D1 writes attempting invalid values are refused | 100 % of invariants | MUST | confirmed |
| NFR-REL-002 | Deleting a task/note and its attachments MUST be atomic from the user's perspective: after success nothing is retrievable; after failure nothing is partially removed. | Delete-with-attachments under induced failure, then retrieval attempts | No partial state observable | MUST | confirmed |
| NFR-REL-003 | Attachment write MUST be all-or-nothing per file: a binary without metadata, or metadata without a readable binary, MUST never be served. | Induce storage failure mid-upload; inspect responses and storage | Zero inconsistent pairs surfaced | MUST | confirmed |
| NFR-REL-004 | The API MUST degrade without crashing: with D1 unavailable, requests return the error envelope, the Worker stays alive, and it recovers when the database returns. | Break the D1 binding, issue requests, restore | No crash/restart; recovery without manual intervention | MUST | assumed |
| NFR-REL-005 | Repeated identical requests MUST be safe: repeated delete yields not-found, repeated status change is idempotent, no retry creates a duplicate row. | Replay a captured write and delete | No duplicates; no 5xx | MUST | assumed |
| NFR-REL-006 | Pagination MUST be consistent: following `nextCursor` to exhaustion returns each owned row exactly once even if unrelated rows change between pages. | Traverse while mutating unrelated rows | No duplicates, no silent omissions among unmodified rows | MUST | assumed |
| NFR-REL-007 | A readiness signal reflecting database and storage availability MUST gate the benchmark harness before measurement starts. | Harness gate; readiness false while D1 is unavailable | Ready only when dependencies are usable | MUST | assumed (needed by NFR-PERF-007) |
| NFR-REL-008 | A documented backup and restore of D1 **and** the R2 bucket MUST be performed once and recorded, so the benchmark dataset can be restored between campaigns. | One rehearsed restore into a clean environment | Restored state matches the recorded dataset checksum | SHOULD | assumed |

### 4.4 Accessibility (`NFR-A11Y`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-A11Y-001 | Both apps MUST meet WCAG 2.2 AA on every public and authenticated screen. | Automated audit per screen on both apps + manual keyboard pass | Zero AA violations in the audited rule set | MUST | assumed (no brief target) |
| NFR-A11Y-002 | Text MUST meet 4.5:1 contrast (3:1 for large text and UI boundaries) with identical token values in both apps. | Automated contrast check on tokens and rendered pages | 100 % of text/background pairs | MUST | confirmed (A-09 tokens) |
| NFR-A11Y-003 | Every form control MUST have a programmatically associated label; errors linked to their control; one `h1` and logical heading order. | Accessibility-tree inspection per form | 100 % of controls labelled | MUST | assumed |
| NFR-A11Y-004 | Every image MUST have a text alternative: meaningful for thumbnails (identifying the target), empty for decorative imagery. | Tree inspection across list, detail, lightbox, landing | 100 % | MUST | assumed |
| NFR-A11Y-005 | Modal and lightbox MUST trap focus, close on Escape, restore focus to the invoker, and expose a labelled dialog role. | Keyboard-only scripted pass | 100 % of dialog instances | MUST | confirmed (FR-ATT-005, FR-UI-007) |
| NFR-A11Y-006 | Dynamic changes MUST be announced via a polite live region; nothing may steal focus. | Screen-reader pass over the five state classes | Each change announced once | MUST | assumed |
| NFR-A11Y-007 | Layout MUST remain usable at 200 % text zoom and 320 px width without loss of content or function, and MUST respect `prefers-reduced-motion`. | Zoom pass + media-query check | No clipping or lost action | MUST | assumed |

### 4.5 Maintainability and contract single-sourcing (`NFR-MAINT`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-MAINT-001 | Entity shapes, field names, enum values, validation rules and response types MUST exist in one shared package; neither frontend may redefine an entity type or validator. | Grep for duplicate declarations outside `packages/contracts`; review diff | Zero duplicates; drift is review-blocking | MUST | confirmed (C-05) |
| NFR-MAINT-002 | Both apps MUST use the canonical vocabulary (Task, Note, Attachment, Session, User; `todo`/`in_progress`/`completed`; `low`/`medium`/`high`); synonyms MUST NOT appear in code, copy or schema. | Grep for banned synonyms (`todo item`, `memo`, `file`, `done`, `urgent`) | Zero occurrences | MUST | confirmed (00 §6) |
| NFR-MAINT-003 | The suite MUST follow a roughly 70/20/10 unit/integration/E2E split, and every `MUST` FR MUST have at least one automated test citing its ID. | FR→test mapping report; ratio report | ≥70 % unit, ~20 % integration, ~10 % E2E; 100 % of MUST FRs referenced | MUST | confirmed (`backend-development`) |
| NFR-MAINT-004 | Lint, format and strict type-check MUST pass with zero errors and zero warnings before merge; type checking covers both apps and the shared package in one command. | CI gate on a clean checkout | Exit 0; no suppressed rules hiding `any` at API boundaries | MUST | assumed |
| NFR-MAINT-005 | Framework-specific code MUST be confined to rendering, navigation and data-fetch adapters; feature logic (validation, formatting, transitions, copy) MUST come from shared code. | Review of frontend modules; duplicated-logic grep | No business rule implemented twice | MUST | confirmed (C-05) |
| NFR-MAINT-006 | Copy strings MUST live in one shared deck consumed by both apps; a string added to one app only MUST fail review. | Rendered-text diff across both apps (parity checklist) | Zero differences | MUST | confirmed |
| NFR-MAINT-007 | The repository MUST document how to run both apps and the API against one database from a clean checkout, and that sequence MUST be followed once before the first benchmark. | Fresh-clone run following the README only | Reproducible without tribal knowledge | SHOULD | assumed |

### 4.6 Compatibility (`NFR-COMPAT`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-COMPAT-001 | The benchmark browser MUST be one pinned Chromium build driven by Playwright on one machine, one OS, one viewport, recorded in every run. | Run manifest | Identical across a campaign | MUST | confirmed (A-10) |
| NFR-COMPAT-002 | Both apps MUST function on the current and previous major versions of Chrome, Firefox and Safari at desktop widths, with pinned Chromium as reference. | Manual smoke pass per browser per app | All primary journeys pass | MUST | assumed |
| NFR-COMPAT-003 | Runtime MUST be Cloudflare Workers with the pinned compatibility date and D1 + R2 bindings; frontend toolchain floors (Astro 7 ≥ 22.23.4, Next 16 ≥ 20.9) pinned in the repo and recorded with results. | Version check in CI and run manifest | Pinned and matching | MUST | confirmed (A-08) |
| NFR-COMPAT-004 | Both apps MUST be served from one origin in production (Astro at `/`, Next under `/b`, API under `/api`), so the session cookie is first-party for both. | Deployment inspection; cookie visible to both apps | One origin, one cookie, no CORS preflight in the normal flow | MUST | confirmed (A-03) |
| NFR-COMPAT-005 | Both apps MUST be usable with JavaScript enabled; a no-JavaScript experience is explicitly out of scope and MUST NOT be presented as a difference between the approaches. | Documented exclusion; no no-JS cell in the parity checklist | Stated in both apps' documentation | MUST | assumed |

### 4.7 Observability (`NFR-OBS`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-OBS-001 | The API MUST emit structured logs (one JSON object per request) with method class, route, outcome, duration, request id and acting user id; no bodies, tokens or passwords. | Log sample from an exercised scenario | 100 % of requests logged; zero secrets | MUST | confirmed (NFR-SEC-013) |
| NFR-OBS-002 | Every response MUST carry a request id that also appears in logs and in the error envelope, so a benchmark anomaly traces to a server event. | Correlate a captured id | 100 % correlation | SHOULD | assumed |
| NFR-OBS-003 | Both frontends MUST emit server-timing (or equivalent) for render and upstream calls, and the API per-request timing, so LCP is attributable. | Presence and plausibility of timing values | Present on rendered documents and API responses | SHOULD | assumed (feeds NFR-PERF-008) |
| NFR-OBS-004 | No third-party analytics, tag manager, font CDN or A/B script may be loaded by either app: the measured payload contains application code only. | Network capture shows no third-party origin | Zero third-party requests | MUST | confirmed (brief §10) |
| NFR-OBS-005 | Error rates during benchmark runs MUST be zero before a run's data is admitted; any failed request voids that repetition. | Harness check on response outcomes | 100 % successful responses per admitted repetition | MUST | assumed |

### 4.8 Research validity (`NFR-RESEARCH`)

| ID | Requirement | Metric / verification | Target | Pri | Status |
|---|---|---|---|---|---|
| NFR-RESEARCH-001 | The comparison MUST run only on two apps that pass the parity checklist (FR-UI-009) for the same feature set; a feature present in one app voids the run. | Signed checklist per campaign | 100 % parity cells | MUST | confirmed (C-05, C-07) |
| NFR-RESEARCH-002 | Both apps MUST use the same backend instance, database contents, accounts, dataset, image files and byte sizes for a given scenario. | Run manifest with dataset checksum | Identical per scenario | MUST | confirmed (A-04) |
| NFR-RESEARCH-003 | Network conditions, viewport, browser version, OS and machine MUST be recorded and identical for both apps; a changed condition invalidates the paired comparison. | Run manifest diff | Zero diffs within a pair | MUST | confirmed (A-10) |
| NFR-RESEARCH-004 | Each scenario MUST be repeated ≥10 times per app, cache-cold and cache-warm defined explicitly, the first repetition discarded, and the median with a spread measure (IQR or p95) reported with all raw samples retained. | Raw sample files + summary table | ≥10 repetitions, median + spread, raw archived | MUST | assumed (count is a starting value) |
| NFR-RESEARCH-005 | The protocol MUST define the eleven scenarios S1–S11 (landing, login, dashboard, task list, notes list, task detail, task creation, status update, note create/edit, upload+preview, navigation) with exact steps, so any member can re-run it. | Protocol document + two independent re-runs by different members | Re-runs agree in direction | MUST | confirmed (brief §10) |
| NFR-RESEARCH-006 | The report MUST NOT generalise beyond measured conditions; every claim cites scenario, metric, app, build id and dataset. | Report review against the results table | Every claim traceable | MUST | confirmed |
| NFR-RESEARCH-007 | Browser payload, backend-to-database traffic and total application transfer MUST be reported as separate quantities, never summed into one "network" figure. | Report structure | Three distinct sections | MUST | confirmed (brief §10) |
| NFR-RESEARCH-008 | Lab (Lighthouse) and field (real interaction) measurements MUST be reported separately, and INP MUST NOT be inferred from lab-only data. | Report structure | Per-metric source labelled | MUST | confirmed (brief §10) |
| NFR-RESEARCH-009 | A change to either app after the parity freeze MUST trigger re-runs of the affected scenarios for both apps; results from mismatched build ids MUST NOT be paired. | Build id per run; pairing rule in the results table | Zero mismatched pairs | MUST | assumed |

## 5. User journeys

Each journey names its entry point, the surfaces touched, the API work implied at resource level, its
outcome, and the FRs it exercises. Both apps must satisfy every journey identically (G-1); where the
mechanism differs observably it is noted once.

| ID | Journey | Flow | FRs |
|---|---|---|---|
| J-01 | First-time visitor registers and reaches the dashboard | Landing → "Get started" → register → empty submit (2 field errors, no request) → valid email + password → account + session + cookie → dashboard with 0/0/0 and two empty states. Failure: duplicate email → message, email retained, no session. | FR-LAND-001/002, FR-AUTH-001/002/003, FR-DASH-008, FR-UI-005 |
| J-02 | Returning member logs in | Landing → "Log in" → wrong password (generic message) → correct password → cookie → dashboard → close and reopen browser → still authenticated. Failure: nonexistent account yields the identical message as a wrong password. | FR-LAND-002, FR-AUTH-004/005/006, NFR-SEC-007 |
| J-03 | Member creates a task with three images | Task list → "New task" → title/description/priority/due date + 3 files → client validation → uploads then create (owner from session) → success → created detail with 3 thumbnails → back to list shows 3 thumbnails + all five facts. Failure: 2nd file is a renamed text file → rejected by content sniffing, form still editable, retry works. | FR-TASK-001/002/004/016/017/018/020, FR-ATT-001/002/003/009, FR-UI-012 |
| J-04 | Member filters and searches the task list | 50 tasks → search "milk" (URL carries it) → add status/priority/has-attachments filters (AND) → sort by due date → reload reproduces identical rows and chips → Back restores the previous combination → zero-match filter shows no-results with clear-filters. Failure: API error → error state with retry, filters preserved. | FR-TASK-003/011/012/013/014/015, FR-UI-003 |
| J-05 | Member completes a task | List with an `in_progress` task → inline status change → success feedback → row treatment updates → dashboard shows completed +1, active −1. Failure: task deleted elsewhere → not-found outcome, list refreshed, no phantom row. | FR-TASK-007/009, FR-DASH-001/009, FR-UI-004 |
| J-06 | Member creates a note | Notes list → "New note" → title + 501-char body + 2 images → uploads then create → success → note at the top of the unpinned block → reload persists with thumbnails. Failure: empty body → field error, nothing created. | FR-NOTE-001/002/003/004, FR-ATT-001/003/012, FR-UI-004 |
| J-07 | Member pins a note | Notes list → pin control → note moves to the pinned block with marker → reload keeps it → unpin returns it to time order. Failure: transient failure → note returns to its previous position with an error, no half-pinned visual state. | FR-NOTE-003/007, FR-UI-004 |
| J-08 | Member previews an attachment image | List or detail with 5 thumbnails → activate thumbnail 2 → lightbox with full image, dimensions, size → ArrowRight twice → "4 of 5" → Escape closes and restores focus to thumbnail 2. Failure: binary removed elsewhere → in-dialog error, no broken image. | FR-ATT-004/005/006/008, FR-UI-010, NFR-A11Y-005 |
| J-09 | Member deletes a task with confirmation | Detail with 2 attachments → delete → dialog naming the task, Cancel focused → Escape does nothing → delete again → confirm → cascade → success, counters updated → detail URL not-found, old attachment address not-found. Failure: delete fails → error, task still present and openable, no partial removal. | FR-TASK-021, FR-ATT-011, FR-UI-007, NFR-REL-002 |
| J-10 | Member logs out | Any authed page → logout → server revocation + cookie cleared → landing/login with guest controls → Back shows no protected content → replaying a captured cookie is refused. Failure: revocation fails → error shown, cookie left intact, no fake logout. | FR-AUTH-007/009/013, NFR-SEC-002 |
| J-11 | Session expires mid-use | Authed list, session invalidated out-of-band → status change refused → login with expiry message, no task data left in DOM or cache → log in again → continue to the original destination; the refused change was not applied. | FR-AUTH-008/010 |
| J-12 | Member edits a task and removes one attachment | Detail with 3 attachments → edit title, clear due date, remove attachment 2 (confirm) → save → success, new title, "no due date", 2 thumbnails in stable order → removed address not-found. Failure: update fails after removal succeeded → the member is told exactly what applied; the UI re-reads rather than guessing. | FR-TASK-006/010, FR-ATT-007/012, FR-UI-004 |
| J-13 | Anonymous deep link to a task, then login | Shared task URL in a fresh browser → login page with destination remembered → log in as owner → that detail is shown. Different account → not-found outcome, never another user's data. Failure: malformed/foreign return target → safe fallback to dashboard. | FR-AUTH-008, FR-TASK-005/019, NFR-SEC-005 |

## 6. Constraints

Inherited from `00-project-discovery.md` §8 with the requirement-level consequence of each; C-13..C-16
are new and are cited by FR/NFR rows above.

| ID | Constraint | Requirement-level consequence |
|---|---|---|
| C-01 | Astro frontend MUST be SSR + MPA | FR-AUTH-008/010, FR-TASK-014, FR-UI-001 are satisfied per request; server-side redirects are legitimate |
| C-02 | Next.js frontend MUST be SSG + client-side navigation/data | The same FRs must be satisfied client-side; no FR may require per-user static HTML |
| C-03 | One shared backend: Cloudflare Workers + ElysiaJS + D1 + R2, REST, cookie auth, multipart upload | No FR may assume a per-frontend service, BFF, or server action |
| C-04 | Both frontends consume the same API and DB | Any FR satisfied by framework-specific data access is invalid |
| C-05 | Identical UI/UX, features, data structures, API contracts | G-1; FR-UI-006/009; NFR-MAINT-001/005/006 |
| C-06 | Image binaries outside the database, metadata inside | FR-ATT-004/008/011 stay storage-agnostic; no FR may require Base64 embedding |
| C-07 | No exclusive feature in either frontend | Parity gate FR-UI-009 blocks benchmarking (NFR-RESEARCH-001) |
| C-08 | Planning only in this phase | No implementation instruction beyond testable behaviour |
| C-09 | Benchmark runs use production builds | NFR-PERF-006 |
| C-10 | Team of four with named primary areas | Ownership lives in `10` and `13`, not here |
| C-11 | No fabricated measurements | Every numeric target in §4 is labelled assumed and unvalidated |
| C-12 | Toolchain prerequisites unresolved (pnpm, Cloudflare account credentials, git init, pinning) | No requirement depends on a tool being installed; NFR-MAINT-007 depends on a documented setup sequence existing |
| C-13 | Every user-visible string MUST come from one shared copy deck; adding a string to one app only is a defect. | Makes C-05 checkable by diff instead of opinion (FR-UI-006, NFR-MAINT-006) |
| C-14 | The requirement set is frozen at the parity freeze; any FR added or changed afterwards requires re-baselining both apps and re-running affected scenarios. | Protects comparison validity (NFR-RESEARCH-009) |
| C-15 | No requirement may be satisfied by a framework-specific capability the other framework cannot reproduce (server actions, per-request personalization in the static app). | The comparison isolates the rendering model, not the feature set |
| C-16 | Attachment storage must stay behind an abstraction so a change of binary storage changes no FR's observable behaviour. | Keeps ADR-07 reversible without reopening §3 |

## 7. Assumptions

**Inherited from 00 §11:** A-01 relative-week schedule; A-02 single-tenant owner-only rows; A-03 one
custom origin behind Cloudflare zone routing (makes the `sid` cookie first-party for both apps);
A-04 synthetic dataset per user (50 tasks, 50 notes, 3 images ≤ 1 MB); A-05 four part-time
contributors; A-06 no email verification, reset or email change; A-07 attachments `jpeg|png|webp`,
≤ 5 MB, ≤ 10 per target; A-08 Cloudflare Workers with D1 + R2 bindings, Node 24 LTS locally for
tooling (floors: Astro 7 ≥ 22.23.4, Next 16 ≥ 20.9), pnpm 9; A-09 desktop-first, breakpoints
640/768/1024/1280; A-10 Playwright-pinned Chromium, one viewport.

**Requirement-level assumptions** (each has a matching question in §9):

| ID | Assumption | Why it is needed | Affects | If wrong |
|---|---|---|---|---|
| A-11 | Password policy: 12–128 characters, no composition rules, no rotation. | FR-AUTH-001 needs a testable rule; the brief states none. | FR-AUTH-001 acceptance, validation copy, NFR-SEC-001 | One constant plus copy; no structural change |
| A-12 | Session lifetime: absolute 7 days, sliding on activity, revoked on logout; idle expiry 24 h. | FR-AUTH-006/010 need a boundary. | FR-AUTH-006/010, J-11, the expiry scenario | One configuration value; tests use a short-lived config |
| A-13 | Field limits: task and note title 1–200 chars; task description ≤ 5 000; note body ≤ 20 000; all trimmed and non-blank; note body required. | FR-TASK-002, FR-NOTE-001/002 need concrete limits. | Validation copy, form constraints, DB constraint parity | Constants only |
| A-14 | Defaults: new task `todo`/`medium`; "active" = `todo` + `in_progress`; "recent" = 5 most recently updated. | FR-DASH-001/004/005 and FR-TASK-001 need definitions. | Dashboard figures and list length | Values and one query definition |
| A-15 | `due_date` is a calendar date, no time, no timezone conversion, displayed verbatim. | The overdue rule is untestable across timezones otherwise. | Overdue marker, date input, sorting | A datetime field and timezone policy would be needed |
| A-16 | Thumbnails are a derived rendition with a 320 px longest edge, generated at upload. | FR-ATT-004/017 need an observable bound and payload fairness. | Storage usage, upload time, list payload | Larger payloads; a payload/CLS confound in the comparison |
| A-17 | Registration logs the user in and lands on the dashboard. | FR-AUTH-003, J-01. | One journey step | Remove one step; register then login |
| A-18 | List page size defaults to 20 items per request. | FR-TASK-003/J-04 need a page size; NFR-PERF-009 requires it recorded. | Pagination tests, benchmark payload | Configuration value |
| A-19 | Partial upload outcomes: in a multi-file submission, valid files may persist while invalid ones are rejected per file with their own message. | FR-ATT-009 must define the failure mode. | Upload UX, retry behaviour | All-or-nothing becomes a transaction requirement |
| A-20 | UI language is English only, single locale, no i18n layer. | FR-UI-006 and copy parity need one string set. | All copy, parity diff | A locale layer touches every FR's copy |
| A-21 | The dashboard additionally shows status breakdown, priority breakdown and overdue count. | "task statistics" (brief §3.C) is otherwise unfalsifiable. | Dashboard payload, FR-DASH-003 | Remove one block; no structural change |

## 8. Out of scope

| Item | Reason |
|---|---|
| Multi-tenant workspaces, sharing, collaboration, invitations | A-02 fixes single-tenant; sharing adds a second authorization axis and reopens data + API stages |
| Admin role, moderation | No admin *role in the benchmarked product* (00 §4); account administration ships as the approved extension BCR-01 in its own deployable `apps/admin`, outside the measured surface |
| Email verification | A-06; no email transport in scope |
| Password reset / forgot-password | A-06, Q-04; requires mail transport and a second authentication path to test |
| Email or password change UI | Not a §3 feature; a profile *read* endpoint exists at API level only |
| Password strength meter, MFA, SSO, passkeys | Not required by any §3 feature; would diverge the login interaction |
| Non-image attachments | A-07 allowlist is images only |
| Attachment reordering, captions, alt-text editing | Not in §3; order is fixed (FR-ATT-012) |
| Rich text / Markdown in note bodies | FR-NOTE-001/002 specify plain text; rich text adds a sanitiser and a parity risk |
| Comments, mentions, activity feeds | Collaboration features (see single-tenant) |
| Tags, labels, categories, saved filters, smart lists | Not in §3; search/filter is covered by FR-TASK-011…015 |
| Recurring tasks, subtasks, dependencies, kanban drag-and-drop, calendar view | Not in §3; each adds interactions that confound INP |
| Bulk operations | Not in §3; single-item operations are equally measurable |
| Import/export, printing, PDF reports | Not in §3 |
| Trash, soft delete, restore, version history | Not in §3; FR-TASK-021 and FR-NOTE-009 specify immediate removal |
| Real-time updates, websockets, reminders | Would add a persistent connection and change every page's payload profile |
| Global search across tasks and notes | §3.D/§3.E specify per-entity search only |
| Dark mode / theme switching | Doubles the visual state matrix and parity checklist |
| i18n, multi-language, RTL | A-20, Q-03 |
| Offline support, PWA, service worker | Would invalidate the cache-cold/warm definitions (NFR-RESEARCH-004) |
| Native mobile apps | Brief scope is web; A-09 is desktop-first responsive |
| No-JavaScript operation | NFR-COMPAT-005; the static app cannot function without JS, so a no-JS requirement would create an exclusive feature |
| Third-party analytics, monitoring/error SaaS | NFR-OBS-004; adds payload the benchmark would measure |
| Rate-limit dashboards, audit-log UI | No §3 feature; server-side logging (NFR-OBS-001) suffices |
| Accessibility certification / VPAT | NFR-A11Y-001 targets AA behaviour, not certification |
| Load/soak/penetration testing as a deliverable | The comparison is a fixed-protocol scenario benchmark; security testing is bounded by NFR-SEC-* |
| Seeding UI or demo accounts as a product feature | Dataset generation is a harness concern (A-04) |

## 9. Open questions

Q-01..Q-06 are defined in `00-project-discovery.md` §12 (inherited, not repeated). Requirement-level
questions are defined here and nowhere else:

| ID | Question | Blocks | Default if unanswered |
|---|---|---|---|
| Q-07 | Confirm the password policy (A-11): 12 characters, no composition rules — or does the evaluator expect a specific policy? | FR-AUTH-001 acceptance, NFR-SEC-001, copy | 12–128 chars, no composition rules |
| Q-08 | Confirm session lifetime and sliding behaviour (A-12). | FR-AUTH-006/010, J-11 | 7 days absolute, sliding, idle 24 h, revoked on logout |
| Q-09 | Confirm field limits and that note `body` is mandatory (A-13). | FR-NOTE-001/002, FR-TASK-002 | Limits per A-13; body required |
| Q-10 | Confirm the dashboard statistics set (A-21): all three extra figures, or a subset? | FR-DASH-003, dashboard payload | All three |
| Q-11 | Confirm partial-upload behaviour (A-19): per-file success or all-or-nothing per submission? | FR-ATT-009, upload transaction design | Per-file |
| Q-12 | Confirm that task/note detail must be deep-linkable by id in both apps (this is what forces the Next.js route strategy). | FR-TASK-005, FR-NOTE-005, FR-AUTH-008, J-13 | Yes, deep-linkable |
| Q-13 | Confirm that registration auto-authenticates (A-17). | FR-AUTH-003, J-01 | Auto-login |
| Q-14 | Confirm the thumbnail rendition approach (A-16) despite doubled storage, versus CSS-scaled originals. | FR-ATT-004/017, NFR-PERF-004 interpretation | Derived rendition; CSS-scaled originals would inflate payload and confound the comparison |

## 10. Traceability

Brief §3 bullet → requirement IDs → the document that owns the design of the requirement.

### A. Public landing page

| Brief bullet | FR | Owning doc |
|---|---|---|
| Hero section | FR-LAND-001 | `03` (rendering paths), `14` §3 |
| Application introduction | FR-LAND-001 | `14` §3 |
| Feature highlights | FR-LAND-001 | `14` §3 |
| Product preview | FR-LAND-001, FR-LAND-005 | `03` §3, `14` §1 (shared assets) |
| Call-to-action buttons | FR-LAND-002, FR-LAND-003 | `03` §3 (session-aware CTA), `06` (#4) |
| Login and register navigation | FR-LAND-002/006, FR-AUTH-011 | `14` §4 |
| Footer | FR-LAND-006 | `14` §3 |

### B. Authentication

| Brief bullet | FR | Owning doc |
|---|---|---|
| User registration | FR-AUTH-001/002/003 | `06` (#1), `07` §3 |
| User login | FR-AUTH-004/005 | `06` (#2), `07` §2 |
| User logout | FR-AUTH-007/013 | `06` (#3), `07` §2 |
| Session persistence | FR-AUTH-006/012 | `07` §2, `05` (`sessions`) |
| Authentication state management | FR-AUTH-009/010, FR-LAND-003 | `03` §5 |
| Protected application pages | FR-AUTH-008, FR-TASK-019, FR-NOTE-013 | `03` §5 (authoritative vs advisory), `07` §4 |

### C. Dashboard

| Brief bullet | FR | Owning doc |
|---|---|---|
| Total / active / completed tasks | FR-DASH-001/002 | `06` (#7), `05` (indexes for counts) |
| Task statistics | FR-DASH-003 | `06` (#7) |
| Recent tasks | FR-DASH-004 | `06` (#7), `05` (ordering index) |
| Recent notes | FR-DASH-005 | `06` (#7) |
| Search and navigation | FR-DASH-006/007 | `06` (#7), `14` §4 |

### D. Task management

| Brief bullet | FR | Owning doc |
|---|---|---|
| Create task | FR-TASK-001/002/018/020 | `06` (#9), `05` |
| View task list | FR-TASK-003/004 | `06` (#8), `05` §5 (keyset pagination) |
| View task details | FR-TASK-005/019 | `06` (#10) |
| Edit task | FR-TASK-006 | `06` (#11) |
| Delete task | FR-TASK-021 | `06` (#12), `05` §6 |
| Update task status | FR-TASK-007/009 | `06` (#11) |
| Priorities Low/Medium/High | FR-TASK-008/009 | `06` (schemas), `14` §5 (C-06) |
| Due date | FR-TASK-010 | `05` (`due_date`, NULL ordering) |
| Description | FR-TASK-001/002 | `06` (schemas) |
| Multiple image attachments | FR-TASK-016, FR-ATT-001/002/003 | `06` (#18), `07` §6 |
| Thumbnail previews in lists | FR-TASK-017, FR-ATT-004 | `06` (#20), `08` §6 (payload) |
| Image preview modal/lightbox | FR-ATT-005/006 | `14` §5 (C-11) |
| Remove image attachments | FR-ATT-007/011 | `06` (#21) |
| Search and filtering | FR-TASK-011/012/013/014/015 | `06` (#8), `05` §4 (LIKE search) |

### E. Notes management

| Brief bullet | FR | Owning doc |
|---|---|---|
| Create notes | FR-NOTE-001/002 | `06` (#14) |
| View notes | FR-NOTE-003/004/005 | `06` (#13, #15), `05` §5 |
| Edit notes | FR-NOTE-006 | `06` (#16) |
| Delete notes | FR-NOTE-009 | `06` (#17) |
| Search notes | FR-NOTE-008 | `06` (#13), `05` §4 |
| Pin or favorite notes | FR-NOTE-007/003 | `06` (#16), `05` §5 |
| Add multiple image attachments | FR-NOTE-010 | `06` (#18) |
| Thumbnails in notes lists | FR-NOTE-004, FR-ATT-004 | `06` (#20) |
| Preview attached images | FR-NOTE-011 | `14` §5 (C-11) |

### F. Shared UI states

| Brief bullet | FR | Owning doc |
|---|---|---|
| Loading states | FR-UI-001 | `14` §7, `08` §5 (CLS) |
| Empty states | FR-UI-002, FR-DASH-008, FR-NOTE-012, FR-TASK-015 | `14` §7 |
| Error states | FR-UI-003, NFR-SEC-011 | `14` §7, `06` (error codes) |
| Success feedback | FR-UI-004 | `14` §6 |
| Form validation | FR-UI-005/006/012 | `06` (validation rules), `14` §6 |
| Confirmation dialogs | FR-UI-007 | `14` §5 (C-14) |
| Responsive layouts | FR-UI-008, NFR-A11Y-007 | `14` §3 |
| Parity (both apps identical) | FR-UI-009/010/011 | `09` (parity suite), `14` §9 |
| Admin member management (extension) | FR-ADMIN-001..008 | `design/09-admin-console.md`, `06` §5.23, `05` §3.1 (`role`, `status`) |

### NFR → owning document

| NFR family | Owning doc |
|---|---|
| `NFR-PERF` | `08` (objectives, protocol, measurement) |
| `NFR-SEC` | `07` (controls, enforcement points, threat register) |
| `NFR-REL` | `05` §6-7 (transactions, lifecycle), `07` |
| `NFR-A11Y` | `14` §8, `09` (a11y gate) |
| `NFR-MAINT` | `03` §7-8, `04` (ADR-09/ADR-11/ADR-12), `DEVELOPMENT-GUIDELINES.md` |
| `NFR-COMPAT` | `03` §6 (topology), `04` (ADR-10) |
| `NFR-OBS` | `03` §11 (mechanisms), `07` §8 (logging) |
| `NFR-RESEARCH` | `08` (protocol), `09` (parity gate) |

## 11. Handoff notes for Stages 4-10

- **Architecture (`03`)** is most constrained by FR-AUTH-004/008/010 (cookie + per-request auth),
  FR-TASK-014 (URL-encoded list state), FR-LAND-003/004 (session-aware CTA with no user data in static
  HTML), NFR-COMPAT-004 (one origin) and C-15.
- **Data (`05`)** is most constrained by FR-TASK-003, FR-NOTE-003, FR-TASK-011/012/013 (index and
  cursor design), FR-ATT-011 (cascade), FR-ATT-012 (stable order) and NFR-REL-002/003.
- **API (`06`)** is most constrained by FR-TASK-019 / FR-NOTE-013 / FR-ATT-008 (single not-found
  outcome), FR-UI-006 (shared validation messages), FR-ATT-002 (content sniffing) and the fixed
  envelope/error-code set.
- **Security (`07`)** is most constrained by NFR-SEC-004/005/006/009/010/012 and the authoritative-vs-
  advisory table implied by G-2.
- **Performance (`08`)** is most constrained by NFR-PERF-004/005/006/009, NFR-RESEARCH-001..009 and
  FR-ATT-004 (thumbnail payload).
- **Tests (`09`)** must cover every `MUST` FR (NFR-MAINT-003), the cross-owner matrix
  (NFR-SEC-005), the upload battery (NFR-SEC-009), the parity checklist (FR-UI-009) and the eleven
  scenarios (NFR-RESEARCH-005).
