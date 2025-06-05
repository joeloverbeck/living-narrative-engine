// jest.config.js

/* eslint-env node */

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
    '**/*.js', // Collect from all .js files IN THE CURRENT PROJECT CONTEXT
    '!**/node_modules/**', // Exclude dependencies
    '!<rootDir>/llm-proxy-server/**', // Exclude all files within the sub-project from coverage
    '!**/vendor/**', // Example: if you have a third-party vendor directory
    '!jest.config.js', // Exclude Jest's own configuration file
    '!jest.setup.js', // Exclude Jest's setup file
    '!babel.config.js', // Exclude Babel configuration if you have one
    '!**/dist/**', // Exclude build output directory
    '!**/coverage/**', // Exclude the coverage report directory itself
    '!**/scripts/**', // Exclude non-source utility scripts (like validateMods.mjs) unless they are also tested
    // If your source code is in a specific directory, e.g., 'src', use:
    // 'src/**/*.js',
  ],

  // Optional: Enforce coverage levels. Uncomment and adjust as needed.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: -500,
    },
  },
  // --- END COVERAGE CONFIGURATION ---
};
