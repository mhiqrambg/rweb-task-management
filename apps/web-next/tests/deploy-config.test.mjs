import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Deploy regression: the production Worker must reach the API over the `API` service
// binding (workers.dev Worker-to-Worker fetch is blocked, error 1042). `/` needs no worker
// redirect: an asset match (`out/index.html`) is served before this entry ever runs.
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../worker.ts', import.meta.url), 'utf8');

test('web-next Worker has no root redirect (asset match serves / first)', () => {
	assert.doesNotMatch(worker, /Response\.redirect/);
});

test('web-next Worker has the API service binding', () => {
  assert.match(wrangler, /"binding":\s*"API"/);
  assert.match(wrangler, /"service":\s*"rweb-api-production"/);
});

test('web-next Worker proxies /api before serving static assets', () => {
  const apiBranch = worker.indexOf('API_PREFIX');
  const assetBranch = worker.indexOf('env.ASSETS.fetch');
  assert.ok(apiBranch !== -1 && assetBranch !== -1 && apiBranch < assetBranch);
});
