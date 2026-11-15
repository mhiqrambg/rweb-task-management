import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every page must declare `export const prerender = false` (ADR-13): `output: 'server'` makes
 * on-demand the default, but a future global default flip could silently prerender a per-user page
 * and leak session-dependent markup into a static export. The declaration is the guard; this test
 * is what the architecture docs (`03` §3.1) cite.
 */

const PAGES_DIR = join(__dirname, '../pages');
const DECLARATION = 'export const prerender = false;';
const PAGE_NAMES = readdirSync(PAGES_DIR)
  .filter((name) => name.endsWith('.astro'))
  .sort();

describe('every page is on-demand (prerender = false)', () => {
  it('finds at least one page', () => {
    expect(PAGE_NAMES.length).toBeGreaterThan(0);
  });

  it.each(PAGE_NAMES)('%s declares prerender = false', (name) => {
    const source = readFileSync(join(PAGES_DIR, name), 'utf8');
    expect(source, `${name} must declare "${DECLARATION}"`).toContain(DECLARATION);
  });
});
