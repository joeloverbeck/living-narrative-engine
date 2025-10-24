// jest.config.integration.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for integration tests only.
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  displayName: 'integration',
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/integration/**/*.spec.js',
    // Exclude e2e tests that are still in integration folder (will be moved)
    '!<rootDir>/tests/integration/**/*.e2e.test.js',
    '!<rootDir>/tests/integration/EndToEnd*.test.js',
    '!<rootDir>/tests/integration/LLMResponseProcessor.e2e.test.js',
    // Exclude build tests which need to run sequentially
    '!<rootDir>/tests/integration/build/**/*.test.js',
  ],
  // Integration tests may take longer
  testTimeout: 30000,
  maxWorkers: 2, // Limit concurrent workers
  // Integration tests have moderate coverage expectations
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
