import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    // The app does not use the React Compiler, so only the classic hook rules
    // apply (the compiler-only rules flag patterns that are fine without it).
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Components used only in JSX count as used.
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Hot reload keeps state only for files that export components alone.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // `const { omitted: _, ...rest } = x` drops a field on purpose.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
])
