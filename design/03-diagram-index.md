# 03 — Diagram Index (Phase 2)

Scope: the technical diagrams for `rweb-task-management`. Every diagram is derived from the approved
Phase 1 blueprint; nothing here introduces a service, endpoint, entity, field or screen that is not in
`.planning/`. UI screens are specified in `14-ui-ux-specification.md` and are **not** redrawn here.

Two editable sources exist for each diagram:

- `<name>.mmd` — Mermaid source (portable, reviewable in any Mermaid renderer).
- `<name>.drawio` — native draw.io document: one `<diagram>` page, uncompressed `<mxGraphModel>`, explicit
  page geometry, draw.io calm palette (blue `#EEF4FF/#9DB8F2`, green `#E7F6EC/#8BCB9F`,
  yellow `#FFF6E0/#E8C36A`, orange `#FFF0E5/#F0B48A`, red `#FDECEC/#EBA3A3`, purple `#F3EEFF/#B9A6F0`,
  gray `#F2F4F7/#B8C0CC`, ink `#1B1F24`, edges `#8A94A6`), orthogonal or straight connectors with named
  exit/entry anchors, nodes on a 5 px grid.

Labels are English (Q-03 default) and use the canonical vocabulary of `00` §6: User, Member/owner, Task,
Note, Attachment, Session, Status, Priority. `todo` appears only as the `tasks.status` value.

## 1. Diagram set

| # | Diagram | Purpose | Source sections | Supports | Files |
|---|---|---|---|---|---|
| 01 | System context | Show actors, the one origin, the three deployables, the database, the storage volume and the harness; nothing external is invented | `03` §1, §2; `00` §7; `06` §1.1 | ADR-01, ADR-05, ADR-07, ADR-15; NFR-OBS-004; A-06 | `01-system-context.mmd`, `01-system-context.drawio` |
| 02 | Container / component | Layering and dependency direction `apps/* -> packages/*`, the api's internal modules, one-query-per-list data layer, proxy routing to `/api/v1` | `03` §2, §2.1, §3.1, §3.2; `14` §1 §2 | ADR-01, ADR-03, ADR-05, ADR-09, ADR-11, ADR-12, ADR-15; NFR-REL-004 | `02-container-architecture.mmd`, `02-container-architecture.drawio` |
| 03 | Navigation map | The 11 screens with both route schemes, the auth gate, and the redirect-to-login-then-return edge | `14` §4, §6; `03` §3.1, §3.2 | FR-LAND-003, FR-AUTH-004/006/010, FR-TASK-014, FR-UI; ADR-04, ADR-13 | `03-navigation-map.mmd`, `03-navigation-map.drawio` |
| 04 | Task lifecycle | Task Status state machine, delete cascade to Attachments, Note pin/unpin as a second state group | `05` §1.1, §1.2, §2, §3.5; `06` §2.4, §5.9-5.21, §8.5 | FR-TASK (CRUD, status), FR-NOTE-006, FR-ATT-005/008; NFR-SEC-005 | `04-task-lifecycle.mmd`, `04-task-lifecycle.drawio` |
| 05 | Upload and session flow | One sequence diagram: `sid` cookie -> session -> row ownership -> 404-not-403; multipart two-gate validation, 5 MiB and 10-per-target limits, thumbnail derivation; lightbox full-variant read | `06` §1.9, §2.1-2.5, §5.18-5.21, §8.2-8.5; `05` §3.5 | FR-AUTH-004/006/010/013, FR-ATT-002/004/008/010, FR-TASK-019, FR-NOTE-013; NFR-SEC-005/006/008, NFR-REL-003; ADR-06, ADR-07, ADR-08 | `05-upload-and-session-flow.mmd`, `05-upload-and-session-flow.drawio` |

## 2. Page facts (draw.io artefacts)

| Diagram | Page name | Page size | Vertices | Edges |
|---|---|---|---|---|
| 01 | `01 System context` | 1560 × 760 | 13 | 10 |
| 02 | `02 Container architecture` | 1420 × 1010 | 19 | 23 |
| 03 | `03 Navigation map` | 1660 × 900 | 15 | 18 |
| 04 | `04 Task lifecycle` | 1700 × 620 | 19 | 17 |
| 05 | `05 Upload and session flow` | 1600 × 1320 | 14 | 28 |

Key cell ids (for review or later edits):

- 01 — `visitor`, `member`, `browser`, `proxy`, `boundary`, `astro`, `next`, `api`, `pg`, `storage`,
  `harness`, `outside`; edges `e1`–`e10`.
- 02 — `browser`, `proxy`, `astro`, `next`, `pkgs`, `contracts`, `tokens`, `apibox`, `entry`, `auth`,
  `tasks`, `notes`, `dashboard`, `health`, `att`, `db`, `pg`, `store`; edges `e1`–`e11`, `m0`–`m5`,
  `d0`–`d5`.
- 03 — `landing`, `login`, `register`, `gate`, `dashboard`, `tasklist`, `taskdetail`, `taskedit`,
  `notelist`, `notedetail`, `account`, `notfound`; edges `e1`, `e2`, `e4`–`e18`.
- 04 — regions `r1`, `r2`, `r3`; states `todo`, `inprog`, `done`; `del`; `stored`, `removed`;
  `unpinned`, `pinned`; edges `e1`–`e10`, `a1`–`a4`, `n1`–`n3`.
- 05 — lifelines `lif_b`, `lif_p`, `lif_a`, `lif_d`, `lif_s`; messages `m1`–`m19`; internal gates
  `self1`–`self4`; notes `band_a`, `band_b`, `note_a`, `note_b`.

## 3. What each diagram asserts (source traceability)

**01 — System context.** Visitor and Member are the only actors (`00` §4). One origin, one host: proxy,
`apps/web-astro` (on-demand SSR), `apps/web-next` (static export under `/b`), `apps/api` (Fastify),
Cloudflare D1 (SQLite · Serverless Database) and the `UPLOAD_ROOT` volume. The harness (Playwright/Lighthouse) measures through the same
origin. No external system exists: no email (A-06), no object storage, no CDN, no analytics
(NFR-OBS-004). The proxy is not an authorization point (`03` §1).

**02 — Container architecture.** Dependency direction is `apps/* -> packages/*` only, and packages are
build-time imports with no I/O (`03` §2.1). The proxy routes `/` and form posts to `web-astro`, `/b/*` to
the static export, `/api/v1/*` to `apps/api`, and refuses `/uploads/*` (ADR-05). The api is one process
with six modules and one `db` layer; every module reaches the database only through `db` (ADR-01,
ADR-03). `attachments` is the only module touching the storage volume (ADR-07).

**03 — Navigation map.** Eleven screens from `14` §4, each labelled with its Astro route and its Next
route (`/b/app/?view=...`). Three screens are public; the remaining eight sit behind the auth gate. The
gate resolves on the server for Astro (302 before any protected markup) and after parse for Next (401 ->
route replacement, UX only). `?next=` is the return path, restricted to internal app paths (`14` §6,
session-expiry row). `/tasks/[id]` exists only on the Astro side — on Next it is a query parameter
because a static export cannot pre-render a runtime id (ADR-04).

**04 — Task lifecycle.** `tasks.status` is a closed three-value enum; `POST` creates `todo`, `PATCH`
accepts a single status value, and `DELETE` is reachable from every status and cascades Attachment rows
(`05` §1.1, §3.5). Binaries are unlinked after the transaction commits, so the row is the commit point
(NFR-REL-003). An Attachment is created only after both validation gates pass and is removed either
directly or by target cascade. `notes.pinned` is an independent two-state group; editing a Note's title
or body never changes it (FR-NOTE-006).

**05 — Upload and session flow.** Authorization is resolved in this order: `sid` cookie -> `sha256`
lookup in `sessions` (absolute 7 d, idle 24 h) -> ownership predicate `id = $1 AND user_id =
$sessionUserId` -> `404 NOT_FOUND` for absent **and** foreign rows. Upload applies the limits (one file
part, 5 MiB, 10 per target), gate 1 (magic-byte sniff against `image/jpeg|png|webp`, else 415) and gate 2
(`sharp` decode, else 422), writes full file then thumbnail (longest edge 320 px, WebP), and inserts the
row inside one transaction after a `FOR UPDATE` count check. The lightbox reads
`?variant=full` through the same owner-scoped endpoint with a strong `ETag`, `private, max-age=86400`,
`nosniff`, and `304` on `If-None-Match` (`06` §5.20, §8.2-8.5).

## 4. Verification performed

Executed in this run, against these exact files:

1. **draw.io page listing** — `drawio/list_pages` on each of the five `.drawio` files. All returned one
   page with the expected id and name:

   | File | `index` | `id` | `name` |
   |---|---|---|---|
   | `01-system-context.drawio` | 0 | `d01` | `01 System context` |
   | `02-container-architecture.drawio` | 0 | `d02` | `02 Container architecture` |
   | `03-navigation-map.drawio` | 0 | `d03` | `03 Navigation map` |
   | `04-task-lifecycle.drawio` | 0 | `d04` | `04 Task lifecycle` |
   | `05-upload-and-session-flow.drawio` | 0 | `d05` | `05 Upload and session flow` |

   `list_pages` parses the `.mxfile`; a malformed XML file fails this call. It was run again on
   `03-navigation-map.drawio` after the last edit and still reported page `d03`.

2. **draw.io page read-back** — `drawio/get_page` on `01-system-context.drawio` page `0` returned the
   full uncompressed `<mxGraphModel>` (13 vertices, 10 edges, `pageWidth=1560`, `pageHeight=760`),
   confirming the model is valid, complete and round-trips through draw.io.

3. **Mermaid conversion** — `drawio/open_drawio_mermaid` was called with the exact contents of each
   `.mmd` file. Every call returned a draw.io editor URL carrying a compressed `#create=` payload
   (i.e. a converted diagram, not a blank result): 01, 02 (re-run after the last source edit), 03, 04 and
   05. `postLayout: "elk"` was requested for the three flowcharts (01, 02, 03) because each has ≥3
   endpoints or a back-edge.

4. **XML validity** — every `.drawio` file starts with an XML declaration and contains one `<mxfile>` /
   `<diagram>` / `<mxGraphModel>` / `<root>` chain; all five parse (steps 1-2 are the machine check).

5. **Text checks** — a grep over `design/diagrams` for `TODO|TBD|FIXME|placeholder|lorem|XXX|???`
   returned no matches, and a grep for the banned synonyms `todo item|to-do|memo|task item|note item`
   returned no matches. `todo` occurs only as the `tasks.status` value and as state/edge labels in 04.

6. **Structural check script** — `design/diagrams/verify-drawio.py` (read-only, standard library only)
   re-runs checks 4-5 plus label presence and edge-endpoint resolution:
   `python3 design/diagrams/verify-drawio.py`. **Executed**: all five files parse, every page name
   matches, every vertex has geometry and a label (except the connector dots), every edge endpoint
   resolves, no placeholder or banned vocabulary.
   ```
   01-system-context.drawio          page=01 System context          1560x760   vertices=13 edges=10  OK
   02-container-architecture.drawio  page=02 Container architecture  1420x1010  vertices=19 edges=23  OK
   03-navigation-map.drawio          page=03 Navigation map          1660x900   vertices=15 edges=18  OK
   04-task-lifecycle.drawio          page=04 Task lifecycle          1700x620   vertices=19 edges=17  OK
   05-upload-and-session-flow.drawio page=05 Upload and session flow 1600x1320  vertices=14 edges=28  OK
   all 5 artefacts parsed and checked
   ```
   Two defects were found by this run and fixed in place: `04-task-lifecycle.drawio` had a mismatched
   closing tag (`</mxArray>` for `<Array>`), and the page titles sat at y=16. Off-grid coordinates that
   remain (54 px node heights in 02, note boxes in 05) are reported as warnings, not failures: the 5 px
   grid is an authoring aid, not a deliverable constraint.

## 5. Assumptions and limitations

- Geometry is explicit and authored by hand, not generated; the `.drawio` files are the source of truth
  and `verify-drawio.py` only verifies them.
- No PNG/SVG/PDF export was produced: the draw.io MCP exposes editing, page read/write and Mermaid
  conversion, not raster export. The `.drawio` files are the deliverable.
- The Mermaid sources are drawn with draw.io-friendly syntax (quoted labels, `<br>` breaks, no arrow
  glyphs inside labels). They are semantically equal to the `.drawio` pages; where a page needs a
  container or a self-call that Mermaid cannot express, the `.drawio` file is the fuller of the two
  (regions in 04, internal gate boxes and flow bands in 05).
- 05 does not repeat the login sequence of `03` §4.3 (already specified there); it starts at an
  authenticated request, which is the point where authorization, upload and binary read diverge.
