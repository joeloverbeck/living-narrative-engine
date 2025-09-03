// jest.config.e2e.js

/**
 * @description Jest configuration for end-to-end tests only.
 * Based on parent project's E2E configuration.
 * @type {import('@jest/types').Config.InitialOptions}
 */

// Import base configuration
import baseConfig from './jest.config.js';

export default {
  ...baseConfig,
  displayName: 'e2e',
  testMatch: [
    '<rootDir>/tests/e2e/**/*.test.js',
    '<rootDir>/tests/e2e/**/*.spec.js',
    '<rootDir>/tests/e2e/**/*.e2e.test.js',
  ],
  // E2E tests may take longer than unit/integration tests
  testTimeout: 60000,
  // Limit concurrent workers for stability
  maxWorkers: 4,
  // Enable force exit to prevent hanging
  forceExit: true,
  // Increase memory limits for E2E tests
  workerIdleMemoryLimit: '512MB',
  // E2E tests have lower coverage expectations due to their nature
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
    },
  },
  // Exclude other test directories when running E2E
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/unit/',
    '<rootDir>/tests/integration/',
    '<rootDir>/tests/contract/',
    '<rootDir>/tests/performance/',
  ],
};
