// jest.config.actionbuilder.js

/* eslint-env node */
/* global module */

const baseConfig = require('./jest.config.js');

/**
 * @description Jest configuration specifically for ActionDefinitionBuilder components
 * with enhanced coverage thresholds and quality gates
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  displayName: 'actionbuilder',
  testMatch: [
    '<rootDir>/tests/unit/actions/builders/**/*.test.js',
    '<rootDir>/tests/integration/actions/actionDefinitionBuilder.integration.test.js',
    '<rootDir>/tests/performance/actions/actionBuilderPerformance.test.js',
  ],
  
  // Enhanced timeout for performance tests
  testTimeout: 30000,
  
  // Specific coverage collection for ActionDefinitionBuilder components
  collectCoverageFrom: [
    'src/actions/builders/actionDefinitionBuilder.js',
    'src/actions/builders/actionDefinitionValidator.js',
    // Include helper files
    'tests/common/actions/actionBuilderHelpers.js',
  ],
  
  // Strict coverage thresholds for ActionDefinitionBuilder components
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    // Component-specific thresholds
    'src/actions/builders/actionDefinitionBuilder.js': {
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/actions/builders/actionDefinitionValidator.js': {
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // Helper files should also have good coverage
    'tests/common/actions/actionBuilderHelpers.js': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // Enhanced reporters for better visibility
  coverageReporters: ['json', 'lcov', 'text', 'html', 'text-summary'],
  
  // Fail fast on coverage threshold failures
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  
  // Additional test environment setup for performance tests
  setupFilesAfterEnv: [
    './jest.setup.js',
    '<rootDir>/tests/setup/performanceSetup.js'
  ],
  
  // Verbose output for better debugging
  verbose: true,
  
  // Ensure tests run in band for accurate performance measurements
  maxWorkers: 1,
};