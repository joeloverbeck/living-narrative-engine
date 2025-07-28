// jest.config.memory.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration for memory tests only.
 * Memory tests require special environment setup and longer timeouts
 * for memory stabilization and garbage collection.
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  displayName: 'memory',
  testMatch: [
    '<rootDir>/tests/memory/**/*.test.js',
    '<rootDir>/tests/memory/**/*.spec.js',
  ],
  // Memory tests need longer timeouts for GC stabilization
  testTimeout: 120000, // 2 minutes
  // Memory tests focus on memory usage, not code coverage
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  // Disable coverage collection for memory tests
  collectCoverage: false,
  // Run memory tests sequentially to avoid interference
  maxWorkers: 1,
  // Node.js options to expose garbage collection for memory tests
  setupFilesAfterEnv: ['./jest.setup.js', './tests/setup/memorySetup.js'],
  // Increase memory limits for memory testing
  workerIdleMemoryLimit: '1GB',
};
