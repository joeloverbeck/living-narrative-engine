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
  ],
  // Integration tests may take longer
  testTimeout: 30000,
  // Integration tests have moderate coverage expectations
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
