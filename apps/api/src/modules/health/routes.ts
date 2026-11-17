import { api, type HealthResponse } from '@taskapp/contracts';
import { Elysia } from 'elysia';
import { getConfig } from '../../context';

/**
 * #22 — readiness. D-5: readiness must reflect storage as well as the database, because an API
 * that cannot read an attachment is not ready to serve the screens that show one. The degraded
 * response still carries a **success** envelope (D-5), so a diagnostic is never mistaken for a
 * broken contract.
 */
export const healthRoutes = new Elysia().get(api.health, async () => {
  const { db, bucket } = getConfig();

  let database: HealthResponse['data']['db'] = 'down';
  try {
    await db.prepare('SELECT 1 AS ok').first();
    database = 'ok';
  } catch {
    database = 'down';
  }

  // A list is the cheapest call that proves the binding resolves; it does not read an object.
  let storage: HealthResponse['data']['storage'] = 'down';
  try {
    await bucket.list({ limit: 1 });
    storage = 'ok';
  } catch {
    storage = 'down';
  }

  const ready = database === 'ok' && storage === 'ok';
  return {
    data: { status: ready ? 'ok' : 'degraded', db: database, storage },
    ...(ready ? {} : { status: 503 }),
  };
});
