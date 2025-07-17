// jest.config.unit.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for unit tests only.
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  displayName: 'unit',
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/unit/**/*.spec.js',
  ],
  // Unit tests should be fast, set a lower timeout
  testTimeout: 10000,
  // Unit tests should have high coverage
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
