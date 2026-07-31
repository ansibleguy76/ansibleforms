import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'

export default defineConfig([
  // persistent/ is runtime state and schema/ is JSON, neither is source.
  globalIgnores(['persistent/**', 'coverage/**']),
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // the codebase deliberately swallows errors in a lot of best-effort
      // paths (`catch(e){}`), so caught bindings and empty catch blocks are
      // idiomatic here rather than oversights.
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
])
