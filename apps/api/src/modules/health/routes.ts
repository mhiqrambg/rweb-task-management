import { Hono } from 'hono';
import type { AppEnv } from '../../context';

export const healthRoutes = new Hono<AppEnv>();

/**
 * #22 — readiness only. D-5 (`storage`) waits for the R2 attachment module, so it is not reported
 * until it exists; a fabricated `ok` is worse than an absent field.
 */
healthRoutes.get('/api/v1/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({ data: { status: 'ok', db: 'ok' } }, 200);
  } catch {
    return c.json({ data: { status: 'degraded', db: 'down' } }, 503);
  }
});
