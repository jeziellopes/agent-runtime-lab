import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/node_modules/**',
    'results/**'
  ]),

  ...tseslint.configs.recommended,
  // Must stay before the @stylistic block: eslint-config-prettier switches off
  // 180 @stylistic rules, two of which this baseline relies on.
  prettier,

  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var']
        },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        {
          blankLine: 'always',
          prev: ['return', 'throw', 'break', 'continue'],
          next: '*'
        },
        { blankLine: 'always', prev: '*', next: 'return' }
      ],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],

      'max-lines-per-function': [
        'error',
        { max: 70, skipBlankLines: true, skipComments: true }
      ],
      'max-params': ['error', 4],
      'max-nested-callbacks': ['error', 3],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn'
    }
  },

  {
    // Nothing under packages/ may import a framework.
    files: ['packages/**/*.ts', 'agents/**/*.ts', 'scenarios/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'hono', 'hono/*', '@hono/*', 'express'],
              message:
                'packages/ is framework-independent. Framework code belongs in adapters/.'
            }
          ]
        }
      ]
    }
  },

  {
    files: ['**/*.test.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off'
    }
  }
])
