// jest.config.e2e.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for end-to-end tests only.
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  displayName: 'e2e',
  testMatch: [
    '<rootDir>/tests/e2e/**/*.test.js',
    '<rootDir>/tests/e2e/**/*.spec.js',
    '<rootDir>/tests/e2e/**/*.e2e.test.js',
  ],
  // E2E tests may take even longer
  testTimeout: 60000,
  // E2E tests have lower coverage expectations due to their nature
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 9,
      lines: 7,
      statements: 7,
    },
  },
};
