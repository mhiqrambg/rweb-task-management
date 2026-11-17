import type { APIRoute } from 'astro';
import { routes } from '@taskapp/contracts';
import { logout as endSession } from '../lib/server/auth';
import { applySessionCookie, cookieHeader } from '../lib/server/session';

/**
 * Logout endpoint for the shell (sidebar and drawer) and the account page.
 *
 * A route, not an action: the logout form lives in `AppLayout`, and returning `Astro.redirect`
 * from a layout renders that component's body instead of terminating the response — measured as a
 * 200 with a cleared cookie, which left the browser on the page. A page or endpoint is the only
 * place a redirect becomes the response, so the POST terminates here.
 *
 * Astro actions enforced same-origin for every unsafe method; an endpoint has to state it. Forms
 * always carry `Origin` (modern browsers) or `Sec-Fetch-Site`; anything else is refused.
 */
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const origin = request.headers.get('origin');
  const sameSite = origin
    ? origin === url.origin
    : request.headers.get('sec-fetch-site') === 'same-origin';
  if (!sameSite) return new Response(null, { status: 403 });

  // The API revokes the row and issues the cleared cookie; mirror it even when the session was
  // already spent (401), because ending in the logged-out state is the correct outcome either way.
  const { setCookie } = await endSession(cookieHeader(request));
  applySessionCookie(cookies, setCookie);
  return redirect(`${routes.login}?toast=signedOut`, 303);
};
