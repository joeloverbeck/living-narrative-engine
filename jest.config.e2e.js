// jest.config.e2e.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for end-to-end tests only.
 * @type {import('@jest/types').Config.InitialOptions}
 */
// Relax coverage gates automatically for single-file/targeted runs
const isTargetedRun = process.argv.some(
  (arg) =>
    arg.includes('tests/e2e/') ||
    arg.endsWith('.test.js') ||
    arg.endsWith('.spec.js')
);
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
  maxWorkers: 6, // Limit concurrent workers
  // Enable force exit to prevent hanging
  forceExit: true,
  // Increase memory limits for E2E tests
  workerIdleMemoryLimit: '512MB',
  // E2E tests have lower coverage expectations due to their nature; skip gates for targeted runs
  coverageThreshold: isTargetedRun
    ? undefined
    : {
        global: {
          branches: 20,
          functions: 20,
          lines: 20,
          statements: 20,
        },
      },
};
