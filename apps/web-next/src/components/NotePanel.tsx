'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api, copy, fill, formatRelative, noteListHref, parseNoteListQuery, toApiNoteQuery,
  type ItemResponse, type ListResponse, type Note, type NoteListQuery, type NoteListItem,
} from '@taskapp/contracts';
import { requestJson } from '@/lib/api';
import { AttachmentSection } from './AttachmentSection';
import { NoteDeleteDialog, NoteFormDialog, type NoteDraft } from './NoteDialogs';

const NOTES_PATH = '/app/?view=notes';
const LIST_BASE = '/notes';

/** `/app/?view=notes` plus the shared helper's query string, so key order and defaults stay the helper's. */
function notesHref(query: NoteListQuery): string {
  const href = noteListHref({ ...query, cursor: null }, LIST_BASE);
  return href === LIST_BASE ? NOTES_PATH : `${NOTES_PATH}&${href.slice(LIST_BASE.length + 1)}`;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : copy.state.error.body;
}

type ListState = { key: string; items: NoteListItem[]; nextCursor: string | null };
type DetailState = { key: string; note: Note };
type Failure = { key: string; message: string };

export function NotePanel({ id }: { id: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const queryKey = params.toString();
  // Parsed from the URL string so the object is stable while the URL stays the same.
  const query = useMemo(() => parseNoteListQuery(new URLSearchParams(queryKey)), [queryKey]);

  const [revision, setRevision] = useState(0);
  const loadKey = JSON.stringify([id, revision, query.q, query.pinned, query.sort, query.limit]);
  const [list, setList] = useState<ListState | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loadError, setLoadError] = useState<Failure | null>(null);
  const [actionError, setActionError] = useState<Failure | null>(null);
  const [searchEdit, setSearchEdit] = useState<{ forQ: string; value: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<Failure | null>(null);

  const items = !id && list?.key === loadKey ? list.items : null;
  const nextCursor = !id && list?.key === loadKey ? list.nextCursor : null;
  const note = id && detail?.key === loadKey ? detail.note : null;
  const failure = loadError?.key === loadKey ? loadError.message : '';
  const inlineError = actionError?.key === loadKey ? actionError.message : '';
  const pageMoreError = moreError?.key === loadKey ? moreError.message : '';
  const loading = !failure && (id ? !note : !items);
  const pinnedItems = items?.filter((item) => item.pinned) ?? [];
  const restItems = items?.filter((item) => !item.pinned) ?? [];

  // The URL is the source of truth for q (back/forward included); the draft only outlives it while typing.
  const search = searchEdit?.forQ === query.q ? searchEdit.value : query.q;

  // C-21: the typed value replaces the URL 300 ms after the last keystroke.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query.q) return;
    const timer = window.setTimeout(() => {
      router.replace(notesHref({ ...query, q: trimmed }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, query, router]);

  // Every private read goes through requestJson; a 401 is redirected globally.
  useEffect(() => {
    const controller = new AbortController();
    if (id) {
      requestJson<ItemResponse<Note>>(api.note(id), { signal: controller.signal })
        .then((response) => {
          if (!controller.signal.aborted) setDetail({ key: loadKey, note: response.data });
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setLoadError({ key: loadKey, message: messageOf(cause) });
        });
    } else {
      const searchParams = toApiNoteQuery({ ...query, cursor: null });
      requestJson<ListResponse<NoteListItem>>(`${api.notes}?${searchParams.toString()}`, { signal: controller.signal })
        .then((response) => {
          if (!controller.signal.aborted) {
            setList({
              key: loadKey,
              items: response.data,
              nextCursor: response.page?.nextCursor ?? null,
            });
          }
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setLoadError({ key: loadKey, message: messageOf(cause) });
        });
    }
    return () => controller.abort();
  }, [id, loadKey, query]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  function clearSearch() {
    setSearchEdit(null);
    router.replace(notesHref({ ...query, q: '' }));
  }

  async function create(draft: NoteDraft) {
    await requestJson(api.notes, { method: 'POST', body: JSON.stringify({ title: draft.title, body: draft.body }) });
    setCreateOpen(false);
    refresh();
  }

  async function save(draft: NoteDraft) {
    if (!note) return;
    await requestJson(api.note(note.id), {
      method: 'PATCH',
      body: JSON.stringify({ title: draft.title, body: draft.body }),
    });
    setEditOpen(false);
    refresh();
  }

  async function togglePin() {
    if (!note || pinBusy) return;
    setPinBusy(true);
    setActionError(null);
    try {
      await requestJson(api.note(note.id), {
        method: 'PATCH',
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      refresh();
    } catch (cause) {
      setActionError({ key: loadKey, message: messageOf(cause) });
    } finally {
      setPinBusy(false);
    }
  }

  async function remove() {
    if (!note) return;
    await requestJson(api.note(note.id), { method: 'DELETE' });
    setDeleteOpen(false);
    router.replace(NOTES_PATH);
  }

  async function loadMore() {
    const cursor = nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const searchParams = toApiNoteQuery({ ...query, cursor });
      const response = await requestJson<ListResponse<NoteListItem>>(`${api.notes}?${searchParams.toString()}`);
      setList((before) => {
        if (!before || before.key !== loadKey) return before;
        const seen = new Set(before.items.map((item) => item.id));
        return {
          key: loadKey,
          items: [...before.items, ...response.data.filter((item) => !seen.has(item.id))],
          nextCursor: response.page?.nextCursor ?? null,
        };
      });
    } catch (cause) {
      setMoreError({ key: loadKey, message: messageOf(cause) });
    } finally {
      setLoadingMore(false);
    }
  }

  function noteCard(item: NoteListItem) {
    return (
      <article className="card card--hoverable note-card" key={item.id}>
        <h3 className="note-card__title">
          <Link href={`${NOTES_PATH}&id=${encodeURIComponent(item.id)}`}>{item.title}</Link>
        </h3>
        {item.pinned && <span className="badge" data-kind="pin" data-value="pinned">{copy.note.pinned}</span>}
        <p className="note-card__body">{item.excerpt}</p>
        <p className="note-card__meta">
          {fill(copy.note.updatedAt, { relative: formatRelative(item.updatedAt) })}
        </p>
      </article>
    );
  }

  function skeleton() {
    return (
      <div className="stack" role="status">
        <span className="visually-hidden">{copy.note.list.loading}</span>
        <div className="card-grid" aria-hidden="true">
          {[0, 1, 2].map((position) => <div className="skeleton skeleton--card" key={position} />)}
        </div>
      </div>
    );
  }

  function readError() {
    return (
      <div className="error-state" role="alert">
        <h2>{copy.state.error.title}</h2>
        <p className="error-state__body">{failure}</p>
        <button type="button" className="btn" data-variant="secondary" onClick={refresh}>
          {copy.action.retry}
        </button>
      </div>
    );
  }

  if (id) {
    return (
      <>
        {failure ? readError() : loading || !note ? skeleton() : (
          <>
            <header className="detail-head">
              <h1 className="detail-head__title">{note.title}</h1>
              <div className="detail-head__actions">
                <button type="button" className="btn" data-variant="secondary"
                  disabled={pinBusy} aria-busy={pinBusy || undefined} onClick={() => void togglePin()}>
                  {note.pinned ? copy.note.unpin : copy.note.pin}
                </button>
                <button type="button" className="btn" data-variant="secondary" onClick={() => setEditOpen(true)}>
                  {copy.action.edit}
                </button>
                <button type="button" className="btn" data-variant="danger" onClick={() => setDeleteOpen(true)}>
                  {copy.action.delete}
                </button>
              </div>
            </header>
            <div className="stack">
              <div className="detail-meta">
                {note.pinned && <span className="badge" data-kind="pin" data-value="pinned">{copy.note.pinned}</span>}
                <span>{fill(copy.note.updatedAt, { relative: formatRelative(note.updatedAt) })}</span>
              </div>
              {inlineError && <div className="inline-error" role="alert">{inlineError}</div>}
              <div className="detail-body stack">
                {note.body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((paragraph, position) => (
                  <p key={position}>{paragraph}</p>
                ))}
              </div>
            </div>
            <AttachmentSection
              target="note"
              targetId={note.id}
              attachments={note.attachments}
              onChanged={() => setRevision((value) => value + 1)}
            />
            <hr className="divider" />
          </>
        )}
        {editOpen && note && (
          <NoteFormDialog key={note.id} kind="edit" initial={{ title: note.title, body: note.body }}
            onSave={save} onClose={() => setEditOpen(false)} />
        )}
        {deleteOpen && note && (
          <NoteDeleteDialog title={note.title} onConfirm={remove} onClose={() => setDeleteOpen(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div className="page-head__row">
          <h1 className="page-head__title">{copy.note.title}</h1>
          <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label className="visually-hidden" htmlFor="note-search">{copy.note.search.label}</label>
            <input id="note-search" className="field__input" type="search"
              placeholder={copy.note.search.label} value={search}
              onChange={(event) => setSearchEdit({ forQ: query.q, value: event.target.value })} />
          </form>
          <button type="button" className="btn" data-variant="primary" onClick={() => setCreateOpen(true)}>
            {copy.note.new}
          </button>
        </div>
      </header>
      {failure ? readError() : loading ? skeleton() : items && items.length === 0 ? (
        query.q ? (
          <div className="empty-state">
            <h2>{copy.note.noResults.title}</h2>
            <p className="empty-state__body">{copy.note.noResults.body}</p>
            <button type="button" className="btn" data-variant="secondary" onClick={clearSearch}>
              {copy.filter.clear}
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <h2>{copy.note.empty.title}</h2>
            <p className="empty-state__body">{copy.note.empty.body}</p>
            <button type="button" className="btn" data-variant="primary" onClick={() => setCreateOpen(true)}>
              {copy.note.new}
            </button>
          </div>
        )
      ) : items && (
        <div className="stack">
          {pinnedItems.length > 0 && (
            <div className="stack-sm">
              <h2>{copy.note.pinned}</h2>
              <div className="card-grid">{pinnedItems.map(noteCard)}</div>
            </div>
          )}
          {restItems.length > 0 && <div className="card-grid">{restItems.map(noteCard)}</div>}
          {pageMoreError && <div className="inline-error" role="alert">{pageMoreError}</div>}
          {nextCursor && (
            <div className="pagination">
              <button type="button" className="btn" data-variant="secondary"
                disabled={loadingMore} aria-busy={loadingMore || undefined} onClick={() => void loadMore()}>
                {copy.pagination.loadMore}
              </button>
            </div>
          )}
        </div>
      )}
      {createOpen && (
        <NoteFormDialog kind="create" onSave={create} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}
