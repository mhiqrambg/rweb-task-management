declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import('../src/index');
  }
  interface Env {
    DB: D1Database;
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
    ENVIRONMENT?: string;
    APP_ORIGIN?: string;
    SESSION_TTL_DAYS?: string;
    SESSION_IDLE_HOURS?: string;
    SESSION_REFRESH_MINUTES?: string;
  }
}
