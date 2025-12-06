// jest.config.js

/* eslint-env node */
/* global module */

/**
 * @description Jest configuration for the root project.
 * @type {import('@jest/types').Config.InitialOptions}
 */

// Maintain full-file coverage accounting on suite-wide runs, but avoid pulling
// every source file into coverage when invoking Jest with explicit test paths
// (common for single-file debugging). On targeted runs, we let Jest default to
// instrumenting only the files that are actually imported by those tests.
const baseCollectCoverageFrom = [
  'src/**/*.js', // Only collect coverage from source files
  '!**/node_modules/**',
  '!**/vendor/**',
  '!<rootDir>/llm-proxy-server/**',
  '!**/dist/**',
  '!**/coverage/**',
  '!src/interfaces/**',
  '!src/entities/interfaces/**',
  '!src/commands/interfaces/**',
  '!src/turns/interfaces/**',
  '!src/prompting/interfaces/**',
  '!src/llms/interfaces/**',
  '!src/actions/pipeline/services/interfaces/**',
  '!src/actions/actionTypes.js',
  '!src/actions/resolutionResult.js',
  '!src/index.js',
  '!index.js',
];

const isTargetedRun = process.argv.some(
  (arg) =>
    arg.includes('tests/') ||
    arg.endsWith('.test.js') ||
    arg.endsWith('.spec.js')
);

module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: [
    './tests/setup/cleanupTestDirectories.js',
    './tests/setup/memorySetup.js',
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],

  // ES Module support configuration for dynamic imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1.js',
  },
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.js' }],
  },

  transformIgnorePatterns: [
    // Ignore node_modules except for 'tinyqueue', 'uuid', and the ESM-only parse5 dependency (even when nested under jsdom)
    '/node_modules/(?!tinyqueue/|uuid/|jsdom/node_modules/parse5/|parse5/)',
    '\\.pnp\\.[^\\/]+$',
  ],

  // --- Paths to ignore for test execution ---
  // Jest will not look for tests in these paths.
  // We include '/node_modules/' as it's a default we want to keep.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/llm-proxy-server/', // Exclude the sub-project directory
  ],

  // --- MOCK CONFIGURATION ---
  clearMocks: true, // Automatically clear mock calls and instances before every test

  // --- COVERAGE CONFIGURATION ---
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'html'],

  // An array of glob patterns indicating a set of files for which coverage information should be collected.
  // IMPORTANT: Adjust these patterns to match your project's source file locations.
  collectCoverageFrom: isTargetedRun ? undefined : baseCollectCoverageFrom,

  // --- END COVERAGE CONFIGURATION ---
};
