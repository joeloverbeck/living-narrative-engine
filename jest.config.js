// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],

  // --- ADD THIS SECTION ---
  // By default, Jest ignores node_modules. We need to tell it *not* to ignore 'tinyqueue'
  // so that Babel (or whichever transformer you use) can process its ESM syntax.
  transformIgnorePatterns: [
    // Ignore node_modules except for 'tinyqueue'
    '/node_modules/(?!tinyqueue/)',

    // You might also need to keep other default ignores if applicable,
    // like the one for Yarn PnP:
    '\\.pnp\\.[^\\/]+$',
  ],
  // --- END ADDED SECTION ---

  // Optional: Ensure a transformer is configured if not relying on defaults
  // If you have a babel.config.js or similar, Jest often picks it up automatically.
  // If not, you might need to specify it explicitly:
  // transform: {
  //   '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': 'babel-jest', // or 'ts-jest' for TypeScript
  // },
};
