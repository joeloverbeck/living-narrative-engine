// llm-proxy-server/jest.config.perf.js

/**
 * @description Jest configuration for all performance tests (including load tests).
 * These tests focus on performance measurements, benchmarking, and load testing.
 * @type {import('@jest/types').Config.InitialOptions}
 */
export default {
  // Use the same base configuration as the main Jest config
  testEnvironment: 'node',
  clearMocks: true,

  // Run all performance tests
  testMatch: ['**/tests/performance/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],

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

  // Increased timeout for performance and load tests
  testTimeout: 30000,

  // Run tests sequentially for consistent measurements
  maxWorkers: 1,

  // Add Node.js flags to expose garbage collection for manual triggering
  testEnvironmentOptions: {
    // Allow manual garbage collection in tests
    nodeOptions: ['--expose-gc'],
  },
};
