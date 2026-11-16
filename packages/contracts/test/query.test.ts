import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  noteListHref,
  parseNoteListQuery,
  parseTaskListQuery,
  taskListHref,
  toApiNoteQuery,
  toApiTaskQuery,
} from '../src/index';

/**
 * The list URL state both frontends share (06 §6.6, 14 §4). The absent-`limit` case is a real
 * regression: `Number(null)` is 0, so an unclamped read would request `limit=1` on every default
 * list view.
 */
describe('parseTaskListQuery', () => {
  it('defaults an absent limit to 20 and keeps a valid one', () => {
    expect(parseTaskListQuery(new URLSearchParams('')).limit).toBe(DEFAULT_LIMIT);
    expect(parseTaskListQuery(new URLSearchParams('?limit=5')).limit).toBe(5);
  });

  it('clamps out-of-range and non-numeric limits', () => {
    expect(parseTaskListQuery(new URLSearchParams('?limit=0')).limit).toBe(1);
    expect(parseTaskListQuery(new URLSearchParams('?limit=101')).limit).toBe(MAX_LIMIT);
    expect(parseTaskListQuery(new URLSearchParams('?limit=abc')).limit).toBe(DEFAULT_LIMIT);
    expect(parseTaskListQuery(new URLSearchParams('?limit=')).limit).toBe(DEFAULT_LIMIT);
  });

  it('drops unknown enum values and keeps a known filter', () => {
    const query = parseTaskListQuery(
      new URLSearchParams('?status=done&priority=high&due=next7&hasImages=1&q=%20milk%20'),
    );
    expect(query).toMatchObject({ q: 'milk', status: '', priority: 'high', due: 'next7', hasImages: true });
  });
});

describe('parseNoteListQuery', () => {
  it('defaults the limit, reads pinned=1 as true and keeps updated as the default sort', () => {
    expect(parseNoteListQuery(new URLSearchParams(''))).toMatchObject({
      limit: DEFAULT_LIMIT,
      pinned: null,
      sort: 'updated',
    });
    expect(parseNoteListQuery(new URLSearchParams('?pinned=1')).pinned).toBe(true);
    expect(parseNoteListQuery(new URLSearchParams('?sort=title')).sort).toBe('updated');
  });
});

describe('list hrefs', () => {
  it('round-trips a note query through noteListHref and omits default keys', () => {
    const parsed = parseNoteListQuery(new URLSearchParams('?q=venue&pinned=1&sort=created&limit=5'));
    const href = noteListHref(parsed, '/notes');
    expect(href).toBe('/notes?q=venue&pinned=1&sort=created&limit=5');
    expect(parseNoteListQuery(new URLSearchParams(href.slice('/notes?'.length)))).toEqual(parsed);
  });

  it('keeps a task query round-trippable and never emits empty values', () => {
    const parsed = parseTaskListQuery(new URLSearchParams('?status=todo&hasImages=1&q=offsite'));
    const href = taskListHref(parsed, '/tasks');
    expect(href).toBe('/tasks?q=offsite&status=todo&hasImages=1');
    expect(parseTaskListQuery(new URLSearchParams(href.slice('/tasks?'.length)))).toEqual(parsed);
  });

  it('appends to a base that already carries the screen route', () => {
    const parsed = parseTaskListQuery(new URLSearchParams('?q=sprint'));
    expect(taskListHref(parsed, '/app/?view=tasks')).toBe('/app/?view=tasks&q=sprint');
    expect(taskListHref(parseTaskListQuery(new URLSearchParams('')), '/app/?view=tasks')).toBe(
      '/app/?view=tasks',
    );
    expect(noteListHref(parseNoteListQuery(new URLSearchParams('?q=venue')), '/app/?view=notes')).toBe(
      '/app/?view=notes&q=venue',
    );
  });
});

describe('toApiNoteQuery', () => {
  it('sends no sort for the default view and translates the others', () => {
    expect(toApiNoteQuery(parseNoteListQuery(new URLSearchParams(''))).get('sort')).toBeNull();
    expect(toApiNoteQuery(parseNoteListQuery(new URLSearchParams('?sort=pinned'))).get('sort')).toBe(
      '-pinned,-updated_at',
    );
    expect(toApiNoteQuery(parseNoteListQuery(new URLSearchParams('?sort=created'))).get('sort')).toBe(
      '-created_at',
    );
  });

  it('sends pinned only when set and always carries the limit', () => {
    const params = toApiNoteQuery(parseNoteListQuery(new URLSearchParams('?pinned=1')));
    expect(params.get('pinned')).toBe('true');
    expect(params.get('limit')).toBe(String(DEFAULT_LIMIT));
  });
});

describe('toApiTaskQuery', () => {
  it('maps due presets to the dueState grammar and translates sorts', () => {
    const next7 = toApiTaskQuery(parseTaskListQuery(new URLSearchParams('?due=next7')));
    expect(next7.get('dueState')).toBe('range');
    expect(next7.get('dueTo')! >= next7.get('dueFrom')!).toBe(true);
    const overdue = toApiTaskQuery(parseTaskListQuery(new URLSearchParams('?due=overdue')));
    expect(overdue.get('dueState')).toBe('overdue');
    expect(toApiTaskQuery(parseTaskListQuery(new URLSearchParams('?sort=priority'))).get('sort')).toBe(
      '-priority',
    );
  });
});
