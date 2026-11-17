declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import('../src/index');
  }
  interface Env {
    DB: D1Database;
    /** Local attachment storage under `.wrangler/state/v3/r2` (T-507). */
    BUCKET: R2Bucket;
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
    ENVIRONMENT?: string;
    APP_ORIGIN?: string;
    APP_ORIGIN_NEXT?: string;
    SESSION_TTL_DAYS?: string;
    SESSION_IDLE_HOURS?: string;
    SESSION_REFRESH_MINUTES?: string;
  }
}