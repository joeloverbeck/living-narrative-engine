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

// Relax coverage gates automatically for single-file/targeted runs
const isTargetedRun = process.argv.some(
  (arg) =>
    arg.includes('tests/unit/') ||
    arg.includes('tests/contracts/') ||
    arg.endsWith('.test.js') ||
    arg.endsWith('.spec.js')
);

module.exports = {
  ...baseConfig,
  displayName: 'unit',
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/unit/**/*.spec.js',
    '<rootDir>/tests/contracts/**/*.test.js',
  ],
  // Unit tests should be fast, set a reasonable timeout
  testTimeout: 15000, // Increased slightly to handle performance tests
  // Memory management to prevent OOM kills
  maxWorkers: 6, // Limit concurrent workers
  workerIdleMemoryLimit: '512MB', // Kill idle workers consuming too much memory
  // Unit tests should have high coverage (skip for CSS tests)
  ...(runningCssTests || isTargetedRun
    ? {}
    : {
      coverageThreshold: {
        global: {
          branches: 92,
          functions: 97,
          lines: 98,
          statements: 97,
        },
        './src/domUI/damage-simulator/MultiHitSimulator.js': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        // RecommendationFactsBuilder has defensive checks that are unreachable
        // through the public API because upstream code (extractMoodConstraints,
        // predicate filtering) pre-validates data. These defensive checks at
        // lines 510, 516, 525, 630, 941, 948, 966, 994, 1026, 1056, 1062, 1071
        // are kept as safety nets but cannot be covered by tests.
        './src/expressionDiagnostics/services/RecommendationFactsBuilder.js': {
          statements: 96,
          branches: 87,
          functions: 100,
          lines: 96,
        },
      },
    }),
};
