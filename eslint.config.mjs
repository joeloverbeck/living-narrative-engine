// eslint.config.mjs

import globals from 'globals';
import js from '@eslint/js';
import pluginJest from 'eslint-plugin-jest';
import pluginJsdoc from 'eslint-plugin-jsdoc';
import eslintConfigPrettier from 'eslint-config-prettier';
// Potentially add: import pluginImport from 'eslint-plugin-import'; // We'll discuss this later

export default [
  // 1. ESLint's recommended rules (applied globally unless overridden)
  js.configs.recommended,

  // 2. Jest plugin and its recommended rules
  {
    files: [
      '**/*.test.js',
      '**/*.spec.js',
      '**/__tests__/**/*.js',
      '**/*.test.mjs',
      '**/*.spec.mjs',
      '**/__tests__/**/*.mjs',
    ], // Adjust patterns as needed
    plugins: {
      jest: pluginJest,
    },
    rules: {
      ...pluginJest.configs['flat/recommended'].rules,
      // You can override or add specific Jest rules here
      // e.g., 'jest/no-disabled-tests': 'warn',
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // 3. JSDoc plugin and its recommended rules (for JavaScript/TypeScript files)
  // This will apply to all .js and .mjs files unless they are ignored by a more specific
  // block's 'ignores' or the global 'ignores'.
  {
    files: ['**/*.js', '**/*.mjs'],
    plugins: {
      jsdoc: pluginJsdoc,
    },
    rules: {
      ...pluginJsdoc.configs['flat/recommended'].rules,
      'jsdoc/empty-tags': 'off',
      'jsdoc/tag-lines': ['warn', 'never', { startLines: 1 }],
      'jsdoc/require-description': 'warn',
      'jsdoc/no-undefined-types': [
        'warn',
        { definedTypes: ['Promise', 'Constructor'] },
      ],
      // 'jsdoc/require-param-description': 'warn',
      // 'jsdoc/require-returns-description': 'warn',
      // 'jsdoc/check-tag-names': ['warn', { definedTags: ['see', 'link', 'example', 'throws'] }],
      // 'jsdoc/require-jsdoc': ['warn', { /* ... your detailed config ... */ }]
    },
  },

  // 4. Global configuration for your BROWSER source files
  {
    files: ['**/*.js', '**/*.mjs'],
    // This 'ignores' will prevent this specific browser-focused config
    // from applying to test files, node scripts, and the llm-proxy-server.
    ignores: [
      '**/*.test.js',
      '**/*.spec.js',
      '**/__tests__/**',
      'scripts/**',
      'llm-proxy-server/**', // Exclude proxy server from browser globals
      'eslint.config.mjs', // Typically, config files don't need browser globals
      'jest.config.js',
      'babel.config.js',
      // Add other specific files/patterns that are JS but not browser app code
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'warn',
      'no-debugger': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  // 5. Configuration for Node.js scripts (e.g., files in your 'scripts' directory)
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Or 'commonjs' if they are CJS
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off', // Console logs are common in scripts
      // Potentially other Node-specific rules
    },
  },

  // 5b. Configuration for the LLM Proxy Server (Node.js environment)
  // This configuration will apply ONLY to files within 'llm-proxy-server/'
  // assuming the global ignores do NOT include 'llm-proxy-server/'
  // OR, you can manage this with a separate eslint.config.mjs inside 'llm-proxy-server/'
  // For now, let's assume you want one root config that also handles this sub-project.
  // If 'llm-proxy-server/' is in the global ignores, this block will not apply.
  // To make it apply, remove 'llm-proxy-server/' from the global ignores below,
  // and rely on this block's 'files' pattern.
  {
    files: ['llm-proxy-server/**/*.js', 'llm-proxy-server/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Or 'commonjs' if its package.json specifies type or files are .cjs
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Node.js specific rules for your proxy server
      'no-console': 'off', // Often enabled for server logs
      // Add any other rules specific to this server environment
    },
  },

  // 6. Prettier - MUST BE LAST to override other formatting rules
  eslintConfigPrettier,

  // 7. Global ignores for the entire project
  // Files and directories listed here will be ignored by ESLint entirely
  // unless a previous configuration block explicitly un-ignores them (which is rare).
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '.DS_Store',
      '*.log',
      'CONTRIBUTING.md',
      'data/',
      'config/', // You added this, assuming it's for non-JS config files or generated files
      // 'llm-proxy-server/', // Add this if you want the root linter to COMPLETELY ignore it.
      // If you want the root linter to process it with specific rules (like block 5b),
      // then REMOVE this line and ensure block 5b's 'files' is correct.
      // For true separation, put an eslint.config.mjs IN llm-proxy-server/.
      // Add any other directories or files that should not be linted
      // e.g., 'vendor/', 'build/', 'temp/'
    ],
  },
];
