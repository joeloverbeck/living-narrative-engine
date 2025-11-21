/**
 * Jest configuration for property-based tests
 * Uses fast-check for property testing
 */
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/property/**/*.property.test.js'],
  collectCoverage: false, // Property tests don't need coverage
  verbose: true,
  maxWorkers: '50%', // Property tests can be CPU intensive
  testTimeout: 10000, // Longer timeout for property tests

  // ES Module support configuration
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1.js',
  },
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!tinyqueue/|uuid/|jsdom/node_modules/parse5/|parse5/)',
    '\\.pnp\\.[^\\/]+$',
  ],

  // Clear mocks between tests
  clearMocks: true,
};
