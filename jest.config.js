// jest.config.js

/* eslint-env node */
/* global module */

/**
 * @description Jest configuration for the root project.
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],

  transformIgnorePatterns: [
    // Ignore node_modules except for 'tinyqueue'
    '/node_modules/(?!tinyqueue/)',
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
  collectCoverageFrom: [
    'src/**/*.js', // Only collect coverage from source files
    '!**/node_modules/**',
    '!**/vendor/**',
    '!<rootDir>/llm-proxy-server/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!src/interfaces/**',
    '!src/commands/interfaces/**',
    '!src/turns/interfaces/**',
    '!src/prompting/interfaces/**',
    '!src/actions/actionTypes.js',
    '!src/index.js',
    '!index.js',
  ],

  // Optional: Enforce coverage levels. Uncomment and adjust as needed.
  coverageThreshold: {
    global: {
      branches: 82,
      functions: 91,
      lines: 90,
      statements: -1580,
    },
  },
  // --- END COVERAGE CONFIGURATION ---
};
