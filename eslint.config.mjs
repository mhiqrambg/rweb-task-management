import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import nextPlugin from '@next/eslint-plugin-next'
import astroPlugin from 'eslint-plugin-astro'

export default tseslint.config(
  // ignore build artifacts & dependencies
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.astro/**', '**/.wrangler/**', '**/out/**'] },

  // base JS rules
  js.configs.recommended,

  // TypeScript rules (non-type-aware = fast)
  ...tseslint.configs.recommended,

  // language options per environment
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
    },
  },

  // Next.js rules — apply to apps/web-next
  {
    files: ['apps/web-next/**/*.{ts,tsx,js,jsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules },
  },

  // Astro rules — apply to apps/web-astro (.astro files need the Astro parser)
  ...astroPlugin.configs['flat/recommended'],

  // allow `any` in test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
)
