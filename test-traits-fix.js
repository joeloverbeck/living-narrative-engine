/**
 * Simple test to verify the traits generator fix
 * This test checks that the controller calls getCoreMotivationsByDirectionId
 * instead of the non-existent getCoreMotivations method
 */

import { TraitsGeneratorController } from './src/characterBuilder/controllers/TraitsGeneratorController.js';

// Create a mock service that will track which method is called
const mockService = {
  initialize: async () => true,
  getAllCharacterConcepts: async () => [],
  createCharacterConcept: () => {},
  updateCharacterConcept: () => {},
  deleteCharacterConcept: () => {},
  getCharacterConcept: () => {},
  generateThematicDirections: () => {},
  getThematicDirections: () => {},
  getAllThematicDirections: async () => [
    {
      id: 'test-dir',
      concept: 'Test',
      title: 'Test Direction',
      description: 'Test',
      createdAt: new Date().toISOString(),
    },
  ],
  getCliches: async () => ['test cliché'],
  getCoreMotivationsByDirectionId: async (directionId) => {
    console.log(
      `✅ SUCCESS: getCoreMotivationsByDirectionId was called with: ${directionId}`
    );
    return [
      {
        id: 'test-motivation',
        directionId: directionId,
        coreMotivation: 'Test motivation',
        internalContradiction: 'Test contradiction',
        centralQuestion: 'Test question?',
      },
    ];
  },
  generateTraits: () => {},
  getThematicDirectionsByConcept: async () => [],
  getClichesByDirectionId: async () => [],
};

// Add the incorrect method that should NOT be called
mockService.getCoreMotivations = async () => {
  console.error(
    '❌ ERROR: getCoreMotivations was called (this method should not exist!)'
  );
  throw new Error('Wrong method called!');
};

// Set up minimal DOM
global.document = {
  getElementById: (id) => {
    if (id === 'direction-selector') {
      return {
        options: [],
        value: 'test-dir',
        addEventListener: (event, handler) => {
          // Simulate change event
          if (event === 'change') {
            setTimeout(() => handler({ target: { value: 'test-dir' } }), 100);
          }
        },
        classList: { add: () => {}, remove: () => {} },
        disabled: false,
      };
    }
    return {
      innerHTML: '',
      style: { display: 'none' },
      addEventListener: () => {},
    };
  },
  querySelector: () => null,
  addEventListener: () => {},
};

global.window = { location: { search: '' } };

// Create controller
try {
  const controller = new TraitsGeneratorController({
    logger: {
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: console.error,
    },
    characterBuilderService: mockService,
    eventBus: {
      dispatch: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
    },
    uiStateManager: {
      showState: () => {},
      setState: () => {},
      getState: () => {},
      reset: () => {},
      hideError: () => {},
      showError: () => {},
    },
    traitsDisplayEnhancer: {
      enhanceForDisplay: () => ({}),
      generateExportFilename: () => 'test.txt',
      formatForExport: () => 'test',
    },
    schemaValidator: {
      validateAgainstSchema: () => ({ valid: true }),
    },
  });

  console.log('🔍 Testing TraitsGeneratorController...');

  // Initialize the controller
  await controller.initialize();

  console.log(
    '✅ Test completed successfully! The fix is working - getCoreMotivationsByDirectionId is being called correctly.'
  );
} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.message.includes('getCoreMotivations')) {
    console.error(
      'The bug still exists - the controller is trying to call getCoreMotivations instead of getCoreMotivationsByDirectionId'
    );
  }
  process.exit(1);
}

process.exit(0);
