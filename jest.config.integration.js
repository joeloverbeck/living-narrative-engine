// jest.config.integration.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for integration tests only.
 * @type {import('@jest/types').Config.InitialOptions}
 */

// Relax coverage thresholds automatically when a specific test file/path is provided
// on the CLI (common for single-file debugging) to avoid failing global gates.
const isTargetedRun = process.argv.some((arg) =>
  arg.includes('tests/integration/') || arg.endsWith('.test.js') || arg.endsWith('.spec.js')
);

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
  // TODO: bump back above 1 once jest-worker crash (exitCode=0) is resolved.
  maxWorkers: 4,
  // Integration tests have moderate coverage expectations; skip thresholds for targeted runs
  coverageThreshold: isTargetedRun
    ? undefined
    : {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
};
