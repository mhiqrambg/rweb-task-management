import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const config=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');
test('Next SSG configuration',()=>{assert.match(config,/output:\s*'export'/);assert.doesNotMatch(config,/^\s*basePath:/m);assert.match(config,/unoptimized:\s*true/)});
