import { api } from '@taskapp/contracts';
import { Elysia } from 'elysia';
import { getConfig } from '../../context';

/**
 * #22 — readiness only. D-5 (`storage`) waits for the R2 attachment module, so it is not reported
 * until it exists; a fabricated `ok` is worse than an absent field.
 */
export const healthRoutes = new Elysia().get(api.health, async () => {
  try {
    await getConfig().db.prepare('SELECT 1 AS ok').first();
    return { data: { status: 'ok', db: 'ok' } };
  } catch {
    return new Response(
      JSON.stringify({ data: { status: 'degraded', db: 'down' } }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }
});
