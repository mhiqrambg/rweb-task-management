import { defineMiddleware } from 'astro:middleware';
import { routes, safeNextPath } from '@taskapp/contracts';
import { applySessionCookie, loadSession } from './lib/server/session';
import { proxyApi } from './lib/server/proxy';
import { isProduction } from './lib/server/env';

/**
 * One session probe per request, then the redirect decision (03 §5.3, 06 §2.3):
 * - no session on an authenticated screen -> /login?next=<same path>
 * - a session on /login or /register     -> next (whitelisted) or the account screen
 *
 * The API remains the authorization authority; this middleware is UX only. It never checks a row.
 */

/** Authenticated screens: everything under the app shell, the task/note screens and the account. */
const PROTECTED_PREFIXES = ['/app', '/tasks', '/notes', '/account'] as const;

/** Every API path the browser reaches (`/api/v1/...`) is forwarded to the API Worker unchanged. */
const API_PREFIX = '/api/';

const PUBLIC_ONLY = new Set<string>([routes.login, routes.register]);

/** Static files are served before the app needs a session; probing them would be waste. */
const STATIC_PREFIXES = ['/_astro/', '/mock-media/'] as const;
const STATIC_FILES = new Set([
  '/icons.svg',
  '/favicon.svg',
  '/landing-illustration.svg',
  '/landing-illustration.png',
]);

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isStatic(pathname: string): boolean {
  return STATIC_FILES.has(pathname) || STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * The page URL a person should return to after signing in: the path plus its real query, minus
 * `_action` (the name of the form action that just ran, which is not a page state).
 */
function pageTarget(url: URL): string {
  const params = new URLSearchParams(url.search);
  params.delete('_action');
  const query = params.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function withSecurityHeaders(response: Response, requestId: string): Response {
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Frame-Options', 'DENY');

  // Astro's node adapter sends `text/html` without a charset; state it so no browser has to guess.
  const contentType = response.headers.get('content-type');
  if (contentType?.startsWith('text/html') && !/charset=/i.test(contentType)) {
    response.headers.set('Content-Type', `${contentType}; charset=utf-8`);
  }

  if (isProduction()) {
    // 07 §6.5: no unsafe-* anywhere. Astro emits external scripts and styles (build.inlineStylesheets
    // is 'never', vite.build.assetsInlineLimit is 0), so 'self' is enough.
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data:",
        "style-src 'self'",
        "script-src 'self'",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
  }

  return response;
}

/**
 * Echo submitted text fields for the page that re-renders after a failed non-JS action, so the
 * person does not lose the email address they typed. Only urlencoded bodies: a multipart upload
 * is buffered by Astro itself and has nothing worth echoing.
 */
async function readFormValues(request: Request): Promise<Record<string, string>> {
  if (request.method !== 'POST') return {};
  if (!request.url.includes('_action=')) return {};

  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/x-www-form-urlencoded')) return {};

  try {
    const form = await request.clone().formData();
    const values: Record<string, string> = {};
    for (const [key, value] of form) {
      if (typeof value === 'string') values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const requestId = crypto.randomUUID();
  context.locals.requestId = requestId;
  context.locals.formValues = {};

  const { pathname } = context.url;

  // `/api/*` is a transparent hop to the API Worker: attachment URLs are relative (06 §3.4) and
  // any client-side call is same-origin, so this Worker has to forward them. The API still makes
  // every access decision; the proxy forwards `Cookie` and `Origin` untouched (07 §6.2).
  if (pathname === '/api' || pathname.startsWith(API_PREFIX)) {
    return withSecurityHeaders(await proxyApi(context.request), requestId);
  }

  if (!isStatic(pathname)) {
    context.locals.formValues = await readFormValues(context.request);

    const { session, setCookie } = await loadSession(context.request);
    if (setCookie) applySessionCookie(context.cookies, setCookie);
    context.locals.session = session;

    if (!session && isProtected(pathname)) {
      const nextPath = safeNextPath(pageTarget(context.url)) ?? routes.dashboard;
      return withSecurityHeaders(
        context.redirect(`${routes.login}?next=${encodeURIComponent(nextPath)}`, 302),
        requestId,
      );
    }

    if (session && PUBLIC_ONLY.has(pathname)) {
      const nextPath = safeNextPath(context.url.searchParams.get('next')) ?? routes.dashboard;
      return withSecurityHeaders(context.redirect(nextPath, 302), requestId);
    }
  }

  const response = await next();
  return withSecurityHeaders(response, requestId);
});
