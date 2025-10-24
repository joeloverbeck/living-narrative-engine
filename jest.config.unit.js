// jest.config.unit.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for unit tests only.
 * @type {import('@jest/types').Config.InitialOptions}
 */
// Check if running CSS tests only to disable coverage thresholds
const runningCssTests = process.argv.some(
  (arg) => arg.includes('tests/unit/css/') || arg.includes('css.test.js')
);

module.exports = {
  ...baseConfig,
  displayName: 'unit',
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/unit/**/*.spec.js',
  ],
  // Unit tests should be fast, set a reasonable timeout
  testTimeout: 15000, // Increased slightly to handle performance tests
  // Memory management to prevent OOM kills
  maxWorkers: 8, // Limit concurrent workers
  workerIdleMemoryLimit: '512MB', // Kill idle workers consuming too much memory
  // Unit tests should have high coverage (skip for CSS tests)
  ...(runningCssTests
    ? {}
    : {
      coverageThreshold: {
        global: {
          branches: 91,
          functions: 91,
          lines: 91,
          statements: 91,
        },
      },
    }),
};
