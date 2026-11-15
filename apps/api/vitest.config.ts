import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const TEST_ORIGIN = 'https://app.example.test';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(packageDir, 'migrations'));

  return {
    plugins: [
      cloudflareTest({
        verbose: true,
        wrangler: { configPath: './wrangler.jsonc', environment: 'production' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: 'production',
            APP_ORIGIN: TEST_ORIGIN,
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
    },
  };
});
