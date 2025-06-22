// llm-proxy-server/jest.config.js

/**
 * @description Jest configuration for the llm-proxy-server sub-project.
 * @type {import('@jest/types').Config.InitialOptions}
 */
export const jestConfig = {
  // Explicitly set the test environment to 'node'.
  // This is Jest's default when it detects a Node.js project (e.g., no browser-specific globals).
  testEnvironment: 'node',

  // Automatically clear mock calls, instances, contexts and results before every test.
  clearMocks: true,

  // --- COVERAGE CONFIGURATION ---
  // The --coverage CLI flag (added to package.json script) enables coverage collection.
  // These options configure it.

  coverageDirectory: 'coverage', // Output directory for coverage reports.

  // Reporters to use. 'html' generates the visual report. 'text' provides a console summary.
  coverageReporters: ['json', 'lcov', 'text', 'html'],

  // An array of glob patterns indicating a set of files for which coverage information should be collected.
  // Adjust these patterns to match your llm-proxy-server's source file locations.
  // Assuming your source code is primarily within the 'src' directory based on "main": "src/core/server.js".
  collectCoverageFrom: [
    'src/**/*.js', // Collect from all .js files within the 'src' directory
    '!**/node_modules/**', // Exclude dependencies
    '!jest.config.js', // Exclude Jest's own configuration file
    '!babel.config.js', // Exclude Babel's configuration file
    '!**/coverage/**', // Exclude the coverage report directory itself
    // Add any other specific files or patterns to exclude if necessary
    // e.g., '!src/config/**' if config files are not to be covered
  ],

  // Enforce coverage levels. These are copied from your root config as a starting point.
  // Adjust them as necessary for the llm-proxy-server.
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  // --- END COVERAGE CONFIGURATION ---

  // By default, Jest will look for files ending with .js, .jsx, .ts, .tsx, .cjs, .mjs.
  // Your `babel.config.js` is set up to transpile based on your current Node version,
  // and `babel-jest` will use it. This means ES module syntax in your .js files
  // (as indicated by "type": "module" in package.json) will be handled correctly.

  // `transformIgnorePatterns` defaults to `['/node_modules/']`, which is usually fine for Node.js projects
  // unless you have specific ESM packages in node_modules that aren't being transformed and cause issues.
  // Your Babel setup targeting 'node: current' should handle most cases within your own source code.
};
