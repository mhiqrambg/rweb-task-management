import { loadConfig, type Config, type Env } from './config';

/**
 * Workers `env` + derived `Config` stash. Cloudflare passes `env` per-request to
 * `fetch(request, env, ctx)`, but Elysia's `handle(request)` does not forward it into the handler
 * context. The Worker entry (`index.ts`) calls `setEnv(env)` before delegating to Elysia; handlers
 * read the derived config via `getConfig()`.
 *
 * Safe because a Workers isolate handles one request at a time, so a module-scoped variable cannot
 * be clobbered by a concurrent request.
 */
let _config: Config | null = null;

export function setEnv(env: Env): void {
  _config = loadConfig(env);
}

/** `loadConfig` fails closed when `APP_ORIGIN` is missing, so a missing stash is a defect. */
export function getConfig(): Config {
  if (_config === null) {
    throw new Error('config not initialised — setEnv() must run before the app handles a request');
  }
  return _config;
}
