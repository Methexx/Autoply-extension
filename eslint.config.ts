import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // Only lint source files, not dist or node_modules
    ignores: ['dist/**', 'node_modules/**', 'tests/e2e/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'manifest.config.ts', 'vite.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript strict rules
      ...tseslint.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Hard rule guard: forbid form submission calls in src/
      // M0-T4: these patterns are caught at lint time
      'no-restricted-syntax': [
        'error',
        {
          // form.submit() or element.submit()
          selector: "CallExpression[callee.property.name='submit']",
          message:
            '[Autoply hard rule] Never call .submit() — the user submits the application themselves.',
        },
        {
          selector: "CallExpression[callee.property.name='requestSubmit']",
          message:
            '[Autoply hard rule] Never call .requestSubmit() — the user submits the application themselves.',
        },
      ],

      // Console logging is a warning in all builds; the build step strips them in prod
      'no-console': 'warn',
    },
  },
  {
    // Tests may use console freely and are excluded from the submit guard
    files: ['tests/unit/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': 'off',
    },
  },
]
