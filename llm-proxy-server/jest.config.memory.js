// jest.config.memory.js

/**
 * @description Jest configuration for memory tests.
 * Memory tests require special environment setup and longer timeouts
 * for memory stabilization and garbage collection.
 * @type {import('@jest/types').Config.InitialOptions}
 */
export default {
  // Use the same base configuration as the main Jest config
  testEnvironment: 'node',
  clearMocks: true,
  displayName: 'memory',
  
  // Run all memory tests
  testMatch: ['**/tests/memory/**/*.test.js'],
  
  // Memory tests need longer timeouts for GC stabilization
  testTimeout: 120000, // 2 minutes
  
  // Memory tests focus on memory usage, not code coverage
  collectCoverage: false,
  
  // Collect coverage from the services being tested
  collectCoverageFrom: [
    'src/services/cacheService.js',
    'src/services/apiKeyService.js',
    'src/services/httpAgentService.js',
    'src/handlers/llmRequestController.js',
    'src/services/llmRequestService.js',
  ],
  
  // Coverage directory specific to memory tests
  coverageDirectory: 'coverage/memory',
  coverageReporters: ['json', 'lcov', 'text', 'html'],
  
  // Detect open handles to help identify resource leaks
  detectOpenHandles: true,
  
  // Run tests sequentially for consistent memory measurements
  maxWorkers: 1,
  
  // Verbose output to see progress during long-running tests
  verbose: true,
  
  // Add Node.js flags to expose garbage collection for manual triggering
  testEnvironmentOptions: {
    // Allow manual garbage collection in tests
    nodeOptions: ['--expose-gc'],
  },
  
  // Increase memory limits for memory testing
  workerIdleMemoryLimit: '1GB',
};