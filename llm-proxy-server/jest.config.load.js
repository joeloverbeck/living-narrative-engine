// llm-proxy-server/jest.config.load.js

/**
 * @description Jest configuration specifically for load tests.
 * Load tests are separated from other performance tests to prevent interference.
 * @type {import('@jest/types').Config.InitialOptions}
 */
export default {
  // Use the same base configuration as the main Jest config
  testEnvironment: 'node',
  clearMocks: true,

  // Only run load testing files
  testMatch: ['**/tests/performance/load-testing.test.js'],

  // Disable coverage for load tests as they focus on performance, not code coverage
  collectCoverage: false,

  // Detect open handles to help identify resource leaks
  detectOpenHandles: true,

  // Increase timeout for load tests as they may take longer
  testTimeout: 30000,

  // Run tests sequentially to get consistent performance measurements
  maxWorkers: 1,

  // Verbose output to see progress during long-running tests
  verbose: true,

  // Global setup to ensure clean environment
  globalSetup: undefined,
  globalTeardown: undefined,

  // Add Node.js flags to expose garbage collection for manual triggering
  testEnvironmentOptions: {
    // Allow manual garbage collection in tests
    nodeOptions: ['--expose-gc'],
  },
};
