import tseslint from 'typescript-eslint'
// @ts-expect-error missing types
import reactHooks from 'eslint-plugin-react-hooks'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
  {
    // Only lint source files, not dist or node_modules
    ignores: ['dist/**', 'node_modules/**', 'tests/e2e/**', 'eslint.config.mjs'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.{ts,tsx}', '*.config.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Hard rule guard: forbid form submission calls in src/
      'no-restricted-syntax': [
        'error',
        {
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

      // Console logging is a warning in all builds
      'no-console': 'warn',
    },
  },
  {
    // Tests may use console freely and are excluded from the submit guard
    files: ['tests/unit/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
)
