// llm-proxy-server/jest.config.integration.js

/**
 * @description Jest configuration for integration tests.
 * These tests focus on testing real filesystem operations, service interactions,
 * and end-to-end workflows in controlled environments.
 * @type {import('@jest/types').Config.InitialOptions}
 */
export default {
  // Use Node.js environment for filesystem and service testing
  testEnvironment: 'node',

  // Clear mocks between tests for isolation
  clearMocks: true,

  // Target only integration tests
  testMatch: ['**/tests/integration/**/*.test.js'],

  // Exclude other test types
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/unit/',
    '<rootDir>/tests/performance/',
    '<rootDir>/tests/contract/',
    '<rootDir>/tests/e2e/',
  ],

  // Coverage configuration for integration tests
  collectCoverage: true,
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['json', 'lcov', 'text', 'html'],

  // Collect coverage from all source files tested by integration tests
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!jest.config*.js',
    '!babel.config.js',
    '!**/coverage/**',
    // Exclude interfaces as they don't contain executable code
    '!src/interfaces/**',
  ],

  // Lower coverage thresholds for integration tests (focus on happy path)
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // Detect open handles to catch resource leaks
  detectOpenHandles: true,

  // Force exit after tests to prevent hanging (safety net)
  forceExit: true,

  // Longer timeout for filesystem and network operations
  testTimeout: 15000,

  // Run tests sequentially to avoid filesystem conflicts
  maxWorkers: 1,

  // Setup for integration tests - add global cleanup
  setupFilesAfterEnv: ['<rootDir>/tests/integration/globalSetup.js'],

  // Set environment variables for tests
  // Disable debug logging to prevent LogStorageService timer issues
  testEnvironmentOptions: {
    env: {
      NODE_ENV: 'test',
      DEBUG_LOGGING_ENABLED: 'false',
    },
  },
};
