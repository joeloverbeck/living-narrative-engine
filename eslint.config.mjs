// eslint.config.js

import globals from 'globals';
import js from '@eslint/js';
import pluginJest from 'eslint-plugin-jest';
import pluginJsdoc from 'eslint-plugin-jsdoc'; // Added eslint-plugin-jsdoc
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  js.configs.recommended, // ESLint's recommended rules [cite: 967]
  pluginJest.configs['flat/recommended'], // Recommended rules for Jest [cite: 967]
  pluginJsdoc.configs['flat/recommended'], // Recommended rules for JSDoc [cite: 987]
  eslintConfigPrettier, // Disables ESLint rules conflicting with Prettier [cite: 967]
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      // Ensure plugins are explicitly registered if not automatically by configs
      jest: pluginJest,
      jsdoc: pluginJsdoc,
    },
    rules: {
      // Common overrides
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // JSDoc specific rules can be configured here if needed,
      // for example, to enforce certain JSDoc styles or requirements
      // beyond the 'recommended' set.
      // Example:
      // 'jsdoc/require-param-description': 'warn',
      // 'jsdoc/require-returns-description': 'warn',
      // 'jsdoc/check-tag-names': ['warn', { definedTags: ['see', 'link'] }], // Allow specific non-standard tags if used
      // 'jsdoc/require-jsdoc': ['warn', { // To enforce JSDoc on certain constructs
      //     publicOnly: true, // Only for exported items
      //     require: {
      //         FunctionDeclaration: true,
      //         MethodDefinition: true,
      //         ClassDeclaration: true,
      //         ArrowFunctionExpression: true,
      //         FunctionExpression: true,
      //     }
      // }]
    },
  },
  {
    // This configuration ensures that ESLint ignores common directories.
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '.DS_Store',
      '*.log',
      'CONTRIBUTING.md', // Markdown files are not linted by ESLint for JS
      // "data/" // Add if you have example data files you don't want linted
    ],
  },
];
