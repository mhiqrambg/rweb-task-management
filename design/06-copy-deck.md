---
document: 06-copy-deck.md
phase: 2
stage: design supplement (fills the copy gap flagged by `.planning/14` §1)
prepared_by: design integrator
reviewed_by: none
sources: [".planning/14-ui-ux-specification.md §1, §6, §7", ".planning/01-requirements.md §3, §7 (A-11, A-13, A-20)", ".planning/06-api-contracts.md §1.3"]
---

# 06 — Copy deck

One string set, imported by both frontends from `packages/contracts/src/copy.ts`. Any string in a
frontend that is not in this file, or is not derived from a record, is a defect (FR-UI-006, FR-AUTH-014).

## 1. Rules

- Sentence case everywhere. No title case in labels or buttons.
- No emoji, no exclamation marks, no trailing arrows on buttons or links.
- An action keeps its name through the flow: button "Delete task" → toast "Task deleted".
- Errors name the field and the fix, never the server, status code, or stack.
- No ellipsis in labels except the search placeholder pattern (`Search tasks`) and progress text.
- Numbers and dates are formatted by the shared `format.ts`, never concatenated in a component.

## 2. Brand and public surface

| Key | String |
|---|---|
| `brand.name` | Task & Notes |
| `brand.valueLine` | Plan tasks, keep notes, and keep the images that belong with them. |
| `landing.intro` | Every task and note lives in one place, with the images attached to the record they belong to. |
| `landing.previewAlt` | A task list with status and priority labels and a row of image thumbnails. |
| `landing.footerBlurb` | A personal task and note workspace with image attachments. |
| `cta.getStarted` | Get started |
| `cta.logIn` | Log in |
| `cta.goToDashboard` | Go to dashboard |

## 3. Authentication

| Key | String |
|---|---|
| `auth.login.title` | Log in |
| `auth.login.submit` | Log in |
| `auth.login.crossLink` | New here? Create an account |
| `auth.register.title` | Create your account |
| `auth.register.submit` | Create account |
| `auth.register.crossLink` | Already have an account? Log in |
| `auth.field.email` | Email |
| `auth.field.password` | Password |
| `auth.hint.password` | 12 characters or more |
| `auth.error.invalidCredentials` | Invalid email or password. |
| `auth.error.emailTaken` | That email is already registered. |
| `auth.error.sessionExpired` | Your session ended. Log in to continue. |
| `auth.error.rateLimited` | Too many attempts. Try again in a few minutes. |
| `auth.logout` | Log out |
| `auth.signedInAs` | Signed in as |

## 4. Navigation and shell

| Key | String |
|---|---|
| `nav.dashboard` | Dashboard |
| `nav.tasks` | Tasks |
| `nav.notes` | Notes |
| `nav.account` | Account |
| `nav.openMenu` | Open menu |
| `nav.closeMenu` | Close menu |
| `nav.current` | Current page |
| `nav.skipToContent` | Skip to content |

## 5. Validation (shared Zod messages, A-11 / A-13)

| Key | String | Rule |
|---|---|---|
| `valid.email.required` | Enter your email. | non-empty |
| `valid.email.format` | Enter a valid email address. | RFC-shaped |
| `valid.password.required` | Enter your password. | non-empty |
| `valid.password.length` | Use at least 12 characters. | 12–128 |
| `valid.title.required` | Enter a title. | task/note title |
| `valid.title.length` | Keep the title to 200 characters or fewer. | 1–200 |
| `valid.description.length` | Keep the description to 5 000 characters or fewer. | task description |
| `valid.body.required` | Enter a note body. | note body |
| `valid.body.length` | Keep the note to 20 000 characters or fewer. | note body |
| `valid.dueDate.invalid` | Enter a real date or clear the field. | real calendar date |
| `valid.priority.invalid` | Choose low, medium, or high. | enum |
| `valid.status.invalid` | Choose to do, in progress, or completed. | enum |
| `valid.unknownField` | This field cannot be changed here. | strict schema |

Field-level messages render under the field, wired with `aria-describedby`; form-level messages render
above the submit button inside `role="alert"`.

## 6. Tasks

| Key | String |
|---|---|
| `task.title` | Tasks |
| `task.new` | New task |
| `task.field.title` | Title |
| `task.field.description` | Description |
| `task.field.status` | Status |
| `task.field.priority` | Priority |
| `task.field.dueDate` | Due date |
| `task.field.dueDate.empty` | No due date |
| `task.field.images` | Images |
| `task.status.todo` | To do |
| `task.status.in_progress` | In progress |
| `task.status.completed` | Completed |
| `task.priority.low` | Low |
| `task.priority.medium` | Medium |
| `task.priority.high` | High |
| `task.overdue` | Overdue |
| `task.updatedAt` | Updated {relative} |
| `task.createdAt` | Created {date} |
| `task.search.label` | Search tasks |
| `task.list.loading` | Loading tasks |
| `task.empty.title` | No tasks yet |
| `task.empty.body` | Create your first task to track a status, a priority, and a due date. |
| `task.noResults.title` | No tasks match these filters |
| `task.noResults.body` | Change the search or clear the filters to see your tasks again. |
| `task.noResults.clear` | Clear filters |
| `task.attachments.none` | No images yet |
| `task.attachments.noneHint` | Add up to 10 JPEG, PNG, or WebP images, 5 MB each. |
| `task.attachments.overflow` | {n} more |
| `task.attachments.add` | Add images |
| `task.attachments.remove` | Remove image |
| `task.attachments.open` | Open image {index} of {count} |
| `task.attachments.loading` | Loading image |
| `task.attachments.broken` | This image could not be loaded |
| `task.attachments.counter` | {index} of {count} |

## 7. Notes

| Key | String |
|---|---|
| `note.title` | Notes |
| `note.new` | New note |
| `note.field.title` | Title |
| `note.field.body` | Body |
| `note.pinned` | Pinned |
| `note.pin` | Pin note |
| `note.unpin` | Unpin note |
| `note.search.label` | Search notes |
| `note.list.loading` | Loading notes |
| `note.empty.title` | No notes yet |
| `note.empty.body` | Write your first note to keep a thought with the images that go with it. |
| `note.noResults.title` | No notes match this search |
| `note.noResults.body` | Clear the search to see your notes again. |
| `note.updatedAt` | Updated {relative} |

## 8. Dashboard

| Key | String |
|---|---|
| `dash.title` | Dashboard |
| `dash.stat.total` | Total tasks |
| `dash.stat.active` | Active |
| `dash.stat.completed` | Completed |
| `dash.stat.totalHint` | To do, in progress, and completed |
| `dash.stat.activeHint` | To do and in progress |
| `dash.stat.completedHint` | Completed tasks |
| `dash.breakdown.status` | By status |
| `dash.breakdown.priority` | By priority |
| `dash.breakdown.overdue` | Overdue |
| `dash.breakdown.overdueHint` | Past due, not completed |
| `dash.recentTasks` | Recently updated tasks |
| `dash.recentNotes` | Recently updated notes |
| `dash.search.label` | Search tasks |
| `dash.viewAll` | View all |
| `dash.empty.tasks` | No tasks yet |
| `dash.empty.notes` | No notes yet |
| `dash.loading` | Loading your dashboard |

## 9. Filters, sorting, pagination

| Key | String |
|---|---|
| `filter.status` | Status |
| `filter.priority` | Priority |
| `filter.due` | Due |
| `filter.hasImages` | Has images |
| `filter.all` | All |
| `filter.due.any` | Any date |
| `filter.due.overdue` | Overdue |
| `filter.due.today` | Today |
| `filter.due.next7` | Next 7 days |
| `filter.due.none` | No due date |
| `filter.applied` | Filters applied |
| `filter.clear` | Clear |
| `sort.label` | Sort by |
| `sort.updated` | Last updated |
| `sort.created` | Created |
| `sort.due` | Due date |
| `sort.priority` | Priority |
| `sort.ascending` | Ascending |
| `sort.descending` | Descending |
| `pagination.loadMore` | Load more |
| `pagination.end` | End of list |

## 10. Shared actions, dialogs, feedback

| Key | String |
|---|---|
| `action.save` | Save changes |
| `action.cancel` | Cancel |
| `action.delete` | Delete |
| `action.retry` | Try again |
| `action.close` | Close |
| `action.edit` | Edit |
| `action.back` | Back |
| `action.previousImage` | Previous image |
| `action.nextImage` | Next image |
| `confirm.deleteTask.title` | Delete this task? |
| `confirm.deleteTask.body` | “{title}” and its images will be deleted. This cannot be undone. |
| `confirm.deleteNote.title` | Delete this note? |
| `confirm.deleteNote.body` | “{title}” and its images will be deleted. This cannot be undone. |
| `confirm.deleteImage.title` | Remove this image? |
| `confirm.deleteImage.body` | Image {index} of {count} will be removed from this {target}. |
| `confirm.confirmDelete` | Delete |
| `toast.taskCreated` | Task created |
| `toast.taskSaved` | Changes saved |
| `toast.taskDeleted` | Task deleted |
| `toast.noteCreated` | Note created |
| `toast.noteSaved` | Changes saved |
| `toast.noteDeleted` | Note deleted |
| `toast.notePinned` | Note pinned |
| `toast.noteUnpinned` | Note unpinned |
| `toast.imageAdded` | Image added |
| `toast.imageRemoved` | Image removed |
| `toast.signedOut` | Signed out |

## 11. Loading, error, empty primitives

| Key | String |
|---|---|
| `state.loading` | Loading |
| `state.error.title` | That did not load |
| `state.error.body` | Check your connection and try again. |
| `state.error.retry` | Try again |
| `state.notFound.title` | Page not found |
| `state.notFound.body` | This page does not exist, or you no longer have access to it. |
| `state.notFound.action` | Back to dashboard |
| `upload.reject.type` | “{filename}” is not a JPEG, PNG, or WebP image. |
| `upload.reject.size` | “{filename}” is larger than 5 MB. |
| `upload.reject.count` | A {target} can hold 10 images. Remove one before adding “{filename}”. |
| `upload.progress` | Uploading {filename}, {percent}% |
| `upload.done` | Images added |
| `upload.partial` | {added} images added. {rejected} were rejected. |
| `dropzone.idle` | Drag images here, or choose files |
| `dropzone.hint` | JPEG, PNG, or WebP. Up to 5 MB each, 10 per {target}. |

## 12. Account

| Key | String |
|---|---|
| `account.title` | Account |
| `account.email` | Email |
| `account.displayName` | Name |
| `account.createdAt` | Member since |
| `account.readOnly` | Email and password changes are not available in this build. |

`{target}`, `{filename}`, `{title}`, `{percent}`, `{count}`, `{n}`, `{date}`, `{relative}` are the only
interpolation tokens in the deck.

## 13. Strings added during the screen build

The frames needed five strings the first pass did not carry. They are added here so the deck and the
design agree; both apps import them from the same module.

| Key | String | Used by |
|---|---|---|
| `state.error.tasks` | Could not load tasks | task list, dashboard task widget |
| `state.error.notes` | Could not load notes | note list, dashboard note widget |
| `state.error.detail` | That did not load | task and note detail |
| `toast.error.save` | Could not save changes. | every form and inline mutation failure |
| `task.attachments.noneShort` | No images | attachment section of list/detail cards |
| `upload.dropTitle` | Drop files to upload | C-12 drag-over |
| `upload.reject.sizeShort` | File is larger than 5 MB | C-12 rejected row (no filename fit) |
| `upload.chooseAnother` | Choose a different file. | C-12 rejected row action |
| `upload.complete` | Upload complete | C-12 complete |
| `upload.addedSummary` | {n} files added | C-12 complete summary |
| `error.form` | Check the highlighted fields and try again. | C-19 form-level |
| `dash.empty.tasksHint` | Tasks you update appear here. | C-16 no-recent |

`state.error.tasks` / `.notes` follow `state.error.detail`'s shape: a short title, then
`state.error.body` ("Check your connection and try again.") and `action.retry`.
