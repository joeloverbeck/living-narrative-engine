// llm-proxy-server/jest.config.perf.js

/**
 * @description Jest configuration for performance tests (excluding load tests).
 * These tests focus on precise performance measurements without the interference
 * of intensive load testing.
 * @type {import('@jest/types').Config.InitialOptions}
 */
export default {
  // Use the same base configuration as the main Jest config
  testEnvironment: 'node',
  clearMocks: true,

  // Run all performance tests except load testing
  testMatch: ['**/tests/performance/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/performance/load-testing.test.js',
  ],

  // Coverage configuration for performance tests
  collectCoverage: true,
  coverageDirectory: 'coverage/performance',
  coverageReporters: ['json', 'lcov', 'text', 'html'],

  // Collect coverage from the services being tested
  collectCoverageFrom: [
    'src/services/cacheService.js',
    'src/services/apiKeyService.js',
    'src/services/httpAgentService.js',
    'src/handlers/llmRequestController.js',
    'src/services/llmRequestService.js',
  ],

  // Detect open handles to help identify resource leaks
  detectOpenHandles: true,

  // Standard timeout for performance tests
  testTimeout: 10000,

  // Run tests sequentially for consistent measurements
  maxWorkers: 1,

  // Add Node.js flags to expose garbage collection for manual triggering
  testEnvironmentOptions: {
    // Allow manual garbage collection in tests
    nodeOptions: ['--expose-gc'],
  },
};

