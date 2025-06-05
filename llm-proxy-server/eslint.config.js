// llm-proxy-server/eslint.dependencyInjection.js
import eslintJs from '@eslint/js';
import pluginJest from 'eslint-plugin-jest';
import pluginJsdoc from 'eslint-plugin-jsdoc';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // 1. Global ignores (can also be in .eslintignore)
  {
    ignores: ['node_modules/', 'coverage/', 'dist/', '*.log', '.env'],
  },

  // 2. Base configuration for all JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node, // Node.js global variables
      },
    },
    plugins: {
      jsdoc: pluginJsdoc,
    },
    settings: {
      // Settings for plugins like jsdoc
      jsdoc: {
        mode: 'typescript', // Enables parsing of more JSDoc tags similar to TypeScript
      },
    },
    rules: {
      // Start with ESLint's recommended rules
      ...eslintJs.configs.recommended.rules,
      // Add or override JSDoc recommended rules (pluginJsdoc.configs.recommended.rules is an alternative starting point)
      // For more control, we define them explicitly or start from pluginJsdoc.configs.recommended.rules and override
      ...pluginJsdoc.configs.recommended.rules,

      // General good practice rules
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-console': 'warn', // General warning for console usage

      // Custom JSDoc rules (fine-tune as needed)
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            'ClassProperty:not([accessibility="private"])', // For public class fields with JSDoc
            'MethodDefinition:not([accessibility="private"]) > FunctionExpression', // For public methods
          ],
        },
      ],
      'jsdoc/require-param': [
        'warn',
        { checkRestProperty: false, checkDestructuredRoots: false },
      ],
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-param-type': 'warn',
      'jsdoc/require-returns': ['warn', { checkGetters: false }],
      'jsdoc/require-returns-description': 'warn',
      'jsdoc/require-returns-type': 'warn',
      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-indentation': 'warn',
      'jsdoc/check-tag-names': [
        'warn',
        {
          // Customize the list of your accepted JSDoc tags
          definedTags: [
            'async',
            'throws',
            'implements',
            'typedef',
            'property',
            'template',
            'borrows',
            'fulfills',
            'satisfies',
            'interface',
            'class',
            'enum',
            'module',
            'private',
            'protected',
            'public',
            'readonly',
            'override',
            'deprecated',
            'example',
            'see',
            'link',
            'param',
            'returns',
            'type',
            'author',
            // Add any other standard or custom tags you use
          ],
        },
      ],
      'jsdoc/no-undefined-types': [
        'warn',
        {
          definedTypes: [
            // Common built-in types are usually recognized, but add if you see issues
            // e.g., "string", "number", "boolean", "object", "Array", "Promise", "Error", "Date"
            'Promise',
            'Constructor',
          ],
        },
      ],
      'jsdoc/valid-types': 'warn',
    },
  },

  // 3. Configuration for Jest test files
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest, // Jest global variables
      },
    },
    plugins: {
      jest: pluginJest,
    },
    rules: {
      ...pluginJest.configs.recommended.rules, // Apply Jest recommended rules
      'no-console': 'off', // Allow console.log in test files
    },
  },

  // 4. Configuration for babel.dependencyInjection.cjs (CommonJS)
  {
    files: ['babel.dependencyInjection.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node, // Still Node.js environment
      },
    },
    rules: {
      // You might want to keep no-console warn or off depending on usage
      'no-console': 'warn',
    },
  },

  // 5. Overrides for specific files allowing console.log (e.g., server startup & dependencyInjection)
  {
    files: ['src/core/server.js', 'src/dependencyInjection/appConfig.js'],
    rules: {
      'no-console': 'off',
    },
  },

  // 6. Prettier configuration (must be the last element in the array to override other formatting rules)
  eslintConfigPrettier,
];
