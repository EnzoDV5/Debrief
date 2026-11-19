import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['**/node_modules/', '**/dist/', '**/coverage/'] },

  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Express error handlers need 4 parameters even when one is unused, so allow `_name`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Server-side code and config files run in Node.
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.js'],
    languageOptions: { globals: globals.node },
  },

  // Browser code: also enforce the Rules of Hooks.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
  },

  // Must be last: turns off stylistic rules that would fight Prettier.
  prettier,
]);
