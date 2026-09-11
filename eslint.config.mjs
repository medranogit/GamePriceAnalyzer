import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['out/**', 'dist/**', 'release/**', 'node_modules/**', 'resources/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      // TS já cobre variáveis/tipos indefinidos em tempo de compilação (inclusive tipos
      // ambientes como RequestInit/Electron/__dirname) — no-undef do ESLint não entende
      // esses tipos e gera falso positivo, então fica melhor desligado pra arquivos TS.
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  // Main / preload process (+ configs do próprio projeto): roda em Node, nunca deve
  // ser importado pelo renderer.
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/shared/**/*.ts', '*.config.ts', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  // Renderer: roda no Chromium (browser), e não pode enxergar módulos do main process
  // diretamente — a única ponte permitida é window.api, exposta pelo preload.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser }
    },
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', '**/main/**', '@main/*'],
              message:
                'O renderer não pode importar código do main process diretamente — use window.api (exposto pelo preload).'
            }
          ]
        }
      ]
    }
  },
  prettierConfig
]
