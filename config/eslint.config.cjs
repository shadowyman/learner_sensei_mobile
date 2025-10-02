const js = require('@eslint/js')
const jestPlugin = require('eslint-plugin-jest')
const tsParser = require('@typescript-eslint/parser')

const jestGlobals = Object.fromEntries(
  Object.keys(jestPlugin.environments.globals.globals).map((name) => [name, 'readonly'])
)

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'tmp/**', 'node_modules/**']
  },
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      '**/__mocks__/**/*.{ts,tsx}'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      '**/__mocks__/**/*.{ts,tsx}'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      globals: jestGlobals
    },
    plugins: {
      jest: jestPlugin
    },
    rules: {
      ...js.configs.recommended.rules,
      ...jestPlugin.configs.recommended.rules
    }
  }
]
