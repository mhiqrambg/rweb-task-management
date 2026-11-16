import { base64UrlDecodeText, base64UrlEncodeText } from './ids';

/**
 * Shared piece of the §6.1 cursor contract and §6.6 query grammar, used by every list endpoint
 * (`06` §6.1-§6.6). Endpoint-specific parts — which column each sort key maps to, the WHERE
 * filters, the ORDER BY — stay in that endpoint's repo.
 */

export interface QueryFailure {
  field: string;
  code: string;
  message: string;
}

export function queryFailure(field: string, code: string, message: string): QueryFailure {
  return { field, code, message };
}

/** §6.1 Validation: base64url alphabet, length 16-512. */
export const CURSOR_RE = /^[A-Za-z0-9_-]{16,512}$/;

/** §4 LIKE escaping: the search term is data, never a pattern. */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export type CursorValue = string | number | null;

/** §6.1 Format: base64url(utf8(JSON)) of `{v,s,k}`. Never carries `user_id`. */
export function encodeCursor(sortId: string, keys: CursorValue[]): string {
  return base64UrlEncodeText(JSON.stringify({ v: 1, s: sortId, k: keys }));
}

/** Returns the normalised key value, or `undefined` when the value is not valid for that key. */
export type CursorKeyCheck = (keyId: string, value: unknown) => CursorValue | undefined;

/**
 * §6.1 Validation: alphabet and length, `v === 1`, `s` equal to the requested sort id, arity equal
 * to the requested sort's key count, and every value parsing to its declared type. A forged cursor
 * can only reposition the caller inside their own result set, so this needs no signature.
 */
export function decodeCursor(
  raw: string,
  sortId: string,
  keyOrderIds: string[],
  check: CursorKeyCheck,
): { ok: true; keys: CursorValue[] } | { ok: false } {
  if (!CURSOR_RE.test(raw)) return { ok: false };
  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecodeText(raw));
  } catch {
    return { ok: false };
  }
  if (typeof payload !== 'object' || payload === null) return { ok: false };
  if (!('v' in payload) || !('s' in payload) || !('k' in payload)) return { ok: false };
  const version: unknown = payload.v;
  const sort: unknown = payload.s;
  const keys: unknown = payload.k;
  if (version !== 1 || sort !== sortId || !Array.isArray(keys)) return { ok: false };
  if (keys.length !== keyOrderIds.length) return { ok: false };

  const checked: CursorValue[] = [];
  for (let i = 0; i < keys.length; i++) {
    const keyId = keyOrderIds[i];
    if (keyId === undefined) return { ok: false };
    const value = check(keyId, keys[i]);
    if (value === undefined) return { ok: false };
    checked.push(value);
  }
  return { ok: true, keys: checked };
}

/** Keyset predicate over the ORDER BY expressions, in order: equality on every prefix, one seek on the leaf. */
export function cursorPredicate(
  orderExprs: Array<{ sql: string; dir: 'ASC' | 'DESC' }>,
  keys: CursorValue[],
  bind: (value: CursorValue) => string,
): string {
  const branches: string[] = [];
  for (let i = 0; i < orderExprs.length; i++) {
    const expr = orderExprs[i];
    const leaf = keys[i];
    if (expr === undefined || leaf === undefined) break;
    const parts: string[] = [];
    for (let j = 0; j < i; j++) {
      const prefix = orderExprs[j];
      const prefixKey = keys[j];
      if (prefix === undefined || prefixKey === undefined) break;
      parts.push(`${prefix.sql} IS ${bind(prefixKey)}`);
    }
    if (leaf === null) {
      // A NULL is not a value: `IS NOT NULL` on the equality prefixes is already exact, so the
      // leaf comparison would be wrong and the branch cannot contribute rows (§6.3).
      parts.push('1 = 0');
    } else {
      parts.push(`${expr.sql} ${expr.dir === 'ASC' ? '>' : '<'} ${bind(leaf)}`);
    }
    branches.push(`(${parts.join(' AND ')})`);
  }
  return `(${branches.join(' OR ')})`;
}
