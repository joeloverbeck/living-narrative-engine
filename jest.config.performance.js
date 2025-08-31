// jest.config.performance.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for performance tests only.
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  displayName: 'performance',
  testMatch: [
    '<rootDir>/tests/performance/**/*.test.js',
    '<rootDir>/tests/performance/**/*.spec.js',
  ],
  // Performance tests need longer timeouts for benchmarking (reduced after optimization)
  testTimeout: 15000,
  // Performance tests focus on speed, not code coverage
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  // Disable coverage collection for performance tests
  collectCoverage: false,
  // Run performance tests sequentially to avoid interference
  maxWorkers: 1,
  // Allow console output for debugging
  silent: false,
};
