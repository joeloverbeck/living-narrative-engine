/**
 * @file Manual test to verify anatomy visualizer bootstraps without errors
 * Run with: node tests/manual/verify-anatomy-visualizer.js
 */

import { CommonBootstrapper } from '../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { registerVisualizerComponents } from '../../src/dependencyInjection/registrations/visualizerRegistrations.js';

// Mock minimal DOM environment
global.document = {
  querySelector: () => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    setAttribute: () => {},
    addEventListener: () => {},
    appendChild: () => {},
    style: {},
  }),
  getElementById: () => null,
};

/**
 *
 */
async function verifyAnatomyVisualizer() {
  console.log('Testing anatomy visualizer bootstrap...\n');

  const bootstrapper = new CommonBootstrapper();
  let hasDoubleInitWarning = false;
  let hasMissingDependencyError = false;

  // Intercept console methods
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args) => {
    const message = args.join(' ');
    if (message.includes('AnatomyInitializationService: Already initialized')) {
      hasDoubleInitWarning = true;
      console.log('❌ FOUND: Double initialization warning');
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    const message = args.join(' ');
    if (message.includes('No service registered for key "IDocumentContext"')) {
      hasMissingDependencyError = true;
      console.log('❌ FOUND: Missing IDocumentContext error');
    }
    originalError.apply(console, args);
  };

  try {
    const result = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      postInitHook: async (services, container) => {
        // Register visualizer components
        registerVisualizerComponents(container);

        // Try to resolve key components
        const visualizationComposer = container.resolve(
          tokens.VisualizationComposer
        );
        console.log('✅ VisualizationComposer resolved successfully');

        const anatomyInitService = container.resolve(
          tokens.AnatomyInitializationService
        );
        console.log('✅ AnatomyInitializationService resolved successfully');
      },
    });

    console.log('\n✅ Bootstrap completed successfully');
  } catch (error) {
    console.log('\n❌ Bootstrap failed:', error.message);
  } finally {
    // Restore console methods
    console.warn = originalWarn;
    console.error = originalError;
  }

  // Report results
  console.log('\n=== Test Results ===');
  console.log(
    `Double initialization warning: ${hasDoubleInitWarning ? '❌ FAILED' : '✅ PASSED'}`
  );
  console.log(
    `Missing IDocumentContext error: ${hasMissingDependencyError ? '❌ FAILED' : '✅ PASSED'}`
  );

  if (!hasDoubleInitWarning && !hasMissingDependencyError) {
    console.log(
      '\n✅ All tests passed! The anatomy visualizer bootstraps correctly.'
    );
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Issues still need to be fixed.');
    process.exit(1);
  }
}

// Run the test
verifyAnatomyVisualizer().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
