/**
 * Route constants and endpoint builders for both frontends (.planning/06 §1.1, §5; §14 §4).
 * No string literal for a path anywhere else.
 */

export const API_PREFIX = '/api/v1';

/** FR-AUTH-004, 06 §2.1: one host-only HttpOnly cookie, the only session state a client holds. */
export const sessionCookieName = 'sid';

export const api = {
  auth: {
    register: `${API_PREFIX}/auth/register`,
    login: `${API_PREFIX}/auth/login`,
    logout: `${API_PREFIX}/auth/logout`,
    me: `${API_PREFIX}/auth/me`,
  },
  users: { me: `${API_PREFIX}/users/me` },
  dashboard: `${API_PREFIX}/dashboard`,
  tasks: `${API_PREFIX}/tasks`,
  task: (id: string) => `${API_PREFIX}/tasks/${encodeURIComponent(id)}`,
  notes: `${API_PREFIX}/notes`,
  note: (id: string) => `${API_PREFIX}/notes/${encodeURIComponent(id)}`,
  attachments: `${API_PREFIX}/attachments`,
  attachment: (id: string) => `${API_PREFIX}/attachments/${encodeURIComponent(id)}`,
  attachmentContent: (id: string, variant: 'thumb' | 'full' = 'thumb') =>
    `${API_PREFIX}/attachments/${encodeURIComponent(id)}/content?variant=${variant}`,
  health: `${API_PREFIX}/health`,
  /** Admin extension (D-12). Never called by either member frontend (FR-ADMIN-006). */
  admin: {
    members: `${API_PREFIX}/admin/members`,
    member: (id: string) => `${API_PREFIX}/admin/members/${encodeURIComponent(id)}`,
  },
} as const;

/** Astro pages (MPA). The Next app mirrors these under /b with a view query (ADR-04). */
export const routes = {
  landing: '/',
  login: '/login',
  register: '/register',
  dashboard: '/app',
  tasks: '/tasks',
  task: (id: string) => `/tasks/${encodeURIComponent(id)}`,
  taskEdit: (id: string) => `/tasks/${encodeURIComponent(id)}/edit`,
  notes: '/notes',
  note: (id: string) => `/notes/${encodeURIComponent(id)}`,
  account: '/account',
  /** Astro-only endpoint: form POST that revokes the session and redirects to login. */
  logout: '/logout',
} as const;

/** Query key order is fixed so a copied list URL is stable (design/05 §5). */
export const TASK_QUERY_KEYS = [
  'q',
  'status',
  'priority',
  'due',
  'hasImages',
  'sort',
  'limit',
  'cursor',
] as const;

export const NOTE_QUERY_KEYS = ['q', 'pinned', 'sort', 'limit', 'cursor'] as const;

/** `next` after login may only point inside the app (14 §6, session expiry row). */
export function safeNextPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/')) return undefined;
  if (value.startsWith('//') || value.startsWith('/_actions') || value.startsWith('/login')) {
    return undefined;
  }
  return value;
}
