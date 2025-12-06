// jest.config.build.js

/* eslint-env node */
/* global module, require */

const baseConfig = require('./jest.config.integration.js');

/**
 * @description Jest configuration for build integration tests.
 * These tests need to run sequentially to avoid lock contention.
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  displayName: 'build-integration',
  testMatch: [
    '<rootDir>/tests/integration/build/**/*.test.js',
    '<rootDir>/tests/integration/build/**/*.spec.js',
  ],
  // Run build tests sequentially to avoid lock contention
  maxWorkers: 1,
  // Build tests may take longer
  testTimeout: 30000,
  // Build tests have moderate coverage expectations
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
